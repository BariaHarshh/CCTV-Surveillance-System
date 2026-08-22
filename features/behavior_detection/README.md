# 🧠 Behaviour Detection Feature Module

**Module Path**: `features/behavior_detection/`  
**Status**: ✅ Complete MVP Implementation  
**Downstream Consumer**: Risk Assessment Engine (`features/risk_assessment/`)

---

## 🌟 Overview

The **Behaviour Detection** module provides multi-frame, temporal analysis of tracked individuals and pairwise interactions across video streams. Instead of relying on noisy single-frame heuristics, it computes kinematic trajectories and geometric postures over rolling sliding windows to identify:

1. **Fall Detection**: Sudden vertical collapses, transitions from upright to horizontal bounding-box postures ($w/h \ge 1.05$), and downward momentum with persistence validation.
2. **Aggressive / Unusual Movement**: High locomotion speeds, abrupt acceleration/bursts, and high angular direction volatility (erratic zig-zagging / darting).
3. **Potential Fight Detection**: Pairwise convergence, close spatial proximity ($d \le 140\text{px}$), and mutual aggressive kinetic struggle sustained over multiple seconds.

---

## 🏗️ Architecture & Pipeline Flow

```text
Video Stream / Camera Feed
            ↓
  Person Detection (Ultralytics YOLOv8)
            ↓
  Multi-Object Tracking (ByteTrack)
            ↓
  Tracked Persons List [{"track_id": 17, "box": (x1,y1,x2,y2), "confidence": 0.88}]
            ↓
  TrackHistoryManager (Temporal Kinematics Buffer: speed, accel, heading, aspect ratio)
            ↓
  ┌───────────────────────┬──────────────────────────┬────────────────────────┐
  │     FallDetector      │     MovementAnalyzer     │     FightDetector      │
  │ (Aspect + Drop + Time)│  (Speed + Accel + Vol)   │ (Proximity + Dynamics) │
  └───────────────────────┴──────────────────────────┴────────────────────────┘
            ↓
  Unified BehaviorProcessor (State Machines & Cooldown Management)
            ↓
  Standardized BehaviourEvents [{"event_type": "...", "confidence": 0.85, ...}]
            ↓
  OpenCV Behaviour Monitor HUD Overlay + Downstream Risk Engine
```

---

## 📦 Module File Structure

```text
features/behavior_detection/
├── __init__.py                     # Package public API exports
├── config.py                       # Typed dataclasses (BehaviorConfig, FallConfig, MovementConfig, FightConfig)
├── event.py                        # Standardized BehaviourEvent dataclass & serialization
├── tracking_history.py             # Temporal track buffer (speeds, accelerations, aspect ratios, headings)
├── fall.py                         # FallDetector (posture aspect ratio & downward velocity persistence)
├── movement.py                     # MovementAnalyzer (individual kinetic velocity, burst accel, direction volatility)
├── interaction.py                  # FightDetector (pairwise proximity, convergence, mutual struggle)
├── processor.py                    # Unified BehaviorProcessor state machine coordinator
├── utils.py                        # Top-right Behaviour Monitor HUD and bounding box overlays
├── run_behavior_detection.py       # Standalone feature runner for video verification
├── README.md                       # Module documentation (this file)
└── INTEGRATION_REQUIREMENTS.md     # Integration instructions for project lead
```

---

## ⚙️ Configuration Reference

All detection thresholds are fully configurable via typed dataclasses in [`config.py`](file:///c:/Workshop/AI-Campus-Guard/features/behavior_detection/config.py):

### Fall Detection (`FallConfig`)
| Parameter | Default | Description |
| :--- | :---: | :--- |
| `aspect_ratio_threshold` | `1.05` | Width / Height ratio indicating horizontal/lying posture |
| `vertical_drop_ratio` | `0.35` | Minimum proportional reduction in bounding-box height |
| `vertical_velocity_threshold`| `100.0` | Downward vertical velocity (px/s) triggering rapid drop |
| `persistence_seconds` | `1.0` | Duration fallen state must persist before confirming event |
| `confidence_threshold` | `0.65` | Minimum confidence required to emit event |
| `cooldown_seconds` | `5.0` | Alert suppression cooldown for same person |

### Movement Analysis (`MovementConfig`)
| Parameter | Default | Description |
| :--- | :---: | :--- |
| `speed_threshold` | `160.0` | Movement speed (px/s) considered abnormal/darting |
| `acceleration_threshold` | `220.0` | Acceleration (px/s²) considered sudden burst or stop |
| `direction_volatility_threshold` | `60.0` | Angular heading deviation (deg) indicating erratic movement |
| `persistence_seconds` | `0.8` | Duration erratic motion must persist |
| `confidence_threshold` | `0.60` | Minimum confidence to emit event |
| `cooldown_seconds` | `4.0` | Alert suppression cooldown |

### Fight Detection (`FightConfig`)
| Parameter | Default | Description |
| :--- | :---: | :--- |
| `proximity_threshold` | `140.0` | Max center-to-center distance (px) for close interaction |
| `mutual_speed_threshold` | `110.0` | Combined or individual speed during close interaction (px/s) |
| `mutual_accel_threshold` | `160.0` | Acceleration during struggle / grappling (px/s²) |
| `persistence_seconds` | `1.2` | Duration close aggressive interaction must be sustained |
| `confidence_threshold` | `0.70` | Minimum confidence to emit fight event |
| `cooldown_seconds` | `6.0` | Alert suppression cooldown for same pair |

---

## 🚀 How to Run & Test

Execute the standalone behaviour runner directly from the terminal:

```powershell
python -m features.behavior_detection.run_behavior_detection
```

Or run automated unit tests:

```powershell
python -m unittest tests/test_behavior_detection.py
```

---

## 📊 Standardized Event Output Example

```json
{
  "event_type": "potential_violent_activity",
  "person_ids": [17, 21],
  "confidence": 0.87,
  "severity": "high",
  "timestamp": "T+14.20s",
  "camera_id": "CAM-01",
  "location": "Campus Main Hallway",
  "duration_seconds": 1.45,
  "metadata": {
    "distance_px": 38.4,
    "combined_speed": 165.2,
    "peak_acceleration": 210.0,
    "interaction_duration": 1.45
  }
}
```
