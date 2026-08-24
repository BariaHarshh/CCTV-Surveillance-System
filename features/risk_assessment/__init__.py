"""
AI Campus Guard - Risk Assessment Feature Package
Exports public classes, processors, incident managers, and visualization overlays for unified threat intelligence.
"""

from .config import RiskConfig, EscalationRuleConfig
from .event_model import RiskEvent
from .event_adapter import EventNormalizer, safe_extract_timestamp
from .calculator import RiskCalculator, RiskClassifier
from .escalation import EscalationEngine
from .incident import Incident, IncidentManager
from .processor import RiskAssessmentProcessor
from .orchestrator import RiskManagementOrchestrator
from .multi_cam_orchestrator import MultiCameraOrchestrator
from .interactive_controller import (
    InteractiveMenuController,
    points_to_normalized,
    points_to_pixels
)
from .profiler import PerformanceProfiler
from .utils import (
    BASE_UI_WIDTH,
    BASE_UI_HEIGHT,
    MIN_UI_SCALE,
    MAX_UI_SCALE,
    get_ui_scale,
    UILayoutManager,
    letterbox_frame,
    window_to_frame_coords,
    draw_ui_panel,
    draw_ui_button,
    draw_ui_toggle,
    RollingFPSTracker,
    draw_risk_assessment_overlay,
    draw_tracked_persons,
    draw_tracked_objects,
    draw_restricted_zones_overlay,
    draw_menu_button,
    draw_control_panel,
    draw_live_polygon_preview,
    draw_performance_diagnostics_panel
)

__all__ = [
    "RiskConfig",
    "EscalationRuleConfig",
    "RiskEvent",
    "EventNormalizer",
    "safe_extract_timestamp",
    "RiskCalculator",
    "RiskClassifier",
    "EscalationEngine",
    "Incident",
    "IncidentManager",
    "RiskAssessmentProcessor",
    "RiskManagementOrchestrator",
    "InteractiveMenuController",
    "points_to_normalized",
    "points_to_pixels",
    "BASE_UI_WIDTH",
    "BASE_UI_HEIGHT",
    "MIN_UI_SCALE",
    "MAX_UI_SCALE",
    "get_ui_scale",
    "UILayoutManager",
    "letterbox_frame",
    "window_to_frame_coords",
    "draw_ui_panel",
    "draw_ui_button",
    "draw_ui_toggle",
    "RollingFPSTracker",
    "draw_risk_assessment_overlay",
    "draw_tracked_persons",
    "draw_tracked_objects",
    "draw_restricted_zones_overlay",
    "draw_menu_button",
    "draw_control_panel",
    "draw_live_polygon_preview",
    "PerformanceProfiler",
    "draw_performance_diagnostics_panel"
]
