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
from backend.services.publisher import AsyncDetectionPublisher
from backend.services.stream_manager import stream_manager

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

    publisher = AsyncDetectionPublisher(
        update_interval=getattr(config, "FRONTEND_UPDATE_INTERVAL", 0.5),
        enabled=getattr(config, "ENABLE_FRONTEND_PUBLISH", True),
        organization_id=getattr(config, "ORGANIZATION_ID", None),
        camera_id=getattr(config, "CAMERA_ID", None),
    )

    frame_skip = getattr(config, "FRAME_SKIP", 2)

    camera_id = getattr(config, "CAMERA_ID", "66d550000000000000000002")

    headless = os.getenv("HEADLESS", "false").lower() in ("true", "1", "yes") or "--headless" in sys.argv

    print(f"Video Source          : {video_path}")
    print(f"FPS                   : {fps:.2f}" if fps > 0 else f"FPS                   : {fps}")
    print(f"Resolution            : {width} x {height} px")
    print(f"Total Frames          : {total_frames}")
    print(f"Model Path            : {config.MODEL_PATH}")
    print(f"Tracker               : {config.TRACKER_TYPE}")
    print(f"Frame Skip            : Every {frame_skip} frames (Lag Optimization Active)")
    print(f"Person Threshold      : {config.PERSON_THRESHOLD}")
    print(f"Persistence Time      : {config.PERSISTENCE_SECONDS}s")
    print(f"Frontend Bridge       : {'Active' if publisher.enabled else 'Disabled'} (interval={publisher.update_interval}s)")
    print(f"Live MJPEG Stream     : Active (Camera: {camera_id})")
    print(f"Display Mode          : {'Headless (Web Stream Only)' if headless else 'OpenCV Desktop Window'}")
    print("-------------------------------------------")
    if not headless:
        print("Press 'Q' key in the video window to quit.")
    else:
        print("Surveillance running in background. Stream viewable in web portal.")

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
                # Continuously loop video source for live camera feed simulation
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
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

                # 4. Asynchronously publish detection result to frontend bridge
                publisher.publish_crowd_detection(
                    raw_count=raw_count,
                    stable_count=stable_count,
                    crowd_info=crowd_info,
                    tracked_persons=tracked_persons,
                    frame_width=width,
                    frame_height=height,
                    camera_id=camera_id,
                )

            # 5. Draw visualization on current frame
            annotated_frame = draw_crowd_detections(frame, tracked_persons, raw_count, stable_count, crowd_info)

            # 6. Update live stream buffer with the exact annotated frame (non-blocking)
            stream_manager.update_frame(
                camera_id=camera_id,
                frame=annotated_frame,
                quality=getattr(config, "STREAM_JPEG_QUALITY", 80),
                frame_index=frame_index,
            )

            # 7. Display the frame or sleep frame cadence if headless
            elapsed_proc_ms = (time.time() - start_time_frame) * 1000.0
            wait_delay_ms = max(1, int(target_delay_ms - elapsed_proc_ms))

            if not headless:
                cv2.imshow(window_name, annotated_frame)
                key = cv2.waitKey(wait_delay_ms) & 0xFF
                if key == ord('q') or key == ord('Q'):
                    print("[INFO] Video playback stopped by user.")
                    break
            else:
                time.sleep(wait_delay_ms / 1000.0)
    finally:
        publisher.stop()
        cap.release()
        if not headless:
            cv2.destroyAllWindows()
        print("[INFO] Resources released successfully.")

if __name__ == "__main__":
    main()
