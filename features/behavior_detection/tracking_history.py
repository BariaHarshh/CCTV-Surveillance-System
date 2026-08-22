"""
AI Campus Guard - Temporal Track History Buffer
Maintains sliding-window kinematic and geometric observations for every tracked person.
"""

from collections import deque
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional, Any
import math
import numpy as np

@dataclass
class TrackObservation:
    """Single-frame snapshot of a tracked individual's kinematics and geometry."""
    timestamp: float                    # Time in seconds (video timeline or time.time())
    box: Tuple[int, int, int, int]      # (x1, y1, x2, y2)
    center: Tuple[float, float]         # (cx, cy)
    width: float                        # Bounding box width
    height: float                       # Bounding box height
    aspect_ratio: float                 # width / height
    confidence: float                   # YOLO detection confidence
    vx: float = 0.0                     # Horizontal velocity (pixels/sec)
    vy: float = 0.0                     # Vertical velocity (pixels/sec, positive downwards)
    speed: float = 0.0                  # Scalar speed (pixels/sec)
    acceleration: float = 0.0           # Acceleration magnitude (pixels/sec^2)
    heading_deg: Optional[float] = None # Direction of motion in degrees [-180, 180]

class TrackHistory:
    """
    Maintains chronological observations and calculated metrics for a single track ID.
    """
    def __init__(self, track_id: int, max_frames: int = 75, history_seconds: float = 3.0):
        self.track_id = track_id
        self.max_frames = max_frames
        self.history_seconds = history_seconds
        self.observations: deque[TrackObservation] = deque(maxlen=max_frames)
        
        self.first_seen_time: float = 0.0
        self.last_seen_time: float = 0.0
        
        # Baselines for posture comparisons
        self.standing_height_baseline: Optional[float] = None
        self.standing_aspect_baseline: Optional[float] = None

    def add_observation(self, box: Tuple[int, int, int, int], confidence: float, timestamp: float) -> TrackObservation:
        """Computes kinematics from the previous observation and appends new snapshot."""
        x1, y1, x2, y2 = box
        w = max(1.0, float(x2 - x1))
        h = max(1.0, float(y2 - y1))
        cx = float(x1 + x2) / 2.0
        cy = float(y1 + y2) / 2.0
        aspect_ratio = w / h

        if not self.observations:
            self.first_seen_time = timestamp
            obs = TrackObservation(
                timestamp=timestamp,
                box=box,
                center=(cx, cy),
                width=w,
                height=h,
                aspect_ratio=aspect_ratio,
                confidence=confidence,
                vx=0.0,
                vy=0.0,
                speed=0.0,
                acceleration=0.0,
                heading_deg=None
            )
            # Initialize standing posture baselines
            self.standing_height_baseline = h
            self.standing_aspect_baseline = aspect_ratio
        else:
            prev = self.observations[-1]
            dt = max(0.001, timestamp - prev.timestamp)
            
            dx = cx - prev.center[0]
            dy = cy - prev.center[1]
            
            vx = dx / dt
            vy = dy / dt
            speed = math.sqrt(vx * vx + vy * vy)
            
            # Acceleration = delta_speed / dt
            dv = speed - prev.speed
            acceleration = abs(dv / dt)
            
            # Heading angle (in degrees) if speed is substantial (> 10 px/s)
            heading = math.degrees(math.atan2(dy, dx)) if speed > 10.0 else prev.heading_deg

            obs = TrackObservation(
                timestamp=timestamp,
                box=box,
                center=(cx, cy),
                width=w,
                height=h,
                aspect_ratio=aspect_ratio,
                confidence=confidence,
                vx=vx,
                vy=vy,
                speed=speed,
                acceleration=acceleration,
                heading_deg=heading
            )

            # Update standing posture baselines when person is moving normally upright
            if aspect_ratio < 0.8 and h > 40.0:
                if self.standing_height_baseline is None:
                    self.standing_height_baseline = h
                    self.standing_aspect_baseline = aspect_ratio
                else:
                    # Slow exponential moving average for standing baseline
                    self.standing_height_baseline = 0.95 * self.standing_height_baseline + 0.05 * h
                    self.standing_aspect_baseline = 0.95 * self.standing_aspect_baseline + 0.05 * aspect_ratio

        self.last_seen_time = timestamp
        self.observations.append(obs)
        return obs

    def get_recent_observations(self, seconds: float) -> List[TrackObservation]:
        """Returns observations within the last `seconds` duration."""
        if not self.observations:
            return []
        cutoff = self.last_seen_time - seconds
        return [obs for obs in self.observations if obs.timestamp >= cutoff]

    def get_mean_speed(self, seconds: float = 1.0) -> float:
        """Returns average speed over the specified recent window."""
        recent = self.get_recent_observations(seconds)
        if not recent:
            return 0.0
        speeds = [obs.speed for obs in recent]
        return sum(speeds) / len(speeds)

    def get_max_speed(self, seconds: float = 1.0) -> float:
        """Returns peak speed over the specified recent window."""
        recent = self.get_recent_observations(seconds)
        if not recent:
            return 0.0
        return max(obs.speed for obs in recent)

    def get_mean_acceleration(self, seconds: float = 1.0) -> float:
        """Returns average acceleration over the specified recent window."""
        recent = self.get_recent_observations(seconds)
        if not recent:
            return 0.0
        accels = [obs.acceleration for obs in recent]
        return sum(accels) / len(accels)

    def get_max_acceleration(self, seconds: float = 1.0) -> float:
        """Returns peak acceleration over the specified recent window."""
        recent = self.get_recent_observations(seconds)
        if not recent:
            return 0.0
        return max(obs.acceleration for obs in recent)

    def get_direction_volatility(self, seconds: float = 1.2) -> float:
        """
        Calculates the angular volatility (heading deviation in degrees) over recent observations.
        """
        recent = self.get_recent_observations(seconds)
        headings = [obs.heading_deg for obs in recent if obs.heading_deg is not None]
        if len(headings) < 3:
            return 0.0
        
        diffs = []
        for i in range(1, len(headings)):
            d = abs(headings[i] - headings[i-1])
            if d > 180.0:
                d = 360.0 - d
            diffs.append(d)
        
        return (sum(diffs) / len(diffs)) if diffs else 0.0

    def get_height_drop_ratio(self) -> float:
        """Calculates relative height reduction compared to standing baseline."""
        if not self.observations or self.standing_height_baseline is None or self.standing_height_baseline <= 0:
            return 0.0
        current_h = self.observations[-1].height
        drop = max(0.0, self.standing_height_baseline - current_h)
        return float(drop / self.standing_height_baseline)

    def get_vertical_drop_velocity(self, seconds: float = 0.5) -> float:
        """Returns peak positive downward vertical velocity over recent window."""
        recent = self.get_recent_observations(seconds)
        if not recent:
            return 0.0
        downward_vy = [obs.vy for obs in recent if obs.vy > 0]
        return float(np.max(downward_vy)) if downward_vy else 0.0

