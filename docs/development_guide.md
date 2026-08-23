# 🛠️ AI Campus Guard - Development & Contribution Guide

Guide for developers adding new surveillance modules to the AI Campus Guard repository.

---

## 📁 Active Feature Packages

1. **Crowd Detection**: `features/crowd_detection/` (Runner: `app/run_crowd_detection.py`)
2. **Behavior Detection**: `features/behavior_detection/` (Runner: `app/run_behavior_detection.py`)
3. **Restricted Area Detection**: `features/restricted_area/` (Runner: `app/run_restricted_area.py`)

---

## 📁 Adding a New Feature Module

When developing a new feature (e.g. Abandoned Object Detection):

### 1. Create Feature Package (`features/abandoned_object/`)
Create a self-contained sub-folder inside `features/`:

```text
features/
└── abandoned_object/
    ├── __init__.py
    ├── processor.py
    ├── utils.py
    └── README.md
```

### 2. Create Feature Preset (`config/presets/abandoned_object.yaml`)
Define default settings and paths for your feature:

```yaml
# Abandoned Object Detection Preset Settings
model_path: "models/yolov8n.pt"
video_path: "videos/stock/sample.mp4"
```

### 3. Create Dedicated Runner Script (`app/run_abandoned_object.py`)
Create an independent runner script inside `app/`:

```python
"""
AI Campus Guard - Abandoned Object Feature Runner
"""
import config.config as config
from features.abandoned_object import AbandonedObjectProcessor

def main():
    config.load_preset("abandoned_object.yaml")
    # Feature processing loop...

if __name__ == "__main__":
    main()
```

---

## 🚀 Running Features Separately

Team members can run their respective feature modules independently:

```bash
# 1. Crowd Detection Module
python app/run_crowd_detection.py

# 2. Behavior Detection Module (Fall, Fight & Movement)
python app/run_behavior_detection.py

# 3. Restricted Area Detection Module (Polygon ROI Intrusion)
python app/run_restricted_area.py

# 4. Abandoned Object Detection (Future)
python app/run_abandoned_object.py
```

---

## 🔑 Golden Rules for Developers:
1. **Isolation**: Do NOT modify code in other team members' feature folders.
2. **Dedicated Runners**: Put your runner script in `app/run_<feature_name>.py`.
3. **Preset Configuration**: Always load paths and thresholds via `config.config.load_preset()`.
