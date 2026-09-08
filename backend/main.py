"""
AI Campus Guard - FastAPI ML Backend Integration Service
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.routes.health import router as health_router
from backend.routes.detection import router as detection_router
from backend.routes.stream import router as stream_router

app = FastAPI(
    title="AI Campus Guard - ML Backend Service",
    description="Integration API between Python ML modules and the Next.js Frontend",
    version="1.0.0",
)

# Configure CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(health_router)
app.include_router(detection_router)
app.include_router(stream_router)


import asyncio
import sys

# Suppress Windows Proactor asyncio socket reset warning logs
if sys.platform == "win32":
    def _silence_connection_reset(loop, context):
        exception = context.get("exception")
        if isinstance(exception, ConnectionResetError):
            return
        loop.default_exception_handler(context)

    @app.on_event("startup")
    async def _set_asyncio_exception_handler():
        try:
            loop = asyncio.get_running_loop()
            loop.set_exception_handler(_silence_connection_reset)
        except Exception:
            pass


if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