class TrackHistoryManager:
    """
    Central manager for tracking histories of all persons in the scene.
    """
    def __init__(self, history_seconds: float = 3.0, max_frames: int = 75, inactivity_timeout: float = 2.0):
        self.history_seconds = history_seconds
        self.max_frames = max_frames
        self.inactivity_timeout = inactivity_timeout
        self.tracks: Dict[int, TrackHistory] = {}

    def update(self, tracked_persons: List[Dict[str, Any]], current_time: float) -> Dict[int, TrackObservation]:
        """
        Updates tracking history with new detections in the current frame.
        
        Args:
            tracked_persons: List of dicts [{'track_id': int, 'box': (x1, y1, x2, y2), 'confidence': float}, ...]
            current_time: Current timestamp in seconds.
            
        Returns:
            Dict[track_id -> current TrackObservation]
        """
        current_observations = {}
        for item in tracked_persons:
            track_id = item.get("track_id")
            if track_id is None:
                continue
            
            box = item["box"]
            confidence = item.get("confidence", 1.0)
            
            if track_id not in self.tracks:
                self.tracks[track_id] = TrackHistory(
                    track_id=track_id,
                    max_frames=self.max_frames,
                    history_seconds=self.history_seconds
                )
            
            obs = self.tracks[track_id].add_observation(box, confidence, current_time)
            current_observations[track_id] = obs

        # Prune stale tracks that have left the scene
        self.cleanup_stale(current_time)
        return current_observations

    def cleanup_stale(self, current_time: float):
        """Removes tracks that haven't been observed for longer than inactivity_timeout."""
        stale_ids = [
            tid for tid, th in self.tracks.items()
            if (current_time - th.last_seen_time) > self.inactivity_timeout
        ]
        for tid in stale_ids:
            del self.tracks[tid]

    def get_track(self, track_id: int) -> Optional[TrackHistory]:
        """Retrieves history for a specific track ID."""
        return self.tracks.get(track_id)

    def get_active_tracks(self) -> Dict[int, TrackHistory]:
        """Returns all currently maintained track histories."""
        return self.tracks
