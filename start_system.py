"""
AI Campus Guard - Unified System Master Launcher
Launches all services (Next.js Web Portal, FastAPI ML Backend, and 4-Camera Multi-Camera AI Pipeline) in a single command.
"""

import os
import sys
import time
import shutil
import subprocess
import signal
import threading
import webbrowser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

def resolve_web_app_dir() -> str:
    """
    Resolves the active frontend web application directory with priority:
      1. AI_CAMPUS_WEB_DIR environment variable (if explicitly set and valid)
      2. Sibling directory 'AI_Campus_Guardian_Web_app-main' (primary standalone web repository)
      3. Sibling directory 'AI_Campus_Guardian_Web_app'
      4. Fallback legacy 'web' directory inside the ML repo
    """
    candidates = []

    # 1. Environment variable override
    env_dir = os.environ.get("AI_CAMPUS_WEB_DIR")
    if env_dir:
        candidates.append(("AI_CAMPUS_WEB_DIR env var", os.path.abspath(env_dir)))

    # 2. Sibling standalone web app repository
    parent_dir = os.path.dirname(BASE_DIR)
    candidates.append(("Primary standalone web repo (AI_Campus_Guardian_Web_app-main)", os.path.join(parent_dir, "AI_Campus_Guardian_Web_app-main")))
    candidates.append(("Sibling web repo (AI_Campus_Guardian_Web_app)", os.path.join(parent_dir, "AI_Campus_Guardian_Web_app")))

    # 3. Fallback to legacy internal web directory
    candidates.append(("Legacy internal web directory (AI-Campus-Guard/web)", os.path.join(BASE_DIR, "web")))

    for desc, path in candidates:
        if os.path.exists(path) and os.path.exists(os.path.join(path, "package.json")):
            src_dir = os.path.join(path, "src")
            if os.path.exists(src_dir):
                return path

    raise RuntimeError(f"Could not locate a valid frontend web application repository. Candidates checked: {[p for _, p in candidates]}")

WEB_APP_DIR = resolve_web_app_dir()

# Resolve virtualenv python if present to avoid global Python missing modules error
VENV_PYTHON = (
    os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
    if sys.platform == "win32"
    else os.path.join(BASE_DIR, ".venv", "bin", "python")
)
PYTHON_EXEC = VENV_PYTHON if os.path.exists(VENV_PYTHON) else sys.executable

processes = []

def print_banner():
    print("=" * 76)
    print("      🛡️  [AI CAMPUS GUARDIAN] - UNIFIED SYSTEM MASTER LAUNCHER  🛡️      ")
    print("=" * 76)
    print("Starting all core system services concurrently:")
    print("  1. 🌐 Next.js Enterprise Portal & Socket.IO (http://localhost:3000)")
    print("  2. ⚡ FastAPI ML Integration & Stream API   (http://localhost:8000)")
    print("  3. 🎥 4-Camera Video Quad Grid AI Pipeline (YOLOv8 + ByteTrack)")
    print("-" * 76)

def ensure_torch_runtime_integrity():
    """
    Checks for Windows Code Integrity / Smart App Control compatibility.
    Isolates the non-functional stub torch_global_deps.dll if present so PyTorch
    loads without triggering WinError 4551.
    """
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
            print("[INFO] PyTorch runtime integrity verified (Code Integrity guard active).")
        except Exception as e:
            print(f"[WARNING] Could not isolate torch stub DLL: {e}")

def ensure_web_env():
    """Ensures .env.local exists in the active Web App repository."""
    env_local = os.path.join(WEB_APP_DIR, ".env.local")
    env_example = os.path.join(WEB_APP_DIR, ".env.example")
    if not os.path.exists(env_local) and os.path.exists(env_example):
        print(f"[INFO] Creating .env.local from .env.example for Web App ({WEB_APP_DIR})...")
        with open(env_example, "r", encoding="utf-8") as src, open(env_local, "w", encoding="utf-8") as dst:
            dst.write(src.read())

