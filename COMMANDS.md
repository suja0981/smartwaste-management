# Smart Waste Management - Complete Command Reference

All commands needed to setup, run, and manage the Smart Waste Management System.

## 📋 Table of Contents

1. [Initial Setup](#initial-setup)
2. [Running the Project](#running-the-project)
3. [Backend Commands](#backend-commands)
4. [Frontend Commands](#frontend-commands)
5. [Testing & Simulation](#testing--simulation)
6. [Database Management](#database-management)
7. [Troubleshooting Commands](#troubleshooting-commands)
8. [Production Deployment](#production-deployment)

---

## 🚀 Initial Setup

### Step 1: Navigate to Project Directory

**Windows PowerShell:**
```powershell
cd d:\smart-waste-management
```

**macOS/Linux Terminal:**
```bash
cd ~/smart-waste-management
```

### Step 2: Create Python Virtual Environment

**Windows:**
```powershell
python -m venv .venv
```

**macOS/Linux:**
```bash
python3 -m venv .venv
```

### Step 3: Activate Virtual Environment

**Windows PowerShell:**
```powershell
.venv\Scripts\Activate.ps1
```

**Windows Command Prompt (cmd.exe):**
```cmd
.venv\Scripts\activate.bat
```

**macOS/Linux:**
```bash
source .venv/bin/activate
```

### Step 4: Install Backend Dependencies

```powershell
cd backend
pip install -r requirements.txt
```

**If you encounter errors, try force reinstall:**
```powershell
pip install -r requirements.txt --force-reinstall --upgrade
```

### Step 5: Create Demo Users in Database

```powershell
python seed_users.py
```

**Output:**
```
✓ Created admin user: admin@example.com (password: password123)
✓ Created user account: user@example.com (password: password123)
```

### Step 6: Install Frontend Dependencies

```powershell
cd ..\frontend
pnpm install
```

**Alternative (if pnpm not installed):**
```powershell
npm install
# or
yarn install
```

### Step 7: (Optional) Populate Test Data

```powershell
cd ..\backend
python populate_test_data.py
```

**This creates:**
- 10 sample bins
- 3 sample crews
- 15 sample tasks
- 5 sample routes

---

## 🎮 Running the Project

### Option A: Full Stack (Recommended)

**Open 4 Terminal Windows:**

#### Terminal 1: Backend Server
```powershell
cd d:\smart-waste-management\backend
uvicorn main:app --reload
```

**Expected Output:**
```
INFO:     Will watch for changes in these directories: ['D:\\smart-waste-management\\backend']
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete
```

✅ **API Available at:** `http://localhost:8000`
✅ **Swagger UI:** `http://localhost:8000/docs`

#### Terminal 2: Frontend Server
```powershell
cd d:\smart-waste-management\frontend
pnpm dev
```

**Expected Output:**
```
  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
  - Environments: .env.local
```

✅ **Dashboard Available at:** `http://localhost:3000`

#### Terminal 3: IoT Simulator (Optional)
```powershell
cd d:\smart-waste-management\backend
python simulate_iot.py
```

**Expected Output:**
```
Simulating IoT data for bins...
Sent telemetry for bin_001: 45% full
Sent telemetry for bin_002: 78% full
...
```

#### Terminal 4: AI Alert Simulator (Optional)
```powershell
cd d:\smart-waste-management\backend
python simulate_ai_alerts.py
```

**Expected Output:**
```
Generating AI alerts...
Alert: Fire detected at bin_003
Alert: Spillage at bin_001
...
```

### Option B: Backend Only

```powershell
cd d:\smart-waste-management\backend
uvicorn main:app --reload
```

Access Swagger UI: `http://localhost:8000/docs`

### Option C: Frontend Only

```powershell
cd d:\smart-waste-management\frontend
pnpm dev
```

**Note:** Requires backend running on `localhost:8000`

---

## 🔧 Backend Commands

### Start Backend with Auto-Reload

```powershell
cd backend
uvicorn main:app --reload
```

### Start Backend on Custom Port

```powershell
uvicorn main:app --port 8080 --reload
```

### Start Backend in Production Mode

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Run Backend with Specific Python Version

```powershell
python -m uvicorn main:app --reload
```

### Database Operations

**Create Demo Users:**
```powershell
python seed_users.py
```

**Populate Test Data:**
```powershell
python populate_test_data.py
```

**Reset Database (Delete & Recreate):**
```powershell
# Delete existing database
Remove-Item smart_waste.db -Force

# Restart backend to auto-create empty database
uvicorn main:app --reload

# Seed users and test data
python seed_users.py
python populate_test_data.py
```

### Run Unit Tests

```powershell
python -m pytest test_routes.py -v
```

### Test ML Predictions

```powershell
python test_ml_predictions.py
```

---

## 🎨 Frontend Commands

### Development Server

```powershell
cd frontend
pnpm dev
```

### Build for Production

```powershell
pnpm build
```

### Start Production Build

```powershell
pnpm start
```

### Run Linter

```powershell
pnpm lint
```

### Format Code

```powershell
pnpm format
```

### Type Check

```powershell
pnpm type-check
```

### Development on Custom Port

```powershell
pnpm dev -- -p 3001
```

### Clean Build

```powershell
# Remove dependencies
pnpm install --frozen-lockfile

# Rebuild
pnpm build
```

---

## 🧪 Testing & Simulation

### IoT Telemetry Simulator

**Start:**
```powershell
cd backend
python simulate_iot.py
```

**What it does:**
- Generates realistic bin fill-level data (0-100%)
- Sends to `/telemetry` endpoint every 5-10 seconds
- Simulates multiple bins
- Includes battery and temperature readings

### AI Alert Simulator

**Start:**
```powershell
python simulate_ai_alerts.py
```

**What it does:**
- Generates CCTV alerts (fire, spillage, unauthorized access)
- Sends to `/ai_alerts` endpoint
- Random timing (10-30 seconds between alerts)
- Simulates different alert types

### Run Both Simulators Simultaneously

**Terminal 1:**
```powershell
python simulate_iot.py
```

**Terminal 2:**
```powershell
python simulate_ai_alerts.py
```

### Test Using Swagger UI

1. Navigate to `http://localhost:8000/docs`
2. Click on endpoint you want to test
3. Click "Try it out"
4. Fill in parameters
5. Click "Execute"

### Manual API Testing with cURL

**Create a Bin:**
```powershell
curl -X POST "http://localhost:8000/bins" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer <JWT_TOKEN>" `
  -d '{
    "bin_id": "bin_001",
    "location": "123 Main St",
    "capacity_liters": 120
  }'
```

**Get All Bins:**
```powershell
curl -X GET "http://localhost:8000/bins" `
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Submit Telemetry:**
```powershell
curl -X POST "http://localhost:8000/telemetry" `
  -H "Content-Type: application/json" `
  -d '{
    "bin_id": "bin_001",
    "fill_level_percent": 75,
    "battery_percent": 85,
    "temperature_c": 22.5
  }'
```

---

## 💾 Database Management

### Access SQLite Database

**Using Python:**
```powershell
cd backend
python -c "
import sqlite3
conn = sqlite3.connect('smart_waste.db')
cursor = conn.cursor()
cursor.execute('SELECT * FROM users;')
for row in cursor.fetchall():
    print(row)
"
```

**Using SQLite CLI (if installed):**
```powershell
sqlite3 backend/smart_waste.db
```

**SQL Commands:**
```sql
-- View all users
SELECT * FROM users;

-- View all bins
SELECT * FROM bins;

-- Count telemetry records
SELECT COUNT(*) FROM telemetry;

-- View recent alerts
SELECT * FROM ai_alerts ORDER BY timestamp DESC LIMIT 10;

-- Delete all telemetry
DELETE FROM telemetry;
```

### Backup Database

```powershell
# Create backup
Copy-Item backend/smart_waste.db backend/smart_waste.db.backup

# Restore from backup
Copy-Item backend/smart_waste.db.backup backend/smart_waste.db -Force
```

### Database Schema Inspection

**Check Tables:**
```powershell
python -c "
from database import Base
for table in Base.metadata.tables.values():
    print(f'Table: {table.name}')
    for col in table.columns:
        print(f'  - {col.name}: {col.type}')
"
```

---

## 🔐 Authentication Commands

### Login via API

**Get JWT Token:**
```powershell
$response = curl -X POST "http://localhost:8000/auth/login" `
  -H "Content-Type: application/json" `
  -d '{
    "email": "admin@example.com",
    "password": "password123"
  }' | ConvertFrom-Json

$token = $response.data.access_token
echo $token
```

### Use JWT Token

**In Headers:**
```
Authorization: Bearer <TOKEN>
```

**Example with cURL:**
```powershell
curl -X GET "http://localhost:8000/bins" `
  -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
```

### Check User Info

```powershell
curl -X GET "http://localhost:8000/auth/me" `
  -H "Authorization: Bearer <TOKEN>"
```

---

## 🛠️ Troubleshooting Commands

### Check Python Installation

```powershell
python --version
```

### Check Node.js Installation

```powershell
node --version
npm --version
pnpm --version
```

### Find Python Virtual Environment

```powershell
# Check if activated
Write-Host $env:VIRTUAL_ENV
```

### Kill Process on Port

**Port 8000 (Backend):**
```powershell
# Find process
netstat -ano | findstr :8000

# Kill process (replace PID)
taskkill /PID 12345 /F
```

**Port 3000 (Frontend):**
```powershell
netstat -ano | findstr :3000
taskkill /PID 12345 /F
```

### Check Backend Health

```powershell
curl http://localhost:8000/health
```

**Expected Response:**
```json
{"status":"ok","service":"smart-waste-backend"}
```

### View Backend Logs

```powershell
# Terminal should show logs automatically
# Look for errors like:
# ERROR:     Uvicorn running with watchreload
# ERROR:     Exception in ASGI application
```

### Clear Python Cache

```powershell
# Remove pycache directories
Get-ChildItem -Path . -Name __pycache__ -Recurse | Remove-Item -Recurse

# Remove .pyc files
Get-ChildItem -Path . -Name "*.pyc" -Recurse | Remove-Item
```

### Reinstall Dependencies

**Backend:**
```powershell
cd backend
pip uninstall -r requirements.txt -y
pip install -r requirements.txt --force-reinstall --upgrade
```

**Frontend:**
```powershell
cd frontend
pnpm install --force
```

### View Environment Variables

```powershell
# Check if backend venv is active
$env:VIRTUAL_ENV

# Check Python executable path
(Get-Command python).Source
```

### Test Database Connection

```powershell
cd backend
python -c "
from database import engine
try:
    with engine.connect() as connection:
        print('✓ Database connection successful')
except Exception as e:
    print(f'✗ Database error: {e}')
"
```

### Verify All Dependencies

**Backend:**
```powershell
pip list
```

**Frontend:**
```powershell
pnpm list
```

---

## 📦 Production Deployment

### Build for Production

**Backend:**
```powershell
# Backend doesn't need build, just requirements installed
pip install -r requirements.txt --no-dev
```

**Frontend:**
```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm build
```

### Start Production Backend

```powershell
# Using Gunicorn (recommended for production)
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 main:app

# Or using Uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Start Production Frontend

```powershell
cd frontend
pnpm start
```

### Environment Variables (Production)

**Create `.env.production` in backend:**
```
DATABASE_URL=sqlite:///./smart_waste.db
SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24
```

**Create `.env.local` in frontend:**
```
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Docker Deployment (Optional)

**Create Dockerfile for Backend:**
```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Create Dockerfile for Frontend:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

**Build Docker Images:**
```powershell
# Backend
docker build -t smart-waste-backend:latest ./backend

# Frontend
docker build -t smart-waste-frontend:latest ./frontend
```

**Run Docker Containers:**
```powershell
# Backend
docker run -p 8000:8000 -v $(pwd)/backend/smart_waste.db:/app/smart_waste.db smart-waste-backend:latest

# Frontend
docker run -p 3000:3000 smart-waste-frontend:latest
```

---

## 🎯 Quick Reference

### Typical Development Session

```powershell
# 1. Navigate and activate
cd d:\smart-waste-management
.venv\Scripts\Activate.ps1

# 2. Start backend
cd backend
uvicorn main:app --reload

# 3. In another terminal, start frontend
cd frontend
pnpm dev

# 4. Open dashboard
# Navigate to http://localhost:3000 in browser
# Login: admin@example.com / password123
```

### Common Tasks

**Update Dependencies:**
```powershell
cd backend
pip install -r requirements.txt --upgrade

cd ..\frontend
pnpm update
```

**Reset Everything:**
```powershell
# Delete database
Remove-Item backend/smart_waste.db -Force

# Restart backend
cd backend
uvicorn main:app --reload

# Run setup
python seed_users.py
python populate_test_data.py
```

**Check System Status:**
```powershell
# Backend health
curl http://localhost:8000/health

# Frontend running
curl http://localhost:3000

# Database size
(Get-Item backend/smart_waste.db).Length
```

---

## 📞 Common Issues & Solutions

| Issue | Command |
|-------|---------|
| Backend won't start | `pip install -r requirements.txt --force-reinstall --upgrade` |
| Port 8000 in use | `netstat -ano \| findstr :8000` then `taskkill /PID <PID> /F` |
| DB locked error | Restart backend or delete and recreate DB |
| Frontend can't connect | Ensure backend running on port 8000 with CORS enabled |
| Dependencies not found | `pip install --force-reinstall --upgrade` |
| Clear cache | `pnpm install --force` (frontend) |

---

## 📚 Additional Resources

- Backend API Docs: `http://localhost:8000/docs` (Swagger UI)
- Frontend Source: `./frontend/` (Next.js)
- Backend Source: `./backend/` (FastAPI)
- Database: `./backend/smart_waste.db` (SQLite)
- Documentation: See `./docs/` directory

---

**For more information, see [README.md](README.md)**
