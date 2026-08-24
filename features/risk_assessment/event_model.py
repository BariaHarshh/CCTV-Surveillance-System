"""
AI Campus Guard - Normalized Risk Event Data Model
Defines the standardized internal event structure used by the Risk Assessment Engine across all detection sources.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Union
import json
import time
import datetime

@dataclass
class RiskEvent:
    """
    Normalized internal event representation consumed by the Risk Assessment Engine.
    All timestamps are strictly stored as numeric float values.
    """
    event_id: str
    source: str                             # 'crowd_detection', 'behavior_detection', 'abandoned_object', 'restricted_area'
    event_type: str                         # e.g. 'crowd_detected', 'fall', 'potential_violent_activity', 'zone_breach'
    confidence: float                       # Detection confidence (0.0 to 1.0)
    timestamp: float                        # Numeric Unix or video timeline timestamp in seconds
    severity: str = "medium"                # 'low', 'medium', 'high', 'critical'
    person_ids: List[int] = field(default_factory=list) # ByteTrack person IDs involved
    object_ids: List[int] = field(default_factory=list) # Tracked object IDs involved
    object_class: Optional[str] = None      # 'backpack', 'handbag', 'suitcase', 'bottle'
    location: Optional[str] = None          # Location / room identifier
    zone_name: Optional[str] = None         # Name of zone (for restricted area)
    duration_seconds: float = 0.0           # Duration event has been sustained in seconds
    metadata: Dict[str, Any] = field(default_factory=dict) # Source-specific metrics
    raw_event: Optional[Any] = None         # Reference to original event object
    display_timestamp: Optional[str] = None # Formatted string for UI presentation

    def to_dict(self) -> Dict[str, Any]:
        """Converts event to serializable dictionary (omits raw_event reference)."""
        d = asdict(self)
        d.pop("raw_event", None)
        return d

    def to_json(self, indent: Optional[int] = None) -> str:
        """Serializes event to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    def get_display_title(self) -> str:
        """Returns clean human-readable event title for UI alerts and logs."""
        clean_type = self.event_type.replace("_", " ").title()
        if self.source == "restricted_area" and self.zone_name:
            return f"Restricted Zone Breach: {self.zone_name}"
        elif self.source == "abandoned_object" and self.object_class:
            cls_str = self.object_class.replace("_", " ").title()
            obj_tag = f" (#{self.object_ids[0]})" if self.object_ids else ""
            return f"Unattended {cls_str}{obj_tag}"
        elif self.source == "behavior_detection":
            if self.event_type == "fall":
                return "Potential Fall Detected"
            elif self.event_type == "aggressive_movement":
                return "Aggressive Movement Detected"
            elif self.event_type == "potential_violent_activity":
                return "Potential Violent Activity / Fight"
        elif self.source == "crowd_detection":
            count = self.metadata.get("person_count", "")
            return f"Crowd Threshold Exceeded ({count} people)" if count else "Crowd Detected"
        return f"{clean_type} ({self.source})"

    def get_display_timestamp(self) -> str:
        """Returns formatted human-readable timestamp."""
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
