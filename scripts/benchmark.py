"""
AI Campus Guard - Performance Benchmark Suite
Executes comparative benchmarks across performance profiles (Quality, Balanced, Performance).
"""

import os
import sys
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import cv2
import config.config as config
from features.crowd_detection import PersonDetector, CountStabilizer, CrowdDetector
from features.behavior_detection import BehaviorProcessor, BehaviorConfig, draw_behavior_overlay
from features.behavior_detection.profiler import PerformanceProfiler

def run_single_benchmark(
    video_path: str,
    max_frames: int = 120,
    imgsz: int = 640,
    frame_skip: int = 1,
    profile_name: str = "BALANCED"
) -> dict:
    config.load_preset("crowd_detection.yaml")

    detector = PersonDetector(
        model_path=config.MODEL_PATH,
        confidence_threshold=config.CONFIDENCE_THRESHOLD,
        tracker_type=config.TRACKER_TYPE,
        imgsz=imgsz
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video: {video_path}")
        return {}

    fps_src = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    stabilizer = CountStabilizer(window_size=15, drop_confirmation_seconds=1.0, fps=fps_src)
    crowd_detector = CrowdDetector(person_threshold=5, persistence_seconds=3.0)
    behavior_processor = BehaviorProcessor(BehaviorConfig())
    profiler = PerformanceProfiler(window_size=max_frames)

    frame_idx = 0
    tracked_persons = []
    raw_count = 0
    stable_count = 0
    crowd_info = {"person_count": 0, "threshold": 5, "crowd_detected": False, "status": "NORMAL"}
    behavior_output = {"new_events": [], "active_events": [], "person_states": {}, "pair_states": {}}

    start_time = time.perf_counter()

    while cap.isOpened() and frame_idx < max_frames:
        t0 = time.perf_counter()
        profiler.start_frame()

        # 1. Capture
        t_c0 = time.perf_counter()
        ret, frame = cap.read()
        if not ret:
            break
        profiler.record_stage("capture", (time.perf_counter() - t_c0) * 1000.0)

        frame_idx += 1
        v_time = frame_idx / fps_src

        # 2. Tracking
        t_y0 = time.perf_counter()
        if frame_idx == 1 or (frame_idx % frame_skip == 0):
            tracked_persons = detector.track(frame)
            raw_count = len(tracked_persons)
        profiler.record_stage("yolo", (time.perf_counter() - t_y0) * 1000.0)

        # 3. Crowd
        t_cr0 = time.perf_counter()
        if frame_idx == 1 or (frame_idx % frame_skip == 0):
            stable_count = stabilizer.update(raw_count, current_time=v_time)
            crowd_info = crowd_detector.update(stable_count, current_time=v_time)
        profiler.record_stage("crowd", (time.perf_counter() - t_cr0) * 1000.0)

        # 4. Behaviour
        t_b0 = time.perf_counter()
        if frame_idx == 1 or (frame_idx % frame_skip == 0):
            behavior_output = behavior_processor.update(tracked_persons, current_time=v_time, frame_shape=(h, w))
        profiler.record_stage("behavior", (time.perf_counter() - t_b0) * 1000.0)

        # 5. UI Drawing
        t_u0 = time.perf_counter()
        metrics = profiler.get_metrics()
        _ = draw_behavior_overlay(
            frame,
            tracked_persons,
            behavior_output,
            history_manager=behavior_processor.history_manager,
            fps=fps_src,
            current_time=v_time,
            raw_count=raw_count,
            stable_count=stable_count,
            crowd_info=crowd_info,
            profiler_metrics=metrics,
            device_name=detector.device.upper(),
            imgsz=detector.imgsz,
            ui_mode="demo",
            show_hud=True
        )
        profiler.record_stage("ui", (time.perf_counter() - t_u0) * 1000.0)

        t_tot = (time.perf_counter() - t0) * 1000.0
        profiler.record_stage("total", t_tot)

    cap.release()
    total_sec = time.perf_counter() - start_time
    fps_actual = frame_idx / total_sec if total_sec > 0 else 0.0

    res = profiler.get_metrics()
    res["profile_name"] = profile_name
    res["throughput_fps"] = round(fps_actual, 1)
    res["frames"] = frame_idx
    res["imgsz"] = imgsz
    res["frame_skip"] = frame_skip
    return res

def run_suite():
    video_path = os.path.join(BASE_DIR, "videos", "stock", "smaple3.mp4")
    if not os.path.exists(video_path):
        print(f"[ERROR] Test video not found: {video_path}")
        return

    print("===============================================================")
    print("       AI CAMPUS GUARD - PERFORMANCE BENCHMARK SUITE          ")
    print("===============================================================\n")

    profiles = [
        ("QUALITY", 640, 1),
        ("BALANCED (Recommended)", 512, 2),
        ("PERFORMANCE (High FPS)", 416, 2)
    ]

    results = []
    for name, imgsz, skip in profiles:
        print(f"--> Running Profile: {name} (imgsz={imgsz}, skip={skip})...")
        res = run_single_benchmark(video_path, max_frames=100, imgsz=imgsz, frame_skip=skip, profile_name=name)
        results.append(res)

    print("\n=========================================================================================")
    print(f"{'Profile':<24} | {'FPS':<8} | {'Latency':<10} | {'YOLO ms':<9} | {'Beh ms':<8} | {'UI ms':<6}")
    print("-----------------------------------------------------------------------------------------")
    for r in results:
        print(f"{r['profile_name']:<24} | {r['throughput_fps']:<8.1f} | {r['latency_ms']:<10.1f} | {r['yolo_ms']:<9.2f} | {r['behavior_ms']:<8.2f} | {r['ui_ms']:<6.2f}")
    print("=========================================================================================\n")

if __name__ == "__main__":
    run_suite()
