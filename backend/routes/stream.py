"""
Live Video Streaming Routes
Provides MJPEG streaming over HTTP for browser playback and stream health status.
"""

from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from backend.config import settings
from backend.services.stream_manager import stream_manager

router = APIRouter(prefix="/api/cameras", tags=["Live Streaming"])


@router.get(
    "/{camera_id}/stream",
    summary="Get live AI annotated MJPEG video stream for a camera",
    response_class=StreamingResponse,
)
async def get_camera_stream(
    camera_id: str,
    fps: int = Query(default=10, ge=1, le=30, description="Target streaming frame rate"),
    quality: int = Query(default=65, ge=30, le=95, description="JPEG compression quality"),
):
    """
    Returns a continuous MJPEG video stream (multipart/x-mixed-replace)
    containing real-time AI bounding boxes, ByteTrack IDs, and crowd HUD overlays.
    Can be directly embedded in HTML: `<img src="http://localhost:8000/api/cameras/{cameraId}/stream">`.
    """
    actual_fps = fps if isinstance(fps, int) else settings.stream_fps
    actual_quality = quality if isinstance(quality, int) else settings.stream_jpeg_quality
    return StreamingResponse(
        stream_manager.generate_mjpeg_stream(
            camera_id=camera_id,
            target_fps=actual_fps,
            quality=actual_quality,
        ),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Accel-Buffering": "no",
            "Connection": "close",
        },
    )


@router.get(
    "/{camera_id}/stream/status",
    summary="Check stream availability and status for a camera",
    status_code=status.HTTP_200_OK,
)
async def get_camera_stream_status(camera_id: str) -> Dict[str, Any]:
    """
    Returns streaming availability, current frame age, resolution, and estimated FPS.
    """
    return stream_manager.get_stream_status(camera_id)


@router.get(
    "/streams",
    summary="List status for all known camera streams",
    status_code=status.HTTP_200_OK,
)
async def list_all_camera_streams() -> List[Dict[str, Any]]:
    """
    Returns an array of status objects for all registered camera streams.
    """
    return stream_manager.get_all_streams()


import time
from fastapi import Request

@router.post(
    "/{camera_id}/frame",
    summary="Update live frame buffer for a camera",
    status_code=status.HTTP_200_OK,
)
async def update_camera_frame(camera_id: str, request: Request):
    """
    Accepts raw JPEG frame bytes from external runner process and updates the stream buffer.
    """
    jpeg_bytes = await request.body()
    if not jpeg_bytes:
        raise HTTPException(status_code=400, detail="Empty frame body")

    resolved_id = stream_manager.resolve_camera_id(camera_id)
    now = time.time()
    frame_data = {
        "jpeg_bytes": jpeg_bytes,
        "timestamp": now,
        "frame_index": 0,
        "width": 640,
        "height": 480,
    }

    with stream_manager._condition:
        stream_manager._frames[resolved_id] = frame_data
        if camera_id != resolved_id:
            stream_manager._frames[camera_id] = frame_data
        stream_manager._condition.notify_all()

    return {"status": "ok", "cameraId": camera_id, "resolvedId": resolved_id}
