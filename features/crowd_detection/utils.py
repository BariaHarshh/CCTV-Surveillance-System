"""
Visualization Utilities for Crowd Detection Feature
"""

import cv2

def draw_crowd_detections(frame, detections, raw_count, stable_count, crowd_info):
    """
    Draws bounding boxes, labels (without Track IDs), and semi-transparent HUD status overlay on the frame.
    """
    # 1. Draw individual person bounding boxes and confidence labels
    for det in detections:
        x1, y1, x2, y2 = det["box"]
        conf = det["confidence"]

        color = (0, 255, 0)
        thickness = 2
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

        # Label format: PERSON #1 92% (includes Track ID when available)
        track_id = det.get("track_id")
        if track_id is not None:
            label = f"PERSON #{track_id} {int(conf * 100)}%"
        else:
            label = f"PERSON {int(conf * 100)}%"

        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        font_thickness = 1
        (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, font_thickness)

        label_y1 = max(y1 - text_h - 6, 0)
        cv2.rectangle(frame, (x1, label_y1), (x1 + text_w + 4, label_y1 + text_h + baseline + 4), color, -1)
        cv2.putText(frame, label, (x1 + 2, label_y1 + text_h + 2), font, font_scale, (0, 0, 0), font_thickness, cv2.LINE_AA)

    # 2. Draw Crowd Detection HUD Overlay (Top-Left corner) with semi-transparent glass effect
    status = crowd_info["status"]
    threshold = crowd_info["threshold"]
    prog_sec = crowd_info["confirmation_progress_seconds"]
    req_sec = crowd_info["required_persistence_seconds"]

    if status == "NORMAL":
        status_color = (0, 255, 0)        # Green
        bg_color = (20, 20, 20)
    elif status == "CHECKING CROWD":
        status_color = (0, 215, 255)      # Yellow/Gold
        bg_color = (20, 20, 20)
    else:  # "CROWD DETECTED"
        status_color = (0, 0, 255)        # Bright Red
        bg_color = (0, 0, 60)             # Dark Red panel background

    panel_x1, panel_y1 = 10, 10
    panel_x2 = 330
    panel_y2 = 135 if status == "CHECKING CROWD" else 115

    # Create semi-transparent overlay using cv2.addWeighted (55% opacity dark glass panel)
    overlay = frame.copy()
    cv2.rectangle(overlay, (panel_x1, panel_y1), (panel_x2, panel_y2), bg_color, -1)
    alpha = 0.55
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

    # Draw sharp panel border
    cv2.rectangle(frame, (panel_x1, panel_y1), (panel_x2, panel_y2), status_color, 2)

    # Text overlay lines
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(frame, f"RAW PEOPLE: {raw_count}", (20, 35), font, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, f"STABLE PEOPLE: {stable_count}", (20, 60), font, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, f"THRESHOLD: {threshold}", (20, 85), font, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, f"STATUS: {status}", (20, 108), font, 0.6, status_color, 2, cv2.LINE_AA)

    if status == "CHECKING CROWD":
        cv2.putText(
            frame,
            f"CROWD CHECK: {prog_sec:.1f} / {req_sec:.1f} sec",
            (20, 128),
            font,
            0.5,
            (0, 215, 255),
            1,
            cv2.LINE_AA
        )

    return frame


def normalize_tracked_persons(tracked_persons, frame_width, frame_height):
    """
    Normalizes tracked bounding boxes to 0.0 - 1.0 coordinate space for frontend rendering.

    Args:
        tracked_persons (list): List of tracked person dicts with "box" and "track_id".
        frame_width (int): Pixel width of the video frame.
        frame_height (int): Pixel height of the video frame.

    Returns:
        list of dict: Normalized person tracking representations.
    """
    if not frame_width or not frame_height or frame_width <= 0 or frame_height <= 0:
        return []

    normalized_list = []
    for person in (tracked_persons or []):
        box = person.get("box", (0, 0, 0, 0))
        x1, y1, x2, y2 = box

        x1_c = max(0, min(frame_width, x1))
        y1_c = max(0, min(frame_height, y1))
        x2_c = max(0, min(frame_width, x2))
        y2_c = max(0, min(frame_height, y2))

        w_px = max(0, x2_c - x1_c)
        h_px = max(0, y2_c - y1_c)

        norm_x = round(x1_c / frame_width, 4)
        norm_y = round(y1_c / frame_height, 4)
        norm_w = round(w_px / frame_width, 4)
        norm_h = round(h_px / frame_height, 4)

        normalized_list.append({
            "trackId": person.get("track_id"),
            "confidence": round(float(person.get("confidence", 1.0)), 3),
            "bbox": {
                "x": norm_x,
                "y": norm_y,
                "width": norm_w,
                "height": norm_h
            }
        })
    return normalized_list
