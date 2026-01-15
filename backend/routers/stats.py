from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, BinDB, AIAlertDB

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Get dashboard statistics.
    Returns counts and percentages for the dashboard overview.
    """
    total_bins = db.query(BinDB).count()
    bins_online = db.query(BinDB).filter(BinDB.status != "offline").count()
    bins_full = db.query(BinDB).filter(BinDB.status == "full").count()
    active_alerts = db.query(AIAlertDB).count()
    
    # Calculate average fill level
    avg_fill = db.query(func.avg(BinDB.fill_level_percent)).scalar()
    
    return {
        "total_bins": total_bins,
        "bins_online": bins_online,
        "bins_full": bins_full,
        "active_alerts": active_alerts,
        "average_fill_level": round(avg_fill, 2) if avg_fill else 0,
        "bins_offline": total_bins - bins_online
    }

@router.get("/stats/bins")
def get_bin_stats(db: Session = Depends(get_db)):
    """
    Get detailed bin statistics grouped by status.
    """
    bins = db.query(BinDB).all()
    
    stats_by_status = {}
    for bin in bins:
        status = bin.status
        if status not in stats_by_status:
            stats_by_status[status] = 0
        stats_by_status[status] += 1
    
    return {
        "by_status": stats_by_status,
        "total": len(bins)
    }

@router.get("/stats/alerts")
def get_alert_stats(db: Session = Depends(get_db)):
    """
    Get detailed alert statistics grouped by type.
    """
    alerts = db.query(AIAlertDB).all()
    
    stats_by_type = {}
    for alert in alerts:
        alert_type = alert.alert_type
        if alert_type not in stats_by_type:
            stats_by_type[alert_type] = 0
        stats_by_type[alert_type] += 1
    
    return {
        "by_type": stats_by_type,
        "total": len(alerts)
    }