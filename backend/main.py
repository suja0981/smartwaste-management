from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import bins, telemetry, alerts, stats, crews, tasks, routes, predictions

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Waste Management API",
    description="AI-Powered CCTV Monitoring, IoT Sensors, Route Optimization & ML Predictions",
    version="3.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(bins.router, prefix="/bins", tags=["bins"])
app.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])
app.include_router(alerts.router, prefix="/ai_alerts", tags=["alerts"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])
app.include_router(crews.router, prefix="/crews", tags=["crews"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(routes.router, prefix="/routes", tags=["routes"])
app.include_router(predictions.router, prefix="/predictions", tags=["predictions"])  # NEW

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "smart-waste-backend"}

@app.get("/")
def root():
    return {
        "name": "Smart Waste Management API",
        "version": app.version,
        "features": [
            "IoT Sensor Integration",
            "AI-Powered CCTV Alerts",
            "Crew & Task Management",
            "Route Optimization (4 algorithms)",
            "ML-Based Fill Prediction",
            "Anomaly Detection",
            "Real-time Dashboard"
        ],
        "endpoints": [
            "/health", 
            "/bins", 
            "/telemetry", 
            "/ai_alerts", 
            "/stats", 
            "/crews", 
            "/tasks",
            "/routes",
            "/predictions"
        ],
    }