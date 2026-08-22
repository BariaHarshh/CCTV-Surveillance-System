"""
Person Detector Module for Crowd Detection Feature
Handles object detection and tracking using Ultralytics YOLO & ByteTrack.
"""

import torch
from ultralytics import YOLO
import config.config as config

class PersonDetector:
    """
    YOLO-based Person Detector and Tracker (Optimized).
    Loads a lightweight YOLO model and tracks person detections across consecutive frames.
    Supports auto-device selection (CUDA/CPU), inference mode, and configurable image sizes.
    """
    def __init__(
        self,
        model_path=None,
        confidence_threshold=None,
        tracker_type=None,
        device=None,
        imgsz=None,
        half=None
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

        # Optimize CPU multi-threading if running on CPU
        if self.device == "cpu" and hasattr(torch, "set_num_threads"):
            try:
                import os
                num_cores = os.cpu_count() or 4
                torch.set_num_threads(num_cores)
            except Exception:
                pass

        self.model = None
        self._load_model()

    def _load_model(self):
        """
        Loads the YOLO model with error handling and attaches to target device.
        """
        try:
            print(f"[INFO] Loading YOLO model: '{self.model_path}' on device: {self.device.upper()}...")
            self.model = YOLO(self.model_path)
            # Pre-warm or assign device
            if hasattr(self.model, "to"):
                self.model.to(self.device)
            print(f"[INFO] YOLO model loaded successfully on {self.device.upper()} (imgsz={self.imgsz}).")
        except Exception as e:
            print(f"[ERROR] Failed to load YOLO model from '{self.model_path}': {e}")
            self.model = None

    def track(self, frame):
        """
        Tracks persons in a given OpenCV frame using ByteTrack.

        Args:
            frame: OpenCV image frame (BGR format)

        Returns:
            list of dict: List of active tracked persons in current frame:
                [
                    {
                        "track_id": int or None,
                        "box": (x1, y1, x2, y2),
                        "confidence": float
                    },
                    ...
                ]
        """
        if self.model is None:
            print("[ERROR] YOLO model is not loaded. Cannot perform tracking.")
            return []

        if frame is None or frame.size == 0:
            return []

        try:
            with torch.inference_mode():
                track_kwargs = {
                    "persist": True,
                    "tracker": self.tracker_type,
                    "conf": self.confidence_threshold,
                    "classes": [0],  # 0 is COCO class index for 'person'
                    "imgsz": self.imgsz,
                    "device": self.device,
                    "verbose": False
                }
                if self.half and self.device != "cpu":
                    track_kwargs["half"] = True

                results = self.model.track(frame, **track_kwargs)

            tracked_persons = []
            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue

                for box in boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    confidence = float(box.conf[0].item())
                    track_id = int(box.id[0].item()) if (box.id is not None and len(box.id) > 0) else None

                    tracked_persons.append({
                        "track_id": track_id,
                        "box": (x1, y1, x2, y2),
                        "confidence": confidence
                    })

            return tracked_persons

        except Exception as e:
            print(f"[ERROR] Error during person tracking: {e}")
            return []

    def detect(self, frame):
        """
        Maintains backward compatibility with detection interface.
        """
        return self.track(frame)