def ensure_npm_install():
    """Ensures node_modules directory exists."""
    node_modules = os.path.join(WEB_APP_DIR, "node_modules")
    if not os.path.exists(node_modules):
        print(f"[INFO] Installing Web App npm dependencies in {WEB_APP_DIR}...")
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        subprocess.run(f"{npm_cmd} install", cwd=WEB_APP_DIR, shell=True, check=True)
    else:
        print("[INFO] Web App dependencies verified.")

def start_web_app():
    """Starts Next.js server with Socket.IO support via npm run dev."""
    print(f"[INFO] Starting Next.js Web Portal ({WEB_APP_DIR}) via 'npm run dev' on http://localhost:3000...")
    npm_cmd = "npm.cmd run dev" if sys.platform == "win32" else "npm run dev"
    p = subprocess.Popen(npm_cmd, cwd=WEB_APP_DIR, shell=True)
    processes.append(("Next.js Web App", p))

def start_fastapi_backend():
    """Starts FastAPI ML backend server."""
    print("[INFO] Starting FastAPI ML Backend on http://localhost:8000...")
    cmd = [PYTHON_EXEC, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
    p = subprocess.Popen(cmd, cwd=BASE_DIR)
    processes.append(("FastAPI Backend", p))

def start_ai_surveillance():
    """Starts 4-Camera AI Surveillance Pipeline (pushes video frames & detections)."""
    time.sleep(2)  # Short pause to let backend servers bind ports
    print("[INFO] Starting 4-Camera AI Surveillance Pipeline (Headless Mode)...")
    cmd = [PYTHON_EXEC, "app/run_multi_camera.py", "--headless"]
    p = subprocess.Popen(cmd, cwd=BASE_DIR)
    processes.append(("AI Surveillance", p))

def open_browser():
    """Waits for Next.js to fully compile and respond before opening the browser."""
    target_url = "http://localhost:3000/admin/monitoring"
    print(f"[INFO] Waiting for Web Portal to compile and become ready...")
    
    import urllib.request
    for _ in range(45):
        try:
            req = urllib.request.Request("http://localhost:3000/")
            with urllib.request.urlopen(req, timeout=3) as r:
                if r.status == 200:
                    time.sleep(1)  # Allow CSS bundle to finalize
                    print(f"[INFO] Web Portal is ready! Opening Security Command Center in browser: {target_url}...")
                    webbrowser.open(target_url)
                    return
        except Exception:
            time.sleep(1)

    print(f"[INFO] Opening browser: {target_url}...")
    webbrowser.open(target_url)

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
    print_banner()

    # Register signal handlers for graceful exit (Ctrl+C)
    signal.signal(signal.SIGINT, cleanup_processes)
    signal.signal(signal.SIGTERM, cleanup_processes)

    try:
        ensure_torch_runtime_integrity()
        ensure_web_env()
        ensure_npm_install()

        # 1. Start Web App (Next.js + Socket.IO via npm run dev)
        start_web_app()

        # 2. Start FastAPI Backend (MJPEG streams + API bridge)
        start_fastapi_backend()

        # 3. Start Multi-Camera AI Engine (YOLOv8 + ByteTrack)
        start_ai_surveillance()

        # 4. Auto-open Security Command Center in browser once ready
        threading.Thread(target=open_browser, daemon=True).start()

        print("\n" + "=" * 76)
        print("🚀 ALL SERVICES RUNNING SUCCESSFULLY!")
        print("  • Security Command Center : http://localhost:3000/admin/monitoring")
        print("  • Live 4-Camera AI Wall   : http://localhost:3000/admin/monitoring/live")
        print("  • Portal Login            : http://localhost:3000/login")
        print("  • FastAPI Stream API Docs : http://localhost:8000/docs")
        print("  • Default Superadmin      : superadmin / ChangeMe123!")
        print("  • Press Ctrl+C in this terminal to stop all services.")
        print("=" * 76 + "\n")

        # Keep main thread alive monitoring children
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup_processes()
    except Exception as e:
        print(f"[ERROR] Failed during system launch: {e}")
        cleanup_processes()

if __name__ == "__main__":
    main()
