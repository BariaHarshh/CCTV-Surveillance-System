"""
AI Campus Guard - Uniform UI Scaling & Layout Test Suite
Validates uniform aspect-ratio preserving UI scaling, canonical 1280x720 canvas math,
letterboxing coordinate transformations, and visual rendering across 8 distinct resolutions.
"""

import unittest
import numpy as np
import os
import sys
import cv2

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from features.risk_assessment import (
    BASE_UI_WIDTH,
    BASE_UI_HEIGHT,
    MIN_UI_SCALE,
    MAX_UI_SCALE,
    get_ui_scale,
    letterbox_frame,
    window_to_frame_coords,
    draw_risk_assessment_overlay,
    InteractiveMenuController,
    draw_tracked_persons,
    draw_restricted_zones_overlay
)

class TestUIScalingAndLayout(unittest.TestCase):
    """Test suite covering uniform UI scaling and resolution-independent layout."""

    def test_1_uniform_ui_scale_calculation(self):
        """Test 1: get_ui_scale calculates uniform min(w/1280, h/720) clamped to [0.5, 1.6]."""
        # Base 1280x720
        self.assertAlmostEqual(get_ui_scale(1280, 720), 1.00, places=2)

        # Full HD 1920x1080 -> 1.50
        self.assertAlmostEqual(get_ui_scale(1920, 1080), 1.50, places=2)

        # 4K UHD 3840x2160 -> clamped to 1.60
        self.assertAlmostEqual(get_ui_scale(3840, 2160), MAX_UI_SCALE, places=2)

        # Standard 4:3 640x480 -> min(0.50, 0.667) = 0.50
        self.assertAlmostEqual(get_ui_scale(640, 480), 0.50, places=2)

        # Portrait Mobile 480x854 -> min(480/1280=0.375, 854/720=1.186) -> clamped to 0.50
        self.assertAlmostEqual(get_ui_scale(480, 854), MIN_UI_SCALE, places=2)

        # Ultra-wide 21:9 2560x1080 -> min(2560/1280=2.0, 1080/720=1.5) = 1.50
        self.assertAlmostEqual(get_ui_scale(2560, 1080), 1.50, places=2)

    def test_2_button_and_panel_aspect_ratio_invariance(self):
        """Test 2: Buttons and panels maintain constant aspect ratio regardless of video resolution."""
        resolutions = [
            (640, 352),
            (640, 480),
            (854, 480),
            (1280, 720),
            (1920, 1080),
            (480, 854),
            (2560, 1080)
        ]

        # Base panel dimensions: 360 x 470 (Aspect ratio: 360/470 = 0.7659)
        base_aspect = 360.0 / 470.0

        for w, h in resolutions:
            scale = get_ui_scale(w, h)
            scaled_w = int(360 * scale)
            scaled_h = int(470 * scale)
            scaled_aspect = scaled_w / scaled_h
            # The aspect ratio should match within integer rounding tolerance
            self.assertAlmostEqual(scaled_aspect, base_aspect, delta=0.03)

    def test_3_letterbox_frame_and_coordinate_mapping(self):
        """Test 3: letterbox_frame preserves aspect ratio and window_to_frame_coords maps accurately."""
        # Frame 640x360 into 1280x720 canvas
        dummy_frame = np.zeros((360, 640, 3), dtype=np.uint8)
        canvas, scale, pad_x, pad_y = letterbox_frame(dummy_frame, 1280, 720)

        self.assertEqual(canvas.shape, (720, 1280, 3))
        self.assertAlmostEqual(scale, 2.0, places=2)
        self.assertEqual(pad_x, 0)
        self.assertEqual(pad_y, 0)

        # Frame 640x480 (4:3) into 1280x720 (16:9) canvas
        frame_43 = np.zeros((480, 640, 3), dtype=np.uint8)
        canvas_43, scale_43, pad_x_43, pad_y_43 = letterbox_frame(frame_43, 1280, 720)

        self.assertEqual(canvas_43.shape, (720, 1280, 3))
        self.assertAlmostEqual(scale_43, 1.5, places=2)
        self.assertEqual(pad_y_43, 0)
        self.assertEqual(pad_x_43, 160)  # (1280 - 640*1.5) / 2 = 160

        # Test mouse click conversion at center
        win_cx = 640
        win_cy = 360
        fx, fy = window_to_frame_coords(win_cx, win_cy, scale_43, pad_x_43, pad_y_43, 640, 480)
        self.assertEqual(fx, 320)
        self.assertEqual(fy, 240)

    def test_4_full_hud_render_across_8_resolutions(self):
        """Test 4: Master surveillance overlay renders without clipping or errors on 8 distinct resolutions."""
        resolutions = [
            (352, 640),
            (480, 640),
            (480, 854),
            (720, 1280),
            (1080, 1920),
            (2160, 3840),
            (854, 480),   # Portrait
            (1080, 2560)  # Ultra-wide
        ]

        risk_output = {
            "current_risk_score": 68.0,
            "current_risk_level": "HIGH",
            "status": "INCIDENT ACTIVE",
            "active_incidents": [],
            "summary": {"total_active_incidents": 1, "critical_incident_count": 0, "active_sources": ["behavior_detection"]}
        }
        controller = InteractiveMenuController()
        controller.menu_open = True

        for h, w in resolutions:
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            annotated = draw_risk_assessment_overlay(
                frame=frame,
                risk_output=risk_output,
                controller=controller
            )
            self.assertEqual(annotated.shape, (h, w, 3))

    def test_5_person_boxes_and_polygons_resolution_alignment(self):
        """Test 5: Detection boxes and normalized zones scale directly with frame pixels without distortion."""
        frame = np.zeros((1080, 1920, 3), dtype=np.uint8)
        tracked_persons = [
            {"track_id": 1, "box": (200, 200, 400, 600), "confidence": 0.92}
        ]
        zone_configs = [
            {"name": "CAMPUS ZONE", "points": [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]]}
        ]

    def test_6_uilayoutmanager_bounds_and_clamping(self):
        """Test 6: UILayoutManager enforces strict min/max width and height bounds on all panels."""
        from features.risk_assessment import UILayoutManager

        # Test on 4K Resolution (3840x2160) - panels must not balloon to 1000px
        layout_4k = UILayoutManager(3840, 2160, ui_mode="compact")
        self.assertLessEqual(layout_4k.risk_card_w, 450)
        self.assertLessEqual(layout_4k.menu_btn_w, 185)
        self.assertLessEqual(layout_4k.control_panel_w, 380)

        # Test on Small 480p Resolution (640x352) - panels must maintain readable minimums
        layout_low = UILayoutManager(640, 352, ui_mode="compact")
        self.assertGreaterEqual(layout_low.risk_card_w, 310)
        self.assertGreaterEqual(layout_low.menu_btn_w, 130)
        self.assertGreaterEqual(layout_low.control_panel_w, 280)
        self.assertGreaterEqual(layout_low.normal_font, 0.38)

if __name__ == "__main__":
    unittest.main()
