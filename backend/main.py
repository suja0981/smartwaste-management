from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import bins, telemetry_update, alerts, stats, crews, tasks, routes, auth, predictions
from config import get_settings
from security import add_security_to_app

# Load configuration
settings = get_settings()

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
    docs_url="/docs" if not settings.is_production() else None,
    redoc_url="/redoc" if not settings.is_production() else None,
    openapi_url="/openapi.json" if not settings.is_production() else None,
)

# Add security middleware
add_security_to_app(
    app,
    enable_rate_limiting=not settings.is_production(),
    requests_per_minute=100
)

# CORS middleware - Use settings to configure allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(bins.router, prefix="/bins", tags=["bins"])
app.include_router(telemetry_update.router, prefix="/telemetry", tags=["telemetry"])
app.include_router(alerts.router, prefix="/ai_alerts", tags=["alerts"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])
app.include_router(crews.router, prefix="/crews", tags=["crews"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(routes.router, prefix="/routes", tags=["routes"])
app.include_router(predictions.router, prefix="/predictions", tags=["predictions"])

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "smart-waste-backend",
        "environment": settings.environment,
        "version": settings.api_version
    }

@app.get("/")
def root():
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "environment": settings.environment,
        "features": [
            "User Authentication & Authorization",
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
            "/auth",
            "/bins", 
            "/telemetry", 
            "/ai_alerts", 
            "/stats", 
            "/crews", 
            "/tasks",
            "/routes",
            "/predictions"
        ],
        "docs": "/docs",
        "openapi": "/openapi.json"
    }