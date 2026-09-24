"""
Stream Frame Manager
Provides a thread-safe, bounded, latest-frame buffer and MJPEG generator
for live AI video streaming to web browsers without duplicate inference.
"""

import asyncio
import http.client
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


class FrameDispatcher:
    """
    Dedicated background worker thread for non-blocking HTTP dispatch to FastAPI stream buffer.
    Maintains a bounded latest-frame buffer and reuses persistent TCP connection to avoid TIME_WAIT sockets.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._latest_frames: Dict[str, bytes] = {}
        self._wake_event = threading.Event()
        self._last_sent: Dict[str, float] = {}
        self._thread = threading.Thread(target=self._run, daemon=True, name="FrameDispatcher")
        self._thread.start()

    def dispatch(self, camera_id: str, jpeg_bytes: bytes):
        """Stores the latest frame for a camera, immediately replacing any pending older frame."""
        with self._lock:
            self._latest_frames[camera_id] = jpeg_bytes
        self._wake_event.set()

    def _run(self):
        conn: Optional[http.client.HTTPConnection] = None
        while True:
            try:
                self._wake_event.wait(timeout=0.08)
                self._wake_event.clear()

                with self._lock:
                    if not self._latest_frames:
                        continue
                    snapshot = self._latest_frames.copy()
                    self._latest_frames.clear()

                now = time.time()
                for camera_id, jpeg_bytes in snapshot.items():
                    # Rate limit dispatch per camera to ~12 FPS
                    last_time = self._last_sent.get(camera_id, 0.0)
                    if (now - last_time) < 0.07:
                        continue

                    if conn is None:
                        try:
                            conn = http.client.HTTPConnection("127.0.0.1", 8000, timeout=1.0)
                        except Exception:
                            conn = None
                            continue

                    try:
                        conn.request(
                            "POST",
                            f"/api/cameras/{camera_id}/frame",
                            body=jpeg_bytes,
                            headers={"Content-Type": "image/jpeg"}
                        )
                        resp = conn.getresponse()
                        resp.read()
                        self._last_sent[camera_id] = now
                    except Exception:
                        try:
                            if conn:
                                conn.close()
                        except Exception:
                            pass
                        conn = None

            except Exception:
                pass


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

        # Normalize high-resolution video sources for lightweight web streaming (640x360)
        if w > 640 or h > 360:
            scale = min(640 / w, 360 / h)
            nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
            frame = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
            h, w = nh, nw

        try:
            encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), max(30, min(95, q))]
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
            self._condition.notify_all()

        # Non-blocking latest-frame dispatch to FastAPI stream router (single dispatch per canonical stream ID)
        _dispatcher.dispatch(resolved_id, jpeg_bytes)

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
        height: int = 360,
    ) -> bytes:
        """Generates a clean fallback placeholder JPEG."""
        img = np.zeros((height, width, 3), dtype=np.uint8)
        img[:] = (25, 25, 30)  # Dark slate background

        # Draw border
        cv2.rectangle(img, (8, 8), (width - 8, height - 8), (60, 60, 80), 2)

        # Draw Title
        font = cv2.FONT_HERSHEY_SIMPLEX
        lines = text.split("\n")
        y_offset = max(40, height // 2 - (len(lines) * 18))
        for line in lines:
            (tw, th), _ = cv2.getTextSize(line, font, 0.55, 1)
            tx = max(16, (width - tw) // 2)
            cv2.putText(img, line, (tx, y_offset), font, 0.55, (180, 180, 200), 1, cv2.LINE_AA)
            y_offset += th + 14

        # Draw timestamp
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        cv2.putText(img, ts, (16, height - 16), font, 0.4, (100, 100, 120), 1, cv2.LINE_AA)

        _, encoded = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 65])
        return encoded.tobytes()

    async def generate_mjpeg_stream(
        self,
        camera_id: str,
        target_fps: Optional[int] = None,
        quality: Optional[int] = None,
    ):
        """
        Async generator yielding continuous multipart/x-mixed-replace MJPEG stream chunks.
        Pipes steady latest-frame chunks at target FPS (default 10 FPS) for smooth browser rendering.
        """
        resolved_id = self.resolve_camera_id(camera_id)
        try:
            fps = int(target_fps) if target_fps is not None else settings.stream_fps
        except Exception:
            fps = settings.stream_fps
        fps = max(1, min(30, fps))
        frame_interval = 1.0 / fps

        try:
            while True:
                start_loop = time.time()
                frame_bytes = None

                with self._lock:
                    data = self._frames.get(resolved_id)
                    if data and (start_loop - data["timestamp"] <= 3.0):
                        frame_bytes = data["jpeg_bytes"]

                if frame_bytes is None:
                    # Provide placeholder if camera is offline / warming up
                    frame_bytes = self.create_placeholder_jpeg(
                        f"AI CAMPUS GUARDIAN\nCamera: {camera_id}\nStream Initializing..."
                    )

                # Format standard multipart/x-mixed-replace frame
                header = (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(frame_bytes)).encode("ascii") + b"\r\n\r\n"
                )
                yield header + frame_bytes + b"\r\n"

                # Dynamic sleep to maintain steady target stream FPS
                elapsed = time.time() - start_loop
                sleep_time = max(0.01, frame_interval - elapsed)
                await asyncio.sleep(sleep_time)

        except (asyncio.CancelledError, GeneratorExit):
            # Client disconnected gracefully
            pass
        except Exception as exc:
            logger.debug(f"Stream client ended for camera {camera_id}: {exc}")


# Singleton stream manager instance
stream_manager = StreamFrameManager()
