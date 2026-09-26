"""
AI Campus Guard - Multi-Camera Surveillance Orchestrator
Coordinates independent CCTV camera feeds dynamically loaded directly from feature preset YAML files
(crowd_detection.yaml, behavior_detection.yaml, restricted_area.yaml, abandoned_object.yaml).
"""

import os
import sys
import time
from typing import Dict, List, Tuple, Any, Optional
import cv2
import numpy as np
import yaml

import config.config as global_config
from features.crowd_detection import CountStabilizer, CrowdDetector, draw_crowd_detections
from features.behavior_detection import BehaviorProcessor, BehaviorConfig, draw_behavior_overlay
from features.restricted_area import RestrictedAreaProcessor, draw_restricted_area_overlay
from features.abandoned_object import MultiObjectDetector, AbandonedObjectProcessor, AbandonedObjectConfig, draw_abandoned_object_overlay
from .config import RiskConfig
from .processor import RiskAssessmentProcessor
from .event_adapter import EventNormalizer
from .event_model import RiskEvent
from .profiler import PerformanceProfiler
from .utils import draw_risk_assessment_overlay, UILayoutManager
from backend.services.stream_manager import stream_manager
from backend.services.publisher import detection_publisher

CAM_ID_MAP: Dict[str, str] = {
    "CAM-01": "CAM-000001",
    "CAM-02": "CAM-000002",
    "CAM-03": "CAM-000003",
    "CAM-04": "CAM-000004",
}


