from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, BinDB, CrewDB, RouteDB, RouteHistoryDB
from models import (
    Route, OptimizeRouteRequest, RouteOptimizationResult,
    CompareRoutesRequest, RouteComparison, UpdateRouteStatusRequest
)
from services.route_optimizer import RouteOptimizer, Location, WasteCollectionPoint
from utils import get_current_timestamp
import uuid

router = APIRouter()

DEPOT_LAT = 21.1458   # Nagpur depot — override via env if needed
DEPOT_LON = 79.0882


# ─── Helpers ──────────────────────────────────────────────────────────────────

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
    import random
    return Location(
        DEPOT_LAT + random.uniform(-0.05, 0.05),
        DEPOT_LON + random.uniform(-0.05, 0.05),
        bin_db.location,
    )


def determine_priority(fill_level: int, status: str) -> int:
    if status == "full" or fill_level >= 90:
        return 3
    elif fill_level >= 70:
        return 2
    return 1


def _route_db_to_model(r: RouteDB) -> Route:
    """
    FIX: Column(JSON) already deserialises to Python list/dict automatically.
    Never call json.loads() on these fields — they're already native objects.
    """
    return Route(
        id=r.id,
        crew_id=r.crew_id,
        status=r.status,
        algorithm_used=r.algorithm_used,
        total_distance_km=r.total_distance_km,
        estimated_time_minutes=r.estimated_time_minutes,
        actual_time_minutes=r.actual_time_minutes,
        bin_ids=r.bin_ids,        # already a list
        waypoints=r.waypoints,    # already a list of dicts
        created_at=r.created_at,
        started_at=r.started_at,
        completed_at=r.completed_at,
    )


# ─── POST /routes/optimize ────────────────────────────────────────────────────

@router.post("/optimize", response_model=RouteOptimizationResult)
def optimize_route(req: OptimizeRouteRequest, db: Session = Depends(get_db)):
    bins = db.query(BinDB).filter(BinDB.id.in_(req.bin_ids)).all()

    if len(bins) != len(req.bin_ids):
        found = {b.id for b in bins}
        missing = set(req.bin_ids) - found
        raise HTTPException(status_code=404, detail=f"Bins not found: {missing}")

    # Determine start location
    if req.start_latitude and req.start_longitude:
        start_location = Location(req.start_latitude, req.start_longitude, "Start Point")
    elif req.crew_id:
        crew = db.query(CrewDB).filter(CrewDB.id == req.crew_id).first()
        if crew and crew.current_latitude and crew.current_longitude:
            start_location = Location(crew.current_latitude, crew.current_longitude, crew.name)
        else:
            start_location = Location(DEPOT_LAT, DEPOT_LON, "Depot")
    else:
        start_location = Location(DEPOT_LAT, DEPOT_LON, "Depot")

    collection_points = [
        WasteCollectionPoint(
            bin_id=b.id,
            location=get_bin_location(b),
            fill_level=b.fill_level_percent,
            priority=determine_priority(b.fill_level_percent, b.status),
            estimated_time=10,
        )
        for b in bins
    ]

    optimizer = RouteOptimizer()
    optimizer.set_depot(Location(DEPOT_LAT, DEPOT_LON, "Depot"))
    result = optimizer.optimize(collection_points, start_location, req.algorithm)

    waypoints = [
        {
            "bin_id": p.bin_id,
            "latitude": p.location.lat,
            "longitude": p.location.lon,
            "fill_level": p.fill_level,
            "order": idx + 1,
            "estimated_collection_time": p.estimated_time,
        }
        for idx, p in enumerate(result["route"])
    ]

    efficiency_score = (
        len(waypoints) / result["total_distance"] if result["total_distance"] > 0 else 0
    )

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
            # FIX: assign native Python objects — Column(JSON) serialises automatically.
            # The old code did json.dumps() here which double-serialised the data.
            bin_ids=[p.bin_id for p in result["route"]],
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


# ─── POST /routes/compare ────────────────────────────────────────────────────

