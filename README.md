# AI Campus Guard 🛡️

**AI Campus Guard** is an enterprise-grade AI-powered surveillance and unified risk intelligence platform designed to monitor campus CCTV feeds in real time. It detects critical safety incidents, human behavioral anomalies, unattended objects, and unauthorized zone intrusions, feeding a centralized **Campus Risk Assessment & Orchestration Engine**.

---

## 🌟 Feature Status

| Feature | Status | Description |
| :--- | :---: | :--- |
| **Crowd Detection** | ✅ **Done** | Real-time person detection, ByteTrack tracking, count stabilization, and persistent crowd alert monitoring. |
| **Behavior Detection** | ✅ **Done** | Real-time Fall Detection, Aggressive Movement Analysis, and Fighting/Altercation Detection. |
| **Restricted Area Detection** | ✅ **Done** | Polygon ROI zone geometry checks, multi-anchor foot-point analysis, and intrusion state machine tracking. |
| **Abandoned Object Detection** | ✅ **Done** | Multi-class person and object detection, owner proximity tracking, and temporal unattended duration escalation. |
| **Risk Assessment Orchestrator** | ✅ **Done** | Centralized 0–100 threat scoring, incident lifecycle (inactivity decay, cooldown deduplication), interactive GUI menu, and security dispatch alerts. |

---

## 🏗️ Repository Architecture

```text
AI-Campus-Guard/
│
├── README.md                 # Project Overview & Quick Start
├── project.md                # 🌟 Comprehensive Technical Documentation & Changelog
├── HOW_TO_RUN.md             # Execution & Performance Tuning Guide
├── GITHUB_SETUP.md           # Git Collaboration & Workflow Guide
├── requirements.txt          # Python Dependencies
│
├── app/                      # Application Entry Points & Runners
│   ├── run_risk_management.py# 🌟 Master Orchestrated Surveillance Runner
│   ├── run_abandoned_object.py# Dedicated Abandoned Object Runner
│   ├── run_risk_assessment.py# Dedicated Risk Assessment Engine Runner
│   ├── run_crowd_detection.py# Dedicated Crowd Detection Runner
│   ├── run_behavior_detection.py # Dedicated Behavior Detection Runner
│   └── run_restricted_area.py# Dedicated Restricted Area Detection Runner
│
├── config/                   # Configuration & Preset System
│   ├── config.py             # Global Configuration Constants
│   ├── saved_zones.yaml      # Saved Restricted Zone Geometry
│   └── presets/              # Performance & Operational Presets (YAML)
│       ├── risk_management_full.yaml
│       ├── risk_management_balanced.yaml
│       ├── risk_management_high_accuracy.yaml
│       ├── risk_management_high_performance.yaml
│       ├── risk_management_demo.yaml
│       ├── risk_management_behavior.yaml
│       └── risk_management_security.yaml
│
├── features/                 # Self-Contained Feature Modules
│   ├── crowd_detection/      # ✅ Crowd Headcount & Surge Package
│   ├── behavior_detection/   # ✅ Fall, Fight & Movement Package
│   ├── abandoned_object/     # ✅ MultiObjectDetector & Luggage Proximity Package
│   ├── restricted_area/      # ✅ Polygon ROI Intrusion Package
│   └── risk_assessment/      # ✅ Central Risk Engine, Bounded HUD & Profiler
│
├── models/                   # YOLO Model Weights (yolov8n.pt)
├── videos/                   # Input & Stock Test Video Storage
├── tests/                    # 76 Automated Unit & Integration Tests
└── docs/                     # Architecture & Developer Documentation
```

---

## 🚀 Quick Start Guide

### 1. Activate Virtual Environment (Windows)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Master Risk Management Surveillance System
You do **not** need to start separate feature runners. The **Risk Management Master Runner** initializes and synchronizes all enabled detection modules automatically:

