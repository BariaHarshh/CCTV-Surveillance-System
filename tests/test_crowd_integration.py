"""
Unit and Integration Tests for Real Crowd Detection to Frontend Pipeline (Step 2)
"""

import time
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from backend.main import app
from backend.schemas.detection import DetectionPayload
from backend.services.publisher import AsyncDetectionPublisher
from features.crowd_detection.utils import normalize_tracked_persons


client = TestClient(app)


def test_normalize_tracked_persons():
    """Verify coordinate normalization clamps and calculates [0.0, 1.0] bbox."""
    raw_tracked = [
        {
            "track_id": 101,
            "box": (100, 200, 300, 600),
            "confidence": 0.92,
        },
        {
            "track_id": 102,
            "box": (-50, 100, 2000, 1200),  # Out of frame coordinates
            "confidence": 0.88,
        },
    ]

    frame_w, frame_h = 1920, 1080
    normalized = normalize_tracked_persons(raw_tracked, frame_w, frame_h)

    assert len(normalized) == 2
    p1 = normalized[0]
    assert p1["trackId"] == 101
    assert p1["confidence"] == 0.92
    assert p1["bbox"]["x"] == round(100 / 1920, 4)
    assert p1["bbox"]["y"] == round(200 / 1080, 4)
    assert p1["bbox"]["width"] == round(200 / 1920, 4)
    assert p1["bbox"]["height"] == round(400 / 1080, 4)

    # Clamped boundaries for p2
    p2 = normalized[1]
    assert p2["trackId"] == 102
    assert p2["bbox"]["x"] == 0.0
    assert p2["bbox"]["y"] == round(100 / 1080, 4)
    assert p2["bbox"]["width"] == 1.0
    assert p2["bbox"]["height"] == round((1080 - 100) / 1080, 4)


def test_normalize_tracked_persons_empty_or_invalid():
    """Verify empty or zero dimension frames return empty list safely."""
    assert normalize_tracked_persons([], 1920, 1080) == []
    assert normalize_tracked_persons([{"track_id": 1, "box": (0, 0, 10, 10)}], 0, 1080) == []


def test_crowd_detection_payload_creation():
    """Verify crowd detection payload structure conforms to DetectionPayload schema."""
    tracked_persons = [
        {"track_id": 1, "box": (100, 100, 200, 300), "confidence": 0.95},
        {"track_id": 2, "box": (300, 200, 400, 400), "confidence": 0.85},
    ]
    norm_people = normalize_tracked_persons(tracked_persons, 1000, 1000)

    metadata = {
        "rawCount": 2,
        "stableCount": 2,
        "currentCount": 2,
        "threshold": 10,
        "capacity": 10,
        "state": "NORMAL",
        "crowdDetected": False,
        "confirmationProgressSeconds": 0.0,
        "requiredPersistenceSeconds": 3.0,
        "people": norm_people,
    }

    payload = DetectionPayload(
        organizationId="66d550000000000000000001",
        cameraId="66d550000000000000000002",
        moduleType="OCCUPANCY_DETECTION",
        confidence=0.90,
        source="DETECTION",
        metadata=metadata,
    )

    assert payload.organizationId == "66d550000000000000000001"
    assert payload.cameraId == "66d550000000000000000002"
    assert payload.moduleType == "OCCUPANCY_DETECTION"
    assert payload.metadata["rawCount"] == 2
    assert payload.metadata["stableCount"] == 2
    assert payload.metadata["currentCount"] == 2
    assert len(payload.metadata["people"]) == 2


