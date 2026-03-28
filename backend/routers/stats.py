"""
routers/stats.py

FIX: Removed all AIAlertDB references (model was never defined in database.py,
     causing NameError on every request to /stats/).
ADDED: /zones endpoint for Phase 6 multi-zone support.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, BinDB, TaskDB, CrewDB, TelemetryDB
from auth_utils import require_admin

router = APIRouter()


@router.get("/")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Dashboard KPI cards.
    GET /stats/
    """
    total_bins = db.query(BinDB).count()
    bins_online = db.query(BinDB).filter(BinDB.status != "offline").count()
    bins_full = db.query(BinDB).filter(BinDB.status == "full").count()
    bins_warning = db.query(BinDB).filter(BinDB.status == "warning").count()
    avg_fill = db.query(func.avg(BinDB.fill_level_percent)).scalar()

    # Task stats
    total_tasks = db.query(TaskDB).count()
    pending_tasks = db.query(TaskDB).filter(TaskDB.status == "pending").count()
    in_progress_tasks = db.query(TaskDB).filter(TaskDB.status == "in-progress").count()

    # Crew stats
    available_crews = db.query(CrewDB).filter(CrewDB.status == "available").count()
    active_crews = db.query(CrewDB).filter(CrewDB.status == "active").count()

    return {
        "total_bins": total_bins,
        "bins_online": bins_online,
        "bins_full": bins_full,
        "bins_warning": bins_warning,
        "bins_offline": total_bins - bins_online,
        "average_fill_level": round(avg_fill, 2) if avg_fill else 0,
        "tasks": {
            "total": total_tasks,
            "pending": pending_tasks,
            "in_progress": in_progress_tasks,
        },
        "crews": {
            "available": available_crews,
            "active": active_crews,
        },
    }


@router.get("/bins")
def get_bin_stats(db: Session = Depends(get_db)):
    """
    Bin statistics grouped by status.
    GET /stats/bins
    """
    bins = db.query(BinDB).all()

    stats_by_status: dict = {}
    fill_distribution = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}

    for b in bins:
        stats_by_status[b.status] = stats_by_status.get(b.status, 0) + 1

        lvl = b.fill_level_percent
        if lvl <= 25:
            fill_distribution["0-25"] += 1
        elif lvl <= 50:
            fill_distribution["26-50"] += 1
        elif lvl <= 75:
            fill_distribution["51-75"] += 1
        else:
            fill_distribution["76-100"] += 1

    return {
        "by_status": stats_by_status,
        "fill_distribution": fill_distribution,
        "total": len(bins),
    }


@router.get("/zones")
def get_zone_stats(db: Session = Depends(get_db)):
    """
    Statistics grouped by zone.
    GET /stats/zones  — Phase 6 multi-zone support.
    """
    bins = db.query(BinDB).all()
    by_zone: dict = {}

    for b in bins:
        zone = b.zone_id or "unassigned"
        if zone not in by_zone:
            by_zone[zone] = {
                "total": 0, "full": 0, "warning": 0, "ok": 0, "offline": 0,
                "_fills": [],
            }
        entry = by_zone[zone]
        entry["total"] += 1
        entry["_fills"].append(b.fill_level_percent)
        entry[b.status] = entry.get(b.status, 0) + 1

    # Clean up internal list and add avg
    result = {}
    for zone, data in by_zone.items():
        fills = data.pop("_fills")
        data["average_fill"] = round(sum(fills) / len(fills), 1) if fills else 0
        result[zone] = data

    return result


@router.get("/telemetry/recent")
def get_recent_telemetry_stats(db: Session = Depends(get_db)):
    """
    Count telemetry readings in last 24h for monitoring data flow.
    GET /stats/telemetry/recent
    """
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(hours=24)
    count = db.query(TelemetryDB).filter(TelemetryDB.timestamp >= cutoff).count()
    bins_reporting = (
        db.query(TelemetryDB.bin_id)
        .filter(TelemetryDB.timestamp >= cutoff)
        .distinct()
        .count()
    )
    return {
        "readings_last_24h": count,
        "bins_reporting_last_24h": bins_reporting,
    }