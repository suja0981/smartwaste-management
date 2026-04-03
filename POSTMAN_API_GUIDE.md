# Smart Waste Management — Postman API Guide

**Version**: 3.0 | **Updated**: April 2026  
**Base URL**: `http://localhost:8000`  
**Auth**: JWT Bearer token (most endpoints) or `X-API-Key` header (telemetry only)

---

## Table of Contents

1. [Setup & Configuration](#1-setup--configuration)
2. [Authentication — `/auth`](#2-authentication--auth)
3. [Bins — `/bins`](#3-bins--bins)
4. [Telemetry — `/telemetry`](#4-telemetry--telemetry)
5. [Tasks — `/tasks`](#5-tasks--tasks)
6. [Crews — `/crews`](#6-crews--crews)
7. [Route Optimization — `/routes`](#7-route-optimization--routes)
8. [ML Predictions — `/predictions`](#8-ml-predictions--predictions)
9. [Statistics — `/stats`](#9-statistics--stats)
10. [Reports — `/reports`](#10-reports--reports)
11. [Driver — `/driver`](#11-driver--driver)
12. [WebSocket — `/ws`](#12-websocket--ws)
13. [Error Reference](#13-error-reference)
14. [Quick Test Scenario](#14-quick-test-scenario)

---

## 1. Setup & Configuration

### Postman Environment Variables

Create a Postman environment with these variables:

| Variable        | Initial Value           | Description        |
| --------------- | ----------------------- | ------------------ |
| `base_url`      | `http://localhost:8000` | Backend base URL   |
| `access_token`  | _(set after login)_     | JWT access token   |
| `refresh_token` | _(set after login)_     | JWT refresh token  |
| `api_key`       | `wsk_live_...`          | IoT device API key |

### Auth Header (all protected endpoints)

```
Authorization: Bearer {{access_token}}
```

### Content-Type (all POST/PATCH/PUT requests)

```
Content-Type: application/json
```

### Auto-save Token After Login (Postman Test Script)

Paste this into the **Tests** tab of your login request in Postman:

```javascript
const body = pm.response.json();
if (body.access_token) {
  pm.environment.set("access_token", body.access_token);
  pm.environment.set("refresh_token", body.refresh_token);
}
```

---

## 2. Authentication — `/auth`

### POST /auth/signup

Create a new account.

```
POST {{base_url}}/auth/signup
```

**Body:**

```json
{
  "email": "jane@example.com",
  "password": "Secure@1234",
  "full_name": "Jane Doe"
}
```

Password rules: minimum 8 characters, at least one uppercase, one digit, one special character (`@`, `!`, `#`, etc.)

**Response `200 OK`:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": 3,
    "email": "jane@example.com",
    "full_name": "Jane Doe",
    "role": "user",
    "is_active": true
  }
}
```

---

### POST /auth/login

Log in with email and password.

```
POST {{base_url}}/auth/login
```

**Body:**

```json
{
  "email": "admin@example.com",
  "password": "Admin@1234"
}
```

**Response `200 OK`:** Same shape as signup.

Demo accounts (seeded with `python seed_users.py`):

- `admin@example.com` / `Admin@1234` — role: `admin`
- `user@example.com` / `User@1234` — role: `user`

---

### POST /auth/firebase

Exchange a Firebase ID token for a backend JWT.

```
POST {{base_url}}/auth/firebase
```

**Body:**

```json
{
  "id_token": "<firebase_id_token_from_client>"
}
```

**Response `200 OK`:** Same shape as login.

---

### GET /auth/me

Get currently authenticated user's profile.

```
GET {{base_url}}/auth/me
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "id": 1,
  "email": "admin@example.com",
  "full_name": "Admin User",
  "role": "admin",
  "is_active": true
}
```

---

### GET /auth/settings

Get user preferences and notification settings.

```
GET {{base_url}}/auth/settings
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "full_name": "Admin User",
  "email": "admin@example.com",
  "notifications": {
    "criticalBins": true,
    "routeUpdates": true,
    "systemAlerts": false,
    "emailDigest": false,
    "pushEnabled": true
  },
  "display": {
    "compactMode": false,
    "autoRefresh": true
  }
}
```

---

### PUT /auth/settings

Update user preferences.

```
PUT {{base_url}}/auth/settings
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "full_name": "Admin Updated",
  "notifications": {
    "criticalBins": true,
    "routeUpdates": false,
    "systemAlerts": true,
    "emailDigest": false,
    "pushEnabled": true
  },
  "display": {
    "compactMode": true,
    "autoRefresh": true
  }
}
```

**Response `200 OK`:** Updated settings object.

---

### POST /auth/refresh

Get a new access token using a refresh token.

```
POST {{base_url}}/auth/refresh
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "refresh_token": "{{refresh_token}}"
}
```

**Response `200 OK`:**

```json
{
    "access_token": "eyJhbGciOiJIUzI...",
    "refresh_token": "eyJhbGciOiJIUzI...",
    "token_type": "bearer",
    "expires_in": 1800,
    "user": { ... }
}
```

---

### POST /auth/logout

Invalidate the current token. The token is added to a blacklist JTI table.

```
POST {{base_url}}/auth/logout
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{ "message": "Logout successful" }
```

---

### POST /auth/device-token

Register a Firebase Cloud Messaging token for push notifications.

```
POST {{base_url}}/auth/device-token
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "token": "fcm_device_token_from_firebase_sdk",
  "platform": "android"
}
```

**Response `201 Created`:**

```json
{ "message": "Device token registered" }
```

---

### DELETE /auth/device-token

Remove a registered push notification token.

```
DELETE {{base_url}}/auth/device-token?token=<fcm_token>
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{ "message": "Device token deleted" }
```

---

### POST /auth/api-keys

Generate a new IoT device API key. **Admin only.**

```
POST {{base_url}}/auth/api-keys
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "label": "Rooftop sensors – Zone North"
}
```

**Response `201 Created`:**

```json
{
  "key_id": 1,
  "label": "Rooftop sensors – Zone North",
  "key": "wsk_live_Abc123...xyz",
  "is_active": true,
  "created_at": "2026-04-03T10:00:00Z",
  "last_used_at": null
}
```

> The `key` field is shown **only once**. Store it immediately.

---

### GET /auth/api-keys

List all API keys (metadata only, not the raw keys). **Admin only.**

```
GET {{base_url}}/auth/api-keys
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:** Array of key metadata.

---

### DELETE /auth/api-keys/{key_id}

Revoke an API key. **Admin only.**

```
DELETE {{base_url}}/auth/api-keys/1
Authorization: Bearer {{access_token}}
```

**Response `204 No Content`**

---

## 3. Bins — `/bins`

### GET /bins/

List all bins. Optional query filters:

| Param      | Type   | Example | Description                                       |
| ---------- | ------ | ------- | ------------------------------------------------- |
| `zone_id`  | string | `north` | Filter by zone                                    |
| `status`   | string | `full`  | `ok \| warning \| full \| offline \| maintenance` |
| `min_fill` | int    | `80`    | Minimum fill level %                              |

```
GET {{base_url}}/bins/
GET {{base_url}}/bins/?status=full
GET {{base_url}}/bins/?zone_id=north&min_fill=70
```

**Response `200 OK`:**

```json
[
  {
    "id": "BIN001",
    "location": "Market Street",
    "latitude": 21.1458,
    "longitude": 79.0882,
    "capacity_liters": 1000,
    "fill_level_percent": 87,
    "status": "full",
    "zone_id": "north"
  }
]
```

---

### GET /bins/{bin_id}

Get a single bin by ID.

```
GET {{base_url}}/bins/BIN001
```

**Response `200 OK`:** Single bin object.

---

### POST /bins/

Create a new bin.

```
POST {{base_url}}/bins/
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "id": "BIN001",
  "location": "Market Street, Nagpur",
  "capacity_liters": 1000,
  "fill_level_percent": 0,
  "latitude": 21.1458,
  "longitude": 79.0882
}
```

**Response `201 Created`:** Full bin object.

---

### PATCH /bins/{bin_id}

Update bin fields. All fields optional.

```
PATCH {{base_url}}/bins/BIN001
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "location": "Updated Location",
  "capacity_liters": 1500,
  "fill_level_percent": 45,
  "status": "ok",
  "latitude": 21.15,
  "longitude": 79.09
}
```

**Response `200 OK`:** Updated bin object.

---

### PATCH /bins/{bin_id}/zone

Assign a bin to a zone. **Admin only.**

```
PATCH {{base_url}}/bins/BIN001/zone?zone_id=north
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "bin_id": "BIN001",
  "zone_id": "north",
  "updated": true
}
```

---

### DELETE /bins/{bin_id}

Delete a bin.

```
DELETE {{base_url}}/bins/BIN001
Authorization: Bearer {{access_token}}
```

**Response `204 No Content`**

---

## 4. Telemetry — `/telemetry`

### POST /telemetry/

Push a sensor reading from an IoT device. Requires either an API key or a JWT token.

```
POST {{base_url}}/telemetry/
X-API-Key: {{api_key}}
Content-Type: application/json
```

**Body:**

```json
{
  "bin_id": "BIN001",
  "fill_level_percent": 85,
  "battery_percent": 72,
  "temperature_c": 28.5,
  "humidity_percent": 65,
  "timestamp": "2026-04-03T12:00:00Z"
}
```

`timestamp` is optional (defaults to server time). `battery_percent`, `temperature_c`, `humidity_percent` are optional.

**Response `202 Accepted`:**

```json
{
  "status": "accepted",
  "bin_id": "BIN001",
  "fill_level_percent": 85,
  "bin_status": "full",
  "fcm_alert_sent": true
}
```

Side effects on success:

- Bin's `fill_level_percent` and `status` updated
- WebSocket broadcast sent to all connected dashboards
- FCM push notification sent if fill crosses 80% or 90% threshold
- ML model updated with new data point

---

### GET /telemetry/{bin_id}

Get telemetry history for a bin.

```
GET {{base_url}}/telemetry/BIN001
```

**Response `200 OK`:**

```json
[
  {
    "id": 1234,
    "bin_id": "BIN001",
    "fill_level_percent": 85,
    "battery_percent": 72,
    "temperature_c": 28.5,
    "humidity_percent": 65,
    "timestamp": "2026-04-03T12:00:00Z"
  }
]
```

---

## 5. Tasks — `/tasks`

### GET /tasks/

List all tasks. Optional query filters:

| Param      | Type   | Example   | Description                           |
| ---------- | ------ | --------- | ------------------------------------- |
| `status`   | string | `pending` | `pending \| in-progress \| completed` |
| `priority` | string | `high`    | `low \| medium \| high`               |
| `crew_id`  | string | `CREW001` | Filter by crew                        |
| `zone_id`  | string | `north`   | Filter by bin zone                    |

```
GET {{base_url}}/tasks/
GET {{base_url}}/tasks/?status=pending&priority=high
```

**Response `200 OK`:**

```json
[
  {
    "id": "TASK001",
    "title": "Collect from Market Street",
    "description": "Bin is 94% full",
    "priority": "high",
    "status": "pending",
    "bin_id": "BIN001",
    "location": "Market Street",
    "estimated_time_minutes": 30,
    "crew_id": null,
    "alert_id": null,
    "created_at": "2026-04-03T10:00:00Z",
    "due_date": "2026-04-03T18:00:00Z",
    "completed_at": null
  }
]
```

---

### GET /tasks/{task_id}

Get a single task.

```
GET {{base_url}}/tasks/TASK001
```

---

### POST /tasks/

Create a task.

```
POST {{base_url}}/tasks/
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "id": "TASK001",
  "title": "Collect from Market Street",
  "description": "Bin is at critical fill level",
  "priority": "high",
  "location": "Market Street, Nagpur",
  "bin_id": "BIN001",
  "estimated_time_minutes": 30,
  "due_date": "2026-04-03T18:00:00Z"
}
```

**Response `201 Created`:** Full task object.

---

### PATCH /tasks/{task_id}

Update task fields. All fields optional.

```
PATCH {{base_url}}/tasks/TASK001
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "title": "Updated title",
  "priority": "medium",
  "status": "in-progress",
  "crew_id": "CREW001",
  "estimated_time_minutes": 45
}
```

**Response `200 OK`:** Updated task object.

---

### POST /tasks/{task_id}/assign

Assign a task to a crew.

```
POST {{base_url}}/tasks/TASK001/assign
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "crew_id": "CREW001"
}
```

**Response `200 OK`:** Task object with `crew_id` set.

---

### DELETE /tasks/{task_id}

Delete a task.

```
DELETE {{base_url}}/tasks/TASK001
Authorization: Bearer {{access_token}}
```

**Response `204 No Content`**

---

## 6. Crews — `/crews`

### GET /crews/

List all crews.

```
GET {{base_url}}/crews/
GET {{base_url}}/crews/?zone_id=north
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
[
  {
    "id": "CREW001",
    "name": "Alpha Team",
    "leader": "Rahul Sharma",
    "members_count": 4,
    "status": "available",
    "phone": "+91-9999999999",
    "email": "alpha@company.com",
    "current_location": "Depot",
    "current_latitude": 21.1458,
    "current_longitude": 79.0882,
    "zone_id": "north",
    "created_at": "2026-04-01T08:00:00Z"
  }
]
```

---

### GET /crews/{crew_id}

Get a single crew.

```
GET {{base_url}}/crews/CREW001
Authorization: Bearer {{access_token}}
```

---

### POST /crews/

Create a crew.

```
POST {{base_url}}/crews/
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "id": "CREW001",
  "name": "Alpha Team",
  "leader": "Rahul Sharma",
  "members_count": 4,
  "phone": "+91-9999999999",
  "email": "alpha@company.com",
  "current_latitude": 21.1458,
  "current_longitude": 79.0882
}
```

**Response `201 Created`:** Full crew object.

---

### PATCH /crews/{crew_id}

Update crew fields. All fields optional.

```
PATCH {{base_url}}/crews/CREW001
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "name": "Alpha Team Updated",
  "members_count": 5,
  "status": "active",
  "current_location": "Zone North Depot",
  "current_latitude": 21.15,
  "current_longitude": 79.09
}
```

Valid statuses: `available | active | offline`

**Response `200 OK`:** Updated crew object.

---

### PATCH /crews/{crew_id}/zone

Assign a crew to a zone. **Admin only.**

```
PATCH {{base_url}}/crews/CREW001/zone?zone_id=north
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "crew_id": "CREW001",
  "zone_id": "north",
  "updated": true
}
```

---

### GET /crews/{crew_id}/tasks

Get all tasks assigned to a crew.

```
GET {{base_url}}/crews/CREW001/tasks
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:** Array of task objects.

---

### DELETE /crews/{crew_id}

Delete a crew.

```
DELETE {{base_url}}/crews/CREW001
Authorization: Bearer {{access_token}}
```

**Response `204 No Content`**

---

## 7. Route Optimization — `/routes`

### POST /routes/optimize

Generate an optimized collection route.

```
POST {{base_url}}/routes/optimize
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "bin_ids": ["BIN001", "BIN002", "BIN003", "BIN004"],
  "crew_id": "CREW001",
  "algorithm": "hybrid",
  "start_latitude": 21.1458,
  "start_longitude": 79.0882,
  "save_route": true
}
```

**`algorithm` options:**
| Value | Description |
|---|---|
| `greedy` | Nearest-neighbor greedy approach — fastest |
| `priority` | Sorts by fill level (highest first) |
| `hybrid` | Priority then greedy — best balance |
| `two_opt` | 2-opt local search — most efficient path |

`save_route: true` persists the route to the database and assigns it to the crew.

**Response `200 OK`:**

```json
{
  "route_id": "route_a1b2c3d4",
  "algorithm": "hybrid",
  "total_distance_km": 12.8,
  "estimated_time_minutes": 96.0,
  "bin_count": 4,
  "efficiency_score": 0.3125,
  "waypoints": [
    {
      "bin_id": "BIN004",
      "latitude": 21.152,
      "longitude": 79.093,
      "fill_level": 94,
      "order": 1,
      "estimated_collection_time": 10,
      "done": false
    }
  ]
}
```

---

### POST /routes/compare

Run all 4 algorithms on the same bin set and compare results.

```
POST {{base_url}}/routes/compare
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "bin_ids": ["BIN001", "BIN002", "BIN003", "BIN004"],
  "start_latitude": 21.1458,
  "start_longitude": 79.0882
}
```

**Response `200 OK`:**

```json
{
  "algorithms": [
    {
      "algorithm": "greedy",
      "total_distance_km": 14.2,
      "estimated_time_minutes": 106.5,
      "bin_count": 4,
      "efficiency_score": 0.281
    },
    {
      "algorithm": "priority",
      "total_distance_km": 15.8,
      "estimated_time_minutes": 118.5,
      "bin_count": 4,
      "efficiency_score": 0.253
    },
    {
      "algorithm": "hybrid",
      "total_distance_km": 12.8,
      "estimated_time_minutes": 96.0,
      "bin_count": 4,
      "efficiency_score": 0.313
    },
    {
      "algorithm": "two_opt",
      "total_distance_km": 12.1,
      "estimated_time_minutes": 90.75,
      "bin_count": 4,
      "efficiency_score": 0.331
    }
  ],
  "recommended": "two_opt"
}
```

---

### GET /routes/

List all saved routes.

```
GET {{base_url}}/routes/
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:** Array of route objects.

---

### GET /routes/analytics/performance

Get route performance analytics (distances, times, efficiency scores).

```
GET {{base_url}}/routes/analytics/performance
Authorization: Bearer {{access_token}}
```

---

### GET /routes/{route_id}

Get a single saved route by ID.

```
GET {{base_url}}/routes/route_a1b2c3d4
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:** Full route object with waypoints array.

---

### PATCH /routes/{route_id}/status

Update route status. This is the single endpoint for starting, pausing, completing, or cancelling a route.

```
PATCH {{base_url}}/routes/route_a1b2c3d4/status
Authorization: Bearer {{access_token}}
```

**Valid status values:**
| `status` | Effect |
|---|---|
| `active` | Starts the route — sets `started_at`, assigns tasks to crew, updates crew status to `active` |
| `paused` | Pauses in-progress tasks back to `pending` |
| `completed` | Marks all bin tasks complete, resets bin fill levels to 0, records route history |
| `cancelled` | Cancels the route |

**Body to start a route:**

```json
{
  "status": "active"
}
```

**Body to complete with actual time:**

```json
{
  "status": "completed",
  "actual_time_minutes": 102.5,
  "notes": "Bin BIN003 was inaccessible — skipped"
}
```

**Response `200 OK`:** Updated route object.

---

### DELETE /routes/{route_id}

Delete a saved route.

```
DELETE {{base_url}}/routes/route_a1b2c3d4
Authorization: Bearer {{access_token}}
```

**Response `204 No Content`**

---

## 8. ML Predictions — `/predictions`

The ML service uses a weighted moving average with IQR outlier removal. It needs **at least 20 telemetry readings** per bin before predictions are available.

### GET /predictions/predict/{bin_id}

Predict when a bin will be full.

```
GET {{base_url}}/predictions/predict/BIN001
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "bin_id": "BIN001",
  "current_fill_percent": 75,
  "fill_rate_per_hour": 3.2,
  "predicted_full_at": "2026-04-03T18:30:00Z",
  "hours_until_full": 7.8,
  "confidence": 0.91,
  "recommendation": "SCHEDULE_COLLECTION"
}
```

`recommendation` values: `URGENT_COLLECTION | SCHEDULE_COLLECTION | MONITOR | NO_ACTION`

---

### GET /predictions/analyze/{bin_id}

Full bin analysis — fill rate, anomalies, health score.

```
GET {{base_url}}/predictions/analyze/BIN001
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "bin_id": "BIN001",
  "current_fill": 75,
  "average_daily_fill_rate": 7.68,
  "data_points": 48,
  "anomalies_detected": 1,
  "confidence": 0.91,
  "health_score": 0.88
}
```

---

### GET /predictions/collection-priority

Get all bins sorted by collection urgency (highest fill and fastest rate first).

```
GET {{base_url}}/predictions/collection-priority
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:** `["BIN004", "BIN001", "BIN007", ...]`

---

### GET /predictions/anomalies/{bin_id}

Get detected anomalies for a bin (sudden spikes, temperature issues, hardware faults).

```
GET {{base_url}}/predictions/anomalies/BIN001
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
[
  {
    "timestamp": "2026-04-03T09:15:00Z",
    "fill_level_percent": 95,
    "z_score": 3.8,
    "anomaly_type": "sudden_spike",
    "severity": "high"
  }
]
```

---

### GET /predictions/collection/recommend/{bin_id}

Get a specific collection recommendation for one bin.

```
GET {{base_url}}/predictions/collection/recommend/BIN001
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "bin_id": "BIN001",
  "recommended_action": "SCHEDULE_COLLECTION",
  "confidence": 0.91,
  "predicted_full_at": "2026-04-03T18:30:00Z",
  "current_fill": 75
}
```

---

### GET /predictions/collection/optimize

Get the optimal collection order for all bins with sufficient data.

```
GET {{base_url}}/predictions/collection/optimize
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:** `["BIN004", "BIN001", "BIN007"]` — ordered by urgency.

---

### GET /predictions/patterns/{bin_id}

Get hourly fill patterns for a bin.

```
GET {{base_url}}/predictions/patterns/BIN001
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "bin_id": "BIN001",
  "data_points": 48,
  "hourly_fill_rates": {
    "08": 4.2,
    "12": 6.8,
    "17": 5.1
  },
  "peak_hours": [12, 17, 8],
  "average_fill_rate_per_hour": 3.2
}
```

---

### GET /predictions/stats

Get ML service health and coverage statistics.

```
GET {{base_url}}/predictions/stats
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "service_status": "healthy",
  "bins_tracked": 10,
  "bins_with_predictions": 8,
  "bins_insufficient_data": 2,
  "total_data_points": 480,
  "average_confidence": 0.89,
  "last_rebuild": "2026-04-03T14:00:00Z"
}
```

---

### GET /predictions/predictions/all

Get all current predictions for all tracked bins.

```
GET {{base_url}}/predictions/predictions/all
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:** Array of prediction objects, one per tracked bin.

