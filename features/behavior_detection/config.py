"""
AI Campus Guard - Behaviour Detection Configuration
Provides typed dataclass configuration structures and sensible defaults for behaviour detection algorithms.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional

@dataclass
class FallConfig:
    """Configuration parameters for Fall Detection."""
    enabled: bool = True
    aspect_ratio_threshold: float = 1.0          # Width / Height ratio for fallen/horizontal body posture
    aspect_ratio_expansion_ratio: float = 1.7    # Relative widening ratio compared to person's upright baseline
    vertical_drop_ratio: float = 0.35            # Proportional reduction in bounding-box height
    vertical_velocity_threshold: float = 90.0    # Downward velocity in pixels/sec to register rapid fall
    immobility_speed_threshold: float = 140.0    # Max speed while on the ground (distinguishes fallen from sprinting)
    persistence_seconds: float = 0.9             # Duration fallen posture must persist before confirming event
    confidence_threshold: float = 0.60           # Minimum confidence to emit fall event
    cooldown_seconds: float = 5.0                # Suppression cooldown between repeated alerts for same person
    edge_margin_pixels: int = 6                  # Ignore border-clipped false triggers at video boundaries

@dataclass
class MovementConfig:
    """Configuration parameters for Aggressive / Unusual Movement Detection."""
    enabled: bool = True
    speed_threshold: float = 160.0               # Speed in pixels/sec considered abnormally fast/darting
    acceleration_threshold: float = 220.0        # Acceleration in pixels/sec^2 considered sudden burst/stop
    direction_volatility_threshold: float = 55.0 # Standard deviation in movement heading degrees (erratic path)
    persistence_seconds: float = 0.8             # Duration sustained erratic motion must persist
    confidence_threshold: float = 0.60           # Minimum confidence to emit movement event
    cooldown_seconds: float = 4.0                # Cooldown between repeated movement alerts

@dataclass
class FightConfig:
    """Configuration parameters for Potential Fight / Violent Interaction Detection."""
    enabled: bool = True
    proximity_threshold: float = 140.0           # Max center-to-center distance (px) to consider people interacting
    convergence_speed_threshold: float = 60.0    # Rate at which distance decreases (approaching)
    mutual_speed_threshold: float = 110.0        # Combined or individual speed during close interaction
    mutual_accel_threshold: float = 160.0        # Acceleration during struggle / grappling
    persistence_seconds: float = 1.1             # Duration close aggressive interaction must persist
    confidence_threshold: float = 0.68           # Minimum confidence to emit fight event
    cooldown_seconds: float = 6.0                # Cooldown between repeated fight alerts for the same pair

@dataclass
class BehaviorConfig:
    """Root configuration for Behaviour Detection module."""
    enabled: bool = True
    history_seconds: float = 3.0                 # Temporal memory length (seconds) for each tracked person
    history_max_frames: int = 75                 # Max frame observations stored in memory per track
    track_inactivity_timeout_seconds: float = 2.0 # Inactive track purging timeout
    camera_id: str = "CAM-01"                    # Camera stream identifier
    location: str = "Campus Grounds"             # Monitored zone description
    
    fall: FallConfig = field(default_factory=FallConfig)
    movement: MovementConfig = field(default_factory=MovementConfig)
    fight: FightConfig = field(default_factory=FightConfig)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]] = None) -> "BehaviorConfig":
        """Instantiates BehaviorConfig from a dictionary (e.g. loaded from YAML)."""
        if not data:
            return cls()

        fall_data = data.get("fall", {})
        movement_data = data.get("movement", {}) or data.get("aggressive_movement", {})
        fight_data = data.get("fight", {})

        return cls(
            enabled=data.get("enabled", True),
            history_seconds=data.get("history_seconds", 3.0),
            history_max_frames=data.get("history_max_frames", 75),
            track_inactivity_timeout_seconds=data.get("track_inactivity_timeout_seconds", 2.0),
            camera_id=data.get("camera_id", "CAM-01"),
            location=data.get("location", "Campus Grounds"),
            fall=FallConfig(**{k: v for k, v in fall_data.items() if hasattr(FallConfig, k)}),
            movement=MovementConfig(**{k: v for k, v in movement_data.items() if hasattr(MovementConfig, k)}),
            fight=FightConfig(**{k: v for k, v in fight_data.items() if hasattr(FightConfig, k)})
        )
