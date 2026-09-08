"""
Stream Frame Manager
Provides a thread-safe, bounded, latest-frame buffer and MJPEG generator
for live AI video streaming to web browsers without duplicate inference.
"""

import asyncio
import logging
import threading
import time
from typing import Any, Dict, List, Optional
import cv2
import numpy as np

from backend.config import settings

logger = logging.getLogger("ml_stream")

# Explicit mapping from Application/Frontend Camera IDs to ML Stream IDs
CAMERA_STREAM_ID_MAP: Dict[str, str] = {
    # Camera 1 (Crowd Detection / Canteen Quad)
    "CAM-000001": "66d550000000000000000002",
    "CAM-01": "66d550000000000000000002",
    # Camera 2 (Behavior Detection / Hostel Corridor)
    "CAM-000002": "66d550000000000000000003",
    "CAM-02": "66d550000000000000000003",
    # Camera 3 (Restricted Area / Server Room)
    "CAM-000003": "66d550000000000000000004",
    "CAM-03": "66d550000000000000000004",
    # Camera 4 (Abandoned Object / Main Lobby)
    "CAM-000004": "66d550000000000000000005",
    "CAM-04": "66d550000000000000000005",
}


import queue
import urllib.request

class FrameDispatcher:
    """Dedicated background worker thread for non-blocking HTTP dispatch to FastAPI stream buffer."""
    def __init__(self):
        self._queue = queue.Queue(maxsize=64)
        self._thread = threading.Thread(target=self._run, daemon=True, name="FrameDispatcher")
        self._thread.start()

    def dispatch(self, camera_id: str, jpeg_bytes: bytes):
        try:
            if self._queue.full():
                try:
                    self._queue.get_nowait()
                except Exception:
                    pass
            self._queue.put_nowait((camera_id, jpeg_bytes))
        except Exception:
            pass

    def _run(self):
        while True:
            try:
                item = self._queue.get(timeout=1.0)
                if item is None:
                    continue
                camera_id, jpeg_bytes = item
                req = urllib.request.Request(
                    f"http://127.0.0.1:8000/api/cameras/{camera_id}/frame",
                    data=jpeg_bytes,
                    headers={"Content-Type": "image/jpeg"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    resp.read()
            except Exception:
                pass
            finally:
                time.sleep(0.001)

_dispatcher = FrameDispatcher()


class StreamFrameManager:
    """
    Thread-safe buffer storing the latest processed OpenCV AI frames per camera
    and generating standard multipart/x-mixed-replace MJPEG video streams.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._condition = threading.Condition(self._lock)
        self._frames: Dict[str, Dict[str, Any]] = {}
        self._fps_tracker: Dict[str, Dict[str, Any]] = {}
        self._placeholder_cache: Optional[bytes] = None

    @staticmethod
    def resolve_camera_id(camera_id: str) -> str:
        """
        Resolves application/frontend camera ID (e.g. CAM-000001) to internal ML stream ID.
        If no explicit mapping exists, returns the original camera_id.
        """
        return CAMERA_STREAM_ID_MAP.get(camera_id, camera_id)

    def update_frame(
        self,
        camera_id: str,
        frame: np.ndarray,
        quality: Optional[int] = None,
        frame_index: int = 0,
    ) -> bool:
        """
        Updates the latest frame for a camera. Encodes to JPEG and drops previous stale frames.
        Thread-safe and non-blocking for the ML runner.
        """
        if frame is None or frame.size == 0:
            return False

        q = quality or settings.stream_jpeg_quality
        h, w = frame.shape[:2]

        # Normalize high-resolution video sources (e.g. 1080p / 1892p) for smooth web streaming
        if w > 1280 or h > 720:
            scale = min(1280 / w, 720 / h)
            nw, nh = int(w * scale), int(h * scale)
            frame = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_AREA)
            h, w = nh, nw

        try:
            encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), q]
            success, encoded_image = cv2.imencode(".jpg", frame, encode_params)
            if not success:
                return False
            jpeg_bytes = encoded_image.tobytes()
        except Exception as exc:
            logger.warning(f"Failed to encode frame for camera {camera_id}: {exc}")
            return False

        resolved_id = self.resolve_camera_id(camera_id)
        now = time.time()
        frame_data = {
            "jpeg_bytes": jpeg_bytes,
            "timestamp": now,
            "frame_index": frame_index,
            "width": w,
            "height": h,
        }

        with self._condition:
            # Track FPS
            tracker_key = resolved_id
            if tracker_key not in self._fps_tracker:
                self._fps_tracker[tracker_key] = {"count": 1, "start": now, "fps": 0.0}
            else:
                tracker = self._fps_tracker[tracker_key]
                tracker["count"] += 1
                elapsed = now - tracker["start"]
                if elapsed >= 2.0:
                    tracker["fps"] = round(tracker["count"] / elapsed, 1)
                    tracker["count"] = 0
                    tracker["start"] = now

            self._frames[resolved_id] = frame_data
            if camera_id != resolved_id:
                self._frames[camera_id] = frame_data
            self._condition.notify_all()

        # Non-blocking async queue dispatch to FastAPI stream router
        _dispatcher.dispatch(resolved_id, jpeg_bytes)
        if camera_id != resolved_id:
            _dispatcher.dispatch(camera_id, jpeg_bytes)

        return True

    def get_latest_frame_bytes(self, camera_id: str) -> Optional[bytes]:
        """Returns the most recent JPEG bytes for camera_id if available."""
        resolved_id = self.resolve_camera_id(camera_id)
        with self._lock:
            data = self._frames.get(resolved_id)
            if data:
                return data["jpeg_bytes"]
            return None

    def is_stream_active(self, camera_id: str, max_age_seconds: float = 3.0) -> bool:
        """Checks if a camera stream is actively producing frames within max_age_seconds."""
        resolved_id = self.resolve_camera_id(camera_id)
        with self._lock:
            data = self._frames.get(resolved_id)
            if not data:
                return False
            return (time.time() - data["timestamp"]) <= max_age_seconds

    def get_stream_status(self, camera_id: str) -> Dict[str, Any]:
        """Returns streaming status metadata for a camera."""
        resolved_id = self.resolve_camera_id(camera_id)
        with self._lock:
            data = self._frames.get(resolved_id)
            fps_info = self._fps_tracker.get(resolved_id, {})
            if not data:
                return {
                    "cameraId": camera_id,
                    "active": False,
                    "lastFrameAge": None,
                    "resolution": None,
                    "fps": 0.0,
                }
            age = round(time.time() - data["timestamp"], 2)
            active = age <= 3.0
            return {
                "cameraId": camera_id,
                "active": active,
                "lastFrameAge": age,
                "resolution": f"{data['width']}x{data['height']}",
                "fps": fps_info.get("fps", 0.0) if active else 0.0,
            }

    def get_all_streams(self) -> List[Dict[str, Any]]:
        """Returns status of all tracked cameras."""
        with self._lock:
            keys = list(self._frames.keys())
        return [self.get_stream_status(k) for k in keys]

    def create_placeholder_jpeg(
        self,
        text: str = "CAMERA STREAM OFFLINE",
        width: int = 640,
        height: int = 480,
    ) -> bytes:
        """Generates a clean fallback placeholder JPEG."""
        img = np.zeros((height, width, 3), dtype=np.uint8)
        img[:] = (25, 25, 30)  # Dark slate background

        # Draw border
        cv2.rectangle(img, (10, 10), (width - 10, height - 10), (60, 60, 80), 2)

        # Draw Title
        font = cv2.FONT_HERSHEY_SIMPLEX
        lines = text.split("\n")
        y_offset = height // 2 - (len(lines) * 20)
        for line in lines:
            (tw, th), _ = cv2.getTextSize(line, font, 0.6, 1)
            tx = max(20, (width - tw) // 2)
            cv2.putText(img, line, (tx, y_offset), font, 0.6, (180, 180, 200), 1, cv2.LINE_AA)
            y_offset += th + 16

        # Draw timestamp
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(img, ts, (20, height - 25), font, 0.45, (100, 100, 120), 1, cv2.LINE_AA)

        _, encoded = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        return encoded.tobytes()

    async def generate_mjpeg_stream(
        self,
        camera_id: str,
        target_fps: Optional[int] = None,
        quality: Optional[int] = None,
    ):
        """
        Async generator yielding multipart/x-mixed-replace MJPEG stream chunks.
        Compatible with all standard browser <img> tags and media viewers.
        """
        resolved_id = self.resolve_camera_id(camera_id)
        try:
            fps = int(target_fps) if target_fps is not None else settings.stream_fps
        except Exception:
            fps = settings.stream_fps
        frame_interval = 1.0 / max(1, min(60, fps))

        last_yielded_ts = 0.0

        try:
            while True:
                start_loop = time.time()
                frame_bytes = None

                with self._lock:
                    data = self._frames.get(resolved_id)
                    if data and (time.time() - data["timestamp"] <= 3.0):
                        frame_bytes = data["jpeg_bytes"]
                        last_yielded_ts = data["timestamp"]

                if frame_bytes is None:
                    # Provide placeholder if camera is offline / warming up
                    frame_bytes = self.create_placeholder_jpeg(
                        f"AI CAMPUS GUARDIAN\nCamera: {camera_id}\nStream Offline / Initializing..."
                    )

                # Format standard multipart/x-mixed-replace frame
                header = (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame_bytes)).encode("ascii") + b"\r\n\r\n"
                )
                yield header + frame_bytes + b"\r\n"

                # Dynamic sleep to maintain target stream FPS
                elapsed = time.time() - start_loop
                sleep_time = max(0.005, frame_interval - elapsed)
                await asyncio.sleep(sleep_time)

        except asyncio.CancelledError:
            # Client disconnected gracefully
            pass
        except Exception as exc:
            logger.warning(f"Error streaming camera {camera_id}: {exc}")


# Singleton stream manager instance
stream_manager = StreamFrameManager()
