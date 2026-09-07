# 🚀 HOW TO RUN - AI Campus Guard

Follow this step-by-step guide to clone, configure, and execute the **AI Campus Guard** surveillance system on your computer.

---

## ⚡ Quick Start — One-Click Master Launcher (Recommended)

Run **ALL** system components simultaneously (Next.js Web Portal, FastAPI Backend, and AI Surveillance Engine) with a single command:

```powershell
python start_system.py
```

This single command automatically:
1. Auto-resolves Python virtual environment (`.\.venv\Scripts\python.exe`).
2. Configures `web/.env.local` environment variables.
3. Installs Web App Node dependencies (`npm install` inside `web/`).
4. Launches **Next.js Web Portal** on `http://localhost:3000`.
5. Launches **FastAPI ML Backend Server** on `http://localhost:8000`.
6. Launches **AI Surveillance Engine** & opens `http://localhost:3000/login` in your default browser.

#### Login Credentials:
- **URL**: `http://localhost:3000/login`
- **User ID**: `superadmin`
- **Password**: `ChangeMe123!`

---

## Step 1 — Clone the Repository

```bash
git clone <GITHUB_REPOSITORY_URL>
cd AI-Campus-Guard
```

---

## Step 2 — Open Project in VS Code

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

Download the **YOLOv8 Nano (`yolov8n.pt`)** model:
```bash
python scripts/download_models.py
```

---

## Step 6 — Video Setup

Videos are organized under the [`videos/`](videos/) directory:
```text
videos/
├── input/    # Put your custom CCTV MP4 video files here
└── stock/    # Pre-included stock test videos (sample3.mp4)
```

---

## Step 7 — How to Change Active Video Feed

Edit preset configuration in [`config/presets/crowd_detection.yaml`](config/presets/crowd_detection.yaml):

```yaml
video_path: "videos/input/your_custom_video.mp4"
```

---

## Step 8 — Run Individual Subsystem Runners

Each feature module has its dedicated runner script inside `app/`:

### 1. Run Crowd Detection Module:
```bash
python app/run_crowd_detection.py
```

### 2. Run 4-Camera Video Quad Dashboard:
```bash
python app/run_multi_camera.py
```

### 3. Run Behavior Detection Module:
```bash
python app/run_behavior_detection.py
```

### 4. Run Restricted Area Intrusion Module:
```bash
python app/run_restricted_area.py
```

---

## Step 9 — Automated Test Verification

Run all 99 automated unit and integration tests:

```powershell
python -m unittest discover tests
```

Expected Output: `Ran 99 tests ... OK`

---

## Step 10 — Troubleshooting

- **`ModuleNotFoundError`**: Run `pip install -r requirements.txt`.
- **`Video file not found`**: Check file path in `config/presets/crowd_detection.yaml`.
- **`MongoDB Connection Error`**: Check IP Access List in MongoDB Atlas dashboard (`Allow Access From Anywhere: 0.0.0.0/0`).
