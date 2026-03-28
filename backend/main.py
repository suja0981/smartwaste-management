"""
main.py — Smart Waste Management API entry point.

Phase changes:
  Phase 3: Added WebSocket router (/ws), FCM device-token endpoint.
  Phase 5: Added reports router (/reports).
  Phase 6: Zone filtering is handled inside individual routers via query params.

Startup event:
  Warms up the ML models from the TelemetryDB table so predictions are
  available immediately after deploy, not just after the next sensor cycle.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base, SessionLocal
from config import get_settings
from security import add_security_to_app

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Create all DB tables (idempotent) ─────────────────────────────────────────
Base.metadata.create_all(bind=engine)


# ── Lifespan: startup + shutdown ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Replaces the deprecated @app.on_event("startup") / ("shutdown") pattern.

    On startup: warm up ML models from persisted telemetry so predictions
    work immediately after a restart instead of waiting for the next IoT cycle.
    """
    try:
        from routers.predictions import ml_service
        db = SessionLocal()
        n = ml_service.rebuild_from_db(db)
        db.close()
        logger.info(f"[startup] ML models warmed up with {n} telemetry readings")
    except Exception as e:
        logger.warning(f"[startup] ML warm-up failed (non-fatal): {e}")

    yield  # application runs here

    logger.info("[shutdown] Smart Waste API shutting down gracefully")


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
    lifespan=lifespan,
    # Hide docs in production
    docs_url="/docs" if not settings.is_production() else None,
    redoc_url="/redoc" if not settings.is_production() else None,
    openapi_url="/openapi.json" if not settings.is_production() else None,
)

# ── Security middleware ───────────────────────────────────────────────────────
add_security_to_app(
    app,
    enable_rate_limiting=True,
    requests_per_minute=200,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
from routers import bins, telemetry_update, stats, crews, tasks, routes, auth, predictions
from routers import websocket_router, reports, driver

app.include_router(auth.router,              prefix="/auth",        tags=["authentication"])
app.include_router(bins.router,              prefix="/bins",        tags=["bins"])
app.include_router(telemetry_update.router,  prefix="/telemetry",   tags=["telemetry"])
app.include_router(stats.router,             prefix="/stats",       tags=["stats"])
app.include_router(crews.router,             prefix="/crews",       tags=["crews"])
app.include_router(tasks.router,             prefix="/tasks",       tags=["tasks"])
app.include_router(routes.router,            prefix="/routes",      tags=["routes"])
app.include_router(predictions.router,       prefix="/predictions", tags=["predictions"])
app.include_router(websocket_router.router,  tags=["realtime"])     # /ws  (Phase 3)
app.include_router(reports.router,           prefix="/reports",     tags=["reports"])  # Phase 5
app.include_router(driver.router,            prefix="/driver",      tags=["driver"])   # Phase 4


# ── Health / root endpoints ───────────────────────────────────────────────────

@app.get("/health", tags=["system"])
def health_check():
    from routers.websocket_router import manager
    return {
        "status": "ok",
        "service": "smart-waste-backend",
        "environment": settings.environment,
        "version": settings.api_version,
        "ws_connections": manager.connection_count,
    }


@app.get("/", tags=["system"])
def root():
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "environment": settings.environment,
        "features": [
            "User Authentication (local + Firebase/Google)",
            "IoT Sensor Integration (API Key auth)",
            "Real-time WebSocket dashboard feed",
            "Push Notifications (Firebase Cloud Messaging)",
            "Crew & Task Management",
            "Route Optimization (4 algorithms)",
            "ML Fill Prediction & Anomaly Detection",
            "PDF & Excel Report Export",
            "Multi-zone Support",
        ],
        "endpoints": {
            "auth":        "/auth",
            "bins":        "/bins",
            "telemetry":   "/telemetry",
            "stats":       "/stats",
            "crews":       "/crews",
            "tasks":       "/tasks",
            "routes":      "/routes",
            "predictions": "/predictions",
            "reports":     "/reports",
            "websocket":   "/ws?token=<jwt>",
            "docs":        "/docs",
        },
    }