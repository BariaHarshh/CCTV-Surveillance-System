"""
Async Detection Publisher
Background worker that publishes standardized, structured detection payloads
to the Next.js frontend bridge across all 4 cameras without blocking the OpenCV / ML video-processing loop.
"""

import asyncio
import logging
import queue
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from backend.config import settings
from backend.schemas.detection import DetectionPayload
from backend.services.frontend_bridge import frontend_bridge

logger = logging.getLogger("ml_publisher")


def normalize_bbox(box: Tuple[int, int, int, int], frame_width: int, frame_height: int) -> Dict[str, float]:
    """Normalizes pixel bounding box (x1, y1, x2, y2) to 0.0 - 1.0 (x, y, w, h)."""
    if not frame_width or not frame_height or frame_width <= 0 or frame_height <= 0:
        return {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0, "width": 0.0, "height": 0.0}

    x1, y1, x2, y2 = box
    x1_c = max(0, min(frame_width, x1))
    y1_c = max(0, min(frame_height, y1))
    x2_c = max(0, min(frame_width, x2))
    y2_c = max(0, min(frame_height, y2))

    w_px = max(0, x2_c - x1_c)
    h_px = max(0, y2_c - y1_c)

    norm_x = round(x1_c / frame_width, 4)
    norm_y = round(y1_c / frame_height, 4)
    norm_w = round(w_px / frame_width, 4)
    norm_h = round(h_px / frame_height, 4)

    return {
        "x": norm_x,
        "y": norm_y,
        "w": norm_w,
        "h": norm_h,
        "width": norm_w,
        "height": norm_h,
    }


def normalize_polygon_points(points: List[Any], frame_width: int, frame_height: int) -> List[List[float]]:
    """Normalizes pixel polygon vertices [[x1, y1], [x2, y2], ...] to 0.0 - 1.0."""
    if not frame_width or not frame_height or frame_width <= 0 or frame_height <= 0 or not points:
        return []

    norm_points = []
    for pt in points:
        if len(pt) >= 2:
            px, py = pt[0], pt[1]
            nx = round(max(0, min(frame_width, px)) / frame_width, 4)
            ny = round(max(0, min(frame_height, py)) / frame_height, 4)
            norm_points.append([nx, ny])
    return norm_points


