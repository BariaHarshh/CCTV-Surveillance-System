"""
AI Campus Guard - High-Visibility Surveillance HUD & Alert Popup Engine
Designed specifically for large-screen TechVerse demonstrations with high-contrast,
large typography, prominent 'CALLING HOD...' simulation cards, and recent event timeline.
"""

from typing import List, Dict, Any, Tuple, Optional
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
COLOR_GREEN = (40, 225, 110)        # Crisp Emerald Green (Normal / Notified)
COLOR_AMBER = (0, 195, 255)         # Golden Amber (Analyzing / Warning)
COLOR_ORANGE = (0, 140, 255)        # Vibrant Orange (Aggressive)
COLOR_RED = (45, 45, 245)           # Bright Crimson Red (Alert / Critical)
COLOR_CYAN = (240, 210, 50)         # Cyber Cyan Accent
COLOR_WHITE = (250, 250, 250)
COLOR_MUTED = (165, 172, 185)

# ==============================================================================
# 📐 RESPONSIVE SCALING UTILITIES
# ==============================================================================
def get_ui_scale(width: int, height: int) -> float:
    """Calculates responsive UI scaling factor with boosted visibility."""
    ref_w = 1280.0
    scale = width / ref_w
    # Minimum scale boosted to 0.70 so text is always large even on 480p/360p
    return float(np.clip(scale, 0.70, 1.8))

