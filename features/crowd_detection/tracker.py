"""
Count Stabilizer Tracker for Crowd Detection Feature
Applies short-term smoothing and detection-loss tolerance to raw person counts.
"""

from collections import deque
import time
import config.config as config

class CountStabilizer:
    """
    Stabilizes raw frame-by-frame person counts.
    Combines rolling window median smoothing with time-based drop confirmation.
    """
    def __init__(self, window_size=None, drop_confirmation_seconds=None):
        self.window_size = window_size or config.COUNT_SMOOTHING_WINDOW
        self.drop_confirmation_seconds = drop_confirmation_seconds or config.COUNT_DROP_CONFIRMATION_SECONDS

        self.history = deque(maxlen=self.window_size)
        self.stable_count = 0
        self.drop_start_time = None

    def update(self, raw_count):
        """
        Updates the stabilizer with the latest raw frame count and returns the STABLE_COUNT.
        """
        current_time = time.time()
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
                self.drop_start_time = current_time

            elapsed_drop_time = current_time - self.drop_start_time

            if elapsed_drop_time >= self.drop_confirmation_seconds:
                self.stable_count = min(median_candidate, raw_count)
                self.drop_start_time = None
        else:
            self.drop_start_time = None

        return self.stable_count
