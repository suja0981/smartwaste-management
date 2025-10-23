# Smart Waste Management System

This project is an MVP for a smart waste management platform using FastAPI (backend), SQLite (database), and a modern dashboard (frontend).

## Structure

- `backend/` — FastAPI app, database models, simulation scripts
- `frontend/` — Dashboard (HTML/JS/CSS)
- `docs/` — Documentation (empty for now)

## Running the Project

1. Install backend dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
2. Start the backend:
   ```bash
   uvicorn backend.main:app --reload
   ```
3. Open `frontend/index.html` in your browser.
4. (Optional) Run simulators:
   ```bash
   python backend/simulate_iot.py
   python backend/simulate_ai_alerts.py
   ```

## API Endpoints
- `/bins` — List/add bins
- `/telemetry` — Update bin telemetry
- `/ai_alert` — Add AI alert
- `/alerts` — List AI alerts

## Notes
- All data is stored in `smart_waste.db` (SQLite).
- No hardware required; all data is simulated.
