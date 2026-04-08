# IoT Device Integration Guide

**Smart Waste Management System**  
Connect any microcontroller or embedded device to report live bin fill levels.

---

## Table of Contents

1. [How It Works](#1-how-it-works)
2. [Prerequisites](#2-prerequisites)
3. [Step 1 — Register Your Bin](#3-step-1--register-your-bin)
4. [Step 2 — Get an API Key](#4-step-2--get-an-api-key)
5. [Step 3 — Send Telemetry](#5-step-3--send-telemetry)
6. [Payload Reference](#6-payload-reference)
7. [Response Reference](#7-response-reference)
8. [Status Rules](#8-status-rules)
9. [Device Code Examples](#9-device-code-examples)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. How It Works

```
Ultrasonic sensor
      │
      ▼
Microcontroller (ESP32 / Arduino / Raspberry Pi)
      │  HTTP POST  /telemetry/
      │  Header: X-API-Key: wsk_live_...
      ▼
FastAPI Backend  ──► Neon PostgreSQL (stored)
      │
      ├──► WebSocket broadcast → Dashboard updates live
      ├──► FCM push notification → Mobile/browser alert (at 80% and 90%)
      └──► ML prediction model updated
```

Every POST to `/telemetry/` does all of the above automatically. Your device only needs to send one HTTP request.

---

## 2. Prerequisites

- Backend running and reachable (locally `http://localhost:8000` or deployed URL)
- Admin account created (`python seed_users.py` or manual signup)
- The bin physically installed and registered in the system (Step 1)
- WiFi or cellular connectivity on the device

---

## 3. Step 1 — Register Your Bin

Before a device can send data, the bin must be registered in the system. A 404 is returned for unknown bin IDs.

**POST** `http://localhost:8000/bins/`  
Header: `Authorization: Bearer <admin_token>`

```json
{
  "id": "BIN001",
  "location": "Market Street, Nagpur",
  "capacity_liters": 1000,
  "latitude": 21.1497,
  "longitude": 79.086
}
```

The `id` field is your **device identifier** — it must match `bin_id` in every telemetry payload. Choose a consistent naming scheme, e.g. `BIN001`, `ZONE_N_01`, `MKT_ST_A`.

---

## 4. Step 2 — Get an API Key

API keys are the secure way for devices to authenticate. They use the `X-API-Key` header and never expire unless manually revoked.

### 4a. Login to get an admin token

**POST** `http://localhost:8000/auth/login`

```json
{
  "email": "admin@example.com",
  "password": "Admin@1234"
}
```

Copy the `access_token` from the response.

### 4b. Create an API key

**POST** `http://localhost:8000/auth/api-keys`  
Header: `Authorization: Bearer <access_token>`

```json
{
  "label": "BIN001 - Market Street sensor"
}
```

Response:

```json
{
  "key_id": 1,
  "label": "BIN001 - Market Street sensor",
  "key": "wsk_live_Abc123...xyz",
  "is_active": true,
  "created_at": "2026-04-03T10:00:00Z"
}
```

> **Important**: The `key` is shown **only once**. Copy it immediately and store it in your device firmware or `.env`.

### 4c. Store the key safely

- **Backend `.env`** (for simulator scripts): `IOT_API_KEY=wsk_live_Abc123...xyz`
- **Microcontroller firmware**: store in flash/EEPROM or a `secrets.h` file excluded from version control
- **Never hardcode it directly in source code committed to git**

### 4d. Verify the key works

```bash
curl -X POST http://localhost:8000/telemetry/ \
  -H "X-API-Key: wsk_live_Abc123...xyz" \
  -H "Content-Type: application/json" \
  -d '{"bin_id": "BIN001", "fill_level_percent": 25}'
```

Expected: `202 Accepted`

---

## 5. Step 3 — Send Telemetry

Your device should send a POST request on a regular interval (every 30–300 seconds is typical).

**Endpoint**: `POST /telemetry/`  
**Auth header**: `X-API-Key: wsk_live_...`  
**Content-Type**: `application/json`

### Minimum payload (only 2 fields required):

```json
{
  "bin_id": "BIN001",
  "fill_level_percent": 74
}
```

### Full payload (all optional sensors):

```json
{
  "bin_id": "BIN001",
  "fill_level_percent": 74,
  "battery_percent": 82,
  "temperature_c": 28.5,
  "humidity_percent": 60,
  "timestamp": "2026-04-03T12:00:00Z"
}
```

`timestamp` — ISO 8601 UTC. Omit to use server time. Include it if your device has an RTC and you want accurate historical data.

---

## 6. Payload Reference

| Field                | Type    | Required | Range    | Description                       |
| -------------------- | ------- | -------- | -------- | --------------------------------- |
| `bin_id`             | string  | ✅ Yes   | —        | Must match a registered bin ID    |
| `fill_level_percent` | integer | ✅ Yes   | 0–100    | Fill level from ultrasonic sensor |
| `battery_percent`    | integer | No       | 0–100    | Device battery level              |
| `temperature_c`      | float   | No       | —        | Ambient temperature in Celsius    |
| `humidity_percent`   | integer | No       | 0–100    | Relative humidity %               |
| `timestamp`          | string  | No       | ISO 8601 | Defaults to server receive time   |

---

## 7. Response Reference

**Success `202 Accepted`:**

```json
{
  "accepted": true,
  "bin_id": "BIN001",
  "fill_level_percent": 74,
  "status": "warning",
  "timestamp": "2026-04-03T12:00:00Z",
  "received_from": "X-API-Key (wsk_live_Abc123...)"
}
```

**Error responses:**

| Code  | Reason                                  | Fix                                                    |
| ----- | --------------------------------------- | ------------------------------------------------------ |
| `401` | Missing or invalid API key              | Check `X-API-Key` header and that the key exists in DB |
| `404` | `bin_id` not registered                 | Register the bin first via `POST /bins/`               |
| `422` | `fill_level_percent` out of 0–100 range | Validate sensor reading before sending                 |
| `500` | Backend error                           | Check backend logs                                     |

---

## 8. Status Rules

The backend automatically updates the bin's status based on fill level:

| Fill Level | Status    |
| ---------- | --------- |
| 0–69%      | `ok`      |
| 70–89%     | `warning` |
| 90–100%    | `full`    |

Alerts are automatically sent via FCM push notifications when:

- Fill crosses **80%** → warning notification
- Fill crosses **90%** → critical notification

---

## 9. Device Code Examples

### ESP32 / Arduino (C++)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "YourWiFiSSID";
const char* WIFI_PASSWORD = "YourWiFiPassword";
const char* API_URL       = "http://YOUR_BACKEND_IP:8000/telemetry/";
const char* API_KEY       = "wsk_live_Abc123...xyz";  // store in secrets.h
const char* BIN_ID        = "BIN001";

// Ultrasonic sensor pins
#define TRIG_PIN 5
#define ECHO_PIN 18
#define BIN_HEIGHT_CM 100  // physical height of bin in cm

int readFillPercent() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    long duration = pulseIn(ECHO_PIN, HIGH);
    int distance_cm = duration * 0.034 / 2;
    int fill = 100 - ((distance_cm * 100) / BIN_HEIGHT_CM);
    return constrain(fill, 0, 100);
}

void sendTelemetry(int fill) {
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);

    StaticJsonDocument<256> doc;
    doc["bin_id"]              = BIN_ID;
    doc["fill_level_percent"]  = fill;
    // Optional: add battery and temperature
    // doc["battery_percent"]  = readBattery();
    // doc["temperature_c"]    = readTemperature();

    String body;
    serializeJson(doc, body);

    int code = http.POST(body);
    Serial.printf("Telemetry sent: fill=%d%% → HTTP %d\n", fill, code);
    http.end();
}

void setup() {
    Serial.begin(115200);
    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected");
}

void loop() {
    if (WiFi.status() == WL_CONNECTED) {
        int fill = readFillPercent();
        sendTelemetry(fill);
    }
    delay(60000);  // send every 60 seconds
}
```

---

### Raspberry Pi (Python)

```python
import time
import requests
import RPi.GPIO as GPIO

API_URL = "http://YOUR_BACKEND_IP:8000/telemetry/"
API_KEY = "wsk_live_Abc123...xyz"  # store in .env and load with python-dotenv
BIN_ID  = "BIN001"

TRIG = 23
ECHO = 24
BIN_HEIGHT_CM = 100

GPIO.setmode(GPIO.BCM)
GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)

def read_distance_cm():
    GPIO.output(TRIG, False)
    time.sleep(0.2)
    GPIO.output(TRIG, True)
    time.sleep(0.00001)
    GPIO.output(TRIG, False)

    while GPIO.input(ECHO) == 0:
        pulse_start = time.time()
    while GPIO.input(ECHO) == 1:
        pulse_end = time.time()

    return (pulse_end - pulse_start) * 17150

def read_fill_percent():
    dist = read_distance_cm()
    fill = 100 - int((dist / BIN_HEIGHT_CM) * 100)
    return max(0, min(100, fill))

def send_telemetry():
    fill = read_fill_percent()
    payload = {
        "bin_id": BIN_ID,
        "fill_level_percent": fill,
    }
    try:
        r = requests.post(
            API_URL,
            json=payload,
            headers={"X-API-Key": API_KEY},
            timeout=10,
        )
        print(f"Sent fill={fill}% → {r.status_code}")
    except requests.RequestException as e:
        print(f"Failed to send telemetry: {e}")

if __name__ == "__main__":
    try:
        while True:
            send_telemetry()
            time.sleep(60)  # send every 60 seconds
    finally:
        GPIO.cleanup()
```

---

### Generic HTTP (curl — for testing)

```bash
# Minimum payload
curl -X POST http://localhost:8000/telemetry/ \
  -H "X-API-Key: wsk_live_Abc123...xyz" \
  -H "Content-Type: application/json" \
  -d '{"bin_id": "BIN001", "fill_level_percent": 74}'

# Full payload
curl -X POST http://localhost:8000/telemetry/ \
  -H "X-API-Key: wsk_live_Abc123...xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "bin_id": "BIN001",
    "fill_level_percent": 74,
    "battery_percent": 82,
    "temperature_c": 28.5,
    "humidity_percent": 60
  }'
```

---

### MicroPython (ESP8266 / ESP32)

```python
import network
import urequests
import ujson
import time
from machine import Pin, time_pulse_us

WIFI_SSID    = "YourWiFiSSID"
WIFI_PASS    = "YourWiFiPassword"
API_URL      = "http://YOUR_BACKEND_IP:8000/telemetry/"
API_KEY      = "wsk_live_Abc123...xyz"
BIN_ID       = "BIN001"
BIN_HEIGHT   = 100  # cm

TRIG = Pin(5, Pin.OUT)
ECHO = Pin(18, Pin.IN)

def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASS)
    for _ in range(20):
        if wlan.isconnected():
            print("WiFi connected:", wlan.ifconfig()[0])
            return True
        time.sleep(1)
    return False

def read_fill():
    TRIG.off()
    time.sleep_us(2)
    TRIG.on()
    time.sleep_us(10)
    TRIG.off()
    duration = time_pulse_us(ECHO, 1, 30000)
    dist_cm  = (duration / 2) * 0.0343
    fill     = 100 - int((dist_cm / BIN_HEIGHT) * 100)
    return max(0, min(100, fill))

def send_telemetry():
    fill    = read_fill()
    payload = ujson.dumps({"bin_id": BIN_ID, "fill_level_percent": fill})
    headers = {"Content-Type": "application/json", "X-API-Key": API_KEY}
    try:
        r = urequests.post(API_URL, data=payload, headers=headers)
        print(f"fill={fill}% → {r.status_code}")
        r.close()
    except Exception as e:
        print("Error:", e)

connect_wifi()
while True:
    send_telemetry()
    time.sleep(60)
```

---

## 10. Troubleshooting

### `401 Invalid API key`

- The key doesn't exist in the database.
- If you switched databases (e.g. local → Neon), old keys are gone — create a new one.
- Check there are no leading/trailing spaces in the key value.

### `404 Bin not registered`

- The `bin_id` in your payload doesn't match any registered bin.
- Create the bin first: `POST /bins/` with the same ID.

### `422 Unprocessable Entity`

- `fill_level_percent` is outside the 0–100 range.
- Add a `constrain()` / `max(0, min(100, val))` clamp in your device code before sending.

### ML predictions not showing

- Each bin needs **at least 20 telemetry readings** before predictions are generated.
- Run the simulator or let your device send ~20 readings, then call `POST /predictions/seed` to rebuild models.

### Device sends data but dashboard doesn't update live

- The dashboard uses WebSocket for real-time updates. Check the browser console for WebSocket errors.
- Make sure the frontend `NEXT_PUBLIC_API_URL` points to the correct backend host.

### Revoking a compromised key

```
DELETE http://localhost:8000/auth/api-keys/{key_id}
Authorization: Bearer <admin_token>
```

Create a new key immediately and update the device firmware.
