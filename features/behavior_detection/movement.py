"""
AI Campus Guard - Aggressive / Unusual Movement Analyzer
Analyzes speed, acceleration, and angular direction volatility to identify erratic or aggressive locomotion.
"""

from typing import Dict, List, Optional, Any
from .config import MovementConfig
from .tracking_history import TrackHistory, TrackHistoryManager
from .event import BehaviourEvent

class MovementAnalyzer:
    """
    Evaluates individual motion dynamics over a sliding temporal window.
    Detects sudden sprint bursts, rapid direction oscillations, and abrupt aggressive acceleration.
    Calibrated to ignore normal walking, jogging, and minor directional turns.
    """
    def __init__(self, config: Optional[MovementConfig] = None, camera_id: str = "CAM-01", location: Optional[str] = None):
        self.config = config or MovementConfig()
        self.camera_id = camera_id
        self.location = location

        # State tracking per track_id:
        # { track_id: {"state": "NORMAL"|"CHECKING"|"SUSPICIOUS"|"POTENTIAL_AGGRESSIVE", "start_time": float, "last_alert_time": float} }
        self.person_states: Dict[int, Dict[str, Any]] = {}

    def update(self, history_manager: TrackHistoryManager, current_time: float) -> List[BehaviourEvent]:
        """
        Analyzes active tracks and updates movement anomaly states.

        Args:
            history_manager: Active TrackHistoryManager.
            current_time: Current timestamp in seconds.

        Returns:
            List[BehaviourEvent]: Confirmed aggressive movement events.
        """
        if not self.config.enabled:
            return []

        active_tracks = history_manager.get_active_tracks()
        events: List[BehaviourEvent] = []

        # Cleanup disappeared tracks
        for tid in list(self.person_states.keys()):
            if tid not in active_tracks:
                del self.person_states[tid]

        for track_id, track in active_tracks.items():
            if len(track.observations) < 4:
                # Need at least a few observations to establish kinematic trend
                continue

            state_info = self.person_states.setdefault(track_id, {
                "state": "NORMAL",
                "start_time": None,
                "last_alert_time": -999.0,
                "confidence": 0.0
            })

            in_cooldown = (current_time - state_info["last_alert_time"]) < self.config.cooldown_seconds

            # 1. Kinematic Metrics over recent window
            mean_speed = track.get_mean_speed(seconds=1.0)
            max_speed = track.get_max_speed(seconds=0.8)
            mean_accel = track.get_mean_acceleration(seconds=1.0)
            max_accel = track.get_max_acceleration(seconds=0.8)
            volatility = track.get_direction_volatility(seconds=1.2)

            # 2. Multi-signal Anomaly Assessment
            is_high_speed = max_speed >= self.config.speed_threshold
            is_high_accel = max_accel >= self.config.acceleration_threshold
            is_erratic_direction = volatility >= self.config.direction_volatility_threshold

            # Robust multi-condition activation:
            # - High speed combined with high acceleration OR
            # - High speed with erratic zig-zagging / direction changes OR
            # - Extreme high speed burst (sprinting/fleeing)
            is_unusual_movement = (
                (is_high_speed and is_high_accel) or
                (is_high_speed and is_erratic_direction) or
                (max_speed >= self.config.speed_threshold * 1.35 and is_high_accel)
            )

            # 3. State Machine & Persistence
            if is_unusual_movement:
                if state_info["start_time"] is None:
                    state_info["start_time"] = current_time
                    state_info["state"] = "CHECKING"

                elapsed_duration = current_time - state_info["start_time"]

                confidence = self._compute_confidence(
                    speed=max_speed,
                    accel=max_accel,
                    volatility=volatility
                )
                state_info["confidence"] = confidence

                if elapsed_duration >= (self.config.persistence_seconds * 0.5):
                    state_info["state"] = "SUSPICIOUS"

                if elapsed_duration >= self.config.persistence_seconds:
                    state_info["state"] = "POTENTIAL_AGGRESSIVE"

                    if not in_cooldown and confidence >= self.config.confidence_threshold:
                        state_info["last_alert_time"] = current_time

                        event = BehaviourEvent.create(
                            event_type="aggressive_movement",
                            person_ids=[track_id],
                            confidence=confidence,
                            severity="medium",
                            video_time=current_time,
                            camera_id=self.camera_id,
                            location=self.location,
                            duration_seconds=elapsed_duration,
                            metadata={
                                "mean_speed": round(mean_speed, 1),
                                "max_speed": round(max_speed, 1),
                                "max_acceleration": round(max_accel, 1),
                                "direction_volatility": round(volatility, 1)
                            }
                        )
                        events.append(event)
            else:
                state_info["state"] = "NORMAL"
                state_info["start_time"] = None
                state_info["confidence"] = 0.0

        return events

    def _compute_confidence(self, speed: float, accel: float, volatility: float) -> float:
        """Computes internal movement anomaly confidence score (0.0 to 1.0)."""
        speed_score = min(1.0, max(0.0, speed / (self.config.speed_threshold * 1.3)))
        accel_score = min(1.0, max(0.0, accel / (self.config.acceleration_threshold * 1.3)))
        vol_score = min(1.0, max(0.0, volatility / (self.config.direction_volatility_threshold * 1.3)))

        raw = (0.45 * speed_score) + (0.35 * accel_score) + (0.20 * vol_score)
        return min(0.95, max(0.20, raw))

    def get_state(self, track_id: int) -> Dict[str, Any]:
        """Returns movement state for a given track ID."""
        return self.person_states.get(track_id, {"state": "NORMAL", "confidence": 0.0})
