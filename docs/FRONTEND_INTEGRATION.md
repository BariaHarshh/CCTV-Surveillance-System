# Frontend Integration Guide (Step 1)

This document outlines the architecture, setup, configuration, and verification steps for connecting the Python ML backend service to the Next.js Frontend.

---

## 1. Architecture Overview

The integration layer bridges the Python ML pipeline with the Next.js application internal detection ingestion API:

```text
+----------------------------+
|   Python ML Feature Loop   |
| (YOLO / ByteTrack / Rules) |
+----------------------------+
              |
              v
+----------------------------+
|       FastAPI Backend      |
|  - routes/detection.py     |
|  - schemas/detection.py    |
+----------------------------+
              |
              | HTTP POST /api/internal/detection
              | Header: x-internal-service-key
              v
+----------------------------+
|   Next.js Web Frontend     |
|   (App Router API Route)   |
|  - Validates service key   |
|  - Runs detection pipeline |
|  - Emits socket event      |
+----------------------------+
```

---

## 2. Environment Configuration

Configure the following environment variables in `.env` (copied from `.env.example`):

```env
# Python ML FastAPI Backend Settings
ML_BACKEND_HOST=0.0.0.0
ML_BACKEND_PORT=8000

# Next.js Frontend Integration Settings
FRONTEND_BASE_URL=http://localhost:3000
INTERNAL_EVENTS_API_KEY=change-me-internal-events-key

# Allowed CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

> **Security Note**: Never commit actual production API keys or secrets to version control.

---

## 3. How to Start the FastAPI Backend

From the `AI-Campus-Guard` root directory:

```bash
# Activate virtual environment
.venv\Scripts\activate

# Launch FastAPI backend with uvicorn
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 4. Health Check Endpoint

To verify that the Python ML backend service is running and responsive:

```http
GET http://localhost:8000/health
```

### Expected Response (`200 OK`):
```json
{
  "status": "ok",
  "service": "ai-campus-guardian-ml"
}
```

*Note*: The health check endpoint responds immediately without loading YOLO models or initializing video streams.

---

## 5. Sending a Test Detection

To simulate and dispatch a detection to the frontend:

```http
POST http://localhost:8000/api/test/detection
Content-Type: application/json

{
  "cameraId": "demo-camera",
  "organizationId": "demo-org",
  "moduleType": "PERSON_DETECTION",
  "confidence": 0.95
}
```

### Detection Payload Sent to Next.js (`POST /api/internal/detection`):

```json
{
  "organizationId": "demo-org",
  "cameraId": "demo-camera",
  "moduleType": "PERSON_DETECTION",
  "confidence": 0.95,
  "source": "DETECTION",
  "metadata": {
    "trackId": 1,
    "label": "person",
    "boundingBox": {
      "x": 0.25,
      "y": 0.20,
      "w": 0.15,
      "h": 0.40
    }
  }
}
```

### Expected Output Logs:
```text
[ML-BRIDGE] Sending detection
[ML-BRIDGE] Camera: demo-camera
[ML-BRIDGE] Module: PERSON_DETECTION
[ML-BRIDGE] Confidence: 0.95
[ML-BRIDGE] Frontend response: 200
```

---

## 6. Troubleshooting Frontend Connection Failures

- **Frontend Connection Failed (`[ML-BRIDGE] Frontend connection failed: ...`)**:
  - Check whether the Next.js server is running on `http://localhost:3000`.
  - Verify `FRONTEND_BASE_URL` in `.env`.
  - The Python backend will not crash when the frontend is offline; it will return an error status in the bridge response.

- **HTTP 403 Forbidden**:
  - Verify that `INTERNAL_EVENTS_API_KEY` in Python's `.env` matches `INTERNAL_EVENTS_API_KEY` configured in the Next.js `.env`.

- **HTTP 400 Validation Error**:
  - Verify that `moduleType` matches one of the allowed types in the frontend (`PERSON_DETECTION`, `OCCUPANCY_DETECTION`, `RESTRICTED_ZONE`, etc.).
  - Verify `confidence` is a number between `0.0` and `1.0`.

---

## 7. Real Crowd Detection Integration (Step 2)

Step 2 connects real-time video inference to the frontend:

