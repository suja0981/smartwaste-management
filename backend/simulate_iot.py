"""
Enhanced IoT Sensor Simulation with Realistic Patterns

Features:
- Time-based fill patterns (more waste during peak hours)
- Location-based behavior (commercial vs residential)
- Gradual fill progression (not random jumps)
- Battery drain simulation
- Temperature/humidity variations
- Sensor malfunction simulation
"""

import time
import random
import requests
from datetime import datetime, UTC
import math

API_URL = "http://localhost:8000/telemetry"

class SmartBin:
    """Simulates a single smart waste bin with realistic behavior"""
    
    def __init__(self, bin_id: str, location_type: str, capacity: int):
        self.bin_id = bin_id
        self.location_type = location_type  # residential, commercial, public
        self.capacity = capacity
        
        # Current state
        self.fill_level = random.randint(10, 40)  # Start partially filled
        self.battery = random.randint(85, 100)
        self.temperature = 25.0
        self.humidity = 60
        
        # Behavior parameters
        self.fill_rate = self._get_fill_rate()
        self.last_collection_time = time.time()
        self.sensor_health = 100  # 0-100, decreases over time
        self.malfunction_chance = 0.01  # 1% chance per cycle
        
    def _get_fill_rate(self) -> float:
        """Get base fill rate based on location type"""
        rates = {
            "residential": 0.8,   # Slow, steady
            "commercial": 2.5,    # Fast during business hours
            "public": 1.5,        # Medium, variable
            "industrial": 3.0     # Very fast
        }
        return rates.get(self.location_type, 1.0)
    
    def _get_time_multiplier(self) -> float:
        """Adjust fill rate based on time of day"""
        hour = datetime.now().hour
        
        if self.location_type == "commercial":
            # More waste during business hours (9am - 6pm)
            if 9 <= hour <= 18:
                return 1.5
            elif 19 <= hour <= 22:
                return 1.2
            else:
                return 0.3
        
        elif self.location_type == "residential":
            # More waste in morning (7-9am) and evening (6-10pm)
            if 7 <= hour <= 9 or 18 <= hour <= 22:
                return 1.8
            elif 10 <= hour <= 17:
                return 0.5
            else:
                return 0.3
        
        elif self.location_type == "public":
            # More waste during daytime (8am - 8pm)
            if 8 <= hour <= 20:
                return 1.3
            else:
                return 0.4
        
        return 1.0
    
    def _simulate_weather_effects(self):
        """Simulate temperature and humidity based on time of day"""
        hour = datetime.now().hour
        
        # Temperature cycle (cooler at night, warmer during day)
        base_temp = 25
        if 6 <= hour <= 18:  # Daytime
            variation = math.sin((hour - 6) * math.pi / 12) * 10
            self.temperature = base_temp + variation + random.uniform(-2, 2)
        else:  # Nighttime
            self.temperature = base_temp - 5 + random.uniform(-2, 2)
        
        # Humidity inversely related to temperature
        self.humidity = int(80 - (self.temperature - 20) * 2 + random.randint(-10, 10))
        self.humidity = max(30, min(95, self.humidity))
    
    def _drain_battery(self):
        """Simulate battery drain"""
        # Drain faster in extreme temperatures
        temp_factor = 1.0
        if self.temperature < 10 or self.temperature > 35:
            temp_factor = 1.5
        
        # Normal drain: ~0.5% per hour, faster with sensors active
        drain = random.uniform(0.02, 0.08) * temp_factor
        self.battery = max(0, self.battery - drain)
        
        # Simulate solar charging during day (if battery equipped)
        hour = datetime.now().hour
        if 10 <= hour <= 16 and self.battery < 100:
            charge = random.uniform(0.1, 0.3)
            self.battery = min(100, self.battery + charge)
    
    def _check_sensor_malfunction(self) -> bool:
        """Randomly simulate sensor malfunctions"""
        # Decrease sensor health over time
        self.sensor_health -= random.uniform(0.01, 0.05)
        
        # Higher malfunction chance with low sensor health
        if self.sensor_health < 50:
            self.malfunction_chance = 0.05
        
        return random.random() < self.malfunction_chance
    
    def update(self) -> dict:
        """Update bin state and return telemetry data"""
        
        # Simulate sensor malfunction
        if self._check_sensor_malfunction():
            # Return error data
            return {
                "bin_id": self.bin_id,
                "fill_level_percent": -1,  # Error indicator
                "battery_percent": int(self.battery),
                "temperature_c": None,
                "humidity_percent": None
            }
        
        # Update fill level (gradual increase)
        time_multiplier = self._get_time_multiplier()
        fill_increase = self.fill_rate * time_multiplier * random.uniform(0.5, 1.5)
        self.fill_level += fill_increase
        
        # Check if bin needs to be emptied (simulate collection)
        if self.fill_level >= 98:
            # Simulate collection happening
            if random.random() < 0.3:  # 30% chance of being collected
                self.fill_level = random.randint(0, 15)
                self.last_collection_time = time.time()
        
        # Clamp fill level
        self.fill_level = min(100, max(0, self.fill_level))
        
        # Update environmental sensors
        self._simulate_weather_effects()
        
        # Drain battery
        self._drain_battery()
        
        # Return telemetry
        return {
            "bin_id": self.bin_id,
            "fill_level_percent": int(self.fill_level),
            "battery_percent": int(self.battery),
            "temperature_c": round(self.temperature, 1),
            "humidity_percent": int(self.humidity)
        }


