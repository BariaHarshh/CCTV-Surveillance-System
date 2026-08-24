"""
AI Campus Guard - Multi-Class Person and Object Detector & Robust Tracker Module
Performs single-pass YOLOv8 + ByteTrack tracking with class-specific confidence thresholds,
confidence hysteresis, occlusion recovery, and track persistence.
"""

from typing import List, Dict, Tuple, Any, Optional, Union
import os
import torch
import numpy as np
from ultralytics import YOLO
import config.config as config

# COCO 80 dataset class mappings for relevant categories
COCO_CLASS_MAP = {
    0: "person",
    24: "backpack",
    26: "handbag",
    28: "suitcase",
    39: "bottle"
}

TARGET_OBJECT_CLASSES = [24, 26, 28, 39]
ALL_TRACKED_CLASSES = [0, 24, 26, 28, 39]

def compute_iou(box1: Tuple[int, int, int, int], box2: Tuple[int, int, int, int]) -> float:
    """Computes Intersection-over-Union (IoU) between two bounding boxes (x1, y1, x2, y2)."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_w = max(0, x2 - x1)
    inter_h = max(0, y2 - y1)
    inter_area = inter_w * inter_h

    area1 = max(1, (box1[2] - box1[0]) * (box1[3] - box1[1]))
    area2 = max(1, (box2[2] - box2[0]) * (box2[3] - box2[1]))
    union_area = area1 + area2 - inter_area

    return float(inter_area) / float(union_area) if union_area > 0 else 0.0

class MultiObjectDetector:
    """
    YOLO-based Multi-Object Detector and Tracker with Confidence Hysteresis & Occlusion Recovery.
    Executes single-pass inference and ByteTrack object tracking for both persons and target object categories.
    """
    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence_threshold: Optional[float] = None,
        tracker_type: Optional[str] = None,
        device: Optional[str] = None,
        imgsz: Optional[int] = None,
        half: Optional[bool] = None,
        target_classes: Optional[List[int]] = None,
        person_conf: float = 0.40,
        object_conf: float = 0.45,
        hysteresis_conf: float = 0.30,
        max_lost_frames: int = 20
    ):
        self.model_path = model_path or config.MODEL_PATH
        self.confidence_threshold = confidence_threshold or config.CONFIDENCE_THRESHOLD
        self.tracker_type = tracker_type or config.TRACKER_TYPE

        # Auto-detect compute device
        if device is None or device == "auto":
            self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        self.imgsz = imgsz or getattr(config, "INFERENCE_SIZE", 640)
        self.half = half if half is not None else (self.device.startswith("cuda"))
        self.target_classes = target_classes or ALL_TRACKED_CLASSES

        # Confidence Optimization Parameters
        self.person_conf = person_conf
        self.object_conf = object_conf
        self.hysteresis_conf = hysteresis_conf
        self.max_lost_frames = max_lost_frames

        # Track Persistence Memory: {track_id: {"box": (x1, y1, x2, y2), "cls_id": int, "cls_name": str, "conf": float, "lost_count": int}}
        self.track_memory: Dict[int, Dict[str, Any]] = {}
        self.frame_counter: int = 0

        # Optimize CPU multi-threading if running on CPU
        if self.device == "cpu" and hasattr(torch, "set_num_threads"):
            try:
                num_cores = os.cpu_count() or 4
                torch.set_num_threads(num_cores)
            except Exception:
                pass

        self.model: Optional[YOLO] = None
        self._load_model()

    def _load_model(self):
        """Loads the YOLO model with error handling and attaches to target device."""
        try:
            print(f"[INFO] Loading YOLO model: '{self.model_path}' on device: {self.device.upper()}...")
            self.model = YOLO(self.model_path)
            if hasattr(self.model, "to"):
                self.model.to(self.device)
            print(f"[INFO] MultiObjectDetector loaded successfully on {self.device.upper()} (imgsz={self.imgsz}).")
        except Exception as e:
            print(f"[ERROR] Failed to load YOLO model from '{self.model_path}': {e}")
            self.model = None

    def track(self, frame) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Performs single-pass detection and ByteTrack tracking with hysteresis filtering and track persistence.

        Args:
            frame: OpenCV image frame (BGR format)

        Returns:
            Tuple of (tracked_persons, tracked_objects):
                tracked_persons: List of dicts with keys {'track_id', 'box', 'confidence', 'class_name'}
                tracked_objects: List of dicts with keys {'track_id', 'box', 'confidence', 'class_id', 'class_name'}
        """
        if self.model is None or frame is None or frame.size == 0:
            return [], []

        self.frame_counter += 1

        try:
            with torch.inference_mode():
                # Use hysteresis threshold for base YOLO tracking to retain faint ongoing tracks
                min_query_conf = min(self.person_conf, self.object_conf, self.hysteresis_conf)
                track_kwargs = {
                    "persist": True,
                    "tracker": self.tracker_type,
                    "conf": min_query_conf,
                    "classes": self.target_classes,
                    "imgsz": self.imgsz,
                    "device": self.device,
                    "verbose": False
                }
                if self.half and self.device != "cpu":
                    track_kwargs["half"] = True

                results = self.model.track(frame, **track_kwargs)

            raw_detections: List[Dict[str, Any]] = []

            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue

                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    confidence = float(box.conf[0].item())
                    cls_id = int(box.cls[0].item()) if box.cls is not None else 0
                    track_id = int(box.id[0].item()) if (box.id is not None and len(box.id) > 0) else None
                    class_name = COCO_CLASS_MAP.get(cls_id, "object")

                    # Apply Category-Specific Confidence with Hysteresis
                    required_conf = self.person_conf if cls_id == 0 else self.object_conf

                    # If this track ID was already established in memory, apply hysteresis threshold
                    if track_id is not None and track_id in self.track_memory:
                        required_conf = self.hysteresis_conf

                    if confidence >= required_conf:
                        raw_detections.append({
                            "track_id": track_id,
                            "box": (x1, y1, x2, y2),
                            "confidence": round(confidence, 3),
                            "class_id": cls_id,
                            "class_name": class_name
                        })

            # Update Track Memory and Recover Missing Tracks (Short Occlusions)
            seen_ids = set()
            tracked_persons: List[Dict[str, Any]] = []
            tracked_objects: List[Dict[str, Any]] = []

            for det in raw_detections:
                tid = det["track_id"]
                if tid is not None:
                    seen_ids.add(tid)
                    self.track_memory[tid] = {
                        "box": det["box"],
                        "class_id": det["class_id"],
                        "class_name": det["class_name"],
                        "confidence": det["confidence"],
                        "lost_count": 0
                    }

                if det["class_id"] == 0:
                    tracked_persons.append(det)
                else:
                    tracked_objects.append(det)

            # Age lost tracks in memory and remove expired ones
            for tid in list(self.track_memory.keys()):
                if tid not in seen_ids:
                    self.track_memory[tid]["lost_count"] += 1
                    if self.track_memory[tid]["lost_count"] > self.max_lost_frames:
                        del self.track_memory[tid]

            return tracked_persons, tracked_objects

        except Exception as e:
            print(f"[ERROR] Error during multi-object tracking: {e}")
            return [], []

    def detect(self, frame):
        """Maintains backward compatibility with detection interface."""
        return self.track(frame)
