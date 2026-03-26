"""
Pytest configuration file for backend tests
"""

import pytest
from pathlib import Path
import sys

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))
