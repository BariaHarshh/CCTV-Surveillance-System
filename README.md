# AI Campus Guard 🛡️

![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)
![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-orange.svg)
![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-green.svg)
![Build Status](https://img.shields.io/badge/tests-76%2F76%20passed-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)

**AI Campus Guard** is a real-time computer vision and unified threat intelligence system designed for automated CCTV surveillance across university and enterprise campuses. It integrates multi-stream object tracking, human behavioral analytics, polygon-based restricted area intrusion detection, and unattended item monitoring into a centralized **Unified Risk Engine**.

---

## 📸 Core Features

* **🎥 Multi-Camera 2x2 Quad Grid (`app/run_multi_camera.py`)**  
  Stitches 4 live CCTV camera streams into a single $1280 \times 720$ surveillance grid. Renders per-camera threat badges alongside a real-time campus-wide threat level header.
* **🧠 Unified Risk Engine (`app/run_risk_management.py`)**  
  Aggregates multi-source events into a normalized threat score (0–100) using exponential decay, cooldown deduplication, and compound threat multipliers.
* **👥 Crowd Density & Headcount Monitoring (`app/run_crowd_detection.py`)**  
  Real-time person tracking via ByteTrack with median filter headcount stabilization and sustained density alert persistence checks.
* **💥 Human Behavior Analytics (`app/run_behavior_detection.py`)**  
  Detects sudden falls, physical altercations/struggles, and erratic fleeing/sprinting using trajectory kinematics and bounding-box aspect ratio dynamics.
* **🚨 Restricted Area Intrusion (`app/run_restricted_area.py`)**  
  Polygon ROI intrusion detection using multi-anchor foot-point geometry tests (`cv2.pointPolygonTest`) and live interactive polygon drawing (`R` key).
* **🧳 Abandoned Object Detection (`app/run_abandoned_object.py`)**  
  Monitors unattended luggage and personal items, tracks owner proximity, and escalates prolonged unattended items to staff dispatch workflows.

---

## 🏗️ System Architecture

```text
                     ┌────────────────────────────────────────────────────────┐
                     │           CCTV CAMERA STREAMS (CAM-01 .. CAM-04)       │
                     └───────────────────────────┬────────────────────────────┘
                                                 │
                                                 ▼
                     ┌────────────────────────────────────────────────────────┐
                     │          SHARED YOLOv8 + BYTETRACK DETECTOR            │
                     └───────────────────────────┬────────────────────────────┘
                                                 │
      ┌──────────────────────┬───────────────────┴───────────────────┬──────────────────────┐
      │                      │                                       │                      │
      ▼                      ▼                                       ▼                      ▼
┌─────────────┐    ┌───────────────────┐                   ┌───────────────────┐  ┌───────────────────┐
│ Canteen     │    │ Hostel Corridor   │                   │ Server Room       │  │ Main Lobby        │
│ Crowd Module│    │ Behavior Module   │                   │ Restricted Area   │  │ Abandoned Luggage │
└──────┬──────┘    └─────────┬─────────┘                   └─────────┬─────────┘  └─────────┬─────────┘
       │                     │                                       │                      │
       └─────────────────────┼───────────────────────────────────────┴──────────────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │ EVENT NORMALIZER & ADAPTER  │
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │   CENTRAL RISK ENGINE       │
              │  Score: 0-100 (Decay/Cooldwn)│
              └──────────────┬──────────────┘
                             │
                             ▼
              ┌─────────────────────────────┐
              │ 2x2 VIDEO QUAD DASHBOARD    │
              └─────────────────────────────┘
```

---

## 📁 Repository Structure

```text
AI-Campus-Guard/
├── app/                              # Application Launchers & Feature Runners
│   ├── main.py                       # Unified CLI Launcher (--feature multi|risk|crowd...)
│   ├── run_multi_camera.py           # 🌟 4-Camera Video Quad Grid Dashboard Runner
│   ├── run_risk_management.py        # Single-Stream Master Risk Engine Runner
│   ├── run_crowd_detection.py        # Crowd Density Subsystem Runner
│   ├── run_behavior_detection.py     # Behavior Analytics Subsystem Runner
│   ├── run_restricted_area.py        # Restricted Area Intrusion Runner
│   └── run_abandoned_object.py       # Abandoned Object Subsystem Runner
│
├── config/                           # Modular Configuration System
│   ├── config.py                     # Global Constants & Base Paths
│   ├── saved_zones.yaml              # Saved Polygon ROI Coordinates
│   └── presets/                      # Clean Feature Configuration Presets
│       ├── risk_assessment.yaml      # Master Risk Engine Scoring Weights & Thresholds
│       ├── crowd_detection.yaml      # Crowd Thresholds & Camera Stream Assignments
│       ├── behavior_detection.yaml   # Kinematics & Fight/Fall Detection Thresholds
│       ├── restricted_area.yaml      # Polygon ROI Zones & Camera Assignments
│       └── abandoned_object.yaml     # Luggage Rules & Duty Staff Directory
│
├── features/                         # Core Machine Learning Feature Packages
│   ├── crowd_detection/              # Headcount Stabilization & Density Processor
│   ├── behavior_detection/           # Fall, Fight & Movement Kinematics Engine
│   ├── restricted_area/              # Polygon ROI Geometry & Intrusion Tracker
│   ├── abandoned_object/             # Multi-Object Tracker & Owner Proximity Engine
│   └── risk_assessment/              # Central Risk Engine & Multi-Cam Orchestrator
│
├── models/                           # Model Weights (yolov8n.pt)
├── videos/                           # Stock Video Feeds for Testing
├── tests/                            # 76 Automated Unit & Integration Tests
└── project.md                        # Technical Documentation & System Specifications
```

---

## 🚀 Quick Start

### 1. Prerequisites & Environment Setup
```powershell
# Clone the repository
git clone https://github.com/your-org/AI-Campus-Guard.git
cd "AI-Campus-Guard"

# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # On Windows
# source .venv/bin/activate    # On Linux/macOS

# Install dependencies
pip install -r requirements.txt
```

### 2. Execution Commands

#### Launch 4-Camera Video Quad Dashboard (Recommended)
```powershell
python app/run_multi_camera.py
```

#### Launch Single-Stream Master Risk Dashboard
```powershell
python app/run_risk_management.py
```

#### Launch Individual Subsystem Runners
```powershell
python app/run_crowd_detection.py
python app/run_behavior_detection.py
python app/run_restricted_area.py
python app/run_abandoned_object.py
```

#### Launch via Unified CLI Launcher
```powershell
python app/main.py --feature multi
```

---

## ⚙️ Configuration & Preset System

System configuration is organized into modular YAML files located in [`config/presets/`](file:///D:/My%20Github%20Projects/AI%20Campus%20Guard/config/presets/).

Each feature configuration file manages its own camera feeds, enabling clean per-feature camera assignments:

```yaml
# config/presets/crowd_detection.yaml
enabled: true
cameras:
  - camera_id: "CAM-01"
    name: "Canteen Quad"
    location: "Campus Central Canteen"
    video_path: "videos/stock/sample.mp4"
    enabled: true
    person_threshold: 6
    persistence_seconds: 2.0
```

Global event scoring weights are managed in [`config/presets/risk_assessment.yaml`](file:///D:/My%20Github%20Projects/AI%20Campus%20Guard/config/presets/risk_assessment.yaml):

```yaml
# Incident Scoring Weights (0-100 Scale)
risk_weights:
  fight: 45.0               # Violent altercation (+45 pts)
  restricted_breach: 40.0   # Restricted area breach (+40 pts)
  fall: 35.0                # Fallen person (+35 pts)
  abandoned_object: 30.0    # Unattended luggage (+30 pts)
  aggressive_movement: 20.0 # Erratic sprinting (+20 pts)
  crowd_surge: 15.0         # Crowd headcount surge (+15 pts)

risk_decay_rate: 5.0        # Points decayed per second during idle state
compound_threat_multiplier: 1.25 # Multiplier when 2+ threats occur simultaneously
```


---

## 🧪 Test Suite & Verification

Run the automated test suite covering **76 unit and integration test cases**:

```powershell
python -m unittest discover tests
```

**Expected Test Output**:
```text
Ran 76 tests in 3.931s
OK
```

---

## 🛠️ Technology Stack

* **Language**: Python 3.10+
* **Deep Learning Framework**: PyTorch (CUDA / CPU auto-switching)
* **Object Detection Engine**: Ultralytics YOLOv8
* **Multi-Object Tracking**: ByteTrack
* **Computer Vision**: OpenCV (Vector math, polygon geometry, alpha-blended rendering)
* **Configuration & Storage**: PyYAML

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
