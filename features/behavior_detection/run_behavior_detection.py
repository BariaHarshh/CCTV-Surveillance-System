"""
AI Campus Guard - Behaviour Detection Feature Runner (Optimized)
Standalone entry point script for testing Fall, Aggressive Movement, and Fight Detection.
Integrates performance modes (Quality, Balanced, Performance), auto-device selection, and real-time profiling.
"""

import os
import sys
import time
import argparse

# Ensure root repository directory is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import cv2
import config.config as config
from features.crowd_detection import (
    PersonDetector,
    CountStabilizer,
    CrowdDetector,
    draw_crowd_detections
)
from features.behavior_detection import (
    BehaviorProcessor,
    BehaviorConfig,
    draw_behavior_overlay
)
from features.behavior_detection.profiler import PerformanceProfiler

def parse_arguments():
    parser = argparse.ArgumentParser(description="AI Campus Guard - Behaviour Detection Runner")
    parser.add_argument("--video", type=str, default=None, help="Path to input video file or webcam index (e.g. 0)")
    parser.add_argument("--performance-mode", type=str, default="balanced", choices=["quality", "balanced", "performance"], help="Performance profile")
    parser.add_argument("--imgsz", type=int, default=None, help="Inference resolution override (e.g. 640, 512, 416)")
    parser.add_argument("--frame-skip", type=int, default=None, help="Process every Nth frame override")
    parser.add_argument("--device", type=str, default="auto", help="Compute device: 'auto', 'cpu', 'cuda', 'cuda:0'")
    parser.add_argument("--ui-mode", type=str, default="demo", choices=["demo", "debug"], help="HUD mode: 'demo' (clean) or 'debug' (technical telemetry)")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode without GUI window")
    parser.add_argument("--save-output", type=str, default=None, help="Optional output video file path to save annotated feed")
    parser.add_argument("--max-frames", type=int, default=None, help="Optional max frames limit for automated testing")
    return parser.parse_known_args()[0]

