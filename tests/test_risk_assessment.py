"""
Automated Unit & Scenario Tests for Risk Assessment Engine
Verifies event normalization across all 4 detection modules, risk scoring, classification tiers,
multi-event compound escalation, incident clustering, temporal persistence, inactivity decay, and UI HUD rendering.
"""

import os
import sys
import unittest
import datetime
import numpy as np

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from features.behavior_detection import BehaviourEvent
from features.abandoned_object import PotentialAbandonedObjectEvent
from features.restricted_area import RestrictedAreaEvent
from features.risk_assessment import (
    RiskConfig,
    RiskEvent,
    EventNormalizer,
    safe_extract_timestamp,
    RiskCalculator,
    RiskClassifier,
    EscalationEngine,
    Incident,
    IncidentManager,
    RiskAssessmentProcessor,
    draw_risk_assessment_overlay
)

class TestRiskAssessmentEngine(unittest.TestCase):

    def setUp(self):
        self.config = RiskConfig(
            low_max=24,
            medium_max=49,
            high_max=74,
            critical_max=100,
            inactive_timeout_seconds=2.0,
            resolution_timeout_seconds=5.0,
            decay_rate_per_second=5.0
        )
        self.processor = RiskAssessmentProcessor(config=self.config)

    def test_1_crowd_event_normalization(self):
        """Test 1: Crowd detection output dictionary normalizes into a valid RiskEvent."""
        crowd_dict = {
            "crowd_detected": True,
            "person_count": 14,
            "threshold": 10,
            "confirmation_progress_seconds": 3.0,
            "status": "CROWD DETECTED"
        }
        event = EventNormalizer.from_crowd(crowd_dict, current_time=12.5)

        self.assertIsNotNone(event)
        self.assertEqual(event.source, "crowd_detection")
        self.assertEqual(event.event_type, "crowd_detected")
        self.assertEqual(event.timestamp, 12.5)
        self.assertIsInstance(event.timestamp, float)
        self.assertGreaterEqual(event.confidence, 0.6)
        self.assertEqual(event.metadata["person_count"], 14)

        # Non-detected crowd should normalize to None
        normal_crowd = {"crowd_detected": False, "status": "NORMAL"}
        self.assertIsNone(EventNormalizer.from_crowd(normal_crowd))

    def test_2_behavior_event_normalization(self):
        """Test 2: BehaviourEvent instance normalizes cleanly into a RiskEvent."""
        beh_ev = BehaviourEvent.create(
            event_type="potential_violent_activity",
            person_ids=[17, 21],
            confidence=0.91,
            severity="high",
            video_time=5.4,
            metadata={"interaction_speed": 45.2}
        )
        event = EventNormalizer.from_behavior(beh_ev)

        self.assertEqual(event.source, "behavior_detection")
        self.assertEqual(event.event_type, "potential_violent_activity")
        self.assertEqual(event.person_ids, [17, 21])
        self.assertEqual(event.confidence, 0.91)
        self.assertEqual(event.severity, "high")
        self.assertEqual(event.timestamp, 5.4)

    def test_3_abandoned_object_event_normalization(self):
        """Test 3: PotentialAbandonedObjectEvent normalizes with object class and staff escalation metadata."""
        ab_ev = PotentialAbandonedObjectEvent.create(
            object_id=42,
            object_class="backpack",
            confidence=0.88,
            severity="high",
            video_time=15.0,
            unattended_duration=18.5,
            is_escalated=True,
            assigned_staff_name="Officer R. Sharma"
        )
        event = EventNormalizer.from_abandoned_object(ab_ev)

        self.assertEqual(event.source, "abandoned_object")
        self.assertEqual(event.object_class, "backpack")
        self.assertEqual(event.object_ids, [42])
        self.assertEqual(event.timestamp, 15.0)
        self.assertTrue(event.metadata.get("is_escalated"))
        self.assertEqual(event.metadata.get("assigned_staff_name"), "Officer R. Sharma")

    def test_4_restricted_area_event_normalization(self):
        """Test 4: RestrictedAreaEvent normalizes with zone name and person IDs."""
        ra_ev = RestrictedAreaEvent.create(
            event_type="zone_breach",
            zone_name="SERVER ROOM",
            person_ids=[9],
            confidence=0.95,
            severity="critical",
            video_time=8.2
        )
        event = EventNormalizer.from_restricted_area(ra_ev)

        self.assertEqual(event.source, "restricted_area")
        self.assertEqual(event.event_type, "zone_breach")
        self.assertEqual(event.zone_name, "SERVER ROOM")
        self.assertEqual(event.person_ids, [9])
        self.assertEqual(event.severity, "critical")
        self.assertEqual(event.timestamp, 8.2)

    def test_5_timestamp_safety_and_conversion(self):
        """Test 5: Safe timestamp extractor guarantees numeric float values for arithmetic."""
        self.assertEqual(safe_extract_timestamp(100.5), 100.5)
        self.assertEqual(safe_extract_timestamp(50), 50.0)
        self.assertAlmostEqual(safe_extract_timestamp("T+14.20s"), 14.20)
        self.assertAlmostEqual(safe_extract_timestamp("25.5"), 25.5)

        dt = datetime.datetime(2026, 8, 24, 12, 0, 0)
        self.assertEqual(safe_extract_timestamp(dt), dt.timestamp())
        self.assertGreater(safe_extract_timestamp(dt.isoformat()), 0.0)

    def test_6_base_risk_scoring_and_confidence(self):
        """Test 6: Base risk calculation scales with event weight and confidence score."""
        calc = RiskCalculator(self.config)

        ev_fight = RiskEvent("1", "behavior_detection", "potential_violent_activity", 0.90, 0.0)
        # 80 base weight * 0.90 conf = 72.0
        self.assertAlmostEqual(calc.calculate_event_base_score(ev_fight), 72.0)

        ev_bottle = RiskEvent("2", "abandoned_object", "potential_abandoned_object", 1.0, 0.0, object_class="bottle")
        # 20 base weight * 1.0 conf = 20.0
        self.assertAlmostEqual(calc.calculate_event_base_score(ev_bottle), 20.0)

    def test_7_score_clamping_zero_to_hundred(self):
        """Test 7: Composite risk score is clamped strictly between 0.0 and 100.0."""
        calc = RiskCalculator(self.config)
        ev_critical = RiskEvent("1", "behavior_detection", "potential_violent_activity", 1.0, 0.0)

        # Extreme bonuses
        score_high = calc.compute_incident_score([ev_critical], duration_seconds=100.0, escalation_bonus=50.0)
        self.assertEqual(score_high, 100.0)

        # Extreme decay
        score_low = calc.compute_incident_score([ev_critical], duration_seconds=0.0, decay_points=200.0)
        self.assertEqual(score_low, 0.0)

    def test_8_risk_classification_tiers(self):
        """Test 8: Classification correctly maps scores into LOW, MEDIUM, HIGH, and CRITICAL tiers."""
        classifier = RiskClassifier(self.config)

        self.assertEqual(classifier.classify(15.0)[0], "LOW")
        self.assertEqual(classifier.classify(35.0)[0], "MEDIUM")
        self.assertEqual(classifier.classify(60.0)[0], "HIGH")
        self.assertEqual(classifier.classify(85.0)[0], "CRITICAL")

    def test_9_multi_event_escalation_crowd_plus_fight(self):
        """Test 9: Crowd + Fight multi-event combination applies escalation bonus and triggers CRITICAL level."""
        ev_crowd = RiskEvent("1", "crowd_detection", "crowd_detected", 1.0, 1.0)
        ev_fight = RiskEvent("2", "behavior_detection", "potential_violent_activity", 0.90, 1.5, person_ids=[1, 2])

        out = self.processor.update(events=[ev_crowd, ev_fight], current_time=2.0)

        self.assertEqual(out["current_risk_level"], "CRITICAL")
        self.assertGreaterEqual(out["current_risk_score"], 80.0)
        self.assertEqual(len(out["active_incidents"]), 1)
        inc = out["active_incidents"][0]
        self.assertIn("crowd_plus_violent_activity", inc.applied_escalation_rules)
        self.assertEqual(inc.state, "ESCALATED")

    def test_10_multi_event_escalation_restricted_plus_aggression(self):
        """Test 10: Restricted area entry + Aggressive movement triggers multi-event escalation bonus (+20)."""
        ev_breach = RiskEvent("1", "restricted_area", "zone_breach", 0.95, 1.0, person_ids=[7], zone_name="LAB A")
        ev_aggr = RiskEvent("2", "behavior_detection", "aggressive_movement", 0.85, 2.0, person_ids=[7])

        out = self.processor.update(events=[ev_breach, ev_aggr], current_time=2.0)

        self.assertEqual(out["current_risk_level"], "CRITICAL")
        inc = out["active_incidents"][0]
        self.assertIn("restricted_plus_aggression", inc.applied_escalation_rules)

    def test_11_escalation_bonus_single_application(self):
        """Test 11: Escalation bonus is applied only once per incident rather than compounding every frame."""
        ev_breach = RiskEvent("1", "restricted_area", "zone_breach", 0.95, 1.0, person_ids=[7])
        ev_fight = RiskEvent("2", "behavior_detection", "potential_violent_activity", 0.90, 1.5, person_ids=[7])

        # Frame 1: Triggers restricted_plus_violent
        out1 = self.processor.update(events=[ev_breach, ev_fight], current_time=1.5)
        score1 = out1["current_risk_score"]

        # Frame 2: Same continuous events
        out2 = self.processor.update(events=[ev_breach, ev_fight], current_time=2.0)
        score2 = out2["current_risk_score"]

        # Bonus should not compound indefinitely
        self.assertEqual(score1, score2)

    def test_12_incident_creation_and_matching(self):
        """Test 12: Continuous frames update the same incident rather than creating duplicate incidents."""
        # 10 continuous frames of aggressive movement for person 15
        for i in range(10):
            t = i * 0.2
            ev = RiskEvent(f"EV-{i}", "behavior_detection", "aggressive_movement", 0.85, t, person_ids=[15])
            out = self.processor.update(events=[ev], current_time=t)

        # Should only have 1 active incident
        self.assertEqual(len(out["active_incidents"]), 1)
        inc = out["active_incidents"][0]
        self.assertEqual(inc.related_person_ids, {15})

    def test_13_duration_persistence_bonus(self):
        """Test 13: Sustained threat duration adds persistence bonus points to risk score."""
        # Frame at t=0.0s (duration 0s)
        ev0 = RiskEvent("1", "behavior_detection", "aggressive_movement", 0.80, 0.0, person_ids=[3])
        out0 = self.processor.update(events=[ev0], current_time=0.0)
        initial_score = out0["current_risk_score"]

        # Feed continuous events up to t=20.0s (persistence duration 20s -> max persistence bonus +10/+15)
        for i in range(1, 21):
            t = float(i)
            ev = RiskEvent(f"EV-{i}", "behavior_detection", "aggressive_movement", 0.80, t, person_ids=[3])
            out = self.processor.update(events=[ev], current_time=t)

        sustained_score = out["current_risk_score"]
        self.assertGreater(sustained_score, initial_score)

    def test_14_inactivity_decay_and_auto_resolution(self):
        """Test 14: Inactivity causes risk score decay and eventual transition to RESOLVED state."""
        # Ingest high risk event at t=0.0s
        ev = RiskEvent("1", "behavior_detection", "potential_violent_activity", 0.90, 0.0, person_ids=[1, 2])
        out = self.processor.update(events=[ev], current_time=0.0)
        self.assertEqual(out["current_risk_level"], "HIGH")

        # Advance time by 3.0s without events (inactive_timeout is 2.0s -> decay starts)
        out_decay = self.processor.update(events=[], current_time=3.0)
        self.assertLess(out_decay["current_risk_score"], out["current_risk_score"])

        # Advance time by 6.0s (resolution_timeout is 5.0s -> incident resolves)
        out_resolved = self.processor.update(events=[], current_time=6.0)
        self.assertEqual(len(out_resolved["active_incidents"]), 0)
        self.assertEqual(len(out_resolved["resolved_incidents"]), 1)
        self.assertEqual(out_resolved["current_risk_score"], 0.0)
        self.assertEqual(out_resolved["current_risk_level"], "LOW")

    def test_15_ui_overlay_rendering(self):
        """Test 15: Master Risk Assessment HUD renders across multiple resolutions without errors."""
        resolutions = [(358, 444), (480, 640), (720, 1280), (1080, 1920)]

        ev = RiskEvent("1", "behavior_detection", "potential_violent_activity", 0.92, 1.0, person_ids=[1, 2])
        risk_output = self.processor.update(events=[ev], current_time=1.0)

        for h, w in resolutions:
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            annotated = draw_risk_assessment_overlay(frame, risk_output, fps=30.0, ui_mode="demo")
            self.assertEqual(annotated.shape, (h, w, 3))

if __name__ == "__main__":
    unittest.main()
