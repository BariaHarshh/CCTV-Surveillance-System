"""
Project Setup Script
Creates necessary directories and verifies environment setup.
"""

import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DIRECTORIES = [
    os.path.join(BASE_DIR, "models"),
    os.path.join(BASE_DIR, "videos", "input"),
    os.path.join(BASE_DIR, "videos", "stock"),
    os.path.join(BASE_DIR, "docs"),
    os.path.join(BASE_DIR, "config", "presets"),
]

def main():
    print("[INFO] Setting up AI Campus Guard directory structure...")
    for directory in DIRECTORIES:
        os.makedirs(directory, exist_ok=True)
        print(f"  [OK] {os.path.relpath(directory, BASE_DIR)}")

    print("\n[INFO] AI Campus Guard directory setup complete.")

if __name__ == "__main__":
    main()
