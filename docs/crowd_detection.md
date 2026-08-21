# 👥 Crowd Detection Module Documentation

The **Crowd Detection Module** monitors human density in campus zones and triggers real-time alerts when crowd thresholds are sustained continuously.

---

## ⚙️ Module Components (`features/crowd_detection/`)

1. **`detector.py` (`PersonDetector`)**
   - Loads lightweight YOLO model (`yolov8n.pt`).
   - Runs `model.track(..., tracker="bytetrack.yaml", classes=[0])`.
   - Returns bounding boxes, confidence scores, and internal `track_id`s.

2. **`tracker.py` (`CountStabilizer`)**
   - Applies rolling window median smoothing (`COUNT_SMOOTHING_WINDOW = 15`).
   - Implements a drop confirmation timer (`COUNT_DROP_CONFIRMATION_SECONDS = 1.0s`).
   - Eliminates single-frame detection drops to prevent false alert resets.

3. **`processor.py` (`CrowdDetector`)**
   - Monitors `STABLE_COUNT` against `PERSON_THRESHOLD`.
   - Starts persistence timer (`PERSISTENCE_SECONDS = 3.0s`).
   - Transitions status: `NORMAL` -> `CHECKING CROWD` -> `CROWD DETECTED`.

4. **`utils.py` (`draw_crowd_detections`)**
   - Draws bounding boxes around detected persons.
   - Masks Track IDs visually (displays `PERSON 92%`).
   - Renders HUD status panel: `RAW PEOPLE`, `STABLE PEOPLE`, `THRESHOLD`, `STATUS`.

---

## 📊 State Machine Diagram

```text
               +----------------------------------+
               |          STATUS: NORMAL          |
               +----------------------------------+
                                |
               STABLE_COUNT > PERSON_THRESHOLD
                                |
                                v
               +----------------------------------+
               |     STATUS: CHECKING CROWD       |
               +----------------------------------+
                 |                              |
      STABLE_COUNT <= THRESHOLD        Sustained for 3.0s
                 |                              |
                 v                              v
               +----------------------------------+
               |          STATUS: NORMAL          |
               +----------------------------------+
                               ^                |
                               |                v
                               |     +--------------------+
                               +-----|  CROWD DETECTED    |
                                     +--------------------+
```
