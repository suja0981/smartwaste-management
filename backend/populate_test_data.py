"""
populate_test_data.py — Seed the database with realistic demo data.

Run this after starting the backend to quickly set up a demo environment:
  python populate_test_data.py

What it does:
  1. Creates 15 bins across Nagpur with real coordinates
  2. Creates 3 collection crews
  3. Creates 3 sample tasks
  4. Optimizes and saves 3 demo routes
  5. Sends telemetry for the first 10 bins
  6. Prints a summary of current system stats

NOTE: Telemetry requires auth. Set IOT_API_KEY or IOT_BEARER_TOKEN in your
environment before running, otherwise the telemetry step will be skipped.
"""

import os
import requests
import random

API_BASE = "http://localhost:8000"

# Auth for telemetry (requires X-API-Key or Bearer token)
_API_KEY = os.getenv("IOT_API_KEY", "")
_BEARER_TOKEN = os.getenv("IOT_BEARER_TOKEN", "")

NAGPUR_LOCATIONS = [
    {"name": "Sitabuldi Main Square",  "lat": 21.1497, "lon": 79.0860},
    {"name": "Dharampeth Church Square","lat": 21.1346, "lon": 79.0669},
    {"name": "Sadar Bazaar",           "lat": 21.1520, "lon": 79.0877},
    {"name": "Railway Station",        "lat": 21.1520, "lon": 79.0850},
    {"name": "Civil Lines",            "lat": 21.1575, "lon": 79.0746},
    {"name": "Empress Mall",           "lat": 21.1456, "lon": 79.0883},
    {"name": "Gandhi Sagar Lake",      "lat": 21.1389, "lon": 79.0921},
    {"name": "Futala Lake",            "lat": 21.1261, "lon": 79.0583},
    {"name": "Ambazari Lake",          "lat": 21.1124, "lon": 79.0333},
    {"name": "Kasturchand Park",       "lat": 21.1508, "lon": 79.0904},
    {"name": "Variety Square",         "lat": 21.1469, "lon": 79.0846},
    {"name": "Shankar Nagar Square",   "lat": 21.1175, "lon": 79.0745},
    {"name": "Medical Square",         "lat": 21.1343, "lon": 79.0850},
    {"name": "Congress Nagar",         "lat": 21.1088, "lon": 79.0542},
    {"name": "Mankapur Square",        "lat": 21.1258, "lon": 79.0992},
]


def _telemetry_headers() -> dict:
    if _API_KEY:
        return {"X-API-Key": _API_KEY}
    if _BEARER_TOKEN:
        return {"Authorization": f"Bearer {_BEARER_TOKEN}"}
    return {}


