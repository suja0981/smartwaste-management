"""
populate_amravati_data.py — Seed the database with demo data for Amravati.

Run this after starting the backend:
  python populate_amravati_data.py

What it does:
  1. Creates 10 bins across Amravati with real coordinates (bin01–bin10)
  2. Creates 3 collection crews (crew4–crew6)
  3. Creates 3 sample tasks referencing Amravati bins
  4. Optimizes and saves 3 demo routes
  5. Sends one telemetry reading per bin
  6. Prints system statistics

Auth for telemetry: set IOT_API_KEY or IOT_BEARER_TOKEN in your environment,
or the telemetry step will be skipped.
"""

import os
import requests
import random

API_BASE = os.getenv("SIM_API_BASE_URL", "http://localhost:8000").rstrip("/")

_API_KEY      = os.getenv("IOT_API_KEY", "")
_BEARER_TOKEN = os.getenv("IOT_BEARER_TOKEN", "")

# Real Amravati landmarks with approximate GPS coordinates
AMRAVATI_LOCATIONS = [
    {"name": "Rajkamal Chowk",        "lat": 20.9374, "lon": 77.7796},
    {"name": "Irwin Square",          "lat": 20.9330, "lon": 77.7820},
    {"name": "Rajapeth Market",       "lat": 20.9411, "lon": 77.7762},
    {"name": "Panchavati Bus Stand",  "lat": 20.9346, "lon": 77.7769},
    {"name": "Gadhav Naka",           "lat": 20.9388, "lon": 77.7834},
    {"name": "Badnera Road",          "lat": 20.9450, "lon": 77.7900},
    {"name": "Cotton Market",         "lat": 20.9310, "lon": 77.7720},
    {"name": "Shukrawar Pete",        "lat": 20.9368, "lon": 77.7740},
    {"name": "Ambapeth",              "lat": 20.9208, "lon": 77.7650},
    {"name": "Stadium Road",          "lat": 20.9425, "lon": 77.7868},
]


def _telemetry_headers() -> dict:
    if _API_KEY:
        return {"X-API-Key": _API_KEY}
    if _BEARER_TOKEN:
        return {"Authorization": f"Bearer {_BEARER_TOKEN}"}
    return {}


def create_bins():
    print("\n--- Creating bins (Amravati) ---")

    bin_capacities = [100, 120, 150, 200]
    created = 0

    for i, location in enumerate(AMRAVATI_LOCATIONS, 1):    # bin01 → bin15
        fill_level = random.randint(20, 98)
        bin_data = {
            "id": f"bin{i:02d}",
            "location": location["name"],
            "capacity_liters": random.choice(bin_capacities),
            "fill_level_percent": fill_level,
            "latitude": location["lat"],
            "longitude": location["lon"],
        }
        try:
            r = requests.post(f"{API_BASE}/bins/", json=bin_data, timeout=5)
            if r.status_code in (201, 409):
                created += 1
                tag = "FULL" if fill_level >= 90 else "WARN" if fill_level >= 80 else "OK  "
                print(f"  [{tag}] {bin_data['id']}: {location['name']} ({fill_level}%)")
            else:
                print(f"  [ERR] {bin_data['id']}: {r.status_code} {r.text[:80]}")
        except Exception as e:
            print(f"  [ERR] {bin_data['id']}: {e}")

    print(f"  Done — {created} bins created/verified")
    return created


def create_crews():
    print("\n--- Creating crews (Amravati) ---")

    crews = [
        {
            "id": "crew1",
            "name": "Delta Team",
            "leader": "Suresh Patil",
            "members_count": 3,
            "phone": "+91-9876543213",
            "email": "delta@amravatiwaste.in",
            "current_latitude": 20.9374,
            "current_longitude": 77.7796,
        },
        {
            "id": "crew2",
            "name": "Epsilon Team",
            "leader": "Meena Deshpande",
            "members_count": 4,
            "phone": "+91-9876543214",
            "email": "epsilon@amravatiwaste.in",
            "current_latitude": 20.9330,
            "current_longitude": 77.7820,
        },
        {
            "id": "crew3",
            "name": "Zeta Team",
            "leader": "Anil Kolte",
            "members_count": 3,
            "phone": "+91-9876543215",
            "email": "zeta@amravatiwaste.in",
            "current_latitude": 20.9450,
            "current_longitude": 77.7900,
        },
    ]

    created = 0
    for crew in crews:
        try:
            r = requests.post(f"{API_BASE}/crews/", json=crew, timeout=5)
            if r.status_code in (201, 409):
                created += 1
                print(f"  {crew['name']} (leader: {crew['leader']})")
            else:
                print(f"  [ERR] {crew['id']}: {r.status_code} {r.text[:80]}")
        except Exception as e:
            print(f"  [ERR] {crew['id']}: {e}")

    print(f"  Done — {created} crews created/verified")
    return created


