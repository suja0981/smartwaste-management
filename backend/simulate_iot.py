"""IoT telemetry simulator for demo and development.

Supports both:
1. real device auth style via ``X-API-Key``
2. script/demo auth style via backend JWT login

Examples:
  python simulate_iot.py
  python simulate_iot.py --fast
  python simulate_iot.py --bins 3
  python simulate_iot.py --base-url http://localhost:8000
  python simulate_iot.py --auth-mode jwt --email admin@example.com --password Admin@1234
  python simulate_iot.py --auth-mode api-key --api-key wsk_live_xxx
"""

from __future__ import annotations

import argparse
import math
import os
import random
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()


DEFAULT_BASE_URL = os.getenv("SIM_API_BASE_URL", "http://localhost:8000").rstrip("/")
DEFAULT_API_KEY = os.getenv("IOT_API_KEY", "").strip()
DEFAULT_EMAIL = os.getenv("SIM_EMAIL", "").strip()
DEFAULT_PASSWORD = os.getenv("SIM_PASSWORD", "").strip()
DEFAULT_ACCESS_TOKEN = os.getenv("SIM_ACCESS_TOKEN", "").strip()


@dataclass
class AuthConfig:
    headers: dict[str, str]
    mode: str
    label: str


def build_auth_config(
    base_url: str,
    auth_mode: str,
    api_key: str,
    email: str,
    password: str,
    access_token: str,
    session: requests.Session,
) -> AuthConfig:
    if auth_mode in {"auto", "api-key"} and api_key:
        return AuthConfig(
            headers={"X-API-Key": api_key},
            mode="api-key",
            label=f"X-API-Key ({api_key[:16]}...)",
        )

    if auth_mode in {"auto", "token"} and access_token:
        return AuthConfig(
            headers={"Authorization": f"Bearer {access_token}"},
            mode="token",
            label="Bearer token",
        )

    if auth_mode in {"auto", "jwt"} and email and password:
        response = session.post(
            f"{base_url}/auth/login",
            json={"email": email, "password": password},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        token = data["access_token"]
        return AuthConfig(
            headers={"Authorization": f"Bearer {token}"},
            mode="jwt",
            label=f"JWT login ({email})",
        )

    raise ValueError(
        "No valid simulator auth configured. Provide one of: "
        "--api-key / IOT_API_KEY, "
        "--access-token / SIM_ACCESS_TOKEN, "
        "--email + --password / SIM_EMAIL + SIM_PASSWORD."
    )


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
        return {
            "residential": 0.8,
            "commercial": 2.5,
            "public": 1.5,
            "industrial": 3.0,
        }.get(self.location_type, 1.0)

    def _get_time_multiplier(self) -> float:
        hour = datetime.now().hour
        if self.location_type == "commercial":
            if 9 <= hour <= 18:
                return 1.5
            if 19 <= hour <= 22:
                return 1.2
            return 0.3
        if self.location_type == "residential":
            if 7 <= hour <= 9 or 18 <= hour <= 22:
                return 1.8
            if 10 <= hour <= 17:
                return 0.5
            return 0.3
        if self.location_type == "public":
            return 1.3 if 8 <= hour <= 20 else 0.4
        return 1.0

    def _simulate_weather(self) -> None:
        hour = datetime.now().hour
        if 6 <= hour <= 18:
            self.temperature = 25 + math.sin((hour - 6) * math.pi / 12) * 10 + random.uniform(-2, 2)
        else:
            self.temperature = 20 + random.uniform(-2, 2)

        self.humidity = int(
            max(30, min(95, 80 - (self.temperature - 20) * 2 + random.randint(-10, 10)))
        )

    def _drain_battery(self) -> None:
        temp_factor = 1.5 if self.temperature < 10 or self.temperature > 35 else 1.0
        drain = random.uniform(0.02, 0.08) * temp_factor
        self.battery = max(0, self.battery - drain)
        hour = datetime.now().hour
        if 10 <= hour <= 16 and self.battery < 100:
            self.battery = min(100, self.battery + random.uniform(0.1, 0.3))

    def _is_malfunctioning(self) -> bool:
        self.sensor_health -= random.uniform(0.01, 0.05)
        if self.sensor_health < 50:
            self.malfunction_chance = 0.05
        return random.random() < self.malfunction_chance

    def update(self) -> Optional[dict]:
        if self._is_malfunctioning():
            print(f"  {self.bin_id}: sensor malfunction, skipping this cycle")
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
            "fill_level_percent": int(self.fill_level),
            "battery_percent": int(self.battery),
            "temperature_c": round(self.temperature, 1),
            "humidity_percent": int(self.humidity),
            "timestamp": datetime.now().isoformat(),
        }


