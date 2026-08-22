"""
AI Campus Guard - Behaviour Detection Event Model
Defines standardized event data structures for behaviour incidents with numeric timestamps.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Union
import json
import time
import datetime

def get_event_timestamp(event: Any) -> float:
    """
    Safely extracts a numeric float timestamp from an event object, dict, or raw timestamp value.
    Supports:
      - float / int numeric timestamps
      - datetime objects
      - ISO-8601 strings (e.g. "2026-08-22T15:28:01")
      - Video timeline strings (e.g. "T+14.20s")
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
        # Handle ISO timestamp format
        try:
            dt = datetime.datetime.fromisoformat(clean_ts)
            return dt.timestamp()
        except ValueError:
            pass

    return 0.0

@dataclass
class BehaviourEvent:
    """
    Standardized event representation for detected behavioural anomalies.
    Emitted by the Behaviour Detection module for downstream consumption (e.g. Risk Assessment Engine).
    """
    event_type: str                         # 'fall', 'aggressive_movement', 'potential_violent_activity'
    person_ids: List[int]                   # List of involved track IDs (e.g. [17] or [17, 21])
    confidence: float                       # Behaviour confidence score (0.0 - 1.0)
    severity: str                           # 'low', 'medium', 'high', 'critical'
    timestamp: float                        # Numeric timestamp in seconds (Unix epoch or video timeline)
    display_timestamp: Optional[str] = None # Human-readable timestamp string (e.g. "14:32:18" or "T+14.20s")
    camera_id: str = "CAM-01"               # Camera identifier
    location: Optional[str] = None          # Optional campus zone / room ID
    duration_seconds: float = 0.0           # Duration the behaviour has been actively sustained
    metadata: Dict[str, Any] = field(default_factory=dict) # Quantitative metrics (speed, accel, aspect_ratio, distance)

    def to_dict(self) -> Dict[str, Any]:
        """Converts event to dictionary."""
        return asdict(self)

    def to_json(self, indent: Optional[int] = None) -> str:
        """Serializes event to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    def get_display_title(self) -> str:
        """Returns non-certain display text suitable for UI alerts."""
        if self.event_type == "fall":
            return "Potential Fall Detected"
        elif self.event_type == "aggressive_movement":
            return "Potential Aggressive / Unusual Movement"
        elif self.event_type == "potential_violent_activity":
            return "Potential Violent Activity Detected"
        return f"Behaviour Event: {self.event_type}"

    def get_display_timestamp(self) -> str:
        """Returns formatted human-readable timestamp for UI presentation."""
        if self.display_timestamp:
            return self.display_timestamp
        if isinstance(self.timestamp, (int, float)):
            # If timestamp is video timeline (< 100,000s)
            if self.timestamp < 100000.0:
                return f"T+{self.timestamp:.2f}s"
            else:
                try:
                    return datetime.datetime.fromtimestamp(self.timestamp).strftime("%H:%M:%S")
                except Exception:
                    return f"{self.timestamp:.2f}"
        return str(self.timestamp)

    @classmethod
    def create(
        cls,
        event_type: str,
        person_ids: List[int],
        confidence: float,
        severity: str,
        video_time: Optional[float] = None,
        camera_id: str = "CAM-01",
        location: Optional[str] = None,
        duration_seconds: float = 0.0,
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[Union[float, str]] = None
    ) -> "BehaviourEvent":
        """Factory method for creating BehaviourEvent instances with numeric timestamps."""
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

        return cls(
            event_type=event_type,
            person_ids=person_ids,
            confidence=round(float(confidence), 2),
            severity=severity,
            timestamp=numeric_ts,
            display_timestamp=display_ts,
            camera_id=camera_id,
            location=location,
            duration_seconds=round(float(duration_seconds), 2),
            metadata=metadata or {}
        )
