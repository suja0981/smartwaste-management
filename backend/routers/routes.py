from datetime import datetime
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth_utils import get_current_user, require_admin
from database import BinDB, CrewDB, RouteDB, RouteHistoryDB, TaskDB, get_db
from models import (
    CompareRoutesRequest,
    OptimizeRouteRequest,
    Route,
    RouteComparison,
    RouteOptimizationResult,
    UpdateRouteStatusRequest,
)
from services.route_optimizer import Location, RouteOptimizer, WasteCollectionPoint
from utils import determine_bin_status, get_current_timestamp

router = APIRouter()

DEPOT_LAT = 21.1458
DEPOT_LON = 79.0882


def parse_location_string(location_str: str):
    try:
        if "," in location_str:
            parts = location_str.split(",")
            return float(parts[0].strip()), float(parts[1].strip())
    except Exception:
        pass
    return None, None


def get_bin_location(bin_db: BinDB) -> Location:
    if bin_db.latitude and bin_db.longitude:
        return Location(bin_db.latitude, bin_db.longitude, bin_db.location)

    lat, lon = parse_location_string(bin_db.location)
    if lat and lon:
        return Location(lat, lon, bin_db.location)

    # Use depot coordinates as the fallback — random coordinates were removed
    # because they produced fabricated routes that silently diverged from reality.
    return Location(DEPOT_LAT, DEPOT_LON, bin_db.location)


def determine_priority(fill_level: int, status: str) -> int:
    if status == "full" or fill_level >= 90:
        return 3
    if fill_level >= 70:
        return 2
    return 1


def _route_db_to_model(route_db: RouteDB) -> Route:
    return Route(
        id=route_db.id,
        crew_id=route_db.crew_id,
        status=route_db.status,
        algorithm_used=route_db.algorithm_used,
        total_distance_km=route_db.total_distance_km,
        estimated_time_minutes=route_db.estimated_time_minutes,
        actual_time_minutes=route_db.actual_time_minutes,
        bin_ids=route_db.bin_ids or [],
        waypoints=route_db.waypoints or [],
        created_at=route_db.created_at,
        started_at=route_db.started_at,
        completed_at=route_db.completed_at,
    )


def _set_waypoint_defaults(route: RouteDB) -> None:
    next_waypoints = []
    for index, waypoint in enumerate(route.waypoints or [], start=1):
        next_waypoint = dict(waypoint)
        next_waypoint.setdefault("order", index)
        next_waypoint.setdefault("estimated_collection_time", 10)
        next_waypoint.setdefault("done", False)
        next_waypoints.append(next_waypoint)
    route.waypoints = next_waypoints


def _route_duration_minutes(route: RouteDB, completed_at: datetime) -> float:
    if route.actual_time_minutes is not None:
        return route.actual_time_minutes

    if route.started_at:
        delta = completed_at - route.started_at
        return round(max(delta.total_seconds(), 0) / 60, 2)

    return round(route.estimated_time_minutes, 2)


def _complete_open_tasks_for_bin(
    db: Session,
    *,
    bin_id: str,
    crew_id: Optional[str],
    completed_at: datetime,
) -> None:
    query = db.query(TaskDB).filter(
        TaskDB.bin_id == bin_id,
        TaskDB.status.in_(["pending", "in-progress"]),
    )
    if crew_id:
        query = query.filter(or_(TaskDB.crew_id == crew_id, TaskDB.crew_id.is_(None)))

    for task_db in query.all():
        if crew_id and task_db.crew_id is None:
            task_db.crew_id = crew_id
        task_db.status = "completed"
        task_db.completed_at = completed_at


def _mark_bin_serviced(db: Session, bin_id: str, completed_at: datetime) -> None:
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        return

    bin_db.fill_level_percent = 0
    if bin_db.status != "offline":
        bin_db.status = determine_bin_status(0)
    bin_db.last_telemetry = completed_at


