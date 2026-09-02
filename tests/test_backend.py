"""
Unit tests for FastAPI ML Backend, Schemas, and Frontend Bridge
"""

import pytest
from unittest.mock import AsyncMock, patch
from pydantic import ValidationError
from fastapi.testclient import TestClient
import httpx

from backend.main import app
from backend.schemas.detection import (
    DetectionPayload,
    BoundingBox,
    TestDetectionRequest,
    HealthResponse,
)
from backend.services.frontend_bridge import FrontendBridgeService


client = TestClient(app)


def test_health_endpoint():
    """Verify GET /health returns 200 OK and expected structure immediately."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "status": "ok",
        "service": "ai-campus-guardian-ml",
    }


def test_detection_schema_valid():
    """Verify valid detection payload is successfully validated."""
    payload = DetectionPayload(
        organizationId="demo-org",
        cameraId="demo-camera",
        moduleType="PERSON_DETECTION",
        confidence=0.95,
        source="DETECTION",
        metadata={
            "trackId": 1,
            "label": "person",
            "boundingBox": {
                "x": 0.25,
                "y": 0.20,
                "w": 0.15,
                "h": 0.40,
            },
        },
    )
    assert payload.organizationId == "demo-org"
    assert payload.cameraId == "demo-camera"
    assert payload.moduleType == "PERSON_DETECTION"
    assert payload.confidence == 0.95
    assert payload.source == "DETECTION"
    assert payload.metadata["trackId"] == 1


def test_detection_schema_invalid_confidence():
    """Verify confidence > 1.0 or < 0.0 raises ValidationError."""
    with pytest.raises(ValidationError):
        DetectionPayload(
            organizationId="demo-org",
            cameraId="demo-camera",
            moduleType="PERSON_DETECTION",
            confidence=2.0,
            source="DETECTION",
        )

    with pytest.raises(ValidationError):
        DetectionPayload(
            organizationId="demo-org",
            cameraId="demo-camera",
            moduleType="PERSON_DETECTION",
            confidence=-0.1,
            source="DETECTION",
        )


def test_bounding_box_schema_validation():
    """Verify BoundingBox coordinates must be within 0.0 and 1.0."""
    box = BoundingBox(x=0.1, y=0.2, w=0.3, h=0.4)
    assert box.x == 0.1

    with pytest.raises(ValidationError):
        BoundingBox(x=-0.1, y=0.2, w=0.3, h=0.4)

    with pytest.raises(ValidationError):
        BoundingBox(x=0.1, y=1.5, w=0.3, h=0.4)


@pytest.mark.asyncio
async def test_frontend_bridge_success():
    """Verify frontend bridge sends correct headers and body to Next.js detection API."""
    service = FrontendBridgeService(
        base_url="http://mock-frontend:3000",
        api_key="test-secret-key",
    )

    payload = DetectionPayload(
        organizationId="test-org",
        cameraId="cam-01",
        moduleType="PERSON_DETECTION",
        confidence=0.92,
        source="DETECTION",
        metadata={"trackId": 42},
    )

    mock_response = httpx.Response(
        status_code=201,
        json={"success": True, "event": {"id": "evt-123"}},
        request=httpx.Request("POST", "http://mock-frontend:3000/api/internal/detection"),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        result = await service.send_detection(payload)

        assert result.success is True
        assert result.statusCode == 201
        assert result.data == {"success": True, "event": {"id": "evt-123"}}
        assert result.error is None

        mock_post.assert_called_once()
        called_url = mock_post.call_args[0][0]
        called_headers = mock_post.call_args[1]["headers"]
        called_json = mock_post.call_args[1]["json"]

        assert called_url == "http://mock-frontend:3000/api/internal/detection"
        assert called_headers["x-internal-service-key"] == "test-secret-key"
        assert called_json["organizationId"] == "test-org"
        assert called_json["cameraId"] == "cam-01"
        assert called_json["confidence"] == 0.92


@pytest.mark.asyncio
async def test_frontend_bridge_connection_error():
    """Verify frontend bridge gracefully handles connection errors without crashing."""
    service = FrontendBridgeService(
        base_url="http://unavailable-host:9999",
        api_key="test-key",
    )

    payload = DetectionPayload(
        organizationId="test-org",
        cameraId="cam-01",
        moduleType="PERSON_DETECTION",
        confidence=0.90,
    )

    with patch("httpx.AsyncClient.post", side_effect=httpx.ConnectError("Connection refused")):
        result = await service.send_detection(payload)

        assert result.success is False
        assert result.statusCode is None
        assert "Frontend offline or unreachable" in (result.error or "")


@pytest.mark.asyncio
async def test_frontend_bridge_auth_failure():
    """Verify frontend bridge identifies 401/403 status codes cleanly."""
    service = FrontendBridgeService(
        base_url="http://mock-frontend:3000",
        api_key="wrong-key",
    )
    payload = DetectionPayload(
        organizationId="test-org",
        cameraId="cam-01",
        moduleType="PERSON_DETECTION",
        confidence=0.90,
    )
    mock_response = httpx.Response(
        status_code=403,
        json={"error": "Forbidden"},
        request=httpx.Request("POST", "http://mock-frontend:3000/api/internal/detection"),
    )
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        result = await service.send_detection(payload)
        assert result.success is False
        assert result.statusCode == 403
        assert "403" in (result.error or "")


@pytest.mark.asyncio
async def test_frontend_bridge_ipv4_fallback():
    """Verify frontend bridge retries on 127.0.0.1 if localhost fails with ConnectError."""
    service = FrontendBridgeService(
        base_url="http://localhost:3000",
        api_key="test-key",
    )
    payload = DetectionPayload(
        organizationId="test-org",
        cameraId="cam-01",
        moduleType="PERSON_DETECTION",
        confidence=0.90,
    )
    mock_success = httpx.Response(
        status_code=200,
        json={"success": True},
        request=httpx.Request("POST", "http://127.0.0.1:3000/api/internal/detection"),
    )

    # First call fails on localhost, second succeeds on 127.0.0.1
    with patch.object(service, "_post_payload", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = [
            httpx.ConnectError("All connection attempts failed"),
            mock_success,
        ]
        result = await service.send_detection(payload)
        assert result.success is True
        assert result.statusCode == 200
        assert mock_post.call_count == 2
        # First call was localhost
        assert mock_post.call_args_list[0][0][1] == "http://localhost:3000/api/internal/detection"
        # Second call was 127.0.0.1
        assert mock_post.call_args_list[1][0][1] == "http://127.0.0.1:3000/api/internal/detection"


def test_api_test_detection_endpoint():
    """Verify POST /api/test/detection triggers simulated detection dispatch."""
    with patch("backend.services.frontend_bridge.frontend_bridge.send_detection", new_callable=AsyncMock) as mock_send:
        from backend.schemas.detection import BridgeResult
        mock_send.return_value = BridgeResult(
            success=True,
            statusCode=201,
            data={"status": "processed"},
            error=None,
        )

        response = client.post(
            "/api/test/detection",
            json={"cameraId": "custom-camera", "organizationId": "custom-org"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["statusCode"] == 201

        mock_send.assert_called_once()
        sent_payload = mock_send.call_args[0][0]
        assert sent_payload.cameraId == "custom-camera"
        assert sent_payload.organizationId == "custom-org"
