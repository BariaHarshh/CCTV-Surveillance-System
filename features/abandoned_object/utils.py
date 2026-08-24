"""
AI Campus Guard - Abandoned Object Surveillance HUD & Visualization Engine
Renders high-visibility, professional AI surveillance overlays for unattended and abandoned items
with localized ROI alpha blending, large typography, Tier-2 prolonged abandonment escalation (20-30 min),
and area-specific staff dispatch notification cards.
"""

from typing import List, Dict, Tuple, Any, Optional
import cv2
import numpy as np
import time
from .event import get_event_timestamp

# ==============================================================================
# 🎨 COLOR PALETTE & STYLES (Cyber / Security Modern UI)
# ==============================================================================
COLOR_BG_DARK = (18, 20, 24)        # Deep Charcoal
COLOR_HEADER_BG = (12, 14, 18)      # Pitch Slate
COLOR_PANEL_BORDER = (50, 58, 72)   # Subtle Border Gray

# Status Colors
COLOR_GREEN = (40, 225, 110)        # Crisp Emerald Green (Attended / Secure / Notified)
COLOR_AMBER = (0, 195, 255)         # Golden Amber (Unattended / Timer Running)
COLOR_ORANGE = (0, 140, 255)        # Vibrant Orange
COLOR_RED = (45, 45, 245)           # Bright Crimson Red (Abandoned Alert / Escalation)
COLOR_CYAN = (240, 210, 50)         # Cyber Cyan Accent
COLOR_WHITE = (250, 250, 250)
COLOR_MUTED = (165, 172, 185)

# ==============================================================================
# 📐 RESPONSIVE SCALING & DRAWING UTILITIES
# ==============================================================================
def get_ui_scale(width: int, height: int) -> float:
    """Calculates responsive UI scaling factor with minimum readability baseline."""
    ref_w = 1280.0
    scale = width / ref_w
    return float(np.clip(scale, 0.70, 1.8))

def fast_roi_blend(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int, bg_color: Tuple[int, int, int], alpha: float = 0.90):
    """Blends a background color over a specific sub-rectangle ROI without copying the full frame."""
    h_img, w_img = frame.shape[:2]
    x1, y1 = max(0, int(x1)), max(0, int(y1))
    x2, y2 = min(w_img, int(x2)), min(h_img, int(y2))
    if x2 <= x1 or y2 <= y1:
        return

    roi = frame[y1:y2, x1:x2]
    bg_block = np.full_like(roi, bg_color, dtype=np.uint8)
    cv2.addWeighted(bg_block, alpha, roi, 1.0 - alpha, 0, roi)

def draw_corner_brackets(
    img: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    color: Tuple[int, int, int],
    length: int = 14,
    thickness: int = 2
):
    """Renders bold corner brackets on bounding boxes."""
    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
    length = max(6, int(length))
    thickness = max(1, int(thickness))

    # Top-Left
    cv2.line(img, (x1, y1), (x1 + length, y1), color, thickness)
    cv2.line(img, (x1, y1), (x1, y1 + length), color, thickness)
    # Top-Right
    cv2.line(img, (x2, y1), (x2 - length, y1), color, thickness)
    cv2.line(img, (x2, y1), (x2, y1 + length), color, thickness)
    # Bottom-Left
    cv2.line(img, (x1, y2), (x1 + length, y2), color, thickness)
    cv2.line(img, (x1, y2), (x1, y2 - length), color, thickness)
    # Bottom-Right
    cv2.line(img, (x2, y2), (x2 - length, y2), color, thickness)
    cv2.line(img, (x2, y2), (x2, y2 - length), color, thickness)