def _ensure_route_tasks(route: RouteDB, db: Session, activate: bool) -> None:
    for waypoint in route.waypoints or []:
        bin_id = waypoint.get("bin_id")
        if not bin_id:
            continue

        query = db.query(TaskDB).filter(
            TaskDB.bin_id == bin_id,
            TaskDB.status.in_(["pending", "in-progress"]),
        )
        if route.crew_id:
            query = query.filter(or_(TaskDB.crew_id == route.crew_id, TaskDB.crew_id.is_(None)))

        task_db = query.order_by(TaskDB.created_at.desc()).first()
        if task_db:
            if route.crew_id and task_db.crew_id is None:
                task_db.crew_id = route.crew_id
            if activate and task_db.status == "pending":
                task_db.status = "in-progress"
            continue

        bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
        created_at = get_current_timestamp()
        db.add(
            TaskDB(
                id=f"task_{uuid.uuid4().hex[:8]}",
                title=f"Collect {bin_id}",
                description=f"Route-based collection task for {bin_id}",
                priority=(
                    "high"
                    if (bin_db and bin_db.fill_level_percent >= 90)
                    else "medium"
                    if (bin_db and bin_db.fill_level_percent >= 70)
                    else "low"
                ),
                status="in-progress" if activate else "pending",
                bin_id=bin_id,
                location=(
                    bin_db.location
                    if bin_db
                    else waypoint.get("location", bin_id)
                ),
                estimated_time_minutes=waypoint.get("estimated_collection_time", 10),
                crew_id=route.crew_id,
                created_at=created_at,
            )
        )


def _pause_route_tasks(route: RouteDB, db: Session) -> None:
    route_bin_ids = [waypoint.get("bin_id") for waypoint in route.waypoints or [] if waypoint.get("bin_id")]
    if not route_bin_ids:
        return

    query = db.query(TaskDB).filter(
        TaskDB.bin_id.in_(route_bin_ids),
        TaskDB.status == "in-progress",
    )
    if route.crew_id:
        query = query.filter(TaskDB.crew_id == route.crew_id)

    for task_db in query.all():
        task_db.status = "pending"


def _record_route_history(route: RouteDB, db: Session, notes: Optional[str]) -> None:
    existing = db.query(RouteHistoryDB).filter(RouteHistoryDB.route_id == route.id).first()
    if existing:
        existing.bins_collected = len(route.bin_ids or [])
        existing.total_distance_km = route.total_distance_km
        existing.total_time_minutes = route.actual_time_minutes or route.estimated_time_minutes
        existing.fuel_efficiency_score = (
            len(route.bin_ids or []) / route.total_distance_km if route.total_distance_km > 0 else 0
        )
        existing.completion_date = route.completed_at
        existing.notes = notes or existing.notes
        return

    db.add(
        RouteHistoryDB(
            route_id=route.id,
            crew_id=route.crew_id,
            bins_collected=len(route.bin_ids or []),
            total_distance_km=route.total_distance_km,
            total_time_minutes=route.actual_time_minutes or route.estimated_time_minutes,
            fuel_efficiency_score=(
                len(route.bin_ids or []) / route.total_distance_km if route.total_distance_km > 0 else 0
            ),
            completion_date=route.completed_at,
            notes=notes,
        )
    )


def _sync_crew_status(crew_id: Optional[str], db: Session) -> None:
    if not crew_id:
        return

    crew_db = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    if not crew_db:
        return

    active_routes = (
        db.query(RouteDB)
        .filter(RouteDB.crew_id == crew_id, RouteDB.status == "active")
        .count()
    )
    open_tasks = (
        db.query(TaskDB)
        .filter(TaskDB.crew_id == crew_id, TaskDB.status.in_(["pending", "in-progress"]))
        .count()
    )

    if active_routes > 0 or open_tasks > 0:
        crew_db.status = "active"
    elif crew_db.status != "offline":
        crew_db.status = "available"


