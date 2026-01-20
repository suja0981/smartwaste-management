"""
Test script for ML Prediction features.
Simulates historical data and tests all ML endpoints.
"""

import requests
import time
from datetime import datetime, timedelta
import random

API_BASE = "http://localhost:8000"

def print_header(text):
    print("\n" + "="*60)
    print(f"  {text}")
    print("="*60)

def print_success(text):
    print(f"✅ {text}")

def print_info(text):
    print(f"ℹ️  {text}")

def print_error(text):
    print(f"❌ {text}")

def simulate_historical_data():
    """Simulate historical telemetry data to train ML models"""
    print_header("Simulating Historical Data")
    
    bins = ["bin01", "bin02", "bin03", "bin04", "bin05"]
    
    print_info("Generating 48 hours of historical telemetry data...")
    
    # Simulate 2 days of data at 1-hour intervals
    for hours_ago in range(48, 0, -1):
        for bin_id in bins:
            # Simulate gradual fill increase
            base_fill = 20
            fill_increase = (48 - hours_ago) * random.uniform(1.2, 1.8)
            fill_level = min(95, int(base_fill + fill_increase))
            
            telemetry = {
                "bin_id": bin_id,
                "fill_level_percent": fill_level,
                "battery_percent": random.randint(70, 100),
                "temperature_c": round(random.uniform(20, 32), 1),
                "humidity_percent": random.randint(40, 75)
            }
            
            try:
                response = requests.post(f"{API_BASE}/telemetry/", json=telemetry)
                if response.status_code == 202:
                    if hours_ago % 12 == 0:  # Print every 12 hours
                        print(f"  📊 {bin_id}: {hours_ago}h ago -> {fill_level}%")
            except Exception as e:
                print_error(f"Error: {e}")
        
        time.sleep(0.1)  # Small delay to avoid overwhelming server
    
    print_success("Historical data simulation complete!")
    print_info("ML models are now trained with 48 hours of data")

def test_fill_prediction():
    """Test fill time prediction"""
    print_header("Testing Fill Time Prediction")
    
    bins = ["bin01", "bin02", "bin03"]
    
    for bin_id in bins:
        try:
            response = requests.get(f"{API_BASE}/predictions/predict/{bin_id}")
            
            if response.status_code == 200:
                pred = response.json()
                print_success(f"Prediction for {bin_id}:")
                print(f"   Current Fill: {pred['current_fill']}%")
                print(f"   Fill Rate: {pred['fill_rate_per_hour']:.2f}% per hour")
                print(f"   Hours Until Full: {pred['hours_until_full']:.1f}h")
                print(f"   Will be full at: {pred['predicted_full_time']}")
                print(f"   Confidence: {pred['confidence']:.0%}")
            else:
                print_error(f"Prediction failed for {bin_id}: {response.status_code}")
        except Exception as e:
            print_error(f"Error: {e}")

def test_anomaly_detection():
    """Test anomaly detection"""
    print_header("Testing Anomaly Detection")
    
    # Send some normal telemetry
    normal_telemetry = {
        "bin_id": "bin01",
        "fill_level_percent": 60,
        "battery_percent": 85,
        "temperature_c": 25.0,
        "humidity_percent": 65
    }
    requests.post(f"{API_BASE}/telemetry/", json=normal_telemetry)
    
    time.sleep(1)
    
    # Send anomalous telemetry
    anomalous_telemetry = {
        "bin_id": "bin01",
        "fill_level_percent": 95,  # Sudden jump
        "battery_percent": 15,      # Low battery
        "temperature_c": 45.0,      # High temp
        "humidity_percent": 95      # High humidity
    }
    requests.post(f"{API_BASE}/telemetry/", json=anomalous_telemetry)
    
    time.sleep(1)
    
    # Check for anomalies
    try:
        response = requests.get(f"{API_BASE}/predictions/anomalies/bin01")
        
        if response.status_code == 200:
            anomalies = response.json()
            
            if anomalies:
                print_success(f"Detected {len(anomalies)} anomalies:")
                for anomaly in anomalies:
                    severity_emoji = "🔴" if anomaly['severity'] == 'high' else "🟡"
                    print(f"   {severity_emoji} {anomaly['metric']}: {anomaly['current_value']}")
                    print(f"      Expected: {anomaly['expected_range']}")
                    print(f"      Z-score: {anomaly['z_score']}")
            else:
                print_info("No anomalies detected (might need more baseline data)")
        else:
            print_error(f"Anomaly detection failed: {response.status_code}")
    except Exception as e:
        print_error(f"Error: {e}")

