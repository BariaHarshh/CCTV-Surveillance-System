"""
AI Campus Guard - Responsive Fixed-Component Surveillance UI Engine
Features a bounded, anchored layout manager preventing panel stretching or distortion
across any video resolution while keeping the surveillance feed unobstructed.
"""

from collections import deque
from typing import List, Dict, Tuple, Any, Optional, Union
import cv2
import numpy as np
import time

# ==============================================================================
# 🎨 COLOR PALETTE & STYLES (Cyber / Security Modern UI)
# ==============================================================================
COLOR_BG_DARK = (18, 20, 24)        # Deep Charcoal
COLOR_HEADER_BG = (12, 14, 18)      # Pitch Slate
COLOR_PANEL_BORDER = (50, 58, 72)   # Subtle Border Gray

# Risk & Status Palette
COLOR_LOW = (40, 225, 110)          # Emerald Green (0-24)
COLOR_MEDIUM = (0, 215, 255)        # Golden Amber (25-49)
COLOR_HIGH = (0, 140, 255)          # Vibrant Orange (50-74)
COLOR_CRITICAL = (45, 45, 245)      # Bright Crimson Red (75-100)

COLOR_GREEN = (40, 225, 110)
COLOR_AMBER = (0, 215, 255)
COLOR_ORANGE = (0, 140, 255)
COLOR_CYAN = (240, 210, 50)         # Cyber Cyan Accent
COLOR_WHITE = (250, 250, 250)
COLOR_MUTED = (165, 172, 185)

BASE_UI_WIDTH = 1280.0
BASE_UI_HEIGHT = 720.0
MIN_UI_SCALE = 0.50
MAX_UI_SCALE = 1.60

def get_level_color(level: str) -> Tuple[int, int, int]:
    """Returns color corresponding to a risk level."""
    lvl = (level or "LOW").upper()
    if lvl == "CRITICAL":
        return COLOR_CRITICAL
    elif lvl == "HIGH":
        return COLOR_HIGH
    elif lvl == "MEDIUM":
        return COLOR_MEDIUM
    return COLOR_LOW

def get_ui_scale(width: int, height: int) -> float:
    """Calculates responsive UI scaling factor bounded to prevent extreme distortion."""
    w = max(1.0, float(width))
    h = max(1.0, float(height))
    scale = min(w / BASE_UI_WIDTH, h / BASE_UI_HEIGHT)
    return float(np.clip(scale, MIN_UI_SCALE, MAX_UI_SCALE))

def fast_roi_blend(
    frame: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    bg_color: Tuple[int, int, int],
    alpha: float = 0.92
):
    """Blends a background color over a specific ROI without copying the full frame."""
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
# 📐 RESPONSIVE FIXED-COMPONENT LAYOUT MANAGER
# ==============================================================================
class UILayoutManager:
    """
    Computes anchored, bounded UI layout rectangles and typography scales
    using responsive fixed-component clamping to prevent stretching across resolutions.
    """
    def __init__(self, frame_width: int, frame_height: int, ui_mode: str = "compact"):
        self.w = max(320, frame_width)
        self.h = max(240, frame_height)
        self.mode = (ui_mode or "compact").lower()

        # 1. Base Scale clamped between 0.55 and 1.25
        raw_scale = min(self.w / 1280.0, self.h / 720.0)
        self.scale = float(np.clip(raw_scale, 0.55, 1.25))

        # 2. Typography Hierarchy (with strictly enforced readable minimums)
        self.title_font = float(np.clip(0.62 * self.scale, 0.48, 0.80))
        self.section_font = float(np.clip(0.50 * self.scale, 0.42, 0.65))
        self.normal_font = float(np.clip(0.44 * self.scale, 0.38, 0.55))
        self.small_font = float(np.clip(0.38 * self.scale, 0.32, 0.46))
        self.thick_bold = max(2, int(2.0 * self.scale))
        self.thick_norm = max(1, int(1.2 * self.scale))

        # 3. Margins & Spacings
        self.margin = int(np.clip(16 * self.scale, 10, 22))
        self.pad = int(np.clip(10 * self.scale, 6, 14))

        # 4. Header & Footer Bars
        self.header_h = int(np.clip(46 * self.scale, 36, 52))
        self.footer_h = int(np.clip(38 * self.scale, 30, 46))

        # 5. Top-Left Menu Button [ ☰ CONTROLS ] (Min: 130x28, Pref: 155x32, Max: 185x38)
        self.menu_btn_w = int(np.clip(155 * self.scale, 130, 185))
        self.menu_btn_h = int(np.clip(32 * self.scale, 26, 38))
        btn_y = (self.header_h - self.menu_btn_h) // 2
        self.menu_btn_rect = (
            self.margin,
            btn_y,
            self.margin + self.menu_btn_w,
            btn_y + self.menu_btn_h
        )

        # 6. Risk Assessment Card (Top-Right Anchor: Min: 320x130, Pref: 390x155, Max: 450x180)
        self.risk_card_w = int(np.clip(390 * self.scale, 310, 450))
        self.risk_card_h = int(np.clip(155 * self.scale, 130, 180))
        self.risk_card_x = self.w - self.risk_card_w - self.margin
        self.risk_card_y = self.header_h + self.pad
        self.risk_card_rect = (
            self.risk_card_x,
            self.risk_card_y,
            self.risk_card_x + self.risk_card_w,
            self.risk_card_y + self.risk_card_h
        )

        # 7. Control Side Panel (When Menu is Open: Min: 280x360, Pref: 340x440, Max: 380x500)
        self.control_panel_w = int(np.clip(340 * self.scale, 280, 380))
        avail_h = self.h - self.header_h - self.footer_h - (2 * self.pad)
        self.control_panel_h = min(int(np.clip(450 * self.scale, 360, 500)), avail_h)
        self.control_panel_rect = (
            self.margin,
            self.header_h + self.pad,
            self.margin + self.control_panel_w,
            self.header_h + self.pad + self.control_panel_h
        )

        # 8. Diagnostics Features Panel (When diagnostics explicitly requested)
        self.features_panel_w = int(np.clip(260 * self.scale, 210, 300))
        self.features_panel_rect = (
            self.margin,
            self.header_h + self.pad,
            self.margin + self.features_panel_w,
            self.header_h + self.pad + int(140 * self.scale)
        )

# ==============================================================================
# 🧩 REUSABLE UI PRIMITIVES
# ==============================================================================
def draw_ui_panel(
    frame: np.ndarray,
    x1: int,
    y1: int,
    w: int,
    h: int,
    bg_color: Tuple[int, int, int] = (12, 14, 18),
    border_color: Tuple[int, int, int] = COLOR_CYAN,
    border_thickness: int = 1,
    alpha: float = 0.94
) -> Tuple[int, int, int, int]:
    """Draws a standardized UI panel with alpha blend and border. Returns (x1, y1, x2, y2)."""
    x2 = x1 + w
    y2 = y1 + h
    fast_roi_blend(frame, x1, y1, x2, y2, bg_color, alpha=alpha)
    if border_thickness > 0:
        cv2.rectangle(frame, (x1, y1), (x2, y2), border_color, border_thickness)
    return (x1, y1, x2, y2)

