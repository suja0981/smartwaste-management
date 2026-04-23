
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from database import get_db, BinDB, TaskDB, CrewDB, TelemetryDB, RouteHistoryDB, UserDB
from auth_utils import get_current_user

router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@router.get("/")
def get_dashboard_stats(db: Session = Depends(get_db), _user: UserDB = Depends(get_current_user)):
    """
    Dashboard KPI cards.
    GET /stats/
    Consolidated into 3 SQL queries instead of 10 sequential ones.
    """
    # Single query for all bin counts + avg fill
    bin_stats = db.query(
        func.count(BinDB.id).label("total"),
        func.sum(case((BinDB.status != "offline", 1), else_=0)).label("online"),
        func.sum(case((BinDB.status == "full", 1), else_=0)).label("full"),
        func.sum(case((BinDB.status == "warning", 1), else_=0)).label("warning"),
        func.avg(BinDB.fill_level_percent).label("avg_fill"),
    ).one()

    # Single query for all task counts
    task_stats = db.query(
        func.count(TaskDB.id).label("total"),
        func.sum(case((TaskDB.status == "pending", 1), else_=0)).label("pending"),
        func.sum(case((TaskDB.status == "in-progress", 1), else_=0)).label("in_progress"),
    ).one()

    # Single query for all crew counts
    crew_stats = db.query(
        func.sum(case((CrewDB.status == "available", 1), else_=0)).label("available"),
        func.sum(case((CrewDB.status == "active", 1), else_=0)).label("active"),
    ).one()

    total = bin_stats.total or 0
    online = bin_stats.online or 0

    return {
        "total_bins": total,
        "bins_online": online,
        "bins_full": bin_stats.full or 0,
        "bins_warning": bin_stats.warning or 0,
        "bins_offline": total - online,
        "average_fill_level": round(float(bin_stats.avg_fill), 2) if bin_stats.avg_fill else 0,
        "tasks": {
            "total": task_stats.total or 0,
            "pending": task_stats.pending or 0,
            "in_progress": task_stats.in_progress or 0,
        },
        "crews": {
            "available": crew_stats.available or 0,
            "active": crew_stats.active or 0,
        },
    }


@router.get("/bins")
def get_bin_stats(db: Session = Depends(get_db), _user: UserDB = Depends(get_current_user)):
    """
    Bin statistics grouped by status.
    GET /stats/bins
    Uses SQL GROUP BY instead of loading all bins into Python.
    """
    # Group by status in SQL
    status_counts = db.query(BinDB.status, func.count(BinDB.id)).group_by(BinDB.status).all()
    by_status = {status: count for status, count in status_counts}
    total = sum(by_status.values())

    # Fill distribution via SQL CASE
    dist = db.query(
        func.sum(case((BinDB.fill_level_percent <= 25, 1), else_=0)).label("q1"),
        func.sum(case(((BinDB.fill_level_percent > 25) & (BinDB.fill_level_percent <= 50), 1), else_=0)).label("q2"),
        func.sum(case(((BinDB.fill_level_percent > 50) & (BinDB.fill_level_percent <= 75), 1), else_=0)).label("q3"),
        func.sum(case((BinDB.fill_level_percent > 75, 1), else_=0)).label("q4"),
    ).one()

    return {
        "by_status": by_status,
        "fill_distribution": {
            "0-25": dist.q1 or 0,
            "26-50": dist.q2 or 0,
            "51-75": dist.q3 or 0,
            "76-100": dist.q4 or 0,
        },
        "total": total,
    }


@router.get("/zones")
def get_zone_stats(db: Session = Depends(get_db), _user: UserDB = Depends(get_current_user)):
    """
    Statistics grouped by zone.
    GET /stats/zones — Phase 6 multi-zone support.
    Uses SQL GROUP BY instead of loading all bins into Python.
    """
    rows = db.query(
        BinDB.zone_id,
        BinDB.status,
        func.count(BinDB.id).label("cnt"),
        func.avg(BinDB.fill_level_percent).label("avg_fill"),
    ).group_by(BinDB.zone_id, BinDB.status).all()

    by_zone: dict = {}
    for zone_id, status, cnt, avg_fill in rows:
        zone = zone_id or "unassigned"
        if zone not in by_zone:
            by_zone[zone] = {"total": 0, "average_fill": 0.0, "_fill_sum": 0.0, "_fill_rows": 0}
        by_zone[zone]["total"] += cnt
        by_zone[zone][status] = by_zone[zone].get(status, 0) + cnt
        by_zone[zone]["_fill_sum"] += float(avg_fill or 0) * cnt
        by_zone[zone]["_fill_rows"] += cnt

    result = {}
    for zone, data in by_zone.items():
        rows_count = data.pop("_fill_rows")
        fill_sum = data.pop("_fill_sum")
        data["average_fill"] = round(fill_sum / rows_count, 1) if rows_count else 0
        result[zone] = data

    return result


