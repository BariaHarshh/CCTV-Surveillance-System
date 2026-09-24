"""
Unit and Integration Tests for AI Metadata Enrichment Pipeline (Phase 1)
Verifies consistent, structured, normalized AI metadata payloads across all 4 cameras.
"""

import unittest
from backend.services.publisher import (
    AsyncDetectionPublisher,
    normalize_bbox,
    normalize_polygon_points,
    normalize_tracked_persons,
    normalize_tracked_objects,
    get_risk_level,
)


class TestAIMetadataPipeline(unittest.TestCase):

    def setUp(self):
        self.publisher = AsyncDetectionPublisher(enabled=False)
        self.frame_w = 1280
        self.frame_h = 720

    def test_normalized_bbox_coordinates(self):
        """Verify pixel bounding boxes are strictly normalized to 0.0 - 1.0."""
        box = (320, 180, 640, 540)  # Center box
        norm = normalize_bbox(box, self.frame_w, self.frame_h)
        self.assertEqual(norm["x"], 0.25)
        self.assertEqual(norm["y"], 0.25)
        self.assertEqual(norm["w"], 0.25)
        self.assertEqual(norm["h"], 0.5)
        self.assertEqual(norm["width"], 0.25)
        self.assertEqual(norm["height"], 0.5)

        # Out-of-bounds clamping
        oob_box = (-50, -50, 2000, 1500)
        norm_oob = normalize_bbox(oob_box, self.frame_w, self.frame_h)
        self.assertEqual(norm_oob["x"], 0.0)
        self.assertEqual(norm_oob["y"], 0.0)
        self.assertEqual(norm_oob["w"], 1.0)
        self.assertEqual(norm_oob["h"], 1.0)

    def test_normalized_polygon_points(self):
        """Verify zone polygon vertices are strictly normalized to 0.0 - 1.0."""
        points = [[0, 0], [640, 360], [1280, 720]]
        norm_pts = normalize_polygon_points(points, self.frame_w, self.frame_h)
        self.assertEqual(norm_pts, [[0.0, 0.0], [0.5, 0.5], [1.0, 1.0]])

    def test_camera1_crowd_metadata(self):
        """Verify Camera 1 (CAM-000001) Crowd detection metadata schema and values."""
        cam_id = "CAM-000001"
        tracked_persons = [
            {"track_id": 1, "box": (100, 100, 200, 300), "confidence": 0.94},
            {"track_id": 2, "box": (300, 150, 400, 350), "confidence": 0.91},
        ]
        crowd_info = {
            "status": "CROWD DETECTED",
            "threshold": 6,
            "crowd_detected": True,
            "confirmation_progress_seconds": 2.0,
            "required_persistence_seconds": 2.0,
        }

        success = self.publisher.publish_crowd_detection(
            raw_count=2,
            stable_count=2,
            crowd_info=crowd_info,
            tracked_persons=tracked_persons,
            frame_width=self.frame_w,
            frame_height=self.frame_h,
            camera_id=cam_id,
            frame_index=10,
            current_time=1.5,
            risk_score=35.0,
        )

        # Since enabled=False, check direct queue item or verify helper function
        # Let's verify by manually enabling enqueue or checking constructed data
        pub = AsyncDetectionPublisher(enabled=True)
        pub.enabled = False  # Keep thread stopped but enable logic
        pub.queue.queue.clear()
        pub.last_enqueued_time.clear()

        # Enqueue directly
        pub.enabled = True
        res = pub.publish_crowd_detection(
            raw_count=2,
            stable_count=2,
            crowd_info=crowd_info,
            tracked_persons=tracked_persons,
            frame_width=self.frame_w,
            frame_height=self.frame_h,
            camera_id=cam_id,
            frame_index=10,
            current_time=1.5,
            risk_score=35.0,
        )
        self.assertTrue(res)

        item = pub.queue.get_nowait()
        payload, force_immediate = item
        pub.stop()

        self.assertEqual(payload.cameraId, cam_id)
        self.assertEqual(payload.moduleType, "OCCUPANCY_DETECTION")
        self.assertAlmostEqual(payload.confidence, 0.925, places=2)

        meta = payload.metadata
        self.assertEqual(meta["cameraId"], cam_id)
        self.assertEqual(meta["moduleType"], "OCCUPANCY_DETECTION")
        self.assertEqual(meta["riskScore"], 35)
        self.assertEqual(meta["riskLevel"], "MEDIUM")
        self.assertEqual(meta["rawCount"], 2)
        self.assertEqual(meta["stableCount"], 2)
        self.assertEqual(meta["threshold"], 6)
        self.assertEqual(meta["crowdState"], "CROWD DETECTED")

        # Verify structured crowd subdict
        self.assertIn("crowd", meta)
        self.assertEqual(meta["crowd"]["crowdDetected"], True)
        self.assertEqual(len(meta["crowd"]["people"]), 2)

        # Verify normalized detections
        self.assertEqual(len(meta["detections"]), 2)
        p1 = meta["detections"][0]
        self.assertEqual(p1["trackId"], 1)
        self.assertEqual(p1["label"], "Person")
        self.assertTrue(0.0 <= p1["bbox"]["x"] <= 1.0)
        self.assertTrue(0.0 <= p1["bbox"]["w"] <= 1.0)

    def test_camera2_behavior_metadata(self):
        """Verify Camera 2 (CAM-000002) Behavior detection metadata schema and values."""
        cam_id = "CAM-000002"
        tracked_persons = [
            {"track_id": 5, "box": (200, 200, 300, 450), "confidence": 0.89},
        ]
        behavior_out = {
            "active_events": [],
            "person_states": {
                5: {
                    "primary_state": "FALLEN",
                    "fall_state": "POTENTIAL_FALL",
                    "fall_progress": 1.0,
                    "movement_state": "NORMAL",
                    "confidence": 0.88,
                }
            },
            "pair_states": {},
            "summary": {"active_alerts_count": 1},
        }

        pub = AsyncDetectionPublisher(enabled=True)
        pub.last_enqueued_time.clear()
        res = pub.publish_behavior_detection(
            tracked_persons=tracked_persons,
            behavior_out=behavior_out,
            frame_width=self.frame_w,
            frame_height=self.frame_h,
            camera_id=cam_id,
            frame_index=25,
            current_time=3.2,
            risk_score=60.0,
        )
        self.assertTrue(res)

        item = pub.queue.get_nowait()
        payload, _ = item
        pub.stop()

        self.assertEqual(payload.cameraId, cam_id)
        self.assertEqual(payload.moduleType, "PERSON_DETECTION")

        meta = payload.metadata
        self.assertEqual(meta["riskScore"], 60)
        self.assertEqual(meta["riskLevel"], "HIGH")
        self.assertEqual(meta["behaviorState"], "NORMAL")  # No active event objects in list
        self.assertIn("behavior", meta)
        self.assertEqual(meta["behavior"]["personCount"], 1)

        # Verify person states list
        p_states = meta["behavior"]["personStates"]
        self.assertEqual(len(p_states), 1)
        self.assertEqual(p_states[0]["trackId"], 5)
        self.assertEqual(p_states[0]["primaryState"], "FALLEN")
        self.assertEqual(p_states[0]["fallProgress"], 1.0)

        # Verify person normalized bbox
        self.assertEqual(len(meta["people"]), 1)
        self.assertEqual(meta["people"][0]["trackId"], 5)
        self.assertEqual(meta["people"][0]["primaryState"], "FALLEN")
        self.assertTrue(0.0 <= meta["people"][0]["bbox"]["x"] <= 1.0)

    def test_camera3_restricted_area_metadata(self):
        """Verify Camera 3 (CAM-000003) Restricted Area metadata schema and values."""
        cam_id = "CAM-000003"
        tracked_persons = [
            {"track_id": 8, "box": (400, 300, 500, 600), "confidence": 0.95},
        ]

        class DummyZone:
            name = "SERVER ROOM CRITICAL ZONE"
            severity = "critical"
            points = [[200, 200], [600, 200], [600, 500], [200, 500]]

        class DummyZoneManager:
            zones = [DummyZone()]

        restricted_out = {
            "active_intruders": [8],
            "zone_statuses": {
                "SERVER ROOM CRITICAL ZONE": {
                    "status": "ALERT",
                    "intruders_count": 1,
                    "intruder_ids": [8],
                    "checking_ids": [],
                }
            },
            "summary": {"has_breach": True, "status": "ALERT"},
        }

        pub = AsyncDetectionPublisher(enabled=True)
        pub.last_enqueued_time.clear()
        res = pub.publish_restricted_area_detection(
            tracked_persons=tracked_persons,
            restricted_out=restricted_out,
            zone_manager=DummyZoneManager(),
            frame_width=self.frame_w,
            frame_height=self.frame_h,
            camera_id=cam_id,
            frame_index=50,
            current_time=5.0,
            risk_score=75.0,
        )
        self.assertTrue(res)

        item = pub.queue.get_nowait()
        payload, force_immediate = item
        pub.stop()

        self.assertTrue(force_immediate)
        self.assertEqual(payload.cameraId, cam_id)
        self.assertEqual(payload.moduleType, "RESTRICTED_ZONE")

        meta = payload.metadata
        self.assertEqual(meta["riskScore"], 75)
        self.assertEqual(meta["riskLevel"], "CRITICAL")
        self.assertEqual(meta["zoneStatus"], "ALERT")
        self.assertEqual(meta["hasBreach"], True)
        self.assertEqual(meta["intruderCount"], 1)

        # Verify restricted area subdict
        self.assertIn("restrictedArea", meta)
        ra = meta["restrictedArea"]
        self.assertEqual(ra["activeIntruders"], [8])
        self.assertEqual(len(ra["zones"]), 1)
        z0 = ra["zones"][0]
        self.assertEqual(z0["name"], "SERVER ROOM CRITICAL ZONE")
        self.assertEqual(len(z0["points"]), 4)
        for pt in z0["points"]:
            self.assertTrue(0.0 <= pt[0] <= 1.0)
            self.assertTrue(0.0 <= pt[1] <= 1.0)

        # Verify intruder inZone flag
        self.assertEqual(meta["people"][0]["inZone"], True)

    def test_camera4_abandoned_object_metadata(self):
        """Verify Camera 4 (CAM-000004) Abandoned Object metadata schema and values."""
        cam_id = "CAM-000004"
        tracked_objects = [
            {"track_id": 12, "box": (500, 400, 600, 520), "confidence": 0.90, "class_name": "backpack"},
        ]
        tracked_persons = [
            {"track_id": 15, "box": (800, 300, 900, 600), "confidence": 0.93},
        ]
        abandoned_out = {
            "object_states": {
                12: {
                    "state": "UNATTENDED",
                    "unattended_duration": 4.5,
                    "closest_person_dist": 310.2,
                    "closest_person_id": 15,
                    "is_escalated": False,
                }
            },
            "active_events": ["EVENT_DUMMY"],
            "summary": {
                "unattended_count": 1,
                "abandoned_count": 0,
            },
        }

        pub = AsyncDetectionPublisher(enabled=True)
        pub.last_enqueued_time.clear()
        res = pub.publish_abandoned_object_detection(
            tracked_objects=tracked_objects,
            tracked_persons=tracked_persons,
            abandoned_out=abandoned_out,
            frame_width=self.frame_w,
            frame_height=self.frame_h,
            camera_id=cam_id,
            frame_index=75,
            current_time=8.0,
            risk_score=50.0,
        )
        self.assertTrue(res)

        item = pub.queue.get_nowait()
        payload, _ = item
        pub.stop()

        self.assertEqual(payload.cameraId, cam_id)
        self.assertEqual(payload.moduleType, "ABANDONED_OBJECT")

        meta = payload.metadata
        self.assertEqual(meta["riskScore"], 50)
        self.assertEqual(meta["riskLevel"], "HIGH")
        self.assertEqual(meta["objectStatus"], "UNATTENDED")
        self.assertEqual(meta["unattendedCount"], 1)
        self.assertEqual(meta["unattendedDuration"], 4.5)

        # Verify abandoned object subdict
        self.assertIn("abandonedObject", meta)
        ab = meta["abandonedObject"]
        self.assertEqual(len(ab["objects"]), 1)
        obj0 = ab["objects"][0]
        self.assertEqual(obj0["trackId"], 12)
        self.assertEqual(obj0["label"], "Backpack")
        self.assertEqual(obj0["status"], "UNATTENDED")
        self.assertEqual(obj0["timerSec"], 4.5)
        self.assertEqual(obj0["proximityDist"], 310.2)
        self.assertTrue(0.0 <= obj0["bbox"]["x"] <= 1.0)

    def test_risk_level_mapping(self):
        """Verify risk score to canonical risk level string mapping."""
        self.assertEqual(get_risk_level(10.0), "LOW")
        self.assertEqual(get_risk_level(25.0), "MEDIUM")
        self.assertEqual(get_risk_level(50.0), "HIGH")
        self.assertEqual(get_risk_level(85.0), "CRITICAL")


if __name__ == "__main__":
    unittest.main()