def draw_ui_button(
    frame: np.ndarray,
    x1: int,
    y1: int,
    w: int,
    h: int,
    label: str,
    bg_color: Tuple[int, int, int],
    text_color: Tuple[int, int, int] = COLOR_WHITE,
    border_color: Optional[Tuple[int, int, int]] = None,
    font_scale: float = 0.38,
    ui_scale: float = 1.0
) -> Tuple[int, int, int, int]:
    """Draws a standardized UI button with centered text. Returns bounding rect (x1, y1, x2, y2)."""
    x2 = x1 + w
    y2 = y1 + h
    cv2.rectangle(frame, (x1, y1), (x2, y2), bg_color, -1)
    if border_color:
        cv2.rectangle(frame, (x1, y1), (x2, y2), border_color, 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), _ = cv2.getTextSize(label, font, font_scale, 1)

    if tw > w - int(6 * ui_scale):
        font_scale = font_scale * (w - int(6 * ui_scale)) / max(1, tw)
        (tw, th), _ = cv2.getTextSize(label, font, font_scale, 1)

    tx = x1 + (w - tw) // 2
    ty = y1 + (h + th) // 2
    cv2.putText(frame, label, (tx, ty), font, font_scale, text_color, max(1, int(1.2 * ui_scale)), cv2.LINE_AA)
    return (x1, y1, x2, y2)

def draw_ui_toggle(
    frame: np.ndarray,
    x1: int,
    y1: int,
    w: int,
    h: int,
    is_on: bool,
    ui_scale: float = 1.0
) -> Tuple[int, int, int, int]:
    """Renders a standardized [ ON ] / [ OFF ] toggle button."""
    bg_col = COLOR_GREEN if is_on else (45, 52, 65)
    txt_col = (10, 12, 16) if is_on else COLOR_MUTED
    label = "ON" if is_on else "OFF"
    return draw_ui_button(
        frame=frame,
        x1=x1,
        y1=y1,
        w=w,
        h=h,
        label=label,
        bg_color=bg_col,
        text_color=txt_col,
        font_scale=0.38 * ui_scale,
        ui_scale=ui_scale
    )

