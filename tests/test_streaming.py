"""
Unit and Integration Tests for Live AI Video Streaming (Step 3)
"""

import asyncio
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.stream_manager import StreamFrameManager, stream_manager


client = TestClient(app)


def test_frame_manager_update_and_get():
    """Verify updating the frame buffer stores valid JPEG bytes and metadata."""
    manager = StreamFrameManager()
    cam_id = "test-cam-01"

    # Create dummy 100x100 BGR image
    dummy_frame = np.zeros((100, 100, 3), dtype=np.uint8)
    dummy_frame[:, :] = (0, 255, 0)

    success = manager.update_frame(cam_id, dummy_frame, quality=85, frame_index=1)
    assert success is True

    jpeg_bytes = manager.get_latest_frame_bytes(cam_id)
    assert jpeg_bytes is not None
    assert isinstance(jpeg_bytes, bytes)
    # Check JPEG SOI and EOI markers
    assert jpeg_bytes.startswith(b"\xff\xd8")
    assert jpeg_bytes.endswith(b"\xff\xd9")

    assert manager.is_stream_active(cam_id) is True

    status = manager.get_stream_status(cam_id)
    assert status["cameraId"] == cam_id
    assert status["active"] is True
    assert status["resolution"] == "100x100"


def test_frame_manager_placeholder_generation():
    """Verify placeholder JPEG generation produces valid image bytes."""
    manager = StreamFrameManager()
    placeholder_bytes = manager.create_placeholder_jpeg("CAMERA OFFLINE TEST", 320, 240)
    assert isinstance(placeholder_bytes, bytes)
    assert placeholder_bytes.startswith(b"\xff\xd8")
    assert placeholder_bytes.endswith(b"\xff\xd9")


def test_frame_manager_empty_frame_handling():
    """Verify passing None or empty numpy array is rejected safely."""
    manager = StreamFrameManager()
    assert manager.update_frame("cam-empty", None) is False
    assert manager.update_frame("cam-empty", np.array([])) is False
    assert manager.get_latest_frame_bytes("cam-empty") is None
    assert manager.is_stream_active("cam-empty") is False


@pytest.mark.asyncio
async def test_mjpeg_stream_generator():
    """Verify generator yields properly formatted multipart/x-mixed-replace MJPEG chunks."""
    manager = StreamFrameManager()
    cam_id = "stream-cam-test"

    dummy_frame = np.zeros((64, 64, 3), dtype=np.uint8)
    manager.update_frame(cam_id, dummy_frame)

    gen = manager.generate_mjpeg_stream(cam_id, target_fps=30)

    # Read first chunk
    chunk = await gen.__anext__()
    assert b"--frame\r\n" in chunk
    assert b"Content-Type: image/jpeg\r\n" in chunk
    assert b"Content-Length: " in chunk
    assert b"\xff\xd8" in chunk  # JPEG SOI


@pytest.mark.asyncio
async def test_mjpeg_stream_offline_fallback():
    """Verify generator yields placeholder chunk when no camera frame is active."""
    manager = StreamFrameManager()
    cam_id = "non-existent-cam"

    gen = manager.generate_mjpeg_stream(cam_id, target_fps=30)
    chunk = await gen.__anext__()
    assert b"--frame\r\n" in chunk
    assert b"Content-Type: image/jpeg\r\n" in chunk
    assert b"\xff\xd8" in chunk


def test_api_stream_status_endpoint():
    """Verify GET /api/cameras/{cameraId}/stream/status returns valid JSON."""
    cam_id = "status-cam-test"
    dummy_frame = np.zeros((80, 80, 3), dtype=np.uint8)
    stream_manager.update_frame(cam_id, dummy_frame)

    response = client.get(f"/api/cameras/{cam_id}/stream/status")
    assert response.status_code == 200
    data = response.json()
    assert data["cameraId"] == cam_id
    assert data["active"] is True
    assert data["resolution"] == "80x80"


def test_api_list_streams_endpoint():
    """Verify GET /api/cameras/streams lists all known camera streams."""
    response = client.get("/api/cameras/streams")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_api_stream_endpoint_response_headers():
    """Verify get_camera_stream returns StreamingResponse with multipart headers."""
    from backend.routes.stream import get_camera_stream
    cam_id = "header-test-cam"
    dummy_frame = np.zeros((64, 64, 3), dtype=np.uint8)
    stream_manager.update_frame(cam_id, dummy_frame)

    response = await get_camera_stream(cam_id)
    assert response.status_code == 200
    assert response.media_type == "multipart/x-mixed-replace; boundary=frame"
    assert "Cache-Control" in response.headers
    chunk = await response.body_iterator.__anext__()
    assert b"--frame\r\n" in chunk
    assert b"Content-Type: image/jpeg\r\n" in chunk
