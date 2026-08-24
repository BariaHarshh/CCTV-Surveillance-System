"""
AI Campus Guard - Risk Assessment Engine Configuration Module
Defines typed dataclasses for risk scoring weights, multi-event escalation rules, persistence, and decay.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional

@dataclass
class EscalationRuleConfig:
    """Defines a multi-event combination that triggers a risk escalation bonus."""
    name: str
    events: List[str]                   # List of event types required to trigger rule
    bonus: float = 15.0                 # Risk bonus points added to incident
    description: str = ""
    require_shared_person: bool = False # Whether events must share at least one person ID

@dataclass
class RiskConfig:
    """
    Configuration parameters for the Risk Assessment Engine.
    """
    enabled: bool = True

    # Risk Classification Thresholds (0 to 100)
    low_max: int = 24                   # 0 - 24: LOW
    medium_max: int = 49                # 25 - 49: MEDIUM
    high_max: int = 74                  # 50 - 74: HIGH
    critical_max: int = 100             # 75 - 100: CRITICAL

    # Base Event Risk Weights (0 to 100)
    event_weights: Dict[str, int] = field(default_factory=lambda: {
        "crowd_detected": 30,
        "aggressive_movement": 55,
        "fall": 65,
        "potential_fall": 65,
        "potential_violent_activity": 80,
        "zone_breach": 60,
        "restricted_area_entry": 60,
        "zone_exit": 10,
        "potential_abandoned_object": 60,
        "prolonged_abandoned_object_escalation": 85
    })

    # Object-Specific Risk Weights
    object_weights: Dict[str, int] = field(default_factory=lambda: {
        "backpack": 70,
        "handbag": 65,
        "suitcase": 80,
        "bottle": 20
    })

    # Zone Severity Risk Weights
    zone_weights: Dict[str, int] = field(default_factory=lambda: {
        "low": 40,
        "medium": 60,
        "high": 80,
        "critical": 90
    })

    # Persistence Settings
    persistence_enabled: bool = True
    persistence_rate_per_10s: float = 5.0   # +5 points per 10 seconds of active event duration
    max_persistence_bonus: float = 15.0     # Maximum cap on duration persistence bonus

    # Multi-Event Escalation Settings
    escalation_enabled: bool = True
    escalation_time_window_seconds: float = 15.0 # Temporal window to correlate multi-source events

    escalation_rules: List[EscalationRuleConfig] = field(default_factory=lambda: [
        EscalationRuleConfig(
            name="crowd_plus_violent_activity",
            events=["crowd_detected", "potential_violent_activity"],
            bonus=15.0,
            description="Crowd combined with active fighting/violence"
        ),
        EscalationRuleConfig(
            name="restricted_plus_aggression",
            events=["zone_breach", "aggressive_movement"],
            bonus=20.0,
            description="Restricted zone intrusion with aggressive behavior"
        ),
        EscalationRuleConfig(
            name="restricted_plus_violent",
            events=["zone_breach", "potential_violent_activity"],
            bonus=25.0,
            description="Restricted zone intrusion with physical violence"
        ),
        EscalationRuleConfig(
            name="restricted_plus_abandoned_luggage",
            events=["zone_breach", "potential_abandoned_object"],
            bonus=20.0,
            description="Restricted zone intrusion with unattended bag/luggage"
        ),
        EscalationRuleConfig(
            name="crowd_plus_fall",
            events=["crowd_detected", "fall"],
            bonus=10.0,
            description="Fall or stampede risk within a dense crowd"
        )
    ])

    # Decay & Resolution Settings
    decay_enabled: bool = True
    decay_rate_per_second: float = 2.0      # Score points subtracted per second after inactivity
    inactive_timeout_seconds: float = 6.0   # Seconds of event inactivity before decay begins
    resolution_timeout_seconds: float = 18.0 # Seconds of event inactivity before incident is RESOLVED
    max_incident_history: int = 10          # Max resolved incidents retained in history

    def get_event_base_weight(self, event_type: str, object_class: Optional[str] = None, zone_severity: Optional[str] = None) -> int:
        """Calculates base risk weight for an event type considering object category and zone severity."""
        ev_key = event_type.lower().strip()

        # 1. Abandoned Object with specific object class
        if "abandoned" in ev_key and object_class:
            obj_key = object_class.lower().strip()
            if obj_key in self.object_weights:
                if ev_key == "prolonged_abandoned_object_escalation":
                    return min(100, self.object_weights[obj_key] + 15)
                return self.object_weights[obj_key]

        # 2. Restricted Area with zone severity
        if ("zone_breach" in ev_key or "restricted" in ev_key) and zone_severity:
            z_key = zone_severity.lower().strip()
            if z_key in self.zone_weights:
                return self.zone_weights[z_key]

        # 3. Direct event weight lookup with fallback
        return self.event_weights.get(ev_key, 50)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RiskConfig":
        """Constructs RiskConfig instance from configuration dictionary."""
        cfg = cls(
            enabled=bool(data.get("enabled", True)),
            low_max=int(data.get("low_max", 24)),
            medium_max=int(data.get("medium_max", 49)),
            high_max=int(data.get("high_max", 74)),
            critical_max=int(data.get("critical_max", 100)),
            persistence_enabled=bool(data.get("persistence_enabled", True)),
            persistence_rate_per_10s=float(data.get("persistence_rate_per_10s", 5.0)),
            max_persistence_bonus=float(data.get("max_persistence_bonus", 15.0)),
            escalation_enabled=bool(data.get("escalation_enabled", True)),
            escalation_time_window_seconds=float(data.get("escalation_time_window_seconds", 15.0)),
            decay_enabled=bool(data.get("decay_enabled", True)),
            decay_rate_per_second=float(data.get("decay_rate_per_second", 2.0)),
            inactive_timeout_seconds=float(data.get("inactive_timeout_seconds", 6.0)),
            resolution_timeout_seconds=float(data.get("resolution_timeout_seconds", 18.0)),
            max_incident_history=int(data.get("max_incident_history", 10))
        )

        if "event_weights" in data and isinstance(data["event_weights"], dict):
            cfg.event_weights.update(data["event_weights"])
        if "object_weights" in data and isinstance(data["object_weights"], dict):
            cfg.object_weights.update(data["object_weights"])
        if "zone_weights" in data and isinstance(data["zone_weights"], dict):
            cfg.zone_weights.update(data["zone_weights"])

        return cfg