# ==============================================================================
# 1. 🏷️ TOP HEADER COMPONENT
# ==============================================================================
def draw_header(
    frame: np.ndarray,
    fps: float = 30.0,
    camera_id: str = "CAM-01",
    location: Optional[str] = "Campus Public Area",
    system_status: str = "NORMAL",
    ui_scale: float = 1.0
):
    """Renders top surveillance banner with large bold title and live telemetry."""
    h_img, w_img = frame.shape[:2]
    header_h = int(44 * ui_scale)

    fast_roi_blend(frame, 0, 0, w_img, header_h, COLOR_HEADER_BG, alpha=0.90)

    line_col = COLOR_RED if system_status in ["ALERT", "ESCALATED"] else (COLOR_AMBER if system_status == "UNATTENDED" else COLOR_CYAN)
    cv2.line(frame, (0, header_h), (w_img, header_h), line_col, max(2, int(2.0 * ui_scale)))

    font = cv2.FONT_HERSHEY_SIMPLEX
    x_left = int(16 * ui_scale)
    y_title = int(22 * ui_scale)
    y_sub = int(36 * ui_scale)

    cv2.putText(frame, "AI CAMPUS GUARDIAN", (x_left, y_title), font, 0.62 * ui_scale, COLOR_WHITE, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)
    cv2.putText(frame, "Abandoned Object Intelligence", (x_left, y_sub), font, 0.42 * ui_scale, COLOR_MUTED, 1, cv2.LINE_AA)

    dot_col = COLOR_RED if system_status in ["ALERT", "ESCALATED"] else (COLOR_AMBER if system_status == "UNATTENDED" else COLOR_GREEN)
    fps_val = fps if (fps and fps > 0) else 30.0
    loc_str = location if location else "Campus Public Zone"
    right_text = f"LIVE  |  {camera_id}  |  {loc_str}  |  {fps_val:.1f} FPS"

    (tw, th), _ = cv2.getTextSize(right_text, font, 0.46 * ui_scale, 1)
    x_right = w_img - tw - int(24 * ui_scale)

    dot_x = x_right - int(12 * ui_scale)
    dot_y = int(22 * ui_scale)
    cv2.circle(frame, (dot_x, dot_y), max(3, int(5 * ui_scale)), dot_col, -1)
    cv2.putText(frame, right_text, (x_right, int(27 * ui_scale)), font, 0.46 * ui_scale, COLOR_WHITE, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

# ==============================================================================
# 2. 📊 BOTTOM INFORMATION PANEL COMPONENT
# ==============================================================================
def draw_bottom_panel(
    frame: np.ndarray,
    total_objects: int = 0,
    unattended_count: int = 0,
    abandoned_count: int = 0,
    people_count: int = 0,
    system_status: str = "NORMAL",
    ui_scale: float = 1.0
):
    """Renders bottom information strip with item counts and status."""
    h_img, w_img = frame.shape[:2]
    panel_h = int(42 * ui_scale)
    y_start = h_img - panel_h

    fast_roi_blend(frame, 0, y_start, w_img, h_img, COLOR_HEADER_BG, alpha=0.90)
    cv2.line(frame, (0, y_start), (w_img, y_start), COLOR_PANEL_BORDER, 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    f_scale = 0.50 * ui_scale
    y_text = y_start + int(27 * ui_scale)

    # Section 1: Tracked Objects
    x1 = int(20 * ui_scale)
    cv2.putText(frame, f"OBJECTS: {total_objects:02d}", (x1, y_text), font, f_scale, COLOR_WHITE, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

    # Section 2: Unattended & Abandoned Counts
    x2 = int(w_img * 0.30)
    u_col = COLOR_RED if abandoned_count > 0 else (COLOR_AMBER if unattended_count > 0 else COLOR_GREEN)
    cv2.putText(frame, f"UNATTENDED: {unattended_count:02d} (ABANDONED: {abandoned_count:02d})", (x2, y_text), font, f_scale, u_col, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

    # Section 3: People in Scene
    x3 = int(w_img * 0.65)
    cv2.putText(frame, f"PEOPLE: {people_count:02d}", (x3, y_text), font, f_scale, COLOR_MUTED, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

    # Section 4: Global Status
    x4 = int(w_img * 0.82)
    accent_col = COLOR_RED if system_status in ["ALERT", "ESCALATED"] else (COLOR_AMBER if system_status == "UNATTENDED" else COLOR_GREEN)
    dot_r = max(3, int(5 * ui_scale))
    cv2.circle(frame, (x4, y_text - int(5 * ui_scale)), dot_r, accent_col, -1)
    cv2.putText(frame, f"STATUS: {system_status}", (x4 + int(12 * ui_scale), y_text), font, f_scale, accent_col, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

# ==============================================================================
# 3. 🎒 OBJECT BOUNDING BOXES & BADGES
# ==============================================================================
def draw_object_boxes(
    frame: np.ndarray,
    object_states: Dict[int, Dict[str, Any]],
    tracked_persons: List[Dict[str, Any]],
    ui_scale: float = 1.0
):
    """
    Renders bounding boxes and status tags for tracked items and subtle person tags.
    """
    font = cv2.FONT_HERSHEY_SIMPLEX
    f_scale = 0.46 * ui_scale

    # 1. Draw subtle person boxes
    for p in tracked_persons:
        px1, py1, px2, py2 = p["box"]
        pid = p.get("track_id")
        cv2.rectangle(frame, (px1, py1), (px2, py2), (80, 180, 100), 1)
        p_label = f"ID {pid}" if pid is not None else "PERSON"
        (ptw, pth), _ = cv2.getTextSize(p_label, font, 0.36 * ui_scale, 1)
        cv2.rectangle(frame, (px1, py1 - pth - 4), (px1 + ptw + 4, py1), (15, 17, 22), -1)
        cv2.putText(frame, p_label, (px1 + 2, py1 - 2), font, 0.36 * ui_scale, (180, 240, 190), 1, cv2.LINE_AA)

    # 2. Draw target object boxes
    for tid, st in object_states.items():
        x1, y1, x2, y2 = st["box"]
        bw = max(1, x2 - x1)
        bh = max(1, y2 - y1)
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2

        state = st.get("state", "NEW")
        display_name = st.get("display_name", "OBJECT")
        unattended_dur = st.get("unattended_duration", 0.0)
        req_sec = st.get("required_seconds", 15.0)
        closest_pid = st.get("closest_person_id")
        is_escalated = st.get("is_escalated", False)

        # Format duration string
        if unattended_dur >= 60.0:
            dur_str = f"{unattended_dur / 60.0:.1f}m"
        else:
            dur_str = f"{unattended_dur:.1f}s"

        if is_escalated or state == "PROLONGED_ABANDONED_ESCALATED":
            box_col = COLOR_RED
            label_text = f"🚨 {display_name} #{tid} | ESCALATED ({dur_str}) [STAFF ALERTED]"
            bracket_thick = 3
        elif state == "POTENTIAL_ABANDONED":
            box_col = COLOR_RED
            label_text = f"{display_name} #{tid} | ABANDONED ({dur_str})"
            bracket_thick = 3
        elif state == "UNATTENDED":
            box_col = COLOR_AMBER
            req_str = f"{req_sec / 60.0:.0f}m" if req_sec >= 60.0 else f"{req_sec:.0f}s"
            label_text = f"{display_name} #{tid} | UNATTENDED ({dur_str} / {req_str})"
            bracket_thick = 2
        elif state == "ATTENDED":
            box_col = COLOR_GREEN
            near_str = f"Near ID {closest_pid}" if closest_pid is not None else "ATTENDED"
            label_text = f"{display_name} #{tid} | {near_str}"
            bracket_thick = 2
        elif state == "MOVING":
            box_col = COLOR_CYAN
            label_text = f"{display_name} #{tid} | MOVING"
            bracket_thick = 2
        else:
            box_col = COLOR_MUTED
            label_text = f"{display_name} #{tid}"
            bracket_thick = 1

        # Bounding box
        cv2.rectangle(frame, (x1, y1), (x2, y2), box_col, max(1, int(1.5 * ui_scale)))

        # Corner brackets
        draw_corner_brackets(
            frame, x1, y1, x2, y2,
            box_col,
            length=max(8, int(bw * 0.22)),
            thickness=max(2, int(bracket_thick * ui_scale))
        )

        # Label badge
        (tw, th), _ = cv2.getTextSize(label_text, font, f_scale, max(1, int(1.5 * ui_scale)))
        badge_y = max(y1 - th - int(8 * ui_scale), int(50 * ui_scale))

        cv2.rectangle(frame, (x1, badge_y - 3), (x1 + tw + int(10 * ui_scale), badge_y + th + int(6 * ui_scale)), (15, 17, 22), -1)
        cv2.rectangle(frame, (x1, badge_y - 3), (x1 + tw + int(10 * ui_scale), badge_y + th + int(6 * ui_scale)), box_col, max(1, int(1.5 * ui_scale)))
        cv2.putText(frame, label_text, (x1 + int(5 * ui_scale), badge_y + th + 1), font, f_scale, COLOR_WHITE, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

        # Unattended progress bar under bounding box
        if state == "UNATTENDED" and not is_escalated:
            prog = min(1.0, unattended_dur / max(1.0, req_sec))
            bar_w = max(int(50 * ui_scale), bw)
            bar_h = max(3, int(5 * ui_scale))
            bar_y = y2 + int(4 * ui_scale)
            fill_w = int(bar_w * prog)
            cv2.rectangle(frame, (x1, bar_y), (x1 + bar_w, bar_y + bar_h), (35, 35, 35), -1)
            cv2.rectangle(frame, (x1, bar_y), (x1 + fill_w, bar_y + bar_h), COLOR_AMBER, -1)

# ==============================================================================
# 4. 🚨 PROMINENT ABANDONED OBJECT & ESCALATION ALERT POPUP CARD
# ==============================================================================
def draw_alert_card(
    frame: np.ndarray,
    active_events: List[Any],
    ui_scale: float = 1.0
):
    """
    Renders high-visibility alert card on the top-right.
    Supports Tier-1 Initial Alert and Tier-2 Prolonged Abandonment Staff Escalation (20-30 min).
    """
    if not active_events:
        return

    h_img, w_img = frame.shape[:2]
    ev = active_events[0]
    is_escalated = getattr(ev, "is_escalated", False)

    card_w = min(int(430 * ui_scale), int(w_img * 0.48))
    card_h = int(185 * ui_scale) if is_escalated else int(160 * ui_scale)

    x_card = w_img - card_w - int(16 * ui_scale)
    y_card = int(54 * ui_scale)

    font = cv2.FONT_HERSHEY_SIMPLEX
    cls_title = ev.object_class.replace("_", " ").upper()

    fast_roi_blend(frame, x_card, y_card, x_card + card_w, y_card + card_h, (12, 14, 18), alpha=0.94)
    cv2.rectangle(frame, (x_card, y_card), (x_card + card_w, y_card + card_h), COLOR_RED, max(2, int(2.0 * ui_scale)))
    cv2.rectangle(frame, (x_card, y_card), (x_card + int(6 * ui_scale), y_card + card_h), COLOR_RED, -1)

    # 1. Header
    pulse_dot_x = x_card + int(18 * ui_scale)
    pulse_dot_y = y_card + int(18 * ui_scale)
    cv2.circle(frame, (pulse_dot_x, pulse_dot_y), max(4, int(5 * ui_scale)), COLOR_RED, -1)

    if is_escalated:
        header_title = "PROLONGED ABANDONMENT ESCALATION (20+ MIN)"
    else:
        header_title = "POTENTIAL ABANDONED OBJECT ALERT"

    cv2.putText(frame, header_title, (x_card + int(30 * ui_scale), y_card + int(22 * ui_scale)), font, 0.42 * ui_scale, COLOR_RED, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

    # 2. Main Title
    title_text = f"UNATTENDED {cls_title} (ID #{ev.object_id})"
    cv2.putText(frame, title_text, (x_card + int(16 * ui_scale), y_card + int(46 * ui_scale)), font, 0.54 * ui_scale, COLOR_WHITE, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

    # 3. Duration & Confidence
    dur_val = ev.unattended_duration
    if dur_val >= 60.0:
        dur_display = f"{dur_val / 60.0:.1f} min"
    else:
        dur_display = f"{dur_val:.1f}s"

    meta_line = f"Unattended: {dur_display}   |   Confidence: {int(ev.confidence * 100)}%"
    cv2.putText(frame, meta_line, (x_card + int(16 * ui_scale), y_card + int(68 * ui_scale)), font, 0.44 * ui_scale, COLOR_WHITE, 1, cv2.LINE_AA)

    # Confidence progress bar
    bar_x = x_card + int(16 * ui_scale)
    bar_y = y_card + int(76 * ui_scale)
    bar_w = card_w - int(32 * ui_scale)
    bar_h = max(4, int(6 * ui_scale))
    fill_w = int(bar_w * ev.confidence)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (40, 45, 55), -1)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), COLOR_RED, -1)

    # Divider
    div_y = y_card + int(94 * ui_scale)
    cv2.line(frame, (x_card + int(16 * ui_scale), div_y), (x_card + card_w - int(16 * ui_scale), div_y), (45, 52, 64), 1)

    # 4. Action / Notification Simulation
    sim_y = div_y + int(18 * ui_scale)
    sim_sub_y = div_y + int(36 * ui_scale)
    sim_sub2_y = div_y + int(54 * ui_scale)

    if is_escalated:
        staff_name = getattr(ev, "assigned_staff_name", "Area Duty Officer") or "Area Duty Officer"
        staff_role = getattr(ev, "assigned_staff_role", "Area Warden") or "Area Warden"
        staff_contact = getattr(ev, "assigned_staff_contact", "Ext 402") or "Ext 402"

        cv2.putText(frame, "ON-DUTY AREA STAFF NOTIFIED:", (x_card + int(16 * ui_scale), sim_y), font, 0.38 * ui_scale, COLOR_MUTED, 1, cv2.LINE_AA)
        
        staff_display = f"{staff_name} ({staff_role})"
        cv2.putText(frame, staff_display, (x_card + int(16 * ui_scale), sim_sub_y), font, 0.48 * ui_scale, COLOR_GREEN, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

        contact_display = f"CONTACT: {staff_contact}  |  STATUS: DISPATCHED [OK]"
        cv2.putText(frame, contact_display, (x_card + int(16 * ui_scale), sim_sub2_y), font, 0.38 * ui_scale, COLOR_CYAN, 1, cv2.LINE_AA)

    else:
        cv2.putText(frame, "ACTION REQUIRED:", (x_card + int(16 * ui_scale), sim_y), font, 0.40 * ui_scale, COLOR_MUTED, 1, cv2.LINE_AA)
        cv2.putText(frame, "SECURITY PATROL DISPATCHED", (x_card + int(16 * ui_scale), sim_sub_y), font, 0.52 * ui_scale, COLOR_AMBER, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

# ==============================================================================
# 5. 📜 RECENT EVENTS TIMELINE
# ==============================================================================
def draw_event_timeline(
    frame: np.ndarray,
    event_history: List[Any],
    ui_scale: float = 1.0
):
    """Renders recent abandoned object incidents log."""
    if not event_history:
        return

    h_img, w_img = frame.shape[:2]
    if h_img < 400:
        return

    hist_w = min(int(320 * ui_scale), int(w_img * 0.38))
    hist_h = min(int(105 * ui_scale), int(len(event_history) * 26 * ui_scale + 30 * ui_scale))

    x_h = int(16 * ui_scale)
    y_h = int(54 * ui_scale)

    fast_roi_blend(frame, x_h, y_h, x_h + hist_w, y_h + hist_h, (12, 14, 18), alpha=0.90)
    cv2.rectangle(frame, (x_h, y_h), (x_h + hist_w, y_h + hist_h), (45, 52, 64), 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(frame, "RECENT INCIDENT LOG", (x_h + int(10 * ui_scale), y_h + int(16 * ui_scale)), font, 0.40 * ui_scale, COLOR_CYAN, 1, cv2.LINE_AA)
    cv2.line(frame, (x_h + int(10 * ui_scale), y_h + int(20 * ui_scale)), (x_h + hist_w - int(10 * ui_scale), y_h + int(20 * ui_scale)), (45, 52, 64), 1)

    cur_y = y_h + int(36 * ui_scale)
    for ev in list(reversed(event_history))[:3]:
        ts_str = ev.get_display_timestamp() if hasattr(ev, "get_display_timestamp") else ""
        is_esc = getattr(ev, "is_escalated", False)
        tag = "[STAFF ALERT]" if is_esc else "[ABANDONED]"
        row_text = f"{ts_str} {tag} {ev.object_class.upper()} #{ev.object_id}"
        cv2.putText(frame, row_text, (x_h + int(10 * ui_scale), cur_y), font, 0.36 * ui_scale, COLOR_RED, 1, cv2.LINE_AA)
        cur_y += int(22 * ui_scale)

# ==============================================================================
# 6. 🌟 MASTER OVERLAY ENGINE
# ==============================================================================
def draw_abandoned_object_overlay(
    frame: np.ndarray,
    tracked_persons: List[Dict[str, Any]],
    abandoned_output: Dict[str, Any],
    fps: float = 30.0,
    camera_id: str = "CAM-01",
    location: Optional[str] = "Campus Public Area",
    ui_mode: str = "demo",
    show_hud: bool = True
) -> np.ndarray:
    """
    Unified overlay renderer for Abandoned Object Detection.
    """
    if frame is None or frame.size == 0:
        return frame

    h_img, w_img = frame.shape[:2]
    ui_scale = get_ui_scale(w_img, h_img)

    object_states = abandoned_output.get("object_states", {})
    active_events = abandoned_output.get("active_events", [])
    event_history = abandoned_output.get("event_history", [])
    summary = abandoned_output.get("summary", {})

    total_objects = summary.get("total_objects", len(object_states))
    unattended_count = summary.get("unattended_count", 0)
    abandoned_count = summary.get("abandoned_count", 0)
    has_escalation = summary.get("has_escalation", False)

    if has_escalation:
        global_status = "ESCALATED"
    elif abandoned_count > 0:
        global_status = "ALERT"
    elif unattended_count > 0:
        global_status = "UNATTENDED"
    else:
        global_status = "NORMAL"

    # 1. Draw object & person bounding boxes
    draw_object_boxes(frame, object_states, tracked_persons, ui_scale=ui_scale)

    if show_hud:
        # 2. Draw Top Header
        draw_header(
            frame,
            fps=fps,
            camera_id=camera_id,
            location=location,
            system_status=global_status,
            ui_scale=ui_scale
        )

        # 3. Draw Bottom Panel
        draw_bottom_panel(
            frame,
            total_objects=total_objects,
            unattended_count=unattended_count,
            abandoned_count=abandoned_count,
            people_count=len(tracked_persons),
            system_status=global_status,
            ui_scale=ui_scale
        )

        # 4. Draw Alert Card
        if active_events:
            draw_alert_card(frame, active_events, ui_scale=ui_scale)
        elif event_history and ui_mode != "debug":
            draw_event_timeline(frame, event_history, ui_scale=ui_scale)

    return frame