def _mark_waypoint_done(route: RouteDB, bin_id: str, completed_at: datetime) -> bool:
    updated = False
    next_waypoints = []
    for waypoint in route.waypoints or []:
        next_waypoint = dict(waypoint)
        if next_waypoint.get("bin_id") == bin_id:
            next_waypoint["done"] = True
            next_waypoint["completed_at"] = completed_at.isoformat()
            updated = True
        next_waypoints.append(next_waypoint)

    if updated:
        route.waypoints = next_waypoints
    return updated


def _finalize_route(
    route: RouteDB,
    db: Session,
    *,
    completed_at: Optional[datetime] = None,
    actual_time_minutes: Optional[float] = None,
    notes: Optional[str] = None,
) -> None:
    completed_at = completed_at or get_current_timestamp()
    route.status = "completed"
    route.completed_at = route.completed_at or completed_at
    route.actual_time_minutes = (
        actual_time_minutes
        if actual_time_minutes is not None
        else _route_duration_minutes(route, route.completed_at)
    )

    next_waypoints = []
    for waypoint in route.waypoints or []:
        next_waypoint = dict(waypoint)
        next_waypoint["done"] = True
        next_waypoint.setdefault("completed_at", route.completed_at.isoformat())
        next_waypoints.append(next_waypoint)
        bin_id = next_waypoint.get("bin_id")
        if bin_id:
            _complete_open_tasks_for_bin(
                db,
                bin_id=bin_id,
                crew_id=route.crew_id,
                completed_at=route.completed_at,
            )
            _mark_bin_serviced(db, bin_id, route.completed_at)

    route.waypoints = next_waypoints
    _record_route_history(route, db, notes)
    _sync_crew_status(route.crew_id, db)


@router.post("/optimize", response_model=RouteOptimizationResult)
def optimize_route(req: OptimizeRouteRequest, db: Session = Depends(get_db), _user = Depends(get_current_user)):
    bins = db.query(BinDB).filter(BinDB.id.in_(req.bin_ids)).all()

    if len(bins) != len(req.bin_ids):
        found_ids = {bin_db.id for bin_db in bins}
        missing_ids = set(req.bin_ids) - found_ids
        raise HTTPException(status_code=404, detail=f"Bins not found: {missing_ids}")

    if req.start_latitude and req.start_longitude:
        start_location = Location(req.start_latitude, req.start_longitude, "Start Point")
    elif req.crew_id:
        crew_db = db.query(CrewDB).filter(CrewDB.id == req.crew_id).first()
        if crew_db and crew_db.current_latitude and crew_db.current_longitude:
            start_location = Location(crew_db.current_latitude, crew_db.current_longitude, crew_db.name)
        else:
            start_location = Location(DEPOT_LAT, DEPOT_LON, "Depot")
    else:
        start_location = Location(DEPOT_LAT, DEPOT_LON, "Depot")

    collection_points = [
        WasteCollectionPoint(
            bin_id=bin_db.id,
            location=get_bin_location(bin_db),
            fill_level=bin_db.fill_level_percent,
            priority=determine_priority(bin_db.fill_level_percent, bin_db.status),
            estimated_time=10,
        )
        for bin_db in bins
    ]

    optimizer = RouteOptimizer()
    optimizer.set_depot(Location(DEPOT_LAT, DEPOT_LON, "Depot"))
    result = optimizer.optimize(collection_points, start_location, req.algorithm)

    waypoints = [
        {
            "bin_id": point.bin_id,
            "location": point.location.name,
            "latitude": point.location.lat,
            "longitude": point.location.lon,
            "fill_level": point.fill_level,
            "order": index + 1,
            "estimated_collection_time": point.estimated_time,
            "done": False,
        }
        for index, point in enumerate(result["route"])
    ]

    efficiency_score = len(waypoints) / result["total_distance"] if result["total_distance"] > 0 else 0

    route_id = None
    if req.save_route:
        route_id = f"route_{uuid.uuid4().hex[:8]}"
        route_db = RouteDB(
            id=route_id,
            crew_id=req.crew_id,
            status="planned",
            algorithm_used=result["algorithm"],
            total_distance_km=result["total_distance"],
            estimated_time_minutes=result["total_time"],
            bin_ids=[point.bin_id for point in result["route"]],
            waypoints=waypoints,
            created_at=get_current_timestamp(),
        )
        db.add(route_db)
        db.commit()

    return RouteOptimizationResult(
        route_id=route_id,
        algorithm=result["algorithm"],
        total_distance_km=result["total_distance"],
        estimated_time_minutes=result["total_time"],
        bin_count=len(waypoints),
        waypoints=waypoints,
        efficiency_score=round(efficiency_score, 3),
    )


