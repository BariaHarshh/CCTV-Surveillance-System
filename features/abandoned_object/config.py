"""
AI Campus Guard - Abandoned Object Detection Configuration Module
Defines typed dataclasses for stationary detection, person proximity, object-specific persistence rules,
and area-specific staff escalation directories.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List

@dataclass
class ObjectRuleConfig:
    """Rules and risk weights for specific object categories."""
    unattended_seconds: float = 15.0      # Duration before unattended object is flagged as abandoned
    risk_score: int = 70                  # Risk score weighting (0 - 100)
    severity: str = "high"                # Alert severity: 'low', 'medium', 'high', 'critical'
    display_name: str = "OBJECT"          # Display label for UI/HUD

@dataclass
class AbandonedObjectConfig:
    """
    Configuration parameters for the Abandoned Object Detection pipeline.
    """
    enabled: bool = True
    camera_id: str = "CAM-01"
    location: str = "Campus Public Area"

    # Stationary Movement Filter Thresholds
    stationary_threshold_px: float = 14.0       # Max pixel movement displacement within window to be stationary
    stationary_window_seconds: float = 2.0      # Duration required to confirm stationary state
    movement_smoothing_frames: int = 10         # Rolling window size for center position jitter smoothing

    # Person Proximity Thresholds
    person_proximity_threshold_px: float = 130.0 # Max pixel distance from object center to nearest person
    
    # Track Lifecycle & History
    stale_track_timeout_seconds: float = 5.0    # Seconds before deleting a lost object track history
    history_seconds: float = 60.0               # Maximum temporal history retained per track

    # Event Persistence & Cooldown
    event_display_ttl: float = 6.0              # Seconds active alert card remains visible in HUD
    alert_cooldown_seconds: float = 10.0        # Seconds before re-triggering a new event for the same track

    # Tier-2 Prolonged Abandonment Escalation (20 to 30 minutes threshold)
    escalation_unattended_seconds: float = 1200.0  # 20 minutes (1200.0s) in production mode
    demo_escalation_seconds: float = 25.0          # 25 seconds in demo / evaluation mode
    use_demo_escalation: bool = False              # Toggle demo scale escalation

    # Area Staff Directory (Campus location -> On-duty staff member contact)
    area_staff_directory: Dict[str, Dict[str, str]] = field(default_factory=lambda: {
        "Campus Public Area": {
            "staff_name": "Officer R. Sharma",
            "role": "Ground Floor Warden",
            "contact": "Ext 402 / Radio Ch-3"
        },
        "Library 2nd Floor": {
            "staff_name": "Anita Desai",
            "role": "Library Supervisor",
            "contact": "Ext 214 / Radio Ch-2"
        },
        "Cafeteria Courtyard": {
            "staff_name": "Vikram Singh",
            "role": "Courtyard Security",
            "contact": "Ext 305 / Radio Ch-4"
        },
        "default": {
            "staff_name": "Area Duty Officer",
            "role": "Central Campus Patrol",
            "contact": "Ext 100 / Emergency Ch-1"
        }
    })

    # Target Object Category Rules
    object_rules: Dict[str, ObjectRuleConfig] = field(default_factory=lambda: {
        "backpack": ObjectRuleConfig(
            unattended_seconds=15.0,
            risk_score=70,
            severity="high",
            display_name="BACKPACK"
        ),
        "handbag": ObjectRuleConfig(
            unattended_seconds=15.0,
            risk_score=65,
            severity="medium",
            display_name="HANDBAG"
        ),
        "suitcase": ObjectRuleConfig(
            unattended_seconds=15.0,
            risk_score=80,
            severity="critical",
            display_name="SUITCASE"
        ),
        "bottle": ObjectRuleConfig(
            unattended_seconds=30.0,
            risk_score=20,
            severity="low",
            display_name="BOTTLE"
        )
    })

    def get_effective_escalation_seconds(self) -> float:
        """Returns the active escalation threshold depending on demo or production mode."""
        return self.demo_escalation_seconds if self.use_demo_escalation else self.escalation_unattended_seconds

    def get_staff_for_location(self, location: Optional[str] = None) -> Dict[str, str]:
        """Retrieves assigned staff member contact for a specific campus location."""
        loc_key = (location or self.location).strip()
        if loc_key in self.area_staff_directory:
            return self.area_staff_directory[loc_key]
        for k, v in self.area_staff_directory.items():
            if k.lower() in loc_key.lower() or loc_key.lower() in k.lower():
                return v
        return self.area_staff_directory.get("default", {
            "staff_name": "Area Duty Officer",
            "role": "Campus Security",
            "contact": "Ext 100"
        })

    def get_rule_for_class(self, object_class: str) -> ObjectRuleConfig:
        """Retrieves rule config for a specific object class with fallback."""
        key = object_class.lower().strip()
        if key in self.object_rules:
            return self.object_rules[key]
        return ObjectRuleConfig(
            unattended_seconds=15.0,
            risk_score=50,
            severity="medium",
            display_name=object_class.upper()
        )

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AbandonedObjectConfig":
        """Creates config instance from a dictionary (e.g. parsed from preset YAML)."""
        rules = {}
        raw_rules = data.get("object_rules", {})
        for name, rdata in raw_rules.items():
            rules[name] = ObjectRuleConfig(
                unattended_seconds=float(rdata.get("unattended_seconds", 15.0)),
                risk_score=int(rdata.get("risk_score", 50)),
                severity=str(rdata.get("severity", "medium")),
                display_name=str(rdata.get("display_name", name.upper()))
            )

        staff_dir = data.get("area_staff_directory", {})

        cfg = cls(
            enabled=bool(data.get("enabled", True)),
            camera_id=str(data.get("camera_id", "CAM-01")),
            location=str(data.get("location", "Campus Public Area")),
            stationary_threshold_px=float(data.get("stationary_threshold_px", 14.0)),
            stationary_window_seconds=float(data.get("stationary_window_seconds", 2.0)),
            person_proximity_threshold_px=float(data.get("person_proximity_threshold_px", 130.0)),
            stale_track_timeout_seconds=float(data.get("stale_track_timeout_seconds", 5.0)),
            event_display_ttl=float(data.get("event_display_ttl", 6.0)),
            alert_cooldown_seconds=float(data.get("alert_cooldown_seconds", 10.0)),
            escalation_unattended_seconds=float(data.get("escalation_unattended_seconds", 1200.0)),
            demo_escalation_seconds=float(data.get("demo_escalation_seconds", 25.0)),
            use_demo_escalation=bool(data.get("use_demo_escalation", False))
        )
        if rules:
            cfg.object_rules = rules
        if staff_dir:
            cfg.area_staff_directory = staff_dir
        return cfg
