"""
AI Campus Guard - Potential Fight & Violent Interaction Detector
Analyzes pairwise proximity, convergence dynamics, and mutual kinetic struggle over temporal windows.
"""

from typing import Dict, List, Tuple, Optional, Any
import math
from .config import FightConfig
from .tracking_history import TrackHistory, TrackHistoryManager
from .event import BehaviourEvent

class FightDetector:
    """
    Evaluates pairwise interactions between tracked individuals.
    Detects sustained close-range violent encounters, aggressive rushes, and mutual physical struggle.
    Calibrated to prevent false alarms on persons simply walking past each other.
    """
    def __init__(self, config: Optional[FightConfig] = None, camera_id: str = "CAM-01", location: Optional[str] = None):
        self.config = config or FightConfig()
        self.camera_id = camera_id
        self.location = location

        # Pairwise state tracking:
        # { (id1, id2): {"state": "NORMAL"|"INTERACTION"|"SUSPICIOUS"|"POTENTIAL_FIGHT", "start_time": float, "last_alert_time": float, ...} }
        self.pair_states: Dict[Tuple[int, int], Dict[str, Any]] = {}

    def update(self, history_manager: TrackHistoryManager, current_time: float) -> List[BehaviourEvent]:
        """
        Processes all pairs of active persons and updates interaction/fight states.

        Args:
            history_manager: Active TrackHistoryManager instance.
            current_time: Current timestamp in seconds.

        Returns:
            List[BehaviourEvent]: Confirmed violent activity / potential fight events.
        """
        if not self.config.enabled:
            return []

        active_tracks = history_manager.get_active_tracks()
        track_ids = sorted(list(active_tracks.keys()))
        events: List[BehaviourEvent] = []

        # Cleanup disappeared pairs
        for pair_key in list(self.pair_states.keys()):
            id1, id2 = pair_key
            if id1 not in active_tracks or id2 not in active_tracks:
                del self.pair_states[pair_key]

        # Evaluate all unique pairs (id1, id2) where id1 < id2
        for i in range(len(track_ids)):
            for j in range(i + 1, len(track_ids)):
                id1, id2 = track_ids[i], track_ids[j]
                track1 = active_tracks[id1]
                track2 = active_tracks[id2]

                if not track1.observations or not track2.observations:
                    continue

                pair_key = (id1, id2)
                state_info = self.pair_states.setdefault(pair_key, {
                    "state": "NORMAL",
                    "start_time": None,
                    "last_alert_time": -999.0,
                    "confidence": 0.0,
                    "current_distance": 0.0
                })

                obs1 = track1.observations[-1]
                obs2 = track2.observations[-1]

                # 1. Spatial Proximity Check
                cx1, cy1 = obs1.center
                cx2, cy2 = obs2.center
                dx = abs(cx1 - cx2)
                dy = abs(cy1 - cy2)
                thresh = self.config.proximity_threshold

                if dx > thresh or dy > thresh:
                    state_info["current_distance"] = dx + dy
                    state_info["state"] = "NORMAL"
                    state_info["start_time"] = None
                    state_info["confidence"] = 0.0
                    continue

                dist = math.sqrt(dx * dx + dy * dy)
                state_info["current_distance"] = dist

                if dist > thresh:
                    state_info["state"] = "NORMAL"
                    state_info["start_time"] = None
                    state_info["confidence"] = 0.0
                    continue

                in_cooldown = (current_time - state_info["last_alert_time"]) < self.config.cooldown_seconds

                # 2. Kinematic Metrics for both individuals (evaluated only when close)
                speed1 = track1.get_mean_speed(seconds=0.8)
                speed2 = track2.get_mean_speed(seconds=0.8)
                max_speed1 = track1.get_max_speed(seconds=0.8)
                max_speed2 = track2.get_max_speed(seconds=0.8)
                accel1 = track1.get_max_acceleration(seconds=0.8)
                accel2 = track2.get_max_acceleration(seconds=0.8)
                vol1 = track1.get_direction_volatility(seconds=1.0)
                vol2 = track2.get_direction_volatility(seconds=1.0)

                combined_speed = speed1 + speed2
                max_pair_speed = max(max_speed1, max_speed2)
                max_pair_accel = max(accel1, accel2)
                mean_volatility = (vol1 + vol2) / 2.0

                # 3. Proximity and Aggressive Encounter Criteria
                is_close_proximity = True
                
                # Active kinetic encounter condition:
                # - In close proximity AND
                # - (High combined mutual speed OR rapid struggle acceleration OR erratic mutual volatility)
                is_aggressive_interaction = (
                    is_close_proximity and
                    (
                        (combined_speed >= self.config.mutual_speed_threshold) or
                        (max_pair_speed >= 80.0 and max_pair_accel >= self.config.mutual_accel_threshold) or
                        (dist <= self.config.proximity_threshold * 0.75 and mean_volatility >= 40.0)
                    )
                )

                # 4. State Machine & Persistence
                if is_aggressive_interaction:
                    if state_info["start_time"] is None:
                        state_info["start_time"] = current_time
                        state_info["state"] = "INTERACTION"

                    elapsed = current_time - state_info["start_time"]

                    confidence = self._compute_confidence(
                        dist=dist,
                        combined_speed=combined_speed,
                        max_accel=max_pair_accel,
                        volatility=mean_volatility,
                        det_conf=(obs1.confidence + obs2.confidence) / 2.0
                    )
                    state_info["confidence"] = confidence

                    if elapsed >= (self.config.persistence_seconds * 0.5):
                        state_info["state"] = "SUSPICIOUS"

                    if elapsed >= self.config.persistence_seconds:
                        state_info["state"] = "POTENTIAL_FIGHT"

                        if not in_cooldown and confidence >= self.config.confidence_threshold:
                            state_info["last_alert_time"] = current_time

                            event = BehaviourEvent.create(
                                event_type="potential_violent_activity",
                                person_ids=[id1, id2],
                                confidence=confidence,
                                severity="high",
                                video_time=current_time,
                                camera_id=self.camera_id,
                                location=self.location,
                                duration_seconds=elapsed,
                                metadata={
                                    "distance_px": round(dist, 1),
                                    "combined_speed": round(combined_speed, 1),
                                    "peak_acceleration": round(max_pair_accel, 1),
                                    "interaction_duration": round(elapsed, 2)
                                }
                            )
                            events.append(event)
                else:
                    # If distance increases or motion settles down, reset to NORMAL
                    state_info["state"] = "NORMAL"
                    state_info["start_time"] = None
                    state_info["confidence"] = 0.0

        return events

    def _compute_confidence(
        self,
        dist: float,
        combined_speed: float,
        max_accel: float,
        volatility: float,
        det_conf: float
    ) -> float:
        """Calculates multi-factor confidence (0.0 to 1.0) for violent activity."""
        # 1. Proximity score (closer distance -> higher score)
        prox_score = min(1.0, max(0.0, (self.config.proximity_threshold - dist) / self.config.proximity_threshold))

        # 2. Kinetic velocity score
        speed_score = min(1.0, max(0.0, combined_speed / (self.config.mutual_speed_threshold * 1.5)))

        # 3. Acceleration / burst score
        accel_score = min(1.0, max(0.0, max_accel / (self.config.mutual_accel_threshold * 1.5)))

        # 4. Volatility score
        vol_score = min(1.0, max(0.0, volatility / 60.0))

        raw = (0.30 * prox_score) + (0.30 * speed_score) + (0.25 * accel_score) + (0.15 * vol_score)
        scaled = raw * (0.75 + 0.25 * det_conf)
        return min(0.96, max(0.20, scaled))

    def get_state(self, id1: int, id2: int) -> Dict[str, Any]:
        """Returns pairwise interaction state for two track IDs."""
        key = (min(id1, id2), max(id1, id2))
        return self.pair_states.get(key, {"state": "NORMAL", "confidence": 0.0, "current_distance": 999.0})

    def get_all_pair_states(self) -> Dict[Tuple[int, int], Dict[str, Any]]:
        """Returns all currently maintained pair states."""
        return self.pair_states
