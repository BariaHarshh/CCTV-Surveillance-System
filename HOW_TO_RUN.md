# 🚀 HOW TO RUN - AI Campus Guardian

Follow this step-by-step guide to clone, configure, and execute the **AI Campus Guardian** surveillance system on your computer.

---

## ⚡ Quick Start — One-Click Master Launcher (Recommended)

Run **ALL** system components simultaneously (Next.js Web Portal, FastAPI ML Backend, and 4-Camera AI Surveillance Engine) with a single command:

```powershell
python start_system.py
```

This single command automatically:
1. Auto-resolves Python virtual environment (`.\.venv\Scripts\python.exe`).
2. Applies automated Windows Code Integrity PyTorch runtime guard.
3. Configures `.env.local` environment variables for the standalone web portal.
4. Verifies Web App Node dependencies (`npm install`).
5. Launches **Next.js Web Portal & Real-time Socket.IO** on `http://localhost:3000`.
6. Launches **FastAPI ML Integration Backend** on `http://localhost:8000`.
7. Launches **4-Camera Video Quad Grid AI Engine** (`app/run_multi_camera.py --headless`).
8. Automatically opens the **Security Command Center** at `http://localhost:3000/admin/monitoring` in your default browser.

#### System Navigation & URLs:
- **Security Command Center**: `http://localhost:3000/admin/monitoring`
- **Live 4-Camera Monitoring Wall**: `http://localhost:3000/admin/monitoring/live`
- **Portal Login**: `http://localhost:3000/login`
- **FastAPI Stream & API Docs**: `http://localhost:8000/docs`

#### Login Credentials:
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

Verify the **YOLOv8 Nano (`models/yolov8n.pt`)** model is present:
```bash
python -c "from ultralytics import YOLO; YOLO('models/yolov8n.pt')"
```

---

## Step 6 — Video Feeds

Videos are organized under the [`videos/`](videos/) directory:
```text
videos/
├── input/    # Put your custom CCTV MP4 video files here
└── stock/    # Pre-included stock test videos (sample4.mp4, sample5.mp4, sample6.mp4, sample7.mp4)
```

---

## Step 7 — 4-Camera Surveillance Matrix

| Camera ID | App Name | AI Feature Module | Video Source | FastAPI Stream Route |
| :--- | :--- | :--- | :--- | :--- |
| `CAM-000001` | Canteen Quad (`CAM-01`) | **Crowd Detection** | `videos/stock/sample4.mp4` | `/api/cameras/66d550000000000000000002/stream` |
| `CAM-000002` | Hostel Corridor (`CAM-02`) | **Behavior Analytics** | `videos/stock/sample5.mp4` | `/api/cameras/66d550000000000000000003/stream` |
| `CAM-000003` | Server Room (`CAM-03`) | **Restricted Polygon ROI** | `videos/stock/sample6.mp4` | `/api/cameras/66d550000000000000000004/stream` |
| `CAM-000004` | Main Lobby (`CAM-04`) | **Abandoned Luggage** | `videos/stock/sample7.mp4` | `/api/cameras/66d550000000000000000005/stream` |

---

## Step 8 — Automated Test Verification

Run the full Python test suite (111 unit & integration tests):

```powershell
pytest tests/ -v
```

Expected Output: `111 passed in ~5.8s`

Run the Frontend test suite (78 unit tests & TypeScript check):

```powershell
cd ../AI_Campus_Guardian_Web_app-main
npx tsc --noEmit
npx vitest run
```

Expected Output: `11 test files, 78 passed`

---

## Step 9 — Troubleshooting

- **`ModuleNotFoundError`**: Run `pip install -r requirements.txt`.
- **`WinError 4551 (Smart App Control)`**: `start_system.py` automatically isolates stub files to ensure PyTorch loads cleanly under Windows Code Integrity policies.
- **`Video file not found`**: Check file paths in `config/presets/`.
- **`MongoDB Connection Error`**: Check IP Access List in MongoDB Atlas dashboard (`Allow Access From Anywhere: 0.0.0.0/0`).
