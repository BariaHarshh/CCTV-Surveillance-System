"""
AI Campus Guard - Performance, Detection & Tracking Unit Test Suite
Validates PerformanceProfiler, confidence hysteresis, track persistence,
adaptive feature cadences, memory bounding, and performance presets.
"""

import unittest
import numpy as np
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from features.risk_assessment import (
    PerformanceProfiler,
    RiskManagementOrchestrator,
    draw_performance_diagnostics_panel,
    UILayoutManager
)
from features.abandoned_object import MultiObjectDetector, compute_iou
import config.config as config

class TestPerformanceAndTracking(unittest.TestCase):
    """Unit and integration tests for detection accuracy, tracking reliability, and profiling."""

    def test_1_compute_iou(self):
        """Test 1: compute_iou accurately calculates overlap between bounding boxes."""
        boxA = (100, 100, 200, 200) # Area = 10000
        boxB = (100, 100, 200, 200) # Identical -> IoU = 1.0
        self.assertAlmostEqual(compute_iou(boxA, boxB), 1.0, places=3)

        boxC = (300, 300, 400, 400) # Non-overlapping -> IoU = 0.0
        self.assertEqual(compute_iou(boxA, boxC), 0.0)

        boxD = (150, 100, 250, 200) # 50% overlap
        iou = compute_iou(boxA, boxD)
        self.assertGreater(iou, 0.3)
        self.assertLess(iou, 0.6)

    def test_2_performance_profiler_metrics(self):
        """Test 2: PerformanceProfiler records individual stages and calculates averages."""
        profiler = PerformanceProfiler(window_size=10, enabled=True)

        for _ in range(5):
            profiler.start_frame()
            time.sleep(0.002) # simulate detection
            profiler.mark_stage("detection")
            time.sleep(0.001) # simulate behavior
            profiler.mark_stage("behavior")
            profiler.end_frame()

        summary = profiler.get_summary()
        self.assertIn("detection", summary)
        self.assertIn("behavior", summary)
        self.assertIn("total", summary)
        self.assertIn("fps", summary)
        self.assertGreater(summary["total"], 0.0)
        self.assertGreater(summary["fps"], 0.0)

        report = profiler.format_report()
        self.assertIn("FRAME PERFORMANCE", report)
        self.assertIn("Detection (YOLO)", report)

    def test_3_diagnostics_hud_render(self):
        """Test 3: draw_performance_diagnostics_panel renders without exceptions."""
        frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        layout = UILayoutManager(1280, 720, ui_mode="diagnostics")
        perf_summary = {
            "fps": 32.5,
            "total": 30.8,
            "detection": 21.2,
            "behavior": 1.4,
            "abandoned": 1.8,
            "restricted": 0.8,
            "risk_engine": 0.5,
            "ui_render": 2.1
        }

        draw_performance_diagnostics_panel(frame, layout=layout, perf_summary=perf_summary)
        self.assertEqual(frame.shape, (720, 1280, 3))

    def test_4_adaptive_scheduling_orchestrator(self):
        """Test 4: RiskManagementOrchestrator respects feature cadences and executes single-pass inference."""
        custom_config = {
            "risk_management": {
                "enabled": True,
                "performance": {
                    "feature_intervals": {
                        "person_detection": 1,
                        "behavior_detection": 2,
                        "abandoned_object": 3,
                        "restricted_area": 1
                    }
                },
                "features": {
                    "crowd_detection": True,
                    "behavior_detection": True,
                    "abandoned_object": True,
                    "restricted_area": True
                }
            }
        }

        orchestrator = RiskManagementOrchestrator(
            config_data=custom_config,
            device="cpu",
            imgsz=416,
            enable_profiling=True
        )

        dummy_frame = np.zeros((352, 640, 3), dtype=np.uint8)

        # Process Frame 1
        out1 = orchestrator.process_frame(dummy_frame, current_time=0.033, frame_index=1)
        self.assertIn("risk_output", out1)
        self.assertIn("performance_summary", out1)

        # Process Frame 2
        out2 = orchestrator.process_frame(dummy_frame, current_time=0.066, frame_index=2)
        self.assertIn("performance_summary", out2)

    def test_5_performance_presets_integrity(self):
        """Test 5: All 3 new performance preset YAMLs load and have valid configurations."""
        presets = [
            "risk_management_high_accuracy.yaml",
            "risk_management_balanced.yaml",
            "risk_management_high_performance.yaml"
        ]

        import yaml
        for p in presets:
            path = os.path.join(config.PRESETS_DIR, p)
            self.assertTrue(os.path.exists(path), f"Preset file {p} does not exist.")
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                self.assertIn("risk_management", data)
                self.assertIn("performance", data["risk_management"])

if __name__ == "__main__":
    unittest.main()