# ==============================================================================
# 🖼️ ASPECT-RATIO PRESERVING LETTERBOXING & COORDINATE TRANSFORMS
# ==============================================================================
def letterbox_frame(
    frame: np.ndarray,
    target_width: int,
    target_height: int,
    bg_color: Tuple[int, int, int] = (0, 0, 0)
) -> Tuple[np.ndarray, float, int, int]:
    """
    Uniformly scales a video frame into a target canvas while strictly preserving its original aspect ratio.
    Returns:
        (canvas_frame, scale, pad_x, pad_y)
    """
    h_img, w_img = frame.shape[:2]
    scale = min(target_width / w_img, target_height / h_img)
    new_w = int(w_img * scale)
    new_h = int(h_img * scale)

    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA if scale < 1.0 else cv2.INTER_LINEAR)
    canvas = np.full((target_height, target_width, 3), bg_color, dtype=np.uint8)

    pad_x = (target_width - new_w) // 2
    pad_y = (target_height - new_h) // 2

    canvas[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized
    return canvas, scale, pad_x, pad_y

def window_to_frame_coords(
    win_x: int,
    win_y: int,
    scale: float,
    pad_x: int,
    pad_y: int,
    frame_w: int,
    frame_h: int
) -> Tuple[int, int]:
    """Converts mouse click on letterbox display window back to native video frame coordinates."""
    if scale <= 0:
        return (win_x, win_y)
    fx = int((win_x - pad_x) / scale)
    fy = int((win_y - pad_y) / scale)
    return (int(np.clip(fx, 0, frame_w - 1)), int(np.clip(fy, 0, frame_h - 1)))

# ==============================================================================
# ⏱️ ROLLING FPS TRACKER ENGINE
# ==============================================================================
class RollingFPSTracker:
    """
    Computes a stable, rolling average FPS and frame execution latency with sub-millisecond overhead.
    """
    def __init__(self, window_size: int = 30):
        self.frame_times: deque[float] = deque(maxlen=window_size)
        self.last_timestamp: float = time.time()
        self.current_fps: float = 30.0
        self.avg_frame_time_ms: float = 33.3

    def update(self) -> Tuple[float, float]:
        """Records a new frame arrival and returns (rolling_fps, avg_proc_time_ms)."""
        now = time.time()
        dt = now - self.last_timestamp
        self.last_timestamp = now

        if dt > 0.0001:
            self.frame_times.append(dt)

        if len(self.frame_times) > 0:
            avg_dt = sum(self.frame_times) / len(self.frame_times)
            self.current_fps = (1.0 / avg_dt) if avg_dt > 0 else 30.0
            self.avg_frame_time_ms = avg_dt * 1000.0

        return self.current_fps, self.avg_frame_time_ms

# ==============================================================================
# 1. 🏷️ TOP HEADER COMPONENT
# ==============================================================================
def draw_risk_header(
    frame: np.ndarray,
    layout: UILayoutManager,
    risk_score: float = 0.0,
    risk_level: str = "LOW",
    fps: float = 30.0,
    camera_id: str = "CAM-01"
):
    """Renders top surveillance banner with title, live risk score, and telemetry."""
    w_img = layout.w
    header_h = layout.header_h

    fast_roi_blend(frame, 0, 0, w_img, header_h, COLOR_HEADER_BG, alpha=0.92)

    lvl_color = get_level_color(risk_level)
    cv2.line(frame, (0, header_h), (w_img, header_h), lvl_color, max(2, int(2.0 * layout.scale)))

    font = cv2.FONT_HERSHEY_SIMPLEX
    x_left = layout.margin + layout.menu_btn_w + int(14 * layout.scale)
    y_title = int(22 * layout.scale)
    y_sub = int(38 * layout.scale)

    cv2.putText(frame, "AI CAMPUS GUARDIAN", (x_left, y_title), font, layout.title_font, COLOR_WHITE, layout.thick_bold, cv2.LINE_AA)
    cv2.putText(frame, "Centralized Threat & Risk Intelligence", (x_left, y_sub), font, layout.small_font, COLOR_MUTED, 1, cv2.LINE_AA)

    fps_val = fps if (fps and fps > 0) else 30.0
    right_text = f"LIVE  |  {camera_id}  |  {fps_val:.1f} FPS"
    (tw, th), _ = cv2.getTextSize(right_text, font, layout.normal_font, 1)
    x_right = w_img - tw - layout.margin

    dot_x = x_right - int(10 * layout.scale)
    dot_y = int(24 * layout.scale)
    cv2.circle(frame, (dot_x, dot_y), max(3, int(4 * layout.scale)), lvl_color, -1)
    cv2.putText(frame, right_text, (x_right, int(28 * layout.scale)), font, layout.normal_font, COLOR_WHITE, layout.thick_norm, cv2.LINE_AA)

# ==============================================================================
# 2. 🚨 COMPACT RISK ASSESSMENT HUD CARD (Top-Right)
# ==============================================================================
def draw_risk_card(
    frame: np.ndarray,
    layout: UILayoutManager,
    risk_score: float,
    risk_level: str,
    status_label: str,
    active_incidents: List[Any]
):
    """
    Renders a compact, bounded Risk Assessment card on the top-right
    without occupying excess screen width.
    """
    x1, y1, x2, y2 = layout.risk_card_rect
    card_w = x2 - x1
    card_h = y2 - y1

    font = cv2.FONT_HERSHEY_SIMPLEX
    lvl_col = get_level_color(risk_level)

    draw_ui_panel(frame, x1, y1, card_w, card_h, bg_color=(12, 14, 18), border_color=lvl_col, border_thickness=layout.thick_norm, alpha=0.94)
    cv2.rectangle(frame, (x1, y1), (x1 + int(5 * layout.scale), y2), lvl_col, -1)

    # 1. Header with Indicator
    pulse_dot_x = x1 + int(16 * layout.scale)
    pulse_dot_y = y1 + int(16 * layout.scale)
    cv2.circle(frame, (pulse_dot_x, pulse_dot_y), max(3, int(4 * layout.scale)), lvl_col, -1)
    cv2.putText(frame, "CAMPUS RISK ASSESSMENT", (x1 + int(26 * layout.scale), y1 + int(20 * layout.scale)), font, layout.small_font, lvl_col, layout.thick_norm, cv2.LINE_AA)

    # 2. Main Risk Score & Level Badge
    score_text = f"RISK: {int(risk_score)} / 100"
    cv2.putText(frame, score_text, (x1 + int(14 * layout.scale), y1 + int(44 * layout.scale)), font, layout.section_font, COLOR_WHITE, layout.thick_bold, cv2.LINE_AA)

    level_badge = f"LEVEL: {risk_level}"
    (lw, lh), _ = cv2.getTextSize(level_badge, font, layout.section_font * 0.9, 1)
    badge_x = x2 - lw - int(16 * layout.scale)
    badge_y = y1 + int(44 * layout.scale)
    cv2.putText(frame, level_badge, (badge_x, badge_y), font, layout.section_font * 0.9, lvl_col, layout.thick_bold, cv2.LINE_AA)

    # 3. Dynamic Progress Bar
    bar_x = x1 + int(14 * layout.scale)
    bar_y = y1 + int(54 * layout.scale)
    bar_w = card_w - int(28 * layout.scale)
    bar_h = max(4, int(6 * layout.scale))
    fill_w = int(bar_w * (risk_score / 100.0))

    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + bar_w, bar_y + bar_h), (40, 45, 55), -1)
    cv2.rectangle(frame, (bar_x, bar_y), (bar_x + fill_w, bar_y + bar_h), lvl_col, -1)

    # 4. Divider
    div_y = y1 + int(70 * layout.scale)
    cv2.line(frame, (x1 + int(12 * layout.scale), div_y), (x2 - int(12 * layout.scale), div_y), (45, 52, 64), 1)

    # 5. Incident Summary Line
    inc_y1 = div_y + int(18 * layout.scale)
    inc_y2 = div_y + int(36 * layout.scale)
    inc_y3 = div_y + int(56 * layout.scale)

    if active_incidents:
        primary_inc = active_incidents[0]
        cv2.putText(frame, f"ACTIVE INCIDENTS: {len(active_incidents):02d} | {status_label}", (x1 + int(14 * layout.scale), inc_y1), font, layout.small_font, COLOR_WHITE, 1, cv2.LINE_AA)

        inc_title = primary_inc.get_display_title()
        if len(inc_title) > 32:
            inc_title = inc_title[:30] + "..."
        cv2.putText(frame, f"• {inc_title}", (x1 + int(14 * layout.scale), inc_y2), font, layout.normal_font, lvl_col, layout.thick_norm, cv2.LINE_AA)

        # Operational Action Recommendation
        if risk_level == "CRITICAL":
            action_text = "ACTION: EMERGENCY SECURITY DISPATCH"
            action_col = COLOR_CRITICAL
        elif risk_level == "HIGH":
            action_text = "ACTION: WARDEN INVESTIGATION DISPATCH"
            action_col = COLOR_HIGH
        else:
            action_text = "ACTION: MONITORING ACTIVE"
            action_col = COLOR_AMBER
        cv2.putText(frame, action_text, (x1 + int(14 * layout.scale), inc_y3), font, layout.small_font, action_col, layout.thick_norm, cv2.LINE_AA)

    else:
        cv2.putText(frame, "ACTIVE INCIDENTS: 00 | ALL CLEAR", (x1 + int(14 * layout.scale), inc_y1), font, layout.normal_font, COLOR_GREEN, 1, cv2.LINE_AA)
        cv2.putText(frame, "STATUS: ALL SYSTEMS NORMAL [OK]", (x1 + int(14 * layout.scale), inc_y3), font, layout.normal_font, COLOR_GREEN, layout.thick_norm, cv2.LINE_AA)

