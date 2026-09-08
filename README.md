# AI Campus Guard 🛡️

![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)
![Next.js 15](https://img.shields.io/badge/Next.js-15%20(React%2019)-black.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg)
![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-green.svg)
![Build Status](https://img.shields.io/badge/tests-99%2F99%20passed-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)

**AI Campus Guard** is an enterprise-grade real-time computer vision threat intelligence platform and web management portal designed for automated CCTV surveillance across campus environments. It integrates multi-stream object tracking, human behavioral analytics, polygon restricted area intrusion detection, and unattended item monitoring with a **FastAPI ML Integration Layer** and a **Next.js Web Portal**.

---

## 📸 Core Capabilities

* **⚡ One-Click System Launcher (`start_system.py`)**  
  Concurrently runs the **Next.js Enterprise Web Portal** (`http://localhost:3000`), **FastAPI ML Backend** (`http://localhost:8000`), and **AI Surveillance Engine** in a single terminal command.
* **🌐 Next.js 15 Enterprise Web Portal (`web/`)**  
  Real-time security monitoring dashboard, Socket.IO live alerts, MongoDB Atlas cloud storage, guard incident dispatching, and audit logging.
* **⚡ FastAPI Integration Layer (`backend/`)**  
  Bridge server delivering live MJPEG video streams (`/api/cameras/{id}/stream`) and pushing structured detection payloads (`/api/internal/detection`) to the Web Portal.
* **🎥 Multi-Camera 2x2 Quad Grid (`app/run_multi_camera.py`)**  
  Stitches live CCTV camera feeds into a unified surveillance grid with per-camera status cards and risk telemetry HUDs.
* **🧠 Centralized Risk Engine (`app/run_risk_management.py`)**  
  Aggregates multi-source detections into a normalized risk score (0–100) using exponential decay, cooldown deduplication, and compound threat multipliers.
* **👥 Crowd Density & Headcount Monitoring (`app/run_crowd_detection.py`)**  
  Real-time person tracking via ByteTrack with median filter headcount stabilization and sustained density alert persistence checks.
* **💥 Human Behavior Analytics (`app/run_behavior_detection.py`)**  
  Detects sudden falls, physical altercations/struggles, and erratic sprinting using bounding-box trajectory kinematics.
* **🚨 Restricted Area Intrusion (`app/run_restricted_area.py`)**  
  Polygon ROI intrusion detection using multi-anchor foot-point geometry tests (`cv2.pointPolygonTest`).
* **🧳 Abandoned Object Detection (`app/run_abandoned_object.py`)**  
  Monitors unattended luggage and personal items, tracking owner proximity and trigger duration timers.

---

## 🏗️ System Architecture

```text
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                      AI CAMPUS GUARD ARCHITECTURE                           │
 └─────────────────────────────────────────────────────────────────────────────┘

    1. AI ML MODELS & CAMERA PIPELINE (Python)
       • Engine: YOLOv8 Nano + ByteTrack Multi-Object Tracking
       • Features: Crowd Density, Behavior, Restricted Zones, Abandoned Items
       • Sends live REST HTTP detections -> http://localhost:8000/api/detection/crowd
                                                 
                                     │
                                     ▼
                                     
    2. FASTAPI INTEGRATION BACKEND (Python)
       • File: backend/main.py (Port 8000)
       • Exposes MJPEG Stream: http://localhost:8000/api/cameras/{id}/stream
       • Forwards AI detection payloads to Next.js API endpoints.

                                     │
                                     ▼

    3. NEXT.JS ENTERPRISE WEB PORTAL (TypeScript / React 19)
       • Directory: web/ (Port 3000)
       • Live Monitoring Page: http://localhost:3000/admin/monitoring/live
       • Real-time Socket.IO alerts, headcount progress bars, threat level badges.
       • MongoDB Atlas Cloud Storage.
```

---

## 📁 Repository Structure

```text
AI-Campus-Guard/
├── start_system.py                   # 🌟 Master 1-Click System Launcher
├── app/                              # Application Launchers & Feature Runners
│   ├── main.py                       # Unified CLI Launcher (--feature multi|risk|crowd...)
│   ├── run_multi_camera.py           # 4-Camera Video Quad Grid Dashboard Runner
│   ├── run_risk_management.py        # Single-Stream Master Risk Engine Runner
│   ├── run_crowd_detection.py        # Crowd Density Subsystem Runner
│   ├── run_behavior_detection.py     # Behavior Analytics Subsystem Runner
│   ├── run_restricted_area.py        # Restricted Area Intrusion Runner
│   └── run_abandoned_object.py       # Abandoned Object Subsystem Runner
│
├── backend/                          # FastAPI ML Integration Layer (Port 8000)
│   ├── main.py                       # FastAPI Application Entrypoint
│   ├── routes/                       # Stream & Detection API Routes
│   ├── schemas/                      # Pydantic Payload Schemas
│   └── services/                     # MJPEG Stream Manager & Frontend Bridge Service
│
├── web/                              # Next.js 15 Enterprise Web Portal (Port 3000)
│   ├── src/app/                      # Next.js App Router (Pages & API Routes)
│   ├── src/components/               # UI Components & Monitoring Widgets
│   ├── src/models/                   # MongoDB Mongoose Schemas (User, Camera, Event)
│   └── server.ts                     # Custom Node.js HTTP + Socket.IO Server
│
├── config/                           # Modular Configuration System
│   ├── config.py                     # Global Constants & Base Paths
│   └── presets/                      # Feature Configuration YAML Presets
│       ├── crowd_detection.yaml      # Crowd Thresholds & Camera Assignments
│       ├── behavior_detection.yaml   # Kinematics & Fight/Fall Detection Thresholds
│       ├── restricted_area.yaml      # Polygon ROI Zones & Camera Assignments
│       └── abandoned_object.yaml     # Luggage Rules & Duty Staff Directory
│
├── features/                         # Core Machine Learning Feature Packages
├── models/                           # Model Weights (yolov8n.pt)
├── videos/                           # Input & Stock CCTV Videos
├── tests/                            # 99 Automated Unit & Integration Tests
├── HOW_TO_RUN.md                     # Step-by-Step Running Guide
└── project.md                        # Technical Specifications & Log
```

---

## 🚀 Quick Start — One-Click Launcher

### 1. Prerequisites & Environment Setup
```powershell
# Clone the repository
git clone https://github.com/your-org/AI-Campus-Guard.git
cd "AI-Campus-Guard"

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # On Windows
# source .venv/bin/activate    # On Linux/macOS

# Install Python dependencies
pip install -r requirements.txt

# Download model weights
python scripts/download_models.py
```

### 2. Launch Entire System (1 Command)

```powershell
python start_system.py
```

This master command automatically:
1. Configures `web/.env.local` environment variables.
2. Installs `web` Node dependencies (`npm install`).
3. Launches **Next.js Web Portal** (`http://localhost:3000`).
4. Launches **FastAPI ML Backend** (`http://localhost:8000`).
5. Launches **AI Surveillance Engine** & opens `http://localhost:3000/login` in your default browser.

#### Login Credentials:
- **URL**: `http://localhost:3000/login`
- **User ID**: `superadmin`
- **Password**: `ChangeMe123!`

---

## ⚙️ Configuration & Preset System

Feature settings are managed in [`config/presets/`](file:///D:/My%20Github%20Projects/AI%20Campus%20Guard/config/presets/):

```yaml
# config/presets/crowd_detection.yaml
video_path: "videos/stock/sample3.mp4"
enabled: true
person_threshold: 5
persistence_seconds: 3.0
cameras:
  - camera_id: "CAM-01"
    name: "Canteen Quad"
    location: "Campus Central Canteen"
    video_path: "videos/stock/sample3.mp4"
    enabled: true
    person_threshold: 5
    persistence_seconds: 3.0
```

---

## 🧪 Test Suite Verification

Run the complete automated test suite (**99 unit and integration test cases**):

```powershell
python -m unittest discover tests
```

**Expected Output**:
```text
Ran 99 tests in 8.687s
OK
```

---

## 🛠️ Technology Stack

* **Frontend**: Next.js 15, React 19, Tailwind CSS, Socket.IO, Lucide Icons
* **Backend**: FastAPI, Uvicorn, Pydantic, HTTPX Async Bridge
* **Cloud Database**: MongoDB Atlas (Mongoose v8)
* **ML / Computer Vision**: Python 3.10+, PyTorch, Ultralytics YOLOv8, ByteTrack, OpenCV

---

## 📄 License

This project is licensed under the MIT License.