def create_bins():
    print("\n--- Creating bins ---")

    bin_capacities = [100, 120, 150, 200]
    created = 0

    for i, location in enumerate(NAGPUR_LOCATIONS, 1):
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
    print("\n--- Creating crews ---")

    crews = [
        {
            "id": "crew1",
            "name": "Alpha Team",
            "leader": "Rajesh Kumar",
            "members_count": 3,
            "phone": "+91-9876543210",
            "email": "alpha@nagpurwaste.in",
            "current_latitude": 21.1458,
            "current_longitude": 79.0882,
        },
        {
            "id": "crew2",
            "name": "Beta Team",
            "leader": "Priya Sharma",
            "members_count": 4,
            "phone": "+91-9876543211",
            "email": "beta@nagpurwaste.in",
            "current_latitude": 21.1346,
            "current_longitude": 79.0669,
        },
        {
            "id": "crew3",
            "name": "Gamma Team",
            "leader": "Amit Deshmukh",
            "members_count": 3,
            "phone": "+91-9876543212",
            "email": "gamma@nagpurwaste.in",
            "current_latitude": 21.1520,
            "current_longitude": 79.0850,
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
                print(f"  [ERR] {crew['id']}: {r.status_code}")
        except Exception as e:
            print(f"  [ERR] {crew['id']}: {e}")

    print(f"  Done — {created} crews created/verified")
    return created


def create_tasks():
    print("\n--- Creating tasks ---")

    tasks = [
        {
            "id": "task001",
            "title": "Emergency Collection — High Fill",
            "description": "Urgent collection required at Sitabuldi (fill > 90%)",
            "priority": "high",
            "location": "Sitabuldi Main Square",
            "bin_id": "bin01",
            "estimated_time_minutes": 30,
        },
        {
            "id": "task002",
            "title": "Routine Collection — Commercial Area",
            "description": "Scheduled collection for Sadar Bazaar",
            "priority": "medium",
            "location": "Sadar Bazaar",
            "bin_id": "bin03",
            "estimated_time_minutes": 45,
        },
        {
            "id": "task003",
            "title": "Maintenance Check — Sensor Issue",
            "description": "Inspect bin sensors at Railway Station",
            "priority": "low",
            "location": "Railway Station",
            "bin_id": "bin04",
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
                print(f"  [ERR] {task['id']}: {r.status_code}")
        except Exception as e:
            print(f"  [ERR] {task['id']}: {e}")

    print(f"  Done — {created} tasks created/verified")
    return created


def create_sample_routes():
    print("\n--- Creating optimized routes ---")

    scenarios = [
        {
            "name": "Morning Collection — Priority",
            "bins": ["bin01", "bin05", "bin08", "bin12"],
            "crew": "crew1",
            "algorithm": "priority",
        },
        {
            "name": "Afternoon Collection — Hybrid",
            "bins": ["bin02", "bin06", "bin09", "bin13"],
            "crew": "crew2",
            "algorithm": "hybrid",
        },
        {
            "name": "Evening Collection — Two-opt",
            "bins": ["bin03", "bin07", "bin10", "bin14"],
            "crew": "crew3",
            "algorithm": "two_opt",
        },
    ]

    created = 0
    for s in scenarios:
        try:
            r = requests.post(
                f"{API_BASE}/routes/optimize",
                json={"bin_ids": s["bins"], "crew_id": s["crew"],
                      "algorithm": s["algorithm"], "save_route": True},
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
                print(f"  [ERR] {s['name']}: {r.status_code}")
        except Exception as e:
            print(f"  [ERR] {s['name']}: {e}")

    print(f"  Done — {created} routes created")
    return created


def simulate_telemetry():
    print("\n--- Sending telemetry ---")

    headers = _telemetry_headers()
    if not headers:
        print(
            "  SKIPPED: no auth credentials.\n"
            "  Set IOT_API_KEY=wsk_live_... in your environment to enable this step."
        )
        return 0

    sent = 0
    for i in range(1, 11):
        bin_id = f"bin{i:02d}"
        payload = {
            "bin_id": bin_id,
            "fill_level_percent": random.randint(40, 95),
            "battery_percent": random.randint(60, 100),
            "temperature_c": round(random.uniform(20, 35), 1),
            "humidity_percent": random.randint(40, 80),
        }
        try:
            r = requests.post(f"{API_BASE}/telemetry/", json=payload,
                              headers=headers, timeout=5)
            if r.status_code == 202:
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
        # Correct path: /stats/ not /stats/stats
        stats = requests.get(f"{API_BASE}/stats/", timeout=5).json()
        print(f"  Total bins:        {stats['total_bins']}")
        print(f"  Bins online:       {stats['bins_online']}")
        print(f"  Bins full:         {stats['bins_full']}")
        print(f"  Bins warning:      {stats['bins_warning']}")
        print(f"  Avg fill level:    {stats['average_fill_level']}%")

        route_stats = requests.get(
            f"{API_BASE}/routes/analytics/performance", timeout=5
        ).json()
        if route_stats["total_routes_completed"] > 0:
            print(f"  Routes completed:  {route_stats['total_routes_completed']}")
            print(f"  Total distance:    {route_stats['total_distance_km']} km")
            print(f"  Avg efficiency:    {route_stats['average_efficiency']:.3f} bins/km")
    except Exception as e:
        print(f"  [ERR] {e}")


def main():
    print("=" * 62)
    print("  SMART WASTE MANAGEMENT — TEST DATA POPULATION")
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

    print("\nBackend server is online. Populating database...\n")

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
    print("  1. Browse API docs:       http://localhost:8000/docs")
    print("  2. Test route optimizer:  python test_routes.py")
    print("  3. Start IoT simulation:  python simulate_iot.py --fast")
    print()


if __name__ == "__main__":
    main()