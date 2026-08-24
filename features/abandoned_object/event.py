"""
AI Campus Guard - Abandoned Object Event Data Model
Defines standardized event payloads for unattended and potential abandoned objects with numeric timestamps
and Tier-2 prolonged abandonment staff escalation support.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Union
import json
import time
import datetime

def get_event_timestamp(event: Any) -> float:
    """
    Safely extracts a numeric float timestamp from an event object, dict, or raw timestamp value.
    Supports float/int numeric timestamps, datetime objects, and ISO strings.
    """
    if event is None:
        return 0.0

    if isinstance(event, (int, float)):
        return float(event)

    if isinstance(event, datetime.datetime):
        return event.timestamp()

    if isinstance(event, str):
        ts = event
    else:
        ts = getattr(event, "timestamp", None)
        if ts is None and isinstance(event, dict):
            ts = event.get("timestamp")

    if ts is None:
        return 0.0

    if isinstance(ts, (int, float)):
        return float(ts)

    if isinstance(ts, datetime.datetime):
        return ts.timestamp()

    if isinstance(ts, str):
        clean_ts = ts.strip()
        if clean_ts.startswith("T+") and clean_ts.endswith("s"):
            try:
                return float(clean_ts[2:-1])
            except ValueError:
                pass
        try:
            return float(clean_ts)
        except ValueError:
            pass
        try:
            dt = datetime.datetime.fromisoformat(clean_ts)
            return dt.timestamp()
        except ValueError:
            pass

    return 0.0

@dataclass
class PotentialAbandonedObjectEvent:
    """
    Structured event payload emitted when an unattended object reaches its initial threshold
    or escalates to prolonged abandonment (20-30 minutes) requiring area staff dispatch.
    """
    event_id: str
    event_type: str                         # 'potential_abandoned_object' or 'prolonged_abandoned_object_escalation'
    object_id: int                          # Unique object track ID
    object_class: str                       # 'backpack', 'handbag', 'suitcase', 'bottle'
    confidence: float                       # Confidence score (0.0 - 1.0)
    severity: str                           # 'low', 'medium', 'high', 'critical'
    timestamp: float                        # Numeric Unix timestamp or video timeline in seconds
    stationary_duration: float = 0.0        # Duration object has been stationary in seconds
    unattended_duration: float = 0.0        # Duration object has been unattended in seconds
    nearby_person_ids: List[int] = field(default_factory=list) # List of nearby person IDs
    closest_person_id: Optional[int] = None # Nearest person track ID
    closest_person_distance: Optional[float] = None # Distance to nearest person in pixels
    state: str = "POTENTIAL_ABANDONED"      # Object state: 'POTENTIAL_ABANDONED' or 'PROLONGED_ABANDONED_ESCALATED'
    camera_id: str = "CAM-01"
    location: Optional[str] = None
    
    # Tier-2 Prolonged Abandonment Staff Escalation Fields (20 to 30 min)
    is_escalated: bool = False              # True if prolonged unattended threshold reached (e.g. 20-30 min)
    assigned_staff_name: Optional[str] = None # Name of staff/warden in that specific area
    assigned_staff_role: Optional[str] = None # Role/title of staff member (e.g. 'Floor Warden')
    assigned_staff_contact: Optional[str] = None # Contact/radio channel (e.g. 'Ext 402 / Radio Ch-3')
    escalation_status: Optional[str] = None # e.g. 'STAFF_ALERT_TRANSMITTED'
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    display_timestamp: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Converts event to dictionary."""
        return asdict(self)

    def to_json(self, indent: Optional[int] = None) -> str:
        """Serializes event to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    def get_display_title(self) -> str:
        """Returns clean display text suitable for UI alerts and logs."""
        class_str = self.object_class.replace("_", " ").title()
        if self.is_escalated:
            staff_info = f" -> ALERT DISPATCHED TO {self.assigned_staff_name}" if self.assigned_staff_name else " -> AREA STAFF NOTIFIED"
            return f"CRITICAL ESCALATION (20+ MIN): {class_str} (#{self.object_id}){staff_info}"
        return f"Potential Abandoned Object: {class_str} (#{self.object_id})"

    def get_display_timestamp(self) -> str:
        """Returns formatted human-readable timestamp string."""
        if self.display_timestamp:
            return self.display_timestamp
        if isinstance(self.timestamp, (int, float)):
            if self.timestamp < 100000.0:
                minutes = int(self.timestamp // 60)
                seconds = int(self.timestamp % 60)
                return f"{minutes:02d}:{seconds:02d}"
            else:
                try:
                    return datetime.datetime.fromtimestamp(self.timestamp).strftime("%H:%M:%S")
                except Exception:
                    return f"{self.timestamp:.2f}"
        return str(self.timestamp)

    @classmethod
    def create(
        cls,
        object_id: int,
        object_class: str,
        confidence: float,
        severity: str,
        video_time: Optional[float] = None,
        stationary_duration: float = 0.0,
        unattended_duration: float = 0.0,
        nearby_person_ids: Optional[List[int]] = None,
        closest_person_id: Optional[int] = None,
        closest_person_distance: Optional[float] = None,
        state: str = "POTENTIAL_ABANDONED",
        camera_id: str = "CAM-01",
        location: Optional[str] = None,
        is_escalated: bool = False,
        assigned_staff_name: Optional[str] = None,
        assigned_staff_role: Optional[str] = None,
        assigned_staff_contact: Optional[str] = None,
        escalation_status: Optional[str] = None,
        event_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[Union[float, str]] = None
    ) -> "PotentialAbandonedObjectEvent":
        """Factory method to instantiate a new PotentialAbandonedObjectEvent."""
        if timestamp is not None:
            if isinstance(timestamp, (int, float)):
                numeric_ts = float(timestamp)
            else:
                numeric_ts = get_event_timestamp(timestamp)
        elif video_time is not None:
            numeric_ts = float(video_time)
        else:
            numeric_ts = time.time()

        if video_time is not None:
            display_ts = f"T+{video_time:.2f}s"
        else:
            try:
                display_ts = datetime.datetime.fromtimestamp(numeric_ts).strftime("%H:%M:%S")
            except Exception:
                display_ts = datetime.datetime.now().strftime("%H:%M:%S")

        prefix = "AO-ESCALATE" if is_escalated else "AO"
        event_id = f"{prefix}-{object_class.upper()}-{object_id}-{int(numeric_ts * 100) % 100000}"
        resolved_event_type = event_type or ("prolonged_abandoned_object_escalation" if is_escalated else "potential_abandoned_object")

        return cls(
            event_id=event_id,
            event_type=resolved_event_type,
            object_id=object_id,
            object_class=object_class.lower(),
            confidence=round(float(confidence), 2),
            severity=severity,
            timestamp=numeric_ts,
            stationary_duration=round(float(stationary_duration), 2),
            unattended_duration=round(float(unattended_duration), 2),
            nearby_person_ids=nearby_person_ids or [],
            closest_person_id=closest_person_id,
            closest_person_distance=round(float(closest_person_distance), 1) if closest_person_distance is not None else None,
            state=state,
            camera_id=camera_id,
            location=location,
            is_escalated=is_escalated,
            assigned_staff_name=assigned_staff_name,
            assigned_staff_role=assigned_staff_role,
            assigned_staff_contact=assigned_staff_contact,
            escalation_status=escalation_status,
            metadata=metadata or {},
            display_timestamp=display_ts
        )
