"""
AI Campus Guard - Performance Profiler & Subsystem Latency Diagnostics
Measures per-frame execution timings across individual detection, tracking, behaviour,
restricted area, and risk engine components with rolling moving averages and FPS metrics.
"""

from typing import Dict, List, Tuple, Optional, Any
from collections import deque
import time

class PerformanceProfiler:
    """
    Measures and tracks execution latencies of individual pipeline stages.
    """
    def __init__(self, window_size: int = 30, enabled: bool = True):
        self.window_size = window_size
        self.enabled = enabled

        self._frame_start_time: float = 0.0
        self._last_stage_time: float = 0.0
        self._current_frame_timings: Dict[str, float] = {}

        # History queues for moving average calculation
        self.stage_histories: Dict[str, deque[float]] = {
            "preprocess": deque(maxlen=window_size),
            "detection": deque(maxlen=window_size),
            "crowd": deque(maxlen=window_size),
            "behavior": deque(maxlen=window_size),
            "abandoned": deque(maxlen=window_size),
            "restricted": deque(maxlen=window_size),
            "risk_engine": deque(maxlen=window_size),
            "ui_render": deque(maxlen=window_size),
            "total": deque(maxlen=window_size)
        }

        self.last_report_time: float = time.time()
        self.total_frames_profiled: int = 0

    def start_frame(self):
        """Marks the start of frame processing."""
        if not self.enabled:
            return
        now = time.perf_counter()
        self._frame_start_time = now
        self._last_stage_time = now
        self._current_frame_timings = {}

    def mark_stage(self, stage_name: str):
        """Records latency since the last marked stage."""
        if not self.enabled:
            return
        now = time.perf_counter()
        dt_ms = (now - self._last_stage_time) * 1000.0
        self._current_frame_timings[stage_name] = dt_ms
        self._last_stage_time = now

    def end_frame(self) -> Dict[str, float]:
        """Finalizes timing for the frame and computes rolling averages."""
        if not self.enabled:
            return {}

        now = time.perf_counter()
        total_ms = (now - self._frame_start_time) * 1000.0
        self._current_frame_timings["total"] = total_ms

        for stage, dt in self._current_frame_timings.items():
            if stage not in self.stage_histories:
                self.stage_histories[stage] = deque(maxlen=self.window_size)
            self.stage_histories[stage].append(dt)

        self.total_frames_profiled += 1
        return self.get_summary()

    def get_summary(self) -> Dict[str, float]:
        """Returns average execution times (in milliseconds) and processing FPS."""
        summary: Dict[str, float] = {}
        for stage, q in self.stage_histories.items():
            summary[stage] = round(sum(q) / len(q), 2) if len(q) > 0 else 0.0

        avg_total = summary.get("total", 33.3)
        summary["fps"] = round(1000.0 / avg_total, 1) if avg_total > 0 else 30.0
        return summary

    def format_report(self) -> str:
        """Returns formatted string report of performance metrics."""
        summary = self.get_summary()
        lines = [
            "===========================================",
            "            FRAME PERFORMANCE              ",
            "===========================================",
            f"Detection (YOLO):  {summary.get('detection', 0.0):6.2f} ms",
            f"Crowd Analysis:    {summary.get('crowd', 0.0):6.2f} ms",
            f"Behaviour Engine:  {summary.get('behavior', 0.0):6.2f} ms",
            f"Abandoned Objects: {summary.get('abandoned', 0.0):6.2f} ms",
            f"Restricted Area:   {summary.get('restricted', 0.0):6.2f} ms",
            f"Risk Engine:       {summary.get('risk_engine', 0.0):6.2f} ms",
            f"UI Rendering:      {summary.get('ui_render', 0.0):6.2f} ms",
            "-------------------------------------------",
            f"TOTAL LATENCY:     {summary.get('total', 0.0):6.2f} ms",
            f"PROCESSING FPS:    {summary.get('fps', 0.0):6.1f}",
            "==========================================="
        ]
        return "\n".join(lines)
