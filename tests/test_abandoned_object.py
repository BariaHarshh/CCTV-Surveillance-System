"""
Automated Unit & Scenario Tests for Abandoned Object Detection Module
Verifies object tracking, movement smoothing, proximity analysis, unattended timer progression,
person return reset, event deduplication, object-specific rules, and UI overlay rendering.
"""

import os
import sys
import unittest
import numpy as np

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from features.abandoned_object import (
    AbandonedObjectConfig,
    ObjectRuleConfig,
    PotentialAbandonedObjectEvent,
    get_event_timestamp,
    ObjectTrack,
    ObjectTrackerManager,
    ProximityAnalyzer,
    AbandonedObjectProcessor,
    draw_abandoned_object_overlay
)

class TestAbandonedObjectDetection(unittest.TestCase):

    def setUp(self):
        self.config = AbandonedObjectConfig(
            stationary_threshold_px=10.0,
            stationary_window_seconds=1.0,
            person_proximity_threshold_px=100.0,
            stale_track_timeout_seconds=3.0,
            alert_cooldown_seconds=5.0,
            event_display_ttl=10.0,
            object_rules={
                "backpack": ObjectRuleConfig(unattended_seconds=3.0, risk_score=70, severity="high", display_name="BACKPACK"),
                "suitcase": ObjectRuleConfig(unattended_seconds=3.0, risk_score=80, severity="critical", display_name="SUITCASE"),
                "bottle": ObjectRuleConfig(unattended_seconds=6.0, risk_score=20, severity="low", display_name="BOTTLE")
            }
        )
        self.processor = AbandonedObjectProcessor(config=self.config)

    def test_1_object_tracking_and_observations(self):
        """Test 1: Object is detected, tracked, and observation history is properly bounded."""
        track = ObjectTrack(
            track_id=42,
            object_class="backpack",
            first_box=(100, 100, 150, 160),
            confidence=0.88,
            first_seen=0.0,
            max_history_seconds=10.0
        )
        self.assertEqual(track.track_id, 42)
        self.assertEqual(track.object_class, "backpack")
        self.assertEqual(len(track.observations), 1)

        # Add 5 observations
        for i in range(1, 6):
            track.add_observation((100 + i, 100 + i, 150 + i, 160 + i), 0.90, float(i))

        self.assertEqual(len(track.observations), 6)
        self.assertEqual(track.last_seen, 5.0)

    def test_2_moving_object_remains_moving(self):
        """Test 2: Continuously moving object has state MOVING and does not become stationary or unattended."""
        for i in range(10):
            t = i * 0.2
            obj_box = (100 + i * 20, 100, 140 + i * 20, 150)
            objects = [{"track_id": 1, "box": obj_box, "confidence": 0.85, "class_name": "backpack"}]
            persons = []

            out = self.processor.update(objects, persons, current_time=t)
            st = out["object_states"][1]["state"]
            self.assertEqual(st, "MOVING")
            self.assertEqual(len(out["new_events"]), 0)

    def test_3_stationary_attended_by_nearby_person(self):
        """Test 3: Stationary backpack with a person standing 40px away remains ATTENDED."""
        obj_box = (200, 200, 240, 250)
        # Person standing at (250, 150) -> distance to object is ~50px (< 100px proximity threshold)
        person_box = (250, 150, 290, 260)

        # Feed 10 frames over 2.0s
        for i in range(10):
            t = i * 0.2
            objects = [{"track_id": 10, "box": obj_box, "confidence": 0.90, "class_name": "backpack"}]
            persons = [{"track_id": 1, "box": person_box, "confidence": 0.92}]
            out = self.processor.update(objects, persons, current_time=t)

        st = out["object_states"][10]
        self.assertEqual(st["state"], "ATTENDED")
        self.assertIn(1, st["nearby_person_ids"])
        self.assertEqual(st["unattended_duration"], 0.0)
        self.assertEqual(len(out["new_events"]), 0)

    def test_4_stationary_unattended_timer_starts(self):
        """Test 4: Stationary backpack with no nearby person transitions to UNATTENDED and timer runs."""
        obj_box = (200, 200, 240, 250)

        # Feed frames over 1.6s (stationary confirmed after 1.0s, unattended timer runs for remaining 0.6s)
        for i in range(9):
            t = i * 0.2
            objects = [{"track_id": 10, "box": obj_box, "confidence": 0.90, "class_name": "backpack"}]
            out = self.processor.update(objects, [], current_time=t)

        st = out["object_states"][10]
        self.assertEqual(st["state"], "UNATTENDED")
        self.assertGreater(st["unattended_duration"], 0.0)

    def test_5_returning_person_resets_timer(self):
        """Test 5: Unattended object timer resets when a person returns within proximity."""
        obj_box = (200, 200, 240, 250)

        # 1. First 2.8s: becomes stationary at 1.0s, unattended for 1.8s
        for i in range(15):
            t = i * 0.2
            objects = [{"track_id": 10, "box": obj_box, "confidence": 0.90, "class_name": "backpack"}]
            out = self.processor.update(objects, [], current_time=t)

        self.assertEqual(out["object_states"][10]["state"], "UNATTENDED")
        self.assertGreater(out["object_states"][10]["unattended_duration"], 1.5)

        # 2. Person returns at t=3.0s
        person_box = (220, 180, 260, 280)
        out = self.processor.update(
            [{"track_id": 10, "box": obj_box, "confidence": 0.90, "class_name": "backpack"}],
            [{"track_id": 7, "box": person_box, "confidence": 0.95}],
            current_time=3.0
        )

        st = out["object_states"][10]
        self.assertEqual(st["state"], "ATTENDED")
        self.assertEqual(st["unattended_duration"], 0.0)
        self.assertEqual(len(out["new_events"]), 0)

    def test_6_unattended_threshold_triggers_event(self):
        """Test 6: Backpack left unattended beyond 3.0s threshold triggers POTENTIAL_ABANDONED event."""
        obj_box = (200, 200, 240, 250)

        events_collected = []
        # Run for 5.0 seconds (step = 0.5s): stationary at 1.0s, threshold 3.0s reached at 4.0s
        for i in range(11):
            t = i * 0.5
            objects = [{"track_id": 10, "box": obj_box, "confidence": 0.90, "class_name": "backpack"}]
            out = self.processor.update(objects, [], current_time=t)
            events_collected.extend(out["new_events"])

        # Event should be triggered once threshold is passed
        self.assertEqual(len(events_collected), 1)
        ev = events_collected[0]
        self.assertEqual(ev.event_type, "potential_abandoned_object")
        self.assertEqual(ev.object_id, 10)
        self.assertEqual(ev.object_class, "backpack")
        self.assertEqual(ev.severity, "high")
        self.assertGreaterEqual(ev.unattended_duration, 3.0)

    def test_7_event_deduplication(self):
        """Test 7: Event is emitted only once when threshold is reached; active_events persists without duplicate new_events."""
        obj_box = (200, 200, 240, 250)

        new_events_count = 0
        # Run 15 frames from t=0.0 to t=7.0s
        for i in range(15):
            t = i * 0.5
            objects = [{"track_id": 10, "box": obj_box, "confidence": 0.90, "class_name": "backpack"}]
            out = self.processor.update(objects, [], current_time=t)
            new_events_count += len(out["new_events"])
            if t >= 4.5:
                self.assertEqual(len(out["active_events"]), 1)

        # Deduplication ensures only 1 new_event was emitted during the run
        self.assertEqual(new_events_count, 1)

    def test_8_object_specific_rules_bottle_vs_suitcase(self):
        """Test 8: Bottle uses longer threshold (6.0s) and low severity; suitcase uses 3.0s and critical severity."""
        bottle_box = (100, 100, 120, 140)
        suitcase_box = (400, 400, 460, 470)

        # Run at t = 4.5s (stationary at 1.0s -> 3.5s unattended: suitcase triggered, bottle still UNATTENDED)
        for i in range(10):
            t = i * 0.5
            objects = [
                {"track_id": 1, "box": bottle_box, "confidence": 0.85, "class_name": "bottle"},
                {"track_id": 2, "box": suitcase_box, "confidence": 0.90, "class_name": "suitcase"}
            ]
            out = self.processor.update(objects, [], current_time=t)

        self.assertEqual(out["object_states"][1]["state"], "UNATTENDED")
        self.assertEqual(out["object_states"][2]["state"], "POTENTIAL_ABANDONED")

        # Suitcase event should have severity critical
        suitcase_events = [ev for ev in out["active_events"] if ev.object_class == "suitcase"]
        self.assertEqual(len(suitcase_events), 1)
        self.assertEqual(suitcase_events[0].severity, "critical")

    def test_9_stale_track_pruning(self):
        """Test 9: Lost object track is pruned after stale_track_timeout_seconds (3.0s)."""
        mgr = ObjectTrackerManager(stale_track_timeout_seconds=3.0)
        mgr.update([{"track_id": 1, "box": (10, 10, 50, 50), "confidence": 0.9, "class_name": "backpack"}], current_time=0.0)
        self.assertIn(1, mgr.get_all_tracks())

        # Advance time by 4.0s without observing track 1
        mgr.update([], current_time=4.0)
        self.assertNotIn(1, mgr.get_all_tracks())

    def test_10_numeric_timestamp_arithmetic(self):
        """Test 10: PotentialAbandonedObjectEvent uses float timestamps and supports safe arithmetic."""
        ev = PotentialAbandonedObjectEvent.create(
            object_id=42,
            object_class="backpack",
            confidence=0.88,
            severity="high",
            video_time=14.5,
            unattended_duration=15.2
        )
        self.assertIsInstance(ev.timestamp, float)
        self.assertEqual(ev.timestamp, 14.5)

        current_time = 20.0
        elapsed = current_time - ev.timestamp
        self.assertAlmostEqual(elapsed, 5.5)

        # Test defensive helper
        self.assertEqual(get_event_timestamp(ev), 14.5)
        self.assertAlmostEqual(get_event_timestamp({"timestamp": "T+14.50s"}), 14.5)

    def test_11_ui_overlay_rendering(self):
        """Test 11: HUD overlay renders properly across various resolutions without errors."""
        resolutions = [(358, 444), (480, 640), (720, 1280), (1080, 1920)]
        tracked_persons = [{"track_id": 1, "box": (100, 100, 150, 250), "confidence": 0.9}]
        ev = PotentialAbandonedObjectEvent.create(
            object_id=42,
            object_class="backpack",
            confidence=0.88,
            severity="high",
            video_time=15.0,
            unattended_duration=15.0
        )
        abandoned_output = {
            "new_events": [],
            "active_events": [ev],
            "event_history": [ev],
            "object_states": {
                42: {
                    "track_id": 42,
                    "object_class": "backpack",
                    "display_name": "BACKPACK",
                    "state": "POTENTIAL_ABANDONED",
                    "box": (200, 200, 250, 260),
                    "confidence": 0.88,
                    "stationary_duration": 18.0,
                    "unattended_duration": 15.0,
                    "required_seconds": 15.0,
                    "timer_progress": 1.0,
                    "nearby_person_ids": [],
                    "closest_person_id": 1,
                    "closest_person_distance": 180.0
                }
            },
            "summary": {"total_objects": 1, "unattended_count": 1, "abandoned_count": 1, "has_alert": True}
        }

        for h, w in resolutions:
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            annotated = draw_abandoned_object_overlay(frame, tracked_persons, abandoned_output, ui_mode="demo")
            self.assertEqual(annotated.shape, (h, w, 3))

    def test_12_prolonged_abandonment_staff_escalation(self):
        """Test 12: Object unattended for prolonged duration (e.g. 20s test threshold / 20m prod) escalates to area staff dispatch."""
        config = AbandonedObjectConfig(
            stationary_threshold_px=10.0,
            stationary_window_seconds=1.0,
            person_proximity_threshold_px=100.0,
            escalation_unattended_seconds=6.0,  # Calibrated for unit testing
            location="Campus Public Area",
            area_staff_directory={
                "Campus Public Area": {
                    "staff_name": "Officer R. Sharma",
                    "role": "Ground Floor Warden",
                    "contact": "Ext 402 / Radio Ch-3"
                }
            },
            object_rules={
                "backpack": ObjectRuleConfig(unattended_seconds=2.0, risk_score=70, severity="high", display_name="BACKPACK")
            }
        )
        processor = AbandonedObjectProcessor(config=config)
        obj_box = (150, 150, 200, 210)

        # 1. Feed frames from t=0.0 to t=8.0s
        # t=1.0s: stationary confirmed
        # t=3.0s: Tier-1 POTENTIAL_ABANDONED event (unattended >= 2.0s)
        # t=7.0s: Tier-2 PROLONGED_ABANDONED_ESCALATED event (unattended >= 6.0s)
        escalated_events = []
        for i in range(16):
            t = i * 0.5
            out = processor.update(
                [{"track_id": 99, "box": obj_box, "confidence": 0.92, "class_name": "backpack"}],
                [],
                current_time=t
            )
            for ev in out["new_events"]:
                if ev.is_escalated:
                    escalated_events.append(ev)

        # Assertions
        self.assertEqual(len(escalated_events), 1)
        esc_ev = escalated_events[0]
        self.assertTrue(esc_ev.is_escalated)
        self.assertEqual(esc_ev.event_type, "prolonged_abandoned_object_escalation")
        self.assertEqual(esc_ev.assigned_staff_name, "Officer R. Sharma")
        self.assertEqual(esc_ev.assigned_staff_role, "Ground Floor Warden")
        self.assertEqual(esc_ev.assigned_staff_contact, "Ext 402 / Radio Ch-3")
        self.assertEqual(esc_ev.escalation_status, "STAFF_ALERT_TRANSMITTED")
        self.assertEqual(esc_ev.severity, "critical")
        self.assertIn("CRITICAL ESCALATION", esc_ev.get_display_title())

    def test_13_area_staff_directory_fallback(self):
        """Test 13: Area staff directory correctly resolves specific locations and provides fallback."""
        config = AbandonedObjectConfig()
        
        # Known location
        staff_lib = config.get_staff_for_location("Library 2nd Floor")
        self.assertEqual(staff_lib["staff_name"], "Anita Desai")
        self.assertEqual(staff_lib["role"], "Library Supervisor")

        # Unknown location -> fallback to default security officer
        staff_unknown = config.get_staff_for_location("Unknown Warehouse Annex")
        self.assertEqual(staff_unknown["staff_name"], "Area Duty Officer")

if __name__ == "__main__":
    unittest.main()