# ==============================================================================
# 3. 👤 UNIFIED PERSON TRACKING BOXES & MULTI-FEATURE BADGES
# ==============================================================================
def draw_tracked_persons(
    frame: np.ndarray,
    tracked_persons: List[Dict[str, Any]],
    behavior_output: Optional[Dict[str, Any]] = None,
    restricted_output: Optional[Dict[str, Any]] = None,
    ui_scale: float = 1.0,
    show_tracking_ids: bool = True,
    show_person_status: bool = True,
    show_confidence: bool = True
):
    """
    Renders clean, non-overlapping bounding boxes around every tracked person with
    consolidated status badges combining Behaviour Detection and Restricted Area state.
    Bounding box coordinates remain in native detection pixels; UI badges scale with ui_scale.
    """
    if not tracked_persons:
        return

    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.38, 0.44 * ui_scale)

    person_states = behavior_output.get("person_states", {}) if behavior_output else {}
    pair_states = behavior_output.get("pair_states", {}) if behavior_output else {}
    active_intruders = set(restricted_output.get("active_intruders", [])) if restricted_output else set()

    fighting_persons = set()
    for (id1, id2), pstate in pair_states.items():
        if pstate.get("state") == "POTENTIAL_FIGHT":
            fighting_persons.add(id1)
            fighting_persons.add(id2)

    for p in tracked_persons:
        tid = p.get("track_id")
        box = p.get("box", (0, 0, 0, 0))
        x1, y1, x2, y2 = [int(v) for v in box]
        conf = float(p.get("confidence", 0.85))

        bw = max(1, x2 - x1)

        box_color = COLOR_GREEN
        status_label = "NORMAL"
        badge_border_thick = 2

        if tid in fighting_persons:
            box_color = COLOR_CRITICAL
            status_label = "FIGHT INVOLVED"
            badge_border_thick = 3
        elif tid in active_intruders:
            box_color = COLOR_CRITICAL
            status_label = "ZONE BREACH"
            badge_border_thick = 3
        elif tid in person_states:
            pst = person_states[tid].get("primary_state", "NORMAL")
            if pst == "FALLEN":
                box_color = COLOR_CRITICAL
                status_label = "FALL DETECTED"
                badge_border_thick = 3
            elif pst == "AGGRESSIVE":
                box_color = COLOR_ORANGE
                status_label = "AGGRESSIVE"
                badge_border_thick = 2
            elif pst == "FALL_CHECKING":
                box_color = COLOR_AMBER
                status_label = "ANALYZING"
                badge_border_thick = 2
            elif pst == "SUSPICIOUS":
                box_color = COLOR_AMBER
                status_label = "SUSPICIOUS"
                badge_border_thick = 2

        # 1. Bounding Box & Corner Brackets in Native Coordinates
        cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, max(1, int(1.5 * ui_scale)))
        draw_corner_brackets(
            frame, x1, y1, x2, y2,
            box_color,
            length=max(8, int(bw * 0.22)),
            thickness=max(2, int(badge_border_thick * ui_scale))
        )

        # 2. Modern Cyber Badge Above Head
        if show_tracking_ids:
            id_text = f"ID #{tid}" if tid is not None else "PERSON"
            if show_confidence:
                id_text += f" | {int(conf * 100)}%"

            sub_text = f"STATUS: {status_label}" if show_person_status else None

            (w1, h1), _ = cv2.getTextSize(id_text, font, font_scale, max(1, int(1.5 * ui_scale)))
            w_sub, h_sub = (0, 0)
            if sub_text:
                (w_sub, h_sub), _ = cv2.getTextSize(sub_text, font, font_scale * 0.85, 1)

            badge_w = max(w1, w_sub) + int(12 * ui_scale)
            badge_h = h1 + (h_sub + int(6 * ui_scale) if sub_text else 0) + int(8 * ui_scale)

            bx1 = x1
            by1 = max(int(46 * ui_scale), y1 - badge_h - int(4 * ui_scale))
            bx2 = bx1 + badge_w
            by2 = by1 + badge_h

            fast_roi_blend(frame, bx1, by1, bx2, by2, (12, 14, 18), alpha=0.92)
            cv2.rectangle(frame, (bx1, by1), (bx2, by2), box_color, 1)

            t_y1 = by1 + h1 + int(2 * ui_scale)
            cv2.putText(frame, id_text, (bx1 + int(6 * ui_scale), t_y1), font, font_scale, COLOR_WHITE, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

            if sub_text:
                t_y2 = t_y1 + h_sub + int(5 * ui_scale)
                cv2.putText(frame, sub_text, (bx1 + int(6 * ui_scale), t_y2), font, font_scale * 0.85, box_color, 1, cv2.LINE_AA)

# ==============================================================================
# 4. 🧳 UNATTENDED OBJECT BOXES & BADGES
# ==============================================================================
def draw_tracked_objects(
    frame: np.ndarray,
    tracked_objects: List[Dict[str, Any]],
    abandoned_output: Optional[Dict[str, Any]] = None,
    ui_scale: float = 1.0
):
    """Renders high-visibility badges for detected & unattended luggage/objects."""
    if not tracked_objects:
        return

    object_states = abandoned_output.get("object_states", {}) if abandoned_output else {}
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.36, 0.42 * ui_scale)

    for obj in tracked_objects:
        oid = obj.get("track_id")
        box = obj.get("box", (0, 0, 0, 0))
        x1, y1, x2, y2 = [int(v) for v in box]
        cls_name = obj.get("class_name", "object").upper()

        st_info = object_states.get(oid, {})
        state = st_info.get("state", "MONITORED")
        unattended_dur = st_info.get("unattended_duration", 0.0)
        is_escalated = st_info.get("is_escalated", False)

        if state == "PROLONGED_ABANDONED_ESCALATED" or is_escalated:
            box_col = COLOR_CRITICAL
            label_text = f"🚨 {cls_name} #{oid} | ESCALATED ({unattended_dur:.1f}s)"
        elif state == "POTENTIAL_ABANDONED":
            box_col = COLOR_ORANGE
            label_text = f"⚠️ UNATTENDED {cls_name} #{oid} ({unattended_dur:.1f}s)"
        else:
            box_col = COLOR_CYAN
            label_text = f"{cls_name} #{oid}"

        cv2.rectangle(frame, (x1, y1), (x2, y2), box_col, max(1, int(1.5 * ui_scale)))
        draw_corner_brackets(frame, x1, y1, x2, y2, box_col, length=max(6, int((x2 - x1) * 0.25)), thickness=max(2, int(2.0 * ui_scale)))

        (tw, th), _ = cv2.getTextSize(label_text, font, font_scale, 1)
        by1 = max(int(46 * ui_scale), y1 - th - int(8 * ui_scale))
        fast_roi_blend(frame, x1, by1, x1 + tw + int(10 * ui_scale), by1 + th + int(6 * ui_scale), (12, 14, 18), alpha=0.92)
        cv2.rectangle(frame, (x1, by1), (x1 + tw + int(10 * ui_scale), by1 + th + int(6 * ui_scale)), box_col, 1)
        cv2.putText(frame, label_text, (x1 + int(5 * ui_scale), by1 + th + int(1 * ui_scale)), font, font_scale, COLOR_WHITE, 1, cv2.LINE_AA)

