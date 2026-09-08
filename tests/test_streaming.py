"""
Unit and Integration Tests for Live AI Video Streaming (Step 3)
"""

import unittest
import asyncio
import numpy as np
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.stream_manager import StreamFrameManager, stream_manager

client = TestClient(app)

class TestStreaming(unittest.TestCase):

    def test_frame_manager_update_and_get(self):
        """Verify updating the frame buffer stores valid JPEG bytes and metadata."""
        manager = StreamFrameManager()
        cam_id = "test-cam-01"

        dummy_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        dummy_frame[:, :] = (0, 255, 0)

        success = manager.update_frame(cam_id, dummy_frame, quality=85, frame_index=1)
        self.assertTrue(success)

        jpeg_bytes = manager.get_latest_frame_bytes(cam_id)
        self.assertIsNotNone(jpeg_bytes)
        self.assertIsInstance(jpeg_bytes, bytes)
        self.assertTrue(jpeg_bytes.startswith(b"\xff\xd8"))
        self.assertTrue(jpeg_bytes.endswith(b"\xff\xd9"))

        self.assertTrue(manager.is_stream_active(cam_id))

        status = manager.get_stream_status(cam_id)
        self.assertEqual(status["cameraId"], cam_id)
        self.assertTrue(status["active"])
        self.assertEqual(status["resolution"], "100x100")

    def test_frame_manager_placeholder_generation(self):
        """Verify placeholder JPEG generation produces valid image bytes."""
        manager = StreamFrameManager()
        placeholder_bytes = manager.create_placeholder_jpeg("CAMERA OFFLINE TEST", 320, 240)
        self.assertIsInstance(placeholder_bytes, bytes)
        self.assertTrue(placeholder_bytes.startswith(b"\xff\xd8"))
        self.assertTrue(placeholder_bytes.endswith(b"\xff\xd9"))

    def test_frame_manager_empty_frame_handling(self):
        """Verify passing None or empty numpy array is rejected safely."""
        manager = StreamFrameManager()
        self.assertFalse(manager.update_frame("cam-empty", None))
        self.assertFalse(manager.update_frame("cam-empty", np.array([])))
        self.assertIsNone(manager.get_latest_frame_bytes("cam-empty"))
        self.assertFalse(manager.is_stream_active("cam-empty"))

    def test_mjpeg_stream_generator(self):
        """Verify generator yields properly formatted multipart/x-mixed-replace MJPEG chunks."""
        async def _test():
            manager = StreamFrameManager()
            cam_id = "stream-cam-test"

            dummy_frame = np.zeros((64, 64, 3), dtype=np.uint8)
            manager.update_frame(cam_id, dummy_frame)

            gen = manager.generate_mjpeg_stream(cam_id, target_fps=30)
            chunk = await gen.__anext__()
            self.assertIn(b"--frame\r\n", chunk)
            self.assertIn(b"Content-Type: image/jpeg\r\n", chunk)
            self.assertIn(b"Content-Length: ", chunk)
            self.assertIn(b"\xff\xd8", chunk)

        asyncio.run(_test())

    def test_mjpeg_stream_offline_fallback(self):
        """Verify generator yields placeholder chunk when no camera frame is active."""
        async def _test():
            manager = StreamFrameManager()
            cam_id = "non-existent-cam"

            gen = manager.generate_mjpeg_stream(cam_id, target_fps=30)
            chunk = await gen.__anext__()
            self.assertIn(b"--frame\r\n", chunk)
            self.assertIn(b"Content-Type: image/jpeg\r\n", chunk)
            self.assertIn(b"\xff\xd8", chunk)

        asyncio.run(_test())

    def test_api_stream_status_endpoint(self):
        """Verify GET /api/cameras/{cameraId}/stream/status returns valid JSON."""
        cam_id = "status-cam-test"
        dummy_frame = np.zeros((80, 80, 3), dtype=np.uint8)
        stream_manager.update_frame(cam_id, dummy_frame)

        response = client.get(f"/api/cameras/{cam_id}/stream/status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["cameraId"], cam_id)
        self.assertTrue(data["active"])
        self.assertEqual(data["resolution"], "80x80")

    def test_api_list_streams_endpoint(self):
        """Verify GET /api/cameras/streams lists all known camera streams."""
        response = client.get("/api/cameras/streams")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)

    def test_api_stream_endpoint_response_headers(self):
        """Verify get_camera_stream returns StreamingResponse with multipart headers."""
        async def _test():
            from backend.routes.stream import get_camera_stream
            cam_id = "header-test-cam"
            dummy_frame = np.zeros((64, 64, 3), dtype=np.uint8)
            stream_manager.update_frame(cam_id, dummy_frame)

            response = await get_camera_stream(cam_id)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.media_type, "multipart/x-mixed-replace; boundary=frame")
            self.assertIn("Cache-Control", response.headers)
            chunk = await response.body_iterator.__anext__()
            self.assertIn(b"--frame\r\n", chunk)
            self.assertIn(b"Content-Type: image/jpeg\r\n", chunk)

    def test_camera_id_mapping_resolution(self):
        """Verify CAM-000001 resolves to ML stream 66d550000000000000000002."""
        ml_id = "66d550000000000000000002"
        app_id = "CAM-000001"
        dummy_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        stream_manager.update_frame(ml_id, dummy_frame)

        # Query status via frontend camera ID
        status_res = client.get(f"/api/cameras/{app_id}/stream/status")
        self.assertEqual(status_res.status_code, 200)
        data = status_res.json()
        self.assertEqual(data["cameraId"], app_id)
        self.assertTrue(data["active"])
        self.assertEqual(data["resolution"], "100x100")

        # Verify stream generator resolves to ML stream frames
        async def _test():
            gen = stream_manager.generate_mjpeg_stream(app_id)
            chunk = await gen.__anext__()
            self.assertIn(b"--frame\r\n", chunk)
            self.assertIn(b"Content-Type: image/jpeg\r\n", chunk)
        asyncio.run(_test())

    def test_four_camera_concurrent_streams(self):
        """Verify 4 simultaneous camera streams can update and stream independently."""
        cams = [
            ("CAM-000001", "66d550000000000000000002", (640, 480)),
            ("CAM-000002", "66d550000000000000000003", (640, 480)),
            ("CAM-000003", "66d550000000000000000004", (640, 480)),
            ("CAM-000004", "66d550000000000000000005", (640, 480)),
        ]

        # 1. Update all 4 camera buffers
        for app_id, ml_id, (w, h) in cams:
            frame = np.zeros((h, w, 3), dtype=np.uint8)
            stream_manager.update_frame(ml_id, frame)

        # 2. Verify all 4 streams active via both app ID and ML ID
        for app_id, ml_id, _ in cams:
            st1 = stream_manager.get_stream_status(app_id)
            st2 = stream_manager.get_stream_status(ml_id)
            self.assertTrue(st1["active"])
            self.assertTrue(st2["active"])

        # 3. Verify each stream yields independent valid JPEG chunks
        async def _test_all():
            for app_id, _, _ in cams:
                gen = stream_manager.generate_mjpeg_stream(app_id)
                chunk = await gen.__anext__()
                self.assertIn(b"--frame\r\n", chunk)
                self.assertIn(b"Content-Type: image/jpeg\r\n", chunk)
        asyncio.run(_test_all())


if __name__ == "__main__":
    unittest.main()