```powershell
# 1. Balanced Mode (Recommended Daily Default — ~26 FPS on CPU)
python app/run_risk_management.py --preset risk_management_balanced.yaml --video videos/stock/sample.mp4

# 2. High Performance Mode (Lightweight imgsz=416 — 60-80+ FPS)
python app/run_risk_management.py --preset risk_management_high_performance.yaml --video videos/stock/sample.mp4

# 3. High Accuracy Mode (Full resolution imgsz=640)
python app/run_risk_management.py --preset risk_management_high_accuracy.yaml --video videos/stock/sample.mp4

# 4. With Real-Time Latency Profiler & Telemetry
python app/run_risk_management.py --preset risk_management_balanced.yaml --video videos/stock/sample.mp4 --profile
```

---

## 🎮 Interactive Keyboard Controls in Video Window

| Key | Action | Description |
| :---: | :--- | :--- |
| **`M`** | **Toggle System Controls Menu** | Opens side panel to toggle individual detection features ON/OFF in real time and save/load zones. |
| **`R`** | **Toggle Polygon Drawing Mode** | Allows interactive restricted zone creation by clicking vertices on the live video stream. |
| **`P`** | **Toggle Performance HUD Card** | Displays real-time per-subsystem execution latencies (YOLO, Behaviour, Objects, Risk, UI) and processing FPS. |
| **`ENTER`** | **Finish Polygon** | Completes and activates the drawn restricted area zone. |
| **`BACKSPACE`**| **Undo Point** | Removes the last drawn vertex point. |
| **`ESC`** | **Cancel Drawing** | Exits polygon drawing mode without saving. |
| **`Q`** | **Quit** | Gracefully terminates surveillance stream. |

---

## ⚡ Performance Presets Matrix

| Preset | imgsz | Person Cadence | Behaviour Cadence | Object Cadence | CPU Processing FPS |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`risk_management_full.yaml`** | `640` | Every frame | Every $2$ frames | Every $2$ frames | $\sim 20\text{ FPS}$ |
| **`risk_management_high_accuracy.yaml`** | `640` | Every frame | Every frame | Every $2$ frames | $\sim 18\text{ FPS}$ |
| **`risk_management_balanced.yaml`** | `512` | Every frame | Every $2$ frames | Every $3$ frames | **$\sim 26\text{ FPS}$** *(Default)* |
| **`risk_management_high_performance.yaml`**| `416` | Every $2$ frames | Every $3$ frames | Every $4$ frames | **$\sim 85\text{ FPS}$** |

---

## 🧪 Automated Testing
Run the complete test suite containing **76 automated unit and integration tests**:

```powershell
python -m unittest discover tests
```
```text
Ran 76 tests in 2.973s
OK
```

---

## 🛠️ Technology Stack

- **Python 3.10+**
- **PyTorch**: Deep learning inference engine with CUDA/CPU auto-detection and FP16 acceleration.
- **Ultralytics YOLOv8**: Single-pass multi-class person and object detection with confidence hysteresis.
- **ByteTrack**: Multi-object tracking with 20-frame occlusion recovery buffer.
- **OpenCV**: Vector geometry testing (`cv2.pointPolygonTest`), video I/O, alpha-blended rendering, and responsive UI layout.
- **PyYAML**: Modular configuration preset management.

---

## 📑 Documentation Links

- 📘 [project.md](project.md) – Comprehensive project documentation, technical architecture, and recent updates.
- 📖 [HOW_TO_RUN.md](HOW_TO_RUN.md) – Step-by-step setup, execution, performance tuning, and troubleshooting guide.
- 🐙 [GITHUB_SETUP.md](GITHUB_SETUP.md) – Git setup, branch workflow, and pull request guide for team members.
- 📐 [Architecture Documentation](docs/architecture.md) – Technical pipeline & system architecture.
- 👥 [Crowd Detection Guide](docs/crowd_detection.md) – Algorithmic breakdown of count stabilization and threshold logic.
- 👩‍💻 [Development Guide](docs/development_guide.md) – Guidelines for adding new feature modules.
