# Smart Waste Management System - AI Agent Guide

## Architecture Overview

This is a full-stack IoT monitoring system with three main components:

1. **Backend** (`/backend/`): FastAPI application
   - SQLite database (`smart_waste.db`)
   - Domain models in `models.py`
   - API routes in `routers/` directory
   - Simulation scripts for testing

2. **Frontend** (`/frontend/`): Next.js dashboard
   - Modern stack: TypeScript, React, Tailwind CSS
   - Component library in `components/ui/`
   - Page routes in `app/` directory

3. **IoT Simulation** (`/backend/simulate_*.py`):
   - Generates mock sensor data and AI alerts
   - Used for development/testing

## Key Development Workflows

### Backend Development

1. **Environment Setup**:
   ```bash
   pip install -r backend/requirements.txt
   uvicorn backend.main:app --reload
   ```

2. **Database**: 
   - SQLite database auto-creates on first run
   - Models defined in `backend/models.py`
   - No migrations system - changes require manual DB recreation

3. **API Testing**:
   - Swagger UI at `http://localhost:8000/docs`
   - Run simulators for test data:
     ```bash
     python backend/simulate_iot.py
     python backend/simulate_ai_alerts.py
     ```

### Frontend Development

1. **Setup**:
   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```

2. **Component Patterns**:
   - UI components use shadcn/ui (see `components/ui/`)
   - Pages follow Next.js App Router conventions
   - Backend API calls use `lib/api-client.ts`

## Project Conventions

1. **API Structure**:
   - RESTful endpoints in `backend/routers/`
   - Standard response format: `{"data": ..., "error": ...}`
   - All dates in ISO format

2. **State Management**:
   - Frontend uses React Query for API state
   - Real-time updates via polling (no WebSocket)

3. **Error Handling**:
   - Backend: FastAPI automatic validation
   - Frontend: Toast notifications via `hooks/use-toast.ts`


## Integration Points

1. **Frontend ↔ Backend**:
   - API base URL configured in `frontend/lib/api-client.ts`
   - CORS enabled for development (see `backend/main.py`)

2. **IoT Integration**:
   - Telemetry endpoint: `POST /telemetry`
   - Alert endpoint: `POST /ai_alerts`
   - See `backend/models.py` for payload formats

## Data Flow Patterns

1. **Bin Telemetry Flow**:
   ```
   IoT Device → /telemetry endpoint → SQLite → React Query → Dashboard
   ```
   Example payload in `models.py`:
   ```python
   class TelemetryPayload(BaseModel):
       bin_id: str
       fill_level_percent: int
       battery_percent: Optional[int]
       temperature_c: Optional[float]
   ```

2. **AI Alert Flow**:
   ```
   CCTV System → /ai_alerts endpoint → SQLite → React Query → Toast Notifications
   ```
   See `frontend/components/ai-alerts-management.tsx` for implementation

## Frontend Component Patterns

1. **Page Layout Structure**:
   - `app/layout.tsx`: Base layout with theme and analytics
   - `components/dashboard-layout.tsx`: Dashboard-specific layout
   - Individual pages in `app/*/page.tsx`

2. **UI Components**:
   - Prefer composition using `components/ui/*` base components
   - State management via React Query hooks
   - Example: `components/bin-management.tsx`

## Configuration Management

1. **Backend Settings**:
   - FastAPI settings in `backend/main.py`
   # Smart Waste Management — AI Agent Quick Guide

   This short guide helps AI coding agents get productive quickly in this repo.

   1) What this repo is
    - Backend: FastAPI app in `backend/` (SQLite DB via `backend/database.py`, models in `backend/models.py`, routers in `backend/routers/`).
    - Frontend: Next.js app in `frontend/` using TypeScript and shadcn-ui components (`frontend/components/` and `frontend/components/ui/`).
    - Simulators: `backend/simulate_iot.py` and `backend/simulate_ai_alerts.py` produce telemetry and AI alerts for dev/testing.

   2) Quick run commands (dev)
   ```powershell
   pip install -r backend/requirements.txt
   uvicorn backend.main:app --reload
   # in a separate shell (frontend):
   cd frontend; pnpm install; pnpm dev
   ``` 

   3) Key patterns & entry points (use these when making changes)
    - API surface: `backend/routers/` — each router is mounted in `backend/main.py` (e.g., `/bins`, `/telemetry`, `/ai_alerts`, `/stats`).
    - Data models / validation: `backend/models.py` (Pydantic). Use Pydantic fields for validation when adding model fields.
    - DB: SQLite file created automatically; there is no migration system. Changing models requires manual DB reset or handling existing rows.
    - Frontend API client: `frontend/lib/api-client.ts` — update here when backend endpoints change.

   4) Common, discoverable data flows (concrete examples)
    - Telemetry: IoT → POST `/telemetry` → stored in SQLite → frontend reads via React Query. Example payload shape in `backend/models.py` (`TelemetryPayload`).
    - AI alerts: CCTV/AI → POST `/ai_alerts` → stored → displayed in dashboard (`frontend/components/ai-alerts-management.tsx`).

   5) Conventions & small gotchas
    - Responses follow a `{"data":..., "error":...}` pattern in routers — preserve when adding endpoints.
    - Dates use ISO format. Pydantic models often accept optional timestamps.
    - CORS is permissive in `backend/main.py` for dev; tighten before production.
    - UI uses `components/ui/*` primitives — prefer composition and `components/ui/card.tsx` for consistent visuals.

   6) Useful files to open when editing tasks
    - Backend: `backend/main.py`, `backend/models.py`, `backend/database.py`, `backend/routers/*.py`, `backend/simulate_*.py`
    - Frontend: `frontend/lib/api-client.ts`, `frontend/components/ai-alerts-management.tsx`, `frontend/components/bin-management.tsx`, `frontend/app/layout.tsx`

   7) Typical developer tasks (examples)
    - Add bin field: update `backend/models.py` (Pydantic + SQL model if present), update `backend/routers/bins.py`, update `frontend/lib/api-client.ts` and `frontend/components/bin-management.tsx`.
    - Add widget: create component in `frontend/components/`, register it in `frontend/app/page.tsx`, fetch data via `api-client` & React Query.

   8) Debugging & testing
    - Use Swagger at `http://localhost:8000/docs` to exercise endpoints.
    - Start `uvicorn` to see backend logs; use React DevTools for frontend.
    - Simulators are quick for generating test data: run `python backend/simulate_iot.py` and `python backend/simulate_ai_alerts.py`.

   If you'd like, I can now:
    - Trim or expand any section (e.g., add exact Pydantic/ORM mappings),
    - Add step-by-step examples for adding endpoints or components, or
    - Generate small unit/integration tests for a router or component.

   Please tell me which area to expand or validate next.