@router.get("/telemetry/recent")
def get_recent_telemetry_stats(db: Session = Depends(get_db), _user: UserDB = Depends(get_current_user)):
    """
    Count telemetry readings in the last 24 hours.
    Useful for monitoring data flow from IoT devices.
    GET /stats/telemetry/recent
    """
    cutoff = _utc_now() - timedelta(hours=24)
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


@router.get("/trends")
def get_trend_stats(days: int = 30, db: Session = Depends(get_db), _user: UserDB = Depends(get_current_user)):
    """
    Time-series analytics grouped by UTC day.
    GET /stats/trends?days=30

    Uses SQL GROUP BY DATE aggregation instead of loading all rows into Python.
    """
    days = max(1, min(days, 90))
    today = _utc_now().date()
    start_date = today - timedelta(days=days - 1)
    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)

    # Telemetry: aggregate in SQL — no row-by-row Python
    telemetry_agg = db.query(
        func.date(TelemetryDB.timestamp).label("day"),
        func.count(TelemetryDB.id).label("readings"),
        func.avg(TelemetryDB.fill_level_percent).label("avg_fill"),
    ).filter(
        TelemetryDB.timestamp >= start_dt
    ).group_by(
        func.date(TelemetryDB.timestamp)
    ).all()

    # Tasks: aggregate created and completed per day in SQL
    tasks_created_agg = db.query(
        func.date(TaskDB.created_at).label("day"),
        func.count(TaskDB.id).label("cnt"),
    ).filter(TaskDB.created_at >= start_dt).group_by(func.date(TaskDB.created_at)).all()

    tasks_completed_agg = db.query(
        func.date(TaskDB.completed_at).label("day"),
        func.count(TaskDB.id).label("cnt"),
    ).filter(
        TaskDB.completed_at.isnot(None),
        TaskDB.completed_at >= start_dt,
    ).group_by(func.date(TaskDB.completed_at)).all()

    # Route history: aggregate per day in SQL
    routes_agg = db.query(
        func.date(RouteHistoryDB.completion_date).label("day"),
        func.count(RouteHistoryDB.id).label("routes"),
        func.coalesce(func.sum(RouteHistoryDB.bins_collected), 0).label("bins_collected"),
        func.coalesce(func.sum(RouteHistoryDB.total_distance_km), 0.0).label("distance_km"),
    ).filter(RouteHistoryDB.completion_date >= start_dt).group_by(
        func.date(RouteHistoryDB.completion_date)
    ).all()

    # Build lookup dicts
    tel_by_day = {str(r.day): (r.readings, float(r.avg_fill or 0)) for r in telemetry_agg}
    created_by_day = {str(r.day): r.cnt for r in tasks_created_agg}
    completed_by_day = {str(r.day): r.cnt for r in tasks_completed_agg}
    routes_by_day = {str(r.day): r for r in routes_agg}

    series = []
    for offset in range(days):
        current_date = start_date + timedelta(days=offset)
        key = current_date.isoformat()
        readings, avg_fill = tel_by_day.get(key, (0, 0))
        route_row = routes_by_day.get(key)
        series.append({
            "date": key,
            "telemetry_readings": readings,
            "average_fill": round(avg_fill, 1),
            "tasks_created": created_by_day.get(key, 0),
            "tasks_completed": completed_by_day.get(key, 0),
            "routes_completed": route_row.routes if route_row else 0,
            "bins_collected": route_row.bins_collected if route_row else 0,
            "distance_km": round(float(route_row.distance_km), 2) if route_row else 0,
        })

    return {
        "days": days,
        "from": start_date.isoformat(),
        "to": today.isoformat(),
        "series": series,
    }

