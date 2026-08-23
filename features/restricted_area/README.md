# 🛡️ Restricted Area Detection Module

**Status**: ✅ Active / Fully Implemented

This module detects unauthorized human entry into user-defined polygon ROI restricted zones (e.g. server rooms, rooftop access, faculty offices, or restricted labs) on campus CCTV video feeds.

---

## 🏗️ Architecture & Features

```text
Video Frame
    ↓
Person Detection (YOLOv8)
    ↓
Object Tracking (ByteTrack)
    ↓
Multi-Anchor Box Inspection (Center, Top, Mid-Low, Bottom Points)
    ↓
Polygon Point Test (OpenCV cv2.pointPolygonTest)
    ↓
Per-Person Intrusion State Machine (OUTSIDE → CHECKING → INSIDE → EXITED)
    ↓
Persistence Filter (0.5s) & Track Memory Grace Period (1.5s)
    ↓
Restricted Area Output & Telemetry
    ↓
Glassmorphic HUD & Polygon Visualization
```

### Key Highlights:
- **Multi-Anchor Inspection**: Evaluates Center, Top, Mid-Low, and Bottom points of person bounding boxes to reliably detect sitting persons behind desks or partially occluded bodies.
- **Temporal Track Memory (1.5s Grace Period)**: Holds breach state across momentary ByteTrack ID flickers or temporary detection drops.
- **Glassmorphic HUD**: Displays real-time intruder count and zone breach alerts.

---

## ⚙️ Configuration & Presets

Configured via `config/presets/restricted_area.yaml`:

```yaml
zones:
  - name: "OFFICE CUBICLE RESTRICTED ZONE"
    enabled: true
    severity: "critical"
    points:
      - [201, 271]
      - [553, 174]
      - [851, 268]
      - [572, 531]
```

---

## 🚀 How to Run

Run the dedicated runner script from the repository root:

```bash
python app/run_restricted_area.py
```
