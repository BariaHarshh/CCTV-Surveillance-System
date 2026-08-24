"""
AI Campus Guard - Abandoned Object Detection Feature Runner
Standalone entry point script for testing unattended object detection (backpacks, handbags, suitcases, bottles).
Supports single-pass multi-class YOLO tracking, FPS synchronization, dynamic delay compensation, and HUD overlay.
"""

import os
import sys
import time
import argparse
import yaml

# Ensure root repository directory is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import cv2
import config.config as config
from features.abandoned_object import (
    MultiObjectDetector,
    AbandonedObjectProcessor,
    AbandonedObjectConfig,
    draw_abandoned_object_overlay
)

def parse_arguments():
    parser = argparse.ArgumentParser(description="AI Campus Guard - Abandoned Object Runner")
    parser.add_argument("--preset", type=str, default="abandoned_object.yaml", help="Preset configuration YAML file")
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
    print("     Runner: Abandoned Object Detection    ")
    print("===========================================")

    args = parse_arguments()

    # Load preset configuration
    config.load_preset(args.preset)

    # Read raw preset data for feature-specific parameters
    preset_data = {}
    preset_file = os.path.join(config.PRESETS_DIR, args.preset)
    if os.path.exists(preset_file):
        try:
            with open(preset_file, "r", encoding="utf-8") as f:
                preset_data = yaml.safe_load(f) or {}
        except Exception as e:
            print(f"[WARNING] Could not read raw preset YAML: {e}")

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

    # Initialize MultiObjectDetector
    detector = MultiObjectDetector(
        model_path=config.MODEL_PATH,
        confidence_threshold=config.CONFIDENCE_THRESHOLD,
        tracker_type=config.TRACKER_TYPE,
        device=args.device,
        imgsz=imgsz
    )
    if detector.model is None:
        print("[ERROR] Could not initialize MultiObjectDetector. Exiting.")
        return

    # Initialize AbandonedObjectProcessor
    feature_cfg = AbandonedObjectConfig.from_dict(preset_data)
    processor = AbandonedObjectProcessor(config=feature_cfg)

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video stream: '{source_desc}'")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Source                : {source_desc}")
    print(f"Source FPS            : {fps:.2f}" if fps > 0 else f"Source FPS            : {fps}")
    print(f"Resolution            : {width} x {height} px")
    print(f"Total Frames          : {total_frames if total_frames > 0 else 'Live Stream'}")
    print(f"Device                : {detector.device.upper()}")
    print(f"Performance Profile   : {args.performance_mode.upper()} (imgsz={imgsz}, frame_skip={frame_skip})")
    print(f"UI Mode               : {args.ui_mode.upper()}")
    print("-------------------------------------------")
    print("Features Active: Person Tracking + Abandoned Object Analysis")
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
    window_name = "AI Campus Guard - Abandoned Object Monitor"
    frame_index = 0

    tracked_persons = []
    tracked_objects = []
    abandoned_output = {
        "new_events": [],
        "active_events": [],
        "event_history": [],
        "object_states": {},
        "summary": {"total_objects": 0, "unattended_count": 0, "abandoned_count": 0, "has_alert": False}
    }

    try:
        while cap.isOpened():
            start_time_frame = time.time()
            ret, frame = cap.read()
            if not ret:
                print("[INFO] End of video stream reached.")
                break

            frame_index += 1
            video_time = (frame_index / fps) if (fps and fps > 0) else (frame_index / 30.0)

            # 1. Single-pass detection and tracking on cadence frames
            if frame_index == 1 or (frame_index % frame_skip == 0):
                tracked_persons, tracked_objects = detector.track(frame)

                # 2. Process abandoned object state machine
                abandoned_output = processor.update(
                    tracked_objects=tracked_objects,
                    tracked_persons=tracked_persons,
                    current_time=video_time,
                    frame_shape=(height, width)
                )

                # Log newly generated events
                for ev in abandoned_output.get("new_events", []):
                    print(f"[{ev.severity.upper()} ALERT] {ev.get_display_title()} | "
                          f"Unattended: {ev.unattended_duration:.1f}s | Conf: {int(ev.confidence * 100)}% | Time: {ev.get_display_timestamp()}")

            # 3. Draw HUD overlay
            annotated_frame = draw_abandoned_object_overlay(
                frame,
                tracked_persons=tracked_persons,
                abandoned_output=abandoned_output,
                fps=fps,
                camera_id=feature_cfg.camera_id,
                location=feature_cfg.location,
                ui_mode=args.ui_mode,
                show_hud=True
            )

            if writer:
                writer.write(annotated_frame)

            # 4. Display frame (unless headless)
            if not args.headless:
                cv2.imshow(window_name, annotated_frame)
                elapsed_proc_ms = (time.time() - start_time_frame) * 1000.0
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

if __name__ == "__main__":
    main()
