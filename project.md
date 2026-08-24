# 🛡️ AI Campus Guard — Project Documentation & Updates

> **Centralized AI-Powered Surveillance, Multi-Threat Intelligence & Risk Assessment System**

---

## 📌 Project Overview
**AI Campus Guard** ek advanced, real-time intelligent campus surveillance aur security monitoring platform hai. Yeh ek single-pass YOLOv8 + ByteTrack pipeline ke through multiple security subsystems ko synchronize aur orchestrate karta hai:
1. **Crowd Detection & Density Monitoring** (Headcount stabilization & surge alerts)
2. **Behaviour & Anomaly Detection** (Fall detection, aggressive movement, potential fights)
3. **Abandoned Object & Unattended Luggage Detection** (Owner proximity tracking & temporal escalation)
4. **Restricted Area & Intrusion Detection** (Multi-anchor polygon ROI intrusion monitoring)
5. **Central Risk Assessment & Management Orchestrator** (Unified 0-100 risk score, incident management, automated security dispatch recommendations)

---

## 🚀 Today's Major Updates & Implementations (Complete Changelog)

### 1. ⚙️ Central Risk Management Orchestrator (`features/risk_assessment/orchestrator.py`)
- **Single Master Runner**: Ek central orchestrator build kiya (`app/run_risk_management.py`) jo saare enabled detection subsystems ko automatically coordinate aur run karta hai.
- **Single-Pass Inference**: Shared `MultiObjectDetector` use hota hai jisse ek hi frame par person aur object detection hoti hai — multiple YOLO runs completely eliminate ho gaye.
- **Fault Isolation**: Agar koi ek subsystem error throw kare, toh baaki subsystems bina crash huye seamlessly continue karte hain.

---

### 2. 🚨 Real-Time Risk Assessment & Incident Lifecycle (`features/risk_assessment/`)
- **Unified Risk Score (0 - 100)**: Sabhi multi-source events ka composite score calculate karta hai:
  - `0 - 24`: **LOW** (Normal Monitoring)
  - `25 - 49`: **MEDIUM** (Attention)
  - `50 - 74`: **HIGH** (Warden Investigation Dispatch)
  - `75 - 100`: **CRITICAL** (Emergency Security Dispatch)
- **Incident Lifecycle Engine**: Inactivity decay, temporal persistence, compound incident correlation aur cooldown-based deduplication implement kiya taaki alert spamming na ho.

---

### 3. 🎛️ Interactive GUI Control Menu & Restricted Area Drawing (`interactive_controller.py`)
- **Interactive Control Menu (`[ ☰ CONTROLS ]` / Key `M`)**: Live runtime par features ko enable/disable karne ke liye interactive toggle switches (`[ ON ]` / `[ OFF ]`).
- **Interactive Polygon Drawing Mode (Key `R`)**: Real-time video window ke upar mouse click karke custom $N$-sided Restricted Area Polygons draw karne ki capability:
  - `Click`: Add Vertex Point
  - `ENTER`: Finish Polygon
  - `BACKSPACE`: Undo Last Point
  - `ESC`: Cancel Drawing Mode
- **Zone Severity & YAML Persistence**: Zone severity cycle karne (`HIGH`, `CRITICAL`, `MEDIUM`, `LOW`), single zone remove, aur `config/saved_zones.yaml` me save/load karne ka system.

---

### 4. 📐 Responsive Fixed-Component UI Layout & Scaling (`UILayoutManager`, `utils.py`)
- **Stretching & Distortion Fix**: Bounded clamping math ke sath `UILayoutManager` banaya jo canvas resolution ke hisaab se panels ko horizontally ya vertically stretch hone se rokta hai:
  - **Menu Button**: $130\text{px} - 185\text{px}$
  - **Risk Card**: $310\text{px} - 450\text{px}$ width, $130\text{px} - 180\text{px}$ height
  - **Control Side Panel**: $280\text{px} - 380\text{px}$
- **Compact Surveillance HUD**: Video feed 85%+ clear aur unobstructed rehta hai.
- **Typography Minimums**: Enforced font minimums jisse kisi bhi resolution par text microscopic na ho.
- **Reusable Primitives**: `draw_ui_panel`, `draw_ui_button`, `draw_ui_toggle`, `letterbox_frame`.

---

### 5. 🔍 Canonical Pipeline & Coordinate System Standardization
- **1:1 Pixel Mapping Audit**: Frame pipeline audit karke coordinate mismatches fix kiye gaye.
- **Normalized Polygon Support**: Restricted Zone polygon coordinates ko normalized $(0.0 - 1.0)$ floats me store karke runtime resolution ke mutabiq dynamic integer conversion fix kiya.
- **Zero Coordinate Drift**: Detection boxes (YOLO/ByteTrack) strict native frame coordinates me operate karte hain aur UI scaling se unka koi distortion nahi hota.

---

### 6. ⚡ Detection Accuracy, Tracking Reliability & Profiler (`profiler.py`, `detector.py`)
- **Confidence Hysteresis**:
  - Person candidate threshold: `0.40`
  - Object candidate threshold: `0.45`
  - Existing established track retention threshold: `0.30` (drops flickering/missed frames).
