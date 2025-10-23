from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, BinDB, AIAlertDB
from models import AIAlertPayload, AIAlert
from utils import get_current_timestamp, format_timestamp_response

router = APIRouter()

@router.post("/", status_code=202)
def create_ai_alert(payload: AIAlertPayload, db: Session = Depends(get_db)):
    """
    Create a new AI-generated alert for a bin.
    Used by computer vision systems to report detected issues.
    """
    bin_db = db.query(BinDB).filter(BinDB.id == payload.bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not registered")
    
    effective_timestamp = payload.timestamp or get_current_timestamp()
    
    alert_db = AIAlertDB(
        bin_id=payload.bin_id,
        alert_type=payload.alert_type,
        description=payload.description,
        timestamp=effective_timestamp
    )
    db.add(alert_db)
    db.commit()
    db.refresh(alert_db)
    
    return {
        "accepted": True, 
        "bin_id": payload.bin_id, 
        "alert_type": payload.alert_type, 
        "timestamp": format_timestamp_response(effective_timestamp)
    }

@router.get("/", response_model=List[AIAlert])
def get_alerts(db: Session = Depends(get_db)):
    """
    Get all AI alerts ordered by most recent first.
    Used by the frontend to display current alerts.
    """
    alerts = db.query(AIAlertDB).order_by(AIAlertDB.timestamp.desc()).all()
    return [
        AIAlert(
            id=a.id,
            bin_id=a.bin_id,
            alert_type=a.alert_type,
            description=a.description,
            timestamp=a.timestamp
        ) for a in alerts
    ]

@router.get("/{alert_id}", response_model=AIAlert)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    """Get a specific alert by ID."""
    alert_db = db.query(AIAlertDB).filter(AIAlertDB.id == alert_id).first()
    if not alert_db:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return AIAlert(
        id=alert_db.id,
        bin_id=alert_db.bin_id,
        alert_type=alert_db.alert_type,
        description=alert_db.description,
        timestamp=alert_db.timestamp
    )

@router.delete("/{alert_id}", status_code=204)
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    """Delete/resolve an alert."""
    alert_db = db.query(AIAlertDB).filter(AIAlertDB.id == alert_id).first()
    if not alert_db:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    db.delete(alert_db)
    db.commit()
    return None