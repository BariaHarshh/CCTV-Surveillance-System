"""
AI Campus Guard - Lightweight Performance Profiler
Tracks per-frame latency for capture, YOLO inference, tracking, behaviour analysis, UI rendering, and video output.
Calculates smoothed FPS and latency metrics without introducing measurement overhead.
"""

import time
from typing import Dict, Any, Optional
from collections import deque

class PerformanceProfiler:
    """
    High-precision, low-overhead pipeline profiler.
    Measures timing breakdowns across stages and maintains rolling window averages for smooth HUD display.
    """
    def __init__(self, window_size: int = 30):
        self.window_size = window_size
        
        # Rolling buffers (in milliseconds)
        self.history_capture: deque[float] = deque(maxlen=window_size)
        self.history_yolo: deque[float] = deque(maxlen=window_size)
        self.history_crowd: deque[float] = deque(maxlen=window_size)
        self.history_behavior: deque[float] = deque(maxlen=window_size)
        self.history_ui: deque[float] = deque(maxlen=window_size)
        self.history_output: deque[float] = deque(maxlen=window_size)
        self.history_total: deque[float] = deque(maxlen=window_size)
        
        # Frame timestamps for smoothed FPS calculation
        self.frame_timestamps: deque[float] = deque(maxlen=window_size)
        self.last_frame_time: float = time.perf_counter()
        self.smoothed_fps: float = 0.0

    def start_frame(self):
        """Marks the start of a new frame cycle."""
        now = time.perf_counter()
        self.frame_timestamps.append(now)
        if len(self.frame_timestamps) > 1:
            duration = self.frame_timestamps[-1] - self.frame_timestamps[0]
            if duration > 0:
                self.smoothed_fps = (len(self.frame_timestamps) - 1) / duration

    def record_stage(self, stage: str, duration_ms: float):
        """Records the duration (in milliseconds) of an execution stage."""
        if stage == "capture":
            self.history_capture.append(duration_ms)
        elif stage == "yolo" or stage == "yolo_tracking":
            self.history_yolo.append(duration_ms)
        elif stage == "crowd":
            self.history_crowd.append(duration_ms)
        elif stage == "behavior":
            self.history_behavior.append(duration_ms)
        elif stage == "ui":
            self.history_ui.append(duration_ms)
        elif stage == "output":
            self.history_output.append(duration_ms)
        elif stage == "total":
            self.history_total.append(duration_ms)

    def get_metrics(self) -> Dict[str, float]:
        """Returns smoothed average metrics for all stages."""
        def mean_or_zero(q: deque) -> float:
            return float(sum(q) / len(q)) if len(q) > 0 else 0.0

        t_cap = mean_or_zero(self.history_capture)
        t_yolo = mean_or_zero(self.history_yolo)
        t_crowd = mean_or_zero(self.history_crowd)
        t_beh = mean_or_zero(self.history_behavior)
        t_ui = mean_or_zero(self.history_ui)
        t_out = mean_or_zero(self.history_output)
        t_tot = mean_or_zero(self.history_total)
        if t_tot == 0.0:
            t_tot = t_cap + t_yolo + t_crowd + t_beh + t_ui + t_out

        return {
            "fps": round(self.smoothed_fps, 1),
            "latency_ms": round(t_tot, 1),
            "capture_ms": round(t_cap, 2),
            "yolo_ms": round(t_yolo, 2),
            "crowd_ms": round(t_crowd, 2),
            "behavior_ms": round(t_beh, 2),
            "ui_ms": round(t_ui, 2),
            "output_ms": round(t_out, 2),
            "total_ms": round(t_tot, 2)
        }

    def summary_table(self) -> str:
        """Returns formatted text table of current performance metrics."""
        m = self.get_metrics()
        return (
            "-------------------------------------------\n"
            "         PIPELINE PERFORMANCE REPORT       \n"
            "-------------------------------------------\n"
            f"Smoothed FPS         : {m['fps']:.1f} FPS\n"
            f"Average Frame Latency: {m['latency_ms']:.1f} ms\n"
            "Stage Breakdown:\n"
            f"  - Frame Capture    : {m['capture_ms']:.2f} ms\n"
            f"  - YOLO & Tracking  : {m['yolo_ms']:.2f} ms\n"
            f"  - Crowd Processing : {m['crowd_ms']:.2f} ms\n"
            f"  - Behaviour Engine : {m['behavior_ms']:.2f} ms\n"
            f"  - UI / HUD Drawing : {m['ui_ms']:.2f} ms\n"
            f"  - Video Output     : {m['output_ms']:.2f} ms\n"
            f"  - Total Frame Loop : {m['total_ms']:.2f} ms\n"
            "-------------------------------------------"
        )
