"""
Detection Routes
Handles test detection dispatch and detection bridge forwarding.
"""

from fastapi import APIRouter, status
from backend.schemas.detection import (
    TestDetectionRequest,
    DetectionPayload,
    BridgeResult,
)
from backend.services.frontend_bridge import frontend_bridge

router = APIRouter(prefix="/api", tags=["Detection"])


@router.post(
    "/test/detection",
    response_model=BridgeResult,
    summary="Generate and dispatch a simulated detection to the Next.js frontend",
    status_code=status.HTTP_200_OK,
)
async def test_detection(request: TestDetectionRequest = TestDetectionRequest()):
    """
    Creates a simulated person detection payload and forwards it
    to the Next.js frontend internal detection endpoint.
    """
    fake_detection = DetectionPayload(
        organizationId=request.organizationId,
        cameraId=request.cameraId,
        moduleType=request.moduleType,
        confidence=request.confidence,
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

    result = await frontend_bridge.send_detection(fake_detection)
    return result


@router.post(
    "/detection/crowd",
    response_model=BridgeResult,
    summary="Forward normalized Crowd Detection payload to Next.js Frontend",
    status_code=status.HTTP_200_OK,
)
async def forward_crowd_detection(payload: DetectionPayload):
    """
    Accepts a normalized crowd/occupancy detection payload and dispatches
    it directly to the Next.js internal detection API.
    """
    result = await frontend_bridge.send_detection(payload)
    return result
