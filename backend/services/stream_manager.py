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
    Dedicated background workers for non-blocking parallel HTTP dispatch to FastAPI stream buffer.
    Maintains a bounded latest-frame buffer per camera and reuses persistent TCP connections.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._camera_frames: Dict[str, bytes] = {}
        self._camera_events: Dict[str, threading.Event] = {}
        self._threads: Dict[str, threading.Thread] = {}

    def _ensure_worker(self, camera_id: str):
        if camera_id not in self._threads:
            evt = threading.Event()
            self._camera_events[camera_id] = evt
            t = threading.Thread(
                target=self._camera_worker,
                args=(camera_id, evt),
                daemon=True,
                name=f"FrameDispatcher-{camera_id}"
            )
            self._threads[camera_id] = t
            t.start()

    def dispatch(self, camera_id: str, jpeg_bytes: bytes):
        """Stores latest frame for camera and wakes its dedicated worker."""
        with self._lock:
            self._ensure_worker(camera_id)
            self._camera_frames[camera_id] = jpeg_bytes
            evt = self._camera_events.get(camera_id)
        if evt:
            evt.set()

    def _camera_worker(self, camera_id: str, evt: threading.Event):
        conn: Optional[http.client.HTTPConnection] = None
        last_sent = 0.0
        while True:
            try:
                evt.wait(timeout=0.03)
                evt.clear()

                with self._lock:
                    jpeg_bytes = self._camera_frames.pop(camera_id, None)

                if jpeg_bytes is None:
                    continue

                now = time.time()
                if (now - last_sent) < 0.015:
                    continue

                if conn is None:
                    try:
                        conn = http.client.HTTPConnection("127.0.0.1", 8000, timeout=0.5)
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
                    last_sent = now
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
        self._subscribers: Dict[str, List[asyncio.Queue]] = {}

    @staticmethod
    def resolve_camera_id(camera_id: str) -> str:
        """
        Resolves application/frontend camera ID (e.g. CAM-000001) to internal ML stream ID.
        If no explicit mapping exists, returns the original camera_id.
        """
        return CAMERA_STREAM_ID_MAP.get(camera_id, camera_id)

    def subscribe(self, camera_id: str) -> asyncio.Queue:
        """Subscribes an async queue (size=1) to live frames for a camera."""
        resolved_id = self.resolve_camera_id(camera_id)
        q: asyncio.Queue = asyncio.Queue(maxsize=1)
        with self._lock:
            if resolved_id not in self._subscribers:
                self._subscribers[resolved_id] = []
            self._subscribers[resolved_id].append(q)
        return q

    def unsubscribe(self, camera_id: str, q: asyncio.Queue) -> None:
        """Removes a subscriber queue from a camera."""
        resolved_id = self.resolve_camera_id(camera_id)
        with self._lock:
            if resolved_id in self._subscribers:
                try:
                    self._subscribers[resolved_id].remove(q)
                    if not self._subscribers[resolved_id]:
                        del self._subscribers[resolved_id]
                except (ValueError, KeyError):
                    pass

    def push_frame(
        self,
        camera_id: str,
        jpeg_bytes: bytes,
        width: int = 640,
        height: int = 480,
        frame_index: int = 0,
    ) -> bool:
        """
        Stores latest frame bytes and notifies all connected browser subscriber queues.
        Guarantees latest-frame-only delivery and zero polling judder.
        """
        resolved_id = self.resolve_camera_id(camera_id)
        now = time.time()
        frame_data = {
            "jpeg_bytes": jpeg_bytes,
            "timestamp": now,
            "frame_index": frame_index,
            "width": width,
            "height": height,
        }

        with self._lock:
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

            subs = list(self._subscribers.get(resolved_id, []))

        # Push to all active subscriber queues (drop stale unread frame to keep size <= 1)
        for q in subs:
            if q.full():
                try:
                    q.get_nowait()
                except Exception:
                    pass
            try:
                q.put_nowait(jpeg_bytes)
            except Exception:
                pass

        return True

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
        self.push_frame(resolved_id, jpeg_bytes, width=w, height=h, frame_index=frame_index)

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
        Async generator yielding real-time multipart/x-mixed-replace MJPEG stream chunks.
        Dispatches new frames event-driven with zero duplicate polling and zero timer judder.
        """
        resolved_id = self.resolve_camera_id(camera_id)
        q = self.subscribe(resolved_id)

        # Emit initial frame immediately if available to eliminate connect delay
        initial_frame = self.get_latest_frame_bytes(resolved_id)
        if initial_frame:
            header = (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(initial_frame)).encode("ascii") + b"\r\n\r\n"
            )
            yield header + initial_frame + b"\r\n"

        try:
            while True:
                try:
                    jpeg_bytes = await asyncio.wait_for(q.get(), timeout=2.0)
                except asyncio.TimeoutError:
                    jpeg_bytes = self.create_placeholder_jpeg(
                        f"AI CAMPUS GUARDIAN\nCamera: {camera_id}\nStream Initializing..."
                    )

                header = (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    b"Content-Length: " + str(len(jpeg_bytes)).encode("ascii") + b"\r\n\r\n"
                )
                yield header + jpeg_bytes + b"\r\n"

        except (asyncio.CancelledError, GeneratorExit):
            # Client disconnected gracefully
            pass
        except Exception as exc:
            logger.debug(f"Stream client ended for camera {camera_id}: {exc}")
        finally:
            self.unsubscribe(resolved_id, q)


# Singleton stream manager instance
stream_manager = StreamFrameManager()