def fast_roi_blend(frame: np.ndarray, x1: int, y1: int, x2: int, y2: int, bg_color: Tuple[int, int, int], alpha: float = 0.88):
    """
    Blends a background color over a specific sub-rectangle ROI without copying the full frame.
    Zero-copy, sub-millisecond execution.
    """
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
# 1. 🏷️ TOP HEADER COMPONENT (Large & Prominent)
# ==============================================================================
def draw_header(
    frame: np.ndarray,
    fps: float = 30.0,
    camera_id: str = "CAM-01",
    location: Optional[str] = "Campus Surveillance",
    system_status: str = "NORMAL",
    ui_scale: float = 1.0
):
    """
    Renders top surveillance banner with large bold title and live telemetry.
    """
    h_img, w_img = frame.shape[:2]
    header_h = int(44 * ui_scale)

    fast_roi_blend(frame, 0, 0, w_img, header_h, COLOR_HEADER_BG, alpha=0.90)

    # Accent bottom line
    line_col = COLOR_RED if system_status == "ALERT" else (COLOR_AMBER if system_status == "ANALYZING" else COLOR_CYAN)
    cv2.line(frame, (0, header_h), (w_img, header_h), line_col, max(2, int(2.0 * ui_scale)))

    font = cv2.FONT_HERSHEY_SIMPLEX

    # Left Branding - Large & Bold
    x_left = int(16 * ui_scale)
    y_title = int(22 * ui_scale)
    y_sub = int(36 * ui_scale)

    f_title = 0.62 * ui_scale
    f_sub = 0.42 * ui_scale

    cv2.putText(frame, "AI CAMPUS GUARDIAN", (x_left, y_title), font, f_title, COLOR_WHITE, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)
    cv2.putText(frame, "Behaviour Intelligence System", (x_left, y_sub), font, f_sub, COLOR_MUTED, 1, cv2.LINE_AA)

    # Right Telemetry - Large & Readable
    f_telemetry = 0.46 * ui_scale
    dot_col = COLOR_RED if system_status == "ALERT" else (COLOR_AMBER if system_status == "ANALYZING" else COLOR_GREEN)
    fps_val = fps if (fps and fps > 0) else 30.0
    loc_str = location if location else "Campus Zone"
    right_text = f"LIVE  |  {camera_id}  |  {loc_str}  |  {fps_val:.1f} FPS"

    (tw, th), _ = cv2.getTextSize(right_text, font, f_telemetry, 1)
    x_right = w_img - tw - int(24 * ui_scale)

    # Live pulse dot
    dot_x = x_right - int(12 * ui_scale)
    dot_y = int(22 * ui_scale)
    cv2.circle(frame, (dot_x, dot_y), max(3, int(5 * ui_scale)), dot_col, -1)
    cv2.putText(frame, right_text, (x_right, int(27 * ui_scale)), font, f_telemetry, COLOR_WHITE, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

# ==============================================================================
# 2. 📊 BOTTOM INFORMATION PANEL COMPONENT (High Visibility)
# ==============================================================================
def draw_bottom_panel(
    frame: np.ndarray,
    people_count: int = 0,
    raw_count: int = 0,
    active_events_count: int = 0,
    system_status: str = "NORMAL",
    crowd_status: str = "NORMAL",
    ui_scale: float = 1.0
):
    """
    Renders large bottom information strip with high-contrast text.
    """
    h_img, w_img = frame.shape[:2]
    panel_h = int(42 * ui_scale)
    y_start = h_img - panel_h

    fast_roi_blend(frame, 0, y_start, w_img, h_img, COLOR_HEADER_BG, alpha=0.90)
    cv2.line(frame, (0, y_start), (w_img, y_start), COLOR_PANEL_BORDER, 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    f_scale = 0.50 * ui_scale
    y_text = y_start + int(27 * ui_scale)

    # Section 1: People Count
    x1 = int(20 * ui_scale)
    cv2.putText(frame, f"PEOPLE: {people_count:02d}", (x1, y_text), font, f_scale, COLOR_WHITE, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)
    if raw_count != people_count and raw_count > 0:
        (tw_cnt, _), _ = cv2.getTextSize(f"PEOPLE: {people_count:02d}", font, f_scale, 2)
        cv2.putText(frame, f"(Raw: {raw_count})", (x1 + tw_cnt + 8, y_text), font, f_scale * 0.85, COLOR_MUTED, 1, cv2.LINE_AA)

    # Section 2: Active Events Count
    x2 = int(w_img * 0.35)
    ev_col = COLOR_RED if active_events_count > 0 else COLOR_GREEN
    cv2.putText(frame, f"ACTIVE ALERTS: {active_events_count:02d}", (x2, y_text), font, f_scale, ev_col, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

    # Section 3: Crowd Density Status
    x3 = int(w_img * 0.60)
    cr_col = COLOR_RED if crowd_status == "CROWD DETECTED" else (COLOR_AMBER if crowd_status == "CHECKING CROWD" else COLOR_GREEN)
    cv2.putText(frame, f"CROWD: {crowd_status}", (x3, y_text), font, f_scale, cr_col, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

    # Section 4: Global Behaviour Status
    x4 = int(w_img * 0.82)
    accent_col = COLOR_RED if system_status == "ALERT" else (COLOR_AMBER if system_status == "ANALYZING" else COLOR_GREEN)
    dot_r = max(3, int(5 * ui_scale))
    cv2.circle(frame, (x4, y_text - int(5 * ui_scale)), dot_r, accent_col, -1)
    status_label = f"STATUS: {system_status}"
    cv2.putText(frame, status_label, (x4 + int(12 * ui_scale), y_text), font, f_scale, accent_col, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

# ==============================================================================
# 3. 🚶 MOVEMENT TRAJECTORY VISUALIZER
# ==============================================================================
def draw_trajectories(
    frame: np.ndarray,
    history_manager: Optional[Any],
    ui_scale: float = 1.0
):
    """Renders subtle fading movement trajectory trails for active tracked individuals."""
    if history_manager is None:
        return

    active_tracks = history_manager.get_active_tracks()
    for track in active_tracks.values():
        if len(track.observations) < 2:
            continue

        obs_list = list(track.observations)[-8:]
        for i in range(1, len(obs_list)):
            pt1 = (int(obs_list[i - 1].center[0]), int(obs_list[i - 1].center[1]))
            pt2 = (int(obs_list[i].center[0]), int(obs_list[i].center[1]))

            alpha_ratio = i / float(len(obs_list))
            col_intensity = int(180 * alpha_ratio)
            trail_color = (col_intensity, col_intensity, 220)

            thickness = max(1, int(1.8 * ui_scale * alpha_ratio))
            cv2.line(frame, pt1, pt2, trail_color, thickness, cv2.LINE_AA)

        last_pt = (int(obs_list[-1].center[0]), int(obs_list[-1].center[1]))
        cv2.circle(frame, last_pt, max(2, int(3 * ui_scale)), (100, 220, 255), -1)

# ==============================================================================
# 4. 🩻 PERSON BOUNDING BOXES & BADGES (High Readability)
# ==============================================================================
def draw_person_boxes(
    frame: np.ndarray,
    tracked_persons: List[Dict[str, Any]],
    person_states: Dict[int, Any],
    ui_mode: str = "demo",
    ui_scale: float = 1.0
) -> Dict[int, Tuple[int, int]]:
    """Renders high-visibility bounding boxes with large ID tags and posture highlights."""
    h_img, w_img = frame.shape[:2]
    person_centers: Dict[int, Tuple[int, int]] = {}

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.48 * ui_scale

    for det in tracked_persons:
        tid = det.get("track_id")
        x1, y1, x2, y2 = map(int, det["box"])
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        bw = max(1, x2 - x1)
        bh = max(1, y2 - y1)

        if tid is not None:
            person_centers[tid] = (cx, cy)

        st_info = person_states.get(tid, {})
        primary_st = st_info.get("primary_state", "NORMAL")
        conf = st_info.get("confidence", 0.0)
        fall_prog = st_info.get("fall_progress", 0.0)

        # Style resolution
        if primary_st == "FALLEN":
            box_color = COLOR_RED
            label_text = f"ID {tid} | FALL {int(conf * 100)}%" if tid else "FALL"
            bracket_thick = 3

            # Local ROI ground glow ellipse
            ey1 = max(0, y2 - 4)
            ey2 = min(h_img, y2 + int(bh * 0.25) + 6)
            ex1 = max(0, cx - int(bw * 0.7))
            ex2 = min(w_img, cx + int(bw * 0.7))
            if ex2 > ex1 and ey2 > ey1:
                roi = frame[ey1:ey2, ex1:ex2]
                glow_block = roi.copy()
                rcx = cx - ex1
                rcy = (y2 + 2) - ey1
                cv2.ellipse(glow_block, (rcx, rcy), (int(bw * 0.65) + 4, max(4, int(bh * 0.20))), 0, 0, 360, (0, 0, 220), -1)
                cv2.addWeighted(glow_block, 0.40, roi, 0.60, 0, roi)

        elif primary_st == "FALL_CHECKING":
            box_color = COLOR_AMBER
            label_text = f"ID {tid} | FALL CHK {int(fall_prog * 100)}%" if tid else "FALL CHK"
            bracket_thick = 2

        elif primary_st == "AGGRESSIVE":
            box_color = COLOR_ORANGE
            label_text = f"ID {tid} | AGGRESSIVE {int(conf * 100)}%" if tid else "AGGRESSIVE"
            bracket_thick = 2

        elif primary_st == "SUSPICIOUS":
            box_color = COLOR_AMBER
            label_text = f"ID {tid} | ANALYZING" if tid else "ANALYZING"
            bracket_thick = 2

        else:
            box_color = COLOR_GREEN
            label_text = f"ID {tid} | NORMAL" if tid else "PERSON"
            bracket_thick = 2

        # 1. Main bounding rectangle
        cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, max(1, int(1.5 * ui_scale)))

        # 2. Corner brackets
        draw_corner_brackets(
            frame, x1, y1, x2, y2,
            box_color,
            length=max(8, int(bw * 0.22)),
            thickness=max(2, int(bracket_thick * ui_scale))
        )

        # 3. Large Label Badge
        (tw, th), baseline = cv2.getTextSize(label_text, font, font_scale, max(1, int(1.5 * ui_scale)))
        badge_y = max(y1 - th - int(8 * ui_scale), int(50 * ui_scale))

        cv2.rectangle(frame, (x1, badge_y - 3), (x1 + tw + int(10 * ui_scale), badge_y + th + int(6 * ui_scale)), (15, 17, 22), -1)
        cv2.rectangle(frame, (x1, badge_y - 3), (x1 + tw + int(10 * ui_scale), badge_y + th + int(6 * ui_scale)), box_color, max(1, int(1.5 * ui_scale)))
        cv2.putText(frame, label_text, (x1 + int(5 * ui_scale), badge_y + th + 1), font, font_scale, COLOR_WHITE, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

        # 4. Fall Checking Progress Bar
        if primary_st == "FALL_CHECKING":
            bar_w = max(int(50 * ui_scale), bw)
            bar_h = max(3, int(5 * ui_scale))
            bar_y = min(h_img - int(48 * ui_scale), y2 + 4)
            fill_w = int(bar_w * fall_prog)
            cv2.rectangle(frame, (x1, bar_y), (x1 + bar_w, bar_y + bar_h), (35, 35, 35), -1)
            cv2.rectangle(frame, (x1, bar_y), (x1 + fill_w, bar_y + bar_h), COLOR_AMBER, -1)

        # 5. Debug Mode Metrics Overlay
        if ui_mode == "debug":
            metrics = st_info.get("metrics", {})
            spd = metrics.get("speed", 0.0)
            ar = metrics.get("aspect_ratio", 0.0)
            dbg_text = f"v:{spd:.0f}px/s ar:{ar:.2f}"
            cv2.putText(frame, dbg_text, (x1, y2 + int(14 * ui_scale)), font, font_scale * 0.8, COLOR_CYAN, 1, cv2.LINE_AA)

    return person_centers

# ==============================================================================
# 5. 🥊 FIGHT INTERACTION VISUALIZER
# ==============================================================================
def draw_interaction_links(
    frame: np.ndarray,
    pair_states: Dict[Tuple[int, int], Any],
    person_centers: Dict[int, Tuple[int, int]],
    ui_scale: float = 1.0
):
    """Renders bold connection links between interacting individuals."""
    font = cv2.FONT_HERSHEY_SIMPLEX
    f_scale = 0.48 * ui_scale

    for (id1, id2), pstate in pair_states.items():
        st = pstate.get("state", "NORMAL")
        if st in ("INTERACTION", "SUSPICIOUS", "POTENTIAL_FIGHT"):
            if id1 in person_centers and id2 in person_centers:
                pt1 = person_centers[id1]
                pt2 = person_centers[id2]
                conf = pstate.get("confidence", 0.0)

                if st == "POTENTIAL_FIGHT":
                    link_col = COLOR_RED
                    link_thick = max(2, int(3.0 * ui_scale))
                    badge_title = f"POTENTIAL VIOLENT ACTIVITY {int(conf * 100)}%"
                elif st == "SUSPICIOUS":
                    link_col = COLOR_ORANGE
                    link_thick = max(2, int(2.0 * ui_scale))
                    badge_title = f"STRUGGLE: ID {id1} <-> ID {id2}"
                else:
                    link_col = COLOR_AMBER
                    link_thick = 1
                    badge_title = f"INTERACTION: ID {id1} <-> ID {id2}"

                cv2.line(frame, pt1, pt2, link_col, link_thick, cv2.LINE_AA)

                mx = (pt1[0] + pt2[0]) // 2
                my = (pt1[1] + pt2[1]) // 2
                cv2.circle(frame, (mx, my), max(4, int(6 * ui_scale)), link_col, -1)

                (tw, th), _ = cv2.getTextSize(badge_title, font, f_scale, max(1, int(1.5 * ui_scale)))
                bx = mx - tw // 2
                by = my - int(12 * ui_scale)

                cv2.rectangle(frame, (bx - 6, by - th - 4), (bx + tw + 6, by + 4), (15, 17, 22), -1)
                cv2.rectangle(frame, (bx - 6, by - th - 4), (bx + tw + 6, by + 4), link_col, max(1, int(1.5 * ui_scale)))
                cv2.putText(frame, badge_title, (bx, by), font, f_scale, COLOR_WHITE, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

# ==============================================================================
# 6. 🚨 PROMINENT BEHAVIOUR ALERT POPUP & "CALLING HOD..." SIMULATION
# ==============================================================================
def draw_alert_popup(
    frame: np.ndarray,
    active_events: List[Any],
    current_time: float = 0.0,
    ui_scale: float = 1.0
):
    """
    Renders prominent behaviour incident popup card on the top-right
    with the 'CALLING HOD...' simulation sequence.
    """
    if not active_events:
        return

    h_img, w_img = frame.shape[:2]
    ev = active_events[0]  # Focus prominently on the primary active event

    card_w = min(int(400 * ui_scale), int(w_img * 0.46))
    card_h = int(160 * ui_scale)

    x_card = w_img - card_w - int(16 * ui_scale)
    y_card = int(54 * ui_scale)

    font = cv2.FONT_HERSHEY_SIMPLEX

    conf = float(ev.confidence)
    conf_pct = int(conf * 100)
    pids_str = " <-> ".join(f"ID {p}" for p in ev.person_ids) if len(ev.person_ids) > 1 else f"ID {ev.person_ids[0]}"

    # Severity and Header resolution
    if ev.event_type == "fall":
        header_text = "SAFETY ALERT"
        card_title = "POTENTIAL FALL DETECTED"
        accent_col = COLOR_RED
    elif ev.event_type == "potential_violent_activity":
        header_text = "CRITICAL BEHAVIOUR ALERT"
        card_title = "POTENTIAL VIOLENT ACTIVITY"
        accent_col = COLOR_RED
    else:
        header_text = "BEHAVIOUR ALERT"
        card_title = "AGGRESSIVE MOVEMENT DETECTED"
        accent_col = COLOR_ORANGE

    # Determine simulation phase based on elapsed event time
    ev_ts = get_event_timestamp(ev)
    if current_time and ev_ts > 0:
        t_elapsed = max(0.0, current_time - ev_ts)
    else:
        t_elapsed = 1.0
    is_notified_phase = (t_elapsed >= 1.8)

    # 1. Dark semi-transparent background & border
    fast_roi_blend(frame, x_card, y_card, x_card + card_w, y_card + card_h, (12, 14, 18), alpha=0.94)
    cv2.rectangle(frame, (x_card, y_card), (x_card + card_w, y_card + card_h), accent_col, max(2, int(2.0 * ui_scale)))

    # Left accent vertical bar
    cv2.rectangle(frame, (x_card, y_card), (x_card + int(6 * ui_scale), y_card + card_h), accent_col, -1)

    # 2. Header with pulsing indicator dot
    f_header = 0.46 * ui_scale
    f_title = 0.54 * ui_scale
    f_body = 0.44 * ui_scale

    # Pulsing dot next to header
    pulse_dot_x = x_card + int(18 * ui_scale)
    pulse_dot_y = y_card + int(18 * ui_scale)
    cv2.circle(frame, (pulse_dot_x, pulse_dot_y), max(4, int(5 * ui_scale)), accent_col, -1)

    cv2.putText(frame, header_text, (x_card + int(30 * ui_scale), y_card + int(22 * ui_scale)), font, f_header, accent_col, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

    # 3. Main Event Title (Large & Bold)
    cv2.putText(frame, card_title, (x_card + int(16 * ui_scale), y_card + int(46 * ui_scale)), font, f_title, COLOR_WHITE, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

    # 4. Involved Persons & Confidence
    person_line = f"Person(s): {pids_str}   |   Confidence: {conf_pct}%"
    cv2.putText(frame, person_line, (x_card + int(16 * ui_scale), y_card + int(68 * ui_scale)), font, f_body, COLOR_WHITE, 1, cv2.LINE_AA)

    # Visual Confidence Progress Bar
    bar_x = x_card + int(16 * ui_scale)
    bar_y = y_card + int(76 * ui_scale)
    bar_w = card_w - int(32 * ui_scale)
    bar_h = max(4, int(6 * ui_scale))

    fill_w = int(bar_w * conf)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (40, 45, 55), -1)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), accent_col, -1)

    # Divider line
    div_y = y_card + int(96 * ui_scale)
    cv2.line(frame, (x_card + int(16 * ui_scale), div_y), (x_card + card_w - int(16 * ui_scale), div_y), (45, 52, 64), 1)

    # 5. "CALLING HOD..." UI Simulation State
    sim_y = div_y + int(20 * ui_scale)
    sim_sub_y = div_y + int(40 * ui_scale)

    if not is_notified_phase:
        # Phase 1: Calling HOD
        cv2.putText(frame, "ACTION REQUIRED:", (x_card + int(16 * ui_scale), sim_y), font, 0.40 * ui_scale, COLOR_MUTED, 1, cv2.LINE_AA)
        
        call_text = "CALLING HOD...  Connecting"
        cv2.putText(frame, call_text, (x_card + int(16 * ui_scale), sim_sub_y), font, 0.52 * ui_scale, COLOR_AMBER, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

        # Pulsing connect dot
        dot_cx = x_card + int(240 * ui_scale)
        cv2.circle(frame, (dot_cx, sim_sub_y - int(5 * ui_scale)), max(3, int(4 * ui_scale)), COLOR_AMBER, -1)
    else:
        # Phase 2: HOD Notified & Acknowledged
        notified_text = "[OK] HOD NOTIFIED"
        cv2.putText(frame, notified_text, (x_card + int(16 * ui_scale), sim_y + int(2 * ui_scale)), font, 0.54 * ui_scale, COLOR_GREEN, max(2, int(2.0 * ui_scale)), cv2.LINE_AA)

        incident_id = f"INCIDENT ID: BG-00{ev.person_ids[0] if ev.person_ids else 1} | STATUS: ACKNOWLEDGED"
        cv2.putText(frame, incident_id, (x_card + int(16 * ui_scale), sim_sub_y + int(4 * ui_scale)), font, 0.38 * ui_scale, COLOR_MUTED, 1, cv2.LINE_AA)

# ==============================================================================
# 7. 📜 RECENT EVENTS TIMELINE (Compact History)
# ==============================================================================
def draw_event_timeline(
    frame: np.ndarray,
    event_history: List[Any],
    ui_scale: float = 1.0
):
    """
    Renders recent events history list on the left side.
    """
    if not event_history:
        return

    h_img, w_img = frame.shape[:2]
    # Only draw timeline if frame is tall enough
    if h_img < 400:
        return

    hist_w = min(int(320 * ui_scale), int(w_img * 0.38))
    hist_h = min(int(105 * ui_scale), int(len(event_history) * 26 * ui_scale + 30 * ui_scale))

    x_h = int(16 * ui_scale)
    y_h = int(54 * ui_scale)

    fast_roi_blend(frame, x_h, y_h, x_h + hist_w, y_h + hist_h, (12, 14, 18), alpha=0.90)
    cv2.rectangle(frame, (x_h, y_h), (x_h + hist_w, y_h + hist_h), (45, 52, 64), 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(frame, "RECENT EVENT LOG", (x_h + int(10 * ui_scale), y_h + int(16 * ui_scale)), font, 0.40 * ui_scale, COLOR_CYAN, 1, cv2.LINE_AA)
    cv2.line(frame, (x_h + int(10 * ui_scale), y_h + int(20 * ui_scale)), (x_h + hist_w - int(10 * ui_scale), y_h + int(20 * ui_scale)), (45, 52, 64), 1)

    cur_y = y_h + int(36 * ui_scale)
    # Show last 3 events
    for ev in list(reversed(event_history))[:3]:
        pids = " <-> ".join(f"ID {p}" for p in ev.person_ids) if len(ev.person_ids) > 1 else f"ID {ev.person_ids[0]}"
        display_ts = ev.get_display_timestamp() if hasattr(ev, "get_display_timestamp") else getattr(ev, "display_timestamp", "")
        if ev.event_type == "fall":
            ev_icon = "[FALL]"
            ev_col = COLOR_RED
        elif ev.event_type == "potential_violent_activity":
            ev_icon = "[FIGHT]"
            ev_col = COLOR_RED
        else:
            ev_icon = "[ALERT]"
            ev_col = COLOR_ORANGE

        prefix = f"{display_ts} " if display_ts else ""
        row_text = f"{prefix}{ev_icon} {ev.event_type.replace('_', ' ').title()[:12]} ({pids})"
        cv2.putText(frame, row_text, (x_h + int(10 * ui_scale), cur_y), font, 0.36 * ui_scale, ev_col, 1, cv2.LINE_AA)
        cur_y += int(22 * ui_scale)

# ==============================================================================
# 8. ⏱️ PERFORMANCE TELEMETRY DEBUG PANEL
# ==============================================================================
def draw_performance_panel(
    frame: np.ndarray,
    metrics: Dict[str, float],
    device_name: str = "CPU",
    imgsz: int = 640,
    ui_scale: float = 1.0
):
    """Renders technical telemetry panel in debug mode."""
    h_img, w_img = frame.shape[:2]
    panel_w = int(240 * ui_scale)
    panel_h = int(140 * ui_scale)

    x_p = int(16 * ui_scale)
    y_p = int(54 * ui_scale)

    fast_roi_blend(frame, x_p, y_p, x_p + panel_w, y_p + panel_h, (12, 14, 18), alpha=0.92)
    cv2.rectangle(frame, (x_p, y_p), (x_p + panel_w, y_p + panel_h), COLOR_CYAN, 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    f_title = 0.40 * ui_scale
    f_val = 0.36 * ui_scale

    cv2.putText(frame, "PERFORMANCE PROFILER", (x_p + 10, y_p + 16), font, f_title, COLOR_CYAN, 1, cv2.LINE_AA)
    cv2.line(frame, (x_p + 10, y_p + 22), (x_p + panel_w - 10, y_p + 22), (45, 52, 64), 1)

    items = [
        ("FPS", f"{metrics.get('fps', 0.0):.1f} FPS"),
        ("Latency", f"{metrics.get('latency_ms', 0.0):.1f} ms"),
        ("YOLO & Track", f"{metrics.get('yolo_ms', 0.0):.1f} ms"),
        ("Behaviour", f"{metrics.get('behavior_ms', 0.0):.1f} ms"),
        ("UI Drawing", f"{metrics.get('ui_ms', 0.0):.1f} ms"),
        ("Device / Inp", f"{device_name} / {imgsz}px")
    ]

    cur_y = y_p + 38
    for label, val in items:
        cv2.putText(frame, label, (x_p + 12, cur_y), font, f_val, COLOR_MUTED, 1, cv2.LINE_AA)
        cv2.putText(frame, val, (x_p + panel_w - 95, cur_y), font, f_val, COLOR_WHITE, 1, cv2.LINE_AA)
        cur_y += 18

# ==============================================================================
# 9. 🌟 MASTER OVERLAY ENGINE
# ==============================================================================
def draw_behavior_overlay(
    frame: np.ndarray,
    tracked_persons: List[Dict[str, Any]],
    behavior_output: Dict[str, Any],
    history_manager: Optional[Any] = None,
    fps: float = 30.0,
    camera_id: str = "CAM-01",
    location: Optional[str] = "Campus Main Area",
    current_time: float = 0.0,
    raw_count: int = 0,
    stable_count: int = 0,
    crowd_info: Optional[Dict[str, Any]] = None,
    profiler_metrics: Optional[Dict[str, float]] = None,
    device_name: str = "CPU",
    imgsz: int = 640,
    ui_mode: str = "demo",
    show_box_labels: bool = True,
    show_hud: bool = True
) -> np.ndarray:
    """
    Unified, high-visibility HUD renderer for AI Campus Guard Behaviour Detection.
    Features large readable typography, prominent alert cards with 'CALLING HOD...' simulation,
    and recent event history. Fully responsive across resolutions.
    """
    if frame is None or frame.size == 0:
        return frame

    h_img, w_img = frame.shape[:2]
    ui_scale = get_ui_scale(w_img, h_img)

    person_states = behavior_output.get("person_states", {})
    pair_states = behavior_output.get("pair_states", {})
    active_events = behavior_output.get("active_events", [])
    event_history = behavior_output.get("event_history", [])
    crowd_status = crowd_info.get("status", "NORMAL") if crowd_info else "NORMAL"

    has_critical = (crowd_status == "CROWD DETECTED" or any(ev.severity in ("high", "critical") for ev in active_events))
    has_warning = (crowd_status == "CHECKING CROWD" or any(s.get("primary_state") in ("FALL_CHECKING", "SUSPICIOUS") for s in person_states.values()) or len(active_events) > 0)

    if has_critical:
        global_status = "ALERT"
    elif has_warning:
        global_status = "ANALYZING"
    else:
        global_status = "NORMAL"

    # 1. Draw subtle movement trajectories
    if show_hud:
        draw_trajectories(frame, history_manager, ui_scale=ui_scale)

    # 2. Draw person bounding boxes & large status badges
    person_centers = draw_person_boxes(
        frame,
        tracked_persons,
        person_states,
        ui_mode=ui_mode,
        ui_scale=ui_scale
    )

    # 3. Draw fight / pairwise interaction links
    draw_interaction_links(frame, pair_states, person_centers, ui_scale=ui_scale)

    if show_hud:
        # 4. Draw Top Header (Large Title & Telemetry)
        draw_header(
            frame,
            fps=fps,
            camera_id=camera_id,
            location=location,
            system_status=global_status,
            ui_scale=ui_scale
        )

        # 5. Draw Bottom Information Panel (Large Figures)
        cnt_val = stable_count if stable_count > 0 else len(tracked_persons)
        raw_val = raw_count if raw_count > 0 else len(tracked_persons)
        draw_bottom_panel(
            frame,
            people_count=cnt_val,
            raw_count=raw_val,
            active_events_count=len(active_events),
            system_status=global_status,
            crowd_status=crowd_status,
            ui_scale=ui_scale
        )

        # 6. Draw Prominent Behaviour Alert Card with 'CALLING HOD...' Simulation
        if active_events:
            draw_alert_popup(frame, active_events, current_time=current_time, ui_scale=ui_scale)
        elif event_history and ui_mode != "debug":
            # 7. Draw Recent Events Timeline when no alert is actively firing
            draw_event_timeline(frame, event_history, ui_scale=ui_scale)

        # 8. Draw Technical Telemetry Panel in Debug Mode
        if ui_mode == "debug" and profiler_metrics is not None:
            draw_performance_panel(
                frame,
                metrics=profiler_metrics,
                device_name=device_name,
                imgsz=imgsz,
                ui_scale=ui_scale
            )

    return frame
