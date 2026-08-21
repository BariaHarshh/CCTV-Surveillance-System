"""
Model Downloader Utility
Downloads required YOLO weights into the models/ directory if not already present.
"""

import os
import urllib.request

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")
YOLO8N_PATH = os.path.join(MODELS_DIR, "yolov8n.pt")
YOLO8N_URL = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.pt"

def download_yolov8n():
    os.makedirs(MODELS_DIR, exist_ok=True)
    if os.path.exists(YOLO8N_PATH):
        print(f"[INFO] Model already exists at: {YOLO8N_PATH}")
        return

    print(f"[INFO] Downloading YOLOv8n model from {YOLO8N_URL}...")
    try:
        urllib.request.urlretrieve(YOLO8N_URL, YOLO8N_PATH)
        print(f"[SUCCESS] Downloaded YOLOv8n model to {YOLO8N_PATH}")
    except Exception as e:
        print(f"[ERROR] Failed to download model: {e}")

if __name__ == "__main__":
    download_yolov8n()
