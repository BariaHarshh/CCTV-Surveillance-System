"""
Health Check Route
Provides a fast, lightweight liveness/readiness endpoint.
"""

from fastapi import APIRouter
from backend.schemas.detection import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Returns the status of the Python ML backend service.
    Fast response without loading ML models or external dependencies.
    """
    return HealthResponse(status="ok", service="ai-campus-guardian-ml")