---

### GET /predictions/alerts/predicted

Get bins predicted to fill up within a time window.

```
GET {{base_url}}/predictions/alerts/predicted?hours_ahead=24
Authorization: Bearer {{access_token}}
```

| Param         | Default | Description                  |
| ------------- | ------- | ---------------------------- |
| `hours_ahead` | `24`    | How many hours ahead to look |

**Response `200 OK`:**

```json
[
  {
    "bin_id": "BIN004",
    "current_fill_percent": 88,
    "predicted_full_at": "2026-04-03T20:00:00Z",
    "hours_until_full": 6.0,
    "confidence": 0.93,
    "urgency": "critical"
  }
]
```

---

### POST /predictions/alerts/predicted/tasks

Create collection tasks from predicted alerts (bins expected to fill soon).

```
POST {{base_url}}/predictions/alerts/predicted/tasks
Authorization: Bearer {{access_token}}
```

**Query params:**

```
?hours_ahead=12   (default: 24)
```

**Response `200 OK`:**

```json
{
  "tasks_created": 3,
  "tasks_skipped": 1,
  "message": "3 collection tasks created from predicted alerts"
}
```

---

### POST /predictions/seed

Rebuild ML models from all telemetry in the database (admin operation).

```
POST {{base_url}}/predictions/seed
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "message": "Prediction models rebuilt",
  "bins_loaded": 10,
  "data_points_loaded": 480
}
```

