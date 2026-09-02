"""
Pydantic Schemas for Detection Payloads and Bridge Requests
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Normalized bounding box coordinates (0.0 to 1.0)."""
    x: float = Field(..., ge=0.0, le=1.0, description="Top-left X coordinate normalized")
    y: float = Field(..., ge=0.0, le=1.0, description="Top-left Y coordinate normalized")
    w: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Width normalized")
    h: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Height normalized")
    width: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Width normalized alias")
    height: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Height normalized alias")


class TrackedPersonData(BaseModel):
    """Normalized tracked person bounding box and tracking ID."""
    trackId: Optional[int] = Field(default=None, description="ByteTrack tracking ID")
    bbox: Dict[str, float] = Field(..., description="Normalized bounding box coordinates {x, y, width, height}")


class DetectionPayload(BaseModel):
    """Payload sent to Next.js internal detection API (/api/internal/detection)."""
    organizationId: str = Field(..., min_length=1, description="Target organization ID")
    cameraId: str = Field(..., min_length=1, description="Source camera ID")
    moduleType: str = Field(..., min_length=1, description="AI Module type (e.g. OCCUPANCY_DETECTION)")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Detection confidence score between 0.0 and 1.0")
    source: Literal["DETECTION", "TEST"] = Field(default="DETECTION", description="Origin source of event")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Flexible metadata containing trackId, people, counts, etc.")


class CrowdDetectionMetadata(BaseModel):
    """Structured metadata specifically for Crowd / Occupancy Detection."""
    rawCount: int = Field(default=0, ge=0, description="Raw detected person count")
    stableCount: int = Field(default=0, ge=0, description="Stabilized person count")
    currentCount: int = Field(default=0, ge=0, description="Current count for rule engine")
    threshold: int = Field(default=10, ge=1, description="Crowd threshold")
    capacity: int = Field(default=10, ge=1, description="Capacity threshold for rule engine")
    state: str = Field(default="NORMAL", description="Crowd detection state (NORMAL, CHECKING CROWD, CROWD DETECTED)")
    people: List[Dict[str, Any]] = Field(default_factory=list, description="List of normalized tracked persons")


class TestDetectionRequest(BaseModel):
    """Request schema for test detection generation endpoint (/api/test/detection)."""
    __test__ = False
    cameraId: str = Field(default="demo-camera", min_length=1, description="Camera identifier")
    organizationId: str = Field(default="demo-org", min_length=1, description="Organization identifier")
    moduleType: str = Field(default="PERSON_DETECTION", description="Module type to simulate")
    confidence: float = Field(default=0.95, ge=0.0, le=1.0, description="Confidence score")


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str = "ok"
    service: str = "ai-campus-guardian-ml"


class BridgeResult(BaseModel):
    """Result of forwarding detection to frontend bridge."""
    success: bool
    statusCode: Optional[int] = None
    data: Optional[Any] = None
    error: Optional[str] = None