def create_tasks():
    print("\n--- Creating tasks (Amravati) ---")

    tasks = [
        {
            "id": "task001",
            "title": "Emergency Collection — Rajkamal Chowk",
            "description": "Urgent collection required (fill > 90%)",
            "priority": "high",
            "location": "Rajkamal Chowk",
            "bin_id": "bin01",
            "estimated_time_minutes": 30,
        },
        {
            "id": "task002",
            "title": "Routine Collection — Cotton Market",
            "description": "Scheduled collection for Cotton Market area",
            "priority": "medium",
            "location": "Cotton Market",
            "bin_id": "bin07",
            "estimated_time_minutes": 45,
        },
        {
            "id": "task003",
            "title": "Maintenance Check — Badnera Road",
            "description": "Inspect bin sensors at Badnera Road",
            "priority": "low",
            "location": "Badnera Road",
            "bin_id": "bin06",
            "estimated_time_minutes": 20,
        },
    ]

    created = 0
    for task in tasks:
        try:
            r = requests.post(f"{API_BASE}/tasks/", json=task, timeout=5)
            if r.status_code in (201, 409):
                created += 1
                tag = {"high": "HIGH", "medium": "MED ", "low": "LOW "}[task["priority"]]
                print(f"  [{tag}] {task['title']}")
            else:
                print(f"  [ERR] {task['id']}: {r.status_code} {r.text[:80]}")
        except Exception as e:
            print(f"  [ERR] {task['id']}: {e}")

    print(f"  Done — {created} tasks created/verified")
    return created


def create_sample_routes():
    print("\n--- Creating optimized routes (Amravati) ---")

    scenarios = [
        {
            "name": "Morning Collection — Priority",
            "bins": ["bin01", "bin05", "bin07", "bin02"],
            "crew": "crew1",
            "algorithm": "priority",
        },
        {
            "name": "Afternoon Collection — Hybrid",
            "bins": ["bin02", "bin06", "bin08", "bin04"],
            "crew": "crew2",
            "algorithm": "hybrid",
        },
        {
            "name": "Evening Collection — Two-opt",
            "bins": ["bin03", "bin09", "bin10", "bin04"],
            "crew": "crew3",
            "algorithm": "two_opt",
        },
    ]

    created = 0
    for s in scenarios:
        try:
            r = requests.post(
                f"{API_BASE}/routes/optimize",
                json={
                    "bin_ids": s["bins"],
                    "crew_id": s["crew"],
                    "algorithm": s["algorithm"],
                    "save_route": True,
                },
                timeout=10,
            )
            if r.status_code == 200:
                result = r.json()
                created += 1
                print(
                    f"  {s['name']}\n"
                    f"    algorithm={result['algorithm']}  "
                    f"distance={result['total_distance_km']}km  "
                    f"time={result['estimated_time_minutes']:.0f}min"
                )
            else:
                print(f"  [ERR] {s['name']}: {r.status_code} {r.text[:80]}")
        except Exception as e:
            print(f"  [ERR] {s['name']}: {e}")

    print(f"  Done — {created} routes created")
    return created


def simulate_telemetry():
    print("\n--- Sending telemetry (Amravati bins) ---")

    headers = _telemetry_headers()
    if not headers:
        print(
            "  SKIPPED: no auth credentials.\n"
            "  Set IOT_API_KEY or IOT_BEARER_TOKEN in your environment to enable this step."
        )
        return 0

    sent = 0
    for i in range(1, 11):    # bin01 → bin10
        bin_id = f"bin{i:02d}"
        payload = {
            "bin_id": bin_id,
            "fill_level_percent": random.randint(40, 95),
            "battery_percent": random.randint(60, 100),
            "temperature_c": round(random.uniform(22, 36), 1),
            "humidity_percent": random.randint(40, 80),
        }
        try:
            r = requests.post(
                f"{API_BASE}/telemetry/",
                json=payload,
                headers=headers,
                timeout=5,
            )
            if r.status_code in (200, 202):
                sent += 1
            else:
                print(f"  [ERR] {bin_id}: {r.status_code}")
        except Exception as e:
            print(f"  [ERR] {bin_id}: {e}")

    print(f"  Done — telemetry sent for {sent} bins")
    return sent


def show_statistics():
    print("\n--- System statistics ---")
    try:
        stats = requests.get(f"{API_BASE}/stats/", timeout=5).json()
        print(f"  Total bins:        {stats['total_bins']}")
        print(f"  Bins online:       {stats['bins_online']}")
        print(f"  Bins full:         {stats['bins_full']}")
        print(f"  Bins warning:      {stats['bins_warning']}")
        print(f"  Avg fill level:    {stats['average_fill_level']}%")
    except Exception as e:
        print(f"  [ERR] {e}")


def main():
    print("=" * 62)
    print("  SMART WASTE MANAGEMENT — AMRAVATI DATA POPULATION")
    print("=" * 62)

    try:
        r = requests.get(f"{API_BASE}/health", timeout=5)
        if r.status_code != 200:
            print("\nERROR: Backend server is not responding.")
            return
    except Exception:
        print(f"\nERROR: Cannot connect to {API_BASE}")
        print("Make sure the server is running: uvicorn main:app --reload")
        return

    print(f"\nBackend online at {API_BASE}. Populating Amravati data...\n")

    create_bins()
    create_crews()
    create_tasks()
    create_sample_routes()
    simulate_telemetry()
    show_statistics()

    print("\n" + "=" * 62)
    print("  DONE")
    print("=" * 62)
    print("\nNext steps:")
    print("  1. Browse API docs:        http://localhost:8000/docs")
    print("  2. Start IoT simulation:   python simulate_iot.py --fast")
    print("  3. Seed ML predictions:    POST /predictions/seed")
    print()


if __name__ == "__main__":
    main()
