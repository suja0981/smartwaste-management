"""
routers/telemetry_update.py — Phase 2 update.

POST /telemetry/ now requires auth:
  - IoT devices  →  X-API-Key: wsk_live_...
  - Dashboard/testing →  Authorization: Bearer <jwt>

GET /telemetry/{bin_id} remains open (read-only, no sensitive data).
"""

from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, BinDB, TelemetryDB
from models import TelemetryPayload
from utils import get_current_timestamp, format_timestamp_response, determine_bin_status
from routers.auth import get_device_or_user

router = APIRouter()


@router.post("/", status_code=202)
def ingest_telemetry(
    payload: TelemetryPayload,
    db: Session = Depends(get_db),
    # Phase 2: require either an API key (IoT) or a JWT (dashboard/testing)
    _auth: dict = Depends(get_device_or_user),
):
    """
    Ingest a telemetry reading from an IoT sensor.

    Auth options:
      - IoT devices: add header  X-API-Key: wsk_live_<your-key>
      - Swagger / testing: use Authorization: Bearer <admin-jwt>
    """
    bin_db = db.query(BinDB).filter(BinDB.id == payload.bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not registered")

    effective_timestamp = payload.timestamp or get_current_timestamp()

    # Update bin live state
    bin_db.fill_level_percent = payload.fill_level_percent
    bin_db.status = determine_bin_status(payload.fill_level_percent)

    if payload.battery_percent is not None:
        bin_db.battery_percent = payload.battery_percent
    if payload.temperature_c is not None:
        bin_db.temperature_c = payload.temperature_c
    if payload.humidity_percent is not None:
        bin_db.humidity_percent = payload.humidity_percent

    bin_db.last_telemetry = effective_timestamp

    # Persist to history
    record = TelemetryDB(
        bin_id=payload.bin_id,
        fill_level_percent=payload.fill_level_percent,
        battery_percent=payload.battery_percent,
        temperature_c=payload.temperature_c,
        humidity_percent=payload.humidity_percent,
        timestamp=effective_timestamp,
    )
    db.add(record)
    db.commit()

    # Feed ML models
    try:
        from routers.predictions import ml_service
        ml_service.ingest_telemetry(payload.bin_id, {
            "fill_level_percent": payload.fill_level_percent,
            "battery_percent": payload.battery_percent,
            "temperature_c": payload.temperature_c,
            "humidity_percent": payload.humidity_percent,
        })
    except Exception as e:
        print(f"[WARN] ML ingestion failed for {payload.bin_id}: {e}")

    return {
        "accepted": True,
        "bin_id": payload.bin_id,
        "timestamp": format_timestamp_response(effective_timestamp),
        "received_from": _auth.get("label", "unknown"),
    }


@router.get("/{bin_id}")
def get_telemetry_history(
    bin_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """Return the last N telemetry readings for a bin. No auth required (read-only)."""
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")

    records = (
        db.query(TelemetryDB)
        .filter(TelemetryDB.bin_id == bin_id)
        .order_by(TelemetryDB.timestamp.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": r.id,
            "bin_id": r.bin_id,
            "fill_level_percent": r.fill_level_percent,
            "battery_percent": r.battery_percent,
            "temperature_c": r.temperature_c,
            "humidity_percent": r.humidity_percent,
            "timestamp": format_timestamp_response(r.timestamp),
        }
        for r in records
    ]