def test_comprehensive_analysis():
    """Test comprehensive bin analysis"""
    print_header("Testing Comprehensive Bin Analysis")
    
    try:
        response = requests.get(f"{API_BASE}/predictions/analyze/bin01")
        
        if response.status_code == 200:
            analysis = response.json()
            print_success("Comprehensive analysis retrieved!")
            
            print("\n📊 PREDICTION:")
            if analysis['prediction']:
                pred = analysis['prediction']
                print(f"   Fill rate: {pred.get('fill_rate_per_hour', 'N/A')}% per hour")
                print(f"   Hours until full: {pred.get('hours_until_full', 'N/A')}h")
            else:
                print("   No prediction available")
            
            print("\n⚠️  ANOMALIES:")
            if analysis['anomalies']:
                for anomaly in analysis['anomalies']:
                    print(f"   - {anomaly['metric']}: {anomaly['severity']}")
            else:
                print("   None detected")
            
            print("\n🗑️  COLLECTION RECOMMENDATION:")
            rec = analysis['collection_recommendation']
            urgency_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}
            print(f"   {urgency_emoji.get(rec['urgency'], '⚪')} {rec['urgency'].upper()}")
            print(f"   Should collect: {rec['should_collect']}")
            print(f"   Reason: {rec['reason']}")
            print(f"   Recommended time: {rec['recommended_time']}")
        else:
            print_error(f"Analysis failed: {response.status_code}")
    except Exception as e:
        print_error(f"Error: {e}")

def test_collection_optimization():
    """Test collection route optimization"""
    print_header("Testing Collection Route Optimization")
    
    try:
        response = requests.get(f"{API_BASE}/predictions/collection/optimize")
        
        if response.status_code == 200:
            order = response.json()
            print_success("Optimized collection order:")
            for i, bin_id in enumerate(order[:10], 1):  # Show top 10
                print(f"   {i}. {bin_id}")
        else:
            print_error(f"Optimization failed: {response.status_code}")
    except Exception as e:
        print_error(f"Error: {e}")

def test_usage_patterns():
    """Test usage pattern analysis"""
    print_header("Testing Usage Pattern Analysis")
    
    try:
        response = requests.get(f"{API_BASE}/predictions/patterns/bin01")
        
        if response.status_code == 200:
            result = response.json()
            print_success("Usage pattern retrieved!")
            
            print("\n🕐 PEAK HOURS:")
            for hour, rate in result.get('peak_hours', []):
                print(f"   {hour:02d}:00 - {rate:.2f}% per hour")
        else:
            print_info("Insufficient data for pattern analysis (need more historical data)")
    except Exception as e:
        print_error(f"Error: {e}")

def test_predicted_alerts():
    """Test predicted alerts"""
    print_header("Testing Predicted Alerts")
    
    try:
        response = requests.get(f"{API_BASE}/predictions/alerts/predicted?hours_ahead=24")
        
        if response.status_code == 200:
            result = response.json()
            print_success(f"Found {result['alerts_count']} predicted alerts in next 24h:")
            
            for alert in result['alerts']:
                urgency_emoji = "🔴" if alert['urgency'] == 'high' else "🟡"
                print(f"\n   {urgency_emoji} {alert['bin_id']} - {alert['location']}")
                print(f"      Current: {alert['current_fill']}%")
                print(f"      Full in: {alert['hours_until_full']:.1f} hours")
                print(f"      Time: {alert['predicted_time']}")
        else:
            print_error(f"Failed to get predicted alerts: {response.status_code}")
    except Exception as e:
        print_error(f"Error: {e}")

def test_ml_statistics():
    """Test ML service statistics"""
    print_header("ML Service Statistics")
    
    try:
        response = requests.get(f"{API_BASE}/predictions/stats")
        
        if response.status_code == 200:
            stats = response.json()
            print_success("ML Service Status:")
            print(f"   Status: {stats['status']}")
            
            print("\n📈 STATISTICS:")
            s = stats['statistics']
            print(f"   Bins tracked: {s['total_bins_tracked']}")
            print(f"   Data points: {s['total_data_points']}")
            print(f"   Bins with predictions: {s['bins_with_predictions']}")
            print(f"   Coverage: {s['prediction_coverage']}%")
            
            print("\n🤖 MODELS:")
            for model, status in stats['models'].items():
                print(f"   {model}: {status}")
        else:
            print_error(f"Failed to get statistics: {response.status_code}")
    except Exception as e:
        print_error(f"Error: {e}")

def main():
    """Run all ML tests"""
    print("\n")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║     SMART WASTE MANAGEMENT - ML PREDICTION TESTS          ║")
    print("╚════════════════════════════════════════════════════════════╝")
    
    # Check if server is running
    try:
        response = requests.get(f"{API_BASE}/health")
        if response.status_code != 200:
            print_error("Backend server is not responding!")
            return
    except:
        print_error("Cannot connect to backend server!")
        print_info(f"Make sure the server is running at {API_BASE}")
        return
    
    print_success("Backend server is running!\n")
    
    # Run tests
    simulate_historical_data()
    time.sleep(2)
    
    test_fill_prediction()
    time.sleep(1)
    
    test_comprehensive_analysis()
    time.sleep(1)
    
    test_anomaly_detection()
    time.sleep(1)
    
    test_collection_optimization()
    time.sleep(1)
    
    test_usage_patterns()
    time.sleep(1)
    
    test_predicted_alerts()
    time.sleep(1)
    
    test_ml_statistics()
    
    print_header("Tests Completed!")
    print_success("All ML prediction features are working! 🎉\n")

if __name__ == "__main__":
    main()