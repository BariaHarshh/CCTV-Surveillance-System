"""
AI Campus Guard - Module Launcher for Risk Management Orchestrator
Enables running: python -m features.risk_assessment.run_risk_management
"""

import os
import sys

# Ensure root repository directory is in sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.run_risk_management import main

if __name__ == "__main__":
    main()
