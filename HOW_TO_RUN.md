# 🚀 HOW TO RUN - AI Campus Guard

Follow this step-by-step guide to clone, configure, and execute the **AI Campus Guard** surveillance system on your computer.

---

## Step 1 — Clone the Repository

Open your terminal or command prompt and run:
```bash
git clone <GITHUB_REPOSITORY_URL>
cd AI-Campus-Guard
```

---

## Step 2 — Open Project in VS Code

Open the project folder in VS Code:
```bash
code .
```

---

## Step 3 — Create Virtual Environment

### Windows (PowerShell):
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
*(If PowerShell blocks activation script execution, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` first).*

### Windows (Command Prompt / cmd.exe):
```cmd
python -m venv .venv
.venv\Scripts\activate.bat
```

### Linux / macOS:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

---

## Step 4 — Install Dependencies

Install all required Python packages using:
```bash
pip install -r requirements.txt
```

---

## Step 5 — Model Setup

The system uses the **YOLOv8 Nano (`yolov8n.pt`)** model for person detection.

Run the model downloader utility to fetch the model automatically:
```bash
python scripts/download_models.py
```
This script downloads `yolov8n.pt` into the [`models/`](models/) directory.

---

## Step 6 — Video Setup

Videos are organized under the [`videos/`](videos/) directory:
```text
videos/
├── input/    # Put your custom CCTV or test MP4 video files here
└── stock/    # Contains pre-included stock test videos (sample.mp4)
```

Stock videos (`sample.mp4`) are pre-packaged under `videos/stock/`.

---

## Step 7 — Run Active Feature Modules

Each feature module has its dedicated runner script inside `app/`:

### 1. Run Crowd Detection Module:
```bash
python app/run_crowd_detection.py
```
*(Or run `python app/main.py` which launches default Crowd Detection).*

### 2. Run Behavior Detection Module (Fall, Fight & Movement):
```bash
python app/run_behavior_detection.py
```

#### Behavior Detection CLI Options:
```bash
# High Performance Mode (Lag-free processing for CPU)
python app/run_behavior_detection.py --performance-mode performance

# Quality Mode (640p resolution for highest precision)
python app/run_behavior_detection.py --performance-mode quality

# Force GPU CUDA or CPU execution
python app/run_behavior_detection.py --device cuda
python app/run_behavior_detection.py --device cpu

# Debug UI telemetry mode
python app/run_behavior_detection.py --ui-mode debug
```

---

## Step 8 — Expected Screen Output

### Crowd Detection:
- **Window Title**: `"AI Campus Guard - Crowd Detection"`
- **HUD Panel**: `RAW PEOPLE`, `STABLE PEOPLE`, `THRESHOLD`, `STATUS`.

### Behavior Detection:
- **Window Title**: `"AI Campus Guard - Behaviour Intelligence Monitor"`
- **Telemetry HUD**: Active Alerts, Fall Alerts, Fight Alerts, Movement Volatility, and Performance FPS Profiler.

Press **`Q`** key in the video preview window to stop playback cleanly.

---

## Step 9 — How to Change Video / Model / Settings

Edit presets in [`config/presets/`](config/presets/):
- [`config/presets/crowd_detection.yaml`](config/presets/crowd_detection.yaml)
- [`config/presets/behavior_detection.yaml`](config/presets/behavior_detection.yaml)

---

## Step 10 — Troubleshooting

- **`ModuleNotFoundError`**: Activate venv (`.\.venv\Scripts\Activate.ps1`) and run `pip install -r requirements.txt`.
- **`Video file not found`**: Check file exists at `videos/stock/sample.mp4`.
- **`Model not found`**: Run `python scripts/download_models.py`.
