"""
AI Campus Guard - Unified Behaviour Detection Processor (Optimized)
Coordinates temporal tracking, individual motion analysis, fall detection, and pairwise interaction dynamics.
"""

from typing import List, Dict, Tuple, Optional, Any
import time
from .config import BehaviorConfig
from .tracking_history import TrackHistoryManager
from .fall import FallDetector
from .movement import MovementAnalyzer
from .interaction import FightDetector
from .event import BehaviourEvent

class BehaviorProcessor:
    """
    Stateful root coordinator for all behaviour analysis submodules.
    Consumes tracked person detections and outputs structured BehaviourEvents and state summaries.
    """
    def __init__(self, config: Optional[BehaviorConfig] = None):
        self.config = config or BehaviorConfig()

        self.history_manager = TrackHistoryManager(
            history_seconds=self.config.history_seconds,
            max_frames=self.config.history_max_frames,
            inactivity_timeout=self.config.track_inactivity_timeout_seconds
        )

        self.fall_detector = FallDetector(
            config=self.config.fall,
            camera_id=self.config.camera_id,
            location=self.config.location
        )

        self.movement_analyzer = MovementAnalyzer(
            config=self.config.movement,
            camera_id=self.config.camera_id,
            location=self.config.location
        )

        self.fight_detector = FightDetector(
            config=self.config.fight,
            camera_id=self.config.camera_id,
            location=self.config.location
        )

        from collections import deque
        self.event_history: deque[BehaviourEvent] = deque(maxlen=5)

        # Buffer of recent active events (for HUD display and persistence)
        # List of tuple: (BehaviourEvent, expire_timestamp)
        self.recent_active_events: List[Tuple[BehaviourEvent, float]] = []
        self.event_display_ttl: float = 4.0  # Seconds to hold event visible in active HUD

    def update(
        self,
        tracked_persons: List[Dict[str, Any]],
        current_time: Optional[float] = None,
        frame_shape: Optional[Tuple[int, int]] = None
    ) -> Dict[str, Any]:
        """
        Main update method called per frame.

        Args:
            tracked_persons: List of tracked person dictionaries from YOLO/ByteTrack.
            current_time: Video timeline timestamp in seconds (or wall-clock time if None).
            frame_shape: Optional (height, width) tuple of the frame for boundary checking.

        Returns:
            Dict containing:
                - 'new_events': List[BehaviourEvent] emitted in this frame
                - 'active_events': List[BehaviourEvent] currently in alert state
                - 'person_states': Dict[track_id -> person status]
                - 'pair_states': Dict[(id1, id2) -> interaction status]
                - 'summary': High-level statistics
        """
        now = current_time if current_time is not None else time.time()

        if not self.config.enabled:
            return {
                "new_events": [],
                "active_events": [],
                "person_states": {},
                "pair_states": {},
                "summary": {"total_persons": len(tracked_persons), "active_alerts_count": 0, "has_critical_event": False}
            }

        # 1. Update temporal history
        self.history_manager.update(tracked_persons, current_time=now)

        # 2. Run feature detectors
        fall_events = self.fall_detector.update(self.history_manager, current_time=now, frame_shape=frame_shape)
        movement_events = self.movement_analyzer.update(self.history_manager, current_time=now)
        fight_events = self.fight_detector.update(self.history_manager, current_time=now)

        new_events = fall_events + movement_events + fight_events

        # 3. Update active events buffer and event history
        for ev in new_events:
            self.recent_active_events.append((ev, now + self.event_display_ttl))
            self.event_history.append(ev)

        # Expire old events from HUD buffer
        self.recent_active_events = [
            (ev, exp) for (ev, exp) in self.recent_active_events if exp > now
        ]
        active_events = [ev for (ev, _) in self.recent_active_events]

        # 4. Compile Per-Person State Summary
        person_states = {}
        active_tracks = self.history_manager.get_active_tracks()
        for tid in active_tracks.keys():
            fall_st = self.fall_detector.get_state(tid)
            mov_st = self.movement_analyzer.get_state(tid)

            # Determine dominant state
            fall_state_name = fall_st.get("state", "NORMAL")
            mov_state_name = mov_st.get("state", "NORMAL")
            fall_prog = fall_st.get("progress", 0.0)

            if fall_state_name == "POTENTIAL_FALL":
                primary = "FALLEN"
                conf = fall_st.get("confidence", 0.0)
            elif mov_state_name == "POTENTIAL_AGGRESSIVE":
                primary = "AGGRESSIVE"
                conf = mov_st.get("confidence", 0.0)
            elif fall_state_name == "CHECKING":
                primary = "FALL_CHECKING"
                conf = fall_st.get("confidence", 0.0)
            elif mov_state_name in ("CHECKING", "SUSPICIOUS"):
                primary = "SUSPICIOUS"
                conf = max(fall_st.get("confidence", 0.0), mov_st.get("confidence", 0.0))
            else:
                primary = "NORMAL"
                conf = 0.0

            person_states[tid] = {
                "primary_state": primary,
                "fall_state": fall_state_name,
                "fall_progress": fall_prog,
                "movement_state": mov_state_name,
                "confidence": conf,
                "metrics": fall_st.get("metrics", {})
            }

        # 5. Compile Pairwise Interaction States
        pair_states = self.fight_detector.get_all_pair_states()

        # 6. Overall summary
        has_critical = any(ev.severity in ("high", "critical") for ev in active_events)

        return {
            "new_events": new_events,
            "active_events": active_events,
            "event_history": list(self.event_history),
            "person_states": person_states,
            "pair_states": pair_states,
            "summary": {
                "total_persons": len(tracked_persons),
                "active_alerts_count": len(active_events),
                "has_critical_event": has_critical
            }
        }
