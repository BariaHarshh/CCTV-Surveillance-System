"""
Unit tests for FastAPI ML Backend, Schemas, and Frontend Bridge
"""

import unittest
import asyncio
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

class TestBackend(unittest.TestCase):

    def test_health_endpoint(self):
        """Verify GET /health returns 200 OK and expected structure immediately."""
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data, {
            "status": "ok",
            "service": "ai-campus-guardian-ml",
        })

    def test_detection_schema_valid(self):
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
        self.assertEqual(payload.organizationId, "demo-org")
        self.assertEqual(payload.cameraId, "demo-camera")
        self.assertEqual(payload.moduleType, "PERSON_DETECTION")
        self.assertEqual(payload.confidence, 0.95)
        self.assertEqual(payload.source, "DETECTION")
        self.assertEqual(payload.metadata["trackId"], 1)

    def test_detection_schema_invalid_confidence(self):
        """Verify confidence > 1.0 or < 0.0 raises ValidationError."""
        with self.assertRaises(ValidationError):
            DetectionPayload(
                organizationId="demo-org",
                cameraId="demo-camera",
                moduleType="PERSON_DETECTION",
                confidence=2.0,
                source="DETECTION",
            )

        with self.assertRaises(ValidationError):
            DetectionPayload(
                organizationId="demo-org",
                cameraId="demo-camera",
                moduleType="PERSON_DETECTION",
                confidence=-0.1,
                source="DETECTION",
            )

    def test_bounding_box_schema_validation(self):
        """Verify BoundingBox coordinates must be within 0.0 and 1.0."""
        box = BoundingBox(x=0.1, y=0.2, w=0.3, h=0.4)
        self.assertEqual(box.x, 0.1)

        with self.assertRaises(ValidationError):
            BoundingBox(x=-0.1, y=0.2, w=0.3, h=0.4)

        with self.assertRaises(ValidationError):
            BoundingBox(x=0.1, y=1.5, w=0.3, h=0.4)

    def test_frontend_bridge_success(self):
        """Verify frontend bridge sends correct headers and body to Next.js detection API."""
        async def _test():
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

                self.assertTrue(result.success)
                self.assertEqual(result.statusCode, 201)
                self.assertEqual(result.data, {"success": True, "event": {"id": "evt-123"}})
                self.assertIsNone(result.error)

                mock_post.assert_called_once()
                called_url = mock_post.call_args[0][0]
                called_headers = mock_post.call_args[1]["headers"]
                called_json = mock_post.call_args[1]["json"]

                self.assertEqual(called_url, "http://mock-frontend:3000/api/internal/detection")
                self.assertEqual(called_headers["x-internal-service-key"], "test-secret-key")
                self.assertEqual(called_json["organizationId"], "test-org")
                self.assertEqual(called_json["cameraId"], "cam-01")
                self.assertEqual(called_json["confidence"], 0.92)

        asyncio.run(_test())

    def test_frontend_bridge_connection_error(self):
        """Verify frontend bridge gracefully handles connection errors without crashing."""
        async def _test():
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

                self.assertFalse(result.success)
                self.assertIsNone(result.statusCode)
                self.assertIn("Frontend offline or unreachable", result.error or "")

        asyncio.run(_test())

    def test_frontend_bridge_auth_failure(self):
        """Verify frontend bridge identifies 401/403 status codes cleanly."""
        async def _test():
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
                self.assertFalse(result.success)
                self.assertEqual(result.statusCode, 403)
                self.assertIn("403", result.error or "")

        asyncio.run(_test())

    def test_frontend_bridge_ipv4_fallback(self):
        """Verify frontend bridge retries on 127.0.0.1 if localhost fails with ConnectError."""
        async def _test():
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

            with patch.object(service, "_post_payload", new_callable=AsyncMock) as mock_post:
                mock_post.side_effect = [
                    httpx.ConnectError("All connection attempts failed"),
                    mock_success,
                ]
                result = await service.send_detection(payload)
                self.assertTrue(result.success)
                self.assertEqual(result.statusCode, 200)
                self.assertEqual(mock_post.call_count, 2)
                self.assertEqual(mock_post.call_args_list[0][0][1], "http://localhost:3000/api/internal/detection")
                self.assertEqual(mock_post.call_args_list[1][0][1], "http://127.0.0.1:3000/api/internal/detection")

        asyncio.run(_test())

    def test_api_test_detection_endpoint(self):
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

            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data["success"])
            self.assertEqual(data["statusCode"], 201)

            mock_send.assert_called_once()
            sent_payload = mock_send.call_args[0][0]
            self.assertEqual(sent_payload.cameraId, "custom-camera")
            self.assertEqual(sent_payload.organizationId, "custom-org")

if __name__ == "__main__":
    unittest.main()