def normalize_tracked_persons(
    tracked_persons: List[Dict[str, Any]],
    frame_width: int,
    frame_height: int,
    person_states: Optional[Dict[int, Dict[str, Any]]] = None,
    active_intruders: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    """Normalizes a list of tracked persons with 0.0 - 1.0 bounding boxes and enriched state metadata."""
    normalized = []
    for person in (tracked_persons or []):
        tid = person.get("track_id")
        box = person.get("box", (0, 0, 0, 0))
        conf = round(float(person.get("confidence", 1.0)), 3)
        bbox = normalize_bbox(box, frame_width, frame_height)

        p_dict: Dict[str, Any] = {
            "trackId": tid,
            "label": "Person",
            "confidence": conf,
            "bbox": bbox,
        }

        if person_states and tid in person_states:
            st = person_states[tid]
            p_dict["primaryState"] = st.get("primary_state", "NORMAL")
            p_dict["fallProgress"] = round(float(st.get("fall_progress", 0.0)), 2)
            p_dict["movementState"] = st.get("movement_state", "NORMAL")
            p_dict["state"] = st.get("primary_state", "NORMAL")

        if active_intruders is not None:
            p_dict["inZone"] = (tid in active_intruders)

        normalized.append(p_dict)
    return normalized


def normalize_tracked_objects(
    tracked_objects: List[Dict[str, Any]],
    frame_width: int,
    frame_height: int,
    object_states: Optional[Dict[int, Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Normalizes a list of tracked luggage/objects with 0.0 - 1.0 bounding boxes and state metadata."""
    normalized = []
    for obj in (tracked_objects or []):
        tid = obj.get("track_id")
        box = obj.get("box", (0, 0, 0, 0))
        conf = round(float(obj.get("confidence", 1.0)), 3)
        bbox = normalize_bbox(box, frame_width, frame_height)
        label = str(obj.get("class_name", "Object")).capitalize()

        st = (object_states or {}).get(tid, {}) if tid is not None else {}
        state_str = st.get("state", "MOVING")
        unattended_duration = round(float(st.get("unattended_duration", 0.0)), 1)
        prox_dist = (
            round(float(st["closest_person_dist"]), 1)
            if st.get("closest_person_dist") is not None
            else None
        )

        o_dict: Dict[str, Any] = {
            "trackId": tid,
            "label": label,
            "confidence": conf,
            "bbox": bbox,
            "status": state_str,
            "state": state_str,
            "timerSec": unattended_duration,
            "unattendedDuration": unattended_duration,
            "proximityDist": prox_dist,
            "closestPersonId": st.get("closest_person_id"),
            "isEscalated": bool(st.get("is_escalated", False)),
        }
        normalized.append(o_dict)
    return normalized


def get_risk_level(score: float) -> str:
    """Converts 0-100 risk score to canonical risk level string."""
    if score >= 75.0:
        return "CRITICAL"
    if score >= 50.0:
        return "HIGH"
    if score >= 25.0:
        return "MEDIUM"
    return "LOW"


class AsyncDetectionPublisher:
    """
    Non-blocking background worker publishing structured, normalized AI metadata
    for all 4 CCTV streams to Next.js. Maintains per-camera throttling and immediate dispatch.
    """

    def __init__(
        self,
        update_interval: Optional[float] = None,
        enabled: Optional[bool] = None,
        queue_size: int = 60,
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

        # Per-camera throttle timestamps and state caches
        self.last_enqueued_time: Dict[str, float] = {}
        self.last_published_time: Dict[str, float] = {}
        self.last_state: Dict[str, str] = {}

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
        try:
            self.queue.put_nowait(None)
        except Exception:
            pass
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=timeout)

    def _worker_loop(self):
        """Internal worker loop running in background thread."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        while self.running:
            try:
                item = self.queue.get(timeout=0.5)
                if item is None:
                    break

                payload, force_immediate = item
                cam_id = payload.cameraId
                now = time.time()

                # Check per-camera throttling unless force_immediate state transition
                last_pub = self.last_published_time.get(cam_id, 0.0)
                if not force_immediate and (now - last_pub < self.update_interval):
                    self.queue.task_done()
                    continue

                try:
                    loop.run_until_complete(frontend_bridge.send_detection(payload))
                    self.last_published_time[cam_id] = time.time()
                except Exception as exc:
                    logger.debug(f"[ML-PUBLISHER] Error forwarding detection: {exc}")

                self.queue.task_done()

            except queue.Empty:
                continue
            except Exception as exc:
                logger.debug(f"[ML-PUBLISHER] Worker loop error: {exc}")

        loop.close()

    def _enqueue(self, payload: DetectionPayload, force_immediate: bool) -> bool:
        """Helper to safely enqueue payload, dropping oldest item if buffer is full."""
        cam_id = payload.cameraId
        now = time.time()
        last_enq = self.last_enqueued_time.get(cam_id, 0.0)

        if not force_immediate and (now - last_enq < self.update_interval):
            return False

        try:
            if self.queue.full():
                try:
                    self.queue.get_nowait()
                except queue.Empty:
                    pass
            self.queue.put_nowait((payload, force_immediate))
            self.last_enqueued_time[cam_id] = now
            return True
        except queue.Full:
            return False

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
        frame_index: int = 0,
        current_time: Optional[float] = None,
        risk_score: float = 5.0,
    ) -> bool:
        """Publishes enriched, normalized Camera 1 Crowd/Occupancy metadata."""
        if not self.enabled:
            return False

        cam_id = camera_id or self.camera_id
        current_state = crowd_info.get("status", "NORMAL")
        last_st = self.last_state.get(cam_id)
        force_immediate = (last_st is not None and current_state != last_st)
        self.last_state[cam_id] = current_state

        confidences = [p.get("confidence", 1.0) for p in tracked_persons if "confidence" in p]
        avg_confidence = round(sum(confidences) / len(confidences), 3) if confidences else 0.95

        normalized_people = normalize_tracked_persons(tracked_persons, frame_width, frame_height)
        threshold = crowd_info.get("threshold", 10)
        now_ts = current_time if current_time is not None else time.time()
        risk_level = get_risk_level(risk_score)

        crowd_data = {
            "rawCount": raw_count,
            "stableCount": stable_count,
            "currentCount": stable_count,
            "threshold": threshold,
            "capacity": threshold,
            "crowdState": current_state,
            "crowdDetected": crowd_info.get("crowd_detected", False),
            "confirmationProgressSeconds": round(float(crowd_info.get("confirmation_progress_seconds", 0.0)), 2),
            "requiredPersistenceSeconds": round(float(crowd_info.get("required_persistence_seconds", 2.0)), 2),
            "people": normalized_people,
        }

        metadata = {
            "cameraId": cam_id,
            "timestamp": now_ts,
            "frameIndex": frame_index,
            "moduleType": "OCCUPANCY_DETECTION",
            "detections": normalized_people,
            "people": normalized_people,
            "crowd": crowd_data,
            "riskScore": int(risk_score),
            "riskLevel": risk_level,
            # Backward-compatible flat keys
            "rawCount": raw_count,
            "stableCount": stable_count,
            "currentCount": stable_count,
            "threshold": threshold,
            "capacity": threshold,
            "state": current_state,
            "crowdState": current_state,
            "crowdDetected": crowd_info.get("crowd_detected", False),
            "confirmationProgressSeconds": crowd_data["confirmationProgressSeconds"],
            "requiredPersistenceSeconds": crowd_data["requiredPersistenceSeconds"],
        }

        payload = DetectionPayload(
            organizationId=organization_id or self.organization_id,
            cameraId=cam_id,
            moduleType="OCCUPANCY_DETECTION",
            confidence=avg_confidence,
            source="DETECTION",
            metadata=metadata,
        )

        return self._enqueue(payload, force_immediate)

    def publish_behavior_detection(
        self,
        tracked_persons: List[Dict[str, Any]],
        behavior_out: Dict[str, Any],
        frame_width: int,
        frame_height: int,
        organization_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        frame_index: int = 0,
        current_time: Optional[float] = None,
        risk_score: float = 5.0,
    ) -> bool:
        """Publishes enriched, normalized Camera 2 Behavior (Fight / Fall / Motion) metadata."""
        if not self.enabled:
            return False

        cam_id = camera_id or self.camera_id
        active_events = behavior_out.get("active_events", [])
        has_fight = any(getattr(e, "event_type", "") == "potential_violent_activity" for e in active_events)
        has_fall = any(getattr(e, "event_type", "") == "person_fall" for e in active_events)

        raw_person_states = behavior_out.get("person_states", {}) or {}
        has_suspicious = any(s.get("primary_state") == "SUSPICIOUS" for s in raw_person_states.values())

        if has_fall:
            behavior_state = "FALL_DETECTED"
            event_type = "UNUSUAL_ACTIVITY"
        elif has_fight:
            behavior_state = "FIGHT_DETECTED"
            event_type = "UNUSUAL_ACTIVITY"
        elif has_suspicious:
            behavior_state = "SUSPICIOUS"
            event_type = "UNUSUAL_ACTIVITY"
        else:
            behavior_state = "NORMAL"
            event_type = "PERSON_DETECTED"

        last_st = self.last_state.get(cam_id)
        force_immediate = (last_st is not None and behavior_state != last_st) or has_fall or has_fight
        self.last_state[cam_id] = behavior_state

        confidences = [p.get("confidence", 1.0) for p in tracked_persons if "confidence" in p]
        avg_confidence = round(sum(confidences) / len(confidences), 3) if confidences else (0.88 if len(tracked_persons) > 0 else 0.5)

        normalized_people = normalize_tracked_persons(
            tracked_persons,
            frame_width,
            frame_height,
            person_states=raw_person_states
        )

        person_states_list = [
            {
                "trackId": tid,
                "primaryState": st.get("primary_state", "NORMAL"),
                "fallProgress": round(float(st.get("fall_progress", 0.0)), 2),
                "fallState": st.get("fall_state", "NORMAL"),
                "movementState": st.get("movement_state", "NORMAL"),
                "confidence": round(float(st.get("confidence", 0.0)), 3),
            }
            for tid, st in raw_person_states.items()
        ]

        # Convert pair_states with tuple keys to JSON-serializable string keys
        pair_states_json = {}
        for pair_key, p_val in (behavior_out.get("pair_states", {}) or {}).items():
            str_key = f"{pair_key[0]}-{pair_key[1]}" if isinstance(pair_key, (tuple, list)) and len(pair_key) >= 2 else str(pair_key)
            pair_states_json[str_key] = {
                "state": p_val.get("state", "NORMAL") if isinstance(p_val, dict) else str(p_val),
                "confidence": round(float(p_val.get("confidence", 0.0)), 3) if isinstance(p_val, dict) else 0.0,
            }

        now_ts = current_time if current_time is not None else time.time()
        risk_level = get_risk_level(risk_score)

        behavior_data = {
            "personCount": len(tracked_persons),
            "behaviorState": behavior_state,
            "eventType": event_type,
            "hasFall": has_fall,
            "hasFight": has_fight,
            "personStates": person_states_list,
            "pairStates": pair_states_json,
            "activeAlertsCount": behavior_out.get("summary", {}).get("active_alerts_count", 0),
            "people": normalized_people,
        }

        metadata = {
            "cameraId": cam_id,
            "timestamp": now_ts,
            "frameIndex": frame_index,
            "moduleType": "PERSON_DETECTION",
            "detections": normalized_people,
            "people": normalized_people,
            "behavior": behavior_data,
            "riskScore": int(risk_score),
            "riskLevel": risk_level,
            # Backward-compatible flat keys
            "eventType": event_type,
            "personCount": len(tracked_persons),
            "behaviorState": behavior_state,
            "primaryState": behavior_state,
            "personStates": person_states_list,
        }

        payload = DetectionPayload(
            organizationId=organization_id or self.organization_id,
            cameraId=cam_id,
            moduleType="PERSON_DETECTION",
            confidence=avg_confidence,
            source="DETECTION",
            metadata=metadata,
        )

        return self._enqueue(payload, force_immediate)

    def publish_restricted_area_detection(
        self,
        tracked_persons: List[Dict[str, Any]],
        restricted_out: Dict[str, Any],
        zone_manager: Any,
        frame_width: int,
        frame_height: int,
        organization_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        frame_index: int = 0,
        current_time: Optional[float] = None,
        risk_score: float = 5.0,
    ) -> bool:
        """Publishes enriched, normalized Camera 3 Restricted Zone Intrusion metadata."""
        if not self.enabled:
            return False

        cam_id = camera_id or self.camera_id
        summary = restricted_out.get("summary", {})
        has_breach = summary.get("has_breach", False)
        status_str = summary.get("status", "SECURE")
        zone_status = "ALERT" if has_breach else ("CHECKING" if status_str == "CHECKING" else "SECURE")
        active_intruders = restricted_out.get("active_intruders", [])

        last_st = self.last_state.get(cam_id)
        force_immediate = (last_st is not None and zone_status != last_st) or has_breach
        self.last_state[cam_id] = zone_status

        confidences = [p.get("confidence", 1.0) for p in tracked_persons if "confidence" in p]
        avg_confidence = round(sum(confidences) / len(confidences), 3) if confidences else 0.92

        normalized_people = normalize_tracked_persons(
            tracked_persons,
            frame_width,
            frame_height,
            active_intruders=active_intruders
        )

        # Normalize restricted zone polygon coordinates
        zone_statuses = restricted_out.get("zone_statuses", {})
        raw_zones = getattr(zone_manager, "zones", []) if zone_manager else []
        normalized_zones = []

        for z in raw_zones:
            z_st = zone_statuses.get(z.name, {})
            norm_pts = normalize_polygon_points(getattr(z, "points", []), frame_width, frame_height)
            normalized_zones.append({
                "name": z.name,
                "severity": getattr(z, "severity", "critical"),
                "status": z_st.get("status", "SECURE"),
                "points": norm_pts,
                "intrudersCount": z_st.get("intruders_count", 0),
                "intruderIds": z_st.get("intruder_ids", []),
                "checkingIds": z_st.get("checking_ids", []),
            })

        now_ts = current_time if current_time is not None else time.time()
        risk_level = get_risk_level(risk_score)

        ra_data = {
            "zoneStatus": zone_status,
            "hasBreach": has_breach,
            "totalZones": len(raw_zones),
            "activeIntrudersCount": len(active_intruders),
            "activeIntruders": active_intruders,
            "zones": normalized_zones,
            "people": normalized_people,
        }

        event_type = "UNAUTHORIZED_ENTRY" if has_breach else "PERSON_DETECTED"
        metadata = {
            "cameraId": cam_id,
            "timestamp": now_ts,
            "frameIndex": frame_index,
            "moduleType": "RESTRICTED_ZONE",
            "detections": normalized_people,
            "people": normalized_people,
            "restrictedArea": ra_data,
            "riskScore": int(risk_score),
            "riskLevel": risk_level,
            # Backward-compatible flat keys
            "eventType": event_type,
            "zoneStatus": zone_status,
            "hasBreach": has_breach,
            "intruderCount": len(active_intruders),
            "activeIntruders": active_intruders,
            "zones": normalized_zones,
        }

        payload = DetectionPayload(
            organizationId=organization_id or self.organization_id,
            cameraId=cam_id,
            moduleType="RESTRICTED_ZONE",
            confidence=avg_confidence,
            source="DETECTION",
            metadata=metadata,
        )

        return self._enqueue(payload, force_immediate)

    def publish_abandoned_object_detection(
        self,
        tracked_objects: List[Dict[str, Any]],
        tracked_persons: List[Dict[str, Any]],
        abandoned_out: Dict[str, Any],
        frame_width: int,
        frame_height: int,
        organization_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        frame_index: int = 0,
        current_time: Optional[float] = None,
        risk_score: float = 5.0,
    ) -> bool:
        """Publishes enriched, normalized Camera 4 Abandoned Luggage/Object metadata."""
        if not self.enabled:
            return False

        cam_id = camera_id or self.camera_id
        summary = abandoned_out.get("summary", {})
        unattended_cnt = summary.get("unattended_count", 0)
        abandoned_cnt = summary.get("abandoned_count", 0)

        raw_obj_states = abandoned_out.get("object_states", {})
        has_abandoned = abandoned_cnt > 0 or any(st.get("state") in ("ABANDONED", "PROLONGED_ABANDONED_ESCALATED") for st in raw_obj_states.values())
        has_unattended = unattended_cnt > 0 or any(st.get("state") == "UNATTENDED" for st in raw_obj_states.values())

        if has_abandoned:
            object_status = "ABANDONED"
        elif has_unattended:
            object_status = "UNATTENDED"
        else:
            object_status = "NORMAL"

        last_st = self.last_state.get(cam_id)
        force_immediate = (last_st is not None and object_status != last_st) or has_abandoned or has_unattended
        self.last_state[cam_id] = object_status

        confidences = [o.get("confidence", 1.0) for o in tracked_objects if "confidence" in o]
        avg_confidence = round(sum(confidences) / len(confidences), 3) if confidences else 0.85

        normalized_objects = normalize_tracked_objects(tracked_objects, frame_width, frame_height, raw_obj_states)
        normalized_people = normalize_tracked_persons(tracked_persons, frame_width, frame_height)
        all_detections = normalized_objects + normalized_people

        # Find maximum unattended timer across tracked objects
        max_timer = max([o.get("timerSec", 0.0) for o in normalized_objects], default=0.0)

        now_ts = current_time if current_time is not None else time.time()
        risk_level = get_risk_level(risk_score)

        ab_data = {
            "objectStatus": object_status,
            "totalObjects": len(tracked_objects),
            "unattendedCount": unattended_cnt,
            "abandonedCount": abandoned_cnt,
            "unattendedDuration": max_timer,
            "objects": normalized_objects,
            "people": normalized_people,
        }

        event_type = "ABANDONED_OBJECT" if (has_abandoned or has_unattended) else "PERSON_DETECTED"
        metadata = {
            "cameraId": cam_id,
            "timestamp": now_ts,
            "frameIndex": frame_index,
            "moduleType": "ABANDONED_OBJECT",
            "detections": all_detections,
            "objects": normalized_objects,
            "people": normalized_people,
            "abandonedObject": ab_data,
            "riskScore": int(risk_score),
            "riskLevel": risk_level,
            # Backward-compatible flat keys
            "eventType": event_type,
            "objectStatus": object_status,
            "unattendedCount": unattended_cnt,
            "abandonedCount": abandoned_cnt,
            "unattendedDuration": max_timer,
        }

        payload = DetectionPayload(
            organizationId=organization_id or self.organization_id,
            cameraId=cam_id,
            moduleType="ABANDONED_OBJECT",
            confidence=avg_confidence,
            source="DETECTION",
            metadata=metadata,
        )

        return self._enqueue(payload, force_immediate)

    def publish_detection(
        self,
        module_type: str,
        confidence: float,
        metadata: Dict[str, Any],
        camera_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        force_immediate: bool = False,
    ) -> bool:
        """Publishes generic detection payload (backward compatibility)."""
        if not self.enabled:
            return False

        cam_id = camera_id or self.camera_id
        payload = DetectionPayload(
            organizationId=organization_id or self.organization_id,
            cameraId=cam_id,
            moduleType=module_type,
            confidence=round(confidence, 3),
            source="DETECTION",
            metadata=metadata,
        )

        return self._enqueue(payload, force_immediate)


# Singleton default publisher instance
detection_publisher = AsyncDetectionPublisher()
