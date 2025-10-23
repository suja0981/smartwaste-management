from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, BinDB
from models import TelemetryPayload
from utils import determine_bin_status, get_current_timestamp, format_timestamp_response

router = APIRouter()

@router.post("/", status_code=202)
def ingest_telemetry(payload: TelemetryPayload, db: Session = Depends(get_db)):
    """
    Ingest telemetry data from IoT sensors.
    Updates bin fill level, status, and other sensor readings.
    """
    bin_db = db.query(BinDB).filter(BinDB.id == payload.bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not registered")
    
    effective_timestamp = payload.timestamp or get_current_timestamp()
    
    # Update fill level and auto-determine status
    bin_db.fill_level_percent = payload.fill_level_percent
    bin_db.status = determine_bin_status(payload.fill_level_percent)
    
    # Update optional sensor readings if provided
    if payload.battery_percent is not None:
        bin_db.battery_percent = payload.battery_percent
    if payload.temperature_c is not None:
        bin_db.temperature_c = payload.temperature_c
    if payload.humidity_percent is not None:
        bin_db.humidity_percent = payload.humidity_percent
    
    bin_db.last_telemetry = effective_timestamp
    
    db.commit()
    
    return {
        "accepted": True, 
        "bin_id": payload.bin_id, 
        "timestamp": format_timestamp_response(effective_timestamp)
    }