@router.post("/compare", response_model=RouteComparison)
def compare_routes(req: CompareRoutesRequest, db: Session = Depends(get_db), _user = Depends(get_current_user)):
    bins = db.query(BinDB).filter(BinDB.id.in_(req.bin_ids)).all()
    if len(bins) != len(req.bin_ids):
        raise HTTPException(status_code=404, detail="Some bins not found")

    start_location = (
        Location(req.start_latitude, req.start_longitude, "Start")
        if req.start_latitude and req.start_longitude
        else Location(DEPOT_LAT, DEPOT_LON, "Depot")
    )

    collection_points = [
        WasteCollectionPoint(
            bin_id=bin_db.id,
            location=get_bin_location(bin_db),
            fill_level=bin_db.fill_level_percent,
            priority=determine_priority(bin_db.fill_level_percent, bin_db.status),
        )
        for bin_db in bins
    ]

    optimizer = RouteOptimizer()
    optimizer.set_depot(Location(DEPOT_LAT, DEPOT_LON, "Depot"))
    results = optimizer.compare_algorithms(collection_points, start_location)

    algorithm_results = []
    for result in results:
        waypoints = [
            {
                "bin_id": point.bin_id,
                "location": point.location.name,
                "latitude": point.location.lat,
                "longitude": point.location.lon,
                "fill_level": point.fill_level,
                "order": index + 1,
                "estimated_collection_time": 10,
                "done": False,
            }
            for index, point in enumerate(result["route"])
        ]
        efficiency_score = len(waypoints) / result["total_distance"] if result["total_distance"] > 0 else 0
        algorithm_results.append(
            RouteOptimizationResult(
                route_id=None,
                algorithm=result["algorithm"],
                total_distance_km=result["total_distance"],
                estimated_time_minutes=result["total_time"],
                bin_count=len(waypoints),
                waypoints=waypoints,
                efficiency_score=round(efficiency_score, 3),
            )
        )

    best_result = max(algorithm_results, key=lambda item: item.efficiency_score)
    return RouteComparison(algorithms=algorithm_results, recommended=best_result.algorithm)


@router.get("/", response_model=List[Route])
def list_routes(
    status: Optional[str] = Query(default=None, description="Filter by status"),
    crew_id: Optional[str] = Query(default=None, description="Filter by crew"),
    db: Session = Depends(get_db),
    _user = Depends(get_current_user),
):
    query = db.query(RouteDB)
    if status:
        query = query.filter(RouteDB.status == status)
    if crew_id:
        query = query.filter(RouteDB.crew_id == crew_id)

    return [_route_db_to_model(route_db) for route_db in query.order_by(RouteDB.created_at.desc()).all()]