def main():
    print("===========================================")
    print("         AI CAMPUS GUARD SURVEILLANCE       ")
    print("     Runner: Behaviour Detection Module    ")
    print("===========================================")

    args = parse_arguments()

    # Load default or crowd preset configuration
    config.load_preset("crowd_detection.yaml")

    # Resolve Video / Webcam Source
    if args.video is not None and args.video.isdigit():
        video_source = int(args.video)
        source_desc = f"Webcam (Index {args.video})"
    else:
        raw_path = args.video if args.video else config.VIDEO_PATH
        if not os.path.isabs(raw_path) and not os.path.exists(raw_path):
            candidate = os.path.join(BASE_DIR, raw_path)
            if os.path.exists(candidate):
                raw_path = candidate
        if not os.path.exists(raw_path):
            print(f"[ERROR] Video file not found at: '{raw_path}'")
            print("Please place your test MP4 video in 'videos/stock/' or 'videos/input/' and check config.")
            return
        video_source = raw_path
        source_desc = raw_path

    # Configure Performance Profile
    if args.performance_mode == "quality":
        default_imgsz = 640
        default_frame_skip = 1
    elif args.performance_mode == "performance":
        default_imgsz = 416
        default_frame_skip = 2
    else:  # balanced
        default_imgsz = 512
        default_frame_skip = 2

    imgsz = args.imgsz if args.imgsz is not None else default_imgsz
    frame_skip = args.frame_skip if args.frame_skip is not None else default_frame_skip

    # Initialize YOLO + ByteTrack Detector
    detector = PersonDetector(
        model_path=config.MODEL_PATH,
        confidence_threshold=config.CONFIDENCE_THRESHOLD,
        tracker_type=config.TRACKER_TYPE,
        device=args.device,
        imgsz=imgsz
    )
    if detector.model is None:
        print("[ERROR] Could not initialize PersonDetector. Exiting.")
        return

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video stream: '{source_desc}'")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Initialize Crowd Stabilizer & Processor
    stabilizer = CountStabilizer(
        window_size=config.COUNT_SMOOTHING_WINDOW,
        drop_confirmation_seconds=config.COUNT_DROP_CONFIRMATION_SECONDS,
        fps=fps
    )
    crowd_detector = CrowdDetector(
        person_threshold=config.PERSON_THRESHOLD,
        persistence_seconds=config.PERSISTENCE_SECONDS
    )

    # Initialize Behaviour Processor
    behavior_cfg = BehaviorConfig(
        camera_id="CAM-01",
        location="Campus Main Hallway"
    )
    behavior_processor = BehaviorProcessor(config=behavior_cfg)
    profiler = PerformanceProfiler(window_size=30)

    print(f"Source                : {source_desc}")
    print(f"Source FPS            : {fps:.2f}" if fps > 0 else f"Source FPS            : {fps}")
    print(f"Resolution            : {width} x {height} px")
    print(f"Device                : {detector.device.upper()}")
    print(f"Performance Profile   : {args.performance_mode.upper()} (imgsz={imgsz}, frame_skip={frame_skip})")
    print(f"UI Mode               : {args.ui_mode.upper()}")
    print("-------------------------------------------")
    print("Press 'Q' key in the video window to quit.")
    print("-------------------------------------------")

    writer = None
    if args.save_output:
        out_dir = os.path.dirname(args.save_output)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(args.save_output, fourcc, fps if fps > 0 else 30.0, (width, height))
        print(f"[INFO] Saving output video to: '{args.save_output}'")

    target_delay_ms = 1000.0 / fps if (fps and fps > 0) else 33.0
    window_name = "AI Campus Guard - Behaviour Intelligence Monitor"
    frame_index = 0

    tracked_persons = []
    raw_count = 0
    stable_count = 0
    crowd_info = {
        "person_count": 0,
        "threshold": config.PERSON_THRESHOLD,
        "crowd_detected": False,
        "confirmation_progress_seconds": 0.0,
        "required_persistence_seconds": config.PERSISTENCE_SECONDS,
        "status": "NORMAL"
    }
    behavior_output = {
        "new_events": [],
        "active_events": [],
        "person_states": {},
        "pair_states": {},
        "summary": {"total_persons": 0, "active_alerts_count": 0, "has_critical_event": False}
    }

    try:
        while cap.isOpened():
            t_frame_start = time.perf_counter()
            profiler.start_frame()

            # 1. Capture
            t_cap_0 = time.perf_counter()
            ret, frame = cap.read()
            if not ret:
                print("[INFO] End of video stream reached.")
                break
            profiler.record_stage("capture", (time.perf_counter() - t_cap_0) * 1000.0)

            frame_index += 1
            video_time = (frame_index / fps) if (fps and fps > 0) else (frame_index / 30.0)

            # 2. Tracking on cadence frames
            t_yolo_0 = time.perf_counter()
            if frame_index == 1 or (frame_index % frame_skip == 0):
                tracked_persons = detector.track(frame)
                raw_count = len(tracked_persons)
            profiler.record_stage("yolo", (time.perf_counter() - t_yolo_0) * 1000.0)

            # 3. Crowd Stabilization
            t_cr_0 = time.perf_counter()
            if frame_index == 1 or (frame_index % frame_skip == 0):
                stable_count = stabilizer.update(raw_count, current_time=video_time)
                crowd_info = crowd_detector.update(stable_count, current_time=video_time)
            profiler.record_stage("crowd", (time.perf_counter() - t_cr_0) * 1000.0)

            # 4. Behaviour Processing
            t_beh_0 = time.perf_counter()
            if frame_index == 1 or (frame_index % frame_skip == 0):
                behavior_output = behavior_processor.update(
                    tracked_persons,
                    current_time=video_time,
                    frame_shape=(height, width)
                )
                for ev in behavior_output.get("new_events", []):
                    print(f"[{ev.severity.upper()} ALERT] {ev.get_display_title()} | "
                          f"Person(s): {ev.person_ids} | Conf: {int(ev.confidence * 100)}% | Time: {ev.get_display_timestamp()}")
            profiler.record_stage("behavior", (time.perf_counter() - t_beh_0) * 1000.0)

            # 5. UI / HUD Rendering
            t_ui_0 = time.perf_counter()
            metrics = profiler.get_metrics()
            annotated_frame = draw_behavior_overlay(
                frame,
                tracked_persons,
                behavior_output,
                history_manager=behavior_processor.history_manager,
                fps=metrics["fps"] if metrics["fps"] > 0 else fps,
                camera_id=behavior_cfg.camera_id,
                location=behavior_cfg.location,
                current_time=video_time,
                raw_count=raw_count,
                stable_count=stable_count,
                crowd_info=crowd_info,
                profiler_metrics=metrics,
                device_name=detector.device.upper(),
                imgsz=detector.imgsz,
                ui_mode=args.ui_mode,
                show_box_labels=True,
                show_hud=True
            )
            profiler.record_stage("ui", (time.perf_counter() - t_ui_0) * 1000.0)

            # 6. Video Writer
            if writer:
                t_out_0 = time.perf_counter()
                writer.write(annotated_frame)
                profiler.record_stage("output", (time.perf_counter() - t_out_0) * 1000.0)

            # Total Frame Time
            t_tot = (time.perf_counter() - t_frame_start) * 1000.0
            profiler.record_stage("total", t_tot)

            # Display
            if not args.headless:
                cv2.imshow(window_name, annotated_frame)
                elapsed_proc_ms = (time.perf_counter() - t_frame_start) * 1000.0
                wait_delay_ms = max(1, int(target_delay_ms - elapsed_proc_ms))

                key = cv2.waitKey(wait_delay_ms) & 0xFF
                if key == ord('q') or key == ord('Q'):
                    print("[INFO] Playback stopped by user.")
                    break

            if args.max_frames and frame_index >= args.max_frames:
                print(f"[INFO] Reached max requested frames ({args.max_frames}). Stopping.")
                break

    finally:
        cap.release()
        if writer:
            writer.release()
        if not args.headless:
            cv2.destroyAllWindows()
        print(f"[INFO] Processed {frame_index} frames. Resources released successfully.")
        print(profiler.summary_table())

if __name__ == "__main__":
    main()
