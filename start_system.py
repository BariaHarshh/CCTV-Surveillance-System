"""
AI Campus Guard - Unified System Master Launcher
Launches all services (Next.js Web App, FastAPI ML Backend, and Multi-Camera AI Pipeline) in a single command.
"""

import os
import sys
import time
import subprocess
import signal

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.join(BASE_DIR, "web")

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Resolve virtualenv python if present to avoid global Python missing modules error
VENV_PYTHON = os.path.join(BASE_DIR, ".venv", "Scripts", "python.exe")
PYTHON_EXEC = VENV_PYTHON if os.path.exists(VENV_PYTHON) else sys.executable

processes = []

def print_banner():
    print("=" * 70)
    print("           [AI CAMPUS GUARD] - MASTER UNIFIED LAUNCHER           ")
    print("=" * 70)
    print("Starting all system services concurrently:")
    print("  1. Next.js Enterprise Web Portal (http://localhost:3000)")
    print("  2. FastAPI ML Integration Server (http://localhost:8000)")
    print("  3. 4-Camera Video Quad Grid AI Surveillance Engine")
    print("-" * 70)

def ensure_web_env():
    """Ensures .env.local exists in AI_Campus_Guardian_Web_app."""
    env_local = os.path.join(WEB_APP_DIR, ".env.local")
    env_example = os.path.join(WEB_APP_DIR, ".env.example")
    if not os.path.exists(env_local) and os.path.exists(env_example):
        print("[INFO] Creating .env.local from .env.example for Web App...")
        with open(env_example, "r", encoding="utf-8") as src, open(env_local, "w", encoding="utf-8") as dst:
            dst.write(src.read())

def ensure_npm_install():
    """Ensures node_modules directory exists."""
    node_modules = os.path.join(WEB_APP_DIR, "node_modules")
    if not os.path.exists(node_modules):
        print("[INFO] Installing Web App npm dependencies (first time setup)...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        subprocess.run(f"{npm_cmd} install", cwd=WEB_APP_DIR, shell=True, check=True)
    else:
        print("[INFO] Web App dependencies already installed.")

import webbrowser

def start_web_app():
    """Starts Next.js server."""
    print("[INFO] Starting Next.js Web Portal on http://localhost:3000...")
    npm_cmd = "npm.cmd run dev" if os.name == "nt" else "npm run dev"
    p = subprocess.Popen(npm_cmd, cwd=WEB_APP_DIR, shell=True)
    processes.append(("Next.js Web App", p))

def open_browser():
    """Automatically opens browser at http://localhost:3000."""
    time.sleep(4)  # Wait for Next.js dev server to start
    print("[INFO] Opening Web Portal in browser: http://localhost:3000...")
    try:
        webbrowser.open("http://localhost:3000")
    except Exception as e:
        print(f"[WARNING] Could not auto-open browser: {e}")

def start_fastapi_backend():
    """Starts FastAPI ML backend server."""
    print("[INFO] Starting FastAPI ML Backend on http://localhost:8000...")
    cmd = [PYTHON_EXEC, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
    p = subprocess.Popen(cmd, cwd=BASE_DIR)
    processes.append(("FastAPI Backend", p))

def start_ai_surveillance():
    """Starts AI Crowd Detection Pipeline (updates stream & sends detections to frontend)."""
    time.sleep(2)  # Short pause to let backend servers bind ports
    print("[INFO] Starting AI Crowd Detection Pipeline...")
    cmd = [PYTHON_EXEC, "app/run_crowd_detection.py"]
    p = subprocess.Popen(cmd, cwd=BASE_DIR)
    processes.append(("AI Surveillance", p))

def cleanup_processes(signum=None, frame=None):
    print("\n[INFO] Gracefully shutting down all AI Campus Guard services...")
    for name, proc in reversed(processes):
        try:
            print(f"  • Stopping {name}...")
            if os.name == "nt":
                subprocess.run(f"taskkill /F /T /PID {proc.pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                proc.terminate()
        except Exception:
            pass
    print("[SUCCESS] All services stopped cleanly.")
    sys.exit(0)

import threading

def main():
    print_banner()
    
    # Register signal handlers for graceful exit (Ctrl+C)
    signal.signal(signal.SIGINT, cleanup_processes)
    signal.signal(signal.SIGTERM, cleanup_processes)

    try:
        ensure_web_env()
        ensure_npm_install()
        
        # 1. Start Web App
        start_web_app()
        
        # 2. Start FastAPI Backend
        start_fastapi_backend()
        
        # 3. Start Multi-Camera AI Engine
        start_ai_surveillance()

        # 4. Auto-open Web App in browser
        threading.Thread(target=open_browser, daemon=True).start()
        
        print("\n" + "=" * 70)
        print("🚀 ALL SERVICES RUNNING SUCCESSFULLY!")
        print("  • Web Portal  : http://localhost:3000")
        print("  • ML API Docs : http://localhost:8000/docs")
        print("  • Press Ctrl+C in this terminal to stop all services.")
        print("=" * 70 + "\n")

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