---

### POST /predictions/train

Alias for `/predictions/seed` — triggers a model rebuild.

```
POST {{base_url}}/predictions/train
Authorization: Bearer {{access_token}}
```

---

## 9. Statistics — `/stats`

### GET /stats/

Dashboard summary: bin counts, fill totals, active tasks and crews.

```
GET {{base_url}}/stats/
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "total_bins": 10,
  "bins_online": 9,
  "bins_full": 2,
  "bins_warning": 3,
  "bins_offline": 1,
  "average_fill_level": 58.4,
  "tasks": {
    "total": 15,
    "pending": 8,
    "in_progress": 4,
    "completed": 3
  },
  "crews": {
    "total": 3,
    "available": 2,
    "active": 1,
    "offline": 0
  }
}
```

---

### GET /stats/bins

Bin status and fill level distribution breakdown.

```
GET {{base_url}}/stats/bins
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "by_status": {
    "ok": 4,
    "warning": 3,
    "full": 2,
    "offline": 1,
    "maintenance": 0
  },
  "fill_distribution": {
    "0-25": 1,
    "26-50": 3,
    "51-75": 3,
    "76-100": 3
  },
  "total": 10
}
```

---

### GET /stats/zones

Per-zone bin statistics.

```
GET {{base_url}}/stats/zones
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "north": {
    "total": 4,
    "full": 1,
    "warning": 1,
    "ok": 2,
    "offline": 0,
    "average_fill": 62.5
  },
  "south": {
    "total": 6,
    "full": 1,
    "warning": 2,
    "ok": 2,
    "offline": 1,
    "average_fill": 55.8
  }
}
```

