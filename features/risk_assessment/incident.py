"""
AI Campus Guard - Incident Management & Tracking Engine
Maintains stateful incident clusters, prevents duplicate alerts, applies multi-event escalation, and manages decay/resolution.
"""

from collections import deque
from typing import List, Dict, Set, Optional, Tuple, Any
import time
import datetime
from .config import RiskConfig
from .event_model import RiskEvent
from .calculator import RiskCalculator, RiskClassifier
from .escalation import EscalationEngine

class Incident:
    """
    Stateful cluster of correlated surveillance events representing a unified campus safety situation.
    """
    def __init__(
        self,
        incident_id: str,
        initial_event: RiskEvent,
        created_at: float
    ):
        self.incident_id = incident_id
        self.state: str = "NEW"  # 'NEW', 'ACTIVE', 'ESCALATED', 'RESOLVED'
        self.created_at: float = float(created_at)
        self.updated_at: float = float(created_at)
        self.last_event_time: float = float(created_at)

        # Correlated entities
        self.events: List[RiskEvent] = [initial_event]
        self.sources: Set[str] = {initial_event.source}
        self.event_types: Set[str] = {initial_event.event_type}
        self.related_person_ids: Set[int] = set(initial_event.person_ids)
        self.related_object_ids: Set[int] = set(initial_event.object_ids)
        self.location: Optional[str] = initial_event.location
        self.zone_name: Optional[str] = initial_event.zone_name

        # Risk metrics
        self.risk_score: float = 0.0
        self.risk_level: str = "LOW"
        self.applied_escalation_rules: Set[str] = set()
        self.escalation_bonus: float = 0.0
        self.decay_points: float = 0.0
        self.escalation_alert_emitted: bool = False

    def add_event(self, event: RiskEvent, current_time: float):
        """Adds a newly correlated event to this incident."""
        self.updated_at = float(current_time)
        self.last_event_time = float(current_time)
        self.decay_points = 0.0  # Reset decay upon new event arrival

        # Bounded event list (keep last 10 contributing events)
        if len(self.events) >= 10:
            self.events.pop(0)
        self.events.append(event)

        self.sources.add(event.source)
        self.event_types.add(event.event_type)
        if event.person_ids:
            self.related_person_ids.update(event.person_ids)
        if event.object_ids:
            self.related_object_ids.update(event.object_ids)
        if event.location and not self.location:
            self.location = event.location
        if event.zone_name and not self.zone_name:
            self.zone_name = event.zone_name

    def get_duration(self, current_time: Optional[float] = None) -> float:
        """Returns active duration in seconds."""
        now = float(current_time) if current_time is not None else self.last_event_time
        return max(0.0, now - self.created_at)

    def get_display_title(self) -> str:
        """Returns primary display title for incident summaries."""
        types_str = " + ".join(t.replace("_", " ").title() for t in sorted(self.event_types)[:2])
        loc_str = f" @ {self.zone_name or self.location}" if (self.zone_name or self.location) else ""
        return f"Incident {self.incident_id}: {types_str}{loc_str}"

    def to_dict(self) -> Dict[str, Any]:
        """Serializes incident to dictionary."""
        return {
            "incident_id": self.incident_id,
            "state": self.state,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "sources": list(self.sources),
            "event_types": list(self.event_types),
            "related_person_ids": list(self.related_person_ids),
            "related_object_ids": list(self.related_object_ids),
            "location": self.location,
            "zone_name": self.zone_name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "last_event_time": self.last_event_time,
            "duration_seconds": round(self.get_duration(), 1),
            "events_count": len(self.events),
            "applied_escalation_rules": list(self.applied_escalation_rules)
        }

