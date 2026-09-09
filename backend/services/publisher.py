"""
Async Detection Publisher
Background worker that publishes detection payloads to the Next.js frontend bridge
without blocking the OpenCV / ML video-processing loop.
"""

import asyncio
import logging
import queue
import threading
import time
from typing import Any, Dict, List, Optional

from backend.config import settings
from backend.schemas.detection import DetectionPayload
from backend.services.frontend_bridge import frontend_bridge
from features.crowd_detection.utils import normalize_tracked_persons

logger = logging.getLogger("ml_publisher")


class AsyncDetectionPublisher:
    """
    Non-blocking, background thread publisher for ML detections.
    Throttles periodic updates (default 500ms) while guaranteeing immediate dispatch
    upon detection state transitions (e.g., NORMAL -> CHECKING CROWD -> CROWD DETECTED).
    """

    def __init__(
        self,
        update_interval: Optional[float] = None,
        enabled: Optional[bool] = None,
        queue_size: int = 30,
        organization_id: Optional[str] = None,
        camera_id: Optional[str] = None,
    ):
        self.update_interval = (
            update_interval
            if update_interval is not None
            else settings.update_interval
        )
        self.enabled = enabled if enabled is not None else settings.enable_publish
        self.organization_id = organization_id or settings.organization_id
        self.camera_id = camera_id or settings.camera_id

        self.queue: queue.Queue = queue.Queue(maxsize=queue_size)
        self.running = False
        self.worker_thread: Optional[threading.Thread] = None

        self.last_enqueued_time: float = 0.0
        self.last_published_time: float = 0.0
        self.last_state: Optional[str] = None

        if self.enabled:
            self.start()

    def start(self):
        """Starts the background worker thread."""
        if self.running:
            return
        self.running = True
        self.worker_thread = threading.Thread(
            target=self._worker_loop,
            daemon=True,
            name="ML-Detection-Publisher",
        )
        self.worker_thread.start()

    def stop(self, timeout: float = 2.0):
        """Stops the worker thread cleanly."""
        if not self.running:
            return
        self.running = False
        # Push sentinel None to wake up queue.get
        try:
            self.queue.put_nowait(None)
        except Exception:
            pass
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=timeout)

    def _worker_loop(self):
        """Internal loop running in background thread."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        while self.running:
            try:
                item = self.queue.get(timeout=0.5)
                if item is None:
                    break

                payload, force_immediate = item
                now = time.time()

                # Check throttling unless state change demands immediate publish
                if not force_immediate and (now - self.last_published_time < self.update_interval):
                    self.queue.task_done()
                    continue

                # Dispatch via bridge asynchronously
                try:
                    loop.run_until_complete(frontend_bridge.send_detection(payload))
                    self.last_published_time = time.time()
                except Exception as exc:
                    print(f"[ML-PUBLISHER] Error forwarding detection: {exc}")

                self.queue.task_done()

            except queue.Empty:
                continue
            except Exception as exc:
                print(f"[ML-PUBLISHER] Worker loop error: {exc}")

        loop.close()

    def publish_crowd_detection(
        self,
        raw_count: int,
        stable_count: int,
        crowd_info: Dict[str, Any],
        tracked_persons: List[Dict[str, Any]],
        frame_width: int,
        frame_height: int,
        organization_id: Optional[str] = None,
        camera_id: Optional[str] = None,
    ) -> bool:
        """
        Publishes a normalized crowd detection payload.
        Returns True if item was queued, False if skipped.
        """
        if not self.enabled:
            return False

        current_state = crowd_info.get("status", "NORMAL")
        force_immediate = (self.last_state is not None and current_state != self.last_state)
        self.last_state = current_state

        now = time.time()
        # Fast check: skip queueing if within interval and not a state change
        if not force_immediate and (now - self.last_enqueued_time < self.update_interval):
            return False

        # Calculate average confidence of tracked persons
        confidences = [p.get("confidence", 1.0) for p in tracked_persons if "confidence" in p]
        avg_confidence = round(sum(confidences) / len(confidences), 3) if confidences else 0.95

        # Normalize bounding boxes
        normalized_people = normalize_tracked_persons(
            tracked_persons,
            frame_width,
            frame_height,
        )

        threshold = crowd_info.get("threshold", 10)

        metadata = {
            "rawCount": raw_count,
            "stableCount": stable_count,
            "currentCount": stable_count,
            "threshold": threshold,
            "capacity": threshold,
            "state": current_state,
            "crowdDetected": crowd_info.get("crowd_detected", False),
            "confirmationProgressSeconds": crowd_info.get("confirmation_progress_seconds", 0.0),
            "requiredPersistenceSeconds": crowd_info.get("required_persistence_seconds", 3.0),
            "people": normalized_people,
        }

        payload = DetectionPayload(
            organizationId=organization_id or self.organization_id,
            cameraId=camera_id or self.camera_id,
            moduleType="OCCUPANCY_DETECTION",
            confidence=avg_confidence,
            source="DETECTION",
            metadata=metadata,
        )

        try:
            # If queue full, drop oldest item to keep newest
            if self.queue.full():
                try:
                    self.queue.get_nowait()
                except queue.Empty:
                    pass
            self.queue.put_nowait((payload, force_immediate))
            self.last_enqueued_time = now
            return True
        except queue.Full:
            return False

    def publish_detection(
        self,
        module_type: str,
        confidence: float,
        metadata: Dict[str, Any],
        camera_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        force_immediate: bool = False,
    ) -> bool:
        """Publishes any generic detection payload to Next.js internal detection API."""
        if not self.enabled:
            return False

        now = time.time()
        if not force_immediate and (now - self.last_enqueued_time < self.update_interval):
            return False

        payload = DetectionPayload(
            organizationId=organization_id or self.organization_id,
            cameraId=camera_id or self.camera_id,
            moduleType=module_type,
            confidence=round(confidence, 3),
            source="DETECTION",
            metadata=metadata,
        )

        try:
            if self.queue.full():
                try:
                    self.queue.get_nowait()
                except queue.Empty:
                    pass
            self.queue.put_nowait((payload, force_immediate))
            self.last_enqueued_time = now
            return True
        except queue.Full:
            return False


# Singleton default publisher instance
detection_publisher = AsyncDetectionPublisher()

