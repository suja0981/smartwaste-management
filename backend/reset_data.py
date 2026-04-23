"""
One-shot data reset script.

Clears all bins, telemetry, prediction-generated tasks, routes, and route
history, then resets the in-memory ML models via the running server's
/predictions/seed endpoint.

Usage:
    python reset_data.py

The backend server must be running at http://localhost:8000.
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

# ── DB reset ─────────────────────────────────────────────────────────────────

from sqlalchemy import create_engine, text

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

print("Connecting to database...")

with engine.begin() as conn:
    # Delete in dependency order so foreign-key constraints are satisfied.
    # route_history → routes; tasks reference bins (SET NULL on delete, safe either way)
    tables = [
        "route_history",
        "routes",
        "telemetry",
        "tasks",
        "bins",
    ]
    for table in tables:
        result = conn.execute(text(f"DELETE FROM {table}"))
        print(f"  Cleared {table:<20} — {result.rowcount} rows deleted")

print("\nDatabase cleared.")

# ── In-memory ML reset ───────────────────────────────────────────────────────

import requests

BASE_URL = "http://localhost:8000"

print("\nResetting in-memory ML models via running server...")
try:
    # /predictions/seed with nothing in DB resets all in-memory structures to empty
    resp = requests.post(f"{BASE_URL}/predictions/seed", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        print(f"  ML models reset — {data.get('data_points_loaded', 0)} data points, "
              f"{data.get('bins_loaded', 0)} bins in memory")
    else:
        print(f"  WARNING: seed endpoint returned {resp.status_code}: {resp.text}")
        print("  Restart the backend server to clear in-memory ML state.")
except requests.ConnectionError:
    print("  WARNING: Could not reach server at http://localhost:8000")
    print("  Restart the backend server to clear in-memory ML state.")

print("\nDone. You can now re-create bins and run the IoT simulator to generate fresh data.")
