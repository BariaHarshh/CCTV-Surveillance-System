"""
AI Campus Guard - Multi-Camera Surveillance Dashboard Runner
Launches the 4-CCTV Camera 2x2 Video Quad Grid Master Surveillance Dashboard.
"""

import os
import sys

# Ensure root directory is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.run_risk_management import main as run_master

def main():
    # Inject --multi-cam argument into sys.argv if not present
    if "--multi-cam" not in sys.argv:
        sys.argv.append("--multi-cam")
    run_master()

if __name__ == "__main__":
    main()