@router.get("/analytics/performance")
def get_route_analytics(db: Session = Depends(get_db), _user = Depends(get_current_user)):
    history_rows = db.query(RouteHistoryDB).all()
    if not history_rows:
        return {
            "total_routes_completed": 0,
            "total_bins_collected": 0,
            "total_distance_km": 0,
            "average_efficiency": 0,
            "average_time_minutes": 0,
        }

    total_routes = len(history_rows)
    return {
        "total_routes_completed": total_routes,
        "total_bins_collected": sum(history.bins_collected for history in history_rows),
        "total_distance_km": round(sum(history.total_distance_km for history in history_rows), 2),
        "average_efficiency": round(
            sum(history.fuel_efficiency_score or 0 for history in history_rows) / total_routes, 3
        ),
        "average_time_minutes": round(
            sum(history.total_time_minutes for history in history_rows) / total_routes, 2
        ),
    }


@router.get("/{route_id}", response_model=Route)
def get_route(route_id: str, db: Session = Depends(get_db), _user = Depends(get_current_user)):
    route_db = db.query(RouteDB).filter(RouteDB.id == route_id).first()
    if not route_db:
        raise HTTPException(status_code=404, detail="Route not found")
    return _route_db_to_model(route_db)


@router.patch("/{route_id}/status", response_model=Route)
def update_route_status(
    route_id: str,
    req: UpdateRouteStatusRequest,
    db: Session = Depends(get_db),
    _user = Depends(get_current_user),
):
    route_db = db.query(RouteDB).filter(RouteDB.id == route_id).first()
    if not route_db:
        raise HTTPException(status_code=404, detail="Route not found")

    now = get_current_timestamp()
    allowed_statuses = {"planned", "active", "paused", "completed", "cancelled"}

    if req.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Unsupported route status: {req.status}")

    if route_db.status in {"completed", "cancelled"} and req.status in {"active", "paused"}:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change a {route_db.status} route back to {req.status}",
        )

    if req.status == "active":
        if route_db.crew_id:
            active_route = (
                db.query(RouteDB)
                .filter(
                    RouteDB.crew_id == route_db.crew_id,
                    RouteDB.status == "active",
                    RouteDB.id != route_db.id,
                )
                .first()
            )
            if active_route:
                raise HTTPException(
                    status_code=409,
                    detail=f"Crew already has an active route: {active_route.id}",
                )

            crew_db = db.query(CrewDB).filter(CrewDB.id == route_db.crew_id).first()
            if crew_db:
                crew_db.status = "active"

        route_db.status = "active"
        route_db.started_at = route_db.started_at or now
        _set_waypoint_defaults(route_db)
        _ensure_route_tasks(route_db, db, activate=True)
        if route_db.crew_id:
            try:
                from services.notifications import notify_route_activated

                notify_route_activated(
                    route_id=route_db.id,
                    crew_id=route_db.crew_id,
                    bin_count=len(route_db.bin_ids or []),
                    db=db,
                )
            except Exception:
                pass

    elif req.status == "paused":
        if route_db.status != "active":
            raise HTTPException(status_code=400, detail="Only active routes can be paused")
        route_db.status = "paused"
        _pause_route_tasks(route_db, db)
        if route_db.crew_id:
            crew_db = db.query(CrewDB).filter(CrewDB.id == route_db.crew_id).first()
            if crew_db and crew_db.status != "offline":
                crew_db.status = "break"

    elif req.status == "completed":
        _set_waypoint_defaults(route_db)
        _ensure_route_tasks(route_db, db, activate=True)
        if route_db.started_at is None:
            route_db.started_at = now
        _finalize_route(
            route_db,
            db,
            completed_at=now,
            actual_time_minutes=req.actual_time_minutes,
            notes=req.notes,
        )

    else:
        route_db.status = req.status
        if req.status == "cancelled":
            _sync_crew_status(route_db.crew_id, db)

    db.commit()
    db.refresh(route_db)
    return _route_db_to_model(route_db)


@router.delete("/{route_id}", status_code=204)
def delete_route(route_id: str, db: Session = Depends(get_db), _admin = Depends(require_admin)):
    route_db = db.query(RouteDB).filter(RouteDB.id == route_id).first()
    if not route_db:
        raise HTTPException(status_code=404, detail="Route not found")
    db.delete(route_db)
    db.commit()
    return None
