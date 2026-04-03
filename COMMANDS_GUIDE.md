# Smart Waste Management — Commands Guide

**Version**: 3.0 | **Updated**: April 2026  
**Stack**: FastAPI · PostgreSQL (Neon) · Next.js 14 · Firebase

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Environment Setup](#2-environment-setup)
3. [Backend Commands](#3-backend-commands)
4. [Database & Migrations](#4-database--migrations)
5. [Frontend Commands](#5-frontend-commands)
6. [Data Seeding & Simulation](#6-data-seeding--simulation)
7. [Testing](#7-testing)
8. [Local PostgreSQL with Docker](#8-local-postgresql-with-docker)
9. [Troubleshooting](#9-troubleshooting)
10. [Quick Reference Card](#10-quick-reference-card)

---

## 1. Quick Start

### Full Stack (Frontend + Backend)

Open three separate PowerShell terminals:

```powershell
# Terminal 1 — Backend
cd d:\smart-waste-management\backend
.venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

```powershell
# Terminal 2 — Frontend
cd d:\smart-waste-management\frontend
pnpm dev
```

```powershell
# Terminal 3 — IoT Simulator (optional, generates live data)
cd d:\smart-waste-management\backend
.venv\Scripts\Activate.ps1
python simulate_iot.py --fast
```

**URLs:**
| Service | URL |
|---|---|
| Frontend dashboard | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger UI (dev only) | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

---

## 2. Environment Setup

### First-Time Setup

#### Step 1 — Create Python virtual environment

```powershell
cd d:\smart-waste-management\backend
python -m venv .venv
```

Verify Python version (must be 3.10+):

```powershell
python --version
```

#### Step 2 — Activate the virtual environment

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1

# You should see (.venv) at the start of each prompt line
```

Deactivate when done:

```powershell
deactivate
```

#### Step 3 — Install backend dependencies

```powershell
pip install -r requirements.txt
```

Verify key packages:

```powershell
pip list | Select-String "fastapi|uvicorn|sqlalchemy|alembic|psycopg2"
# Expected:
#   alembic              1.18.4
#   fastapi              0.104.1
#   psycopg2-binary      2.9.9
#   SQLAlchemy           2.0.31
#   uvicorn              0.24.0
```

#### Step 4 — Create backend `.env`

```powershell
copy .env.example .env
```

Then open `backend/.env` and fill in your real values. At minimum you need:

```env
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=your-generated-secret

# From Neon dashboard (or local docker-compose postgres)
DATABASE_URL=postgresql://user:password@host:5432/smart_waste?sslmode=require

# Your Firebase project ID
FIREBASE_PROJECT_ID=your-project-id

# Your IoT API key
IOT_API_KEY=wsk_live_your-generated-key
```

#### Step 5 — Run database migrations

```powershell
cd d:\smart-waste-management\backend
.venv\Scripts\Activate.ps1
python -m alembic upgrade head
```

#### Step 6 — Seed demo users

```powershell
python seed_users.py
```

Creates two accounts:
| Email | Password | Role |
|---|---|---|
| admin@example.com | Admin@1234 | admin |
| user@example.com | User@1234 | user |

#### Step 7 — Install frontend dependencies

```powershell
cd d:\smart-waste-management\frontend
pnpm install
```

Verify Node.js version (must be 18+):

```powershell
node --version
pnpm --version
```

#### Step 8 — Create frontend `.env.local`

```powershell
copy .env.local.example .env.local
```

Fill in your Firebase web app config from Firebase Console → Project Settings → Your apps → SDK config.

---

## 3. Backend Commands

### Start Development Server

```powershell
cd d:\smart-waste-management\backend
.venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

Output when ready:

```
INFO:     Will watch for changes in these directories: ['D:\\smart-waste-management\\backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
[startup] Prediction service warmed up with N telemetry readings
[startup] Pruned N expired token blacklist entries
INFO:     Application startup complete.
```

### Start on a Different Port

```powershell
uvicorn main:app --reload --port 8001
```

### Check if Backend is Running

```powershell
curl http://localhost:8000/health
# {"status":"ok","version":"3.0.0","environment":"development"}
```

### Kill Existing Process on Port 8000

```powershell
# Find PID
netstat -ano | findstr :8000

# Kill it (replace 12345 with actual PID)
taskkill /PID 12345 /F
```

### Generate a Secret Key

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

### Generate an IoT API Key

```powershell
python -c "import secrets; print('wsk_live_' + secrets.token_urlsafe(32))"
```

---

## 4. Database & Migrations

The project uses **PostgreSQL** exclusively. By default it connects to your `DATABASE_URL` set in `backend/.env`. For local development you can either run Postgres in Docker (see section 8) or connect to Neon (free cloud Postgres).

### Alembic Migration Commands

All commands must be run from `backend/` with the virtual environment active.

```powershell
cd d:\smart-waste-management\backend
.venv\Scripts\Activate.ps1
```

#### Apply all pending migrations (upgrade to latest)

```powershell
python -m alembic upgrade head
```

#### Check current migration version

```powershell
python -m alembic current
# INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
# 07da6f3101a5 (head)
```

#### Stamp existing database without running SQL (when tables already exist)

```powershell
python -m alembic stamp head
```

Use this when you point to a new database that already has tables (e.g. created by `Base.metadata.create_all`).

#### Generate a new migration after changing models

```powershell
python -m alembic revision --autogenerate -m "describe_your_change"
```

Always review the generated file in `migrations/versions/` before applying.

#### Roll back one migration

```powershell
python -m alembic downgrade -1
```

#### View migration history

```powershell
python -m alembic history --verbose
```

### Reset Database (Development Only)

If you need a completely clean slate on your local Postgres:

```powershell
# Connect to local postgres and drop/recreate schema
docker exec smart-waste-postgres psql -U waste_user -d smart_waste -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Re-run migrations
python -m alembic upgrade head

# Re-seed users
python seed_users.py
```

---

## 5. Frontend Commands

### Start Development Server

```powershell
cd d:\smart-waste-management\frontend
pnpm dev
```

Output when ready:

```
   ▲ Next.js 14.x.x
   - Local:   http://localhost:3000
   - Ready in Xs
```

### Build Production Bundle

```powershell
pnpm build
```

A successful build shows `✓ Compiled successfully` with no errors or warnings.

### Start Production Server (after build)

```powershell
pnpm build
pnpm start
```

### TypeScript Type Check (no emit)

```powershell
npx tsc --noEmit
# No output = no errors
```

### Run Linter

```powershell
pnpm lint
```

### Run Jest Tests

```powershell
# Watch mode (development)
pnpm test

# Single run (CI mode)
pnpm test:ci

# Single component
pnpm test bin-management.test.tsx
pnpm test ml-predictions.test.tsx
```

### Kill Existing Process on Port 3000

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Clear Next.js Cache

```powershell
Remove-Item -Recurse -Force .next
pnpm dev
```

### Reinstall Dependencies from Scratch

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item pnpm-lock.yaml
pnpm store prune
pnpm install
```

---

## 6. Data Seeding & Simulation

### Understanding the Three Scripts

| Script                          | What it does                              | Duration  | When to use                    |
| ------------------------------- | ----------------------------------------- | --------- | ------------------------------ |
| `python seed_users.py`          | Creates admin + user accounts             | 1 second  | First-time setup               |
| `python populate_test_data.py`  | Creates 10 bins, 3 crews, 15 tasks        | 2 seconds | First-time setup for demo data |
| `python simulate_iot.py --fast` | Streams live telemetry every 5s forever   | ∞         | Real-time development / demo   |
| `python test_ml_prediction.py`  | Seeds 48h historical data + runs ML tests | 30-60s    | Testing ML features            |

---

### Seed Users

```powershell
cd d:\smart-waste-management\backend
.venv\Scripts\Activate.ps1
python seed_users.py

# Output:
#   created admin: admin@example.com / Admin@1234
#   created regular user: user@example.com / User@1234
```

---

### Populate Demo Data (bins, crews, tasks)

```powershell
python populate_test_data.py

# Output:
# ✅ Created 10 sample bins
# ✅ Created 3 crews
# ✅ Created 15 tasks
```

Run once. Safe to run again — it skips existing records.

---

### IoT Sensor Simulator

```powershell
# Default — 30 second intervals
python simulate_iot.py

# Fast mode — 5 second intervals (best for development)
python simulate_iot.py --fast

# Simulate only 3 bins
python simulate_iot.py --bins 3

# Custom interval (seconds)
python simulate_iot.py --interval 60

# Use API key auth (production-style)
$env:IOT_API_KEY = "wsk_live_your_key_here"
python simulate_iot.py --fast
```

Sample output every 5 seconds:

```
--- Cycle #1 — 2026-04-03 14:22:10 ---
  [OK] bin01: OK    45% | Bat:  92% | Temp: 23.5°C
  [OK] bin02: WARN  72% | Bat:  88% | Temp: 22.1°C
  [OK] bin03: OK    38% | Bat:  95% | Temp: 24.1°C
  [OK] bin04: FULL  94% | Bat:  71% | Temp: 26.8°C
  [OK] bin05: OK    51% | Bat:  84% | Temp: 23.9°C
```

Predictions start working after about 2 minutes of data (needs ≥20 points per bin for ML).

---

### ML Prediction Test Script

Loads 240 telemetry readings (48 hours × 5 bins) and runs every prediction endpoint:

```powershell
python test_ml_prediction.py

# Output:
# ✅ Telemetry seeding — 240 accepted, 0 errors
# ✅ ML models rebuilt — 240 data points loaded
# ✅ bin01: Will fill in ~23.1h (confidence: 0.94)
# ✅ Anomaly detection passed
# ✅ Collection optimize: ['bin04', 'bin02', 'bin05']
# ✅ Predicted alerts (24h): 3 bins flagged
```

---

### Recommended Workflow for First-Time Setup

```powershell
# Step 1: Start backend (Terminal 1)
cd backend ; .venv\Scripts\Activate.ps1 ; uvicorn main:app --reload

# Step 2: Seed users and demo data (Terminal 2)
cd backend ; .venv\Scripts\Activate.ps1
python seed_users.py
python populate_test_data.py

# Step 3: Start live simulator (Terminal 2, after seeding)
python simulate_iot.py --fast

# Step 4: Start frontend (Terminal 3)
cd frontend ; pnpm dev

# Open http://localhost:3000 and log in with admin@example.com / Admin@1234
```

---

## 7. Testing

### Backend Tests

All tests live in `backend/tests/`.

```powershell
cd d:\smart-waste-management\backend
.venv\Scripts\Activate.ps1
```

#### Run all tests

```powershell
pytest tests/ -v
```

#### Run only router tests

```powershell
pytest tests/test_routers.py -v
```

#### Run only ML prediction tests

```powershell
pytest tests/test_ml_predictions.py -v
```

#### Run a specific test function

```powershell
pytest tests/test_routers.py::test_get_bins -v
pytest tests/test_routers.py::test_create_bin -v
```

#### Run tests with coverage report

```powershell
pytest tests/ --cov=. --cov-report=html
# Report generated in: htmlcov/index.html
```

#### Run tests quickly (stop on first failure)

```powershell
pytest tests/ -x -q
```

**Note**: Tests use a dedicated test database. Set `TEST_DATABASE_URL` in your environment to point to a separate test database. Default fallback: `postgresql://waste_user:waste_password_dev@localhost:5432/smart_waste_test`

### Frontend Tests

```powershell
cd d:\smart-waste-management\frontend

# Run all Jest tests
pnpm test:ci

# Watch mode
pnpm test

# Specific test file
pnpm test bin-management.test.tsx
pnpm test ml-predictions.test.tsx
```

---

## 8. Local PostgreSQL with Docker

If you're not using Neon and want a local Postgres database:

### Start PostgreSQL + pgAdmin

```powershell
cd d:\smart-waste-management
docker-compose -f docker-compose.postgresql.yml up -d
```

This starts:

- **PostgreSQL** on `localhost:5432`
- **pgAdmin** (web UI) on `http://localhost:5050`

### Set DATABASE_URL in backend/.env

```env
DATABASE_URL=postgresql://waste_user:waste_password_dev@localhost:5432/smart_waste
```

### Run Migrations Against Local Postgres

```powershell
cd backend
.venv\Scripts\Activate.ps1
python -m alembic upgrade head
```

### pgAdmin Access

```
URL:      http://localhost:5050
Email:    admin@smart-waste.local
Password: admin
```

To connect to the database in pgAdmin:

1. Right-click "Servers" → "Register" → "Server"
2. General tab → Name: `smart-waste-local`
3. Connection tab:
   - Host: `postgres` (the Docker service name, not `localhost`)
   - Port: `5432`
   - Username: `waste_user`
   - Password: `waste_password_dev`

### Stop Containers

```powershell
# Stop (keep data)
docker-compose -f docker-compose.postgresql.yml down

# Stop and delete all data
docker-compose -f docker-compose.postgresql.yml down -v
```

### Reset Local Database

```powershell
docker exec smart-waste-postgres psql -U waste_user -d smart_waste -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
python -m alembic upgrade head
python seed_users.py
```

---

## 9. Troubleshooting

### Backend

#### `DATABASE_URL environment variable is not set`

```powershell
# Make sure backend/.env exists and has DATABASE_URL set
Get-Content backend/.env | Select-String "DATABASE_URL"
```

#### `ModuleNotFoundError: No module named 'fastapi'`

```powershell
# Virtual environment not activated
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

#### `psycopg2.OperationalError: could not connect to server`

- If using local Docker: `docker-compose -f docker-compose.postgresql.yml up -d`
- If using Neon: Check your `DATABASE_URL` has `?sslmode=require`
- Check the host/port/credentials in your `DATABASE_URL`

#### Alembic `DuplicateTable` error on first migration

Tables already exist but Alembic version isn't stamped:

```powershell
python -m alembic stamp head
```

#### `401 Unauthorized` on `/telemetry/` from simulator

```powershell
# Make sure backend is running first
curl http://localhost:8000/health

# Then start simulator
python simulate_iot.py --fast
```

#### Swagger UI returns 404 in production

`ENVIRONMENT=development` must be set in `.env`. Swagger is disabled when `ENVIRONMENT=production`.

#### Port 8000 in use

```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

---

### Frontend

#### `Cannot find module` / dependency errors

```powershell
cd frontend
Remove-Item -Recurse -Force node_modules
pnpm install
```

#### API calls fail with `ECONNREFUSED`

Make sure the backend is running and `NEXT_PUBLIC_API_URL=http://localhost:8000` is set in `frontend/.env.local`.

#### Port 3000 in use

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

#### TypeScript errors after pulling changes

```powershell
cd frontend
npx tsc --noEmit
```

---

### ML Predictions

#### `Insufficient data for prediction`

The ML model needs at least 20 telemetry readings per bin. Either:

```powershell
# Option A: Load 48h of historical data instantly
python test_ml_prediction.py

# Option B: Run simulator and wait 2 minutes
python simulate_iot.py --fast
```

#### Predictions not updating after new telemetry

The model rebuilds automatically on each telemetry ingestion. Force a rebuild:

```powershell
curl -X POST http://localhost:8000/predictions/seed \
  -H "Authorization: Bearer <your_token>"
```

---

## 10. Quick Reference Card

```
═══════════════════════════════════════════════════════════

  ACTIVATE VENV  →  .venv\Scripts\Activate.ps1

═══════════════════════════════════════════════════════════

  BACKEND START  →  uvicorn main:app --reload
  FRONTEND START →  pnpm dev
  IOT SIMULATOR  →  python simulate_iot.py --fast

═══════════════════════════════════════════════════════════

  FIRST-TIME SETUP
  ─────────────────
  pip install -r requirements.txt
  copy .env.example .env       # fill in DATABASE_URL etc.
  python -m alembic upgrade head
  python seed_users.py
  python populate_test_data.py

═══════════════════════════════════════════════════════════

  DEMO ACCOUNTS
  ─────────────
  admin@example.com  /  Admin@1234  (admin)
  user@example.com   /  User@1234   (user)

═══════════════════════════════════════════════════════════

  PORTS
  ──────
  Frontend  → http://localhost:3000
  Backend   → http://localhost:8000
  Swagger   → http://localhost:8000/docs
  pgAdmin   → http://localhost:5050  (Docker only)
  Postgres  → localhost:5432

═══════════════════════════════════════════════════════════

  MIGRATION COMMANDS
  ───────────────────
  python -m alembic upgrade head       apply migrations
  python -m alembic current            check version
  python -m alembic stamp head         stamp existing DB
  python -m alembic revision           create new migration
    --autogenerate -m "description"

═══════════════════════════════════════════════════════════

  TESTS
  ──────
  pytest tests/ -v                     all backend tests
  pytest tests/test_routers.py -v      router tests
  pytest tests/test_ml_predictions.py  ML tests
  pnpm test:ci                         frontend Jest tests

═══════════════════════════════════════════════════════════
```

---

## Project Structure Reference

```
smart-waste-management/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── models.py                # Pydantic request/response models
│   ├── database.py              # SQLAlchemy ORM models + DB engine
│   ├── config.py                # Settings (reads from .env)
│   ├── security.py              # Security middleware + rate limiting
│   ├── auth_utils.py            # JWT helpers + auth dependencies
│   ├── api_key_services.py      # IoT API key management
│   ├── firebase_service.py      # Firebase Admin SDK wrapper
│   ├── requirements.txt
│   ├── .env.example             # Template for backend/.env
│   ├── alembic.ini              # Alembic migration config
│   ├── migrations/              # Migration versions
│   ├── routers/
│   │   ├── auth.py              # POST /auth/signup, /login, /firebase ...
│   │   ├── bins.py              # GET/POST/PATCH/DELETE /bins/
│   │   ├── telemetry_update.py  # POST /telemetry/
│   │   ├── stats.py             # GET /stats/
│   │   ├── crews.py             # GET/POST/PATCH/DELETE /crews/
│   │   ├── tasks.py             # GET/POST/PATCH/DELETE /tasks/
│   │   ├── routes.py            # POST /routes/optimize, compare ...
│   │   ├── predictions.py       # GET /predictions/predict/{bin_id} ...
│   │   ├── reports.py           # GET /reports/export, /summary
│   │   ├── driver.py            # GET /driver/tasks, /route/current ...
│   │   └── websocket_router.py  # WS /ws?token=<jwt>
│   ├── services/
│   │   ├── ml_predictor.py      # Fill prediction + anomaly detection
│   │   ├── route_optimizer.py   # 4 route algorithms
│   │   └── notifications.py     # Firebase Cloud Messaging
│   ├── tests/
│   │   ├── test_routers.py      # API endpoint tests
│   │   └── test_ml_predictions.py
│   ├── seed_users.py            # Create demo accounts
│   ├── populate_test_data.py    # Create demo bins/crews/tasks
│   ├── simulate_iot.py          # IoT sensor simulator
│   └── test_ml_prediction.py    # ML feature test + data seeder
│
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   │   ├── page.tsx             # / Dashboard
│   │   ├── bins/page.tsx        # /bins
│   │   ├── crew/page.tsx        # /crew
│   │   ├── driver/page.tsx      # /driver
│   │   ├── map/page.tsx         # /map
│   │   ├── predictions/page.tsx # /predictions
│   │   ├── reports/page.tsx     # /reports
│   │   ├── routes/page.tsx      # /routes
│   │   ├── settings/page.tsx    # /settings
│   │   ├── alerts/page.tsx      # /alerts
│   │   ├── login/page.tsx       # /login
│   │   └── signup/page.tsx      # /signup
│   ├── components/              # React UI components
│   ├── store/auth-store.ts      # Zustand auth store
│   ├── contexts/auth-context.tsx # useAuth() hook (wraps Zustand)
│   ├── lib/api-client.ts        # Centralized API client
│   ├── lib/useRealtimeBins.ts   # WebSocket hook
│   ├── .env.local.example       # Template for frontend/.env.local
│   └── package.json
│
├── docker-compose.postgresql.yml # Local Postgres + pgAdmin
├── HOW_IT_WORKS.md
├── COMMANDS_GUIDE.md             # This file
├── POSTMAN_API_GUIDE.md
└── README.md
```
