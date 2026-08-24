"""
AI Campus Guard - Interactive Menu & Restricted Area Setup Test Suite
Validates menu opening/closing, real-time feature toggling without restart,
polygon interactive drawing, normalized coordinate math, zone removal/clearing,
YAML persistence, and intrusion event generation.
"""

import unittest
import numpy as np
import os
import sys
import cv2
import tempfile
import yaml

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from features.risk_assessment import (
    RiskManagementOrchestrator,
    InteractiveMenuController,
    draw_risk_assessment_overlay,
    points_to_normalized,
    points_to_pixels,
    RiskEvent
)
from features.restricted_area import RestrictedAreaProcessor

class TestInteractiveMenuAndRestrictedArea(unittest.TestCase):
    """Test suite covering interactive menu controls, feature toggles, and zone drawing."""

    def setUp(self):
        self.orchestrator = RiskManagementOrchestrator(
            config_data={
                "risk_management": {
                    "enabled": True,
                    "features": {
                        "crowd_detection": True,
                        "behavior_detection": True,
                        "abandoned_object": True,
                        "restricted_area": True
                    }
                }
            },
            device="cpu",
            imgsz=416
        )
        self.controller = InteractiveMenuController(zone_configs=self.orchestrator.zone_configs)

    def test_1_menu_open_and_close(self):
        """Test 1: Menu opens and closes via button clicks and keyboard shortcuts."""
        self.assertFalse(self.controller.menu_open)

        # 1. Click top-left button region
        bx1, by1, bx2, by2 = self.controller.menu_button_region
        cx = (bx1 + bx2) // 2
        cy = (by1 + by2) // 2
        self.controller.on_mouse(cv2.EVENT_LBUTTONDOWN, cx, cy, 0, self.orchestrator)
        self.assertTrue(self.controller.menu_open)

        # 2. Press ESC to close
        self.controller.handle_key(27, 640, 480, self.orchestrator)
        self.assertFalse(self.controller.menu_open)

        # 3. Press 'm' to open again
        self.controller.handle_key(ord('m'), 640, 480, self.orchestrator)
        self.assertTrue(self.controller.menu_open)

    def test_2_realtime_feature_toggles_without_restart(self):
        """Test 2: Real-time feature toggles immediately update orchestrator state without restarts."""
        # 1. Disable Behaviour Detection
        self.orchestrator.set_feature_enabled("behavior_detection", False)
        self.assertFalse(self.orchestrator.feature_flags["behavior_detection"])
        self.assertEqual(self.orchestrator.feature_statuses["behavior_detection"], "DISABLED")

        # 2. Re-enable Behaviour Detection
        self.orchestrator.set_feature_enabled("behavior_detection", True)
        self.assertTrue(self.orchestrator.feature_flags["behavior_detection"])
        self.assertEqual(self.orchestrator.feature_statuses["behavior_detection"], "ACTIVE")

        # 3. Toggle Crowd & Abandoned Object
        self.orchestrator.set_feature_enabled("crowd_detection", False)
        self.assertFalse(self.orchestrator.feature_flags["crowd_detection"])

        self.orchestrator.set_feature_enabled("abandoned_object", False)
        self.assertFalse(self.orchestrator.feature_flags["abandoned_object"])
        self.assertEqual(self.orchestrator.detector.target_classes, [0])  # Only persons when abandoned disabled

        self.orchestrator.set_feature_enabled("abandoned_object", True)
        self.assertEqual(self.orchestrator.detector.target_classes, [0, 24, 26, 28, 39])

    def test_3_polygon_drawing_lifecycle(self):
        """Test 3: Interactive polygon drawing: add vertices, undo, finish, and assign severity."""
        # 1. Enter draw mode
        self.controller.handle_key(ord('r'), 640, 480, self.orchestrator)
        self.assertTrue(self.controller.draw_mode)

        # 2. Add 4 vertices
        self.controller.on_mouse(cv2.EVENT_LBUTTONDOWN, 100, 100, 0, self.orchestrator)
        self.controller.on_mouse(cv2.EVENT_LBUTTONDOWN, 300, 100, 0, self.orchestrator)
        self.controller.on_mouse(cv2.EVENT_LBUTTONDOWN, 300, 300, 0, self.orchestrator)
        self.controller.on_mouse(cv2.EVENT_LBUTTONDOWN, 100, 300, 0, self.orchestrator)
        self.assertEqual(len(self.controller.current_polygon_points), 4)

        # 3. Undo last point
        self.controller.handle_key(8, 640, 480, self.orchestrator)  # BACKSPACE
        self.assertEqual(len(self.controller.current_polygon_points), 3)

        # Re-add 4th point
        self.controller.on_mouse(cv2.EVENT_LBUTTONDOWN, 100, 300, 0, self.orchestrator)

        # 4. Finish polygon via ENTER
        self.controller.selected_risk_level = "critical"
        self.controller.handle_key(13, 640, 480, self.orchestrator)  # ENTER

        self.assertFalse(self.controller.draw_mode)
        self.assertGreaterEqual(len(self.controller.zone_configs), 1)

        newest_zone = self.controller.zone_configs[-1]
        self.assertEqual(newest_zone["severity"], "critical")
        self.assertEqual(len(newest_zone["points"]), 4)
        self.assertIn("normalized_points", newest_zone)

    def test_4_normalized_coordinate_math_across_resolutions(self):
        """Test 4: Normalized coordinates scale accurately across different video resolutions."""
        pixel_points_640x480 = [(160, 120), (480, 120), (480, 360), (160, 360)]
        norm_pts = points_to_normalized(pixel_points_640x480, 640, 480)

        self.assertEqual(norm_pts, [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]])

        # Denormalize to 1920x1080 Full HD
        px_1080p = points_to_pixels(norm_pts, 1920, 1080)
        self.assertEqual(px_1080p, [[480, 270], [1440, 270], [1440, 810], [480, 810]])

    def test_5_zone_removal_and_clearing(self):
        """Test 5: Zones can be removed individually or cleared completely."""
        self.controller.zone_configs = [
            {"name": "ZONE 1", "severity": "high", "points": [[10, 10], [50, 10], [50, 50], [10, 50]]},
            {"name": "ZONE 2", "severity": "critical", "points": [[60, 60], [100, 60], [100, 100], [60, 100]]}
        ]

        # Remove ZONE 1
        self.controller.remove_zone(0, self.orchestrator)
        self.assertEqual(len(self.controller.zone_configs), 1)
        self.assertEqual(self.controller.zone_configs[0]["name"], "ZONE 2")

        # Clear All
        self.controller.clear_all_zones(self.orchestrator)
        self.assertEqual(len(self.controller.zone_configs), 0)
        self.assertEqual(len(self.orchestrator.zone_configs), 0)

    def test_6_save_and_load_zones_yaml(self):
        """Test 6: Configured zones can be saved to YAML and loaded cleanly."""
        with tempfile.NamedTemporaryFile(suffix=".yaml", delete=False) as tf:
            temp_path = tf.name

        try:
            self.controller.zone_configs = [
                {"name": "PERSISTED ZONE", "severity": "high", "points": [[10, 10], [50, 10], [50, 50], [10, 50]]}
            ]
            self.controller.save_zones_to_file(temp_path)

            # Clear in memory
            self.controller.zone_configs = []

            # Load from file
            self.controller.load_zones_from_file(temp_path, self.orchestrator)
            self.assertEqual(len(self.controller.zone_configs), 1)
            self.assertEqual(self.controller.zone_configs[0]["name"], "PERSISTED ZONE")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_7_person_polygon_entry_event_generation(self):
        """Test 7: Person bottom-center point inside polygon generates RestrictedAreaEvent."""
        processor = RestrictedAreaProcessor(
            zone_configs=[{
                "name": "TEST SECURE ZONE",
                "severity": "critical",
                "enabled": True,
                "points": [[100, 100], [300, 100], [300, 300], [100, 300]]
            }],
            confirmation_seconds=0.0,
            cooldown_seconds=0.0
        )

        # Person 17 is inside: box (150, 120, 250, 250) -> bottom center is (200, 250)
        tracked_inside = [{"track_id": 17, "box": (150, 120, 250, 250), "confidence": 0.95}]
        out_inside = processor.update(tracked_inside, current_time=1.0)

        self.assertIn(17, out_inside["active_intruders"])
        self.assertGreaterEqual(len(out_inside["new_events"]), 1)
        self.assertEqual(out_inside["new_events"][0].event_type, "zone_breach")

        # Person 22 is outside: box (400, 400, 500, 500) -> bottom center is (450, 500)
        tracked_outside = [{"track_id": 22, "box": (400, 400, 500, 500), "confidence": 0.90}]
        out_outside = processor.update(tracked_outside, current_time=2.0)
        self.assertEqual(len(out_outside["active_intruders"]), 0)

    def test_8_interactive_overlay_rendering(self):
        """Test 8: Interactive overlay renders cleanly with menu open and in draw mode."""
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        risk_output = {
            "current_risk_score": 45.0,
            "current_risk_level": "MEDIUM",
            "status": "MONITORING",
            "active_incidents": [],
            "summary": {}
        }

        # 1. Render with menu open
        self.controller.menu_open = True
        frame_menu = draw_risk_assessment_overlay(
            dummy_frame.copy(),
            risk_output=risk_output,
            controller=self.controller
        )
        self.assertEqual(frame_menu.shape, (480, 640, 3))

        # 2. Render with draw mode active
        self.controller.menu_open = False
        self.controller.draw_mode = True
        self.controller.current_polygon_points = [(100, 100), (200, 150), (150, 250)]
        self.controller.mouse_pos = (180, 280)
        frame_draw = draw_risk_assessment_overlay(
            dummy_frame.copy(),
            risk_output=risk_output,
            controller=self.controller
        )
        self.assertEqual(frame_draw.shape, (480, 640, 3))

if __name__ == "__main__":
    unittest.main()
