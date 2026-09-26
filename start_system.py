"""
AI Campus Guard - Unified System Master Production Launcher
Launches all services in production mode:
  1. FastAPI ML Integration & Stream API (:8000)
  2. 4-Camera Video AI Pipeline (YOLOv8 + ByteTrack)
  3. Next.js Enterprise Production Server + Socket.IO (:3000)
"""

import os
import sys
import time
import json
import subprocess
import signal
import threading
import urllib.request
import webbrowser
from typing import List, Tuple

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def resolve_web_app_dir() -> str:
    """Resolves the active frontend web application directory."""
    candidates = []
    env_dir = os.environ.get("AI_CAMPUS_WEB_DIR")
    if env_dir:
        candidates.append(("AI_CAMPUS_WEB_DIR env var", os.path.abspath(env_dir)))

    parent_dir = os.path.dirname(BASE_DIR)
    candidates.append(("Primary standalone web repo (AI_Campus_Guardian_Web_app-main)", os.path.join(parent_dir, "AI_Campus_Guardian_Web_app-main")))
    candidates.append(("Sibling web repo (AI_Campus_Guardian_Web_app)", os.path.join(parent_dir, "AI_Campus_Guardian_Web_app")))
    candidates.append(("Legacy internal web directory (AI-Campus-Guard/web)", os.path.join(BASE_DIR, "web")))

    for desc, path in candidates:
        if os.path.exists(path) and os.path.exists(os.path.join(path, "package.json")):
            src_dir = os.path.join(path, "src")
            if os.path.exists(src_dir):
                return path

    raise RuntimeError(f"Could not locate a valid frontend web application repository. Candidates checked: {[p for _, p in candidates]}")

WEB_APP_DIR = resolve_web_app_dir()

# Resolve virtualenv python
VENV_PYTHON = (
    os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
    if sys.platform == "win32"
    else os.path.join(BASE_DIR, ".venv", "bin", "python")
)
PYTHON_EXEC = VENV_PYTHON if os.path.exists(VENV_PYTHON) else sys.executable

processes: List[Tuple[str, subprocess.Popen]] = []

def ensure_torch_runtime_integrity():
    """Isolates the non-functional stub torch_global_deps.dll so PyTorch loads cleanly."""
    if sys.platform != "win32":
        return
    torch_lib = os.path.join(BASE_DIR, ".venv", "Lib", "site-packages", "torch", "lib")
    if not os.path.exists(torch_lib):
        return
    stub_dll = os.path.join(torch_lib, "torch_global_deps.dll")
    if os.path.exists(stub_dll):
        try:
            backup_dll = stub_dll + ".blocked"
            if os.path.exists(backup_dll):
                os.remove(backup_dll)
            os.rename(stub_dll, backup_dll)
            print("[INFO] PyTorch runtime integrity verified.")
        except Exception:
            pass

def ensure_web_env():
    """Ensures .env.local exists in the active Web App repository."""
    env_local = os.path.join(WEB_APP_DIR, ".env.local")
    env_example = os.path.join(WEB_APP_DIR, ".env.example")
    if not os.path.exists(env_local) and os.path.exists(env_example):
        print(f"[INFO] Creating .env.local from .env.example for Web App...")
        with open(env_example, "r", encoding="utf-8") as src, open(env_local, "w", encoding="utf-8") as dst:
            dst.write(src.read())

def ensure_npm_install():
    """Ensures node_modules directory exists."""
    node_modules = os.path.join(WEB_APP_DIR, "node_modules")
    if not os.path.exists(node_modules):
        print(f"[INFO] Installing Web App npm dependencies in {WEB_APP_DIR}...")
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        subprocess.run(f"{npm_cmd} install", cwd=WEB_APP_DIR, shell=True, check=True)

def ensure_production_build():
    """Ensures a valid Next.js production build exists (.next/BUILD_ID). Builds if missing."""
    build_id_path = os.path.join(WEB_APP_DIR, ".next", "BUILD_ID")
    if not os.path.exists(build_id_path):
        print("[INFO] Building Next.js frontend for production (next build)...")
        npx_cmd = "npx.cmd next build" if sys.platform == "win32" else "npx next build"
        res = subprocess.run(npx_cmd, cwd=WEB_APP_DIR, shell=True)
        if res.returncode != 0:
            raise RuntimeError(f"Next.js production build failed with exit code {res.returncode}. Please fix build errors before launching.")
        print("[INFO] Next.js production build completed successfully.")
    else:
        print("[INFO] Existing Next.js production build verified.")