```text
Video Stream
     ↓
YOLOv8 + ByteTrack (Person Tracking)
     ↓
CountStabilizer (Time-window median smoothing)
     ↓
CrowdDetector (Persistence confirmation)
     ↓
AsyncDetectionPublisher (Non-blocking queue & throttling)
     ↓
FastAPI Bridge Service
     ↓ HTTP POST /api/internal/detection
Next.js Internal API
     ↓
MongoDB Atlas & Socket.IO Realtime Broadcast
```

### Configuration Variables for Step 2

```env
# Camera & Organization IDs (24-char Hex ObjectId format for MongoDB)
ML_ORGANIZATION_ID=66d550000000000000000001
ML_CAMERA_ID=66d550000000000000000002

# Throttling & Publishing Control
ML_FRONTEND_UPDATE_INTERVAL=0.5
ML_ENABLE_FRONTEND_PUBLISH=true
```

### Real Crowd Detection Payload Structure:

```json
{
  "organizationId": "66d550000000000000000001",
  "cameraId": "66d550000000000000000002",
  "moduleType": "OCCUPANCY_DETECTION",
  "confidence": 0.94,
  "source": "DETECTION",
  "metadata": {
    "rawCount": 14,
    "stableCount": 12,
    "currentCount": 12,
    "threshold": 10,
    "capacity": 10,
    "state": "CROWD DETECTED",
    "crowdDetected": true,
    "confirmationProgressSeconds": 3.0,
    "requiredPersistenceSeconds": 3.0,
    "people": [
      {
        "trackId": 1,
        "confidence": 0.92,
        "bbox": {
          "x": 0.2512,
          "y": 0.2045,
          "width": 0.1523,
          "height": 0.4011
        }
      }
    ]
  }
}
```

### Key Features of Step 2:
1. **Non-blocking Background Thread**: Video playback and OpenCV HUD display run without dropping frames regardless of network latency.
2. **Normalized Coordinates**: Bounding box coordinates are clamped and mapped to `[0.0, 1.0]`.
3. **Adaptive Throttling with State-Triggered Bypass**: Routine frames are published at `ML_FRONTEND_UPDATE_INTERVAL` (default 500ms), while critical state changes (`NORMAL` ↔ `CHECKING CROWD` ↔ `CROWD DETECTED`) trigger instant dispatch.
4. **Fault Tolerance**: If the frontend or database is unreachable, error logs are emitted while video processing continues uninterrupted.

---

## 8. Live AI Video Streaming (Step 3)

The backend provides a high-performance, single-pass MJPEG video stream compatible with all modern browsers:

```text
Video Frame
     ↓
YOLOv8 + ByteTrack
     ↓
Crowd Detection & HUD Rendering (`annotated_frame`)
     ├── OpenCV Local Display Window
     └── StreamFrameManager (Latest Frame Buffer)
              ↓
     FastAPI `GET /api/cameras/{cameraId}/stream`
              ↓
     Browser (`<img src="...">` / Web Player)
```

### Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/cameras/{cameraId}/stream` | `GET` | Continuous `multipart/x-mixed-replace` MJPEG stream with AI overlays |
| `/api/cameras/{cameraId}/stream/status` | `GET` | Stream health, activity, frame resolution, and FPS status |
| `/api/cameras/streams` | `GET` | Array of all active and known camera streams |

### Embedding Stream in Web Applications

To display the live stream in the frontend or any web page:

```html
<img
  src="http://localhost:8000/api/cameras/66d550000000000000000002/stream"
  alt="Live AI Camera Feed"
  style="width: 100%; height: auto; border-radius: 8px;"
/>
```

### Streaming Configuration Variables

```env
# Target streaming frame rate
ML_STREAM_FPS=25

# JPEG encoding compression quality (30-100)
ML_STREAM_JPEG_QUALITY=80
```

### Performance Characteristics
- **Zero Duplicate Inference**: The exact frame annotated during the single YOLO+ByteTrack inference pass is shared directly with the stream manager.
- **Thread-safe Frame Dropping**: The streaming generator delivers the latest available frame and drops intermediate frames if client consumption is slower than video playback.
- **Offline / Warming-up Fallback**: When the camera stream has not started or ends, the endpoint serves a clean placeholder rather than failing or disconnecting abruptly.
