"""
AI Campus Guard - Risk Assessment Processor Module
Central orchestrator that accepts incoming multi-source events, normalizes payloads,
manages incidents, computes real-time campus risk scores, and generates state-change alerts.
"""

from typing import List, Dict, Tuple, Optional, Any, Union
import time
from .config import RiskConfig
from .event_model import RiskEvent
from .event_adapter import EventNormalizer, safe_extract_timestamp
from .calculator import RiskCalculator, RiskClassifier
from .incident import Incident, IncidentManager

class RiskAssessmentProcessor:
    """
    Central root coordinator for the AI Campus Guard Risk Assessment Engine.
    Integrates seamlessly with Crowd, Behaviour, Abandoned Object, and Restricted Area detection modules.
    """
    def __init__(self, config: Optional[RiskConfig] = None):
        self.config = config or RiskConfig()
        self.normalizer = EventNormalizer()
        self.calculator = RiskCalculator(self.config)
        self.classifier = RiskClassifier(self.config)
        self.incident_manager = IncidentManager(self.config)

        self.recent_events_log: List[RiskEvent] = []
        self.last_global_level: str = "LOW"

    def update(
        self,
        events: Optional[List[Any]] = None,
        crowd_output: Optional[Dict[str, Any]] = None,
        behavior_output: Optional[Dict[str, Any]] = None,
        abandoned_output: Optional[Dict[str, Any]] = None,
        restricted_output: Optional[Dict[str, Any]] = None,
        current_time: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Main processing step executed on each surveillance frame.

        Args:
            events: Optional direct list of raw or normalized event objects
            crowd_output: Output dictionary from CrowdDetector.update()
            behavior_output: Output dictionary from BehaviorProcessor.update()
            abandoned_output: Output dictionary from AbandonedObjectProcessor.update()
            restricted_output: Output dictionary from RestrictedAreaProcessor.update()
            current_time: Current timestamp in seconds (Unix epoch or video timeline)

        Returns:
            Dict containing:
                - 'current_risk_score': Overall global risk score (0 - 100)
                - 'current_risk_level': 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
                - 'status': 'NORMAL', 'ATTENTION', 'WARNING', 'EMERGENCY'
                - 'active_incidents': List[Incident]
                - 'resolved_incidents': List[Incident]
                - 'normalized_events': List[RiskEvent] newly ingested this frame
                - 'new_alerts': List[Dict] state-transition alert notifications
                - 'summary': High-level statistics
        """
        now = safe_extract_timestamp(current_time)

        if not self.config.enabled:
            return {
                "current_risk_score": 0.0,
                "current_risk_level": "LOW",
                "status": "NORMAL",
                "active_incidents": [],
                "resolved_incidents": [],
                "normalized_events": [],
                "new_alerts": [],
                "summary": {"total_active_incidents": 0, "max_incident_risk": 0.0, "active_sources": [], "active_event_types": [], "critical_incident_count": 0}
            }

        # 1. Normalize all incoming events across all sources
        normalized_events: List[RiskEvent] = []

        # From direct events list
        if events:
            for ev in events:
                norm_ev = self.normalizer.normalize(ev, current_time=now)
                if norm_ev:
                    normalized_events.append(norm_ev)

        # From Crowd Detection
        if crowd_output:
            norm_crowd = self.normalizer.from_crowd(crowd_output, current_time=now)
            if norm_crowd:
                normalized_events.append(norm_crowd)

        # From Behaviour Detection
        if behavior_output:
            for ev in behavior_output.get("new_events", []):
                norm_beh = self.normalizer.from_behavior(ev, current_time=now)
                if norm_beh:
                    normalized_events.append(norm_beh)

        # From Abandoned Object Detection
        if abandoned_output:
            for ev in abandoned_output.get("new_events", []):
                norm_obj = self.normalizer.from_abandoned_object(ev, current_time=now)
                if norm_obj:
                    normalized_events.append(norm_obj)

        # From Restricted Area Detection
        if restricted_output:
            for ev in restricted_output.get("new_events", []):
                norm_zone = self.normalizer.from_restricted_area(ev, current_time=now)
                if norm_zone:
                    normalized_events.append(norm_zone)

        # 2. Process normalized events through Incident Manager
        new_alerts: List[Dict[str, Any]] = []

        for nev in normalized_events:
            self.recent_events_log.append(nev)
            if len(self.recent_events_log) > 20:
                self.recent_events_log.pop(0)

            inc, is_new = self.incident_manager.process_event(nev, current_time=now)

            # Generate alert notification on significant state changes (prevent spam every frame)
            if is_new or (inc.risk_level == "CRITICAL" and not inc.escalation_alert_emitted):
                inc.escalation_alert_emitted = True
                new_alerts.append({
                    "alert_id": f"ALT-{inc.incident_id}-{int(now * 100) % 100000}",
                    "incident_id": inc.incident_id,
                    "risk_score": inc.risk_score,
                    "risk_level": inc.risk_level,
                    "title": inc.get_display_title(),
                    "sources": list(inc.sources),
                    "event_types": list(inc.event_types),
                    "timestamp": now
                })

        # 3. Apply inactivity decay and resolve timed-out incidents
        resolved_this_frame = self.incident_manager.update_decay_and_cleanup(current_time=now)

        # 4. Compute Global Campus Risk Score and Level
        active_incidents = list(self.incident_manager.active_incidents.values())
        if active_incidents:
            global_risk_score = max(inc.risk_score for inc in active_incidents)
        else:
            global_risk_score = 0.0

        global_level, global_status = self.classifier.classify(global_risk_score)
        self.last_global_level = global_level

        # 5. Extract summary metrics
        active_sources = list({src for inc in active_incidents for src in inc.sources})
        active_types = list({t for inc in active_incidents for t in inc.event_types})
        critical_count = sum(1 for inc in active_incidents if inc.risk_level == "CRITICAL")

        return {
            "current_risk_score": round(global_risk_score, 1),
            "current_risk_level": global_level,
            "status": global_status,
            "active_incidents": active_incidents,
            "resolved_incidents": list(self.incident_manager.resolved_history),
            "normalized_events": normalized_events,
            "new_alerts": new_alerts,
            "summary": {
                "total_active_incidents": len(active_incidents),
                "max_incident_risk": round(global_risk_score, 1),
                "active_sources": active_sources,
                "active_event_types": active_types,
                "critical_incident_count": critical_count
            }
        }
