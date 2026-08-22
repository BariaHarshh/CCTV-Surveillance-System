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
  Count Stabilization & Behavioral Tracking Memory
            ↓
  ┌─────────────────────────────┴─────────────────────────────┐
  │                                                           │
  v                                                           v
Crowd Detector Processor                       Behavior Processor
(Threshold & Persistence Timer)               (Fall, Fight, Movement Engine)
  │                                                           │
  └─────────────────────────────┬─────────────────────────────┘
                                ↓
  OpenCV Visualization HUD (UI Presentation Layer - Track IDs Hidden)
```

---

## 🧩 Feature Extension Architecture

The repository is organized so that new detection & analytics modules operate independently:

```text
                               ┌── Crowd Detection Module (✅ Active)
                               │
                               ├── Behavior Detection (Fall / Fight / Motion) (✅ Active)
                               │
Computer Vision Base Layer ────┼── Restricted Area Entry Detection (🚧 Planned)
(YOLO + ByteTrack)             │
                               ├── Abandoned Object Detection (🚧 Planned)
                               │
                               └── Risk Assessment Engine (🚧 Planned)
```

---

## 🔒 Privacy & Presentation Layer Design

- **Internal Track IDs**: ByteTrack generates unique integer track IDs (`det["track_id"]`) in memory for object persistence, motion tracking, and behavioral trajectory analysis.
- **UI Masking**: On the visual output screen / video preview, track IDs are explicitly masked (`PERSON 92%`). Track IDs are never displayed to viewers, adhering to clean UI standards.