class IoTSimulator:
    """Orchestrates all simulated bins."""

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

    def __init__(
        self,
        *,
        base_url: str,
        bin_count: Optional[int],
        auth_mode: str,
        api_key: str,
        email: str,
        password: str,
        access_token: str,
    ):
        self.base_url = base_url.rstrip("/")
        self.telemetry_url = f"{self.base_url}/telemetry/"
        self.session = requests.Session()

        configs = self.BIN_CONFIGS[:bin_count] if bin_count else self.BIN_CONFIGS
        self.bins = [SmartBin(*cfg) for cfg in configs]

        self.auth = build_auth_config(
            self.base_url,
            auth_mode,
            api_key,
            email,
            password,
            access_token,
            self.session,
        )

    def send_telemetry(self, data: dict) -> None:
        try:
            response = self.session.post(
                self.telemetry_url,
                json=data,
                headers=self.auth.headers,
                timeout=5,
            )
            fill = data["fill_level_percent"]
            indicator = (
                f"FULL {fill}%"
                if fill >= 90
                else f"WARN {fill}%"
                if fill >= 70
                else f"OK   {fill}%"
            )
            status = "OK" if response.status_code == 202 else f"ERR {response.status_code}"
            print(
                f"  [{status}] {data['bin_id']}: {indicator} | "
                f"Bat: {data['battery_percent']}% | "
                f"Temp: {data.get('temperature_c', 'N/A')}C"
            )

            if response.status_code != 202:
                try:
                    error_msg = response.json().get("detail", response.text[:80])
                except Exception:
                    error_msg = response.text[:80]
                print(f"         Error: {error_msg}")
        except requests.exceptions.RequestException as exc:
            print(f"  [NET] {data['bin_id']}: {exc}")

    def run(self, interval: int = 30) -> None:
        print("=" * 56)
        print("  IOT SENSOR SIMULATION - STARTED")
        print("=" * 56)
        print(f"\n  Simulating {len(self.bins)} bins | interval: {interval}s")
        print(f"  Backend: {self.base_url}")
        print(f"  Auth: {self.auth.label}")
        print()

        cycle = 0
        try:
            while True:
                cycle += 1
                print(f"\n--- Cycle #{cycle} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")

                for bin_sensor in self.bins:
                    data = bin_sensor.update()
                    if data is not None:
                        self.send_telemetry(data)
                    time.sleep(0.2)

                print(f"\n  Next cycle in {interval}s ...")
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\n\nSimulation stopped.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Smart waste IoT telemetry simulator")
    parser.add_argument("--interval", type=int, default=30, help="Seconds between cycles")
    parser.add_argument("--fast", action="store_true", help="Use 5-second intervals for demo")
    parser.add_argument("--bins", type=int, default=None, help="Number of bins to simulate")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Backend base URL")
    parser.add_argument(
        "--auth-mode",
        choices=["auto", "api-key", "jwt", "token"],
        default="auto",
        help="Authentication mode for telemetry ingestion",
    )
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="IoT API key")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help="Login email for JWT mode")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Login password for JWT mode")
    parser.add_argument("--access-token", default=DEFAULT_ACCESS_TOKEN, help="Existing bearer token")
    args = parser.parse_args()

    interval = 5 if args.fast else args.interval

    simulator = IoTSimulator(
        base_url=args.base_url,
        bin_count=args.bins,
        auth_mode=args.auth_mode,
        api_key=args.api_key,
        email=args.email,
        password=args.password,
        access_token=args.access_token,
    )
    simulator.run(interval)


if __name__ == "__main__":
    main()
