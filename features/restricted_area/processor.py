"""
AI Campus Guard - Unified Restricted Area Detection Processor
Coordinates zone configuration, foot-point geometry checks, per-person state tracking, and alert generation.
"""

from typing import List, Dict, Tuple, Optional, Any
import time
import config.config as config
from .event import RestrictedAreaEvent
from .zone import ZoneManager
from .intrusion_tracker import IntrusionTracker

class RestrictedAreaProcessor:
    """
    Stateful root coordinator for Restricted Area Detection feature module.
    """
    def __init__(
        self,
        zone_configs: Optional[List[Dict[str, Any]]] = None,
        confirmation_seconds: Optional[float] = None,
        cooldown_seconds: Optional[float] = None,
        camera_id: str = "CAM-01",
        location: str = "Campus Grounds"
    ):
        self.camera_id = camera_id
        self.location = location

        conf_sec = confirmation_seconds if confirmation_seconds is not None else 0.5
        cd_sec = cooldown_seconds if cooldown_seconds is not None else 5.0

        self.zone_manager = ZoneManager(zone_configs=zone_configs)
        self.intrusion_tracker = IntrusionTracker(
            confirmation_seconds=conf_sec,
            cooldown_seconds=cd_sec,
            camera_id=self.camera_id,
            location=self.location
        )

        from collections import deque
        self.event_history: deque[RestrictedAreaEvent] = deque(maxlen=5)
        self.recent_active_events: List[Tuple[RestrictedAreaEvent, float]] = []
        self.event_display_ttl: float = 4.0  # Seconds event stays in active HUD

    def set_zones(self, zone_configs: List[Dict[str, Any]], frame_shape: Optional[Tuple[int, int]] = None):
        """Dynamically updates active restricted zones at runtime."""
        self.zone_manager.load_zones(zone_configs, frame_shape=frame_shape)

    def update(
        self,
        tracked_persons: List[Dict[str, Any]],
        current_time: Optional[float] = None,
        frame_shape: Optional[Tuple[int, int]] = None
    ) -> Dict[str, Any]:
        """
        Main frame update call.

        Args:
            tracked_persons: List of tracked person dictionaries from YOLO/ByteTrack.
            current_time: Current video timestamp in seconds (or wall-clock time if None).
            frame_shape: Optional (width, height) for normalized coordinate resolution.

        Returns:
            Dict containing:
                - 'new_events': List[RestrictedAreaEvent] triggered in this frame
                - 'active_events': List[RestrictedAreaEvent] currently active in display buffer
                - 'active_intruders': List[int] track IDs inside any zone
                - 'zone_statuses': Dict[zone_name -> status dict]
                - 'summary': High-level statistics
        """
        now = current_time if current_time is not None else time.time()
        if frame_shape is not None:
            self.zone_manager.update_frame_shape(frame_shape)

        # 1. Update Intrusion Tracker
        new_events = self.intrusion_tracker.update(
            tracked_persons=tracked_persons,
            zone_manager=self.zone_manager,
            current_time=now
        )

        # 2. Maintain active events display buffer
        for ev in new_events:
            self.recent_active_events.append((ev, now + self.event_display_ttl))
            self.event_history.append(ev)

        self.recent_active_events = [
            (ev, exp) for (ev, exp) in self.recent_active_events if exp > now
        ]
        active_events = [ev for (ev, _) in self.recent_active_events]

        # 3. Identify active intruders and zone statuses
        active_intruder_ids = []
        zone_statuses = {}

        for zone in self.zone_manager.zones:
            intruders_in_zone = []
            checking_in_zone = []

            for person in tracked_persons:
                tid = person.get("track_id")
                if tid is None:
                    continue
                st = self.intrusion_tracker.get_track_zone_state(tid, zone.name)
                if st == "INSIDE":
                    intruders_in_zone.append(tid)
                    if tid not in active_intruder_ids:
                        active_intruder_ids.append(tid)
                elif st == "CHECKING":
                    checking_in_zone.append(tid)

            is_breached = len(intruders_in_zone) > 0
            is_checking = len(checking_in_zone) > 0

            status_str = "ALERT" if is_breached else ("CHECKING" if is_checking else "SECURE")

            zone_statuses[zone.name] = {
                "name": zone.name,
                "severity": zone.severity,
                "status": status_str,
                "intruders_count": len(intruders_in_zone),
                "intruder_ids": intruders_in_zone,
                "checking_ids": checking_in_zone
            }

        has_alert = any(z["status"] == "ALERT" for z in zone_statuses.values())

        return {
            "new_events": new_events,
            "active_events": active_events,
            "event_history": list(self.event_history),
            "active_intruders": active_intruder_ids,
            "zone_statuses": zone_statuses,
            "summary": {
                "total_persons": len(tracked_persons),
                "active_intruders_count": len(active_intruder_ids),
                "total_zones": len(self.zone_manager.zones),
                "has_breach": has_alert,
                "status": "ALERT" if has_alert else "SECURE"
            }
        }
