"""
AI Campus Guard - Abandoned Object Processor Module
Coordinates object tracking, stationary motion smoothing, proximity checking, abandonment timers,
Tier-2 prolonged abandonment escalation (20-30 min), area staff dispatch, and event deduplication.
"""

from collections import deque
from typing import List, Dict, Tuple, Any, Optional
import time

from .config import AbandonedObjectConfig, ObjectRuleConfig
from .event import PotentialAbandonedObjectEvent
from .tracker import ObjectTrackerManager, ObjectTrack
from .proximity import ProximityAnalyzer

class AbandonedObjectProcessor:
    """
    Stateful root coordinator for the Abandoned Object Detection module.
    Evaluates tracked objects and persons, manages state transitions, handles prolonged abandonment
    escalation to assigned area staff members, and emits structured events.
    """
    def __init__(self, config: Optional[AbandonedObjectConfig] = None):
        self.config = config or AbandonedObjectConfig()
        
        self.tracker_manager = ObjectTrackerManager(
            stale_track_timeout_seconds=self.config.stale_track_timeout_seconds,
            max_history_seconds=self.config.history_seconds
        )
        
        self.proximity_analyzer = ProximityAnalyzer(
            proximity_threshold_px=self.config.person_proximity_threshold_px
        )

        # Buffer of active events currently displayed on HUD
        self.recent_active_events: List[Tuple[PotentialAbandonedObjectEvent, float]] = []
        self.event_history: deque[PotentialAbandonedObjectEvent] = deque(maxlen=5)

    def update(
        self,
        tracked_objects: List[Dict[str, Any]],
        tracked_persons: List[Dict[str, Any]],
        current_time: Optional[float] = None,
        frame_shape: Optional[Tuple[int, int]] = None
    ) -> Dict[str, Any]:
        """
        Processes single-frame object and person detections.

        Args:
            tracked_objects: List of object dicts {'track_id', 'box', 'confidence', 'class_name'}
            tracked_persons: List of person dicts {'track_id', 'box', 'confidence'}
            current_time: Current timestamp in seconds (Unix or video timeline)
            frame_shape: Optional (height, width) tuple of the frame

        Returns:
            Dict containing:
                - 'new_events': List[PotentialAbandonedObjectEvent] emitted in this frame
                - 'active_events': List[PotentialAbandonedObjectEvent] currently in alert state
                - 'event_history': List[PotentialAbandonedObjectEvent] recent incident history
                - 'object_states': Dict[track_id -> object status & metrics]
                - 'summary': High-level statistics
        """
        now = current_time if current_time is not None else time.time()

        if not self.config.enabled:
            return {
                "new_events": [],
                "active_events": [],
                "event_history": list(self.event_history),
                "object_states": {},
                "summary": {"total_objects": len(tracked_objects), "unattended_count": 0, "abandoned_count": 0, "has_alert": False}
            }

        # 1. Update temporal object tracks and prune stale items
        active_tracks = self.tracker_manager.update(tracked_objects, current_time=now)
        new_events: List[PotentialAbandonedObjectEvent] = []
        object_states: Dict[int, Dict[str, Any]] = {}

        unattended_count = 0
        abandoned_count = 0
        escalation_threshold = self.config.get_effective_escalation_seconds()

        # 2. Evaluate each tracked object's motion and proximity
        for tid, track in active_tracks.items():
            if not track.observations:
                continue

            last_obs = track.observations[-1]
            rule = self.config.get_rule_for_class(track.object_class)

            # Check stationary status using smoothed displacement
            is_stat = track.is_stationary(
                threshold_px=self.config.stationary_threshold_px,
                window_seconds=self.config.stationary_window_seconds
            )

            if not is_stat:
                track.state = "MOVING"
                track.stationary_since = None
                track.unattended_since = None
                track.nearby_person_ids = []
                track.closest_person_id = None
                track.closest_person_dist = None
                track.is_escalated = False
                stat_duration = 0.0
                unattended_duration = 0.0
            else:
                if track.stationary_since is None:
                    track.stationary_since = now
                stat_duration = max(0.0, now - track.stationary_since)

                # Check proximity to detected persons
                is_attended, nearby_pids, closest_pid, closest_pdist = self.proximity_analyzer.check_proximity(
                    last_obs.box,
                    tracked_persons
                )
                track.nearby_person_ids = nearby_pids
                track.closest_person_id = closest_pid
                track.closest_person_dist = closest_pdist

                if is_attended:
                    track.state = "ATTENDED"
                    track.unattended_since = None  # Reset timer when attended!
                    track.is_escalated = False
                    unattended_duration = 0.0
                else:
                    if track.unattended_since is None:
                        track.unattended_since = now
                    unattended_duration = max(0.0, now - track.unattended_since)

                    if unattended_duration < rule.unattended_seconds:
                        track.state = "UNATTENDED"
                        track.is_escalated = False
                        unattended_count += 1
                    else:
                        # Check whether this is Tier-2 Prolonged Abandonment Escalation (20-30 min)
                        if unattended_duration >= escalation_threshold:
                            track.state = "PROLONGED_ABANDONED_ESCALATED"
                            track.is_escalated = True
                            unattended_count += 1
                            abandoned_count += 1

                            # Lookup on-duty staff member assigned to this area
                            staff_info = self.config.get_staff_for_location(self.config.location)

                            # Check cooldown for escalation alert
                            in_cooldown = (now - track.last_escalation_time) < self.config.alert_cooldown_seconds
                            if not in_cooldown:
                                track.last_escalation_time = now
                                event = PotentialAbandonedObjectEvent.create(
                                    object_id=tid,
                                    object_class=track.object_class,
                                    confidence=0.98,
                                    severity="critical",
                                    video_time=now,
                                    stationary_duration=stat_duration,
                                    unattended_duration=unattended_duration,
                                    nearby_person_ids=nearby_pids,
                                    closest_person_id=closest_pid,
                                    closest_person_distance=closest_pdist,
                                    state="PROLONGED_ABANDONED_ESCALATED",
                                    camera_id=self.config.camera_id,
                                    location=self.config.location,
                                    is_escalated=True,
                                    assigned_staff_name=staff_info.get("staff_name"),
                                    assigned_staff_role=staff_info.get("role"),
                                    assigned_staff_contact=staff_info.get("contact"),
                                    escalation_status="STAFF_ALERT_TRANSMITTED",
                                    event_type="prolonged_abandoned_object_escalation",
                                    metadata={
                                        "required_unattended_seconds": rule.unattended_seconds,
                                        "escalation_threshold_seconds": escalation_threshold,
                                        "risk_score": 100,
                                        "display_name": rule.display_name,
                                        "staff_info": staff_info
                                    }
                                )
                                new_events.append(event)

                        else:
                            # Tier-1 Potential Abandoned Alert
                            track.state = "POTENTIAL_ABANDONED"
                            track.is_escalated = False
                            unattended_count += 1
                            abandoned_count += 1

                            # Check cooldown / deduplication to prevent duplicate events per frame
                            in_cooldown = (now - track.last_alert_time) < self.config.alert_cooldown_seconds
                            if not in_cooldown:
                                track.last_alert_time = now

                                # Confidence calculation (explainable normalized formula)
                                det_conf = last_obs.confidence
                                timer_ratio = min(1.0, unattended_duration / max(1.0, rule.unattended_seconds))
                                prox_factor = 1.0 if (closest_pdist is None or closest_pdist > 250) else 0.7
                                calc_conf = min(0.99, max(0.50, 0.45 * det_conf + 0.35 * timer_ratio + 0.20 * prox_factor))

                                event = PotentialAbandonedObjectEvent.create(
                                    object_id=tid,
                                    object_class=track.object_class,
                                    confidence=calc_conf,
                                    severity=rule.severity,
                                    video_time=now,
                                    stationary_duration=stat_duration,
                                    unattended_duration=unattended_duration,
                                    nearby_person_ids=nearby_pids,
                                    closest_person_id=closest_pid,
                                    closest_person_distance=closest_pdist,
                                    state="POTENTIAL_ABANDONED",
                                    camera_id=self.config.camera_id,
                                    location=self.config.location,
                                    is_escalated=False,
                                    metadata={
                                        "required_unattended_seconds": rule.unattended_seconds,
                                        "risk_score": rule.risk_score,
                                        "display_name": rule.display_name
                                    }
                                )
                                new_events.append(event)

            # Store per-object state for visualization
            timer_prog = min(1.0, unattended_duration / rule.unattended_seconds) if rule.unattended_seconds > 0 else 0.0
            object_states[tid] = {
                "track_id": tid,
                "object_class": track.object_class,
                "display_name": rule.display_name,
                "state": track.state,
                "is_escalated": track.is_escalated,
                "box": last_obs.box,
                "confidence": last_obs.confidence,
                "stationary_duration": round(stat_duration, 1),
                "unattended_duration": round(unattended_duration, 1),
                "required_seconds": rule.unattended_seconds,
                "escalation_threshold": escalation_threshold,
                "timer_progress": round(timer_prog, 2),
                "nearby_person_ids": track.nearby_person_ids,
                "closest_person_id": track.closest_person_id,
                "closest_person_distance": round(track.closest_person_dist, 1) if track.closest_person_dist is not None else None
            }

        # 3. Update active events buffer and event history
        for ev in new_events:
            self.recent_active_events.append((ev, now + self.config.event_display_ttl))
            self.event_history.append(ev)

        # Expire old events from HUD buffer
        self.recent_active_events = [
            (ev, exp) for (ev, exp) in self.recent_active_events if exp > now
        ]
        active_events = [ev for (ev, _) in self.recent_active_events]

        return {
            "new_events": new_events,
            "active_events": active_events,
            "event_history": list(self.event_history),
            "object_states": object_states,
            "summary": {
                "total_objects": len(active_tracks),
                "unattended_count": unattended_count,
                "abandoned_count": abandoned_count,
                "has_alert": len(active_events) > 0,
                "has_escalation": any(getattr(ev, "is_escalated", False) for ev in active_events)
            }
        }
