# 🛠️ AI Campus Guard - Development & Contribution Guide

Guide for developers adding new surveillance modules to the AI Campus Guard repository.

---

## 📁 Adding a New Feature Module

When developing a new feature (e.g. Restricted Area Entry Detection):

### 1. Create Feature Package (`features/restricted_area/`)
Create a self-contained sub-folder inside `features/`:

```text
features/
└── restricted_area/
    ├── __init__.py
    ├── detector.py
    ├── processor.py
    ├── utils.py
    └── README.md
```

### 2. Create Feature Preset (`config/presets/restricted_area.yaml`)
Define default settings and paths for your feature:

```yaml
# Restricted Area Detection Preset Settings
model_path: "models/yolov8n.pt"
video_path: "videos/stock/sample.mp4"
output_path: "videos/output/restricted_area_output.mp4"
```

### 3. Create Dedicated Runner Script (`app/run_restricted_area.py`)
Create an independent runner script inside `app/`:

```python
"""
AI Campus Guard - Restricted Area Feature Runner
"""
import config.config as config
from features.restricted_area import RestrictedAreaDetector

def main():
    config.load_preset("restricted_area.yaml")
    # Feature processing loop...

if __name__ == "__main__":
    main()
```

---

## 🚀 Running Features Separately

Team members can run their respective feature modules independently:

```bash
# Crowd Detection
python app/run_crowd_detection.py

# Restricted Area Entry Detection (Future)
python app/run_restricted_area.py

# Abandoned Object Detection (Future)
python app/run_abandoned_object.py
```

---

## 🔑 Golden Rules for Developers:
1. **Isolation**: Do NOT modify code in other team members' feature folders.
2. **Dedicated Runners**: Put your runner script in `app/run_<feature_name>.py`.
3. **Preset Configuration**: Always load paths and thresholds via `config.config.load_preset()`.
