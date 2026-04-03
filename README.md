# Smart Waste Management System

An AI-powered IoT waste management platform with real-time bin monitoring, ML fill predictions, route optimization, and a crew management dashboard — built for municipal waste operations in Nagpur, India.

![Tech Stack](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi)
![Firebase](https://img.shields.io/badge/Firebase-Auth-orange?logo=firebase)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- **Live bin monitoring** — IoT sensors push telemetry every 30s; dashboard updates via WebSocket without polling
- **ML fill predictions** — Statistical fill-rate extrapolation forecasts when each bin will reach capacity
- **Anomaly detection** — Z-score sensor analysis flags hardware faults, temperature spikes, and sudden fill jumps
- **Route optimization** — 4 algorithms (Greedy, Priority, Hybrid, 2-Opt) generate optimal collection routes
- **Crew & task management** — Kanban board, task assignment, real-time crew location tracking
- **Interactive map** — Leaflet map with live bin markers, crew positions, and route polylines
- **Push notifications** — Firebase Cloud Messaging alerts when bins cross 80% or 90% fill threshold
- **Report export** — Admin can download PDF or Excel reports covering bins, routes, and tasks
- **PWA driver app** — Installable Android app for field crews with GPS location updates
- **Role-based access** — Admin and user roles with separate views and page guards

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI (Python), SQLAlchemy, PostgreSQL |
| Auth | Firebase Auth (Google + Email), JWT |
| Real-time | WebSocket, Firebase Cloud Messaging |
| ML | NumPy statistical models (fill predictor, Z-score anomaly detector) |
| Maps | Leaflet + OpenStreetMap (no API key required) |
| IoT Auth | SHA-256 hashed API keys (`wsk_live_` prefix) |

---

## Project Structure

```
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── database.py              # SQLAlchemy models
│   ├── routers/                 # auth, bins, telemetry, crews, tasks, routes, predictions, reports, driver, websocket
│   ├── services/
│   │   ├── ml_predictor.py      # Fill prediction + anomaly detection
│   │   ├── route_optimizer.py   # 4 routing algorithms
│   │   └── notifications.py     # FCM push notifications
│   └── requirements.txt
│
└── frontend/
    ├── app/                     # Next.js App Router pages
    ├── components/              # UI components
    ├── contexts/auth-context.tsx
    ├── lib/api-client.ts        # Centralized API client with auto token refresh
    └── lib/useRealtimeBins.ts   # WebSocket hook with exponential backoff
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15

### Backend

```bash
cd backend
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env

# Run database migrations and seed demo users
python seed_users.py

# Start the server
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install

# Copy and fill in environment variables
cp .env.example .env.local

npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/smart_waste
SECRET_KEY=your-secret-key-here
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
FIREBASE_PROJECT_ID=your-firebase-project-id
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_MAP_CENTER_LAT=21.1458
NEXT_PUBLIC_MAP_CENTER_LNG=79.0882
```

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin@1234` |
| User | `user@example.com` | `User@1234` |

---

## IoT Device Integration

Register a device API key (admin only) and send telemetry via HTTP:

```bash
# Create an API key
POST /auth/api-keys  { "label": "Bin Sensor - Site A" }

# Send telemetry from your ESP32/Raspberry Pi
POST /telemetry
X-API-Key: wsk_live_your_key_here
{
  "bin_id": "BIN-001",
  "fill_level_percent": 72,
  "battery_percent": 85,
  "temperature_c": 28.5
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

MIT License — see [LICENSE](LICENSE) for details.
