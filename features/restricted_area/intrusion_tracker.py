"""
AI Campus Guard - Per-Person Intrusion State Machine & Tracker
Tracks individual track IDs through intrusion states (OUTSIDE -> CHECKING -> INSIDE -> EXITED).
Applies multi-anchor box inspection, temporal track memory grace periods, and prevents alert flickering.
"""

from typing import Dict, List, Tuple, Optional, Any
from .event import RestrictedAreaEvent
from .zone import ZoneManager, RestrictedZone

class IntrusionTracker:
    """
    Manages temporal intrusion states for all active person track IDs across multiple zones.
    """
    def __init__(
        self,
        confirmation_seconds: float = 0.5,
        cooldown_seconds: float = 5.0,
        track_memory_seconds: float = 1.5,
        camera_id: str = "CAM-01",
        location: Optional[str] = None
    ):
        self.confirmation_seconds = confirmation_seconds
        self.cooldown_seconds = cooldown_seconds
        self.track_memory_seconds = track_memory_seconds
        self.camera_id = camera_id
        self.location = location

        # State storage structure:
        # { (track_id, zone_name): {
        #     "state": "OUTSIDE"|"CHECKING"|"INSIDE",
        #     "start_time": float,
        #     "last_seen_time": float,
        #     "last_alert_time": float,
        #     "confidence": float
        # } }
        self.track_states: Dict[Tuple[int, str], Dict[str, Any]] = {}

    def update(
        self,
        tracked_persons: List[Dict[str, Any]],
        zone_manager: ZoneManager,
        current_time: float
    ) -> List[RestrictedAreaEvent]:
        """
        Updates intrusion states for all active tracked persons and returns newly confirmed breach events.

        Args:
            tracked_persons: List of dicts [{'track_id': int, 'box': (x1, y1, x2, y2), 'confidence': float}, ...]
            zone_manager: Active ZoneManager instance.
            current_time: Current video timestamp in seconds.

        Returns:
            List[RestrictedAreaEvent]: Newly triggered breach events in this frame.
        """
        events: List[RestrictedAreaEvent] = []

        active_track_ids = {p["track_id"] for p in tracked_persons if p.get("track_id") is not None}

        # 1. Cleanup disappeared tracks only after track_memory_seconds grace period
        for (tid, zone_name) in list(self.track_states.keys()):
            if tid not in active_track_ids:
                st = self.track_states[(tid, zone_name)]
                last_seen = st.get("last_seen_time", current_time)
                time_missing = current_time - last_seen

                # Grace period: hold state for track_memory_seconds before declaring track lost
                if time_missing >= self.track_memory_seconds:
                    if st["state"] == "INSIDE":
                        start_t = st["start_time"] if st["start_time"] is not None else current_time
                        duration = last_seen - start_t
                        exit_event = RestrictedAreaEvent.create(
                            event_type="zone_exit",
                            zone_name=zone_name,
                            person_ids=[tid],
                            confidence=st.get("confidence", 1.0),
                            severity="medium",
                            video_time=current_time,
                            camera_id=self.camera_id,
                            location=self.location,
                            duration_seconds=duration
                        )
                        events.append(exit_event)
                    del self.track_states[(tid, zone_name)]

        # 2. Process active tracked persons
        for person in tracked_persons:
            tid = person.get("track_id")
            if tid is None:
                continue

            x1, y1, x2, y2 = person["box"]
            conf = person.get("confidence", 1.0)
            box = (x1, y1, x2, y2)

            # Multi-Anchor Inspection: Check if box overlaps/contains zone (Center, Bottom, Mid-Low, Top)
            containing_zones = zone_manager.get_zones_for_box(box)
            containing_zone_names = {z.name for z in containing_zones}

            for zone in zone_manager.zones:
                zone_key = (tid, zone.name)
                is_inside_now = zone.name in containing_zone_names

                state_info = self.track_states.setdefault(zone_key, {
                    "state": "OUTSIDE",
                    "start_time": None,
                    "last_seen_time": current_time,
                    "last_alert_time": -999.0,
                    "confidence": conf
                })

                state_info["last_seen_time"] = current_time
                in_cooldown = (current_time - state_info["last_alert_time"]) < self.cooldown_seconds

                if is_inside_now:
                    state_info["confidence"] = conf
                    if state_info["state"] == "OUTSIDE":
                        # Check if a recently lost track inside this zone can transfer state to avoid ID-flicker
                        transferred = False
                        for (old_tid, z_name), old_st in list(self.track_states.items()):
                            if z_name == zone.name and old_tid != tid and old_st["state"] == "INSIDE":
                                if (current_time - old_st.get("last_seen_time", 0.0)) <= self.track_memory_seconds:
                                    state_info["state"] = "INSIDE"
                                    state_info["start_time"] = old_st["start_time"]
                                    state_info["last_alert_time"] = old_st["last_alert_time"]
                                    transferred = True
                                    del self.track_states[(old_tid, z_name)]
                                    break

                        if not transferred:
                            state_info["state"] = "CHECKING"
                            state_info["start_time"] = current_time

                    start_t = state_info["start_time"] if state_info["start_time"] is not None else current_time
                    elapsed = current_time - start_t

                    if elapsed >= self.confirmation_seconds or state_info["state"] == "INSIDE":
                        if state_info["state"] != "INSIDE":
                            state_info["state"] = "INSIDE"

                            if not in_cooldown:
                                state_info["last_alert_time"] = current_time

                                breach_event = RestrictedAreaEvent.create(
                                    event_type="zone_breach",
                                    zone_name=zone.name,
                                    person_ids=[tid],
                                    confidence=conf,
                                    severity=zone.severity,
                                    video_time=current_time,
                                    camera_id=self.camera_id,
                                    location=self.location,
                                    duration_seconds=elapsed,
                                    metadata={
                                        "box": [x1, y1, x2, y2],
                                        "zone_name": zone.name
                                    }
                                )
                                events.append(breach_event)
                else:
                    if state_info["state"] == "INSIDE":
                        start_t = state_info["start_time"] if state_info["start_time"] is not None else current_time
                        duration = current_time - start_t
                        exit_event = RestrictedAreaEvent.create(
                            event_type="zone_exit",
                            zone_name=zone.name,
                            person_ids=[tid],
                            confidence=conf,
                            severity="medium",
                            video_time=current_time,
                            camera_id=self.camera_id,
                            location=self.location,
                            duration_seconds=duration
                        )
                        events.append(exit_event)

                    state_info["state"] = "OUTSIDE"
                    state_info["start_time"] = None

        return events

    def get_track_zone_state(self, track_id: int, zone_name: str) -> str:
        """Returns the current state ('OUTSIDE', 'CHECKING', 'INSIDE') for a person and zone."""
        st = self.track_states.get((track_id, zone_name), {})
        return st.get("state", "OUTSIDE")

    def get_active_intruders_count(self) -> int:
        """Returns total count of unique persons currently inside any zone."""
        inside_tids = {tid for (tid, _), st in self.track_states.items() if st.get("state") == "INSIDE"}
        return len(inside_tids)