# ==============================================================================
# 5. 🛡️ RESTRICTED ZONE POLYGON OVERLAY
# ==============================================================================
def draw_restricted_zones_overlay(
    frame: np.ndarray,
    zone_statuses: Optional[Dict[str, Any]] = None,
    zone_configs: Optional[List[Dict[str, Any]]] = None,
    ui_scale: float = 1.0
):
    """Renders semi-transparent zone polygon geometries and highlights intrusions in red."""
    if not zone_configs:
        return

    h_img, w_img = frame.shape[:2]

    for z_cfg in zone_configs:
        pts = z_cfg.get("points", [])
        if len(pts) < 3:
            continue

        first_pt = pts[0]
        if isinstance(first_pt[0], float) and first_pt[0] <= 1.0 and first_pt[1] <= 1.0:
            pixel_pts = [[int(p[0] * w_img), int(p[1] * h_img)] for p in pts]
        else:
            pixel_pts = [[int(p[0]), int(p[1])] for p in pts]

        z_name = z_cfg.get("name", "RESTRICTED ZONE")
        is_breached = False
        if zone_statuses and z_name in zone_statuses:
            is_breached = zone_statuses[z_name].get("breach_active", False)

        poly_pts = np.array(pixel_pts, dtype=np.int32).reshape((-1, 1, 2))
        fill_col = (0, 0, 180) if is_breached else (200, 150, 20)
        line_col = COLOR_CRITICAL if is_breached else COLOR_CYAN

        overlay = frame.copy()
        cv2.fillPoly(overlay, [poly_pts], fill_col)
        cv2.addWeighted(overlay, 0.22, frame, 0.78, 0, frame)

        cv2.polylines(frame, [poly_pts], isClosed=True, color=line_col, thickness=max(2, int(2.0 * ui_scale)))

        cx = int(np.mean([p[0] for p in pixel_pts]))
        cy = int(np.mean([p[1] for p in pixel_pts]))
        tag = f"⚠️ {z_name} [BREACH]" if is_breached else f"🛡️ {z_name}"
        cv2.putText(frame, tag, (cx - int(70 * ui_scale), cy), cv2.FONT_HERSHEY_SIMPLEX, 0.38 * ui_scale, line_col, max(1, int(1.5 * ui_scale)), cv2.LINE_AA)

# ==============================================================================
# 6. ⚙️ FEATURE STATUS DIAGNOSTICS PANEL (Left Side - Diagnostics Mode)
# ==============================================================================
def draw_feature_status_panel(
    frame: np.ndarray,
    layout: UILayoutManager,
    feature_statuses: Dict[str, str]
):
    """Renders system feature diagnostics card indicating Active, Disabled, or Error state."""
    if not feature_statuses:
        return

    x1, y1, x2, _ = layout.features_panel_rect
    panel_w = x2 - x1
    item_count = len(feature_statuses)
    panel_h = int((item_count * 20 + 32) * layout.scale)

    draw_ui_panel(frame, x1, y1, panel_w, panel_h, bg_color=(12, 14, 18), border_color=(45, 52, 64), border_thickness=1, alpha=0.92)

    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(frame, "SYSTEM FEATURE STATUS", (x1 + int(10 * layout.scale), y1 + int(16 * layout.scale)), font, layout.small_font, COLOR_CYAN, 1, cv2.LINE_AA)
    cv2.line(frame, (x1 + int(10 * layout.scale), y1 + int(22 * layout.scale)), (x1 + panel_w - int(10 * layout.scale), y1 + int(22 * layout.scale)), (45, 52, 64), 1)

    feature_labels = {
        "crowd_detection": "Crowd Detection",
        "behavior_detection": "Behaviour Detection",
        "abandoned_object": "Abandoned Object",
        "restricted_area": "Restricted Area",
        "risk_assessment": "Risk Assessment Engine"
    }

    cur_y = y1 + int(38 * layout.scale)
    for feat_key, label in feature_labels.items():
        if feat_key not in feature_statuses:
            continue

        status = (feature_statuses.get(feat_key) or "STANDBY").upper()
        if status == "ACTIVE":
            dot_col = COLOR_GREEN
            sym = "*"
        elif status == "DISABLED":
            dot_col = COLOR_MUTED
            sym = "-"
        else:
            dot_col = COLOR_CRITICAL
            sym = "!"

        row_text = f"{sym} {label}: {status}"
        cv2.putText(frame, row_text, (x1 + int(10 * layout.scale), cur_y), font, layout.small_font * 0.95, dot_col, 1, cv2.LINE_AA)
        cur_y += int(18 * layout.scale)

# ==============================================================================
# 7. 📊 BOTTOM SUMMARY STRIP
# ==============================================================================
def draw_risk_bottom_panel(
    frame: np.ndarray,
    layout: UILayoutManager,
    risk_output: Dict[str, Any]
):
    """Renders bottom multi-source telemetry banner."""
    w_img = layout.w
    h_img = layout.h
    panel_h = layout.footer_h
    y_start = h_img - panel_h

    fast_roi_blend(frame, 0, y_start, w_img, h_img, COLOR_HEADER_BG, alpha=0.92)
    cv2.line(frame, (0, y_start), (w_img, y_start), COLOR_PANEL_BORDER, 1)

    font = cv2.FONT_HERSHEY_SIMPLEX
    y_text = y_start + int(24 * layout.scale)

    summary = risk_output.get("summary", {})
    active_inc_count = summary.get("total_active_incidents", 0)
    crit_count = summary.get("critical_incident_count", 0)
    active_sources = summary.get("active_sources", [])
    src_str = ", ".join(s.replace("_", " ").title() for s in active_sources) if active_sources else "Active Monitoring"

    # Section 1: Active Incidents
    x1 = layout.margin
    col1 = COLOR_CRITICAL if crit_count > 0 else (COLOR_HIGH if active_inc_count > 0 else COLOR_GREEN)
    cv2.putText(frame, f"INCIDENTS: {active_inc_count:02d} (CRITICAL: {crit_count:02d})", (x1, y_text), font, layout.normal_font, col1, layout.thick_bold, cv2.LINE_AA)

    # Section 2: Active Modules Feeding Risk
    x2 = int(w_img * 0.38)
    cv2.putText(frame, f"FEEDS: {src_str[:35]}", (x2, y_text), font, layout.small_font, COLOR_MUTED, layout.thick_norm, cv2.LINE_AA)

    # Section 3: Status
    x3 = int(w_img * 0.74)
    risk_level = risk_output.get("current_risk_level", "LOW")
    lvl_col = get_level_color(risk_level)
    dot_r = max(3, int(4 * layout.scale))
    cv2.circle(frame, (x3, y_text - int(4 * layout.scale)), dot_r, lvl_col, -1)
    cv2.putText(frame, f"SYSTEM: {risk_output.get('status', 'NORMAL')}", (x3 + int(10 * layout.scale), y_text), font, layout.normal_font, lvl_col, layout.thick_bold, cv2.LINE_AA)

