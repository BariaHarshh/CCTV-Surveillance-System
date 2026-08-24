"""
AI Campus Guard - Abandoned Object Track History & Motion Tracker Module
Maintains temporal observations, jitter-resistant movement smoothing, and state tracking for individual objects.
"""

from dataclasses import dataclass
from collections import deque
from typing import List, Tuple, Dict, Optional, Any
import math

@dataclass
class ObjectTrackObservation:
    """A single-frame observation record for a tracked object."""
    timestamp: float                    # Video timeline or Unix timestamp in seconds
    box: Tuple[int, int, int, int]      # Bounding box (x1, y1, x2, y2)
    center: Tuple[float, float]         # Center coordinates (cx, cy)
    width: float                        # Bounding box width
    height: float                       # Bounding box height
    confidence: float                   # Detection confidence score

class ObjectTrack:
    """
    Temporal tracking history and state machine for a single detected object.
    """
    def __init__(
        self,
        track_id: int,
        object_class: str,
        first_box: Tuple[int, int, int, int],
        confidence: float,
        first_seen: float,
        max_history_seconds: float = 60.0
    ):
        self.track_id = track_id
        self.object_class = object_class.lower()
        self.first_seen = first_seen
        self.last_seen = first_seen
        self.max_history_seconds = max_history_seconds

        # Bounded temporal observation deque (approx 30 FPS * 60s = 1800 entries max)
        self.observations: deque[ObjectTrackObservation] = deque(maxlen=int(max_history_seconds * 30))

        # State Machine Variables
        # States: 'NEW', 'MOVING', 'STATIONARY', 'ATTENDED', 'UNATTENDED', 'POTENTIAL_ABANDONED', 'PROLONGED_ABANDONED_ESCALATED'
        self.state: str = "NEW"
        self.stationary_since: Optional[float] = None
        self.unattended_since: Optional[float] = None
        self.last_alert_time: float = -999.0
        self.is_escalated: bool = False
        self.last_escalation_time: float = -999.0

        # Proximity Metrics
        self.nearby_person_ids: List[int] = []
        self.closest_person_id: Optional[int] = None
        self.closest_person_dist: Optional[float] = None

        # Add initial observation
        self.add_observation(first_box, confidence, first_seen)

    def add_observation(
        self,
        box: Tuple[int, int, int, int],
        confidence: float,
        timestamp: float
    ) -> ObjectTrackObservation:
        """Appends a new observation to this object track."""
        x1, y1, x2, y2 = box
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        w = float(max(1, x2 - x1))
        h = float(max(1, y2 - y1))

        obs = ObjectTrackObservation(
            timestamp=timestamp,
            box=box,
            center=(cx, cy),
            width=w,
            height=h,
            confidence=confidence
        )

        self.last_seen = timestamp
        self.observations.append(obs)
        return obs

    def get_recent_observations(self, seconds: float) -> List[ObjectTrackObservation]:
        """Returns observations within the last `seconds` duration."""
        if not self.observations:
            return []
        cutoff = self.last_seen - seconds
        return [obs for obs in self.observations if obs.timestamp >= cutoff]

    def get_smoothed_center(self, count: int = 5) -> Tuple[float, float]:
        """
        Returns average center coordinate over recent observations to eliminate detection jitter.
        """
        if not self.observations:
            return (0.0, 0.0)
        recent = list(self.observations)[-count:]
        avg_x = sum(obs.center[0] for obs in recent) / len(recent)
        avg_y = sum(obs.center[1] for obs in recent) / len(recent)
        return (avg_x, avg_y)

    def get_displacement(self, window_seconds: float = 2.0) -> float:
        """
        Calculates maximum spatial displacement (in pixels) over the specified time window.
        """
        recent = self.get_recent_observations(window_seconds)
        if len(recent) < 2:
            return 0.0

        current_center = recent[-1].center
        max_disp = 0.0
        for obs in recent[:-1]:
            dx = current_center[0] - obs.center[0]
            dy = current_center[1] - obs.center[1]
            disp = math.sqrt(dx * dx + dy * dy)
            if disp > max_disp:
                max_disp = disp

        return max_disp

    def is_stationary(self, threshold_px: float = 14.0, window_seconds: float = 2.0) -> bool:
        """
        Determines whether the object has remained stationary within the threshold displacement
        for at least `window_seconds`.
        """
        if (self.last_seen - self.first_seen) < window_seconds:
            return False

        disp = self.get_displacement(window_seconds)
        return disp <= threshold_px

class ObjectTrackerManager:
    """
    Manages active object tracking histories, performs temporal pruning, and coordinates state updates.
    """
    def __init__(
        self,
        stale_track_timeout_seconds: float = 5.0,
        max_history_seconds: float = 60.0
    ):
        self.stale_track_timeout_seconds = stale_track_timeout_seconds
        self.max_history_seconds = max_history_seconds
        self.tracks: Dict[int, ObjectTrack] = {}

    def update(
        self,
        tracked_objects: List[Dict[str, Any]],
        current_time: float
    ) -> Dict[int, ObjectTrack]:
        """
        Updates tracking histories with newly detected objects and prunes stale tracks.

        Args:
            tracked_objects: List of dicts with keys {'track_id', 'box', 'confidence', 'class_name'}
            current_time: Current timestamp in seconds

        Returns:
            Dict mapping active track_id -> ObjectTrack
        """
        seen_track_ids = set()

        for det in tracked_objects:
            tid = det.get("track_id")
            if tid is None:
                continue

            box = det["box"]
            conf = det.get("confidence", 0.8)
            cls_name = det.get("class_name", "object")

            if tid not in self.tracks:
                self.tracks[tid] = ObjectTrack(
                    track_id=tid,
                    object_class=cls_name,
                    first_box=box,
                    confidence=conf,
                    first_seen=current_time,
                    max_history_seconds=self.max_history_seconds
                )
            else:
                self.tracks[tid].add_observation(box, conf, current_time)

            seen_track_ids.add(tid)

        # Prune stale tracks that have not been observed within timeout
        stale_ids = [
            tid for tid, track in self.tracks.items()
            if (current_time - track.last_seen) > self.stale_track_timeout_seconds
        ]
        for tid in stale_ids:
            del self.tracks[tid]

        return self.tracks

    def get_track(self, track_id: int) -> Optional[ObjectTrack]:
        """Returns specific track by ID."""
        return self.tracks.get(track_id)

    def get_all_tracks(self) -> Dict[int, ObjectTrack]:
        """Returns all currently active tracks."""
        return self.tracks
