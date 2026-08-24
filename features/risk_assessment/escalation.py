"""
AI Campus Guard - Multi-Event Escalation Engine Module
Identifies high-risk multi-source event synergies (e.g. Crowd + Fight, Restricted Area Breach + Aggression)
and applies contextual risk escalation bonuses exactly once per incident.
"""

from typing import List, Set, Dict, Tuple, Optional
from .config import RiskConfig, EscalationRuleConfig
from .event_model import RiskEvent

class EscalationEngine:
    """
    Evaluates active multi-source events to discover dangerous compound threats.
    """
    def __init__(self, config: Optional[RiskConfig] = None):
        self.config = config or RiskConfig()

    def evaluate_escalations(
        self,
        event_types: Set[str],
        events: List[RiskEvent],
        applied_rules: Set[str]
    ) -> Tuple[float, List[EscalationRuleConfig]]:
        """
        Evaluates active events against configured multi-event escalation rules.

        Args:
            event_types: Set of all event types present in the incident / window
            events: List of actual RiskEvent instances
            applied_rules: Set of rule names already applied to this incident

        Returns:
            Tuple of:
                - total_bonus (float): Newly added escalation bonus points
                - newly_triggered_rules (List[EscalationRuleConfig]): Rules that fired in this check
        """
        if not self.config.escalation_enabled:
            return 0.0, []

        total_bonus = 0.0
        newly_triggered: List[EscalationRuleConfig] = []

        for rule in self.config.escalation_rules:
            if rule.name in applied_rules:
                continue

            # Check if all required event types in rule are present
            rule_matched = True
            for req_ev in rule.events:
                # Flexible matching for alias event types (e.g. 'zone_breach' and 'restricted_area_entry')
                matched_this = False
                if req_ev in event_types:
                    matched_this = True
                elif req_ev == "zone_breach" and ("restricted_area_entry" in event_types or "zone_breach" in event_types):
                    matched_this = True
                elif req_ev == "restricted_area_entry" and ("zone_breach" in event_types or "restricted_area_entry" in event_types):
                    matched_this = True
                elif req_ev == "fall" and ("potential_fall" in event_types or "fall" in event_types):
                    matched_this = True
                elif req_ev == "potential_fall" and ("fall" in event_types or "potential_fall" in event_types):
                    matched_this = True

                if not matched_this:
                    rule_matched = False
                    break

            if rule_matched:
                # If rule requires shared person IDs, verify intersection
                if rule.require_shared_person:
                    person_sets = [set(ev.person_ids) for ev in events if ev.person_ids]
                    if len(person_sets) < 2:
                        continue
                    # Check if there is common person ID
                    common = set.intersection(*person_sets) if person_sets else set()
                    if not common:
                        continue

                total_bonus += rule.bonus
                newly_triggered.append(rule)
                applied_rules.add(rule.name)

        return total_bonus, newly_triggered
