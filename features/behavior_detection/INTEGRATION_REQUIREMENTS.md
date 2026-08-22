# 🔌 Behaviour Detection — Integration Requirements

This document explains the exact non-breaking modifications required to integrate the **Behaviour Detection** module into the unified **AI Campus Guard** application pipeline.

---

## 1. 📁 Modified Files Summary

| Shared File | Reason for Modification | Risk Level |
| :--- | :--- | :---: |
| `config/presets/behavior_detection.yaml` | **[NEW]** Preset configuration file for behaviour thresholds | Zero (New file) |
| `config/config.py` | Add optional behaviour preset loader mapping | Low |
| `app/main.py` | Optional launcher option to run unified crowd + behaviour pipeline | Low |

---

## 2. 📦 New Dependencies Required

**None.** The Behaviour Detection module utilizes the existing project dependencies (`numpy`, `opencv-python`, `ultralytics`, `PyYAML`).

---

## 3. 📝 Exact Configuration Preset (`config/presets/behavior_detection.yaml`)

```yaml
# Behavior Detection Preset Settings
model_path: "models/yolov8n.pt"
video_path: "videos/stock/sample.mp4"

# Tracking & Pipeline
confidence_threshold: 0.35
tracker_type: "bytetrack.yaml"
frame_skip: 2

# Behavior Global Settings
behavior:
  enabled: true
  history_seconds: 3.0
  history_max_frames: 75
  camera_id: "CAM-01"
  location: "Main Hallway"

  # Fall Detection
  fall:
    enabled: true
    aspect_ratio_threshold: 1.05
    vertical_drop_ratio: 0.35
    vertical_velocity_threshold: 100.0
    persistence_seconds: 1.0
    confidence_threshold: 0.65
    cooldown_seconds: 5.0

  # Aggressive Movement
  movement:
    enabled: true
    speed_threshold: 160.0
    acceleration_threshold: 220.0
    direction_volatility_threshold: 60.0
    persistence_seconds: 0.8
    confidence_threshold: 0.60
    cooldown_seconds: 4.0

  # Potential Fight Detection
  fight:
    enabled: true
    proximity_threshold: 140.0
    mutual_speed_threshold: 110.0
    mutual_accel_threshold: 160.0
    persistence_seconds: 1.2
    confidence_threshold: 0.70
    cooldown_seconds: 6.0
```

---

## 4. 🧩 Code Integration Snippet for `app/main.py`

To integrate Behaviour Detection into the unified processing loop:

```python
from features.crowd_detection import (
    PersonDetector,
    CountStabilizer,
    CrowdDetector,
    draw_crowd_detections
)
from features.behavior_detection import (
    BehaviorProcessor,
    BehaviorConfig,
    draw_behavior_overlay
)

# 1. Initialize Processor
behavior_processor = BehaviorProcessor(BehaviorConfig(camera_id="CAM-01"))

# 2. Inside the Frame Processing Loop (after YOLO tracking):
tracked_persons = detector.track(frame)

# Run crowd detection
stable_count = stabilizer.update(len(tracked_persons), current_time=video_time)
crowd_info = crowd_detector.update(stable_count, current_time=video_time)

# Run behaviour detection
behavior_output = behavior_processor.update(tracked_persons, current_time=video_time)

# 3. Visualization:
annotated_frame = draw_crowd_detections(frame, tracked_persons, len(tracked_persons), stable_count, crowd_info)
annotated_frame = draw_behavior_overlay(annotated_frame, tracked_persons, behavior_output)
```
