# 🏗️ AI Campus Guard - System Architecture

AI Campus Guard is a modular computer vision security and surveillance platform designed to analyze CCTV and video feeds for campus safety.

---

## 🔄 Core Pipeline Flow

```text
Video Stream / Camera Feed
            ↓
  Person Detection (YOLO)
            ↓
  Object Tracking (ByteTrack)
            ↓
  Internal Track IDs (Maintained in Memory)
            ↓
  Count Stabilization (Rolling Median & Drop Confirmation)
            ↓
  Crowd Detector Processor (Threshold & Persistence Timer)
            ↓
  OpenCV Visualization HUD (UI Presentation Layer - Track IDs Hidden)
```

---

## 🧩 Feature Extension Architecture

The repository is organized so that new detection & analytics modules can be added independently without modifying existing modules:

```text
                               ┌── Crowd Detection Module (✅ Active)
                               │
                               ├── Restricted Area Entry Detection (🚧 Planned)
                               │
Computer Vision Base Layer ────┼── Abandoned Object Detection (🚧 Planned)
(YOLO + ByteTrack)             │
                               ├── Behavior Detection (Fall / Fighting) (🚧 Planned)
                               │
                               └── Risk Assessment Engine (🚧 Planned)
```

---

## 🔒 Privacy & Presentation Layer Design

- **Internal Track IDs**: ByteTrack generates unique integer track IDs (`det["track_id"]`) in memory for object persistence, motion tracking, and count stabilization.
- **UI Masking**: On the visual output screen / video preview, track IDs are explicitly masked (`PERSON 92%`). Track IDs are never displayed to viewers, adhering to clean UI standards.
