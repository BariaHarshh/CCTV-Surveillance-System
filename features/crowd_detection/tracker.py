"""
Count Stabilizer Tracker for Crowd Detection Feature
Applies FPS-aware short-term smoothing and detection-loss tolerance to raw person counts.
"""

from collections import deque
import time
import config.config as config

class CountStabilizer:
    """
    Stabilizes raw frame-by-frame person counts.
    Combines rolling window median smoothing with time-based drop confirmation.
    Supports FPS-based adaptive window sizing and video timeline timestamps.
    """
    def __init__(self, window_size=None, drop_confirmation_seconds=None, fps=None):
        if fps and fps > 0 and window_size is None:
            # Adaptive window: 0.5 seconds of video history at current FPS
            self.window_size = max(5, int(fps * 0.5))
        else:
            self.window_size = window_size or config.COUNT_SMOOTHING_WINDOW

        self.drop_confirmation_seconds = drop_confirmation_seconds or config.COUNT_DROP_CONFIRMATION_SECONDS

        self.history = deque(maxlen=self.window_size)
        self.stable_count = 0
        self.drop_start_time = None

    def update(self, raw_count, current_time=None):
        """
        Updates the stabilizer with the latest raw frame count and returns the STABLE_COUNT.

        Args:
            raw_count (int): The current frame's raw tracked person count.
            current_time (float, optional): Current video timestamp in seconds (frame_index / fps).
                                             If None, wall-clock time.time() is used.

        Returns:
            int: The calculated STABLE_COUNT.
        """
        now = current_time if current_time is not None else time.time()
        self.history.append(raw_count)

        sorted_counts = sorted(self.history)
        n = len(sorted_counts)
        median_candidate = sorted_counts[n // 2]
        rolling_max = max(self.history)

        if len(self.history) == 1:
            self.stable_count = raw_count
            return self.stable_count

        if raw_count > self.stable_count:
            if median_candidate > self.stable_count or raw_count >= rolling_max:
                self.stable_count = raw_count
                self.drop_start_time = None

        elif raw_count < self.stable_count:
            if self.drop_start_time is None:
                self.drop_start_time = now

            elapsed_drop_time = now - self.drop_start_time

            if elapsed_drop_time >= self.drop_confirmation_seconds:
                self.stable_count = min(median_candidate, raw_count)
                self.drop_start_time = None
        else:
            self.drop_start_time = None

        return self.stable_count
