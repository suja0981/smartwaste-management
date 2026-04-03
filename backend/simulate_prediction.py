"""
Test script for ML Prediction features.
Simulates historical data and tests all ML endpoints.

FIXES:
  1. simulate_historical_data now sends telemetry with explicit backdated
     timestamps so the ML predictor can calculate real fill rates (previously
     all timestamps were _now(), making every delta ~0 → no fill rate).
  2. After seeding, calls POST /predictions/seed to rebuild in-memory ML
     state from the DB (replaces manual /predictions/train which ran
     asynchronously and wasn't awaited).
  3. Telemetry URL changed from /telemetry/ → /telemetry (no trailing slash).
"""

import requests
import time
from datetime import datetime, timedelta, timezone
import random

API_BASE = "http://localhost:8000"


def print_header(text):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)


def print_success(text):
    print(f"✅ {text}")


def print_info(text):
    print(f"ℹ️  {text}")


def print_error(text):
    print(f"❌ {text}")


# ─── Data seeding ─────────────────────────────────────────────────────────────

def simulate_historical_data():
    """
    Seed 48 h of historical telemetry for 5 bins.

    KEY FIX: every payload now includes an explicit ISO-8601 `timestamp`
    field (backdated by `hours_ago`).  Without this, every data point
    lands at _now() and time-deltas ≈ 0, so fill_rate is always None.
    """
    print_header("Simulating Historical Data")

    bins = ["bin01", "bin02", "bin03", "bin04", "bin05"]
    now = datetime.now(timezone.utc)

    print_info("Generating 48 hours of historical telemetry data...")

    success_count = 0
    error_count = 0

    for hours_ago in range(48, 0, -1):
        point_time = now - timedelta(hours=hours_ago)

        for bin_id in bins:
            # Gradual fill increase simulating realistic usage
            base_fill = 20
            fill_increase = (48 - hours_ago) * random.uniform(1.2, 1.8)
            fill_level = min(95, int(base_fill + fill_increase))

            telemetry = {
                "bin_id": bin_id,
                "fill_level_percent": fill_level,
                "battery_percent": random.randint(70, 100),
                "temperature_c": round(random.uniform(20, 32), 1),
                "humidity_percent": random.randint(40, 75),
                # FIX: pass explicit timestamp so ML predictor gets real deltas
                "timestamp": point_time.isoformat(),
            }

            try:
                response = requests.post(
                    f"{API_BASE}/telemetry",   # FIX: removed trailing slash
                    json=telemetry,
                    timeout=5,
                )
                if response.status_code in (200, 202):
                    success_count += 1
                    if hours_ago % 12 == 0:
                        print(f"  📊 {bin_id}: {hours_ago}h ago "
                              f"→ {fill_level}%  [{point_time.strftime('%H:%M')}]")
                else:
                    error_count += 1
            except Exception as e:
                error_count += 1
                print_error(f"Telemetry send error: {e}")

        # Small delay to avoid hammering the server
        time.sleep(0.05)

    print_success(
        f"Telemetry seeding complete — {success_count} accepted, "
        f"{error_count} errors"
    )

    # FIX: Rebuild in-memory ML models from the data we just persisted.
    # Without this call the ML service's historical_data dict is empty
    # because it only holds data ingested since the last server start.
    print_info("Rebuilding ML models from database...")
    try:
        resp = requests.post(f"{API_BASE}/predictions/seed", timeout=30)
        if resp.status_code == 200:
            result = resp.json()
            print_success(
                f"ML models rebuilt — {result.get('data_points_loaded', '?')} "
                f"data points loaded for {result.get('bins_loaded', '?')} bins"
            )
        else:
            print_error(f"Seed endpoint returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print_error(f"Could not reach seed endpoint: {e}")
        print_info("Falling back to /predictions/train (async)...")
        try:
            requests.post(f"{API_BASE}/predictions/train", timeout=10)
            time.sleep(3)   # give the background task time to complete
        except Exception:
            pass


# ─── Individual tests ─────────────────────────────────────────────────────────

def test_fill_prediction():
    print_header("Testing Fill Time Prediction")

    for bin_id in ["bin01", "bin02", "bin03"]:
        try:
            response = requests.get(
                f"{API_BASE}/predictions/predict/{bin_id}", timeout=10
            )
            if response.status_code == 200:
                pred = response.json()
                print_success(f"Prediction for {bin_id}:")
                print(f"   Current Fill  : {pred['current_fill']}%")
                print(f"   Fill Rate     : {pred['fill_rate_per_hour']:.2f}%/h")
                print(f"   Hours to Full : {pred['hours_until_full']:.1f} h")
                print(f"   Full at       : {pred['predicted_full_time']}")
                print(f"   Confidence    : {pred['confidence']:.0%}")
            elif response.status_code == 400:
                print_info(f"{bin_id}: insufficient data — {response.json().get('detail')}")
            else:
                print_error(f"Prediction failed for {bin_id}: {response.status_code}")
        except Exception as e:
            print_error(f"Request error: {e}")


def test_anomaly_detection():
    print_header("Testing Anomaly Detection")

    # Build a stable baseline first
    for i in range(10):
        requests.post(
            f"{API_BASE}/telemetry",
            json={
                "bin_id": "bin01",
                "fill_level_percent": 50 + i,
                "battery_percent": 85,
                "temperature_c": 25.0,
                "humidity_percent": 65,
            },
            timeout=5,
        )

    time.sleep(0.5)

    # Now send clearly anomalous readings
    requests.post(
        f"{API_BASE}/telemetry",
        json={
            "bin_id": "bin01",
            "fill_level_percent": 99,   # sudden jump
            "battery_percent": 5,        # critically low
            "temperature_c": 55.0,       # far above baseline
            "humidity_percent": 98,      # far above baseline
        },
        timeout=5,
    )

    time.sleep(0.5)

    try:
        response = requests.get(
            f"{API_BASE}/predictions/anomalies/bin01", timeout=10
        )
        if response.status_code == 200:
            anomalies = response.json()
            if anomalies:
                print_success(f"Detected {len(anomalies)} anomalies:")
                for a in anomalies:
                    emoji = "🔴" if a["severity"] == "high" else "🟡"
                    print(f"   {emoji} {a['metric']}: {a['current_value']}  "
                          f"(expected {a['expected_range']}, z={a['z_score']})")
            else:
                print_info("No anomalies detected — baseline may need more points")
        else:
            print_error(f"Anomaly detection failed: {response.status_code}")
    except Exception as e:
        print_error(f"Request error: {e}")


def test_comprehensive_analysis():
    print_header("Testing Comprehensive Bin Analysis")

    try:
        response = requests.get(
            f"{API_BASE}/predictions/analyze/bin01", timeout=10
        )
        if response.status_code == 200:
            analysis = response.json()
            print_success("Comprehensive analysis retrieved!")

            print("\n📊 PREDICTION:")
            if analysis["prediction"]:
                p = analysis["prediction"]
                print(f"   Fill rate       : {p.get('fill_rate_per_hour', 'N/A')}%/h")
                print(f"   Hours to full   : {p.get('hours_until_full', 'N/A')} h")
                print(f"   Confidence      : {p.get('confidence', 0):.0%}")
                print(f"   Data points used: {p.get('data_points_used', 0)}")
            else:
                print("   No prediction available (need more data)")

            print("\n⚠️  ANOMALIES:")
            if analysis["anomalies"]:
                for a in analysis["anomalies"]:
                    print(f"   - {a['metric']}: {a['severity']}")
            else:
                print("   None detected")

            print("\n🗑️  COLLECTION RECOMMENDATION:")
            rec = analysis["collection_recommendation"]
            emojis = {"high": "🔴", "medium": "🟡", "low": "🟢"}
            print(f"   {emojis.get(rec['urgency'], '⚪')} {rec['urgency'].upper()}")
            print(f"   Should collect    : {rec['should_collect']}")
            print(f"   Reason            : {rec['reason']}")
            print(f"   Recommended time  : {rec['recommended_time']}")
        else:
            print_error(f"Analysis failed: {response.status_code} — {response.text}")
    except Exception as e:
        print_error(f"Request error: {e}")


def test_collection_optimization():
    print_header("Testing Collection Route Optimization")

    try:
        response = requests.get(
            f"{API_BASE}/predictions/collection/optimize", timeout=10
        )
        if response.status_code == 200:
            order = response.json()
            print_success("Optimized collection order:")
            for i, bin_id in enumerate(order[:10], 1):
                print(f"   {i:2d}. {bin_id}")
        else:
            print_error(f"Optimization failed: {response.status_code}")
    except Exception as e:
        print_error(f"Request error: {e}")


def test_usage_patterns():
    print_header("Testing Usage Pattern Analysis")

    try:
        response = requests.get(
            f"{API_BASE}/predictions/patterns/bin01", timeout=10
        )
        if response.status_code == 200:
            result = response.json()
            print_success("Usage pattern retrieved!")
            print("\n🕐 PEAK HOURS:")
            for hour, rate in result.get("peak_hours", []):
                print(f"   {int(hour):02d}:00  {rate:.2f}%/h")
        elif response.status_code == 400:
            print_info(
                "Insufficient data for pattern analysis "
                f"— {response.json().get('detail')}"
            )
        else:
            print_error(f"Pattern endpoint returned: {response.status_code}")
    except Exception as e:
        print_error(f"Request error: {e}")


def test_predicted_alerts():
    print_header("Testing Predicted Alerts")

    try:
        response = requests.get(
            f"{API_BASE}/predictions/alerts/predicted?hours_ahead=24",
            timeout=10,
        )
        if response.status_code == 200:
            result = response.json()
            print_success(
                f"Found {result['alerts_count']} predicted alerts in next 24 h:"
            )
            for alert in result["alerts"]:
                emoji = "🔴" if alert["urgency"] == "high" else "🟡"
                print(f"\n   {emoji} {alert['bin_id']}  —  {alert['location']}")
                print(f"      Current  : {alert['current_fill']}%")
                print(f"      Full in  : {alert['hours_until_full']:.1f} h")
                print(f"      Time     : {alert['predicted_time']}")
        else:
            print_error(
                f"Failed to get predicted alerts: {response.status_code}"
            )
    except Exception as e:
        print_error(f"Request error: {e}")


def test_ml_statistics():
    print_header("ML Service Statistics")

    try:
        response = requests.get(f"{API_BASE}/predictions/stats", timeout=10)
        if response.status_code == 200:
            stats = response.json()
            print_success(f"ML Service Status: {stats['status']}")

            s = stats["statistics"]
            print(f"\n📈 STATISTICS:")
            print(f"   Bins tracked         : {s['total_bins_tracked']}")
            print(f"   Data points          : {s['total_data_points']}")
            print(f"   Bins with predictions: {s['bins_with_predictions']}")
            print(f"   Coverage             : {s['prediction_coverage']}%")

            print(f"\n🤖 MODELS:")
            for model, status in stats["models"].items():
                print(f"   {model}: {status}")
        else:
            print_error(f"Failed to get statistics: {response.status_code}")
    except Exception as e:
        print_error(f"Request error: {e}")


# ─── Runner ───────────────────────────────────────────────────────────────────

def main():
    print("\n")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║     SMART WASTE MANAGEMENT — ML PREDICTION TESTS          ║")
    print("╚════════════════════════════════════════════════════════════╝")

    # Verify backend is reachable
    try:
        resp = requests.get(f"{API_BASE}/health", timeout=5)
        if resp.status_code != 200:
            print_error("Backend server is not healthy!")
            return
    except Exception:
        print_error("Cannot connect to backend server!")
        print_info(f"Make sure the server is running at {API_BASE}")
        return

    print_success("Backend server is reachable!\n")

    # Seed data, then run tests
    simulate_historical_data()
    time.sleep(1)

    test_ml_statistics()          # sanity-check data was loaded
    time.sleep(0.5)

    test_fill_prediction()
    time.sleep(0.5)

    test_comprehensive_analysis()
    time.sleep(0.5)

    test_anomaly_detection()
    time.sleep(0.5)

    test_collection_optimization()
    time.sleep(0.5)

    test_usage_patterns()
    time.sleep(0.5)

    test_predicted_alerts()

    print_header("Tests Completed!")
    print_success("All ML prediction features exercised! 🎉\n")


if __name__ == "__main__":
    main()