# ==============================================================================
# 8. 🎛️ INTERACTIVE MENU & CONTROL PANEL DRAWING
# ==============================================================================
def draw_menu_button(
    frame: np.ndarray,
    layout: UILayoutManager,
    is_open: bool = False
) -> Tuple[int, int, int, int]:
    """
    Renders top-left clickable [ ☰ CONTROLS ] button with bounded dimensions.
    Returns bounding rect (x1, y1, x2, y2).
    """
    x1, y1, x2, y2 = layout.menu_btn_rect
    btn_w = x2 - x1
    btn_h = y2 - y1

    bg_col = (30, 36, 48) if is_open else (18, 22, 28)
    border_col = COLOR_CYAN if is_open else (60, 75, 95)

    fast_roi_blend(frame, x1, y1, x2, y2, bg_col, alpha=0.92)
    cv2.rectangle(frame, (x1, y1), (x2, y2), border_col, max(1, int(1.5 * layout.scale)))

    font = cv2.FONT_HERSHEY_SIMPLEX
    dot_col = COLOR_GREEN if is_open else COLOR_CYAN
    cv2.circle(frame, (x1 + int(12 * layout.scale), y1 + int(btn_h / 2)), max(3, int(4 * layout.scale)), dot_col, -1)
    cv2.putText(frame, "CONTROLS", (x1 + int(24 * layout.scale), y1 + int(21 * layout.scale)), font, layout.normal_font, COLOR_WHITE, layout.thick_norm, cv2.LINE_AA)

    return (x1, y1, x2, y2)

def draw_control_panel(
    frame: np.ndarray,
    layout: UILayoutManager,
    controller: Any,
    feature_flags: Dict[str, bool]
):
    """
    Renders interactive side control modal using bounded dimensions (280-380px).
    Populates controller.button_regions with exact click hitboxes.
    """
    x1, y1, x2, y2 = layout.control_panel_rect
    panel_w = x2 - x1
    panel_h = y2 - y1

    draw_ui_panel(frame, x1, y1, panel_w, panel_h, bg_color=(10, 12, 16), border_color=COLOR_CYAN, border_thickness=layout.thick_bold, alpha=0.96)

    font = cv2.FONT_HERSHEY_SIMPLEX

    # 1. Panel Header
    cv2.putText(frame, "SYSTEM CONTROLS", (x1 + int(14 * layout.scale), y1 + int(22 * layout.scale)), font, layout.section_font, COLOR_CYAN, layout.thick_norm, cv2.LINE_AA)

    # Close Button [X]
    cx1 = x2 - int(28 * layout.scale)
    cy1 = y1 + int(6 * layout.scale)
    cx2 = x2 - int(8 * layout.scale)
    cy2 = y1 + int(26 * layout.scale)
    cv2.rectangle(frame, (cx1, cy1), (cx2, cy2), (45, 52, 65), -1)
    cv2.putText(frame, "X", (cx1 + int(6 * layout.scale), cy1 + int(15 * layout.scale)), font, layout.small_font, COLOR_WHITE, 1, cv2.LINE_AA)
    controller.button_regions["menu_close"] = (cx1, cy1, cx2, cy2)

    div_y1 = y1 + int(32 * layout.scale)
    cv2.line(frame, (x1 + int(10 * layout.scale), div_y1), (x2 - int(10 * layout.scale), div_y1), (45, 52, 64), 1)

    # 2. Real-Time Feature Toggles Section
    cv2.putText(frame, "FEATURE TOGGLES", (x1 + int(14 * layout.scale), div_y1 + int(16 * layout.scale)), font, layout.small_font, COLOR_MUTED, 1, cv2.LINE_AA)

    features = [
        ("crowd_detection", "Crowd Detection"),
        ("behavior_detection", "Behaviour Detection"),
        ("abandoned_object", "Abandoned Objects"),
        ("restricted_area", "Restricted Area")
    ]

    row_y = div_y1 + int(32 * layout.scale)
    for feat_key, feat_label in features:
        is_on = feature_flags.get(feat_key, True)
        cv2.putText(frame, feat_label, (x1 + int(14 * layout.scale), row_y + int(14 * layout.scale)), font, layout.normal_font, COLOR_WHITE, 1, cv2.LINE_AA)

        bx1 = x2 - int(72 * layout.scale)
        by1 = row_y
        bw = int(60 * layout.scale)
        bh = int(20 * layout.scale)
        btn_rect = draw_ui_toggle(frame, bx1, by1, bw, bh, is_on, ui_scale=layout.scale)
        controller.button_regions[f"toggle_{feat_key}"] = btn_rect

        row_y += int(26 * layout.scale)

    # 3. Restricted Area Setup Section
    div_y2 = row_y + int(6 * layout.scale)
    cv2.line(frame, (x1 + int(10 * layout.scale), div_y2), (x2 - int(10 * layout.scale), div_y2), (45, 52, 64), 1)
    cv2.putText(frame, "RESTRICTED AREA SETUP", (x1 + int(14 * layout.scale), div_y2 + int(16 * layout.scale)), font, layout.small_font, COLOR_MUTED, 1, cv2.LINE_AA)

    # [+ ADD AREA] Button
    abx1 = x1 + int(14 * layout.scale)
    aby1 = div_y2 + int(24 * layout.scale)
    ab_w = int(120 * layout.scale)
    ab_h = int(24 * layout.scale)
    btn_add_rect = draw_ui_button(frame, abx1, aby1, ab_w, ab_h, "+ ADD AREA", bg_color=COLOR_CYAN, text_color=(10, 12, 16), font_scale=layout.small_font, ui_scale=layout.scale)
    controller.button_regions["btn_add_area"] = btn_add_rect

    # [SEVERITY: HIGH] Cycle Button
    sbx1 = abx1 + ab_w + int(8 * layout.scale)
    sby1 = aby1
    sb_w = x2 - int(14 * layout.scale) - sbx1
    sb_h = ab_h
    sev_text = f"SEV: {controller.selected_risk_level.upper()}"
    btn_sev_rect = draw_ui_button(frame, sbx1, sby1, sb_w, sb_h, sev_text, bg_color=(35, 42, 54), text_color=COLOR_WHITE, border_color=COLOR_MUTED, font_scale=layout.small_font * 0.9, ui_scale=layout.scale)
    controller.button_regions["btn_cycle_severity"] = btn_sev_rect

    # Configured Zones List
    zone_list_y = aby1 + ab_h + int(14 * layout.scale)
    zone_count = len(controller.zone_configs)
    cv2.putText(frame, f"CONFIGURED ZONES ({zone_count}):", (x1 + int(14 * layout.scale), zone_list_y), font, layout.small_font, COLOR_MUTED, 1, cv2.LINE_AA)

    zy = zone_list_y + int(14 * layout.scale)
    for idx, z in enumerate(controller.zone_configs[:3]):
        zname = z.get("name", f"ZONE {idx+1}")
        zsev = z.get("severity", "high").upper()
        pts_cnt = len(z.get("points", []))
        cv2.putText(frame, f"• {zname} ({zsev}) - {pts_cnt}pts", (x1 + int(14 * layout.scale), zy + int(12 * layout.scale)), font, layout.small_font * 0.95, COLOR_WHITE, 1, cv2.LINE_AA)

        rx1 = x2 - int(30 * layout.scale)
        ry1 = zy
        rw = int(20 * layout.scale)
        rh = int(16 * layout.scale)
        rem_rect = draw_ui_button(frame, rx1, ry1, rw, rh, "X", bg_color=(160, 40, 40), text_color=COLOR_WHITE, font_scale=layout.small_font * 0.85, ui_scale=layout.scale)
        controller.button_regions[f"remove_zone_{idx}"] = rem_rect

        zy += int(20 * layout.scale)

    if zone_count > 0:
        cbx1 = x1 + int(14 * layout.scale)
        cby1 = zy + int(4 * layout.scale)
        cb_w = int(100 * layout.scale)
        cb_h = int(20 * layout.scale)
        clear_rect = draw_ui_button(frame, cbx1, cby1, cb_w, cb_h, "CLEAR ALL", bg_color=(120, 30, 30), text_color=COLOR_WHITE, font_scale=layout.small_font * 0.85, ui_scale=layout.scale)
        controller.button_regions["btn_clear_areas"] = clear_rect

    # 4. Footer: Save / Load
    foot_y = y2 - int(32 * layout.scale)
    cv2.line(frame, (x1 + int(10 * layout.scale), foot_y), (x2 - int(10 * layout.scale), foot_y), (45, 52, 64), 1)

    sv_x1 = x1 + int(14 * layout.scale)
    sv_y1 = foot_y + int(6 * layout.scale)
    sv_w = int(75 * layout.scale)
    sv_h = int(20 * layout.scale)
    sv_rect = draw_ui_button(frame, sv_x1, sv_y1, sv_w, sv_h, "SAVE", bg_color=(35, 45, 60), text_color=COLOR_WHITE, font_scale=layout.small_font * 0.9, ui_scale=layout.scale)
    controller.button_regions["btn_save_areas"] = sv_rect

    ld_x1 = sv_x1 + sv_w + int(8 * layout.scale)
    ld_y1 = sv_y1
    ld_w = sv_w
    ld_h = sv_h
    ld_rect = draw_ui_button(frame, ld_x1, ld_y1, ld_w, ld_h, "LOAD", bg_color=(35, 45, 60), text_color=COLOR_WHITE, font_scale=layout.small_font * 0.9, ui_scale=layout.scale)
    controller.button_regions["btn_load_areas"] = ld_rect