def test_publisher_throttling_and_state_change():
    """Verify publisher throttles periodic updates but immediately allows state changes."""
    publisher = AsyncDetectionPublisher(
        update_interval=1.0,  # 1 second interval
        enabled=True,
        organization_id="66d550000000000000000001",
        camera_id="66d550000000000000000002",
    )

    tracked = [{"track_id": 1, "box": (50, 50, 150, 200), "confidence": 0.9}]
    crowd_info_normal = {
        "person_count": 5,
        "threshold": 10,
        "crowd_detected": False,
        "confirmation_progress_seconds": 0.0,
        "required_persistence_seconds": 3.0,
        "status": "NORMAL",
    }

    try:
        # First push: accepted
        queued_1 = publisher.publish_crowd_detection(
            raw_count=5,
            stable_count=5,
            crowd_info=crowd_info_normal,
            tracked_persons=tracked,
            frame_width=640,
            frame_height=480,
        )
        assert queued_1 is True

        # Second push immediately within update interval (same state): skipped/throttled
        queued_2 = publisher.publish_crowd_detection(
            raw_count=5,
            stable_count=5,
            crowd_info=crowd_info_normal,
            tracked_persons=tracked,
            frame_width=640,
            frame_height=480,
        )
        assert queued_2 is False

        # Third push with state transition to "CHECKING CROWD": accepted immediately!
        crowd_info_checking = {
            "person_count": 12,
            "threshold": 10,
            "crowd_detected": False,
            "confirmation_progress_seconds": 0.5,
            "required_persistence_seconds": 3.0,
            "status": "CHECKING CROWD",
        }
        queued_3 = publisher.publish_crowd_detection(
            raw_count=12,
            stable_count=12,
            crowd_info=crowd_info_checking,
            tracked_persons=tracked,
            frame_width=640,
            frame_height=480,
        )
        assert queued_3 is True

        # Fourth push with state transition to "CROWD DETECTED": accepted immediately!
        crowd_info_alert = {
            "person_count": 12,
            "threshold": 10,
            "crowd_detected": True,
            "confirmation_progress_seconds": 3.0,
            "required_persistence_seconds": 3.0,
            "status": "CROWD DETECTED",
        }
        queued_4 = publisher.publish_crowd_detection(
            raw_count=12,
            stable_count=12,
            crowd_info=crowd_info_alert,
            tracked_persons=tracked,
            frame_width=640,
            frame_height=480,
        )
        assert queued_4 is True

    finally:
        publisher.stop()


def test_publisher_failure_isolation():
    """Verify publisher thread safely catches bridge network errors without crashing."""
    publisher = AsyncDetectionPublisher(
        update_interval=0.1,
        enabled=True,
    )

    with patch("backend.services.frontend_bridge.frontend_bridge.send_detection", new_callable=AsyncMock) as mock_send:
        mock_send.side_effect = Exception("Simulated network timeout")

        crowd_info = {
            "person_count": 1,
            "threshold": 10,
            "crowd_detected": False,
            "confirmation_progress_seconds": 0.0,
            "required_persistence_seconds": 3.0,
            "status": "NORMAL",
        }

        try:
            publisher.publish_crowd_detection(
                raw_count=1,
                stable_count=1,
                crowd_info=crowd_info,
                tracked_persons=[],
                frame_width=640,
                frame_height=480,
            )
            # Give background worker thread a moment to process the item
            time.sleep(0.3)
            # Worker thread should still be alive
            assert publisher.worker_thread.is_alive()
        finally:
            publisher.stop()


def test_api_forward_crowd_detection_endpoint():
    """Verify POST /api/detection/crowd accepts payload and invokes frontend bridge."""
    with patch("backend.services.frontend_bridge.frontend_bridge.send_detection", new_callable=AsyncMock) as mock_send:
        from backend.schemas.detection import BridgeResult
        mock_send.return_value = BridgeResult(
            success=True,
            statusCode=201,
            data={"eventId": "evt-crowd-001"},
            error=None,
        )

        sample_payload = {
            "organizationId": "66d550000000000000000001",
            "cameraId": "66d550000000000000000002",
            "moduleType": "OCCUPANCY_DETECTION",
            "confidence": 0.95,
            "source": "DETECTION",
            "metadata": {
                "rawCount": 15,
                "stableCount": 14,
                "currentCount": 14,
                "threshold": 10,
                "capacity": 10,
                "state": "CROWD DETECTED",
                "people": [],
            },
        }

        response = client.post("/api/detection/crowd", json=sample_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["statusCode"] == 201
        assert data["data"]["eventId"] == "evt-crowd-001"

        mock_send.assert_called_once()
        sent_payload = mock_send.call_args[0][0]
        assert sent_payload.moduleType == "OCCUPANCY_DETECTION"
        assert sent_payload.metadata["state"] == "CROWD DETECTED"
