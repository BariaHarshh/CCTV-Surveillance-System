"""
AI Campus Guard - Event Normalization & Adapter Module
Non-invasively converts raw events from Crowd, Behaviour, Abandoned Object, and Restricted Area modules
into standardized RiskEvent objects with guaranteed numeric float timestamps.
"""

from typing import Any, Dict, List, Optional, Union
import time
import datetime
from .event_model import RiskEvent

def safe_extract_timestamp(ts: Any, fallback: Optional[float] = None) -> float:
    """
    Safely converts arbitrary timestamp representations to a numeric float in seconds.
    Supports float, int, datetime, ISO strings, and video timeline 'T+XX.XXs' formats.
    """
    if ts is None:
        return fallback if fallback is not None else time.time()

    if isinstance(ts, (int, float)):
        return float(ts)

    if isinstance(ts, datetime.datetime):
        return ts.timestamp()

    if isinstance(ts, str):
        clean_ts = ts.strip()
        # Handle "T+14.20s" format
        if clean_ts.startswith("T+") and clean_ts.endswith("s"):
            try:
                return float(clean_ts[2:-1])
            except ValueError:
                pass
        # Handle numeric string "14.20"
        try:
            return float(clean_ts)
        except ValueError:
            pass
        # Handle ISO format
        try:
            dt = datetime.datetime.fromisoformat(clean_ts)
            return dt.timestamp()
        except ValueError:
            pass

    return fallback if fallback is not None else time.time()

