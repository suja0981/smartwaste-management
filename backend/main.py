
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base, SessionLocal
from config import get_settings
from security import add_security_to_app

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Production safety check ───────────────────────────────────────────────────
settings.validate_production_secrets()

# ── Create all DB tables (idempotent) ─────────────────────────────────────────
Base.metadata.create_all(bind=engine)


# ── Lifespan: startup + shutdown ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        # ── Prediction service warm-up ────────────────────────────────────
        # Rebuild in-memory prediction models from persisted telemetry so
        # predictions work immediately after restart.
        try:
            from routers.predictions import prediction_service
            n = prediction_service.rebuild_from_db(db)
            logger.info(f"[startup] Prediction service warmed up with {n} telemetry readings")
        except Exception as e:
            logger.warning(f"[startup] Prediction service warm-up failed (non-fatal): {e}")

        # ── Token blacklist pruning ────────────────────────────────────────────
        try:
            from datetime import datetime, timezone
            from database import TokenBlacklistDB
            cutoff = datetime.now(timezone.utc)
            deleted = (
                db.query(TokenBlacklistDB)
                .filter(TokenBlacklistDB.expires_at < cutoff)
                .delete(synchronize_session=False)
            )
            db.commit()
            if deleted:
                logger.info(f"[startup] Pruned {deleted} expired token blacklist entries")
        except Exception as e:
            logger.warning(f"[startup] Blacklist pruning failed (non-fatal): {e}")
    finally:
        db.close()

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
    enable_rate_limiting=not (settings.environment.lower() == "test"),
    enable_auth_rate_limiting=not (settings.environment.lower() == "test"),
    requests_per_minute=200,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
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
