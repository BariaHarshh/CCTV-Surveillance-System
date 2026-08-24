"""
AI Campus Guard - Abandoned Object Detection Feature Package
Exports public classes, processors, detectors, and visualization helpers for unattended object monitoring.
"""

from .config import AbandonedObjectConfig, ObjectRuleConfig
from .event import PotentialAbandonedObjectEvent, get_event_timestamp
from .detector import MultiObjectDetector, COCO_CLASS_MAP, TARGET_OBJECT_CLASSES, compute_iou
from .tracker import ObjectTrack, ObjectTrackerManager, ObjectTrackObservation
from .proximity import ProximityAnalyzer
from .processor import AbandonedObjectProcessor
from .utils import draw_abandoned_object_overlay

__all__ = [
    "AbandonedObjectConfig",
    "ObjectRuleConfig",
    "PotentialAbandonedObjectEvent",
    "get_event_timestamp",
    "MultiObjectDetector",
    "compute_iou",
    "COCO_CLASS_MAP",
    "TARGET_OBJECT_CLASSES",
    "ObjectTrack",
    "ObjectTrackerManager",
    "ObjectTrackObservation",
    "ProximityAnalyzer",
    "AbandonedObjectProcessor",
    "draw_abandoned_object_overlay"
]