@router.post("/compare", response_model=RouteComparison)
def compare_routes(req: CompareRoutesRequest, db: Session = Depends(get_db)):
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
            bin_id=b.id,
            location=get_bin_location(b),
            fill_level=b.fill_level_percent,
            priority=determine_priority(b.fill_level_percent, b.status),
        )
        for b in bins
    ]

    optimizer = RouteOptimizer()
    optimizer.set_depot(Location(DEPOT_LAT, DEPOT_LON, "Depot"))
    results = optimizer.compare_algorithms(collection_points, start_location)

    algorithm_results = []
    for result in results:
        waypoints = [
            {
                "bin_id": p.bin_id,
                "latitude": p.location.lat,
                "longitude": p.location.lon,
                "fill_level": p.fill_level,
                "order": idx + 1,
                "estimated_collection_time": 10,
            }
            for idx, p in enumerate(result["route"])
        ]
        efficiency = (
            len(waypoints) / result["total_distance"] if result["total_distance"] > 0 else 0
        )
        algorithm_results.append(
            RouteOptimizationResult(
                route_id=None,
                algorithm=result["algorithm"],
                total_distance_km=result["total_distance"],
                estimated_time_minutes=result["total_time"],
                bin_count=len(waypoints),
                waypoints=waypoints,
                efficiency_score=round(efficiency, 3),
            )
        )

    best = max(algorithm_results, key=lambda r: r.efficiency_score)
    return RouteComparison(algorithms=algorithm_results, recommended=best.algorithm)


# ─── GET /routes/ ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[Route])
def list_routes(
    status: str = None,
    crew_id: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(RouteDB)
    if status:
        query = query.filter(RouteDB.status == status)
    if crew_id:
        query = query.filter(RouteDB.crew_id == crew_id)

    return [_route_db_to_model(r) for r in query.order_by(RouteDB.created_at.desc()).all()]


# ─── GET /routes/analytics/performance ───────────────────────────────────────
# Must be declared BEFORE /{route_id} to avoid being caught by that path param.

@router.get("/analytics/performance")
def get_route_analytics(db: Session = Depends(get_db)):
    history = db.query(RouteHistoryDB).all()

    if not history:
        return {
            "total_routes_completed": 0,
            "total_bins_collected": 0,
            "total_distance_km": 0,
            "average_efficiency": 0,
            "average_time_minutes": 0,
        }

    total_routes = len(history)
    return {
        "total_routes_completed": total_routes,
        "total_bins_collected": sum(h.bins_collected for h in history),
        "total_distance_km": round(sum(h.total_distance_km for h in history), 2),
        "average_efficiency": round(
            sum(h.fuel_efficiency_score or 0 for h in history) / total_routes, 3
        ),
        "average_time_minutes": round(
            sum(h.total_time_minutes for h in history) / total_routes, 2
        ),
    }


# ─── GET /routes/{route_id} ───────────────────────────────────────────────────

@router.get("/{route_id}", response_model=Route)
def get_route(route_id: str, db: Session = Depends(get_db)):
    route = db.query(RouteDB).filter(RouteDB.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return _route_db_to_model(route)


# ─── PATCH /routes/{route_id}/status ─────────────────────────────────────────

@router.patch("/{route_id}/status", response_model=Route)
def update_route_status(
    route_id: str,
    req: UpdateRouteStatusRequest,
    db: Session = Depends(get_db),
):
    route = db.query(RouteDB).filter(RouteDB.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    route.status = req.status

    if req.status == "active" and not route.started_at:
        route.started_at = get_current_timestamp()

    if req.status == "completed":
        route.completed_at = get_current_timestamp()
        if req.actual_time_minutes:
            route.actual_time_minutes = req.actual_time_minutes

        bin_count = len(route.bin_ids) if route.bin_ids else 0
        history = RouteHistoryDB(
            route_id=route.id,
            crew_id=route.crew_id,
            bins_collected=bin_count,
            total_distance_km=route.total_distance_km,
            total_time_minutes=route.actual_time_minutes or route.estimated_time_minutes,
            fuel_efficiency_score=(
                bin_count / route.total_distance_km if route.total_distance_km > 0 else 0
            ),
            completion_date=route.completed_at,
            notes=req.notes,
        )
        db.add(history)

    db.commit()
    db.refresh(route)
    return _route_db_to_model(route)


# ─── DELETE /routes/{route_id} ────────────────────────────────────────────────

@router.delete("/{route_id}", status_code=204)
def delete_route(route_id: str, db: Session = Depends(get_db)):
    route = db.query(RouteDB).filter(RouteDB.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    db.delete(route)
    db.commit()
    return None