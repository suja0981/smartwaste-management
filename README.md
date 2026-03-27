# Smart Waste Management System

> ⚡ **Database Migration Available:** This project supports both **SQLite** (development) and **PostgreSQL** (production). See [POSTGRESQL_QUICK_START.md](POSTGRESQL_QUICK_START.md) for enterprise deployment.

A comprehensive IoT-based waste management platform with AI-powered monitoring, route optimization, and crew management. Built with **FastAPI** (backend), **Next.js** (frontend), and **SQLite/PostgreSQL** (database).

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation & Setup](#installation--setup)
- [Running the Project](#running-the-project)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Database](#database)
- [Testing & Simulation](#testing--simulation)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

Smart Waste Management is an end-to-end solution for optimizing waste collection operations using:

- **IoT Sensors** — Real-time bin fill-level monitoring
- **AI-Powered CCTV** — Intelligent alert detection and classification
- **Route Optimization** — AI-driven collection route planning
- **Crew Management** — Task assignment and tracking
- **ML Predictions** — Predictive analytics for bin fullness and collection needs
- **Authentication & Authorization** — Role-based access control (Admin/User)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              Smart Waste Management                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Frontend (Next.js/React/TypeScript)               │
│  - Dashboard                                        │
│  - Login/Signup Pages                              │
│  - Real-time Monitoring                            │
│  - Route & Crew Management                         │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Backend (FastAPI)                                 │
│  - Authentication & Authorization                  │
│  - REST API (Bins, Telemetry, Alerts, Stats)      │
│  - Route Optimization Service                      │
│  - ML Prediction Service                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Database (SQLite)                                 │
│  - Users & Authentication                          │
│  - Bins & Telemetry                               │
│  - AI Alerts & Events                             │
│  - Crew & Task Data                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## ✨ Features

### Authentication & Authorization

- **User Registration** — Email/password signup with validation
- **Admin Login** — Full system access
- **User Login** — Read-only access to dashboards
- **JWT Tokens** — Secure 30-minute session tokens
- **Role-Based Access** — Admin-only routes and user-level restrictions

### Waste Management

- **Bin Management** — Add, edit, delete, track waste bins
- **Telemetry Monitoring** — Real-time fill levels, battery status, temperature
- **AI Alerts** — CCTV-powered anomaly detection (fire, spillage, unauthorized activity)
- **Statistics Dashboard** — Aggregate metrics and reporting

### Operations

- **Route Optimization** — AI-driven collection route planning
- **Crew Management** — Team assignment and task tracking
- **Predictive Analytics** — ML models for bin fullness forecasting

## 📦 Prerequisites

### System Requirements

- **Python 3.13+** (or Python 3.10+)
- **Node.js 18+** (for frontend)
- **pnpm 8+** (or npm/yarn)
- **Git**

### Installation Prerequisites

- Virtual environment setup (Python venv or conda)
- Windows: PowerShell or Command Prompt
- macOS/Linux: Bash or compatible shell

## 🚀 Installation & Setup

### Quick Start (Copy-Paste Commands)

For detailed command explanations, see [COMMANDS.md](COMMANDS.md)

**Windows PowerShell:**

```powershell
# 1. Navigate to project
cd d:\smart-waste-management

# 2. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# 3. Install backend dependencies
cd backend
pip install -r requirements.txt

# 4. Seed database with demo users
python seed_users.py

# 5. Install frontend dependencies
cd ..\frontend
pnpm install

# 6. (Optional) Populate test data
cd ..\backend
python populate_test_data.py
```

**macOS/Linux:**

```bash
cd ~/smart-waste-management

python3 -m venv .venv
source .venv/bin/activate

cd backend
pip install -r requirements.txt
python seed_users.py

cd ../frontend
pnpm install

cd ../backend
python populate_test_data.py
```

## 🎮 Running the Project

### Start Both Backend & Frontend

**Terminal 1 - Backend:**

```powershell
cd d:\smart-waste-management\backend
.\..\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

✅ Backend: `http://localhost:8000`
✅ Swagger UI: `http://localhost:8000/docs`

**Terminal 2 - Frontend:**

```powershell
cd d:\smart-waste-management\frontend
pnpm dev
```

✅ Frontend: `http://localhost:3000`

**Terminal 3 - (Optional) IoT Simulator:**

```powershell
cd d:\smart-waste-management\backend
python simulate_iot.py
```

**Terminal 4 - (Optional) AI Alert Simulator:**

```powershell
cd d:\smart-waste-management\backend
python simulate_ai_alerts.py
```

### Run Backend Only

```powershell
cd backend
uvicorn main:app --reload
```

### Run Frontend Only

```powershell
cd frontend
pnpm dev
```

## 🔐 Authentication

### Demo Accounts

| Email             | Password    | Role  | Access             |
| ----------------- | ----------- | ----- | ------------------ |
| admin@example.com | password123 | Admin | Full system access |
| user@example.com  | password123 | User  | Read-only access   |

### Login Steps

1. Go to `http://localhost:3000`
2. Click "Login" or navigate to `/login`
3. Enter email and password
4. Click "Sign In"
5. JWT token auto-saved to browser
6. Redirected to dashboard

### Signup Steps

1. Navigate to `http://localhost:3000/signup`
2. Enter email, full name, password
3. Password requirements: 8+ chars, uppercase, lowercase, number
4. Click "Create Account"
5. Auto-logged in with user role

## 📡 API Endpoints

### Authentication

```
POST   /auth/signup              — Register new user
POST   /auth/login               — Login and get JWT token
GET    /auth/me                  — Get current user info
POST   /auth/logout              — Logout (client-side)
```

### Bins

```
GET    /bins                     — List all bins
POST   /bins                     — Create new bin
GET    /bins/{bin_id}            — Get bin details
PUT    /bins/{bin_id}            — Update bin info
DELETE /bins/{bin_id}            — Delete bin
```

### Telemetry

```
POST   /telemetry                — Submit IoT sensor data
GET    /telemetry/{bin_id}       — Get bin telemetry history
```

### AI Alerts

```
POST   /ai_alerts                — Submit CCTV AI alert
GET    /ai_alerts                — List all alerts
GET    /ai_alerts/{alert_id}     — Get alert details
PUT    /ai_alerts/{alert_id}     — Update alert status
```

### Statistics

```
GET    /stats/dashboard          — Dashboard metrics
GET    /stats/bins               — Bin statistics
GET    /stats/alerts             — Alert statistics
```

### Crews

```
GET    /crews                    — List all crews
POST   /crews                    — Create new crew
GET    /crews/{crew_id}          — Get crew details
PUT    /crews/{crew_id}          — Update crew
DELETE /crews/{crew_id}          — Delete crew
```

### Tasks

```
GET    /tasks                    — List all tasks
POST   /tasks                    — Create new task
PUT    /tasks/{task_id}          — Update task
DELETE /tasks/{task_id}          — Delete task
```

### Routes

```
GET    /routes                   — List optimized routes
POST   /routes/optimize          — Generate optimized route
GET    /routes/{route_id}        — Get route details
```

### Health

```
GET    /health                   — Health check
GET    /                         — API info
```

## 📁 Project Structure

```
smart-waste-management/
│
├── backend/                          # FastAPI backend
│   ├── main.py                       # FastAPI app & router setup
│   ├── database.py                   # SQLAlchemy database config
│   ├── models.py                     # Pydantic & SQLAlchemy models
│   ├── auth_utils.py                 # JWT & password utilities
│   ├── requirements.txt               # Python dependencies
│   │
│   ├── routers/                      # API route handlers
│   │   ├── auth.py                   # Authentication endpoints
│   │   ├── bins.py                   # Bin management
│   │   ├── telemetry_update.py       # IoT sensor data
│   │   ├── alerts.py                 # AI alert handling
│   │   ├── stats.py                  # Statistics & reporting
│   │   ├── crews.py                  # Crew management
│   │   ├── tasks.py                  # Task management
│   │   ├── routes.py                 # Route optimization
│   │   └── predictions.py            # ML predictions
│   │
│   ├── services/                     # Business logic
│   │   ├── ml_predictor.py           # ML prediction models
│   │   └── route_optimizer.py        # Route optimization logic
│   │
│   ├── simulate_iot.py               # IoT data simulator
│   ├── simulate_ai_alerts.py         # AI alert simulator
│   ├── seed_users.py                 # Create demo users
│   ├── populate_test_data.py         # Populate test data
│   └── smart_waste.db                # SQLite database file
│
├── frontend/                         # Next.js frontend
│   ├── app/                          # App Router pages
│   │   ├── page.tsx                  # Dashboard home
│   │   ├── layout.tsx                # Root layout & provider
│   │   ├── login/page.tsx            # Login page
│   │   ├── signup/page.tsx           # Signup page
│   │   ├── bins/page.tsx             # Bin management
│   │   ├── alerts/page.tsx           # AI alerts
│   │   ├── crew/page.tsx             # Crew management
│   │   ├── routes/page.tsx           # Route optimization
│   │   ├── map/page.tsx              # Interactive map
│   │   └── reports/page.tsx          # Analytics & reports
│   │
│   ├── components/                   # React components
│   │   ├── dashboard-layout.tsx      # Main dashboard wrapper
│   │   ├── bin-management.tsx        # Bin CRUD components
│   │   ├── ai-alerts-management.tsx  # Alert display & management
│   │   ├── crew-management.tsx       # Crew management UI
│   │   ├── route-optimization.tsx    # Route planning UI
│   │   ├── interactive-map.tsx       # Map visualization
│   │   ├── analytics-reports.tsx     # Report generation
│   │   ├── dashboard-widgets.tsx     # KPI cards
│   │   ├── protected-route.tsx       # Auth route guards
│   │   ├── mode-toggle.tsx           # Dark/light mode
│   │   ├── theme-provider.tsx        # Theme context
│   │   └── ui/                       # shadcn/ui components
│   │
│   ├── contexts/                     # React contexts
│   │   └── auth-context.tsx          # Authentication state
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-toast.ts              # Toast notifications
│   │   └── use-mobile.ts             # Mobile detection
│   │
│   ├── lib/                          # Utilities & helpers
│   │   ├── api-client.ts             # Backend API client
│   │   ├── status-mapper.ts          # Status formatting
│   │   └── utils.ts                  # General utilities
│   │
│   ├── package.json                  # Dependencies
│   ├── tsconfig.json                 # TypeScript config
│   ├── next.config.mjs               # Next.js config
│   └── postcss.config.mjs            # PostCSS config
│
├── docs/                             # Documentation
│   ├── AUTHENTICATION.md             # Auth system details
│   ├── AUTH_QUICKSTART.md            # Quick auth reference
│   ├── ARCHITECTURE.md               # System architecture
│   ├── GETTING_STARTED.md            # Setup guide
│   └── IMPLEMENTATION_SUMMARY.md     # What was built
│
└── README.md                         # This file
```

## 💾 Database

### SQLite Database

- **Location**: `backend/smart_waste.db`
- **Auto-created** on first backend run
- **Tables**:
  - `users` — User accounts & authentication
  - `bins` — Waste bin inventory
  - `telemetry` — IoT sensor readings
  - `ai_alerts` — CCTV alerts
  - `crews` — Operational teams
  - `tasks` — Collection tasks
  - `routes` — Optimized routes

## 🧪 Testing & Simulation

### Populate Test Data

```powershell
cd backend
python populate_test_data.py
```

Creates sample bins, crews, tasks, and routes.

### IoT Sensor Simulator

```powershell
cd backend
python simulate_iot.py
```

Generates realistic telemetry data:

- Fill levels (0-100%)
- Battery levels (0-100%)
- Temperature readings (-5 to 50°C)
- Updates every 5-10 seconds

### AI Alert Simulator

```powershell
cd backend
python simulate_ai_alerts.py
```

Generates CCTV alerts:

- Fire detection
- Spillage incidents
- Unauthorized access
- Random intervals (10-30 seconds)

### Test Endpoints

Access Swagger UI at `http://localhost:8000/docs` to interactively test all endpoints.

## 📚 Documentation

| Document                                                    | Purpose                                  |
| ----------------------------------------------------------- | ---------------------------------------- |
| [COMMANDS.md](COMMANDS.md)                                  | All setup and run commands               |
| [AUTHENTICATION.md](docs/AUTHENTICATION.md)                 | Complete auth system documentation       |
| [AUTH_QUICKSTART.md](docs/AUTH_QUICKSTART.md)               | Quick reference & demo accounts          |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)                     | System diagrams & technical architecture |
| [GETTING_STARTED.md](docs/GETTING_STARTED.md)               | Step-by-step setup instructions          |
| [IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md) | Feature summary & implementation details |

## 🛠️ Troubleshooting

### Backend Won't Start

**Error: `ImportError: cannot import name 'telemetry'`**

```
Solution: Check main.py imports match router filenames
File: backend/main.py, Line 5
Change: from routers import telemetry
To:      from routers import telemetry_update
```

**Error: `ModuleNotFoundError: No module named 'passlib'`**

```
Solution: Reinstall dependencies
pip install -r requirements.txt --force-reinstall --upgrade
```

**Error: `SQLAlchemy AssertionError (Python 3.13)`**

```
Solution: Update SQLAlchemy version
pip install SQLAlchemy==2.0.31 --force-reinstall
```

### Frontend Connection Issues

**Error: `Failed to fetch from http://localhost:8000`**

1. Ensure backend is running: `uvicorn main:app --reload`
2. Check CORS in `backend/main.py` (should be `allow_origins=["*"]`)
3. Verify API URL in `frontend/lib/api-client.ts`

**Port 3000 already in use:**

```powershell
# Find process
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

**Port 8000 already in use:**

```powershell
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Database Errors

**Error: `Database is locked`**

- Close all backend instances
- Restart uvicorn

**Error: `Table 'users' does not exist`**

```powershell
# Delete database to force recreate
rm backend/smart_waste.db
# Restart backend
uvicorn main:app --reload
```

### Authentication Issues

**Can't login with demo account:**

1. Verify user was created: Check `smart_waste.db` or run `python seed_users.py` again
2. Check browser LocalStorage cleared (F12 → Application → LocalStorage)
3. Verify backend is returning token

**Frontend keeps redirecting to login:**

- Check browser console (F12) for errors
- Verify JWT token stored in LocalStorage
- Check if token expired (30-minute timeout)

## 📊 Technology Stack

### Backend

- **FastAPI** 0.109.0 — Web framework
- **SQLAlchemy** 2.0.31 — ORM
- **SQLite** — Database
- **PyJWT** 2.10.1 — JWT tokens
- **Passlib** 1.7.4 — Password hashing
- **Bcrypt** 4.0.1 — Bcrypt encryption
- **Python-Jose** 3.3.0 — JWT handling
- **Uvicorn** 0.27.0 — ASGI server
- **Python** 3.13

### Frontend

- **Next.js** 14 — React framework
- **React** 18 — UI library
- **TypeScript** — Type safety
- **Tailwind CSS** — Styling
- **shadcn/ui** — Component library
- **React Query** — Data fetching
- **Zustand** — State management (optional)
- **Node.js** 18+

## 📝 Notes

- All data persisted in SQLite (`backend/smart_waste.db`)
- No hardware required; use simulators for test data
- Default session timeout: 30 minutes
- CORS fully open in dev (restrict in production)
- Passwords hashed with bcrypt (cost factor: 10)
- Admin role has full CRUD access
- User role has read-only access to dashboards
