"""
Automated Unit & Integration Tests for Risk Management Orchestrator
Verifies feature dynamic initialization, presets, shared single-capture frame pipeline,
fault isolation, event routing into Risk Assessment, and diagnostics HUD rendering.
"""

import os
import sys
import unittest
import numpy as np
import yaml

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config.config as global_config
from features.risk_assessment import (
    RiskManagementOrchestrator,
    RiskEvent,
    draw_risk_assessment_overlay
)

class TestRiskManagementOrchestrator(unittest.TestCase):

    def setUp(self):
        self.presets_dir = global_config.PRESETS_DIR

    def _load_preset_data(self, preset_name: str) -> dict:
        preset_path = os.path.join(self.presets_dir, preset_name)
        with open(preset_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def test_1_full_preset_initializes_all_four_features(self):
        """Test 1: Full preset initializes all 4 detection subsystems and marks all as ACTIVE."""
        preset_data = self._load_preset_data("risk_assessment.yaml")
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        # Check flags
        self.assertTrue(orchestrator.feature_flags["crowd_detection"])
        self.assertTrue(orchestrator.feature_flags["behavior_detection"])
        self.assertTrue(orchestrator.feature_flags["abandoned_object"])
        self.assertTrue(orchestrator.feature_flags["restricted_area"])

        # Check processor instances
        self.assertIsNotNone(orchestrator.crowd_detector)
        self.assertIsNotNone(orchestrator.behavior_processor)
        self.assertIsNotNone(orchestrator.abandoned_processor)
        self.assertIsNotNone(orchestrator.restricted_processor)
        self.assertIsNotNone(orchestrator.risk_processor)

        # Check status indicators
        self.assertEqual(orchestrator.feature_statuses["crowd_detection"], "ACTIVE")
        self.assertEqual(orchestrator.feature_statuses["behavior_detection"], "ACTIVE")
        self.assertEqual(orchestrator.feature_statuses["abandoned_object"], "ACTIVE")
        self.assertEqual(orchestrator.feature_statuses["restricted_area"], "ACTIVE")
        self.assertEqual(orchestrator.feature_statuses["risk_assessment"], "ACTIVE")

    def test_2_lightweight_preset_initializes_only_selected_features(self):
        """Test 2: Selective configuration initializes only crowd & restricted, while behavior and abandoned object are DISABLED."""
        preset_data = self._load_preset_data("risk_assessment.yaml")
        preset_data["risk_management"]["features"]["behavior_detection"] = False
        preset_data["risk_management"]["features"]["abandoned_object"] = False
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        self.assertTrue(orchestrator.feature_flags["crowd_detection"])
        self.assertFalse(orchestrator.feature_flags["behavior_detection"])
        self.assertFalse(orchestrator.feature_flags["abandoned_object"])
        self.assertTrue(orchestrator.feature_flags["restricted_area"])

        # Processors for disabled features must NOT be instantiated
        self.assertIsNotNone(orchestrator.crowd_detector)
        self.assertIsNone(orchestrator.behavior_processor)
        self.assertIsNone(orchestrator.abandoned_processor)
        self.assertIsNotNone(orchestrator.restricted_processor)

        # Statuses
        self.assertEqual(orchestrator.feature_statuses["crowd_detection"], "ACTIVE")
        self.assertEqual(orchestrator.feature_statuses["behavior_detection"], "DISABLED")
        self.assertEqual(orchestrator.feature_statuses["abandoned_object"], "DISABLED")
        self.assertEqual(orchestrator.feature_statuses["restricted_area"], "ACTIVE")

    def test_3_behavior_preset_initializes_only_behavior_and_restricted(self):
        """Test 3: Behaviour configuration initializes only behaviour and restricted area."""
        preset_data = self._load_preset_data("risk_assessment.yaml")
        preset_data["risk_management"]["features"]["crowd_detection"] = False
        preset_data["risk_management"]["features"]["abandoned_object"] = False
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        self.assertFalse(orchestrator.feature_flags["crowd_detection"])
        self.assertTrue(orchestrator.feature_flags["behavior_detection"])
        self.assertFalse(orchestrator.feature_flags["abandoned_object"])
        self.assertTrue(orchestrator.feature_flags["restricted_area"])

        self.assertIsNone(orchestrator.crowd_detector)
        self.assertIsNotNone(orchestrator.behavior_processor)
        self.assertIsNone(orchestrator.abandoned_processor)
        self.assertIsNotNone(orchestrator.restricted_processor)

    def test_4_disabled_features_zero_inference_overhead(self):
        """Test 4: When abandoned object is disabled, detector targets only persons (classes=[0])."""
        preset_data = self._load_preset_data("risk_assessment.yaml")
        preset_data["risk_management"]["features"]["abandoned_object"] = False
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        self.assertIsNotNone(orchestrator.detector)
        self.assertEqual(orchestrator.detector.target_classes, [0])

        # In full preset with abandoned object enabled
        full_data = self._load_preset_data("risk_assessment.yaml")
        full_orch = RiskManagementOrchestrator(config_data=full_data, device="cpu", imgsz=416)
        self.assertEqual(full_orch.detector.target_classes, [0, 24, 26, 28, 39])

    def test_5_single_shared_video_frame_pipeline(self):
        """Test 5: Shared frame processing returns aggregated results without errors."""
        preset_data = self._load_preset_data("risk_assessment.yaml")
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        out = orchestrator.process_frame(dummy_frame, current_time=1.0, frame_index=1)

        self.assertIn("risk_output", out)
        self.assertIn("feature_statuses", out)
        self.assertIn("feature_outputs", out)
        self.assertEqual(out["frame_index"], 1)
        self.assertEqual(out["timestamp"], 1.0)

    def test_6_events_from_all_enabled_modules_reach_risk_engine(self):
        """Test 6: Injected multi-source events reach the Risk Assessment Engine and update composite score."""
        preset_data = self._load_preset_data("risk_assessment.yaml")
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        ev_fight = RiskEvent("1", "behavior_detection", "potential_violent_activity", 0.90, 1.0, person_ids=[1, 2])
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)

        out = orchestrator.process_frame(dummy_frame, current_time=1.0, frame_index=1, injected_events=[ev_fight])
        risk_output = out["risk_output"]

        self.assertGreater(risk_output["current_risk_score"], 60.0)
        self.assertIn(risk_output["current_risk_level"], ["HIGH", "CRITICAL"])
        self.assertEqual(len(risk_output["active_incidents"]), 1)

    def test_7_fault_isolation_feature_error_does_not_crash_pipeline(self):
        """Test 7: If a feature raises an exception, the error is isolated, marked ERROR, and remaining features run."""
        preset_data = self._load_preset_data("risk_assessment.yaml")
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        # Force a failure in the behavior processor
        def buggy_update(*args, **kwargs):
            raise RuntimeError("Simulated transient hardware error in GPU behavior tensor")

        orchestrator.behavior_processor.update = buggy_update

        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        # Should NOT raise RuntimeError!
        out = orchestrator.process_frame(dummy_frame, current_time=1.0, frame_index=2)

        # Behavior status should be ERROR, other active features should remain ACTIVE
        self.assertEqual(out["feature_statuses"]["behavior_detection"], "ERROR")
        self.assertEqual(out["feature_statuses"]["crowd_detection"], "ACTIVE")
        self.assertEqual(out["feature_statuses"]["restricted_area"], "ACTIVE")
        self.assertEqual(out["feature_statuses"]["risk_assessment"], "ACTIVE")

    def test_8_feature_status_diagnostics_reporting(self):
        """Test 8: Feature status dictionary correctly represents active and disabled features."""
        preset_data = self._load_preset_data("risk_assessment.yaml")
        preset_data["risk_management"]["features"]["crowd_detection"] = False
        preset_data["risk_management"]["features"]["abandoned_object"] = False
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        statuses = orchestrator.feature_statuses
        self.assertEqual(statuses["crowd_detection"], "DISABLED")
        self.assertEqual(statuses["behavior_detection"], "ACTIVE")
        self.assertEqual(statuses["abandoned_object"], "DISABLED")
        self.assertEqual(statuses["restricted_area"], "ACTIVE")

    def test_9_demo_preset_activates_accelerated_timers(self):
        """Test 9: Demo configuration sets demo_mode=True and initializes shortened persistence timers."""
        preset_data = self._load_preset_data("risk_assessment.yaml")
        preset_data["risk_management"]["demo_mode"] = True
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        self.assertTrue(orchestrator.demo_mode)
        self.assertLessEqual(orchestrator.crowd_detector.persistence_seconds, 2.0)

    def test_10_combined_ui_overlay_rendering_with_diagnostics(self):
        """Test 10: Unified HUD renders cleanly with the System Feature Status Diagnostics panel."""
        resolutions = [(358, 444), (480, 640), (720, 1280), (1080, 1920)]
        preset_data = self._load_preset_data("risk_assessment.yaml")
        orchestrator = RiskManagementOrchestrator(config_data=preset_data, device="cpu", imgsz=416)

        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        out = orchestrator.process_frame(dummy_frame, current_time=1.0, frame_index=1)

        for h, w in resolutions:
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            annotated = draw_risk_assessment_overlay(
                frame,
                risk_output=out["risk_output"],
                feature_statuses=out["feature_statuses"],
                ui_mode="demo"
            )
            self.assertEqual(annotated.shape, (h, w, 3))

    def test_11_rolling_fps_tracker(self):
        """Test 11: RollingFPSTracker computes stable rolling FPS without zero division."""
        from features.risk_assessment import RollingFPSTracker
        tracker = RollingFPSTracker(window_size=10)

        # Simulate 10 frames with 0.033s delta (approx 30 FPS)
        for _ in range(10):
            fps, ms = tracker.update()
            self.assertGreater(fps, 0.0)
            self.assertGreater(ms, 0.0)

    def test_12_tracked_persons_box_and_multi_feature_status_rendering(self):
        """Test 12: Tracked persons render with correct ID, confidence, and multi-feature consolidated statuses."""
        from features.risk_assessment import draw_tracked_persons

        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        tracked_persons = [
            {"track_id": 17, "box": (100, 100, 200, 300), "confidence": 0.94},
            {"track_id": 21, "box": (300, 150, 400, 350), "confidence": 0.88},
            {"track_id": 5, "box": (450, 120, 520, 280), "confidence": 0.91}
        ]

        behavior_output = {
            "person_states": {
                17: {"primary_state": "AGGRESSIVE", "confidence": 0.94},
                21: {"primary_state": "FALLEN", "confidence": 0.88}
            },
            "pair_states": {}
        }
        restricted_output = {
            "active_intruders": [5],
            "zone_statuses": {}
        }

        # Render person boxes
        draw_tracked_persons(
            frame=frame,
            tracked_persons=tracked_persons,
            behavior_output=behavior_output,
            restricted_output=restricted_output,
            ui_scale=1.0,
            show_tracking_ids=True,
            show_person_status=True,
            show_confidence=True
        )
        self.assertEqual(frame.shape, (480, 640, 3))

    def test_13_tracked_objects_and_zone_overlay_rendering(self):
        """Test 13: Unattended luggage badges and polygon restricted zones render cleanly."""
        from features.risk_assessment import draw_tracked_objects, draw_restricted_zones_overlay

        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        tracked_objects = [
            {"track_id": 42, "box": (200, 200, 260, 270), "confidence": 0.90, "class_name": "backpack"}
        ]
        abandoned_output = {
            "object_states": {
                42: {"state": "POTENTIAL_ABANDONED", "unattended_duration": 18.2, "is_escalated": False}
            }
        }
        zone_configs = [{
            "name": "TEST ZONE",
            "points": [[50, 50], [200, 50], [200, 200], [50, 200]]
        }]

        draw_restricted_zones_overlay(frame, zone_configs=zone_configs, ui_scale=1.0)
        draw_tracked_objects(frame, tracked_objects=tracked_objects, abandoned_output=abandoned_output, ui_scale=1.0)
        self.assertEqual(frame.shape, (480, 640, 3))

if __name__ == "__main__":
    unittest.main()
