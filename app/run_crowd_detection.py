"""
AI Campus Guard - Crowd Detection Feature Runner
Standalone entry point script for Crowd Detection module.
"""

import os
import sys

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

    stabilizer = CountStabilizer(
        window_size=config.COUNT_SMOOTHING_WINDOW,
        drop_confirmation_seconds=config.COUNT_DROP_CONFIRMATION_SECONDS
    )

    crowd_detector = CrowdDetector(
        person_threshold=config.PERSON_THRESHOLD,
        persistence_seconds=config.PERSISTENCE_SECONDS
    )

    # Open Video Capture
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video stream: '{video_path}'")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Video Source          : {video_path}")
    print(f"FPS                   : {fps:.2f}" if fps > 0 else f"FPS                   : {fps}")
    print(f"Resolution            : {width} x {height} px")
    print(f"Total Frames          : {total_frames}")
    print(f"Model Path            : {config.MODEL_PATH}")
    print(f"Tracker               : {config.TRACKER_TYPE}")
    print(f"Person Threshold      : {config.PERSON_THRESHOLD}")
    print(f"Persistence Time      : {config.PERSISTENCE_SECONDS}s")
    print("-------------------------------------------")
    print("Press 'Q' key in the video window to quit.")

    delay = int(1000 / fps) if fps and fps > 0 else 30
    window_name = "AI Campus Guard - Crowd Detection"

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                print("[INFO] End of video stream reached.")
                break

            # 1. Perform person tracking using ByteTrack
            tracked_persons = detector.track(frame)
            raw_count = len(tracked_persons)

            # 2. Stabilize current raw count
            stable_count = stabilizer.update(raw_count)

            # 3. Update crowd detection state using stable count
            crowd_info = crowd_detector.update(stable_count)

            # 4. Draw visualization on frame (Track ID hidden visually)
            frame = draw_crowd_detections(frame, tracked_persons, raw_count, stable_count, crowd_info)

            # 5. Display the frame
            cv2.imshow(window_name, frame)

            key = cv2.waitKey(delay) & 0xFF
            if key == ord('q') or key == ord('Q'):
                print("[INFO] Video playback stopped by user.")
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("[INFO] Resources released successfully.")

if __name__ == "__main__":
    main()