- **Track Persistence & Occlusion Recovery**: 20-frame track memory buffer jisse agar person $1-5$ frames ke liye hide ho jaye, toh unka `track_id` switch nahi hota.
- **Real-Time Performance Profiler**: Sub-millisecond per-stage profiling (YOLO, Crowd, Behaviour, Abandoned, Restricted, Risk Engine, UI) moving average ke sath.
- **Live Diagnostics HUD Card (Key `P`)**: Video stream ke upar real-time frame processing breakdown aur FPS dekhne ke liye toggle.

---

## 📊 Performance Presets Matrix

| Preset Name | File Path | imgsz | Detection Cadence | Avg CPU FPS | Best For |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Full Security** | `config/presets/risk_management_full.yaml` | `640` | Every frame | $\sim 20\text{ FPS}$ | Maximum situational security |
| **High Accuracy** | `config/presets/risk_management_high_accuracy.yaml` | `640` | Every frame | $\sim 18\text{ FPS}$ | High density investigation |
| **Balanced** | `config/presets/risk_management_balanced.yaml` | `512` | Frame $1$, Beh $2$, Obj $3$ | $\sim 26\text{ FPS}$ | **Recommended Daily Default** |
| **High Performance**| `config/presets/risk_management_high_performance.yaml` | `416` | Frame $2$, Beh $3$, Obj $4$ | $\sim 85\text{ FPS}$ | Ultra-fast lightweight execution |

---

## 🗂️ Project Directory Structure

```text
AI-Campus-Guard/
├── app/
│   ├── main.py                        # Legacy/feature launcher
│   ├── run_risk_management.py        # 🌟 Master Single Runner Entry Point
│   ├── run_abandoned_object.py        # Dedicated Abandoned Object Runner
│   └── run_risk_assessment.py        # Dedicated Risk Assessment Runner
│
├── config/
│   ├── config.py                      # Global configuration constants
│   ├── saved_zones.yaml               # User saved restricted zones
│   └── presets/                       # Performance & Operational Presets
│       ├── risk_management_full.yaml
│       ├── risk_management_balanced.yaml
│       ├── risk_management_high_accuracy.yaml
│       ├── risk_management_high_performance.yaml
│       ├── risk_management_demo.yaml
│       ├── risk_management_behavior.yaml
│       └── risk_management_security.yaml
│
├── features/
│   ├── crowd_detection/               # Crowd headcount & surge detection
│   ├── behavior_detection/            # Fall, aggressive motion, fight detection
│   ├── abandoned_object/              # MultiObjectDetector, luggage tracking & proximity
│   ├── restricted_area/               # Polygon ROI intrusion & zone tracking
│   └── risk_assessment/               # 🌟 Master Risk Management Orchestrator
│       ├── orchestrator.py            # Central coordinator
│       ├── processor.py               # Risk Assessment Engine
│       ├── interactive_controller.py  # Real-time menu & polygon drawing
│       ├── profiler.py                # Sub-millisecond latency profiler
│       ├── calculator.py              # Risk score algorithm
│       ├── incident.py                # Incident lifecycle & deduplication
│       └── utils.py                   # Bounded UI Layout Manager & drawing primitives
│
├── tests/
│   ├── test_ui_scaling.py             # UI Layout bounds & scaling tests
│   ├── test_interactive_menu.py       # Menu & polygon drawing tests
│   ├── test_performance_and_tracking.py # Profiler, hysteresis & cadence tests
│   ├── test_risk_management.py        # Orchestrator & multi-subsystem tests
│   ├── test_risk_assessment.py        # Scoring & incident decay tests
│   ├── test_abandoned_object.py       # Object proximity & escalation tests
│   ├── test_behavior_detection.py     # Fall & fight detection tests
│   └── test_restricted_area.py        # Polygon intrusion tests
│
└── models/
    └── yolov8n.pt                     # YOLOv8 Nano weights
```

---

## 🧪 Test Suite Status
All **76 automated unit and integration tests** across the repository pass cleanly:

```powershell
python -m unittest discover tests
```
```text
Ran 76 tests in 2.973s
OK
```

---

## 💻 Keyboard Shortcuts in Surveillance Window

| Key | Action |
| :---: | :--- |
| **`M`** | Toggle System Controls Menu (Feature switches, Add Zone, Save/Load) |
| **`R`** | Toggle Interactive Polygon Drawing Mode |
| **`P`** | Toggle Real-Time Performance & Latency Telemetry Card |
| **`ENTER`** | Complete polygon drawing and save zone |
| **`BACKSPACE`** | Undo last drawn polygon vertex |
| **`ESC`** | Cancel polygon drawing mode |
| **`Q`** | Gracefully quit surveillance runner |

---

## 🚀 Commands to Run

```powershell
# 1. Multi-Camera 4-Feed Quad Grid Surveillance Dashboard (Recommended)
python app/run_multi_camera.py

# 2. Master Single-Stream Risk Management Dashboard
python app/run_risk_management.py

# 3. Individual Subsystem Runners
python app/run_crowd_detection.py
python app/run_behavior_detection.py
python app/run_restricted_area.py
python app/run_abandoned_object.py

# 4. Unified CLI Launcher
python app/main.py --feature multi
```
