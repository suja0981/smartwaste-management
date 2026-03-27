"""
Enhanced IoT Sensor Simulation with Realistic Patterns

FIX: Old version sent fill_level_percent: -1 on sensor malfunction.
     The API model has ge=0 validation on that field, so every malfunction
     caused a 422 Unprocessable Entity and was silently dropped.
     Now malfunctions are skipped (no POST) and logged locally instead.

Keep this script for dev/testing when real hardware isn't connected.
"""

import time
import random
import requests
from datetime import datetime
import math

API_URL = "http://localhost:8000/telemetry"


class SmartBin:
    """Simulates a single smart waste bin with realistic behaviour."""

    def __init__(self, bin_id: str, location_type: str, capacity: int):
        self.bin_id = bin_id
        self.location_type = location_type
        self.capacity = capacity

        self.fill_level = random.randint(10, 40)
        self.battery = random.randint(85, 100)
        self.temperature = 25.0
        self.humidity = 60

        self.fill_rate = self._get_fill_rate()
        self.sensor_health = 100.0
        self.malfunction_chance = 0.01

    def _get_fill_rate(self) -> float:
        return {"residential": 0.8, "commercial": 2.5, "public": 1.5, "industrial": 3.0}.get(
            self.location_type, 1.0
        )

    def _get_time_multiplier(self) -> float:
        hour = datetime.now().hour
        if self.location_type == "commercial":
            if 9 <= hour <= 18:
                return 1.5
            elif 19 <= hour <= 22:
                return 1.2
            return 0.3
        elif self.location_type == "residential":
            if 7 <= hour <= 9 or 18 <= hour <= 22:
                return 1.8
            elif 10 <= hour <= 17:
                return 0.5
            return 0.3
        elif self.location_type == "public":
            return 1.3 if 8 <= hour <= 20 else 0.4
        return 1.0

    def _simulate_weather(self):
        hour = datetime.now().hour
        if 6 <= hour <= 18:
            self.temperature = 25 + math.sin((hour - 6) * math.pi / 12) * 10 + random.uniform(-2, 2)
        else:
            self.temperature = 20 + random.uniform(-2, 2)
        self.humidity = int(max(30, min(95, 80 - (self.temperature - 20) * 2 + random.randint(-10, 10))))

    def _drain_battery(self):
        temp_factor = 1.5 if self.temperature < 10 or self.temperature > 35 else 1.0
        drain = random.uniform(0.02, 0.08) * temp_factor
        self.battery = max(0, self.battery - drain)
        hour = datetime.now().hour
        if 10 <= hour <= 16 and self.battery < 100:
            self.battery = min(100, self.battery + random.uniform(0.1, 0.3))

    def _is_malfunctioning(self) -> bool:
        """Returns True if sensor should be treated as offline this cycle."""
        self.sensor_health -= random.uniform(0.01, 0.05)
        if self.sensor_health < 50:
            self.malfunction_chance = 0.05
        return random.random() < self.malfunction_chance

    def update(self):
        """
        Returns a valid telemetry dict, or None if the sensor is malfunctioning.

        FIX: Old code returned fill_level_percent=-1 which failed API validation.
        Now we return None and the caller skips the POST entirely.
        """
        if self._is_malfunctioning():
            # Log locally — don't POST invalid data to the API
            print(f"⚠️  {self.bin_id}: sensor malfunction — skipping this cycle")
            return None

        time_multiplier = self._get_time_multiplier()
        fill_increase = self.fill_rate * time_multiplier * random.uniform(0.5, 1.5)
        self.fill_level = min(100.0, self.fill_level + fill_increase)

        if self.fill_level >= 98 and random.random() < 0.3:
            self.fill_level = random.randint(0, 15)

        self._simulate_weather()
        self._drain_battery()

        return {
            "bin_id": self.bin_id,
            "fill_level_percent": int(self.fill_level),   # always 0-100
            "battery_percent": int(self.battery),
            "temperature_c": round(self.temperature, 1),
            "humidity_percent": int(self.humidity),
        }


class IoTSimulator:
    """Orchestrates all simulated bins."""

    # Configurable — no need to run 15 bins locally if you only want 5
    BIN_CONFIGS = [
        ("bin01", "residential", 100),
        ("bin02", "residential", 120),
        ("bin03", "residential", 100),
        ("bin04", "commercial", 200),
        ("bin05", "commercial", 150),
        ("bin06", "public", 150),
        ("bin07", "public", 120),
        ("bin08", "commercial", 200),
        ("bin09", "public", 150),
        ("bin10", "industrial", 250),
    ]

    def __init__(self, bin_count: int = None):
        configs = self.BIN_CONFIGS[:bin_count] if bin_count else self.BIN_CONFIGS
        self.bins = [SmartBin(*cfg) for cfg in configs]

    def send_telemetry(self, data: dict):
        try:
            resp = requests.post(API_URL, json=data, timeout=5)
            fill = data["fill_level_percent"]
            indicator = (
                f"🔴 {fill}%" if fill >= 90 else f"🟡 {fill}%" if fill >= 70 else f"🟢 {fill}%"
            )
            status = "✅" if resp.status_code == 202 else f"❌ {resp.status_code}"
            print(
                f"{status} {data['bin_id']}: {indicator} | "
                f"Bat: {data['battery_percent']}% | "
                f"Temp: {data.get('temperature_c', 'N/A')}°C"
            )
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error for {data['bin_id']}: {e}")

    def run(self, interval: int = 30):
        print("╔══════════════════════════════════════════════════════╗")
        print("║       IoT SENSOR SIMULATION — STARTED               ║")
        print("╚══════════════════════════════════════════════════════╝")
        print(f"\n📡 Simulating {len(self.bins)} bins | interval: {interval}s\n")

        cycle = 0
        try:
            while True:
                cycle += 1
                print(f"\n{'='*54}")
                print(f"Cycle #{cycle} — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"{'='*54}")

                for bin_sensor in self.bins:
                    data = bin_sensor.update()
                    if data is not None:          # FIX: skip malfunctions
                        self.send_telemetry(data)
                    time.sleep(0.2)

                print(f"\n⏳ Next cycle in {interval}s …")
                time.sleep(interval)

        except KeyboardInterrupt:
            print("\n\n🛑 Simulation stopped")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="IoT Sensor Simulation")
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--fast", action="store_true", help="5-second intervals")
    parser.add_argument("--bins", type=int, default=None, help="Number of bins to simulate (default: all)")
    args = parser.parse_args()

    interval = 5 if args.fast else args.interval
    IoTSimulator(bin_count=args.bins).run(interval)


if __name__ == "__main__":
    main()