class IncidentManager:
    """
    Manages active incidents, correlates multi-source incoming events, evaluates escalation,
    and applies time decay and auto-resolution.
    """
    def __init__(self, config: Optional[RiskConfig] = None):
        self.config = config or RiskConfig()
        self.calculator = RiskCalculator(self.config)
        self.classifier = RiskClassifier(self.config)
        self.escalation_engine = EscalationEngine(self.config)

        self.active_incidents: Dict[str, Incident] = {}
        self.resolved_history: deque[Incident] = deque(maxlen=self.config.max_incident_history)
        self._incident_counter: int = 1

    def find_matching_incident(
        self,
        event: RiskEvent,
        current_time: float
    ) -> Optional[Incident]:
        """
        Correlates a newly normalized RiskEvent with an existing active incident.
        Matching criteria:
          1. Shared Person IDs
          2. Shared Object IDs
          3. Same Zone / Location within escalation time window
          4. Same Event Source / Type in active time window
        """
        win = self.config.escalation_time_window_seconds

        for inc in self.active_incidents.values():
            time_diff = abs(current_time - inc.last_event_time)
            if time_diff > win:
                continue

            # 1. Person ID correlation
            if event.person_ids and inc.related_person_ids:
                if set(event.person_ids).intersection(inc.related_person_ids):
                    return inc

            # 2. Object ID correlation
            if event.object_ids and inc.related_object_ids:
                if set(event.object_ids).intersection(inc.related_object_ids):
                    return inc

            # 3. Zone / Location correlation
            if event.zone_name and inc.zone_name and event.zone_name == inc.zone_name:
                return inc

            # 4. Same source and type close in time
            if event.source in inc.sources and event.event_type in inc.event_types and time_diff <= 5.0:
                return inc

            # 5. Crowd correlation (crowd matches nearby behavior events in same area)
            if (event.source == "crowd_detection" or "crowd_detection" in inc.sources) and time_diff <= 10.0:
                return inc

        return None

    def process_event(
        self,
        event: RiskEvent,
        current_time: float
    ) -> Tuple[Incident, bool]:
        """
        Ingests a normalized RiskEvent, assigns to an incident, evaluates multi-event escalation,
        and computes updated risk scores.

        Returns:
            Tuple of (incident, is_new_incident)
        """
        matched_inc = self.find_matching_incident(event, current_time)
        is_new = False

        if matched_inc is not None:
            matched_inc.add_event(event, current_time)
            inc = matched_inc
        else:
            inc_id = f"INC-{self._incident_counter:04d}"
            self._incident_counter += 1
            inc = Incident(incident_id=inc_id, initial_event=event, created_at=current_time)
            self.active_incidents[inc_id] = inc
            is_new = True

        # 1. Check for multi-event escalation synergies
        new_bonus, triggered_rules = self.escalation_engine.evaluate_escalations(
            event_types=inc.event_types,
            events=inc.events,
            applied_rules=inc.applied_escalation_rules
        )
        inc.escalation_bonus += new_bonus

        # 2. Compute composite risk score
        dur = inc.get_duration(current_time)
        inc.risk_score = self.calculator.compute_incident_score(
            events=inc.events,
            duration_seconds=dur,
            escalation_bonus=inc.escalation_bonus,
            decay_points=inc.decay_points
        )

        # 3. Classify risk level
        inc.risk_level, _ = self.classifier.classify(inc.risk_score)

        # 4. Update incident state
        if triggered_rules or inc.risk_level == "CRITICAL":
            inc.state = "ESCALATED"
        else:
            inc.state = "ACTIVE"

        return inc, is_new

    def update_decay_and_cleanup(self, current_time: float) -> List[Incident]:
        """
        Applies inactivity risk score decay and transitions timed-out incidents to RESOLVED.
        """
        newly_resolved: List[Incident] = []
        to_remove_ids = []

        for inc_id, inc in self.active_incidents.items():
            inactive_duration = current_time - inc.last_event_time

            # 1. Apply gradual decay after inactive timeout
            if self.config.decay_enabled and inactive_duration > self.config.inactive_timeout_seconds:
                decay_elapsed = inactive_duration - self.config.inactive_timeout_seconds
                inc.decay_points = decay_elapsed * self.config.decay_rate_per_second

                dur = inc.get_duration(current_time)
                inc.risk_score = self.calculator.compute_incident_score(
                    events=inc.events,
                    duration_seconds=dur,
                    escalation_bonus=inc.escalation_bonus,
                    decay_points=inc.decay_points
                )
                inc.risk_level, _ = self.classifier.classify(inc.risk_score)

            # 2. Check resolution timeout or complete score decay
            if inactive_duration >= self.config.resolution_timeout_seconds or (inc.decay_points > 0 and inc.risk_score <= 5.0):
                inc.state = "RESOLVED"
                newly_resolved.append(inc)
                self.resolved_history.append(inc)
                to_remove_ids.append(inc_id)

        for rid in to_remove_ids:
            del self.active_incidents[rid]

        return newly_resolved