class EventNormalizer:
    """
    Translates heterogeneous event models from all four campus surveillance features into normalized RiskEvent objects.
    """

    @classmethod
    def from_crowd(cls, crowd_info: Union[Dict[str, Any], Any], current_time: Optional[float] = None) -> Optional[RiskEvent]:
        """Normalizes a Crowd Detection output dictionary into a RiskEvent if crowd is confirmed."""
        if crowd_info is None:
            return None

        if isinstance(crowd_info, dict):
            is_detected = crowd_info.get("crowd_detected", False) or crowd_info.get("status") == "CROWD DETECTED"
            if not is_detected:
                return None

            person_count = crowd_info.get("person_count", 0)
            threshold = crowd_info.get("threshold", 10)
            progress = crowd_info.get("confirmation_progress_seconds", 3.0)
            now = safe_extract_timestamp(current_time)

            # Confidence based on ratio over threshold
            conf = min(1.0, max(0.60, float(person_count) / max(1.0, float(threshold))))
            severity = "high" if person_count >= (threshold * 1.5) else "medium"

            return RiskEvent(
                event_id=f"RISK-CROWD-{int(now * 100) % 100000}",
                source="crowd_detection",
                event_type="crowd_detected",
                confidence=round(conf, 2),
                timestamp=now,
                severity=severity,
                person_ids=[],
                object_ids=[],
                duration_seconds=float(progress),
                metadata={
                    "person_count": person_count,
                    "threshold": threshold,
                    "status": crowd_info.get("status", "CROWD DETECTED")
                },
                raw_event=crowd_info
            )
        return None

    @classmethod
    def from_behavior(cls, ev: Any, current_time: Optional[float] = None) -> RiskEvent:
        """Normalizes a BehaviourEvent instance or dictionary into a RiskEvent."""
        now = safe_extract_timestamp(current_time)
        ev_type = getattr(ev, "event_type", None) or (ev.get("event_type") if isinstance(ev, dict) else "behavior_anomaly")
        person_ids = getattr(ev, "person_ids", None) or (ev.get("person_ids") if isinstance(ev, dict) else [])
        conf = getattr(ev, "confidence", None) or (ev.get("confidence") if isinstance(ev, dict) else 0.8)
        sev = getattr(ev, "severity", None) or (ev.get("severity") if isinstance(ev, dict) else "high")
        ts = getattr(ev, "timestamp", None) or (ev.get("timestamp") if isinstance(ev, dict) else now)
        dur = getattr(ev, "duration_seconds", None) or (ev.get("duration_seconds") if isinstance(ev, dict) else 0.0)
        loc = getattr(ev, "location", None) or (ev.get("location") if isinstance(ev, dict) else None)
        meta = getattr(ev, "metadata", None) or (ev.get("metadata") if isinstance(ev, dict) else {})
        display_ts = getattr(ev, "display_timestamp", None) or (ev.get("display_timestamp") if isinstance(ev, dict) else None)

        numeric_ts = safe_extract_timestamp(ts, fallback=now)
        eid = f"RISK-BEH-{ev_type.upper()}-{int(numeric_ts * 100) % 100000}"

        return RiskEvent(
            event_id=eid,
            source="behavior_detection",
            event_type=ev_type,
            confidence=float(conf),
            timestamp=numeric_ts,
            severity=sev,
            person_ids=list(person_ids) if person_ids else [],
            object_ids=[],
            location=loc,
            duration_seconds=float(dur),
            metadata=dict(meta) if meta else {},
            raw_event=ev,
            display_timestamp=display_ts
        )

    @classmethod
    def from_abandoned_object(cls, ev: Any, current_time: Optional[float] = None) -> RiskEvent:
        """Normalizes a PotentialAbandonedObjectEvent instance or dictionary into a RiskEvent."""
        now = safe_extract_timestamp(current_time)
        ev_type = getattr(ev, "event_type", None) or (ev.get("event_type") if isinstance(ev, dict) else "potential_abandoned_object")
        obj_id = getattr(ev, "object_id", None) or (ev.get("object_id") if isinstance(ev, dict) else 1)
        obj_cls = getattr(ev, "object_class", None) or (ev.get("object_class") if isinstance(ev, dict) else "backpack")
        conf = getattr(ev, "confidence", None) or (ev.get("confidence") if isinstance(ev, dict) else 0.85)
        sev = getattr(ev, "severity", None) or (ev.get("severity") if isinstance(ev, dict) else "high")
        ts = getattr(ev, "timestamp", None) or (ev.get("timestamp") if isinstance(ev, dict) else now)
        unattended_dur = getattr(ev, "unattended_duration", None) or (ev.get("unattended_duration") if isinstance(ev, dict) else 0.0)
        pids = getattr(ev, "nearby_person_ids", None) or (ev.get("nearby_person_ids") if isinstance(ev, dict) else [])
        loc = getattr(ev, "location", None) or (ev.get("location") if isinstance(ev, dict) else None)
        is_esc = getattr(ev, "is_escalated", False) or (ev.get("is_escalated", False) if isinstance(ev, dict) else False)
        staff = getattr(ev, "assigned_staff_name", None) or (ev.get("assigned_staff_name") if isinstance(ev, dict) else None)
        meta = getattr(ev, "metadata", None) or (ev.get("metadata") if isinstance(ev, dict) else {})
        display_ts = getattr(ev, "display_timestamp", None) or (ev.get("display_timestamp") if isinstance(ev, dict) else None)

        numeric_ts = safe_extract_timestamp(ts, fallback=now)
        eid = f"RISK-OBJ-{obj_cls.upper()}-{obj_id}-{int(numeric_ts * 100) % 100000}"

        merged_meta = dict(meta) if meta else {}
        merged_meta["is_escalated"] = is_esc
        merged_meta["assigned_staff_name"] = staff

        return RiskEvent(
            event_id=eid,
            source="abandoned_object",
            event_type=ev_type,
            confidence=float(conf),
            timestamp=numeric_ts,
            severity=sev,
            person_ids=list(pids) if pids else [],
            object_ids=[int(obj_id)] if obj_id is not None else [],
            object_class=str(obj_cls),
            location=loc,
            duration_seconds=float(unattended_dur),
            metadata=merged_meta,
            raw_event=ev,
            display_timestamp=display_ts
        )

    @classmethod
    def from_restricted_area(cls, ev: Any, current_time: Optional[float] = None) -> RiskEvent:
        """Normalizes a RestrictedAreaEvent instance or dictionary into a RiskEvent."""
        now = safe_extract_timestamp(current_time)
        ev_type = getattr(ev, "event_type", None) or (ev.get("event_type") if isinstance(ev, dict) else "zone_breach")
        zone_name = getattr(ev, "zone_name", None) or (ev.get("zone_name") if isinstance(ev, dict) else "Restricted Zone")
        pids = getattr(ev, "person_ids", None) or (ev.get("person_ids") if isinstance(ev, dict) else [])
        conf = getattr(ev, "confidence", None) or (ev.get("confidence") if isinstance(ev, dict) else 0.90)
        sev = getattr(ev, "severity", None) or (ev.get("severity") if isinstance(ev, dict) else "high")
        ts = getattr(ev, "timestamp", None) or (ev.get("timestamp") if isinstance(ev, dict) else now)
        dur = getattr(ev, "duration_seconds", None) or (ev.get("duration_seconds") if isinstance(ev, dict) else 0.0)
        loc = getattr(ev, "location", None) or (ev.get("location") if isinstance(ev, dict) else None)
        meta = getattr(ev, "metadata", None) or (ev.get("metadata") if isinstance(ev, dict) else {})
        display_ts = getattr(ev, "display_timestamp", None) or (ev.get("display_timestamp") if isinstance(ev, dict) else None)

        numeric_ts = safe_extract_timestamp(ts, fallback=now)
        eid = f"RISK-ZONE-{zone_name.replace(' ', '_')[:10]}-{int(numeric_ts * 100) % 100000}"

        return RiskEvent(
            event_id=eid,
            source="restricted_area",
            event_type=ev_type,
            confidence=float(conf),
            timestamp=numeric_ts,
            severity=sev,
            person_ids=list(pids) if pids else [],
            object_ids=[],
            location=loc,
            zone_name=zone_name,
            duration_seconds=float(dur),
            metadata=dict(meta) if meta else {},
            raw_event=ev,
            display_timestamp=display_ts
        )

    @classmethod
    def normalize(cls, event: Any, source: Optional[str] = None, current_time: Optional[float] = None) -> Optional[RiskEvent]:
        """
        Auto-detects event origin and normalizes into RiskEvent.
        """
        if event is None:
            return None

        if isinstance(event, RiskEvent):
            return event

        # Check source if explicitly provided
        if source == "crowd_detection":
            return cls.from_crowd(event, current_time)
        elif source == "behavior_detection":
            return cls.from_behavior(event, current_time)
        elif source == "abandoned_object":
            return cls.from_abandoned_object(event, current_time)
        elif source == "restricted_area":
            return cls.from_restricted_area(event, current_time)

        # Inspect type/class name
        cls_name = event.__class__.__name__
        if cls_name == "BehaviourEvent":
            return cls.from_behavior(event, current_time)
        elif cls_name == "PotentialAbandonedObjectEvent":
            return cls.from_abandoned_object(event, current_time)
        elif cls_name == "RestrictedAreaEvent":
            return cls.from_restricted_area(event, current_time)
        elif isinstance(event, dict):
            if "zone_name" in event:
                return cls.from_restricted_area(event, current_time)
            elif "object_class" in event or "unattended_duration" in event:
                return cls.from_abandoned_object(event, current_time)
            elif "crowd_detected" in event or event.get("event_type") == "crowd_detected":
                return cls.from_crowd(event, current_time)
            elif "event_type" in event and event["event_type"] in ["fall", "aggressive_movement", "potential_violent_activity"]:
                return cls.from_behavior(event, current_time)
            else:
                return cls.from_behavior(event, current_time)

        return None