# ==============================================================================
# 9. ✏️ LIVE POLYGON DRAWING PREVIEW
# ==============================================================================
def draw_live_polygon_preview(
    frame: np.ndarray,
    layout: UILayoutManager,
    controller: Any
):
    """
    Renders vertices, connecting lines, and mouse guide while in Polygon Drawing Mode.
    Vertices remain in native frame pixels.
    """
    pts = controller.current_polygon_points
    mx, my = controller.mouse_pos
    w_img = layout.w

    # 1. Top Center Instruction Banner
    banner_w = min(int(620 * layout.scale), int(w_img * 0.92))
    banner_h = int(32 * layout.scale)
    bx1 = (w_img - banner_w) // 2
    by1 = int(8 * layout.scale)
    bx2 = bx1 + banner_w
    by2 = by1 + banner_h

    fast_roi_blend(frame, bx1, by1, bx2, by2, (12, 14, 18), alpha=0.94)
    cv2.rectangle(frame, (bx1, by1), (bx2, by2), COLOR_CYAN, max(1, int(1.5 * layout.scale)))

    font = cv2.FONT_HERSHEY_SIMPLEX
    pts_count = len(pts)
    msg = f"DRAW MODE | Points: {pts_count} | Click: Add Point | ENTER: Finish | BKSP: Undo | ESC: Cancel"
    cv2.putText(frame, msg, (bx1 + int(10 * layout.scale), by1 + int(21 * layout.scale)), font, layout.small_font, COLOR_CYAN, max(1, int(1.5 * layout.scale)), cv2.LINE_AA)

    # 2. Draw vertices and connecting segments
    for idx, p in enumerate(pts):
        cv2.circle(frame, p, max(4, int(5 * layout.scale)), COLOR_CYAN, -1)
        cv2.circle(frame, p, max(5, int(7 * layout.scale)), COLOR_WHITE, 1)
        cv2.putText(frame, f"P{idx+1}", (p[0] + 6, p[1] - 6), font, layout.small_font, COLOR_WHITE, 1, cv2.LINE_AA)

    if len(pts) > 1:
        for i in range(len(pts) - 1):
            cv2.line(frame, pts[i], pts[i + 1], COLOR_CYAN, max(2, int(2.0 * layout.scale)))

    # 3. Dynamic line to current mouse position
    if len(pts) > 0:
        last_pt = pts[-1]
        cv2.line(frame, last_pt, (mx, my), (0, 220, 255), 1, cv2.LINE_AA)
        if len(pts) >= 2:
            cv2.line(frame, (mx, my), pts[0], (80, 100, 120), 1, cv2.LINE_AA)

def draw_status_toast(
    frame: np.ndarray,
    layout: UILayoutManager,
    message: str
):
    """Renders transient notification toast."""
    if not message:
        return

    w_img = layout.w
    h_img = layout.h
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), _ = cv2.getTextSize(message, font, layout.normal_font, 1)

    toast_w = tw + int(24 * layout.scale)
    toast_h = th + int(14 * layout.scale)
    tx1 = (w_img - toast_w) // 2
    ty1 = h_img - layout.footer_h - toast_h - int(10 * layout.scale)
    tx2 = tx1 + toast_w
    ty2 = ty1 + toast_h

