"""
routers/telemetry_update.py  —  Phase 2 + Phase 3 update.

Phase 2: IoT devices authenticate with X-API-Key; dashboard/testing with JWT.
Phase 3: After persisting telemetry, broadcast to WebSocket clients and
         fire FCM notifications when a bin crosses the warning threshold.

Important: The WebSocket broadcast is fire-and-forget (asyncio.create_task).
  This keeps the HTTP response fast even if there are many WS clients.
"""

import asyncio
import logging
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, BinDB, TelemetryDB
from models import TelemetryPayload
from utils import get_current_timestamp, format_timestamp_response, determine_bin_status
from routers.auth import get_device_or_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Thresholds for FCM push notification (only send once per crossing)
_WARN_THRESHOLD = 80
_CRIT_THRESHOLD = 90


@router.post("/", status_code=202)
async def ingest_telemetry(
    payload: TelemetryPayload,
    db: Session = Depends(get_db),
    _auth: dict = Depends(get_device_or_user),
):
    """
    Ingest a telemetry reading from an IoT sensor.

    Auth options:
      - IoT devices: add header  X-API-Key: wsk_live_<your-key>
      - Swagger / testing: use Authorization: Bearer <admin-jwt>

    Side-effects (non-blocking):
      - WebSocket broadcast to all connected dashboard clients
      - FCM push notification if fill crosses 80% or 90%
      - ML model data ingestion
    """
    bin_db = db.query(BinDB).filter(BinDB.id == payload.bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not registered")

    effective_timestamp = payload.timestamp or get_current_timestamp()
    old_fill = bin_db.fill_level_percent   # capture before update

    # ── Update bin live state ──────────────────────────────────────────────
    bin_db.fill_level_percent = payload.fill_level_percent
    bin_db.status = determine_bin_status(payload.fill_level_percent)

    if payload.battery_percent is not None:
        bin_db.battery_percent = payload.battery_percent
    if payload.temperature_c is not None:
        bin_db.temperature_c = payload.temperature_c
    if payload.humidity_percent is not None:
        bin_db.humidity_percent = payload.humidity_percent

    bin_db.last_telemetry = effective_timestamp

    # ── Persist to history ────────────────────────────────────────────────
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

    ts_str = format_timestamp_response(effective_timestamp)

    # ── Phase 3: WebSocket broadcast (non-blocking) ────────────────────────
    try:
        from routers.websocket_router import manager
        asyncio.create_task(
            manager.broadcast_bin_update(
                bin_id=payload.bin_id,
                fill_level_percent=payload.fill_level_percent,
                status=bin_db.status,
                battery_percent=bin_db.battery_percent,
                temperature_c=bin_db.temperature_c,
                humidity_percent=bin_db.humidity_percent,
                timestamp=ts_str,
            )
        )
    except Exception as e:
        logger.warning(f"[WS] Broadcast failed for {payload.bin_id}: {e}")

    # ── Phase 3: FCM push notification on threshold crossing ───────────────
    # Only notify on the crossing event (old < threshold, new >= threshold)
    # to avoid spamming every 30-second reading while bin is already full.
    new_fill = payload.fill_level_percent
    _trigger_push_notification(old_fill, new_fill, bin_db, db)

    # ── Feed ML models ─────────────────────────────────────────────────────
    try:
        from routers.predictions import ml_service
        ml_service.ingest_telemetry(payload.bin_id, {
            "fill_level_percent": payload.fill_level_percent,
            "battery_percent": payload.battery_percent,
            "temperature_c": payload.temperature_c,
            "humidity_percent": payload.humidity_percent,
        })
    except Exception as e:
        logger.warning(f"[ML] Ingestion failed for {payload.bin_id}: {e}")

    return {
        "accepted": True,
        "bin_id": payload.bin_id,
        "fill_level_percent": payload.fill_level_percent,
        "status": bin_db.status,
        "timestamp": ts_str,
        "received_from": _auth.get("label", "unknown"),
    }


def _trigger_push_notification(
    old_fill: int, new_fill: int, bin_db: BinDB, db: Session
) -> None:
    """
    Fire an FCM notification only when the bin crosses a threshold for the
    first time (not on every reading while it's already above the threshold).
    """
    try:
        from services.notifications import notify_bin_fill_warning

        crossed_critical = old_fill < _CRIT_THRESHOLD <= new_fill
        crossed_warning = old_fill < _WARN_THRESHOLD <= new_fill and new_fill < _CRIT_THRESHOLD

        if crossed_critical or crossed_warning:
            notify_bin_fill_warning(
                bin_id=bin_db.id,
                location=bin_db.location,
                fill_level=new_fill,
                db=db,
            )
    except Exception as e:
        logger.warning(f"[FCM] Notification failed for {bin_db.id}: {e}")


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
    ]"""
routers/telemetry_update.py  —  Phase 2 + Phase 3 update.

Phase 2: IoT devices authenticate with X-API-Key; dashboard/testing with JWT.
Phase 3: After persisting telemetry, broadcast to WebSocket clients and
         fire FCM notifications when a bin crosses the warning threshold.

Important: The WebSocket broadcast is fire-and-forget (asyncio.create_task).
  This keeps the HTTP response fast even if there are many WS clients.
"""

