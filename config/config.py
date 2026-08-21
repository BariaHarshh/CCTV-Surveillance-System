"""
Global Configuration Module for AI Campus Guard
Loads default settings and optional YAML configuration presets.
"""

import os
import yaml

# Base Directory Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "models")
VIDEOS_DIR = os.path.join(BASE_DIR, "videos")
PRESETS_DIR = os.path.join(os.path.dirname(__file__), "presets")

# Default Configuration Values
MODEL_PATH = os.path.join(MODELS_DIR, "yolov8n.pt")
VIDEO_PATH = os.path.join(VIDEOS_DIR, "stock", "sample.mp4")
OUTPUT_PATH = None

# Detection & Tracking Settings
CONFIDENCE_THRESHOLD = 0.35
TRACKER_TYPE = "bytetrack.yaml"

# Stabilization & Smoothing Settings
COUNT_SMOOTHING_WINDOW = 15
COUNT_DROP_CONFIRMATION_SECONDS = 1.0

# Crowd Detection Settings
PERSON_THRESHOLD = 10
PERSISTENCE_SECONDS = 3.0

def load_preset(preset_name="crowd_detection.yaml"):
    """
    Loads configuration settings from a YAML preset file in config/presets/.
    """
    global MODEL_PATH, VIDEO_PATH, OUTPUT_PATH
    global CONFIDENCE_THRESHOLD, TRACKER_TYPE
    global COUNT_SMOOTHING_WINDOW, COUNT_DROP_CONFIRMATION_SECONDS
    global PERSON_THRESHOLD, PERSISTENCE_SECONDS

    preset_path = os.path.join(PRESETS_DIR, preset_name)
    if not os.path.exists(preset_path):
        print(f"[WARNING] Preset '{preset_name}' not found at {preset_path}. Using default configurations.")
        return

    try:
        with open(preset_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

        if "model_path" in data and data["model_path"]:
            MODEL_PATH = os.path.join(BASE_DIR, data["model_path"]) if not os.path.isabs(data["model_path"]) else data["model_path"]
        if "video_path" in data and data["video_path"]:
            VIDEO_PATH = os.path.join(BASE_DIR, data["video_path"]) if not os.path.isabs(data["video_path"]) else data["video_path"]
        if "output_path" in data and data["output_path"]:
            OUTPUT_PATH = os.path.join(BASE_DIR, data["output_path"]) if not os.path.isabs(data["output_path"]) else data["output_path"]

        CONFIDENCE_THRESHOLD = data.get("confidence_threshold", CONFIDENCE_THRESHOLD)
        TRACKER_TYPE = data.get("tracker_type", TRACKER_TYPE)
        COUNT_SMOOTHING_WINDOW = data.get("count_smoothing_window", COUNT_SMOOTHING_WINDOW)
        COUNT_DROP_CONFIRMATION_SECONDS = data.get("count_drop_confirmation_seconds", COUNT_DROP_CONFIRMATION_SECONDS)
        PERSON_THRESHOLD = data.get("person_threshold", PERSON_THRESHOLD)
        PERSISTENCE_SECONDS = data.get("persistence_seconds", PERSISTENCE_SECONDS)

        print(f"[INFO] Loaded configuration preset: '{preset_name}'")
    except Exception as e:
        print(f"[ERROR] Failed to load preset '{preset_name}': {e}")