---

### GET /stats/telemetry/recent

Telemetry activity for the last 24 hours.

```
GET {{base_url}}/stats/telemetry/recent
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "readings_last_24h": 480,
  "bins_reporting_last_24h": 9,
  "average_readings_per_bin": 53.3
}
```

---

### GET /stats/trends

Fill level trends over time.

```
GET {{base_url}}/stats/trends?days=7
Authorization: Bearer {{access_token}}
```

| Param  | Default | Description               |
| ------ | ------- | ------------------------- |
| `days` | `30`    | Number of days to analyze |

**Response `200 OK`:** Time-series data per day.

---

## 10. Reports — `/reports`

Reports require **admin** role.

### GET /reports/export

Download a PDF or Excel report.

```
GET {{base_url}}/reports/export?format=pdf&days=30
Authorization: Bearer {{access_token}}
```

| Param    | Type   | Default      | Description           |
| -------- | ------ | ------------ | --------------------- |
| `format` | string | **required** | `pdf` or `xlsx`       |
| `days`   | int    | `30`         | Report period in days |

**Response `200 OK`:** Binary file download.

- Content-Type for PDF: `application/pdf`
- Content-Type for Excel: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**In Postman:** Click **Send and Download** to save the file.

Report contents:

- **Executive KPI summary**: total bins, average fill, routes completed, km driven, tasks completed
- **Bin status table**: all bins with fill %, status, zone
- **Route history** (last N days): distance, time, efficiency score per route
- **Task list** (last N days): title, priority, status, crew, completion date

