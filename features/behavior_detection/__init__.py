"""
AI Campus Guard - Behaviour Detection Feature Package
Exports public classes and utility helpers for fall, aggressive movement, and fight detection.
"""

from .event import BehaviourEvent, get_event_timestamp
from .config import BehaviorConfig, FallConfig, MovementConfig, FightConfig
from .tracking_history import TrackHistoryManager, TrackHistory, TrackObservation
from .fall import FallDetector
from .movement import MovementAnalyzer
from .interaction import FightDetector
from .processor import BehaviorProcessor
from .utils import draw_behavior_overlay

__all__ = [
    "BehaviourEvent",
    "get_event_timestamp",
    "BehaviorConfig",
    "FallConfig",
    "MovementConfig",
    "FightConfig",
    "TrackHistoryManager",
    "TrackHistory",
    "TrackObservation",
    "FallDetector",
    "MovementAnalyzer",
    "FightDetector",
    "BehaviorProcessor",
    "draw_behavior_overlay"
]
