"""
AI Campus Guard - Restricted Area Visualization Engine
Renders polygon ROI zones, foot anchor points, intruder bounding boxes, and glassmorphic HUD overlays.
"""

import cv2
import numpy as np
from typing import List, Dict, Any, Optional

def draw_restricted_area_overlay(
    frame: np.ndarray,
    tracked_persons: List[Dict[str, Any]],
    processor_output: Dict[str, Any],
    zone_manager: Any,
    show_hud: bool = True
) -> np.ndarray:
    """
    Renders polygon zones, foot anchors, person bounding boxes, and HUD status panel on the frame.
    """
    if frame is None or frame.size == 0:
        return frame

    summary = processor_output.get("summary", {})
    zone_statuses = processor_output.get("zone_statuses", {})
    active_intruders = set(processor_output.get("active_intruders", []))

    # 1. Draw Polygon ROI Zones
    overlay_zones = frame.copy()
    for zone in zone_manager.zones:
        z_info = zone_statuses.get(zone.name, {})
        status = z_info.get("status", "SECURE")

        if status == "ALERT":
            zone_color = (0, 0, 255)       # Red
            fill_color = (0, 0, 120)
        elif status == "CHECKING":
            zone_color = (0, 215, 255)     # Gold / Yellow
            fill_color = (0, 100, 120)
        else:
            zone_color = (0, 255, 0)       # Green
            fill_color = (0, 80, 0)

        # Draw semi-transparent filled polygon
        cv2.fillPoly(overlay_zones, [zone.contour], fill_color)
        
        # Draw thick border line
        cv2.polylines(frame, [zone.contour], isClosed=True, color=zone_color, thickness=2, lineType=cv2.LINE_AA)

        # Draw zone name label near top-left vertex of polygon
        pts = zone.raw_points
        if pts:
            lx, ly = pts[0][0], max(pts[0][1] - 8, 15)
            cv2.putText(frame, zone.name, (lx, ly), cv2.FONT_HERSHEY_SIMPLEX, 0.5, zone_color, 2, cv2.LINE_AA)

    # Apply 35% opacity fill for polygon interiors
    cv2.addWeighted(overlay_zones, 0.35, frame, 0.65, 0, frame)

    # 2. Draw Person Bounding Boxes & Multi-Anchor Points
    for det in tracked_persons:
        tid = det.get("track_id")
        x1, y1, x2, y2 = det["box"]
        conf = det.get("confidence", 1.0)
        box = (x1, y1, x2, y2)

        # Determine if intruder via active_intruders set or direct multi-anchor zone overlap
        is_intruder_by_id = tid in active_intruders if tid is not None else False
        is_intruder_by_geometry = False
        if not is_intruder_by_id and zone_manager is not None:
            containing_zones = zone_manager.get_zones_for_box(box)
            for z in containing_zones:
                z_st = zone_statuses.get(z.name, {}).get("status", "SECURE")
                if z_st == "ALERT":
                    is_intruder_by_geometry = True
                    break

        is_intruder = is_intruder_by_id or is_intruder_by_geometry
        color = (0, 0, 255) if is_intruder else (0, 255, 0)  # Red for intruder, Green for secure

        # Bounding box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        # Draw center anchor dot
        cx = int((x1 + x2) / 2)
        cy = int((y1 + y2) / 2)
        cv2.circle(frame, (cx, cy), 4, (0, 215, 255), -1, cv2.LINE_AA)

        # Bounding box label (Track ID hidden per presentation standards: 'PERSON 92%')
        label = f"{'INTRUDER' if is_intruder else 'PERSON'} {int(conf * 100)}%"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, 1)

        label_y1 = max(y1 - text_h - 6, 0)
        cv2.rectangle(frame, (x1, label_y1), (x1 + text_w + 4, label_y1 + text_h + baseline + 4), color, -1)
        cv2.putText(frame, label, (x1 + 2, label_y1 + text_h + 2), font, font_scale, (255, 255, 255) if is_intruder else (0, 0, 0), 1, cv2.LINE_AA)

    # 3. Draw Semi-Transparent Glassmorphic HUD Dashboard Panel (Top-Left Corner)
    if show_hud:
        has_breach = summary.get("has_breach", False)
        status_text = summary.get("status", "SECURE")
        intruders_cnt = summary.get("active_intruders_count", 0)
        total_persons = summary.get("total_persons", 0)

        status_color = (0, 0, 255) if has_breach else (0, 255, 0)
        bg_color = (0, 0, 60) if has_breach else (20, 20, 20)

        panel_x1, panel_y1 = 10, 10
        panel_x2 = 340
        panel_y2 = 120

        # Glassmorphic overlay blending (55% opacity dark panel)
        hud_overlay = frame.copy()
        cv2.rectangle(hud_overlay, (panel_x1, panel_y1), (panel_x2, panel_y2), bg_color, -1)
        cv2.addWeighted(hud_overlay, 0.55, frame, 0.45, 0, frame)

        # Sharp border
        cv2.rectangle(frame, (panel_x1, panel_y1), (panel_x2, panel_y2), status_color, 2)

        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(frame, f"TOTAL PEOPLE  : {total_persons}", (20, 35), font, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, f"INTRUDERS     : {intruders_cnt}", (20, 60), font, 0.55, (0, 0, 255) if intruders_cnt > 0 else (255, 255, 255), 2, cv2.LINE_AA)
        cv2.putText(frame, f"ZONE STATUS   : {status_text}", (20, 85), font, 0.55, status_color, 2, cv2.LINE_AA)
        cv2.putText(frame, f"RESTRICTED    : {'BREACHED!' if has_breach else 'MONITORED'}", (20, 108), font, 0.5, status_color, 1, cv2.LINE_AA)

    return frame
