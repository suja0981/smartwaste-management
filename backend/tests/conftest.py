"""
Pytest configuration file for backend tests
"""

import pytest
from pathlib import Path
import sys
import os

# Ensure app boots in test mode (disables middleware behavior that causes flaky tests)
os.environ.setdefault("ENVIRONMENT", "test")

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))
