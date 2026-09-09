# 🛡️ AI Campus Guard — Technical Documentation & System Specifications

> **Centralized AI-Powered Surveillance, Multi-Threat Intelligence, Risk Assessment System & Web Portal**

---

## 📌 Project Overview
**AI Campus Guard** is an enterprise-grade real-time computer vision threat intelligence platform and web management portal. It synchronizes 4 independent vision modules with a **FastAPI ML Backend** and a **Next.js 15 Web Portal**:
1. **Crowd Detection & Density Monitoring** (`CAM-01` / `CAM-000001` → `videos/stock/sample4.mp4`): Headcount stabilization, ByteTrack IDs, occupancy progress, and density surge alerts.
2. **Behaviour & Anomaly Detection** (`CAM-02` / `CAM-000002` → `videos/stock/sample5.mp4`): Kinematics-based fall detection, aggressive sprinting, and physical altercation/fight monitoring.
3. **Restricted Area & Intrusion Detection** (`CAM-03` / `CAM-000003` → `videos/stock/sample6.mp4`): Multi-anchor polygon ROI intrusion monitoring using `cv2.pointPolygonTest`.
4. **Abandoned Object & Unattended Luggage Detection** (`CAM-04` / `CAM-000004` → `videos/stock/sample7.mp4`): Owner proximity tracking, temporal escalation, and staff dispatch directory.
5. **Central Risk Assessment & Management Orchestrator**: Unified 0–100 threat score, incident escalation, and compound threat aggregation.
6. **FastAPI ML Integration Layer (`backend/`)**: Port 8000 MJPEG stream manager with queue-based `FrameDispatcher`, `AsyncDetectionPublisher`, and HTTP bridge.
7. **Next.js Enterprise Web Portal (`web/`)**: Port 3000 monitoring UI with 2×2 live multi-camera autoplay grid, real-time `Active Events`, `Critical Alerts` telemetry counters, MongoDB Atlas storage, and Socket.IO live events.

---

## 🚀 Unified Master System Launcher (`start_system.py`)

A single master command launches all system tiers concurrently:

```powershell
python start_system.py
```

### What `start_system.py` Handles:
1. Auto-detects virtualenv Python (`.\.venv\Scripts\python.exe`) to prevent missing module errors.
2. Launches **Next.js Web Portal** (`web/`) on `http://localhost:3000`.
3. Launches **FastAPI ML Integration Server** (`backend/`) on `http://localhost:8000`.
4. Launches **4-Camera AI Surveillance Engine** (`app/run_multi_camera.py --headless`).
5. Opens browser directly to `http://localhost:3000`.
6. Intercepts `Ctrl+C` for clean taskkill process termination.

---

## 🎥 4-Camera Surveillance Matrix

| Camera ID | App Name | AI Feature Module | Video Source | ML Stream ID | FastAPI Route |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CAM-000001` | Canteen Quad (`CAM-01`) | **Crowd Detection** | `videos/stock/sample4.mp4` | `66d550000000000000000002` | `/api/cameras/66d550000000000000000002/stream` |
| `CAM-000002` | Hostel Corridor (`CAM-02`) | **Behavior Analytics** | `videos/stock/sample5.mp4` | `66d550000000000000000003` | `/api/cameras/66d550000000000000000003/stream` |
| `CAM-000003` | Server Room (`CAM-03`) | **Restricted Polygon ROI** | `videos/stock/sample6.mp4` | `66d550000000000000000004` | `/api/cameras/66d550000000000000000004/stream` |
| `CAM-000004` | Main Lobby (`CAM-04`) | **Abandoned Luggage** | `videos/stock/sample7.mp4` | `66d550000000000000000005` | `/api/cameras/66d550000000000000000005/stream` |

---

## 🗂️ Project Directory Structure

```text
AI-Campus-Guard/
├── start_system.py                    # 🌟 Master 1-Click Unified System Launcher
├── app/
│   ├── main.py                        # Unified CLI Launcher (--feature multi|risk|crowd...)
│   ├── run_multi_camera.py            # 4-Camera Video Quad Grid Dashboard Runner
│   ├── run_risk_management.py         # Master Single-Stream Risk Management Runner
│   ├── run_crowd_detection.py         # Dedicated Crowd Density Subsystem Runner
│   ├── run_behavior_detection.py      # Dedicated Behavior Analytics Subsystem Runner
│   ├── run_restricted_area.py         # Dedicated Restricted Area Intrusion Runner
│   └── run_abandoned_object.py        # Dedicated Abandoned Object Subsystem Runner
│
├── backend/                           # FastAPI ML Integration Layer (Port 8000)
│   ├── main.py                        # FastAPI Server Entrypoint
│   ├── config.py                      # Backend Settings & Environment Variables
│   ├── routes/                        # MJPEG Stream & Detection Forwarding API Routes
│   ├── schemas/                       # Pydantic Detection & Bridge Payloads
│   └── services/                      # Async Detection Publisher & Stream Frame Manager
│
├── web/                               # Next.js 15 Enterprise Web Portal (Port 3000)
│   ├── src/app/                       # App Router Pages & API Routes
│   ├── src/components/                # Live Monitoring UI Widgets & 2x2 Grid View
│   ├── src/models/                    # MongoDB Atlas Mongoose Schemas (User, Camera, Alert)
│   └── server.ts                      # Custom Node.js HTTP + Socket.IO Realtime Server
│
├── config/
│   ├── config.py                      # Global configuration constants
│   ├── saved_zones.yaml               # User saved restricted zones
│   └── presets/                       # Performance & Operational YAML Presets
│       ├── crowd_detection.yaml       # Crowd Thresholds & Camera Assignments (sample4.mp4)
│       ├── behavior_detection.yaml    # Kinematics & Fight/Fall Thresholds (sample5.mp4)
│       ├── restricted_area.yaml       # Polygon ROI Zones & Camera Assignments (sample6.mp4)
│       └── abandoned_object.yaml      # Luggage Rules & Duty Directory (sample7.mp4)
│
├── features/                          # Core Machine Learning Subsystem Packages
│   ├── crowd_detection/               # Crowd headcount & surge detection
│   ├── behavior_detection/            # Fall, aggressive motion, fight detection
│   ├── abandoned_object/              # Luggage tracking & proximity engine
│   ├── restricted_area/               # Polygon ROI intrusion & zone tracking
│   └── risk_assessment/               # Central Risk Orchestrator & Multi-Cam Hub
│
├── tests/                             # 101 Automated Unit & Integration Tests
├── models/                            # Model Weights (yolov8n.pt)
└── videos/                            # Stock & Input CCTV Videos (sample4-7.mp4)
```

---

## 🧪 Test Suite Status

All **101 automated Python unit and integration tests** and **59 web frontend tests** pass cleanly:

```powershell
# Python Backend & ML Tests
pytest -v

# Frontend Typecheck & Vitest
cd web
npm run typecheck
npx vitest run
```

**Python Test Output**:
```text
======================= 101 passed in 6.84s =======================
```

**Frontend Test Output**:
```text
Test Files  8 passed (8)
     Tests  59 passed (59)
```