class MultiCameraOrchestrator:
    """
    Orchestrates CCTV camera streams in a 2x2 Quad Grid dynamically loaded from feature preset YAML files:
    - config/presets/crowd_detection.yaml
    - config/presets/behavior_detection.yaml
    - config/presets/restricted_area.yaml
    - config/presets/abandoned_object.yaml
    """
    def __init__(
        self,
        camera_sources: Optional[Dict[str, str]] = None,
        device: str = "auto",
        imgsz: int = 512,
        enable_profiling: bool = True
    ):
        self.device = device
        self.imgsz = imgsz
        self.enable_profiling = enable_profiling

        base_stock = global_config.VIDEOS_DIR
        self.sources: Dict[str, str] = camera_sources or {}
        self.cam_names: Dict[str, str] = {}
        self.cam_locations: Dict[str, str] = {}
        self.cam_zones: Dict[str, List[Dict[str, Any]]] = {}
        self.cam_feature_flags: Dict[str, Dict[str, bool]] = {}

        # 1. Load cameras dynamically from each Feature YAML preset file
        feature_presets = {
            "crowd_detection": "crowd_detection.yaml",
            "behavior_detection": "behavior_detection.yaml",
            "restricted_area": "restricted_area.yaml",
            "abandoned_object": "abandoned_object.yaml"
        }

        for feat_key, yaml_filename in feature_presets.items():
            yaml_path = os.path.join(global_config.PRESETS_DIR, yaml_filename)
            if not os.path.exists(yaml_path):
                continue

            try:
                with open(yaml_path, "r", encoding="utf-8") as f:
                    pdata = yaml.safe_load(f) or {}

                if not pdata.get("enabled", True):
                    continue

                cams = pdata.get("cameras", [])
                for cam in cams:
                    if not cam.get("enabled", True):
                        continue

                    cid = cam.get("camera_id")
                    if not cid:
                        continue

                    cname = cam.get("name", cid)
                    cloc = cam.get("location", "Campus Zone")
                    vpath = cam.get("video_path")
                    if vpath and not os.path.isabs(vpath):
                        vpath = os.path.join(global_config.BASE_DIR, vpath)

                    if not self.sources.get(cid) and vpath:
                        self.sources[cid] = vpath

                    self.cam_names[cid] = f"{cid} ({cname})"
                    self.cam_locations[cid] = cloc

                    if cam.get("zones"):
                        self.cam_zones[cid] = cam.get("zones", [])

                    if cid not in self.cam_feature_flags:
                        self.cam_feature_flags[cid] = {
                            "crowd_detection": False,
                            "behavior_detection": False,
                            "restricted_area": False,
                            "abandoned_object": False
                        }
                    self.cam_feature_flags[cid][feat_key] = True
            except Exception as e:
                print(f"[WARNING] Error reading feature preset '{yaml_filename}': {e}")

        # 2. Fallbacks for standard 4 camera matrix if any camera is missing
        default_matrix = [
            ("CAM-01", "Canteen Quad", os.path.join(base_stock, "stock", "sample4.mp4"), {"crowd_detection": True, "behavior_detection": False, "restricted_area": False, "abandoned_object": False}),
            ("CAM-02", "Hostel Corridor", os.path.join(base_stock, "stock", "sample5.mp4"), {"crowd_detection": False, "behavior_detection": True, "restricted_area": False, "abandoned_object": False}),
            ("CAM-03", "Server Room", os.path.join(base_stock, "stock", "sample6.mp4"), {"crowd_detection": False, "behavior_detection": False, "restricted_area": True, "abandoned_object": False}),
            ("CAM-04", "Main Lobby", os.path.join(base_stock, "stock", "sample7.mp4"), {"crowd_detection": False, "behavior_detection": False, "restricted_area": False, "abandoned_object": True}),
        ]

        for cid, cname, default_vpath, default_flags in default_matrix:
            if cid not in self.sources or not self.sources[cid]:
                self.sources[cid] = default_vpath
            if cid not in self.cam_names:
                self.cam_names[cid] = f"{cid} ({cname})"
            if cid not in self.cam_locations:
                self.cam_locations[cid] = cname
            if cid not in self.cam_feature_flags:
                self.cam_feature_flags[cid] = default_flags

        print(f"[INFO] Initialized Multi-Camera Matrix with {len(self.sources)} active streams.")

        # Shared YOLO MultiObjectDetector for person + luggage classes
        self.detector = MultiObjectDetector(
            model_path=global_config.MODEL_PATH,
            confidence_threshold=global_config.CONFIDENCE_THRESHOLD,
            tracker_type=global_config.TRACKER_TYPE,
            device=self.device,
            imgsz=self.imgsz,
            target_classes=[0, 24, 26, 28, 39],
            person_conf=0.40,
            object_conf=0.45,
            hysteresis_conf=0.30,
            max_lost_frames=20
        )

        # 3. Build dynamic processors per camera
        self.cam_processors: Dict[str, Dict[str, Any]] = {}
        for cid in ["CAM-01", "CAM-02", "CAM-03", "CAM-04"]:
            flags = self.cam_feature_flags.get(cid, {})
            loc = self.cam_locations.get(cid, "Campus Zone")
            proc_dict: Dict[str, Any] = {}

            if flags.get("crowd_detection", False):
                proc_dict["stabilizer"] = CountStabilizer(fps=25.0)
                proc_dict["crowd_detector"] = CrowdDetector(person_threshold=6, persistence_seconds=2.0)

            if flags.get("behavior_detection", False):
                beh_cfg = BehaviorConfig(camera_id=cid, location=loc)
                proc_dict["behavior_processor"] = BehaviorProcessor(config=beh_cfg)

            if flags.get("restricted_area", False):
                czones = self.cam_zones.get(cid) or [{
                    "name": f"{cid} RESTRICTED ZONE",
                    "enabled": True,
                    "severity": "critical",
                    "points": [[201, 271], [553, 174], [851, 268], [572, 531]]
                }]
                proc_dict["restricted_processor"] = RestrictedAreaProcessor(
                    zone_configs=czones,
                    camera_id=cid,
                    location=loc
                )

            if flags.get("abandoned_object", False):
                ab_cfg = AbandonedObjectConfig(camera_id=cid, location=loc)
                proc_dict["abandoned_processor"] = AbandonedObjectProcessor(config=ab_cfg)

            self.cam_processors[cid] = proc_dict

        # Central Risk Assessment Engine & Adapter
        risk_cfg = RiskConfig()
        self.risk_processor = RiskAssessmentProcessor(config=risk_cfg)
        self.profiler = PerformanceProfiler(window_size=30, enabled=self.enable_profiling)

        # Cached tracking and feature results for non-blocking high-FPS video streaming
        self._cached_tracks: Dict[str, Dict[str, Any]] = {
            "CAM-01": {"persons": [], "objects": []},
            "CAM-02": {"persons": [], "objects": []},
            "CAM-03": {"persons": [], "objects": []},
            "CAM-04": {"persons": [], "objects": []},
        }
        self._cached_cam_scores: Dict[str, float] = {
            "CAM-01": 5.0,
            "CAM-02": 5.0,
            "CAM-03": 5.0,
            "CAM-04": 5.0,
        }
        self._cached_feature_data: Dict[str, Dict[str, Any]] = {}
        self._latest_risk_output: Dict[str, Any] = {"current_risk_score": 5.0, "current_risk_level": "LOW", "new_alerts": []}

        # Threading for Decoupled AI Pipeline (Size=1 Bounded Buffer per Camera)
        import threading
        self._ai_lock = threading.Lock()
        self._latest_ai_frames: Dict[str, Tuple[np.ndarray, float, int]] = {}
        self._ai_wake_event = threading.Event()
        self._ai_running = True
        self._ai_thread = threading.Thread(target=self._ai_worker_loop, daemon=True, name="MultiCamAIWorker")
        self._ai_thread.start()

        # Camera Video Captures
        self.caps: Dict[str, cv2.VideoCapture] = {}
        self._init_captures()

    def _init_captures(self):
        """Initializes OpenCV video capture streams for all active cameras."""
        for cam_id, path in self.sources.items():
            if not path or not os.path.exists(path):
                path = os.path.join(global_config.VIDEOS_DIR, "stock", "sample.mp4")
            cap = cv2.VideoCapture(path)
            self.caps[cam_id] = cap

    def _ai_worker_loop(self):
        """
        Dedicated background worker executing YOLOv8 inference and feature detection
        on the latest captured frames at ~8-12 FPS without blocking video streaming.
        """
        while self._ai_running:
            try:
                self._ai_wake_event.wait(timeout=0.04)
                self._ai_wake_event.clear()

                with self._ai_lock:
                    if not self._latest_ai_frames:
                        continue
                    snapshot = self._latest_ai_frames.copy()
                    self._latest_ai_frames.clear()

                raw_events: List[Any] = []
                for cam_id, (frame, current_time, frame_index) in snapshot.items():
                    if frame is None or frame.size == 0 or not self.detector:
                        continue

                    target_cam_id = CAM_ID_MAP.get(cam_id, cam_id)
                    persons, objects = self.detector.track(frame)
                    self._cached_tracks[cam_id] = {"persons": persons, "objects": objects}

                    procs = self.cam_processors.get(cam_id, {})
                    cam_score = 5.0

                    # Crowd Detection
                    if "crowd_detector" in procs:
                        stabilizer = procs["stabilizer"]
                        crowd_detector = procs["crowd_detector"]
                        stable_cnt = stabilizer.update(len(persons), current_time=current_time)
                        crowd_out = crowd_detector.update(stable_cnt, current_time=current_time)
                        self._cached_feature_data[cam_id] = {
                            "type": "crowd",
                            "stable_cnt": stable_cnt,
                            "crowd_out": crowd_out,
                        }
                        if crowd_out.get("crowd_detected"):
                            ev = RiskEvent(
                                event_id=f"RISK-CROWD-{cam_id}-{int(current_time * 100) % 100000}",
                                source="crowd_detection",
                                event_type="crowd_detected",
                                confidence=0.85,
                                timestamp=current_time,
                                severity="high",
                                location=self.cam_locations.get(cam_id, "Campus Zone"),
                            )
                            raw_events.append(ev)
                            cam_score = max(cam_score, 30.0)

                        try:
                            detection_publisher.publish_crowd_detection(
                                raw_count=len(persons),
                                stable_count=stable_cnt,
                                crowd_info=crowd_out,
                                tracked_persons=persons,
                                frame_width=frame.shape[1],
                                frame_height=frame.shape[0],
                                camera_id=target_cam_id,
                                frame_index=frame_index,
                                current_time=current_time,
                                risk_score=cam_score,
                            )
                        except Exception:
                            pass

                    # Behavior Detection
                    if "behavior_processor" in procs:
                        beh_processor = procs["behavior_processor"]
                        beh_out = beh_processor.update(persons, current_time=current_time, frame_shape=frame.shape[:2])
                        self._cached_feature_data[cam_id] = {
                            "type": "behavior",
                            "beh_out": beh_out,
                        }
                        for ev in beh_out.get("new_events", []):
                            raw_events.append(ev)

                        has_fight = any(e.event_type == "potential_violent_activity" for e in beh_out.get("active_events", []))
                        has_fall = any(e.event_type == "person_fall" for e in beh_out.get("active_events", []))
                        if has_fight:
                            cam_score = max(cam_score, 85.0)
                        elif has_fall:
                            cam_score = max(cam_score, 60.0)

                        try:
                            detection_publisher.publish_behavior_detection(
                                tracked_persons=persons,
                                behavior_out=beh_out,
                                frame_width=frame.shape[1],
                                frame_height=frame.shape[0],
                                camera_id=target_cam_id,
                                frame_index=frame_index,
                                current_time=current_time,
                                risk_score=cam_score,
                            )
                        except Exception:
                            pass

                    # Restricted Area
                    if "restricted_processor" in procs:
                        ra_processor = procs["restricted_processor"]
                        ra_out = ra_processor.update(persons, current_time=current_time)
                        self._cached_feature_data[cam_id] = {
                            "type": "restricted",
                            "ra_out": ra_out,
                            "zone_manager": ra_processor.zone_manager,
                        }
                        for ev in ra_out.get("new_events", []):
                            raw_events.append(ev)

                        if ra_out.get("summary", {}).get("has_breach", False):
                            cam_score = max(cam_score, 75.0)

                        try:
                            detection_publisher.publish_restricted_area_detection(
                                tracked_persons=persons,
                                restricted_out=ra_out,
                                zone_manager=ra_processor.zone_manager,
                                frame_width=frame.shape[1],
                                frame_height=frame.shape[0],
                                camera_id=target_cam_id,
                                frame_index=frame_index,
                                current_time=current_time,
                                risk_score=cam_score,
                            )
                        except Exception:
                            pass

                    # Abandoned Object
                    if "abandoned_processor" in procs:
                        ab_processor = procs["abandoned_processor"]
                        ab_out = ab_processor.update(objects, persons, current_time=current_time)
                        self._cached_feature_data[cam_id] = {
                            "type": "abandoned",
                            "ab_out": ab_out,
                        }
                        for ev in ab_out.get("new_events", []):
                            raw_events.append(ev)

                        if len(ab_out.get("active_events", [])) > 0:
                            cam_score = max(cam_score, 50.0)

                        try:
                            detection_publisher.publish_abandoned_object_detection(
                                tracked_objects=objects,
                                tracked_persons=persons,
                                abandoned_out=ab_out,
                                frame_width=frame.shape[1],
                                frame_height=frame.shape[0],
                                camera_id=target_cam_id,
                                frame_index=frame_index,
                                current_time=current_time,
                                risk_score=cam_score,
                            )
                        except Exception:
                            pass

                    self._cached_cam_scores[cam_id] = cam_score

                if raw_events:
                    self._latest_risk_output = self.risk_processor.update(raw_events, current_time=time.time())

            except Exception as exc:
                pass

    def process_multi_cam_step(
        self,
        current_time: float,
        frame_index: int,
        frame_skip: int = 2,
        render_grid: bool = True,
    ) -> Dict[str, Any]:
        """
        Executes high-FPS decoupled multi-camera frame step:
        1. Reads clean video frames synchronously (<3ms total).
        2. Dispatches newest frame snapshot to bounded AI queue.
        3. Updates live video stream buffers immediately with CLEAN camera frames (25-30+ FPS).
        4. Optionally renders 2x2 quad grid when GUI window display is active.
        """
        self.profiler.start_frame()

        frames = {}
        for cam_id, cap in self.caps.items():
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
            frames[cam_id] = frame

        # Dispatch latest frames to background AI inference worker (size=1 latest-frame buffer)
        with self._ai_lock:
            for cam_id, frame in frames.items():
                if frame is not None:
                    self._latest_ai_frames[cam_id] = (frame, current_time, frame_index)
        self._ai_wake_event.set()

        # Immediate stream buffer update with CLEAN camera frames (takes <0.5ms total)
        for cam_id in ["CAM-01", "CAM-02", "CAM-03", "CAM-04"]:
            frame = frames.get(cam_id)
            if frame is None:
                continue

            try:
                stream_manager.update_frame(
                    camera_id=cam_id,
                    frame=frame,
                    frame_index=frame_index,
                )
            except Exception:
                pass

        self.profiler.end_frame()
        perf_summary = self.profiler.get_summary()

        risk_output = self._latest_risk_output
        cam_risk_scores = self._cached_cam_scores

        quad_grid = None
        if render_grid:
            annotated_frames: Dict[str, np.ndarray] = {}
            for cam_id in ["CAM-01", "CAM-02", "CAM-03", "CAM-04"]:
                frame = frames.get(cam_id)
                if frame is None:
                    continue
                annotated = frame.copy()
                cached_tracks = self._cached_tracks.get(cam_id, {})
                persons = cached_tracks.get("persons", [])
                objects = cached_tracks.get("objects", [])
                feat_data = self._cached_feature_data.get(cam_id, {})

                feat_type = feat_data.get("type")
                if feat_type == "crowd":
                    stable_cnt = feat_data.get("stable_cnt", len(persons))
                    crowd_out = feat_data.get("crowd_out", {})
                    annotated = draw_crowd_detections(annotated, persons, len(persons), stable_cnt, crowd_out)
                elif feat_type == "behavior":
                    beh_out = feat_data.get("beh_out", {})
                    annotated = draw_behavior_overlay(annotated, persons, beh_out, show_hud=True)
                elif feat_type == "restricted":
                    ra_out = feat_data.get("ra_out", {})
                    zm = feat_data.get("zone_manager")
                    annotated = draw_restricted_area_overlay(annotated, persons, ra_out, zone_manager=zm, show_hud=True)
                elif feat_type == "abandoned":
                    ab_out = feat_data.get("ab_out", {})
                    annotated = draw_abandoned_object_overlay(frame=annotated, tracked_persons=persons, abandoned_output=ab_out, show_hud=True)
                annotated_frames[cam_id] = annotated

            quad_grid = self.render_quad_grid(annotated_frames, risk_output, cam_risk_scores, perf_summary)
            self.profiler.mark_stage("ui_render")

        return {
            "quad_grid": quad_grid,
            "risk_output": risk_output,
            "cam_risk_scores": cam_risk_scores,
            "performance_summary": perf_summary
        }

    def render_quad_grid(
        self,
        annotated_frames: Dict[str, np.ndarray],
        risk_output: Dict[str, Any],
        cam_risk_scores: Dict[str, float],
        perf_summary: Dict[str, Any]
    ) -> np.ndarray:
        """Stitches 4 camera frames into a clean 2x2 Video Quad Grid with Master Risk Dashboard Header."""
        grid_w, grid_h = 1280, 720
        cell_w, cell_h = 640, 360

        canvas = np.zeros((grid_h, grid_w, 3), dtype=np.uint8)

        positions = {
            "CAM-01": (0, 0),          # Top-Left
            "CAM-02": (640, 0),        # Top-Right
            "CAM-03": (0, 360),        # Bottom-Left
            "CAM-04": (640, 360)       # Bottom-Right
        }

        for cam_id, (x, y) in positions.items():
            frame = annotated_frames.get(cam_id)
            if frame is not None:
                resized = cv2.resize(frame, (cell_w, cell_h))
            else:
                resized = np.zeros((cell_h, cell_w, 3), dtype=np.uint8)
                cv2.putText(resized, f"CAMERA OFFLINE: {cam_id}", (150, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

            # Build list of active features for camera banner
            flags = self.cam_feature_flags.get(cam_id, {})
            active_feats = [k.replace("_detection", "").replace("_area", "").upper() for k, v in flags.items() if v]
            feat_str = " + ".join(active_feats) if active_feats else "PASSIVE"

            score = cam_risk_scores.get(cam_id, 0.0)
            status_color = (0, 0, 255) if score >= 75 else ((0, 215, 255) if score >= 35 else (0, 255, 0))

            cv2.rectangle(resized, (0, 0), (cell_w, 28), (20, 20, 20), -1)
            cv2.putText(resized, f"{self.cam_names.get(cam_id, cam_id)} [{feat_str}] | RISK: {int(score)} PTS", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, status_color, 2, cv2.LINE_AA)

            # Draw Quad Grid Border
            cv2.rectangle(resized, (0, 0), (cell_w, cell_h), (60, 60, 60), 1)
            canvas[y:y+cell_h, x:x+cell_w] = resized

        # -------------------------------------------------------------
        # Center Overlay: Master Campus Threat Level Banner
        # -------------------------------------------------------------
        global_score = risk_output.get("current_risk_score", 0.0)
        level_text = risk_output.get("current_risk_level", "LOW")
        g_color = (0, 0, 255) if global_score >= 75 else ((0, 140, 255) if global_score >= 50 else ((0, 215, 255) if global_score >= 25 else (0, 255, 0)))

        # Draw Center Top Master Bar
        cv2.rectangle(canvas, (380, 0), (900, 36), (10, 10, 10), -1)
        cv2.rectangle(canvas, (380, 0), (900, 36), g_color, 2)

        title_str = f"GLOBAL CAMPUS THREAT: {int(global_score)} / 100 ({level_text})"
        cv2.putText(canvas, title_str, (400, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.65, g_color, 2, cv2.LINE_AA)

        return canvas

    def release(self):
        """Releases video capture and background AI worker resources."""
        self._ai_running = False
        self._ai_wake_event.set()
        if hasattr(self, "_ai_thread") and self._ai_thread.is_alive():
            try:
                self._ai_thread.join(timeout=1.0)
            except Exception:
                pass
        for cap in self.caps.values():
            if cap:
                cap.release()
