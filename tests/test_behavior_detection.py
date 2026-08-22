import os
import sys
import unittest

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import datetime
import numpy as np
from features.behavior_detection import (
    BehaviorProcessor,
    BehaviorConfig,
    FallConfig,
    MovementConfig,
    FightConfig,
    FallDetector,
    MovementAnalyzer,
    FightDetector,
    TrackHistoryManager,
    BehaviourEvent,
    get_event_timestamp,
    draw_behavior_overlay
)

class TestBehaviorDetection(unittest.TestCase):

    def setUp(self):
        self.history_mgr = TrackHistoryManager(history_seconds=3.0, max_frames=50)

    def test_track_history_kinematics(self):
        """Tests speed, acceleration, and aspect ratio calculations in TrackHistory."""
        # Frame 1 at t=0.0s: person at (100, 100) with box width 40, height 100
        box1 = (80, 50, 120, 150)
        self.history_mgr.update([{"track_id": 1, "box": box1, "confidence": 0.9}], current_time=0.0)

        track = self.history_mgr.get_track(1)
        self.assertIsNotNone(track)
        self.assertAlmostEqual(track.observations[-1].aspect_ratio, 40.0 / 100.0, places=2)

        # Frame 2 at t=0.1s: moved to (120, 100) -> distance = 20px, speed = 200 px/s
        box2 = (100, 50, 140, 150)
        self.history_mgr.update([{"track_id": 1, "box": box2, "confidence": 0.9}], current_time=0.1)
        
        self.assertAlmostEqual(track.observations[-1].speed, 200.0, places=1)
        self.assertGreater(track.get_mean_speed(seconds=1.0), 50.0)

    def test_fall_detection_trigger_and_persistence(self):
        """Tests that fall detector triggers when upright person drops and stays horizontal."""
        fall_cfg = FallConfig(
            aspect_ratio_threshold=1.0,
            vertical_drop_ratio=0.35,
            persistence_seconds=0.8,
            confidence_threshold=0.60
        )
        detector = FallDetector(config=fall_cfg)

        # 1. Simulate upright person for 0.5 seconds
        for i in range(5):
            t = i * 0.1
            box = (100, 50, 140, 150) # w=40, h=100 (aspect ratio = 0.4)
            self.history_mgr.update([{"track_id": 10, "box": box, "confidence": 0.95}], current_time=t)
            events = detector.update(self.history_mgr, current_time=t)
            self.assertEqual(len(events), 0)

        # 2. Sudden collapse to horizontal posture at t=0.6s: w=110, h=45 (aspect ratio = 2.44)
        fallen_box = (80, 120, 190, 165)
        self.history_mgr.update([{"track_id": 10, "box": fallen_box, "confidence": 0.95}], current_time=0.6)
        events = detector.update(self.history_mgr, current_time=0.6)
        # Not yet triggered due to persistence requirement
        self.assertEqual(len(events), 0)
        self.assertEqual(detector.get_state(10)["state"], "CHECKING")

        # 3. Person stays fallen for 0.9s (t=1.5s >= 0.6 + 0.8)
        events_after_persist = []
        for i in range(7, 16):
            t = i * 0.1
            self.history_mgr.update([{"track_id": 10, "box": fallen_box, "confidence": 0.95}], current_time=t)
            evs = detector.update(self.history_mgr, current_time=t)
            events_after_persist.extend(evs)

        self.assertGreaterEqual(len(events_after_persist), 1)
        fall_ev = events_after_persist[0]
        self.assertEqual(fall_ev.event_type, "fall")
        self.assertEqual(fall_ev.person_ids, [10])
        self.assertEqual(fall_ev.severity, "high")
        self.assertGreaterEqual(fall_ev.confidence, 0.60)

    def test_aggressive_movement_detection(self):
        """Tests that rapid erratic movement triggers aggressive movement alert."""
        mov_cfg = MovementConfig(
            speed_threshold=150.0,
            acceleration_threshold=200.0,
            direction_volatility_threshold=50.0,
            persistence_seconds=0.5,
            confidence_threshold=0.55
        )
        analyzer = MovementAnalyzer(config=mov_cfg)

        # Simulate erratic high-speed zig-zag motion
        events_collected = []
        cx, cy = 100, 100
        for i in range(10):
            t = i * 0.1
            # Rapid alternating direction
            dx = 30 if i % 2 == 0 else -30
            dy = 25 if i % 3 == 0 else -25
            cx += dx
            cy += dy
            box = (int(cx - 20), int(cy - 40), int(cx + 20), int(cy + 40))
            self.history_mgr.update([{"track_id": 5, "box": box, "confidence": 0.9}], current_time=t)
            evs = analyzer.update(self.history_mgr, current_time=t)
            events_collected.extend(evs)

        self.assertGreaterEqual(len(events_collected), 1)
        self.assertEqual(events_collected[0].event_type, "aggressive_movement")
        self.assertEqual(events_collected[0].person_ids, [5])

    def test_potential_fight_detection(self):
        """Tests that two converging, aggressively interacting individuals trigger fight alert."""
        fight_cfg = FightConfig(
            proximity_threshold=120.0,
            mutual_speed_threshold=100.0,
            persistence_seconds=0.6,
            confidence_threshold=0.60
        )
        fight_detector = FightDetector(config=fight_cfg)

        events_collected = []
        # Person 1 starts at x=100, Person 2 starts at x=180 (dist = 80px, in proximity)
        # Both move aggressively towards and around each other
        for i in range(10):
            t = i * 0.1
            # Rapid jitter / struggle motion
            p1_box = (100 + (15 if i % 2 == 0 else -15), 100, 140 + (15 if i % 2 == 0 else -15), 180)
            p2_box = (140 + (-15 if i % 2 == 0 else 15), 100, 180 + (-15 if i % 2 == 0 else 15), 180)

            self.history_mgr.update([
                {"track_id": 1, "box": p1_box, "confidence": 0.9},
                {"track_id": 2, "box": p2_box, "confidence": 0.9}
            ], current_time=t)

            evs = fight_detector.update(self.history_mgr, current_time=t)
            events_collected.extend(evs)

        self.assertGreaterEqual(len(events_collected), 1)
        fight_ev = events_collected[0]
        self.assertEqual(fight_ev.event_type, "potential_violent_activity")
        self.assertEqual(sorted(fight_ev.person_ids), [1, 2])
        self.assertEqual(fight_ev.severity, "high")

    def test_passing_by_does_not_trigger_fight(self):
        """Tests that two people peacefully walking past each other do NOT trigger a fight alert."""
        fight_cfg = FightConfig(
            proximity_threshold=100.0,
            mutual_speed_threshold=200.0,
            persistence_seconds=1.0
        )
        fight_detector = FightDetector(config=fight_cfg)

        events = []
        # Person 1 walks left to right, Person 2 walks right to left smoothly
        for i in range(10):
            t = i * 0.1
            p1_x = 50 + i * 20
            p2_x = 250 - i * 20
            p1_box = (p1_x, 100, p1_x + 30, 180)
            p2_box = (p2_x, 100, p2_x + 30, 180)

            self.history_mgr.update([
                {"track_id": 1, "box": p1_box, "confidence": 0.9},
                {"track_id": 2, "box": p2_box, "confidence": 0.9}
            ], current_time=t)

            evs = fight_detector.update(self.history_mgr, current_time=t)
            events.extend(evs)

        self.assertEqual(len(events), 0)

    def test_behavior_processor_unified_pipeline(self):
        """Tests end-to-end processing and summary generation in BehaviorProcessor."""
        processor = BehaviorProcessor()
        tracked = [
            {"track_id": 1, "box": (100, 100, 140, 200), "confidence": 0.92},
            {"track_id": 2, "box": (160, 100, 200, 200), "confidence": 0.88}
        ]
        output = processor.update(tracked, current_time=1.0)
        self.assertIn("new_events", output)
        self.assertIn("person_states", output)
        self.assertIn("pair_states", output)
        self.assertIn("summary", output)
        self.assertEqual(output["summary"]["total_persons"], 2)

    def test_draw_behavior_overlay(self):
        """Tests that HUD and overlay renderer executes without error."""
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        tracked = [{"track_id": 1, "box": (100, 100, 140, 200), "confidence": 0.92}]
        behavior_output = {
            "new_events": [],
            "active_events": [
                BehaviourEvent.create(
                    event_type="fall",
                    person_ids=[1],
                    confidence=0.85,
                    severity="high",
                    video_time=1.5
                )
            ],
            "person_states": {1: {"primary_state": "FALLEN", "confidence": 0.85}},
            "pair_states": {},
            "summary": {"total_persons": 1, "active_alerts_count": 1, "has_critical_event": True}
        }
        annotated = draw_behavior_overlay(frame, tracked, behavior_output)
        self.assertEqual(annotated.shape, (480, 640, 3))

    def test_hud_multi_resolution_and_modes(self):
        """Tests that the HUD renders properly across multiple video resolutions and UI modes."""
        resolutions = [(358, 444), (480, 640), (720, 1280), (1080, 1920)]
        tracked = [
            {"track_id": 1, "box": (50, 50, 90, 150), "confidence": 0.95},
            {"track_id": 2, "box": (120, 50, 160, 150), "confidence": 0.90}
        ]
        behavior_output = {
            "new_events": [],
            "active_events": [
                BehaviourEvent.create(
                    event_type="potential_violent_activity",
                    person_ids=[1, 2],
                    confidence=0.88,
                    severity="high",
                    video_time=5.2
                )
            ],
            "person_states": {
                1: {"primary_state": "AGGRESSIVE", "confidence": 0.76},
                2: {"primary_state": "NORMAL", "confidence": 0.0}
            },
            "pair_states": {(1, 2): {"state": "POTENTIAL_FIGHT", "confidence": 0.88}},
            "summary": {"total_persons": 2, "active_alerts_count": 1, "has_critical_event": True}
        }

        for h, w in resolutions:
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            # Test demo mode
            out_demo = draw_behavior_overlay(frame.copy(), tracked, behavior_output, current_time=6.0, ui_mode="demo", show_hud=True)
            self.assertEqual(out_demo.shape, (h, w, 3))
            # Test debug mode
            out_debug = draw_behavior_overlay(frame.copy(), tracked, behavior_output, current_time=6.0, ui_mode="debug", show_hud=True)
            self.assertEqual(out_debug.shape, (h, w, 3))

    def test_event_timestamp_arithmetic_and_formats(self):
        """Tests numeric timestamp arithmetic and defensive parsing of various timestamp formats."""
        # 1. Numeric timestamp arithmetic: current_time = 100.0, event.timestamp = 95.0 -> elapsed = 5.0
        ev = BehaviourEvent.create(
            event_type="aggressive_movement",
            person_ids=[17],
            confidence=0.87,
            severity="high",
            timestamp=95.0
        )
        self.assertIsInstance(ev.timestamp, float)
        self.assertEqual(ev.timestamp, 95.0)
        
        current_time = 100.0
        elapsed = current_time - ev.timestamp
        self.assertAlmostEqual(elapsed, 5.0)

        # 2. Defensive get_event_timestamp helper tests
        # Float
        self.assertEqual(get_event_timestamp(ev), 95.0)
        
        # ISO format string
        iso_str = "2026-08-22T15:28:01"
        ev_iso = BehaviourEvent.create(
            event_type="fall",
            person_ids=[8],
            confidence=0.89,
            severity="high",
            timestamp=iso_str
        )
        self.assertIsInstance(ev_iso.timestamp, float)
        self.assertGreater(ev_iso.timestamp, 0.0)

        # Video time string format "T+14.20s"
        ts_val = get_event_timestamp({"timestamp": "T+14.20s"})
        self.assertAlmostEqual(ts_val, 14.20)

        # Datetime object
        dt_now = datetime.datetime(2026, 8, 22, 12, 0, 0)
        ts_dt = get_event_timestamp({"timestamp": dt_now})
        self.assertEqual(ts_dt, dt_now.timestamp())

        # 3. Test draw_behavior_overlay handles events without TypeError
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        tracked = [{"track_id": 17, "box": (100, 100, 140, 200), "confidence": 0.92}]
        behavior_output = {
            "new_events": [],
            "active_events": [ev],
            "person_states": {17: {"primary_state": "AGGRESSIVE", "confidence": 0.87}},
            "pair_states": {},
            "summary": {"total_persons": 1, "active_alerts_count": 1, "has_critical_event": True}
        }
        annotated = draw_behavior_overlay(frame, tracked, behavior_output, current_time=current_time)
        self.assertEqual(annotated.shape, (480, 640, 3))

if __name__ == "__main__":
    unittest.main()
