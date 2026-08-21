"""
AI Campus Guard - Crowd Detection Feature Runner
Standalone entry point script for Crowd Detection module.
Supports video FPS timeline synchronization, dynamic delay compensation, and frame-skipping for lag-free playback.
"""

import os
import sys
import time

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import cv2
import config.config as config
from features.crowd_detection import (
    PersonDetector,
    CountStabilizer,
    CrowdDetector,
    draw_crowd_detections
)

def main():
    print("===========================================")
    print("         AI CAMPUS GUARD SURVEILLANCE       ")
    print("      Runner: Crowd Detection Feature      ")
    print("===========================================")

    # Load Crowd Detection configuration preset
    config.load_preset("crowd_detection.yaml")

    video_path = config.VIDEO_PATH

    # Validate video existence
    if not os.path.exists(video_path):
        print(f"[ERROR] Video file not found at: '{video_path}'")
        print("Please place your test MP4 video in 'videos/stock/' or 'videos/input/' and check config.")
        return

    # Ensure output directory exists if output path is set
    output_path = config.OUTPUT_PATH
    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Initialize Modules
    detector = PersonDetector(
        model_path=config.MODEL_PATH,
        confidence_threshold=config.CONFIDENCE_THRESHOLD,
        tracker_type=config.TRACKER_TYPE
    )
    if detector.model is None:
        print("[ERROR] Could not initialize PersonDetector. Exiting.")
        return

    # Open Video Capture to retrieve FPS
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video stream: '{video_path}'")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    # Initialize Stabilizer & Detector with FPS awareness
    stabilizer = CountStabilizer(
        window_size=config.COUNT_SMOOTHING_WINDOW,
        drop_confirmation_seconds=config.COUNT_DROP_CONFIRMATION_SECONDS,
        fps=fps
    )

    crowd_detector = CrowdDetector(
        person_threshold=config.PERSON_THRESHOLD,
        persistence_seconds=config.PERSISTENCE_SECONDS
    )

    frame_skip = getattr(config, "FRAME_SKIP", 2)

    print(f"Video Source          : {video_path}")
    print(f"FPS                   : {fps:.2f}" if fps > 0 else f"FPS                   : {fps}")
    print(f"Resolution            : {width} x {height} px")
    print(f"Total Frames          : {total_frames}")
    print(f"Model Path            : {config.MODEL_PATH}")
    print(f"Tracker               : {config.TRACKER_TYPE}")
    print(f"Frame Skip            : Every {frame_skip} frames (Lag Optimization Active)")
    print(f"Person Threshold      : {config.PERSON_THRESHOLD}")
    print(f"Persistence Time      : {config.PERSISTENCE_SECONDS}s")
    print("-------------------------------------------")
    print("Press 'Q' key in the video window to quit.")

    target_delay_ms = 1000.0 / fps if (fps and fps > 0) else 33.0
    window_name = "AI Campus Guard - Crowd Detection"
    frame_index = 0

    # Cache last detection results for smooth playback on skipped frames
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

    try:
        while cap.isOpened():
            start_time_frame = time.time()
            ret, frame = cap.read()
            if not ret:
                print("[INFO] End of video stream reached.")
                break

            frame_index += 1
            video_time = (frame_index / fps) if (fps and fps > 0) else None

            # 1. Perform YOLO tracking on non-skipped frames
            if frame_index == 1 or (frame_index % frame_skip == 0):
                tracked_persons = detector.track(frame)
                raw_count = len(tracked_persons)

                # 2. Stabilize raw count
                stable_count = stabilizer.update(raw_count, current_time=video_time)

                # 3. Update crowd detection state
                crowd_info = crowd_detector.update(stable_count, current_time=video_time)

            # 4. Draw visualization on current frame
            annotated_frame = draw_crowd_detections(frame, tracked_persons, raw_count, stable_count, crowd_info)

            # 5. Display the frame
            cv2.imshow(window_name, annotated_frame)

            # Dynamic waitKey delay calculation: subtract YOLO inference duration from target frame delay
            elapsed_proc_ms = (time.time() - start_time_frame) * 1000.0
            wait_delay_ms = max(1, int(target_delay_ms - elapsed_proc_ms))

            key = cv2.waitKey(wait_delay_ms) & 0xFF
            if key == ord('q') or key == ord('Q'):
                print("[INFO] Video playback stopped by user.")
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("[INFO] Resources released successfully.")

if __name__ == "__main__":
    main()
