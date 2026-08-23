"""
AI Campus Guard - Restricted Area Detection Feature Runner
Standalone entry point script for testing polygon ROI zone intrusion detection.
Supports video FPS timeline synchronization, dynamic delay compensation, and frame-skipping for lag-free playback.
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
from features.crowd_detection import PersonDetector
from features.restricted_area import (
    RestrictedAreaProcessor,
    draw_restricted_area_overlay
)

def parse_arguments():
    parser = argparse.ArgumentParser(description="AI Campus Guard - Restricted Area Runner")
    parser.add_argument("--preset", type=str, default="restricted_area.yaml", help="Preset configuration YAML file")
    parser.add_argument("--video", type=str, default=None, help="Path to input video file or webcam index (e.g. 0)")
    parser.add_argument("--imgsz", type=int, default=None, help="Inference resolution override (e.g. 640, 512, 416)")
    parser.add_argument("--frame-skip", type=int, default=None, help="Process every Nth frame override")
    parser.add_argument("--device", type=str, default="auto", help="Compute device: 'auto', 'cpu', 'cuda', 'cuda:0'")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode without GUI window")
    parser.add_argument("--save-output", type=str, default=None, help="Optional output video file path to save annotated feed")
    parser.add_argument("--max-frames", type=int, default=None, help="Optional max frames limit for automated testing")
    return parser.parse_known_args()[0]

def main():
    print("===========================================")
    print("         AI CAMPUS GUARD SURVEILLANCE       ")
    print("     Runner: Restricted Area Detection     ")
    print("===========================================")

    args = parse_arguments()

    # Load preset configuration
    config.load_preset(args.preset)

    # Read raw preset data for additional parameters
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

    # Read optimized imgsz and frame_skip for smooth 25 FPS playback
    default_imgsz = preset_data.get("inference_size", 512)
    imgsz = args.imgsz if args.imgsz is not None else default_imgsz
    frame_skip = args.frame_skip if args.frame_skip is not None else preset_data.get("frame_skip", getattr(config, "FRAME_SKIP", 2))

    # Initialize YOLO + ByteTrack Person Detector
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

    # Read zone configuration from loaded preset data
    zone_configs = preset_data.get("zones", getattr(config, "ZONES", None))

    # Fallback default zone if none defined
    if not zone_configs:
        zone_configs = [{
            "name": "RESTRICTED ZONE A",
            "enabled": True,
            "severity": "high",
            "points": [[50, 50], [400, 50], [400, 300], [50, 300]]
        }]

    processor = RestrictedAreaProcessor(
        zone_configs=zone_configs,
        camera_id=preset_data.get("camera_id", getattr(config, "CAMERA_ID", "CAM-01")),
        location=preset_data.get("location", getattr(config, "LOCATION", "Campus Grounds"))
    )

    print(f"Video Source          : {source_desc}")
    print(f"FPS                   : {fps:.2f}" if fps > 0 else f"FPS                   : {fps}")
    print(f"Resolution            : {width} x {height} px")
    print(f"Total Frames          : {total_frames}")
    print(f"Device                : {detector.device.upper()}")
    print(f"Performance Profile   : SMOOTH (imgsz={imgsz}, frame_skip={frame_skip})")
    print(f"Active Zones          : {len(processor.zone_manager.zones)}")
    for z in processor.zone_manager.zones:
        print(f"  - [{z.severity.upper()}] {z.name} ({len(z.raw_points)} points)")
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
    window_name = "AI Campus Guard - Restricted Area Monitor"
    frame_index = 0

    tracked_persons = []
    processor_output = {
        "new_events": [],
        "active_events": [],
        "active_intruders": [],
        "zone_statuses": {},
        "summary": {"total_persons": 0, "active_intruders_count": 0, "has_breach": False, "status": "SECURE"}
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

            # 1. Perform YOLO tracking on non-skipped frames
            if frame_index == 1 or (frame_index % frame_skip == 0):
                tracked_persons = detector.track(frame)

                # 2. Update Restricted Area Processor
                processor_output = processor.update(tracked_persons, current_time=video_time)

                for ev in processor_output.get("new_events", []):
                    print(f"[{ev.severity.upper()} {ev.event_type.upper()}] {ev.get_display_title()} | "
                          f"Person(s): {ev.person_ids} | Time: {ev.get_display_timestamp()}")

            # 3. Draw visualization on current frame
            annotated_frame = draw_restricted_area_overlay(
                frame,
                tracked_persons,
                processor_output,
                zone_manager=processor.zone_manager,
                show_hud=True
            )

            # 4. Save video frame if requested
            if writer:
                writer.write(annotated_frame)

            # 5. Display frame with dynamic delay compensation for smooth playback
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
