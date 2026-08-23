"""
Automated Unit & Scenario Tests for Restricted Area Detection Module
Verifies polygon ROI geometry, intrusion state machine, persistence, multi-anchor inspection, and deduplication.
"""

import os
import sys
import unittest
import numpy as np

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from features.restricted_area import (
    RestrictedZone,
    ZoneManager,
    IntrusionTracker,
    RestrictedAreaProcessor,
    RestrictedAreaEvent
)

class TestRestrictedAreaDetection(unittest.TestCase):

    def setUp(self):
        self.zone_configs = [
            {
                "name": "TEST LAB ZONE",
                "enabled": True,
                "severity": "high",
                "points": [[100, 100], [400, 100], [400, 400], [100, 400]]
            }
        ]
        self.processor = RestrictedAreaProcessor(
            zone_configs=self.zone_configs,
            confirmation_seconds=0.5,
            cooldown_seconds=5.0
        )

    def test_1_person_outside_zone(self):
        """Test 1: Person walks outside restricted zone -> Expect SECURE, 0 active intruders, no events."""
        persons = [{"track_id": 1, "box": (10, 10, 50, 80), "confidence": 0.9}]
        output = self.processor.update(persons, current_time=0.0)

        self.assertEqual(output["summary"]["status"], "SECURE")
        self.assertEqual(output["summary"]["active_intruders_count"], 0)
        self.assertEqual(len(output["new_events"]), 0)

    def test_2_person_enters_zone(self):
        """Test 2: Person enters restricted zone and stays -> Expect OUTSIDE -> CHECKING -> INSIDE breach event."""
        # Person feet/center inside [100, 100] -> [400, 400]
        persons = [{"track_id": 1, "box": (180, 150, 220, 250), "confidence": 0.9}]

        # Frame 1 at t=0.0s: State -> CHECKING
        out1 = self.processor.update(persons, current_time=0.0)
        self.assertEqual(len(out1["new_events"]), 0)

        # Frame 2 at t=0.6s (>= 0.5s confirmation threshold): State -> INSIDE (Breach Event)
        out2 = self.processor.update(persons, current_time=0.6)
        self.assertEqual(len(out2["new_events"]), 1)
        self.assertEqual(out2["new_events"][0].event_type, "zone_breach")
        self.assertEqual(out2["summary"]["status"], "ALERT")

    def test_3_person_stays_inside_deduplication(self):
        """Test 3: Person stays inside -> Expect 1 active intrusion, NO repeated new events every frame."""
        persons = [{"track_id": 1, "box": (180, 150, 220, 250), "confidence": 0.9}]

        # Enter zone at t=0.0s and confirm at t=0.6s
        self.processor.update(persons, current_time=0.0)
        self.processor.update(persons, current_time=0.6)

        # Stay inside for next 5 frames (t=0.7s to t=1.2s)
        for t_step in [0.7, 0.8, 0.9, 1.0, 1.1, 1.2]:
            out = self.processor.update(persons, current_time=t_step)
            self.assertEqual(len(out["new_events"]), 0)  # No repeated event spam
            self.assertEqual(out["summary"]["active_intruders_count"], 1)
            self.assertEqual(out["summary"]["status"], "ALERT")

    def test_4_person_exits_zone(self):
        """Test 4: Person exits zone -> Expect INSIDE -> EXITED -> OUTSIDE transition."""
        inside_person = [{"track_id": 1, "box": (180, 150, 220, 250), "confidence": 0.9}]
        outside_person = [{"track_id": 1, "box": (10, 10, 50, 80), "confidence": 0.9}]

        # Breach zone
        self.processor.update(inside_person, current_time=0.0)
        self.processor.update(inside_person, current_time=0.6)

        # Step outside at t=1.5s
        out_exit = self.processor.update(outside_person, current_time=1.5)
        self.assertEqual(len(out_exit["new_events"]), 1)
        self.assertEqual(out_exit["new_events"][0].event_type, "zone_exit")
        self.assertEqual(out_exit["summary"]["status"], "SECURE")
        self.assertEqual(out_exit["summary"]["active_intruders_count"], 0)

    def test_5_multiple_people_enter(self):
        """Test 5: Multiple people enter zone -> Expect correct intruder count."""
        p1 = {"track_id": 1, "box": (180, 150, 220, 250), "confidence": 0.9}
        p2 = {"track_id": 2, "box": (250, 200, 300, 350), "confidence": 0.85}
        p3 = {"track_id": 3, "box": (10, 10, 50, 80), "confidence": 0.95}

        persons = [p1, p2, p3]

        self.processor.update(persons, current_time=0.0)
        out = self.processor.update(persons, current_time=0.6)

        self.assertEqual(out["summary"]["active_intruders_count"], 2)
        self.assertEqual(set(out["active_intruders"]), {1, 2})
        self.assertEqual(out["summary"]["status"], "ALERT")

    def test_6_brief_boundary_touch_persistence(self):
        """Test 6: Person briefly touches zone for 0.1s and steps back -> Persistence logic prevents alert."""
        inside_person = [{"track_id": 1, "box": (180, 150, 220, 250), "confidence": 0.9}]
        outside_person = [{"track_id": 1, "box": (10, 10, 50, 80), "confidence": 0.9}]

        # Touch zone at t=0.0s (CHECKING state)
        out1 = self.processor.update(inside_person, current_time=0.0)
        self.assertEqual(len(out1["new_events"]), 0)

        # Step back outside at t=0.2s (< 0.5s confirmation threshold)
        out2 = self.processor.update(outside_person, current_time=0.2)
        self.assertEqual(len(out2["new_events"]), 0)
        self.assertEqual(out2["summary"]["status"], "SECURE")
        self.assertEqual(out2["summary"]["active_intruders_count"], 0)

    def test_7_temporary_detection_loss(self):
        """Test 7: Temporary tracking loss -> Grace period holds state, exits after memory duration (1.5s)."""
        inside_person = [{"track_id": 1, "box": (180, 150, 220, 250), "confidence": 0.9}]

        # Breach zone at t=0.0s and confirm at t=0.6s
        self.processor.update(inside_person, current_time=0.0)
        self.processor.update(inside_person, current_time=0.6)

        # Track disappears for 0.4s at t=1.0s -> Held in memory grace period
        out_loss1 = self.processor.update([], current_time=1.0)
        self.assertEqual(len(out_loss1["new_events"]), 0)

        # Track remains missing past 1.5s memory duration at t=2.5s -> Emit zone exit event
        out_loss2 = self.processor.update([], current_time=2.5)
        self.assertEqual(len(out_loss2["new_events"]), 1)
        self.assertEqual(out_loss2["new_events"][0].event_type, "zone_exit")

if __name__ == "__main__":
    unittest.main()
