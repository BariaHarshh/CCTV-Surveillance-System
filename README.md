# AI Campus Guard 🛡️

**AI Campus Guard** is an AI-powered security and surveillance system designed to monitor campus CCTV feeds in real time for safety incidents, high crowd density, unauthorized entry, and emergency situations.

---

## 🌟 Feature Status

| Feature | Status | Description |
| :--- | :---: | :--- |
| **Crowd Detection** | ✅ **Active** | Real-time person detection, ByteTrack tracking, count stabilization, and persistent crowd alert monitoring. |
| **Restricted Area Detection** | 🚧 *Planned* | Detect unauthorized entry into restricted campus zones using ROI masks. |
| **Abandoned Object Detection** | 🚧 *Planned* | Detect unattended bags or objects stationary for > threshold time. |
| **Risk Assessment Engine** | 🚧 *Planned* | Real-time risk scoring & priority incident alerts. |
| **Behavior Detection** | 🚧 *Planned* | Fall detection & fighting/altercation detection. |

---

## 🏗️ Repository Architecture

```text
AI-Campus-Guard/
│
├── README.md                 # Project Overview & Setup
├── HOW_TO_RUN.md             # Beginner-Friendly Execution Guide
├── GITHUB_SETUP.md           # Git Collaboration & Workflow Guide
├── requirements.txt          # Python Dependencies
├── .gitignore                # Git Ignore Rules
├── .env.example              # Environment Configuration Template
│
├── app/
│   └── main.py               # Main Application Entry Point
│
├── config/
│   ├── config.py             # Global Configuration Manager
│   └── presets/              # Feature Presets (YAML)
│       ├── default.yaml
│       └── crowd_detection.yaml
│
├── features/
│   ├── crowd_detection/      # Crowd Detection Feature Package
│   ├── restricted_area/      # Restricted Area Detection (Planned)
│   ├── abandoned_object/     # Abandoned Object Detection (Planned)
│   ├── risk_assessment/      # Risk Assessment Engine (Planned)
│   └── behavior_detection/   # Behavior Detection Modules (Planned)
│
├── models/                   # YOLO Model Weights (yolov8n.pt)
├── videos/                   # Input, Stock Test, and Output Video Storage
├── scripts/                  # Downloader & Environment Setup Utilities
├── tests/                    # Automated Unit Tests
└── docs/                     # Architecture & Developer Documentation
```

---

## 🚀 Quick Start Guide

### 1. Clone Repository & Navigate
```bash
git clone <GITHUB_REPOSITORY_URL>
cd AI-Campus-Guard
```

### 2. Create & Activate Virtual Environment (Windows)
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Download Model Weights
```bash
python scripts/download_models.py
```

### 5. Run Crowd Detection Module
```bash
python app/main.py
```

---

## 🛠️ Technology Stack

- **Python 3.10+**
- **OpenCV**: Video capture, frame rendering, and HUD overlays.
- **Ultralytics YOLOv8**: Person detection.
- **ByteTrack**: Multi-object tracking (IDs maintained internally in memory).
- **PyYAML**: Modular preset configuration management.

---

## 📑 Documentation Links

- 📖 [HOW_TO_RUN.md](HOW_TO_RUN.md) – Step-by-step setup, configuration, and troubleshooting guide.
- 🐙 [GITHUB_SETUP.md](GITHUB_SETUP.md) – Git setup, branch workflow, and pull request guide for team members.
- 📐 [Architecture Documentation](docs/architecture.md) – Technical pipeline & system architecture.
- 👥 [Crowd Detection Guide](docs/crowd_detection.md) – Algorithmic breakdown of count stabilization and threshold logic.
- 👩‍💻 [Development Guide](docs/development_guide.md) – Guidelines for adding new feature modules.