def draw_performance_diagnostics_panel(
    frame: np.ndarray,
    layout: UILayoutManager,
    perf_summary: Dict[str, float]
):
    """
    Renders telemetry diagnostics HUD showing per-subsystem millisecond execution latencies.
    """
    if not perf_summary:
        return

    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = layout.scale

    panel_w = int(np.clip(310 * scale, 260, 360))
    panel_h = int(np.clip(125 * scale, 110, 150))
    x1 = layout.margin
    y1 = layout.h - layout.footer_h - panel_h - int(10 * scale)

    draw_ui_panel(frame, x1, y1, panel_w, panel_h, bg_color=(10, 12, 16), border_color=COLOR_CYAN, border_thickness=1, alpha=0.92)

    # Header
    cv2.putText(frame, "REAL-TIME PERFORMANCE PROFILER", (x1 + int(10 * scale), y1 + int(18 * scale)), font, layout.small_font, COLOR_CYAN, layout.thick_norm, cv2.LINE_AA)
    cv2.line(frame, (x1 + int(8 * scale), y1 + int(24 * scale)), (x1 + panel_w - int(8 * scale), y1 + int(24 * scale)), (45, 52, 64), 1)

    # Metrics
    fps_val = perf_summary.get("fps", 30.0)
    total_ms = perf_summary.get("total", 33.3)
    yolo_ms = perf_summary.get("detection", 0.0)
    beh_ms = perf_summary.get("behavior", 0.0)
    obj_ms = perf_summary.get("abandoned", 0.0)
    ra_ms = perf_summary.get("restricted", 0.0)
    risk_ms = perf_summary.get("risk_engine", 0.0)

    r1_y = y1 + int(40 * scale)
    r2_y = y1 + int(60 * scale)
    r3_y = y1 + int(80 * scale)
    r4_y = y1 + int(100 * scale)

    cv2.putText(frame, f"FPS: {fps_val:.1f}  |  TOTAL: {total_ms:.1f} ms", (x1 + int(10 * scale), r1_y), font, layout.normal_font, COLOR_GREEN if fps_val >= 25 else COLOR_AMBER, layout.thick_norm, cv2.LINE_AA)
    cv2.putText(frame, f"YOLO: {yolo_ms:.1f}ms  |  BEH: {beh_ms:.1f}ms", (x1 + int(10 * scale), r2_y), font, layout.small_font, COLOR_WHITE, 1, cv2.LINE_AA)
    cv2.putText(frame, f"OBJ:  {obj_ms:.1f}ms  |  RA:  {ra_ms:.1f}ms", (x1 + int(10 * scale), r3_y), font, layout.small_font, COLOR_WHITE, 1, cv2.LINE_AA)
    cv2.putText(frame, f"RISK: {risk_ms:.1f}ms  |  UI:  {perf_summary.get('ui_render', 0.0):.1f}ms", (x1 + int(10 * scale), r4_y), font, layout.small_font, COLOR_MUTED, 1, cv2.LINE_AA)

# ==============================================================================
# 10. 🌟 MASTER SURVEILLANCE OVERLAY ENGINE
# ==============================================================================
def draw_risk_assessment_overlay(
    frame: np.ndarray,
    risk_output: Dict[str, Any],
    fps: float = 30.0,
    camera_id: str = "CAM-01",
    ui_mode: str = "compact",
    show_hud: bool = True,
    feature_statuses: Optional[Dict[str, str]] = None,
    tracked_persons: Optional[List[Dict[str, Any]]] = None,
    tracked_objects: Optional[List[Dict[str, Any]]] = None,
    feature_outputs: Optional[Dict[str, Any]] = None,
    zone_configs: Optional[List[Dict[str, Any]]] = None,
    show_person_boxes: bool = True,
    show_tracking_ids: bool = True,
    show_person_status: bool = True,
    show_confidence: bool = True,
    controller: Optional[Any] = None,
    performance_summary: Optional[Dict[str, float]] = None
) -> np.ndarray:
    """
    Master visualization renderer for AI Campus Guard with responsive fixed-component layout.
    """
    if frame is None or frame.size == 0:
        return frame

    h_img, w_img = frame.shape[:2]
    layout = UILayoutManager(w_img, h_img, ui_mode=ui_mode)
    ui_scale = layout.scale

    risk_score = risk_output.get("current_risk_score", 0.0)
    risk_level = risk_output.get("current_risk_level", "LOW")
    status_label = risk_output.get("status", "NORMAL")
    active_incidents = risk_output.get("active_incidents", [])

    beh_out = feature_outputs.get("behavior") if feature_outputs else None
    ab_out = feature_outputs.get("abandoned") if feature_outputs else None
    ra_out = feature_outputs.get("restricted") if feature_outputs else None
    zone_stats = ra_out.get("zone_statuses") if ra_out else None

    # Priority: Active controller zone configs
    active_zones = controller.zone_configs if (controller and hasattr(controller, "zone_configs")) else zone_configs

    # 1. Draw Restricted Zones (Background Overlay in Native Video Coordinates)
    if active_zones:
        draw_restricted_zones_overlay(frame, zone_statuses=zone_stats, zone_configs=active_zones, ui_scale=ui_scale)

    # 2. Draw Tracked Person Bounding Boxes & Status Badges (Native Video Coordinates)
    if show_person_boxes and tracked_persons:
        draw_tracked_persons(
            frame=frame,
            tracked_persons=tracked_persons,
            behavior_output=beh_out,
            restricted_output=ra_out,
            ui_scale=ui_scale,
            show_tracking_ids=show_tracking_ids,
            show_person_status=show_person_status,
            show_confidence=show_confidence
        )

    # 3. Draw Tracked Unattended Objects (Native Video Coordinates)
    if tracked_objects:
        draw_tracked_objects(
            frame=frame,
            tracked_objects=tracked_objects,
            abandoned_output=ab_out,
            ui_scale=ui_scale
        )

    if show_hud:
        # 4. Top Header Banner
        draw_risk_header(
            frame=frame,
            layout=layout,
            risk_score=risk_score,
            risk_level=risk_level,
            fps=fps,
            camera_id=camera_id
        )

        # 5. Top-Left Menu Button [ ☰ CONTROLS ]
        is_menu_open = controller.menu_open if controller else False
        btn_rect = draw_menu_button(frame, layout=layout, is_open=is_menu_open)
        if controller:
            controller.menu_button_region = btn_rect

        # 6. Compact Risk Dial & Threats Card (Top-Right Anchor)
        draw_risk_card(
            frame=frame,
            layout=layout,
            risk_score=risk_score,
            risk_level=risk_level,
            status_label=status_label,
            active_incidents=active_incidents
        )

        # 7. Optional Diagnostics Panel (only when not in compact mode and menu is closed)
        if feature_statuses and not is_menu_open and layout.mode == "diagnostics":
            draw_feature_status_panel(frame, layout=layout, feature_statuses=feature_statuses)

        # 8. Interactive Control Panel (when menu is open)
        if controller and controller.menu_open:
            flags = getattr(controller, "feature_flags", {})
            if not flags and feature_statuses:
                flags = {k: (v == "ACTIVE") for k, v in feature_statuses.items()}
            draw_control_panel(frame, layout=layout, controller=controller, feature_flags=flags)

        # 9. Live Polygon Drawing Preview (when in draw mode)
        if controller and controller.draw_mode:
            draw_live_polygon_preview(frame, layout=layout, controller=controller)

        # 10. Performance Diagnostics Panel (when requested or toggled with 'P')
        show_perf = (controller and controller.show_performance_overlay) or (layout.mode == "diagnostics")
        if show_perf and performance_summary:
            draw_performance_diagnostics_panel(frame, layout=layout, perf_summary=performance_summary)

        # 11. Transient Status Message Toast
        if controller and controller.status_message and time.time() < controller.status_message_time:
            draw_status_toast(frame, layout=layout, message=controller.status_message)

        # 12. Bottom Summary Strip
        draw_risk_bottom_panel(
            frame=frame,
            layout=layout,
            risk_output=risk_output
        )

    return frame
