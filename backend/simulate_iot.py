import time
import random
import requests

API_URL = "http://localhost:8000/telemetry"
BIN_IDS = ["bin1", "bin2", "bin3"]

while True:
    for bin_id in BIN_IDS:
        fill_level = random.randint(0, 100)
        battery = random.randint(20, 100)
        temp = round(random.uniform(15, 40), 1)
        humidity = random.randint(30, 90)
        payload = {
            "bin_id": bin_id,
            "fill_level_percent": fill_level,
            "battery_percent": battery,
            "temperature_c": temp,
            "humidity_percent": humidity
        }
        try:
            resp = requests.post(API_URL, json=payload)
            print(f"Sent telemetry for {bin_id}: {payload} | Response: {resp.status_code}")
        except Exception as e:
            print(f"Error sending telemetry: {e}")
    time.sleep(5)
