"""
seed_ml_history.py — Seed 48 hours of backdated telemetry for 6 Amravati bins.

This script sends historical readings with 1-hour gaps so the ML predictor
can calculate reliable fill rates (MIN_INTERVAL_SECONDS=60 is satisfied).

Run this ONCE before the live simulator to warm up the prediction engine:
  python seed_ml_history.py --email admin@example.com --password Admin@1234

After this script finishes, the predictions page will immediately show
fill rates, hours-until-full, and confidence scores for all bins.

Then start the live simulator for real-time updates:
  python simulate_iot.py --fast --auth-mode jwt --email admin@example.com --password Admin@1234
"""

import argparse
import os
import random
import time
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

API_BASE         = os.getenv("SIM_API_BASE_URL", "http://localhost:8000").rstrip("/")
DEFAULT_EMAIL    = os.getenv("SIM_EMAIL", "")
DEFAULT_PASSWORD = os.getenv("SIM_PASSWORD", "")
DEFAULT_API_KEY  = os.getenv("IOT_API_KEY", "")

# 6 Amravati bins to seed with ML prediction history (high-traffic selection)
BIN_PROFILES = [
    ("bin01", "commercial",   2.5),   # Rajkamal Chowk      — high traffic
    ("bin03", "commercial",   2.0),   # Rajapeth Market
    ("bin05", "commercial",   2.2),   # Gadhav Naka
    ("bin07", "commercial",   2.0),   # Cotton Market
    ("bin08", "residential",  0.9),   # Shukrawar Pete
    ("bin10", "public",       1.6),   # Stadium Road
]

# Hours of backdated history to generate (each hour = 1 reading per bin)
HISTORY_HOURS = 48


def get_auth_headers(session: requests.Session, email: str, password: str, api_key: str) -> dict:
    if api_key:
        print(f"  Auth: X-API-Key")
        return {"X-API-Key": api_key}
    if email and password:
        resp = session.post(f"{API_BASE}/auth/login",
                            json={"email": email, "password": password}, timeout=10)
        resp.raise_for_status()
        token = resp.json()["access_token"]
        print(f"  Auth: JWT login ({email})")
        return {"Authorization": f"Bearer {token}"}
    raise ValueError(
        "No auth credentials. Pass --email + --password or set IOT_API_KEY."
    )


def seed_history(headers: dict, session: requests.Session):
    now = datetime.now(timezone.utc)
    total_sent = 0
    total_errors = 0

    print(f"\n  Seeding {HISTORY_HOURS}h of backdated telemetry for {len(BIN_PROFILES)} bins (6 selected)...")
    print(f"  Total readings: {HISTORY_HOURS * len(BIN_PROFILES)}\n")

    for bin_id, location_type, base_rate in BIN_PROFILES:
        fill = random.uniform(5, 20)   # start low
        print(f"  {bin_id} ({location_type}, rate~{base_rate}%/h):", end=" ", flush=True)

        for hours_ago in range(HISTORY_HOURS, 0, -1):
            point_time = now - timedelta(hours=hours_ago)

            # Time-of-day multiplier
            hour = point_time.hour
            if location_type == "commercial":
                multiplier = 1.5 if 9 <= hour <= 18 else 1.2 if 19 <= hour <= 22 else 0.3
            elif location_type == "residential":
                multiplier = 1.8 if (7 <= hour <= 9 or 18 <= hour <= 22) else 0.5 if 10 <= hour <= 17 else 0.3
            elif location_type == "public":
                multiplier = 1.3 if 8 <= hour <= 20 else 0.4
            else:
                multiplier = 1.0

            fill_increase = base_rate * multiplier * random.uniform(0.7, 1.3)
            fill = min(95, fill + fill_increase)

            # Simulate emptying when nearly full
            if fill >= 90 and random.random() < 0.4:
                fill = random.uniform(5, 15)

            payload = {
                "bin_id": bin_id,
                "fill_level_percent": int(fill),
                "battery_percent": random.randint(65, 100),
                "temperature_c": round(random.uniform(22, 36), 1),
                "humidity_percent": random.randint(40, 80),
                "timestamp": point_time.isoformat(),
            }

            try:
                r = session.post(f"{API_BASE}/telemetry",
                                 json=payload, headers=headers, timeout=5)
                if r.status_code in (200, 202):
                    total_sent += 1
                else:
                    total_errors += 1
            except Exception as e:
                total_errors += 1

        print(f"done (final fill: {int(fill)}%)")
        time.sleep(0.1)   # brief pause between bins

    return total_sent, total_errors


def rebuild_ml(session: requests.Session):
    print("\n  Rebuilding ML models from database...")
    try:
        r = session.post(f"{API_BASE}/predictions/seed", timeout=30)
        if r.status_code == 200:
            data = r.json()
            print(f"  ✅ {data['data_points_loaded']} data points loaded for {data['bins_loaded']} bins")
        else:
            print(f"  ⚠️  seed returned {r.status_code}: {r.text[:100]}")
    except Exception as e:
        print(f"  ❌ Could not reach server: {e}")


def show_prediction_stats(session: requests.Session):
    print("\n  Prediction service stats:")
    try:
        r = session.get(f"{API_BASE}/predictions/stats", timeout=10)
        if r.status_code == 200:
            stats = r.json()["statistics"]
            print(f"    Bins tracked:       {stats['total_bins_tracked']}")
            print(f"    Data points:        {stats['total_data_points']}")
            print(f"    Bins with predictions: {stats['bins_with_predictions']}")
            print(f"    Prediction coverage: {stats['prediction_coverage']}%")
    except Exception as e:
        print(f"  ❌ {e}")


def main():
    parser = argparse.ArgumentParser(description="Seed backdated ML telemetry history")
    parser.add_argument("--email",    default=DEFAULT_EMAIL)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--api-key",  default=DEFAULT_API_KEY)
    parser.add_argument("--base-url", default=API_BASE)
    args = parser.parse_args()

    print("=" * 58)
    print("  ML HISTORY SEEDER — Amravati Bins")
    print("=" * 58)

    session = requests.Session()

    # Check server
    try:
        r = session.get(f"{args.base_url}/health", timeout=5)
        if r.status_code != 200:
            print("ERROR: Backend not healthy")
            return
    except Exception:
        print(f"ERROR: Cannot connect to {args.base_url}")
        print("Start the backend first: uvicorn main:app --reload")
        return

    print(f"\n  Backend online at {args.base_url}")

    try:
        headers = get_auth_headers(session, args.email, args.password, args.api_key)
    except ValueError as e:
        print(f"\nERROR: {e}")
        return

    sent, errors = seed_history(headers, session)

    print(f"\n  Sent: {sent} readings  |  Errors: {errors}")

    rebuild_ml(session)
    show_prediction_stats(session)

    print("\n" + "=" * 58)
    print("  DONE — Predictions are ready")
    print("=" * 58)
    print("\nNow run the live simulator:")
    print("  python simulate_iot.py --fast --auth-mode jwt \\")
    print(f"    --email {args.email or 'admin@example.com'} --password <password>")
    print()


if __name__ == "__main__":
    main()
