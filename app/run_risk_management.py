"""
AI Campus Guard - Central Risk Management Runner
Master entry point coordinating video capture, dynamic feature initialization, single-pass inference,
multi-threat aggregation, and the unified surveillance HUD.
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
from features.risk_assessment import (
    RiskManagementOrchestrator,
    RiskEvent,
    RollingFPSTracker,
    InteractiveMenuController,
    draw_risk_assessment_overlay
)

def parse_arguments():
    parser = argparse.ArgumentParser(description="AI Campus Guard - Risk Management Central Orchestrator")
    parser.add_argument("--preset", type=str, default="risk_assessment.yaml", help="Preset configuration YAML file (e.g. risk_assessment.yaml)")
    parser.add_argument("--video", type=str, default=None, help="Path to input video file or webcam index (e.g. 0)")
    parser.add_argument("--performance-mode", type=str, default="balanced", choices=["quality", "balanced", "performance"], help="Performance profile")
    parser.add_argument("--imgsz", type=int, default=None, help="Inference resolution override (e.g. 640, 512, 416)")
    parser.add_argument("--device", type=str, default="auto", help="Compute device: 'auto', 'cpu', 'cuda'")
    parser.add_argument("--ui-mode", type=str, default="demo", choices=["demo", "debug"], help="HUD mode: 'demo' (clean) or 'debug' (technical telemetry)")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode without GUI window")
    parser.add_argument("--save-output", type=str, default=None, help="Optional output video file path to save annotated feed")
    parser.add_argument("--max-frames", type=int, default=None, help="Optional max frames limit for automated testing")
    parser.add_argument("--scenario", type=str, default=None, choices=["crowd", "fight", "breach", "luggage", "compound"], help="Optional scenario injection for rapid evaluation")
    parser.add_argument("--profile", action="store_true", help="Print real-time performance breakdown")
    parser.add_argument("--multi-cam", action="store_true", help="Run 4-Camera Video Quad Grid Surveillance Dashboard")
    return parser.parse_known_args()[0]

def main():
    print("===========================================")
    print("         AI CAMPUS GUARD SURVEILLANCE       ")
    print("      Runner: Risk Management Master       ")
    print("===========================================")

    args = parse_arguments()

    # Load preset configuration
    config.load_preset(args.preset)

    # Read raw preset data
    preset_data = {}
    preset_file = os.path.join(config.PRESETS_DIR, args.preset)
    if os.path.exists(preset_file):
        try:
            with open(preset_file, "r", encoding="utf-8") as f:
                preset_data = yaml.safe_load(f) or {}
        except Exception as e:
            print(f"[WARNING] Could not read preset YAML: {e}")

    # Configure Performance Profile
    if args.performance_mode == "quality":
        default_imgsz = 640
    elif args.performance_mode == "performance":
        default_imgsz = 416
    else:  # balanced
        default_imgsz = 512

    imgsz = args.imgsz if args.imgsz is not None else preset_data.get("inference_size", default_imgsz)

    # -------------------------------------------------------------
    # Multi-Camera 2x2 Quad Grid Surveillance Mode (--multi-cam)
    # -------------------------------------------------------------
    if args.multi_cam:
        from features.risk_assessment import MultiCameraOrchestrator
        print("\n===========================================")
        print("   MULTI-CAMERA 2X2 QUAD SURVEILLANCE GUI  ")
        print("===========================================")
        print("Camera Matrix:")
        print("  • CAM-01 : Canteen Quad      (Crowd Density)")
        print("  • CAM-02 : Hostel Corridor   (Behavior / Fight / Fall)")
        print("  • CAM-03 : Server Room       (Restricted Polygon Zone)")
        print("  • CAM-04 : Main Lobby        (Abandoned Luggage)")
        print("-------------------------------------------")
        print("Press 'Q' in the Video Quad Grid to quit.")
        print("===========================================\n")

        multi_orch = MultiCameraOrchestrator(
            device=args.device,
            imgsz=imgsz,
            enable_profiling=args.profile
        )

        win_name = "AI Campus Guard - 4-Camera Master Quad Grid"
        if not args.headless:
            cv2.namedWindow(win_name, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(win_name, 1280, 720)

        frame_idx = 0
        fps_tr = RollingFPSTracker(window_size=30)

        try:
            while True:
                t0 = time.time()
                frame_idx += 1
                curr_t = frame_idx / 25.0
                rfps, _ = fps_tr.update()

                out = multi_orch.process_multi_cam_step(current_time=curr_t, frame_index=frame_idx)
                quad_grid = out["quad_grid"]
                risk_out = out["risk_output"]

                for alert in risk_out.get("new_alerts", []):
                    print(f"[{alert['risk_level']} ALERT] {alert['title']} | Score: {alert['risk_score']}/100 | Source: {alert['sources']}")

                if args.profile and (frame_idx % 30 == 0):
                    print(multi_orch.profiler.format_report())

                if not args.headless:
                    cv2.imshow(win_name, quad_grid)
                    proc_ms = (time.time() - t0) * 1000.0
                    w_ms = max(1, int(40.0 - proc_ms))
                    k = cv2.waitKey(w_ms) & 0xFF
                    if k in (ord('q'), ord('Q')):
                        print("[INFO] Multi-Camera playback stopped by user.")
                        break
                else:
                    proc_ms = (time.time() - t0) * 1000.0
                    w_ms = max(1, int(40.0 - proc_ms))
                    time.sleep(w_ms / 1000.0)

                if args.max_frames and frame_idx >= args.max_frames:
                    print(f"[INFO] Multi-Cam mode reached max requested frames ({args.max_frames}). Stopping.")
                    break
        finally:
            multi_orch.release()
            if not args.headless:
                cv2.destroyAllWindows()
            print(f"[INFO] Multi-Camera Surveillance session ended cleanly ({frame_idx} frames).")
        return

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
    elif args.performance_mode == "performance":
        default_imgsz = 416
    else:  # balanced
        default_imgsz = 512

    imgsz = args.imgsz if args.imgsz is not None else preset_data.get("inference_size", default_imgsz)

    # Initialize Master Orchestrator
    orchestrator = RiskManagementOrchestrator(
        config_data=preset_data,
        device=args.device,
        imgsz=imgsz
    )

    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"[ERROR] Could not open video stream: '{source_desc}'")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Preset                : {args.preset}")
    print(f"Source                : {source_desc}")
    print(f"Source FPS            : {fps:.2f}" if fps > 0 else f"Source FPS            : {fps}")
    print(f"Resolution            : {width} x {height} px")
    print(f"Performance Profile   : {args.performance_mode.upper()} (imgsz={imgsz})")
    print(f"UI Mode               : {args.ui_mode.upper()}")
    print("-------------------------------------------")
    print("Active Feature Matrix:")
    for feat, status in orchestrator.feature_statuses.items():
        print(f"  • {feat:22s} : {status}")
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

    target_delay_ms = 1000.0 / fps if (fps and fps > 0) else 33.0
    window_name = "AI Campus Guard - Risk Management Orchestrator"
    frame_index = 0
    fps_tracker = RollingFPSTracker(window_size=30)
    controller = InteractiveMenuController(zone_configs=orchestrator.zone_configs)

    if not args.headless:
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        cv2.setMouseCallback(window_name, controller.on_mouse, param=orchestrator)

    try:
        while cap.isOpened():
            start_time_frame = time.time()
            ret, frame = cap.read()
            if not ret:
                print("[INFO] End of video stream reached.")
                break

            frame_index += 1
            video_time = (frame_index / fps) if (fps and fps > 0) else (frame_index / 30.0)
            rolling_fps, avg_proc_ms = fps_tracker.update()

            # Optional scenario injection
            injected_events = []
            if args.scenario == "fight" and frame_index > 20:
                injected_events.append(RiskEvent("INJ-01", "behavior_detection", "potential_violent_activity", 0.92, video_time, "high", [1, 2]))
            elif args.scenario == "compound" and frame_index > 20:
                injected_events.append(RiskEvent("INJ-01", "restricted_area", "zone_breach", 0.95, video_time, "critical", [1], zone_name="LAB ZONE"))
                injected_events.append(RiskEvent("INJ-02", "behavior_detection", "potential_violent_activity", 0.90, video_time, "high", [1, 2]))

            # 1. Master Frame Processing via Orchestrator
            orch_output = orchestrator.process_frame(
                frame=frame,
                current_time=video_time,
                frame_index=frame_index,
                injected_events=injected_events
            )

            risk_output = orch_output["risk_output"]

            # Pipeline & Coordinate Audit Logging
            if frame_index == 1 or (frame_index == 5 and orch_output.get("tracked_persons")):
                orig_h, orig_w = frame.shape[:2]
                inf_sz = getattr(orchestrator.detector, "imgsz", imgsz) if orchestrator.detector else imgsz
                example_box = orch_output["tracked_persons"][0]["box"] if orch_output.get("tracked_persons") else "Pending detections..."
                print("\n===========================================")
                print("       PIPELINE & COORDINATE AUDIT         ")
                print("===========================================")
                print(f"ORIGINAL_FRAME_SIZE  : {orig_w} x {orig_h} px")
                print(f"INFERENCE_FRAME_SIZE : {inf_sz} px (YOLO internal tensor)")
                print(f"DISPLAY_FRAME_SIZE   : {orig_w} x {orig_h} px (1:1 Native Pixel Match)")
                print(f"COORDINATE SYSTEM    : Canonical Native Frame Pixels (Zero Discrepancy)")
                print(f"EXAMPLE DETECTION BOX: {example_box}")
                print("===========================================\n")

            # Log new alerts
            for alert in risk_output.get("new_alerts", []):
                print(f"[{alert['risk_level']} ALERT] {alert['title']} | Score: {alert['risk_score']}/100 | Sources: {alert['sources']}")

            # 2. Draw Unified Risk, Person Tracking, Menu & Diagnostics HUD
            annotated_frame = draw_risk_assessment_overlay(
                frame=frame,
                risk_output=risk_output,
                fps=rolling_fps,
                camera_id="CAM-01",
                ui_mode=args.ui_mode,
                show_hud=True,
                feature_statuses=orch_output.get("feature_statuses"),
                tracked_persons=orch_output.get("tracked_persons"),
                tracked_objects=orch_output.get("tracked_objects"),
                feature_outputs=orch_output.get("feature_outputs"),
                zone_configs=orch_output.get("zone_configs"),
                show_person_boxes=True,
                show_tracking_ids=True,
                show_person_status=True,
                show_confidence=True,
                controller=controller,
                performance_summary=orch_output.get("performance_summary")
            )

            # Periodic Performance Profiling Log
            if args.profile and (frame_index % 30 == 0):
                print(orchestrator.profiler.format_report())

            if writer:
                writer.write(annotated_frame)

            # 3. GUI display
            if not args.headless:
                cv2.imshow(window_name, annotated_frame)
                elapsed_proc_ms = (time.time() - start_time_frame) * 1000.0
                wait_delay_ms = max(1, int(target_delay_ms - elapsed_proc_ms))

                raw_key = cv2.waitKey(wait_delay_ms)
                if raw_key != -1:
                    key = raw_key & 0xFF
                    if key in (ord('q'), ord('Q')):
                        print("[INFO] Playback stopped by user.")
                        break
                    # Forward to interactive controller
                    controller.handle_key(raw_key, width, height, orchestrator)

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
