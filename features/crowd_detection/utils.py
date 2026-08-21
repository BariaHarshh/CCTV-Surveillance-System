"""
Visualization Utilities for Crowd Detection Feature
"""

import cv2

def draw_crowd_detections(frame, detections, raw_count, stable_count, crowd_info):
    """
    Draws bounding boxes, labels (without Track IDs), and HUD status overlay on the frame.
    """
    # 1. Draw individual person bounding boxes and confidence labels
    for det in detections:
        x1, y1, x2, y2 = det["box"]
        conf = det["confidence"]

        color = (0, 255, 0)
        thickness = 2
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

        # Label format: PERSON 92% (Track ID hidden from UI presentation)
        label = f"PERSON {int(conf * 100)}%"

        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        font_thickness = 1
        (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, font_thickness)

        label_y1 = max(y1 - text_h - 6, 0)
        cv2.rectangle(frame, (x1, label_y1), (x1 + text_w + 4, label_y1 + text_h + baseline + 4), color, -1)
        cv2.putText(frame, label, (x1 + 2, label_y1 + text_h + 2), font, font_scale, (0, 0, 0), font_thickness, cv2.LINE_AA)

    # 2. Draw Crowd Detection HUD Overlay (Top-Left corner)
    status = crowd_info["status"]
    threshold = crowd_info["threshold"]
    prog_sec = crowd_info["confirmation_progress_seconds"]
    req_sec = crowd_info["required_persistence_seconds"]

    if status == "NORMAL":
        status_color = (0, 255, 0)        # Green
        bg_color = (30, 30, 30)
    elif status == "CHECKING CROWD":
        status_color = (0, 215, 255)      # Yellow/Gold
        bg_color = (30, 30, 30)
    else:  # "CROWD DETECTED"
        status_color = (0, 0, 255)        # Bright Red
        bg_color = (0, 0, 80)             # Dark Red panel background

    panel_height = 135 if status == "CHECKING CROWD" else 115
    cv2.rectangle(frame, (10, 10), (330, panel_height), bg_color, -1)
    cv2.rectangle(frame, (10, 10), (330, panel_height), status_color, 2)

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
