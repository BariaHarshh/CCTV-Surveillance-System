"""
AI Campus Guard - Main Application Launcher
Runs default surveillance feature runners from app/
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.run_crowd_detection import main as run_crowd_detection

def main():
    # By default, runs the Crowd Detection surveillance module
    run_crowd_detection()

if __name__ == "__main__":
    main()
