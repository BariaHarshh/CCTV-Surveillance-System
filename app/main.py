"""
AI Campus Guard - Main Application Launcher
Runs default surveillance feature runners from app/
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import argparse

def main():
    parser = argparse.ArgumentParser(description="AI Campus Guard - Main Application Launcher")
    parser.add_argument(
        "--feature",
        type=str,
        default="risk",
        choices=["risk", "multi", "crowd", "behavior", "abandoned", "restricted"],
        help="Feature module to launch: 'risk' (Central Risk Assessment), 'multi' (4-Camera Quad Grid), 'crowd', 'behavior', 'abandoned', 'restricted'"
    )
    args, unknown = parser.parse_known_args()

    if args.feature == "multi":
        from app.run_multi_camera import main as run_feature
    elif args.feature == "risk":
        from app.run_risk_management import main as run_feature
    elif args.feature == "behavior":
        from app.run_behavior_detection import main as run_feature
    elif args.feature == "abandoned":
        from app.run_abandoned_object import main as run_feature
    elif args.feature == "restricted":
        from app.run_restricted_area import main as run_feature
    else:
        from app.run_crowd_detection import main as run_feature

    run_feature()

if __name__ == "__main__":
    main()
