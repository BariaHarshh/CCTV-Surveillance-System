"""
Crowd Detector Processor
Handles time-based crowd detection logic given a stabilized person count.
Supports video timeline timestamps (frame_index / fps) for deterministic crowd detection.
"""

import time
import config.config as config

class CrowdDetector:
    """
    Stateful Crowd Detector.
    Monitors person count against PERSON_THRESHOLD and ensures the count
    is sustained continuously for PERSISTENCE_SECONDS before triggering a crowd alert.
    """
    def __init__(self, person_threshold=None, persistence_seconds=None):
        self.person_threshold = person_threshold or config.PERSON_THRESHOLD
        self.persistence_seconds = persistence_seconds or config.PERSISTENCE_SECONDS

        self.start_time = None
        self.crowd_detected = False
        self.status = "NORMAL"

    def update(self, person_count, current_time=None):
        """
        Updates the crowd detector state with the current person count.

        Args:
            person_count (int): Current stable person count.
            current_time (float, optional): Current video timestamp in seconds (frame_index / fps).
                                             If None, wall-clock time.time() is used.
        """
        now = current_time if current_time is not None else time.time()

        if person_count > self.person_threshold:
            if self.start_time is None:
                self.start_time = now
                self.status = "CHECKING CROWD"
                print(f"[INFO] Person count ({person_count}) > threshold ({self.person_threshold}). Starting persistence check...")

            elapsed = now - self.start_time
            progress = min(elapsed, float(self.persistence_seconds))

            if elapsed >= self.persistence_seconds:
                if not self.crowd_detected:
                    self.crowd_detected = True
                    print(f"[ALERT] CROWD DETECTED! Threshold ({self.person_threshold}) sustained for {elapsed:.1f}s.")
                self.status = "CROWD DETECTED"
                progress = float(self.persistence_seconds)

        else:
            if self.crowd_detected:
                print(f"[INFO] Crowd resolved. Person count ({person_count}) dropped to or below threshold ({self.person_threshold}).")
            elif self.start_time is not None:
                print(f"[INFO] Crowd check reset. Person count ({person_count}) dropped before {self.persistence_seconds}s completed.")

            self.start_time = None
            self.crowd_detected = False
            self.status = "NORMAL"
            progress = 0.0

        return {
            "person_count": person_count,
            "threshold": self.person_threshold,
            "crowd_detected": self.crowd_detected,
            "confirmation_progress_seconds": round(progress, 1),
            "required_persistence_seconds": float(self.persistence_seconds),
            "status": self.status
        }