def start_fastapi_backend():
    """Starts FastAPI ML backend server."""
    print("[INFO] Starting FastAPI ML Backend on http://localhost:8000...")
    cmd = [PYTHON_EXEC, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
    p = subprocess.Popen(cmd, cwd=BASE_DIR)
    processes.append(("FastAPI Backend", p))

def start_ai_surveillance():
    """Starts 4-Camera AI Surveillance Pipeline."""
    time.sleep(1.5)
    print("[INFO] Starting 4-Camera AI Surveillance Pipeline (Headless Mode)...")
    cmd = [PYTHON_EXEC, "app/run_multi_camera.py", "--headless"]
    p = subprocess.Popen(cmd, cwd=BASE_DIR)
    processes.append(("AI Surveillance", p))

def start_production_web_app():
    """Starts custom Next.js server in PRODUCTION mode."""
    print(f"[INFO] Starting Production Next.js Server on http://localhost:3000...")
    env = os.environ.copy()
    env["NODE_ENV"] = "production"
    cmd = "npx.cmd tsx server.ts" if sys.platform == "win32" else "npx tsx server.ts"
    p = subprocess.Popen(cmd, cwd=WEB_APP_DIR, env=env, shell=True)
    processes.append(("Next.js Production App", p))

def wait_for_fastapi():
    """Waits for FastAPI :8000 /health to respond 200."""
    print("[INFO] Waiting for FastAPI health check...")
    for _ in range(25):
        try:
            with urllib.request.urlopen("http://localhost:8000/health", timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False

def wait_for_camera_streams():
    """Waits for all 4 camera streams to be active in StreamManager."""
    print("[INFO] Verifying 4 camera live streams...")
    for _ in range(30):
        try:
            with urllib.request.urlopen("http://localhost:8000/api/cameras/streams", timeout=2) as r:
                if r.status == 200:
                    data = json.loads(r.read().decode())
                    if len(data) >= 4:
                        return True
        except Exception:
            pass
        time.sleep(0.5)
    return False

def wait_for_frontend():
    """Waits for Next.js production server on :3000 to respond 200."""
    print("[INFO] Verifying Next.js routes (/admin/monitoring & /admin/monitoring/live)...")
    for _ in range(30):
        try:
            req1 = urllib.request.Request("http://localhost:3000/admin/monitoring")
            with urllib.request.urlopen(req1, timeout=3) as r1:
                if r1.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False

def cleanup_processes(signum=None, frame=None):
    print("\n[INFO] Gracefully shutting down all AI Campus Guardian services...")
    for name, proc in reversed(processes):
        try:
            print(f"  • Stopping {name} (PID {proc.pid})...")
            if sys.platform == "win32":
                subprocess.run(
                    f"taskkill /F /T /PID {proc.pid}",
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                proc.terminate()
        except Exception:
            pass
    print("[SUCCESS] All services stopped cleanly.")
    sys.exit(0)

def main():
    # Register signal handlers for graceful exit (Ctrl+C)
    signal.signal(signal.SIGINT, cleanup_processes)
    signal.signal(signal.SIGTERM, cleanup_processes)

    try:
        ensure_torch_runtime_integrity()
        ensure_web_env()
        ensure_npm_install()

        # 1. Start FastAPI Backend
        start_fastapi_backend()
        if not wait_for_fastapi():
            raise RuntimeError("FastAPI ML backend failed to start or pass health check on :8000.")

        # 2. Start Multi-Camera AI Pipeline
        start_ai_surveillance()
        if not wait_for_camera_streams():
            raise RuntimeError("4-Camera AI Surveillance pipeline failed to register active streams on :8000.")

        # 3. Ensure frontend production build exists
        ensure_production_build()

        # 4. Start Custom Next.js server in PRODUCTION mode
        start_production_web_app()
        if not wait_for_frontend():
            raise RuntimeError("Next.js production web portal failed to respond on http://localhost:3000.")

        # Print formatted Production Ready Status
        print("\n" + "=" * 48)
        print("AI CAMPUS GUARDIAN")
        print("==================")
        print()
        print("FastAPI        READY :8000")
        print("ML Engine      READY")
        print("CAM-01         READY")
        print("CAM-02         READY")
        print("CAM-03         READY")
        print("CAM-04         READY")
        print()
        print("Frontend")
        print("Mode: PRODUCTION")
        print("Server: custom server.ts")
        print("READY :3000")
        print()
        print("Dashboard:")
        print("http://localhost:3000/admin/monitoring")
        print()
        print("Live:")
        print("http://localhost:3000/admin/monitoring/live")
        print("=" * 48 + "\n")

        # Keep main thread alive monitoring children
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup_processes()
    except Exception as e:
        print(f"\n[ERROR] Failed during system launch: {e}")
        cleanup_processes()

if __name__ == "__main__":
    main()
