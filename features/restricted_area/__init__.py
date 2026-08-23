"""
AI Campus Guard - Restricted Area Detection Feature Package
Exports public classes and visualization helpers for ROI polygon intrusion detection.
"""

from .event import RestrictedAreaEvent
from .zone import RestrictedZone, ZoneManager
from .intrusion_tracker import IntrusionTracker
from .processor import RestrictedAreaProcessor
from .utils import draw_restricted_area_overlay

__all__ = [
    "RestrictedAreaEvent",
    "RestrictedZone",
    "ZoneManager",
    "IntrusionTracker",
    "RestrictedAreaProcessor",
    "draw_restricted_area_overlay"
]