import asyncio
import logging
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, BinDB, TelemetryDB
from models import TelemetryPayload
from utils import get_current_timestamp, format_timestamp_response, determine_bin_status
from routers.auth import get_device_or_user

logger = logging.getLogger(__name__)
router = APIRouter()

# Thresholds for FCM push notification (only send once per crossing)
_WARN_THRESHOLD = 80
_CRIT_THRESHOLD = 90


@router.post("/", status_code=202)
async def ingest_telemetry(
    payload: TelemetryPayload,
    db: Session = Depends(get_db),
    _auth: dict = Depends(get_device_or_user),
):
    """
    Ingest a telemetry reading from an IoT sensor.

    Auth options:
      - IoT devices: add header  X-API-Key: wsk_live_<your-key>
      - Swagger / testing: use Authorization: Bearer <admin-jwt>

    Side-effects (non-blocking):
      - WebSocket broadcast to all connected dashboard clients
      - FCM push notification if fill crosses 80% or 90%
      - ML model data ingestion
    """
    bin_db = db.query(BinDB).filter(BinDB.id == payload.bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not registered")

    effective_timestamp = payload.timestamp or get_current_timestamp()
    old_fill = bin_db.fill_level_percent   # capture before update

    # ── Update bin live state ──────────────────────────────────────────────
    bin_db.fill_level_percent = payload.fill_level_percent
    bin_db.status = determine_bin_status(payload.fill_level_percent)

    if payload.battery_percent is not None:
        bin_db.battery_percent = payload.battery_percent
    if payload.temperature_c is not None:
        bin_db.temperature_c = payload.temperature_c
    if payload.humidity_percent is not None:
        bin_db.humidity_percent = payload.humidity_percent

    bin_db.last_telemetry = effective_timestamp

    # ── Persist to history ────────────────────────────────────────────────
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

    ts_str = format_timestamp_response(effective_timestamp)

    # ── Phase 3: WebSocket broadcast (non-blocking) ────────────────────────
    try:
        from routers.websocket_router import manager
        asyncio.create_task(
            manager.broadcast_bin_update(
                bin_id=payload.bin_id,
                fill_level_percent=payload.fill_level_percent,
                status=bin_db.status,
                battery_percent=bin_db.battery_percent,
                temperature_c=bin_db.temperature_c,
                humidity_percent=bin_db.humidity_percent,
                timestamp=ts_str,
            )
        )
    except Exception as e:
        logger.warning(f"[WS] Broadcast failed for {payload.bin_id}: {e}")

    # ── Phase 3: FCM push notification on threshold crossing ───────────────
    # Only notify on the crossing event (old < threshold, new >= threshold)
    # to avoid spamming every 30-second reading while bin is already full.
    new_fill = payload.fill_level_percent
    _trigger_push_notification(old_fill, new_fill, bin_db, db)

    # ── Feed ML models ─────────────────────────────────────────────────────
    try:
        from routers.predictions import ml_service
        ml_service.ingest_telemetry(payload.bin_id, {
            "fill_level_percent": payload.fill_level_percent,
            "battery_percent": payload.battery_percent,
            "temperature_c": payload.temperature_c,
            "humidity_percent": payload.humidity_percent,
        })
    except Exception as e:
        logger.warning(f"[ML] Ingestion failed for {payload.bin_id}: {e}")

    return {
        "accepted": True,
        "bin_id": payload.bin_id,
        "fill_level_percent": payload.fill_level_percent,
        "status": bin_db.status,
        "timestamp": ts_str,
        "received_from": _auth.get("label", "unknown"),
    }


def _trigger_push_notification(
    old_fill: int, new_fill: int, bin_db: BinDB, db: Session
) -> None:
    """
    Fire an FCM notification only when the bin crosses a threshold for the
    first time (not on every reading while it's already above the threshold).
    """
    try:
        from services.notifications import notify_bin_fill_warning

        crossed_critical = old_fill < _CRIT_THRESHOLD <= new_fill
        crossed_warning = old_fill < _WARN_THRESHOLD <= new_fill and new_fill < _CRIT_THRESHOLD

        if crossed_critical or crossed_warning:
            notify_bin_fill_warning(
                bin_id=bin_db.id,
                location=bin_db.location,
                fill_level=new_fill,
                db=db,
            )
    except Exception as e:
        logger.warning(f"[FCM] Notification failed for {bin_db.id}: {e}")


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