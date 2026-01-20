"""
Enhanced AI Alert Simulation with Realistic Patterns

Features:
- Correlation with bin fill levels
- Time-based alert patterns
- Different alert probabilities
- Confidence scores
- Alert clustering (problems tend to occur together)
"""

import time
import random
import requests
from datetime import datetime, UTC

API_ALERTS_URL = "http://localhost:8000/ai_alerts"
API_BINS_URL = "http://localhost:8000/bins"

class AIAlertGenerator:
    """Generates realistic AI alerts based on bin conditions"""
    
    # Alert types with their characteristics
    ALERT_TYPES = {
        "fire": {
            "probability": 0.001,  # Very rare
            "time_dependent": True,
            "fill_dependent": False,
            "severity": "critical",
            "descriptions": [
                "Smoke detected near bin area",
                "Temperature spike detected - possible fire",
                "Flames visible in CCTV footage",
                "Fire hazard detected by thermal imaging"
            ]
        },
        "overflow": {
            "probability": 0.05,  # Common when bin is full
            "time_dependent": False,
            "fill_dependent": True,
            "severity": "high",
            "descriptions": [
                "Waste overflow detected",
                "Bin capacity exceeded",
                "Waste scattered around bin area",
                "Overflow visible in visual inspection"
            ]
        },
        "vandalism": {
            "probability": 0.003,  # Rare, more at night
            "time_dependent": True,
            "fill_dependent": False,
            "severity": "medium",
            "descriptions": [
                "Suspicious activity detected near bin",
                "Bin damage detected",
                "Unauthorized access to bin area",
                "Vandalism detected by motion sensors"
            ]
        },
        "illegal_dumping": {
            "probability": 0.008,  # More common at night
            "time_dependent": True,
            "fill_dependent": False,
            "severity": "medium",
            "descriptions": [
                "Large item dumping detected",
                "Unauthorized waste disposal observed",
                "Bulk waste detected outside bin",
                "Construction debris dumped illegally"
            ]
        },
        "odor_complaint": {
            "probability": 0.01,  # More in hot weather, full bins
            "time_dependent": True,
            "fill_dependent": True,
            "severity": "low",
            "descriptions": [
                "Strong odor detected by sensors",
                "Complaint received about bin smell",
                "High VOC levels detected",
                "Temperature and fill level indicate odor risk"
            ]
        },
        "pest_activity": {
            "probability": 0.015,  # More common
            "time_dependent": True,
            "fill_dependent": True,
            "severity": "medium",
            "descriptions": [
                "Rodent activity detected",
                "Pest presence confirmed by motion detection",
                "Animal intrusion detected",
                "Insect swarm detected near bin"
            ]
        },
        "sensor_malfunction": {
            "probability": 0.005,  # Technical issues
            "time_dependent": False,
            "fill_dependent": False,
            "severity": "low",
            "descriptions": [
                "Sensor reading anomaly detected",
                "Communication error with bin sensors",
                "Irregular data pattern detected",
                "Hardware malfunction suspected"
            ]
        }
    }
    
    def __init__(self):
        self.alert_history = {}  # Track alerts per bin
        self.last_check_time = time.time()
    
    def get_bins(self):
        """Fetch current bin status from API"""
        try:
            response = requests.get(API_BINS_URL, timeout=5)
            if response.status_code == 200:
                return response.json()
            else:
                print(f"⚠️  Could not fetch bins: {response.status_code}")
                return []
        except Exception as e:
            print(f"❌ Error fetching bins: {e}")
            return []
    
    def calculate_alert_probability(self, alert_type: str, bin_data: dict, hour: int) -> float:
        """Calculate probability of alert based on conditions"""
        base_prob = self.ALERT_TYPES[alert_type]["probability"]
        multiplier = 1.0
        
        fill_level = bin_data.get("fill_level_percent", 0)
        
        # Time-based adjustments
        if self.ALERT_TYPES[alert_type]["time_dependent"]:
            if alert_type in ["vandalism", "illegal_dumping"]:
                # More likely at night (10pm - 5am)
                if 22 <= hour or hour <= 5:
                    multiplier *= 3.0
                else:
                    multiplier *= 0.5
            
            elif alert_type == "odor_complaint":
                # More likely in hot afternoon (12pm - 6pm)
                if 12 <= hour <= 18:
                    multiplier *= 2.5
            
            elif alert_type == "pest_activity":
                # More likely early morning and evening
                if 5 <= hour <= 8 or 18 <= hour <= 22:
                    multiplier *= 2.0
        
        # Fill-level based adjustments
        if self.ALERT_TYPES[alert_type]["fill_dependent"]:
            if alert_type == "overflow":
                # Much more likely when bin is >85% full
                if fill_level >= 95:
                    multiplier *= 20.0
                elif fill_level >= 85:
                    multiplier *= 10.0
                elif fill_level >= 75:
                    multiplier *= 3.0
                else:
                    multiplier *= 0.1
            
            elif alert_type in ["odor_complaint", "pest_activity"]:
                # More likely with fuller bins
                if fill_level >= 80:
                    multiplier *= 3.0
                elif fill_level >= 60:
                    multiplier *= 1.5
        
        return base_prob * multiplier
    
    def generate_alert(self, bin_data: dict) -> dict:
        """Generate an alert for a bin if conditions warrant"""
        hour = datetime.now().hour
        bin_id = bin_data["id"]
        
        # Check each alert type
        for alert_type, config in self.ALERT_TYPES.items():
            probability = self.calculate_alert_probability(alert_type, bin_data, hour)
            
            # Roll the dice
            if random.random() < probability:
                # Generate confidence score (AI detection confidence)
                if alert_type in ["fire", "overflow"]:
                    confidence = random.uniform(0.85, 0.99)
                elif alert_type in ["vandalism", "illegal_dumping"]:
                    confidence = random.uniform(0.70, 0.90)
                else:
                    confidence = random.uniform(0.60, 0.85)
                
                description = random.choice(config["descriptions"])
                description += f" (Confidence: {confidence:.2%})"
                
                return {
                    "bin_id": bin_id,
                    "alert_type": alert_type,
                    "description": description,
                    "timestamp": datetime.now(UTC).isoformat(),
                    "severity": config["severity"],
                    "confidence": confidence
                }
        
        return None
    
    def send_alert(self, alert: dict):
        """Send alert to API"""
        try:
            # Remove fields not in API schema
            api_alert = {
                "bin_id": alert["bin_id"],
                "alert_type": alert["alert_type"],
                "description": alert["description"],
                "timestamp": alert["timestamp"]
            }
            
            response = requests.post(API_ALERTS_URL, json=api_alert, timeout=5)
            
            if response.status_code == 202:
                severity_emoji = {
                    "critical": "🔴",
                    "high": "🟠",
                    "medium": "🟡",
                    "low": "🔵"
                }
                emoji = severity_emoji.get(alert["severity"], "⚪")
                
                print(f"{emoji} ALERT GENERATED: {alert['alert_type'].upper()}")
                print(f"   Bin: {alert['bin_id']}")
                print(f"   Severity: {alert['severity']}")
                print(f"   Description: {alert['description']}")
                return True
            else:
                print(f"❌ Failed to send alert: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error sending alert: {e}")
            return False
    
    def run(self, check_interval: int = 60):
        """Run the AI alert simulation"""
        print("╔════════════════════════════════════════════════════════════╗")
        print("║         AI ALERT SIMULATION - STARTED                     ║")
        print("╚════════════════════════════════════════════════════════════╝")
        print(f"\n🤖 AI Vision System monitoring for anomalies...")
        print(f"⏱️  Check interval: {check_interval} seconds")
        print(f"📹 Alert types: {', '.join(self.ALERT_TYPES.keys())}\n")
        
        cycle = 0
        
        try:
            while True:
                cycle += 1
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                print(f"\n{'='*60}")
                print(f"AI Analysis Cycle #{cycle} - {current_time}")
                print(f"{'='*60}")
                
                # Get current bin status
                bins = self.get_bins()
                
                if not bins:
                    print("⚠️  No bins found, retrying in next cycle...")
                else:
                    print(f"📊 Analyzing {len(bins)} bins for anomalies...\n")
                    
                    alerts_generated = 0
                    
                    # Check each bin
                    for bin_data in bins:
                        alert = self.generate_alert(bin_data)
                        
                        if alert:
                            if self.send_alert(alert):
                                alerts_generated += 1
                            time.sleep(1)  # Small delay between alerts
                    
                    if alerts_generated == 0:
                        print("✅ No anomalies detected - all bins operating normally")
                    else:
                        print(f"\n📢 Generated {alerts_generated} alert(s) this cycle")
                
                print(f"\n⏳ Next analysis in {check_interval} seconds...")
                time.sleep(check_interval)
                
        except KeyboardInterrupt:
            print("\n\n🛑 AI Alert system stopped by user")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced AI Alert Simulation")
    parser.add_argument("--interval", type=int, default=60,
                       help="Check interval in seconds (default: 60)")
    parser.add_argument("--aggressive", action="store_true",
                       help="Aggressive mode: More frequent alerts for testing")
    
    args = parser.parse_args()
    
    generator = AIAlertGenerator()
    
    # In aggressive mode, multiply probabilities
    if args.aggressive:
        print("⚡ AGGRESSIVE MODE: Alert probabilities increased 10x for testing\n")
        for alert_type in generator.ALERT_TYPES:
            generator.ALERT_TYPES[alert_type]["probability"] *= 10
    
    generator.run(args.interval)


if __name__ == "__main__":
    main()