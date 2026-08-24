# 🎒 Abandoned Object Detection Module

**Status**: ✅ Active & Production-Ready (TechVerse MVP)

The **Abandoned Object Detection** module monitors campus public spaces (hallways, cafeterias, libraries, courtyards) for stationary, unattended items (backpacks, handbags, suitcases, bottles) and emits prioritized safety events when items are left unattended beyond configured thresholds.

---

## 🏗️ Architecture & Pipeline Flow

```text
Video Frame
     ↓
Single-Pass Multi-Class YOLOv8 + ByteTrack
     ↓
Separate Tracked Persons & Target Objects
     ↓
Movement Smoothing & Jitter Filter
     ↓
Stationary Confirmation (Threshold px & Duration)
     ↓
Person Proximity Analysis (Center & Base Anchor Checks)
     ↓
Attended vs. Unattended State Resolution
     ↓
Abandonment Persistence Timer
     ↓
Potential Abandoned Object Event + Alert Card
```

---

## 📦 Supported Object Classes (COCO Dataset)

| Object Category | COCO Class ID | Default Unattended Threshold | Demo Threshold | Base Risk Weight | Severity Level |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Backpack** | `24` | $15\text{s}$ | $8\text{s}$ | 70 | `high` |
| **Handbag** | `26` | $15\text{s}$ | $8\text{s}$ | 65 | `medium` |
| **Suitcase** | `28` | $15\text{s}$ | $8\text{s}$ | 80 | `critical` |
| **Bottle** | `39` | $30\text{s}$ | $15\text{s}$ | 20 | `low` |

---

## 🚀 How to Run

### Standalone Video Runner
```powershell
python app/run_abandoned_object.py --video videos/stock/sample.mp4 --ui-mode demo
```

### Live Webcam Mode
```powershell
python app/run_abandoned_object.py --video 0 --ui-mode demo
```

### Automated Unit Test Suite
```powershell
python tests/test_abandoned_object.py
```
