"""
AI Campus Guard - Restricted Area Event Data Structure
Represents structured breach notifications and zone intrusion events.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import time

@dataclass
class RestrictedAreaEvent:
    """
    Structured event payload emitted when an intrusion or zone breach occurs.
    """
    event_id: str
    event_type: str                     # e.g. 'zone_breach', 'zone_exit'
    zone_name: str                      # Name of breached zone (e.g. 'RESTRICTED ZONE A')
    person_ids: List[int]               # Internal ByteTrack track IDs involved
    confidence: float                   # Detection confidence score (0.0 to 1.0)
    severity: str                       # 'medium', 'high', 'critical'
    timestamp: float                    # Video timeline or wall-clock timestamp in seconds
    camera_id: str = "CAM-01"
    location: Optional[str] = None
    duration_seconds: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        event_type: str,
        zone_name: str,
        person_ids: List[int],
        confidence: float,
        severity: str,
        video_time: float,
        camera_id: str = "CAM-01",
        location: Optional[str] = None,
        duration_seconds: float = 0.0,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "RestrictedAreaEvent":
        """Factory method to instantiate a new RestrictedAreaEvent."""
        timestamp_str = time.strftime("%H:%M:%S", time.localtime())
        event_id = f"RA-{zone_name.replace(' ', '_')}-{int(video_time * 100)}"
        
        return cls(
            event_id=event_id,
            event_type=event_type,
            zone_name=zone_name,
            person_ids=person_ids,
            confidence=confidence,
            severity=severity,
            timestamp=video_time,
            camera_id=camera_id,
            location=location,
            duration_seconds=duration_seconds,
            metadata=metadata or {}
        )

    def get_display_timestamp(self) -> str:
        """Formats the video timestamp into a human-readable mm:ss string."""
        minutes = int(self.timestamp // 60)
        seconds = int(self.timestamp % 60)
        return f"{minutes:02d}:{seconds:02d}"

    def get_display_title(self) -> str:
        """Returns a clean display title for alerts and logs."""
        return f"BREACH DETECTED: {self.zone_name}"
