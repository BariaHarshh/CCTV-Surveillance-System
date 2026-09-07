# 🛡️ AI Campus Guard — Technical Documentation & System Specifications

> **Centralized AI-Powered Surveillance, Multi-Threat Intelligence, Risk Assessment System & Web Portal**

---

## 📌 Project Overview
**AI Campus Guard** is an enterprise-grade real-time computer vision threat intelligence platform and web management portal. It synchronizes multiple vision modules with a **FastAPI ML Backend** and a **Next.js 15 Web Portal**:
1. **Crowd Detection & Density Monitoring** (Headcount stabilization & surge alerts)
2. **Behaviour & Anomaly Detection** (Fall detection, aggressive movement, potential fights)
3. **Abandoned Object & Unattended Luggage Detection** (Owner proximity tracking & temporal escalation)
4. **Restricted Area & Intrusion Detection** (Multi-anchor polygon ROI intrusion monitoring)
5. **Central Risk Assessment & Management Orchestrator** (Unified 0-100 risk score, incident management)
6. **FastAPI ML Integration Layer (`backend/`)** (Port 8000 MJPEG stream manager & HTTP bridge)
7. **Next.js Enterprise Web Portal (`web/`)** (Port 3000 monitoring UI, MongoDB Atlas cloud storage, Socket.IO alerts)

---

## 🚀 Unified Master System Launcher (`start_system.py`)

A single master command launches all 3 tiers of the system concurrently:

```powershell
python start_system.py
```

### What `start_system.py` Handles:
1. Auto-detects virtualenv Python (`.\.venv\Scripts\python.exe`) to prevent missing module errors.
2. Launches **Next.js Web Portal** (`web/`) on `http://localhost:3000`.
3. Launches **FastAPI ML Integration Server** (`backend/`) on `http://localhost:8000`.
4. Launches **AI Surveillance Engine** & opens browser to `http://localhost:3000/login`.
5. Intercepts `Ctrl+C` for clean taskkill process termination.

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
│   ├── src/components/                # Live Monitoring UI Widgets & Cards
│   ├── src/models/                    # MongoDB Atlas Mongoose Schemas (User, Camera, Alert)
│   └── server.ts                      # Custom Node.js HTTP + Socket.IO Realtime Server
│
├── config/
│   ├── config.py                      # Global configuration constants
│   ├── saved_zones.yaml               # User saved restricted zones
│   └── presets/                       # Performance & Operational YAML Presets
│       ├── crowd_detection.yaml       # Crowd Thresholds & Camera Assignments
│       ├── behavior_detection.yaml    # Kinematics & Fight/Fall Detection Thresholds
│       ├── restricted_area.yaml       # Polygon ROI Zones & Camera Assignments
│       └── abandoned_object.yaml      # Luggage Rules & Duty Staff Directory
│
├── features/                          # Core Machine Learning Subsystem Packages
│   ├── crowd_detection/               # Crowd headcount & surge detection
│   ├── behavior_detection/            # Fall, aggressive motion, fight detection
│   ├── abandoned_object/              # Luggage tracking & proximity engine
│   ├── restricted_area/               # Polygon ROI intrusion & zone tracking
│   └── risk_assessment/               # Central Risk Orchestrator
│
├── tests/                             # 99 Automated Unit & Integration Tests
├── models/                            # Model Weights (yolov8n.pt)
└── videos/                            # Stock & Input CCTV Videos
```

---

## 🧪 Test Suite Status

All **99 automated unit and integration tests** across Python ML, FastAPI backend, and Web API bridges pass cleanly:

```powershell
python -m unittest discover tests
```

**Expected Test Output**:
```text
Ran 99 tests in 8.687s
OK
```
