"""
AI Campus Guard - Risk Score Calculation & Classification Engine
Computes explainable, confidence-weighted risk scores (0-100), applies persistence, decay, and classifies severity.
"""

from typing import List, Tuple, Optional, Any
from .config import RiskConfig
from .event_model import RiskEvent

class RiskClassifier:
    """Classifies numeric risk scores into operational surveillance tiers."""
    def __init__(self, config: Optional[RiskConfig] = None):
        self.config = config or RiskConfig()

    def classify(self, score: float) -> Tuple[str, str]:
        """
        Maps a 0-100 risk score to a classification tier and surveillance status.

        Returns:
            Tuple of (risk_level, status_label)
            - 'LOW', 'NORMAL'
            - 'MEDIUM', 'ATTENTION'
            - 'HIGH', 'WARNING'
            - 'CRITICAL', 'EMERGENCY'
        """
        clamped_score = max(0.0, min(100.0, float(score)))

        if clamped_score <= self.config.low_max:
            return "LOW", "NORMAL"
        elif clamped_score <= self.config.medium_max:
            return "MEDIUM", "ATTENTION"
        elif clamped_score <= self.config.high_max:
            return "HIGH", "WARNING"
        else:
            return "CRITICAL", "EMERGENCY"

class RiskCalculator:
    """
    Computes explainable risk scores combining base event weights, detection confidence,
    temporal persistence, multi-event escalation bonuses, and inactivity decay.
    """
    def __init__(self, config: Optional[RiskConfig] = None):
        self.config = config or RiskConfig()
        self.classifier = RiskClassifier(self.config)

    def calculate_event_base_score(self, event: RiskEvent) -> float:
        """
        Calculates the initial confidence-weighted base risk score for a single event.
        Formula: Base Score = Base Event Risk Weight * Confidence
        """
        base_weight = self.config.get_event_base_weight(
            event_type=event.event_type,
            object_class=event.object_class,
            zone_severity=event.metadata.get("zone_severity") if event.metadata else None
        )
        conf = max(0.1, min(1.0, float(event.confidence)))
        return float(base_weight) * conf

    def calculate_persistence_bonus(self, duration_seconds: float) -> float:
        """
        Calculates duration persistence bonus points for ongoing sustained threats.
        """
        if not self.config.persistence_enabled or duration_seconds <= 0:
            return 0.0

        raw_bonus = (float(duration_seconds) / 10.0) * self.config.persistence_rate_per_10s
        return min(self.config.max_persistence_bonus, raw_bonus)

    def compute_incident_score(
        self,
        events: List[RiskEvent],
        duration_seconds: float,
        escalation_bonus: float = 0.0,
        decay_points: float = 0.0
    ) -> float:
        """
        Computes total composite risk score for an incident.

        Formula:
            Composite Score = max(Event Base Scores) + Secondary Synergy + Persistence Bonus + Escalation Bonus - Decay
            Clamped to [0.0, 100.0]
        """
        if not events:
            return 0.0

        # 1. Compute base scores for all contributing events
        base_scores = [self.calculate_event_base_score(ev) for ev in events]
        primary_score = max(base_scores)

        # 2. Add subtle multi-event compound factor (secondary events contribute up to 10 points)
        if len(base_scores) > 1:
            secondary_sum = sum(base_scores) - primary_score
            synergy_factor = min(12.0, secondary_sum * 0.15)
        else:
            synergy_factor = 0.0

        # 3. Persistence bonus
        persistence = self.calculate_persistence_bonus(duration_seconds)

        # 4. Total raw score
        raw_score = primary_score + synergy_factor + persistence + escalation_bonus - decay_points

        # 5. Strictly clamp between 0.0 and 100.0
        return max(0.0, min(100.0, round(raw_score, 1)))
