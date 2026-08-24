"""
AI Campus Guard - Real-Time Interactive Menu & Restricted Area Controller
Manages GUI state, OpenCV mouse callbacks, keyboard hotkeys, live polygon drawing,
and real-time feature enable/disable toggling without runner restarts.
"""

from typing import List, Dict, Tuple, Any, Optional
import os
import cv2
import yaml
import time

def points_to_normalized(points: List[Tuple[int, int]], width: int, height: int) -> List[List[float]]:
    """Converts pixel coordinate points to normalized 0.0 - 1.0 floats."""
    w = max(1.0, float(width))
    h = max(1.0, float(height))
    return [[round(x / w, 4), round(y / h, 4)] for x, y in points]

def points_to_pixels(points_norm: List[List[float]], width: int, height: int) -> List[List[int]]:
    """Converts normalized 0.0 - 1.0 floats to absolute pixel coordinates."""
    w = float(width)
    h = float(height)
    return [[int(x * w), int(y * h)] for x, y in points_norm]

class InteractiveMenuController:
    """
    Stateful interactive controller managing top-left menu button, side control panel,
    polygon drawing mode, and real-time feature toggling.
    """
    def __init__(self, zone_configs: Optional[List[Dict[str, Any]]] = None):
        self.menu_open: bool = False
        self.draw_mode: bool = False
        self.current_polygon_points: List[Tuple[int, int]] = []
        self.mouse_pos: Tuple[int, int] = (0, 0)
        self.selected_risk_level: str = "high"  # 'high', 'critical', 'medium', 'low'

        self.zone_configs: List[Dict[str, Any]] = list(zone_configs) if zone_configs else []
        self.button_regions: Dict[str, Tuple[int, int, int, int]] = {}

        self.status_message: str = ""
        self.status_message_time: float = 0.0

        # Register top-left menu button default region
        self.menu_button_region: Tuple[int, int, int, int] = (16, 8, 140, 42)
        self.show_performance_overlay: bool = False

    def set_status(self, msg: str):
        """Displays transient status message on GUI."""
        self.status_message = msg
        self.status_message_time = time.time() + 3.0

    def cycle_risk_level(self):
        """Cycles between zone risk levels."""
        levels = ["high", "critical", "medium", "low"]
        idx = levels.index(self.selected_risk_level) if self.selected_risk_level in levels else 0
        self.selected_risk_level = levels[(idx + 1) % len(levels)]
        self.set_status(f"Zone Severity: {self.selected_risk_level.upper()}")

    def on_mouse(self, event, x: int, y: int, flags, param):
        """OpenCV mouse callback handler."""
        self.mouse_pos = (x, y)
        orchestrator = param if param is not None else None

        if event == cv2.EVENT_LBUTTONDOWN:
            # 1. Check if in Polygon Draw Mode
            if self.draw_mode:
                # If clicking inside menu cancel/finish buttons
                if "draw_finish" in self.button_regions and self._is_inside(x, y, self.button_regions["draw_finish"]):
                    if orchestrator:
                        w = param.get("width", 640) if isinstance(param, dict) else 640
                        h = param.get("height", 480) if isinstance(param, dict) else 480
                        self.finish_polygon(w, h, orchestrator)
                    return
                elif "draw_cancel" in self.button_regions and self._is_inside(x, y, self.button_regions["draw_cancel"]):
                    self.cancel_drawing()
                    return
                else:
                    # Add point to polygon
                    self.current_polygon_points.append((x, y))
                    self.set_status(f"Point {len(self.current_polygon_points)} added. (ENTER to finish)")
                    return

            # 2. Check Top-Left Menu Button
            if self._is_inside(x, y, self.menu_button_region):
                self.menu_open = not self.menu_open
                self.set_status("Menu Opened" if self.menu_open else "Menu Closed")
                return

            # 3. Check Buttons inside Open Control Panel
            if self.menu_open:
                # Close button
                if "menu_close" in self.button_regions and self._is_inside(x, y, self.button_regions["menu_close"]):
                    self.menu_open = False
                    return

                # Feature Toggles
                for feat in ["crowd_detection", "behavior_detection", "abandoned_object", "restricted_area"]:
                    btn_key = f"toggle_{feat}"
                    if btn_key in self.button_regions and self._is_inside(x, y, self.button_regions[btn_key]):
                        if orchestrator and hasattr(orchestrator, "feature_flags"):
                            cur_val = orchestrator.feature_flags.get(feat, True)
                            orchestrator.set_feature_enabled(feat, not cur_val)
                            self.set_status(f"{feat}: {'ON' if not cur_val else 'OFF'}")
                        return

                # Add Restricted Area Button
                if "btn_add_area" in self.button_regions and self._is_inside(x, y, self.button_regions["btn_add_area"]):
                    self.draw_mode = True
                    self.current_polygon_points.clear()
                    self.set_status("DRAW MODE: Click points on video. ENTER to finish.")
                    return

                # Cycle Severity Button
                if "btn_cycle_severity" in self.button_regions and self._is_inside(x, y, self.button_regions["btn_cycle_severity"]):
                    self.cycle_risk_level()
                    return

                # Clear All Areas Button
                if "btn_clear_areas" in self.button_regions and self._is_inside(x, y, self.button_regions["btn_clear_areas"]):
                    self.clear_all_zones(orchestrator)
                    return

                # Save Areas Button
                if "btn_save_areas" in self.button_regions and self._is_inside(x, y, self.button_regions["btn_save_areas"]):
                    self.save_zones_to_file("config/saved_zones.yaml")
                    return

                # Load Areas Button
                if "btn_load_areas" in self.button_regions and self._is_inside(x, y, self.button_regions["btn_load_areas"]):
                    self.load_zones_from_file("config/saved_zones.yaml", orchestrator)
                    return

                # Individual Zone Remove Buttons
                for i in range(len(self.zone_configs)):
                    rem_key = f"remove_zone_{i}"
                    if rem_key in self.button_regions and self._is_inside(x, y, self.button_regions[rem_key]):
                        self.remove_zone(i, orchestrator)
                        return

    def _is_inside(self, x: int, y: int, rect: Tuple[int, int, int, int]) -> bool:
        """Returns True if (x, y) is inside bounding rectangle (x1, y1, x2, y2)."""
        x1, y1, x2, y2 = rect
        return x1 <= x <= x2 and y1 <= y <= y2

    def handle_key(self, key_code: int, width: int, height: int, orchestrator: Any) -> bool:
        """
        Handles keyboard shortcuts. Returns True if handled.
        """
        if key_code == -1:
            return False

        # Normalize key code
        key = key_code & 0xFF

        # 'm' or 'M': Toggle Menu
        if key in (ord('m'), ord('M')):
            self.menu_open = not self.menu_open
            self.set_status("Menu Opened" if self.menu_open else "Menu Closed")
            return True

        # 'r' or 'R': Enter Restricted Area Draw Mode
        if key in (ord('r'), ord('R')):
            self.draw_mode = not self.draw_mode
            self.current_polygon_points.clear()
            self.set_status("DRAW MODE: Click points on video. ENTER to finish." if self.draw_mode else "Draw Mode Cancelled")
            return True

        # 'p' or 'P': Toggle Performance Overlay
        if key in (ord('p'), ord('P')):
            self.show_performance_overlay = not self.show_performance_overlay
            self.set_status("Performance Overlay: ON" if self.show_performance_overlay else "Performance Overlay: OFF")
            return True

        # In Draw Mode Controls
        if self.draw_mode:
            # ENTER (13): Finish Polygon
            if key in (13, 10):
                self.finish_polygon(width, height, orchestrator)
                return True
            # BACKSPACE (8): Undo last point
            elif key == 8:
                self.undo_point()
                return True
            # ESC (27): Cancel Drawing
            elif key == 27:
                self.cancel_drawing()
                return True
            # 'c' or 'C': Clear points
            elif key in (ord('c'), ord('C')):
                self.current_polygon_points.clear()
                self.set_status("Drawing Points Cleared")
                return True

        # ESC (27): Close Menu
        if key == 27 and self.menu_open:
            self.menu_open = False
            return True

        return False

    def finish_polygon(self, width: int, height: int, orchestrator: Any):
        """Converts currently drawn pixel vertices into a normalized restricted zone."""
        if len(self.current_polygon_points) < 3:
            self.set_status("⚠️ Need at least 3 points for a polygon zone.")
            return

        # Store in pixel and normalized coordinates
        norm_pts = points_to_normalized(self.current_polygon_points, width, height)
        px_pts = [[p[0], p[1]] for p in self.current_polygon_points]

        zone_name = f"ZONE {len(self.zone_configs) + 1}"
        new_zone = {
            "name": zone_name,
            "severity": self.selected_risk_level,
            "enabled": True,
            "points": px_pts,
            "normalized_points": norm_pts
        }

        self.zone_configs.append(new_zone)
        if orchestrator and hasattr(orchestrator, "update_zones"):
            orchestrator.update_zones(self.zone_configs)

        self.set_status(f"✓ {zone_name} ({self.selected_risk_level.upper()}) Created!")
        self.current_polygon_points.clear()
        self.draw_mode = False

    def undo_point(self):
        """Removes the last vertex in the active polygon."""
        if self.current_polygon_points:
            self.current_polygon_points.pop()
            self.set_status(f"Undid point. Remaining: {len(self.current_polygon_points)}")

    def cancel_drawing(self):
        """Cancels active polygon drawing mode."""
        self.current_polygon_points.clear()
        self.draw_mode = False
        self.set_status("Draw Mode Cancelled.")

    def remove_zone(self, zone_idx: int, orchestrator: Any):
        """Removes an existing zone by index."""
        if 0 <= zone_idx < len(self.zone_configs):
            removed = self.zone_configs.pop(zone_idx)
            if orchestrator and hasattr(orchestrator, "update_zones"):
                orchestrator.update_zones(self.zone_configs)
            self.set_status(f"Removed zone: {removed.get('name')}")

    def clear_all_zones(self, orchestrator: Any):
        """Clears all configured restricted zones."""
        self.zone_configs.clear()
        if orchestrator and hasattr(orchestrator, "update_zones"):
            orchestrator.update_zones(self.zone_configs)
        self.set_status("All restricted zones cleared.")

    def save_zones_to_file(self, filepath: str = "config/saved_zones.yaml"):
        """Saves current zones to YAML."""
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, "w", encoding="utf-8") as f:
                yaml.dump({"restricted_zones": self.zone_configs}, f, default_flow_style=False)
            self.set_status(f"✓ Saved {len(self.zone_configs)} zones to {filepath}")
        except Exception as e:
            self.set_status(f"⚠️ Error saving zones: {e}")

    def load_zones_from_file(self, filepath: str = "config/saved_zones.yaml", orchestrator: Any = None):
        """Loads zones from YAML and activates them."""
        if not os.path.exists(filepath):
            self.set_status(f"⚠️ File not found: {filepath}")
            return

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            loaded_zones = data.get("restricted_zones", [])
            if loaded_zones:
                self.zone_configs = loaded_zones
                if orchestrator and hasattr(orchestrator, "update_zones"):
                    orchestrator.update_zones(self.zone_configs)
                self.set_status(f"✓ Loaded {len(self.zone_configs)} zones from {filepath}")
            else:
                self.set_status("⚠️ No zones found in file.")
        except Exception as e:
            self.set_status(f"⚠️ Error loading zones: {e}")