---

### GET /reports/summary

Get report data as JSON (no file download).

```
GET {{base_url}}/reports/summary?days=30
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
{
  "period_days": 30,
  "generated_at": "2026-04-03T14:00:00Z",
  "kpis": {
    "total_bins": 10,
    "avg_fill_level": 58.4,
    "bins_full": 2,
    "bins_warning": 3,
    "bins_offline": 1,
    "routes_completed": 12,
    "total_distance_km": 154.6,
    "total_bins_collected": 87,
    "tasks_completed": 34
  }
}
```

---

## 11. Driver — `/driver`

Endpoints for field crew members. Requires a JWT with role `driver` or `admin`.

### GET /driver/tasks

Get tasks assigned to the authenticated driver's crew.

```
GET {{base_url}}/driver/tasks
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:**

```json
[
  {
    "id": "TASK001",
    "title": "Collect from Market Street",
    "location": "Market Street",
    "priority": "high",
    "status": "in-progress",
    "bin_id": "BIN001",
    "estimated_time_minutes": 30
  }
]
```

---

### GET /driver/route/current

Get the active route assigned to the authenticated driver's crew.

```
GET {{base_url}}/driver/route/current
Authorization: Bearer {{access_token}}
```

**Response `200 OK`:** Full route object with waypoints array. Returns `null` if no active route.

---

### POST /driver/tasks/{task_id}/complete

Mark a task as completed by the driver.

```
POST {{base_url}}/driver/tasks/TASK001/complete
Authorization: Bearer {{access_token}}
```

**Body (optional):**

```json
{
  "photo_url": "https://storage.example.com/photos/task001.jpg",
  "notes": "Bin collected. Area cleared."
}
```

**Response `200 OK`:** Updated task with `status: "completed"`.

---

### POST /driver/route/{route_id}/waypoint-done

Mark a single waypoint (bin pickup) as complete on a route.

```
POST {{base_url}}/driver/route/route_a1b2c3d4/waypoint-done
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "bin_id": "BIN001",
  "photo_url": "https://storage.example.com/photos/bin001.jpg"
}
```

**Response `200 OK`:**

```json
{
  "message": "Waypoint marked done",
  "bin_id": "BIN001",
  "remaining_waypoints": 2
}
```

---

### POST /driver/location

Update the driver's current GPS location (used for live map).

```
POST {{base_url}}/driver/location
Authorization: Bearer {{access_token}}
```

**Body:**

```json
{
  "latitude": 21.1458,
  "longitude": 79.0882,
  "accuracy": 5.0
}
```

**Response `200 OK`:**

```json
{ "message": "Location updated" }
```

---

## 12. WebSocket — `/ws`

### Real-Time Bin Updates

```
ws://localhost:8000/ws?token=<access_token>
```

Connect using JWT. The connection is rejected with code `4001` if the token is missing or invalid.

**Messages pushed by server:**

**Bin update** (triggered on every telemetry ingestion):

```json
{
  "event": "bin_update",
  "bin_id": "BIN001",
  "fill_level_percent": 87,
  "status": "full",
  "battery_percent": 72,
  "temperature_c": 28.5,
  "humidity_percent": 60,
  "timestamp": "2026-04-03T14:15:00Z"
}
```

**Bin alert** (triggered at 80% and 90% fill thresholds):

```json
{
  "event": "bin_alert",
  "bin_id": "BIN001",
  "level": "critical",
  "message": "Bin BIN001 is 90% full",
  "timestamp": "2026-04-03T14:15:00Z"
}
```

**Testing WebSocket in Postman:**

1. Create a new request → set URL to `ws://localhost:8000/ws?token=<your_token>`
2. Click **Connect**
3. Run `python simulate_iot.py --fast` in a terminal to generate messages

