"""
AI Campus Guard - Fall Detection Module (Optimized)
Detects sudden collapses or transitions from upright to fallen/horizontal postures over temporal windows.
Includes baseline posture tracking, relative aspect ratio expansion, and edge boundary filtering.
"""

from typing import Dict, List, Optional, Any, Tuple
from .config import FallConfig
from .tracking_history import TrackHistory, TrackHistoryManager
from .event import BehaviourEvent

class FallDetector:
    """
    High-precision multi-frame Fall Detector.
    Evaluates absolute & relative posture aspect ratio expansion, vertical height reduction,
    downward velocity, and post-fall low-speed ground persistence.
    """
    def __init__(self, config: Optional[FallConfig] = None, camera_id: str = "CAM-01", location: Optional[str] = None):
        self.config = config or FallConfig()
        self.camera_id = camera_id
        self.location = location

        # State tracking per track_id:
        # { track_id: {"state": "NORMAL"|"CHECKING"|"POTENTIAL_FALL", "fall_start_time": float, "progress": float, "last_alert_time": float, "confidence": float, "metrics": dict} }
        self.person_states: Dict[int, Dict[str, Any]] = {}

    def update(
        self,
        history_manager: TrackHistoryManager,
        current_time: float,
        frame_shape: Optional[Tuple[int, int]] = None
    ) -> List[BehaviourEvent]:
        """
        Processes all active tracks and evaluates fall detection state transitions.

        Args:
            history_manager: Active TrackHistoryManager instance.
            current_time: Current timestamp in seconds.
            frame_shape: Optional (height, width) tuple of the video frame to filter edge artifacts.

        Returns:
            List[BehaviourEvent]: List of newly confirmed fall events in the current frame.
        """
        if not self.config.enabled:
            return []

        active_tracks = history_manager.get_active_tracks()
        events: List[BehaviourEvent] = []

        # Cleanup states for tracks that no longer exist
        for tid in list(self.person_states.keys()):
            if tid not in active_tracks:
                del self.person_states[tid]

        frame_h, frame_w = frame_shape if frame_shape else (9999, 9999)
        margin = self.config.edge_margin_pixels

        for track_id, track in active_tracks.items():
            if not track.observations:
                continue

            current_obs = track.observations[-1]
            state_info = self.person_states.setdefault(track_id, {
                "state": "NORMAL",
                "fall_start_time": None,
                "progress": 0.0,
                "last_alert_time": -999.0,
                "confidence": 0.0,
                "metrics": {}
            })

            x1, y1, x2, y2 = current_obs.box
            
            # Boundary clip check: Ignore false triggers when person is partially clipped at borders without established history
            is_touching_edge = (x1 <= margin or y1 <= margin or x2 >= frame_w - margin or y2 >= frame_h - margin)
            if is_touching_edge and len(track.observations) < 5:
                state_info["state"] = "NORMAL"
                state_info["fall_start_time"] = None
                state_info["progress"] = 0.0
                continue

            in_cooldown = (current_time - state_info["last_alert_time"]) < self.config.cooldown_seconds

            # 1. Kinematic & Geometric Metrics
            aspect_ratio = current_obs.aspect_ratio
            height_drop_ratio = track.get_height_drop_ratio()
            downward_vy = track.get_vertical_drop_velocity(seconds=0.6)
            current_speed = track.get_mean_speed(seconds=0.5)

            standing_ar = track.standing_aspect_baseline or 0.45
            standing_h = track.standing_height_baseline or current_obs.height

            # Relative widening compared to individual's standing baseline
            ar_expansion = aspect_ratio / standing_ar if standing_ar > 0 else 1.0

            # 2. Multi-Signal Fallen Posture Evaluation
            # Condition A: Absolute horizontal posture (width >= height * threshold)
            cond_abs_horizontal = aspect_ratio >= self.config.aspect_ratio_threshold
            
            # Condition B: Relative posture shift (body widened >= 1.7x baseline AND height contracted >= 35%)
            cond_relative_collapse = (ar_expansion >= self.config.aspect_ratio_expansion_ratio and height_drop_ratio >= self.config.vertical_drop_ratio)
            
            # Condition C: Rapid downward descent followed by low horizontal posture
            cond_downward_drop = (downward_vy >= self.config.vertical_velocity_threshold and aspect_ratio >= 0.85)

            # Not sprinting away horizontally while upright
            is_grounded = current_speed <= self.config.immobility_speed_threshold or aspect_ratio >= 1.2

            is_fallen_candidate = (cond_abs_horizontal or cond_relative_collapse or cond_downward_drop) and is_grounded

            state_info["metrics"] = {
                "aspect_ratio": round(aspect_ratio, 2),
                "height_drop_ratio": round(height_drop_ratio, 2),
                "downward_vy": round(downward_vy, 1),
                "ar_expansion": round(ar_expansion, 2),
                "speed": round(current_speed, 1)
            }

            # 3. State Machine Transitions & Persistence Timing
            if is_fallen_candidate:
                if state_info["fall_start_time"] is None:
                    state_info["fall_start_time"] = current_time
                    state_info["state"] = "CHECKING"

                elapsed_fallen_duration = current_time - state_info["fall_start_time"]
                progress = min(1.0, elapsed_fallen_duration / max(0.01, self.config.persistence_seconds))
                state_info["progress"] = round(progress, 2)

                confidence = self._compute_confidence(
                    aspect_ratio=aspect_ratio,
                    ar_expansion=ar_expansion,
                    height_drop_ratio=height_drop_ratio,
                    downward_vy=downward_vy,
                    det_confidence=current_obs.confidence
                )
                state_info["confidence"] = confidence

                if elapsed_fallen_duration >= self.config.persistence_seconds:
                    state_info["state"] = "POTENTIAL_FALL"

                    if not in_cooldown and confidence >= self.config.confidence_threshold:
                        state_info["last_alert_time"] = current_time

                        event = BehaviourEvent.create(
                            event_type="fall",
                            person_ids=[track_id],
                            confidence=confidence,
                            severity="high",
                            video_time=current_time,
                            camera_id=self.camera_id,
                            location=self.location,
                            duration_seconds=elapsed_fallen_duration,
                            metadata={
                                "aspect_ratio": round(aspect_ratio, 2),
                                "ar_expansion": round(ar_expansion, 2),
                                "height_drop_ratio": round(height_drop_ratio, 2),
                                "downward_velocity": round(downward_vy, 1),
                                "posture": "horizontal" if cond_abs_horizontal else "collapsed"
                            }
                        )
                        events.append(event)
            else:
                # Restored upright posture resets checking state
                state_info["state"] = "NORMAL"
                state_info["fall_start_time"] = None
                state_info["progress"] = 0.0
                state_info["confidence"] = 0.0

        return events

    def _compute_confidence(
        self,
        aspect_ratio: float,
        ar_expansion: float,
        height_drop_ratio: float,
        downward_vy: float,
        det_confidence: float
    ) -> float:
        """Calculates calibrated multi-factor confidence (0.0 to 1.0) for fall detection."""
        # 1. Absolute AR score
        ar_score = min(1.0, max(0.0, (aspect_ratio - 0.75) / 0.60))

        # 2. Relative expansion score
        exp_score = min(1.0, max(0.0, (ar_expansion - 1.2) / 1.0))

        # 3. Height drop score
        drop_score = min(1.0, max(0.0, (height_drop_ratio - 0.20) / 0.40))

        # 4. Downward velocity contribution
        vel_score = min(1.0, max(0.0, downward_vy / 140.0))

        raw_confidence = (0.35 * ar_score) + (0.25 * exp_score) + (0.25 * drop_score) + (0.15 * vel_score)
        scaled_confidence = raw_confidence * (0.75 + 0.25 * det_confidence)
        return min(0.98, max(0.20, scaled_confidence))

    def get_state(self, track_id: int) -> Dict[str, Any]:
        """Returns the current fall detection state dictionary for a track ID."""
        return self.person_states.get(track_id, {"state": "NORMAL", "progress": 0.0, "confidence": 0.0, "metrics": {}})
