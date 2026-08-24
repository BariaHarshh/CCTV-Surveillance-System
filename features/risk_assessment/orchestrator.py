"""
AI Campus Guard - Central Risk Management Orchestrator
Master coordinator that initializes enabled detection subsystems, orchestrates single-pass frame inference,
routes multi-source events with fault isolation, executes adaptive cadence scheduling, and updates real-time campus risk scores.
"""

from typing import Dict, List, Tuple, Any, Optional, Union
import time
import os
import traceback

from features.abandoned_object import MultiObjectDetector, AbandonedObjectProcessor, AbandonedObjectConfig
from features.crowd_detection import CountStabilizer, CrowdDetector
from features.behavior_detection import BehaviorProcessor, BehaviorConfig
from features.restricted_area import RestrictedAreaProcessor
from .config import RiskConfig
from .processor import RiskAssessmentProcessor
from .event_model import RiskEvent
from .profiler import PerformanceProfiler
import config.config as global_config

class RiskManagementOrchestrator:
    """
    Central operational orchestrator for AI Campus Guard.
    Dynamically loads only enabled detection features, shares a single YOLO inference pipeline,
    isolates feature runtime failures, profiles execution latency, and feeds the centralized Risk Assessment Engine.
    """
    def __init__(
        self,
        config_data: Optional[Dict[str, Any]] = None,
        device: Optional[str] = "auto",
        imgsz: Optional[int] = None,
        camera_id: str = "CAM-01",
        location: str = "Campus Public Area",
        enable_profiling: bool = True
    ):
        self.raw_config: Dict[str, Any] = config_data or {}
        self.device = device or "auto"
        self.imgsz = imgsz
        self.camera_id = camera_id
        self.location = location
        self.enable_profiling = enable_profiling

        # 1. Parse Risk Management Orchestration Settings
        rm_conf = self.raw_config.get("risk_management", {})
        self.enabled = rm_conf.get("enabled", True)
        self.demo_mode = rm_conf.get("demo_mode", False)

        features_conf = rm_conf.get("features", {})
        self.feature_flags: Dict[str, bool] = {
            "crowd_detection": features_conf.get("crowd_detection", {}).get("enabled", True) if isinstance(features_conf.get("crowd_detection"), dict) else bool(features_conf.get("crowd_detection", True)),
            "behavior_detection": features_conf.get("behavior_detection", {}).get("enabled", True) if isinstance(features_conf.get("behavior_detection"), dict) else bool(features_conf.get("behavior_detection", True)),
            "abandoned_object": features_conf.get("abandoned_object", {}).get("enabled", True) if isinstance(features_conf.get("abandoned_object"), dict) else bool(features_conf.get("abandoned_object", True)),
            "restricted_area": features_conf.get("restricted_area", {}).get("enabled", True) if isinstance(features_conf.get("restricted_area"), dict) else bool(features_conf.get("restricted_area", True)),
        }

        # Frame processing cadence intervals per feature (Adaptive Scheduling)
        intervals_conf = rm_conf.get("performance", {}).get("feature_intervals", {})
        self.person_interval: int = int(intervals_conf.get("person_detection", 1))
        self.feature_intervals: Dict[str, int] = {
            "crowd_detection": int(intervals_conf.get("crowd_detection", 1)),
            "behavior_detection": int(intervals_conf.get("behavior_detection", 2)),
            "abandoned_object": int(intervals_conf.get("abandoned_object", 2)),
            "restricted_area": int(intervals_conf.get("restricted_area", 1))
        }

        # 2. Performance Profiler
        self.profiler = PerformanceProfiler(window_size=30, enabled=self.enable_profiling)

        # 3. Feature Status Diagnostics: 'ACTIVE', 'DISABLED', 'ERROR', 'STANDBY'
        self.feature_statuses: Dict[str, str] = {
            "crowd_detection": "ACTIVE" if self.feature_flags["crowd_detection"] else "DISABLED",
            "behavior_detection": "ACTIVE" if self.feature_flags["behavior_detection"] else "DISABLED",
            "abandoned_object": "ACTIVE" if self.feature_flags["abandoned_object"] else "DISABLED",
            "restricted_area": "ACTIVE" if self.feature_flags["restricted_area"] else "DISABLED",
            "risk_assessment": "ACTIVE"
        }

        # 4. Subsystem Processors
        self.detector: Optional[MultiObjectDetector] = None
        self.stabilizer: Optional[CountStabilizer] = None
        self.crowd_detector: Optional[CrowdDetector] = None
        self.behavior_processor: Optional[BehaviorProcessor] = None
        self.abandoned_processor: Optional[AbandonedObjectProcessor] = None
        self.restricted_processor: Optional[RestrictedAreaProcessor] = None
        self.risk_processor: Optional[RiskAssessmentProcessor] = None
        self.zone_configs: List[Dict[str, Any]] = []

        # Cached results for frame skipping
        self._cached_persons: List[Dict[str, Any]] = []
        self._cached_objects: List[Dict[str, Any]] = []
        self._cached_crowd: Dict[str, Any] = {"crowd_detected": False, "status": "NORMAL"}
        self._cached_beh: Dict[str, Any] = {"new_events": [], "active_events": []}
        self._cached_ab: Dict[str, Any] = {"new_events": [], "active_events": []}
        self._cached_ra: Dict[str, Any] = {"new_events": [], "active_events": []}

        # Initialize active subsystems
        self.initialize()

    def initialize(self):
        """
        Instantiates ONLY enabled detection features and configures the shared YOLO detector ONCE.
        """
        any_detection_needed = any(self.feature_flags.values())
        if not any_detection_needed:
            print("[INFO] RiskManagementOrchestrator: All detection features are disabled. Passive risk mode active.")
            self.detector = None
        else:
            # Determine target YOLO classes needed
            if self.feature_flags["abandoned_object"]:
                target_classes = [0, 24, 26, 28, 39]  # Person + Backpack, Handbag, Suitcase, Bottle
            else:
                target_classes = [0]  # Person only

            inf_size = self.imgsz or getattr(global_config, "INFERENCE_SIZE", 640)
            self.detector = MultiObjectDetector(
                model_path=global_config.MODEL_PATH,
                confidence_threshold=global_config.CONFIDENCE_THRESHOLD,
                tracker_type=global_config.TRACKER_TYPE,
                device=self.device,
                imgsz=inf_size,
                target_classes=target_classes,
                person_conf=0.40,
                object_conf=0.45,
                hysteresis_conf=0.30,
                max_lost_frames=20
            )

        # 1. Initialize Crowd Detection if enabled
        if self.feature_flags["crowd_detection"]:
            try:
                p_thresh = self.raw_config.get("crowd", {}).get("person_threshold", global_config.PERSON_THRESHOLD)
                p_sec = self.raw_config.get("crowd", {}).get("persistence_seconds", global_config.PERSISTENCE_SECONDS)
                if self.demo_mode:
                    p_sec = min(p_sec, 2.0)

                self.stabilizer = CountStabilizer(fps=30.0)
                self.crowd_detector = CrowdDetector(person_threshold=p_thresh, persistence_seconds=p_sec)
                self.feature_statuses["crowd_detection"] = "ACTIVE"
            except Exception as e:
                print(f"[ERROR] Failed to initialize Crowd Detection: {e}")
                self.feature_statuses["crowd_detection"] = "ERROR"

        # 2. Initialize Behaviour Detection if enabled
        if self.feature_flags["behavior_detection"]:
            try:
                beh_cfg_dict = self.raw_config.get("behavior_detection", {})
                beh_cfg = BehaviorConfig()
                self.behavior_processor = BehaviorProcessor(config=beh_cfg)
                self.feature_statuses["behavior_detection"] = "ACTIVE"
            except Exception as e:
                print(f"[ERROR] Failed to initialize Behaviour Detection: {e}")
                self.feature_statuses["behavior_detection"] = "ERROR"

        # 3. Initialize Abandoned Object Detection if enabled
        if self.feature_flags["abandoned_object"]:
            try:
                ab_cfg_dict = self.raw_config.get("abandoned_object", {})
                ab_cfg = AbandonedObjectConfig.from_dict(ab_cfg_dict)
                if self.demo_mode:
                    ab_cfg.use_demo_escalation = True
                    ab_cfg.demo_escalation_seconds = 15.0

                self.abandoned_processor = AbandonedObjectProcessor(config=ab_cfg)
                self.feature_statuses["abandoned_object"] = "ACTIVE"
            except Exception as e:
                print(f"[ERROR] Failed to initialize Abandoned Object Detection: {e}")
                self.feature_statuses["abandoned_object"] = "ERROR"

        # 4. Initialize Restricted Area Detection if enabled
        if self.feature_flags["restricted_area"]:
            try:
                ra_conf = self.raw_config.get("restricted_area", {})
                zones = ra_conf.get("zones", [{
                    "name": "NORTH CORRIDOR RESTRICTED ZONE",
                    "enabled": True,
                    "severity": "critical",
                    "points": [[50, 150], [350, 150], [350, 320], [50, 320]]
                }])
                self.zone_configs = zones
                self.restricted_processor = RestrictedAreaProcessor(
                    zone_configs=zones,
                    camera_id=self.camera_id,
                    location=self.location
                )
                self.feature_statuses["restricted_area"] = "ACTIVE"
            except Exception as e:
                print(f"[ERROR] Failed to initialize Restricted Area Detection: {e}")
                self.feature_statuses["restricted_area"] = "ERROR"

        # 5. Initialize Risk Assessment Engine
        try:
            risk_conf_dict = self.raw_config.get("risk_assessment", {})
            risk_cfg = RiskConfig.from_dict(risk_conf_dict)
            self.risk_processor = RiskAssessmentProcessor(config=risk_cfg)
            self.feature_statuses["risk_assessment"] = "ACTIVE"
        except Exception as e:
            print(f"[ERROR] Failed to initialize Risk Assessment Engine: {e}")
            self.feature_statuses["risk_assessment"] = "ERROR"

    def set_feature_enabled(self, feature_name: str, enabled: bool):
        """
        Dynamically enables or disables a detection feature at runtime without restart.
        """
        if feature_name not in self.feature_flags:
            print(f"[WARNING] Unknown feature toggle: '{feature_name}'")
            return

        self.feature_flags[feature_name] = bool(enabled)
        self.feature_statuses[feature_name] = "ACTIVE" if enabled else "DISABLED"

        # On-demand initialization if enabled and processor was not yet initialized
        if enabled:
            if feature_name == "crowd_detection" and self.crowd_detector is None:
                p_thresh = self.raw_config.get("crowd", {}).get("person_threshold", global_config.PERSON_THRESHOLD)
                p_sec = self.raw_config.get("crowd", {}).get("persistence_seconds", global_config.PERSISTENCE_SECONDS)
                self.stabilizer = CountStabilizer(fps=30.0)
                self.crowd_detector = CrowdDetector(person_threshold=p_thresh, persistence_seconds=p_sec)
            elif feature_name == "behavior_detection" and self.behavior_processor is None:
                self.behavior_processor = BehaviorProcessor(config=BehaviorConfig())
            elif feature_name == "abandoned_object" and self.abandoned_processor is None:
                self.abandoned_processor = AbandonedObjectProcessor()
            elif feature_name == "restricted_area" and self.restricted_processor is None:
                self.restricted_processor = RestrictedAreaProcessor(
                    zone_configs=self.zone_configs or [],
                    camera_id=self.camera_id,
                    location=self.location
                )

        # Update detector target classes if abandoned_object toggled
        if self.detector is not None:
            if self.feature_flags.get("abandoned_object", False):
                self.detector.target_classes = [0, 24, 26, 28, 39]
            else:
                self.detector.target_classes = [0]

        print(f"[INFO] Feature '{feature_name}' set to {'ENABLED (ACTIVE)' if enabled else 'DISABLED'}.")

    def update_zones(self, zone_configs: List[Dict[str, Any]], frame_shape: Optional[Tuple[int, int]] = None):
        """
        Dynamically updates active restricted zones in real-time.
        """
        self.zone_configs = list(zone_configs)
        if self.restricted_processor is not None:
            self.restricted_processor.set_zones(self.zone_configs, frame_shape=frame_shape)
        print(f"[INFO] Updated {len(self.zone_configs)} restricted zones in Orchestrator.")

    def process_frame(
        self,
        frame,
        current_time: float,
        frame_index: int = 1,
        injected_events: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        """
        Executes single-pass YOLO tracking, routes the shared frame to active subsystems with fault isolation,
        aggregates events into the Risk Assessment Engine, and returns the master state.
        """
        h_img, w_img = frame.shape[:2] if (frame is not None and hasattr(frame, "shape")) else (480, 640)

        # Profiler frame start
        self.profiler.start_frame()

        # 1. Single-pass detection on shared frame (with adaptive cadence)
        should_run_yolo = (frame_index == 1) or (frame_index % self.person_interval == 0)
        if self.detector is not None and should_run_yolo:
            try:
                self._cached_persons, self._cached_objects = self.detector.track(frame)
            except Exception as e:
                print(f"[ERROR] Detection tracking failed on frame {frame_index}: {e}")
                self._cached_persons, self._cached_objects = [], []

        tracked_persons = self._cached_persons
        tracked_objects = self._cached_objects
        self.profiler.mark_stage("detection")

        # 2. Execute Crowd Detection (if enabled & cadence hit)
        if self.feature_flags["crowd_detection"] and self.crowd_detector is not None:
            interval = self.feature_intervals["crowd_detection"]
            if frame_index == 1 or (frame_index % interval == 0):
                try:
                    stable_count = self.stabilizer.update(len(tracked_persons), current_time=current_time) if self.stabilizer else len(tracked_persons)
                    self._cached_crowd = self.crowd_detector.update(stable_count, current_time=current_time)
                    self.feature_statuses["crowd_detection"] = "ACTIVE"
                except Exception as e:
                    print(f"[WARNING] Crowd Detection processing error: {e}")
                    self.feature_statuses["crowd_detection"] = "ERROR"
                    self._cached_crowd = {"crowd_detected": False, "status": "ERROR"}
        self.profiler.mark_stage("crowd")

        # 3. Execute Behaviour Detection (if enabled & cadence hit)
        if self.feature_flags["behavior_detection"] and self.behavior_processor is not None:
            interval = self.feature_intervals["behavior_detection"]
            if frame_index == 1 or (frame_index % interval == 0):
                try:
                    self._cached_beh = self.behavior_processor.update(
                        tracked_persons,
                        current_time=current_time,
                        frame_shape=(h_img, w_img)
                    )
                    self.feature_statuses["behavior_detection"] = "ACTIVE"
                except Exception as e:
                    print(f"[WARNING] Behaviour Detection processing error: {e}")
                    self.feature_statuses["behavior_detection"] = "ERROR"
                    self._cached_beh = {"new_events": [], "active_events": []}
        self.profiler.mark_stage("behavior")

        # 4. Execute Abandoned Object Detection (if enabled & cadence hit)
        if self.feature_flags["abandoned_object"] and self.abandoned_processor is not None:
            interval = self.feature_intervals["abandoned_object"]
            if frame_index == 1 or (frame_index % interval == 0):
                try:
                    self._cached_ab = self.abandoned_processor.update(
                        tracked_objects=tracked_objects,
                        tracked_persons=tracked_persons,
                        current_time=current_time,
                        frame_shape=(h_img, w_img)
                    )
                    self.feature_statuses["abandoned_object"] = "ACTIVE"
                except Exception as e:
                    print(f"[WARNING] Abandoned Object processing error: {e}")
                    self.feature_statuses["abandoned_object"] = "ERROR"
                    self._cached_ab = {"new_events": [], "active_events": []}
        self.profiler.mark_stage("abandoned")

        # 5. Execute Restricted Area Detection (if enabled & cadence hit)
        if self.feature_flags["restricted_area"] and self.restricted_processor is not None:
            interval = self.feature_intervals["restricted_area"]
            if frame_index == 1 or (frame_index % interval == 0):
                try:
                    self._cached_ra = self.restricted_processor.update(
                        tracked_persons=tracked_persons,
                        current_time=current_time,
                        frame_shape=(w_img, h_img)
                    )
                    self.feature_statuses["restricted_area"] = "ACTIVE"
                except Exception as e:
                    print(f"[WARNING] Restricted Area processing error: {e}")
                    self.feature_statuses["restricted_area"] = "ERROR"
                    self._cached_ra = {"new_events": [], "active_events": []}
        self.profiler.mark_stage("restricted")

        # 6. Aggregate into Central Risk Assessment Engine
        risk_output = {
            "current_risk_score": 0.0,
            "current_risk_level": "LOW",
            "status": "NORMAL",
            "active_incidents": [],
            "resolved_incidents": [],
            "new_alerts": [],
            "summary": {}
        }
        if self.risk_processor is not None:
            try:
                risk_output = self.risk_processor.update(
                    events=injected_events,
                    crowd_output=self._cached_crowd if self.feature_flags["crowd_detection"] else None,
                    behavior_output=self._cached_beh if self.feature_flags["behavior_detection"] else None,
                    abandoned_output=self._cached_ab if self.feature_flags["abandoned_object"] else None,
                    restricted_output=self._cached_ra if self.feature_flags["restricted_area"] else None,
                    current_time=current_time
                )
                self.feature_statuses["risk_assessment"] = "ACTIVE"
            except Exception as e:
                print(f"[ERROR] Risk Assessment Engine update error: {e}")
                self.feature_statuses["risk_assessment"] = "ERROR"
        self.profiler.mark_stage("risk_engine")

        perf_summary = self.profiler.end_frame()

        return {
            "risk_output": risk_output,
            "feature_statuses": dict(self.feature_statuses),
            "feature_flags": dict(self.feature_flags),
            "feature_outputs": {
                "crowd": self._cached_crowd if self.feature_flags["crowd_detection"] else None,
                "behavior": self._cached_beh if self.feature_flags["behavior_detection"] else None,
                "abandoned": self._cached_ab if self.feature_flags["abandoned_object"] else None,
                "restricted": self._cached_ra if self.feature_flags["restricted_area"] else None
            },
            "tracked_persons": tracked_persons,
            "tracked_objects": tracked_objects,
            "zone_configs": getattr(self, "zone_configs", []),
            "frame_index": frame_index,
            "timestamp": current_time,
            "performance_summary": perf_summary
        }