---

## 13. Error Reference

| HTTP Code                   | Meaning                  | Common Cause                                             |
| --------------------------- | ------------------------ | -------------------------------------------------------- |
| `400 Bad Request`           | Invalid request body     | Failed Pydantic validation (missing field, wrong type)   |
| `401 Unauthorized`          | Missing or invalid token | Token expired, not included, or blacklisted after logout |
| `403 Forbidden`             | Insufficient permissions | Accessing admin endpoint as regular user                 |
| `404 Not Found`             | Resource doesn't exist   | Wrong bin ID, task ID, etc.                              |
| `409 Conflict`              | Duplicate ID             | Creating a bin/crew/task with an ID that already exists  |
| `422 Unprocessable Entity`  | Schema validation failed | JSON field type mismatch, constraint violation           |
| `429 Too Many Requests`     | Rate limit exceeded      | Auth endpoint: 10 req/min. General: 60 req/min           |
| `500 Internal Server Error` | Backend crash            | Check server logs                                        |

**Error response shape:**

```json
{
  "detail": "Human-readable error message here"
}
```

---

## 14. Quick Test Scenario

Run these requests in order to test the full system end-to-end:

```
1. POST /auth/login            → get tokens
2. POST /bins/                 → create BIN001
3. POST /crews/                → create CREW001
4. POST /tasks/                → create TASK001 linked to BIN001
5. POST /tasks/TASK001/assign  → assign to CREW001
6. POST /telemetry/            → push sensor reading (X-API-Key)
7. GET /bins/BIN001            → verify fill level updated
8. GET /predictions/predict/BIN001  → check if model has enough data
9. POST /routes/optimize       → generate route for [BIN001]
10. PATCH /routes/{id}/status  → set status to "active"
11. GET /stats/                → view updated dashboard stats
12. GET /reports/export?format=pdf → download report
```
