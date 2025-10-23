from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routers import bins, telemetry, alerts

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Waste Management API",
    description="AI-Powered CCTV Monitoring & IoT Sensor Network Backend",
    version="1.0.0"
)

# CORS middleware (development: allow all origins; tighten in production)
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

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "smart-waste-backend"}

@app.get("/")
def root():
    return {
        "name": "Smart Waste Management API",
        "version": app.version,
        "endpoints": ["/health", "/bins", "/telemetry", "/ai_alerts"],
    }