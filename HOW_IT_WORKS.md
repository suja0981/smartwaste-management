# Smart Waste Management — How It Works

A complete walkthrough of the system from connecting a physical bin to completing a collection. Each step identifies the exact file(s) responsible.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Step 1 — Register a Bin](#2-step-1--register-a-bin)
3. [Step 2 — Connect an IoT Device](#3-step-2--connect-an-iot-device)
4. [Step 3 — Live Telemetry Arrives](#4-step-3--live-telemetry-arrives)
5. [Step 4 — Real-Time Dashboard Update](#5-step-4--real-time-dashboard-update)
6. [Step 5 — Push Notifications Fire](#6-step-5--push-notifications-fire)
7. [Step 6 — ML Predictions Update](#7-step-6--ml-predictions-update)
8. [Step 7 — Admin Reviews Predictions](#8-step-7--admin-reviews-predictions)
9. [Step 8 — Collection Tasks Are Created](#9-step-8--collection-tasks-are-created)
10. [Step 9 — Route Is Optimized](#10-step-9--route-is-optimized)
11. [Step 10 — Driver Executes the Route](#11-step-10--driver-executes-the-route)
12. [Step 11 — Collection Complete](#12-step-11--collection-complete)
13. [Step 12 — Reports & Analytics](#13-step-12--reports--analytics)
14. [User Roles Summary](#14-user-roles-summary)
15. [Data Flow Diagram](#15-data-flow-diagram)

---

## 1. System Overview

The platform has three runtime processes:

| Process                        | Start command                       | Purpose                                      |
| ------------------------------ | ----------------------------------- | -------------------------------------------- |
| **FastAPI backend**            | `uvicorn backend.main:app --reload` | REST API, WebSocket hub, ML engine, database |
| **Next.js frontend**           | `cd frontend && pnpm dev`           | Dashboard UI for admins, operators, drivers  |
| **IoT simulator** _(dev only)_ | `python backend/simulate_iot.py`    | Mimics physical sensors during development   |

**Database:** PostgreSQL. The connection string is set via the `DATABASE_URL` environment variable in `backend/.env` (e.g. `postgresql://waste_user:password@localhost:5432/smart_waste`). Schema migrations are managed with **Alembic** (`backend/alembic.ini`, `backend/migrations/`).

---

## 2. Step 1 — Register a Bin

Before a physical bin can send data, it must exist in the database.

**Who does it:** Admin user via the dashboard Bins page.

**Frontend:**

- Page: `frontend/app/bins/page.tsx`
- Dialog: `frontend/components/add-bin-dialog.tsx`
- API call: `apiClient.createBin(...)` in `frontend/lib/api-client.ts`

**Backend:**

- Route: `POST /bins/` in `backend/routers/bins.py`
- Requires: JWT with `admin` role
- Stores: `id`, `location`, `capacity_liters`, `fill_level_percent`, `latitude`, `longitude` into the `BinDB` table
- Model validation: `backend/models.py → CreateBinRequest`

**What gets saved:**

```
BinDB row:
  id                = "BIN-001"
  location          = "Main Street & 5th Ave"
  capacity_liters   = 240
  fill_level_percent = 0
  status            = "ok"
  latitude          = 40.7128
  longitude         = -74.0060
```

---

## 3. Step 2 — Connect an IoT Device

The physical sensor (e.g. ESP32, Raspberry Pi) needs a credential to authenticate with the API.

**Option A — API Key (recommended for hardware devices):**

1. Admin generates an API key from the dashboard or directly via `POST /auth/api-keys`.
2. Key is generated with 128-bit entropy, prefixed `wsk_live_...`
3. **Only the SHA-256 hash is stored** in the database — the plaintext is shown once and must be copied immediately.
4. The device stores the key and sends it as an HTTP header: `X-API-Key: wsk_live_...`

**Backend files:**

- Key generation: `backend/api_key_services.py → generate_api_key()`
- Key validation: `backend/routers/auth.py → get_device_or_user()`
- Storage: `APIKeyDB` table in `backend/database.py`

**Option B — JWT (for scripts or dev testing):**

1. POST to `/auth/login` with email + password.
2. Use the returned `access_token` as `Authorization: Bearer <token>`.

---

## 4. Step 3 — Live Telemetry Arrives

The IoT device reads its ultrasonic/infrared fill sensor and posts a reading every N seconds (typically 30s–5min depending on battery mode).

**HTTP request from device:**

```
POST /telemetry/
X-API-Key: wsk_live_abc123...
Content-Type: application/json

{
  "bin_id": "BIN-001",
  "fill_level_percent": 74,
  "battery_percent": 88,
  "temperature_c": 22.4,
  "humidity_percent": 55
}
```

**Backend file:** `backend/routers/telemetry_update.py`

**What happens inside that endpoint (in order):**

1. **Auth check** — `get_device_or_user()` validates the API key or JWT.
2. **Bin lookup** — Confirms BIN-001 exists; returns 404 if not registered.
3. **Bin state update** — Updates `fill_level_percent`, `status`, `battery_percent`, `temperature_c`, `humidity_percent`, `last_telemetry` on the `BinDB` row.
4. **Status calculation** — `backend/utils.py → determine_bin_status()`:
   - `>= 90%` → `"full"`
   - `>= 80%` → `"warning"`
   - otherwise → `"ok"`
5. **History record** — Inserts a row into `TelemetryDB` (the time-series log; never overwritten).
6. **WebSocket broadcast** — Fires off an async task to push the update to all connected dashboard clients (Step 4).
7. **Push notification check** — If fill crossed 80% or 90% threshold, queues an FCM push notification (Step 5).
8. **ML model update** — Adds the data point to the in-memory predictor (Step 6).
9. **Returns 202 Accepted.**

---

## 5. Step 4 — Real-Time Dashboard Update

The moment telemetry is saved, the dashboard updates without the user having to refresh.

**Backend WebSocket hub:** `backend/routers/websocket_router.py → ConnectionManager`

The `ConnectionManager` class holds all active WebSocket connections in memory. When telemetry arrives, it calls `broadcast_bin_update()` which pushes a JSON message to every connected client simultaneously.

**Message sent to all dashboard clients:**

```json
{
  "event": "bin_update",
  "bin_id": "BIN-001",
  "fill_level_percent": 74,
  "status": "ok",
  "battery_percent": 88,
  "temperature_c": 22.4,
  "humidity_percent": 55,
  "timestamp": "2026-04-03T10:30:00Z"
}
```

If the fill crosses a threshold, an additional alert message is sent:

```json
{
  "event": "bin_alert",
  "bin_id": "BIN-001",
  "level": "warning",
  "message": "Bin BIN-001 is 87% full",
  "timestamp": "2026-04-03T10:30:00Z"
}
```

**Frontend WebSocket client:** `frontend/hooks/useRealtimeBins.ts → useRealtimeBins()`

- Connects to `ws://localhost:8000/ws?token=<jwt>` on mount.
- Automatically reconnects with exponential backoff (2s → 30s max) if disconnected.
- Merges incoming `bin_update` events into the React Query cache so the map, bin cards, and fill bars refresh instantly without a polling round-trip.

**Where it's visible in the UI:**

- Live bin cards: `frontend/components/bin-management.tsx`
- Interactive map markers: `frontend/components/map-client.tsx`
- Status colours update in real time via `frontend/lib/status-mapper.ts`

---

## 6. Step 5 — Push Notifications Fire

When a bin's fill level crosses 80% (warning) or 90% (critical) for the first time, a Firebase Cloud Messaging (FCM) push notification is sent to registered mobile/browser devices.

**Backend file:** `backend/services/notifications.py`

**Trigger thresholds** (defined in `telemetry_update.py`):

- `_WARN_THRESHOLD = 80` → "Bin approaching capacity"
- `_CRIT_THRESHOLD = 90` → "Bin is critically full"

**How device tokens are managed:**

- When a user logs in via the frontend, their browser registers an FCM token via `POST /auth/device-token`.
- Tokens are stored in `DeviceTokenDB` (scoped to a user).
- On notification, the system looks up tokens for relevant users and sends via FCM multicast (up to 500 tokens per batch).

**Firebase setup file:** `backend/firebase_service.py`, using credentials from `backend/firebase-service-account.json`.

If Firebase is not configured, notifications are silently skipped — the rest of the system continues normally.

---

## 7. Step 6 — ML Predictions Update

Every telemetry reading is also fed into the ML prediction engine, which maintains a time-series model per bin entirely in memory.

**Backend file:** `backend/services/ml_predictor.py → BinFillPredictor`

**How the predictor works:**

1. Stores up to the last **480 readings** per bin (~8 hours at 1 reading/min).
2. Calculates the **fill rate** (% per hour) from consecutive readings, ignoring collection events (sudden drops) and outlier spikes (IQR method).
3. Uses a **weighted moving average** of recent rates, giving more weight to newer readings.
4. Extrapolates from the current fill level to estimate **hours until the bin is full**.
5. Assigns a **confidence score** (0–1) based on data quantity and consistency.
6. Requires a minimum of **20 data points** before making any prediction.

**On system startup:** `backend/main.py → lifespan()` calls `prediction_service.rebuild_from_db(db)` which replays all historical telemetry from `TelemetryDB` into the predictor so predictions work immediately after a restart.

**API endpoints:** `backend/routers/predictions.py`

- `GET /predictions/` — all current bin predictions
- `GET /predictions/alerts?hours=24` — bins predicted to fill within N hours
- `GET /predictions/stats` — ML coverage statistics
- `GET /predictions/collection-priority` — bins ranked by urgency
- `POST /predictions/sync-tasks` — auto-create tasks from predicted alerts

---

## 8. Step 7 — Admin Reviews Predictions

The Predictions page shows the admin which bins the ML engine expects to fill soon.

**Frontend page:** `frontend/app/predictions/page.tsx`

**Components on this page:**

- `frontend/components/prediction-service-health.tsx` — Shows ML coverage (% of bins with enough data for predictions), total data points, and system status.
- `frontend/components/prediction-overview.tsx` — The main table of all fill predictions, sortable by fill level, fill rate, or time-to-full. Includes the **timeframe selector** (12h / 24h / 48h) and **Create Tasks** button.
- `frontend/components/prediction-collection-priority.tsx` — Ranked list of bins in order of collection urgency.

**Data is fetched via React Query** (auto-refreshes every 30 seconds):

- `getAllPredictions()` → `GET /predictions/`
- `getPredictedAlerts(timeframe)` → `GET /predictions/alerts?hours=24`
- `getMLStats()` → `GET /predictions/stats`
- `getCollectionPriority()` → `GET /predictions/collection-priority`

---

## 9. Step 8 — Collection Tasks Are Created

Tasks can be created manually or automatically from predictions.

### Manual task creation

- Admin uses the Tasks page.
- A task holds: `title`, `priority` (low/medium/high/critical), `location`, `bin_id`, `due_date`, `estimated_time_minutes`.
- Backend: `POST /tasks/` in `backend/routers/tasks.py`.

### Automatic task creation from ML predictions

- Admin clicks **Create Tasks** on the Predictions page.
- Frontend calls `syncPredictionTasks(timeframe)` → `POST /predictions/sync-tasks?hours=24`.
- Backend (`backend/routers/predictions.py`) scans predicted alerts, creates a `pending` task for each alert, and skips bins that already have an open task.
- Returns: `{ created, updated, skipped_existing }`.

**Crew assignment:**

- `PATCH /tasks/{id}/assign` with `{ "crew_id": "CREW-01" }`.
- When assigned, an FCM notification is sent to the crew's registered devices: _"New collection task assigned to your crew"_.

---

## 10. Step 9 — Route Is Optimized

Once bins are identified and a crew is assigned, the admin generates an optimized collection route.

**Frontend page:** `frontend/app/routes/page.tsx`
**Component:** `frontend/components/route-optimization.tsx`

**Backend file:** `backend/services/route_optimizer.py → RouteOptimizer`

Four algorithms are available:

| Algorithm  | How it works                                | Best for                    |
| ---------- | ------------------------------------------- | --------------------------- |
| `greedy`   | Always go to the nearest unvisited bin      | Fast, simple routes         |
| `priority` | Prioritize highest fill levels first        | When some bins are critical |
| `hybrid`   | Combine distance + urgency score            | Default — balanced approach |
| `two_opt`  | Improve an existing route by swapping pairs | Polishing a greedy route    |

**Request:** `POST /routes/optimize`

```json
{
  "bin_ids": ["BIN-001", "BIN-005", "BIN-012"],
  "crew_id": "CREW-01",
  "start_latitude": 40.7128,
  "start_longitude": -74.006,
  "algorithm": "hybrid",
  "save_route": true
}
```

**Distance calculation:** Haversine formula (great-circle distance between GPS coordinates), assuming 30 km/h average speed for time estimates.

**Result:** An ordered list of waypoints with estimated collection time per bin, total distance in km, and estimated total time in minutes. If `save_route: true`, stored in `RouteHistoryDB`.

---

## 11. Step 10 — Driver Executes the Route

**Frontend page:** `frontend/app/driver/page.tsx`

The driver-specific dashboard is role-restricted — only users with `role: "driver"` can access it.

**Backend:** `backend/routers/driver.py`

**What the driver sees:**

- Their active route with waypoints in collection order.
- Current fill level of each bin on the route.
- Progress bar showing completed vs remaining waypoints.

**During collection, the driver:**

1. **Starts the route** — `PATCH /routes/{id}/status` → status becomes `active`, `started_at` is recorded.
2. **Updates their location** — `POST /driver/location` with `{ latitude, longitude }`. Updates `CrewDB.current_latitude/longitude` so the map shows crew position in real time.
3. **Marks a waypoint done** — `POST /driver/waypoints/done` with `{ bin_id }`. This:
   - Sets `fill_level_percent = 0` on the bin (just emptied).
   - Sets `status = "ok"`.
   - Records `completed_at` on the waypoint.
   - Updates crew progress percentage.
4. **Completes the route** — When all waypoints are done, `PATCH /routes/{id}/status` → `completed`, `completed_at` recorded, crew status flips to `available`.

**Backend files involved:**

- `backend/routers/driver.py` — driver-specific endpoints
- `backend/routers/routes.py → _mark_bin_serviced(), _mark_waypoint_done(), _finalize_route(), _sync_crew_status()`

**Map view:** `frontend/app/map/page.tsx` / `frontend/components/map-client.tsx` — Shows both bin markers (colour-coded by fill status) and crew markers with real-time location from WebSocket or polling.

---

## 12. Step 11 — Collection Complete

When a bin is marked as serviced:

1. `fill_level_percent` resets to `0`, `status` resets to `"ok"`.
2. A new telemetry row with fill = 0 is implicitly created (the bin update itself records the state).
3. The ML predictor receives the new reading. Because fill dropped sharply, it detects a **collection event** and resets its rate model for that bin — future predictions start fresh from 0%.
4. The dashboard map marker turns green.
5. The task linked to that bin is automatically marked `completed`.
6. The route's completion entry is saved to `RouteHistoryDB` for reporting.

---

## 13. Step 12 — Reports & Analytics

**Frontend page:** `frontend/app/reports/page.tsx`
**Component:** `frontend/components/analytics-reports.tsx`

**Backend file:** `backend/routers/reports.py`

Reports cover a configurable time window (default: last 30 days) and include:

- Total bins, bins by status (full/warning/offline)
- Average fill level across all bins
- Routes completed, tasks completed
- Per-crew performance

**Export formats:**

- `GET /reports/export?format=pdf` — PDF via `reportlab`
- `GET /reports/export?format=xlsx` — Excel workbook via `openpyxl`
- `GET /reports/summary` — JSON summary (no admin role required)

---

## 14. User Roles Summary

| Role              | Can do                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `admin`           | Register bins, manage crews, create/assign tasks, generate routes, view all predictions, export reports, generate API keys |
| `user` (operator) | View dashboard, view bins and predictions, view routes                                                                     |
| `driver`          | Access driver dashboard, update location, mark waypoints done, complete routes                                             |

Role is encoded in the JWT. Protected routes in the frontend check role via `frontend/contexts/auth-context.tsx → useAuth()` and `frontend/components/protected-route.tsx`.

Protected backend endpoints use `backend/auth_utils.py → require_admin()` or `get_current_user()`.

---

## 15. Data Flow Diagram

```
Physical Bin Sensor
       │
       │  POST /telemetry/  (every 30s – 5min)
       │  Header: X-API-Key: wsk_live_...
       ▼
┌─────────────────────────────────────────────────┐
│            FastAPI Backend                       │
│  telemetry_update.py                            │
│                                                  │
│  1. Validate API key / JWT                       │
│  2. Update BinDB (fill level, status)            │
│  3. Insert TelemetryDB (history)                 │
│  4. ──► WebSocket broadcast (real-time UI)       │
│  5. ──► FCM push if threshold crossed            │
│  6. ──► ML predictor.add_data_point()            │
└─────────────────────────────────────────────────┘
         │                    │
         │ WebSocket          │ REST (React Query polling)
         ▼                    ▼
┌──────────────────────────────────────────────────┐
│              Next.js Dashboard                    │
│                                                   │
│  useRealtimeBins()         React Query cache      │
│  ├── Bin map markers       ├── /bins              │
│  ├── Fill bar live update  ├── /predictions/      │
│  └── Alert toast           ├── /predictions/alerts│
│                            ├── /tasks             │
│                            ├── /routes            │
│                            └── /crews             │
└──────────────────────────────────────────────────┘
         │
         │ Admin actions
         ▼
   Create Tasks ──► POST /predictions/sync-tasks
   Optimize Route ──► POST /routes/optimize
   Assign Crew ──► PATCH /tasks/{id}/assign
         │
         │ Driver actions
         ▼
   Update Location ──► POST /driver/location
   Mark Waypoint Done ──► POST /driver/waypoints/done
         │
         ▼
   Bin reset to 0% ──► ML predictor resets ──► Cycle repeats
```

---

## Key Files Reference

| Area                | File                                          |
| ------------------- | --------------------------------------------- |
| API entry point     | `backend/main.py`                             |
| All data models     | `backend/models.py`                           |
| Database tables     | `backend/database.py`                         |
| Telemetry ingestion | `backend/routers/telemetry_update.py`         |
| WebSocket hub       | `backend/routers/websocket_router.py`         |
| ML predictor        | `backend/services/ml_predictor.py`            |
| Push notifications  | `backend/services/notifications.py`           |
| Route optimizer     | `backend/services/route_optimizer.py`         |
| Driver endpoints    | `backend/routers/driver.py`                   |
| Reports export      | `backend/routers/reports.py`                  |
| API key auth        | `backend/api_key_services.py`                 |
| IoT simulator       | `backend/simulate_iot.py`                     |
| Frontend API client | `frontend/lib/api-client.ts`                  |
| Real-time WS hook   | `frontend/hooks/useRealtimeBins.ts`           |
| Auth context        | `frontend/contexts/auth-context.tsx`          |
| Bin management UI   | `frontend/components/bin-management.tsx`      |
| Predictions UI      | `frontend/components/prediction-overview.tsx` |
| Map UI              | `frontend/components/map-client.tsx`          |