class IoTSimulator:
    """Main IoT simulation orchestrator"""
    
    def __init__(self):
        self.bins = []
        self._initialize_bins()
    
    def _initialize_bins(self):
        """Create simulated bins with different characteristics"""
        bin_configs = [
            # Residential areas (slow fill, morning/evening peaks)
            ("bin01", "residential", 100),
            ("bin02", "residential", 120),
            ("bin03", "residential", 100),
            ("bin06", "residential", 150),
            ("bin11", "residential", 100),
            
            # Commercial areas (fast fill during business hours)
            ("bin04", "commercial", 200),
            ("bin05", "commercial", 150),
            ("bin08", "commercial", 200),
            ("bin12", "commercial", 180),
            
            # Public areas (medium fill, daytime peaks)
            ("bin07", "public", 150),
            ("bin09", "public", 120),
            ("bin10", "public", 150),
            ("bin13", "public", 100),
            
            # Industrial (very fast fill)
            ("bin14", "industrial", 250),
            ("bin15", "industrial", 300),
        ]
        
        for bin_id, location_type, capacity in bin_configs:
            self.bins.append(SmartBin(bin_id, location_type, capacity))
    
    def send_telemetry(self, bin_telemetry: dict):
        """Send telemetry data to API"""
        try:
            response = requests.post(API_URL, json=bin_telemetry, timeout=5)
            
            status_emoji = "✅" if response.status_code == 202 else "❌"
            fill = bin_telemetry["fill_level_percent"]
            
            # Color code based on fill level
            if fill == -1:
                fill_indicator = "⚠️  ERROR"
            elif fill >= 90:
                fill_indicator = f"🔴 {fill}%"
            elif fill >= 70:
                fill_indicator = f"🟡 {fill}%"
            else:
                fill_indicator = f"🟢 {fill}%"
            
            print(f"{status_emoji} {bin_telemetry['bin_id']}: {fill_indicator} | "
                  f"Battery: {bin_telemetry['battery_percent']}% | "
                  f"Temp: {bin_telemetry.get('temperature_c', 'N/A')}°C")
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Error sending telemetry for {bin_telemetry['bin_id']}: {e}")
    
    def run(self, interval: int = 30):
        """Run the simulation continuously"""
        print("╔════════════════════════════════════════════════════════════╗")
        print("║       ENHANCED IoT SENSOR SIMULATION - STARTED            ║")
        print("╚════════════════════════════════════════════════════════════╝")
        print(f"\n📡 Monitoring {len(self.bins)} smart bins...")
        print(f"⏱️  Update interval: {interval} seconds")
        print(f"🎯 Realistic patterns: Time-based, Location-based, Weather simulation\n")
        
        cycle = 0
        try:
            while True:
                cycle += 1
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                print(f"\n{'='*60}")
                print(f"Cycle #{cycle} - {current_time}")
                print(f"{'='*60}")
                
                # Update and send telemetry for all bins
                for bin_sensor in self.bins:
                    telemetry = bin_sensor.update()
                    self.send_telemetry(telemetry)
                    time.sleep(0.2)  # Small delay between bins
                
                print(f"\n⏳ Waiting {interval} seconds until next cycle...")
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\n\n🛑 Simulation stopped by user")
            print("📊 Final Statistics:")
            for bin_sensor in self.bins:
                print(f"  {bin_sensor.bin_id}: Fill={bin_sensor.fill_level:.1f}%, "
                      f"Battery={bin_sensor.battery:.1f}%, "
                      f"Health={bin_sensor.sensor_health:.1f}%")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced IoT Sensor Simulation")
    parser.add_argument("--interval", type=int, default=30,
                       help="Update interval in seconds (default: 30)")
    parser.add_argument("--fast", action="store_true",
                       help="Fast mode: 5 second intervals")
    
    args = parser.parse_args()
    
    interval = 5 if args.fast else args.interval
    
    simulator = IoTSimulator()
    simulator.run(interval)


if __name__ == "__main__":
    main()