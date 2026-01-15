import time
import random
import requests
from datetime import datetime, UTC

API_URL = "http://localhost:8000/ai_alerts"
BIN_IDS = ["bin1", "bin2", "bin3"]
ALERT_TYPES = ["fire", "vandalism", "overflow"]

while True:
    bin_id = random.choice(BIN_IDS)
    alert_type = random.choice(ALERT_TYPES)
    description = f"Simulated {alert_type} detected by AI"
    payload = {
        "bin_id": bin_id,
        "alert_type": alert_type,
        "description": description,
        "timestamp": datetime.now(UTC).isoformat()
    }
    try:
        resp = requests.post(API_URL, json=payload)
        print(f"Sent AI alert for {bin_id}: {payload} | Response: {resp.status_code}")
    except Exception as e:
        print(f"Error sending AI alert: {e}")
    time.sleep(10)
