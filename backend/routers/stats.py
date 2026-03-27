from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, BinDB

router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# FIX: Router is mounted at /stats in main.py.
# Paths here must NOT repeat /stats — that was causing 404s on every stats call.
# Correct URLs become:  GET /stats/  |  GET /stats/bins  |  GET /stats/alerts
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Dashboard overview statistics.
    Returns counts and averages used by the KPI cards.
    GET /stats/
    """
    total_bins = db.query(BinDB).count()
    bins_online = db.query(BinDB).filter(BinDB.status != "offline").count()
    bins_full = db.query(BinDB).filter(BinDB.status == "full").count()
    bins_warning = db.query(BinDB).filter(BinDB.status == "warning").count()
    active_alerts = db.query(AIAlertDB).count()

    avg_fill = db.query(func.avg(BinDB.fill_level_percent)).scalar()

    return {
        "total_bins": total_bins,
        "bins_online": bins_online,
        "bins_full": bins_full,
        "bins_warning": bins_warning,
        "bins_offline": total_bins - bins_online,
        "active_alerts": active_alerts,
        "average_fill_level": round(avg_fill, 2) if avg_fill else 0,
    }


@router.get("/bins")
def get_bin_stats(db: Session = Depends(get_db)):
    """
    Bin statistics grouped by status.
    GET /stats/bins
    """
    bins = db.query(BinDB).all()

    stats_by_status: dict = {}
    for b in bins:
        stats_by_status[b.status] = stats_by_status.get(b.status, 0) + 1

    return {
        "by_status": stats_by_status,
        "total": len(bins),
    }


@router.get("/alerts")
def get_alert_stats(db: Session = Depends(get_db)):
    """
    Alert statistics grouped by type.
    GET /stats/alerts
    """
    alerts = db.query(AIAlertDB).all()

    stats_by_type: dict = {}
    for a in alerts:
        stats_by_type[a.alert_type] = stats_by_type.get(a.alert_type, 0) + 1

    return {
        "by_type": stats_by_type,
        "total": len(alerts),
    }