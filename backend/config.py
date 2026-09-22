"""
Backend Configuration Module
Loads environment variables and server settings for FastAPI backend.
"""

import os
from typing import List
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class BackendSettings:
    """Backend settings loaded from environment variables."""

    def __init__(self):
        self.host: str = os.getenv("ML_BACKEND_HOST", "0.0.0.0")
        self.port: int = int(os.getenv("ML_BACKEND_PORT", "8000"))
        self.frontend_base_url: str = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
        self.internal_events_api_key: str = os.getenv("INTERNAL_EVENTS_API_KEY", "change-me-internal-events-key")
        self.organization_id: str = os.getenv("ML_ORGANIZATION_ID", "66d550000000000000000001")
        self.camera_id: str = os.getenv("ML_CAMERA_ID", "66d550000000000000000002")
        self.update_interval: float = float(os.getenv("ML_FRONTEND_UPDATE_INTERVAL", "0.5"))
        self.enable_publish: bool = os.getenv("ML_ENABLE_FRONTEND_PUBLISH", "true").lower() == "true"
        self.stream_fps: int = int(os.getenv("ML_STREAM_FPS", "10"))
        self.stream_jpeg_quality: int = int(os.getenv("ML_STREAM_JPEG_QUALITY", "65"))
        
        origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
        self.cors_origins: List[str] = [origin.strip() for origin in origins_raw.split(",") if origin.strip()]

    @property
    def internal_detection_url(self) -> str:
        return f"{self.frontend_base_url}/api/internal/detection"

settings = BackendSettings()
