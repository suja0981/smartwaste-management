from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import json

from database import get_db, BinDB, CrewDB, RouteDB, RouteHistoryDB
from models import (
    Route, OptimizeRouteRequest, RouteOptimizationResult, 
    CompareRoutesRequest, RouteComparison, UpdateRouteStatusRequest
)
from services.route_optimizer import RouteOptimizer, Location, WasteCollectionPoint
from utils import get_current_timestamp
import uuid

router = APIRouter()

# Default depot location (can be configured)
DEPOT_LAT = 21.1458  # Nagpur, Maharashtra
DEPOT_LON = 79.0882

def parse_location_string(location_str: str) -> tuple:
    """
    Parse location string to extract lat/lon if formatted as 'lat,lon'
    Returns (lat, lon) or (None, None) if parsing fails
    """
    try:
        if ',' in location_str:
            parts = location_str.split(',')
            return float(parts[0].strip()), float(parts[1].strip())
    except:
        pass
    return None, None

def get_bin_location(bin_db: BinDB) -> Location:
    """Get Location object from bin database record"""
    # Try to use lat/lon from database
    if bin_db.latitude and bin_db.longitude:
        return Location(bin_db.latitude, bin_db.longitude, bin_db.location)
    
    # Try to parse from location string
    lat, lon = parse_location_string(bin_db.location)
    if lat and lon:
        return Location(lat, lon, bin_db.location)
    
    # Fallback: generate random location near depot for demo
    import random
    offset_lat = random.uniform(-0.05, 0.05)
    offset_lon = random.uniform(-0.05, 0.05)
    return Location(DEPOT_LAT + offset_lat, DEPOT_LON + offset_lon, bin_db.location)

def determine_priority(fill_level: int, status: str) -> int:
    """Determine priority level based on fill level and status"""
    if status == "full" or fill_level >= 90:
        return 3  # High priority
    elif fill_level >= 70:
        return 2  # Medium priority
    else:
        return 1  # Low priority

@router.post("/optimize", response_model=RouteOptimizationResult)
def optimize_route(req: OptimizeRouteRequest, db: Session = Depends(get_db)):
    """
    Optimize a waste collection route.
    
    Takes a list of bin IDs and returns the optimal route using the specified algorithm.
    Optionally saves the route to the database.
    """
    # Validate bins exist
    bins = db.query(BinDB).filter(BinDB.id.in_(req.bin_ids)).all()
    
    if len(bins) != len(req.bin_ids):
        found_ids = [b.id for b in bins]
        missing = set(req.bin_ids) - set(found_ids)
        raise HTTPException(
            status_code=404, 
            detail=f"Bins not found: {missing}"
        )
    
    # Determine start location
    if req.start_latitude and req.start_longitude:
        start_location = Location(req.start_latitude, req.start_longitude, "Start Point")
    elif req.crew_id:
        crew = db.query(CrewDB).filter(CrewDB.id == req.crew_id).first()
        if crew and crew.current_latitude and crew.current_longitude:
            start_location = Location(
                crew.current_latitude, 
                crew.current_longitude, 
                f"Crew {crew.name}"
            )
        else:
            start_location = Location(DEPOT_LAT, DEPOT_LON, "Depot")
    else:
        start_location = Location(DEPOT_LAT, DEPOT_LON, "Depot")
    
    # Convert bins to collection points
    collection_points = []
    for bin_db in bins:
        location = get_bin_location(bin_db)
        priority = determine_priority(bin_db.fill_level_percent, bin_db.status)
        
        point = WasteCollectionPoint(
            bin_id=bin_db.id,
            location=location,
            fill_level=bin_db.fill_level_percent,
            priority=priority,
            estimated_time=10  # 10 minutes per bin
        )
        collection_points.append(point)
    
    # Run optimization
    optimizer = RouteOptimizer()
    optimizer.set_depot(Location(DEPOT_LAT, DEPOT_LON, "Depot"))
    
    result = optimizer.optimize(collection_points, start_location, req.algorithm)
    
    # Build waypoints
    waypoints = []
    for idx, point in enumerate(result["route"]):
        waypoints.append({
            "bin_id": point.bin_id,
            "latitude": point.location.lat,
            "longitude": point.location.lon,
            "fill_level": point.fill_level,
            "order": idx + 1,
            "estimated_collection_time": point.estimated_time
        })
    
    # Calculate efficiency score
    efficiency_score = (
        len(waypoints) / result["total_distance"]
        if result["total_distance"] > 0 else 0
    )
    
    # Save route if requested
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
            bin_ids=json.dumps([p.bin_id for p in result["route"]]),
            waypoints=json.dumps(waypoints),
            created_at=get_current_timestamp()
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
        efficiency_score=round(efficiency_score, 3)
    )

@router.post("/compare", response_model=RouteComparison)
def compare_routes(req: CompareRoutesRequest, db: Session = Depends(get_db)):
    """
    Compare all routing algorithms for the given bins.
    Returns results from all algorithms and recommends the best one.
    """
    # Validate bins
    bins = db.query(BinDB).filter(BinDB.id.in_(req.bin_ids)).all()
    
    if len(bins) != len(req.bin_ids):
        raise HTTPException(status_code=404, detail="Some bins not found")
    
    # Determine start location
    if req.start_latitude and req.start_longitude:
        start_location = Location(req.start_latitude, req.start_longitude, "Start")
    else:
        start_location = Location(DEPOT_LAT, DEPOT_LON, "Depot")
    
    # Convert bins to collection points
    collection_points = []
    for bin_db in bins:
        location = get_bin_location(bin_db)
        priority = determine_priority(bin_db.fill_level_percent, bin_db.status)
        
        point = WasteCollectionPoint(
            bin_id=bin_db.id,
            location=location,
            fill_level=bin_db.fill_level_percent,
            priority=priority
        )
        collection_points.append(point)
    
    # Run all algorithms
    optimizer = RouteOptimizer()
    optimizer.set_depot(Location(DEPOT_LAT, DEPOT_LON, "Depot"))
    
    results = optimizer.compare_algorithms(collection_points, start_location)
    
    # Convert to response format
    algorithm_results = []
    for result in results:
        waypoints = []
        for idx, point in enumerate(result["route"]):
            waypoints.append({
                "bin_id": point.bin_id,
                "latitude": point.location.lat,
                "longitude": point.location.lon,
                "fill_level": point.fill_level,
                "order": idx + 1,
                "estimated_collection_time": 10
            })
        
        efficiency = (
            len(waypoints) / result["total_distance"]
            if result["total_distance"] > 0 else 0
        )
        
        algorithm_results.append(RouteOptimizationResult(
            route_id=None,
            algorithm=result["algorithm"],
            total_distance_km=result["total_distance"],
            estimated_time_minutes=result["total_time"],
            bin_count=len(waypoints),
            waypoints=waypoints,
            efficiency_score=round(efficiency, 3)
        ))
    
    # Recommend best algorithm (highest efficiency score)
    best = max(algorithm_results, key=lambda r: r.efficiency_score)
    
    return RouteComparison(
        algorithms=algorithm_results,
        recommended=best.algorithm
    )

@router.get("/", response_model=List[Route])
def list_routes(
    status: str = None, 
    crew_id: str = None, 
    db: Session = Depends(get_db)
):
    """Get all routes, optionally filtered by status or crew"""
    query = db.query(RouteDB)
    
    if status:
        query = query.filter(RouteDB.status == status)
    if crew_id:
        query = query.filter(RouteDB.crew_id == crew_id)
    
    routes = query.order_by(RouteDB.created_at.desc()).all()
    
    return [Route(
        id=r.id,
        crew_id=r.crew_id,
        status=r.status,
        algorithm_used=r.algorithm_used,
        total_distance_km=r.total_distance_km,
        estimated_time_minutes=r.estimated_time_minutes,
        actual_time_minutes=r.actual_time_minutes,
        bin_ids=json.loads(r.bin_ids),
        waypoints=json.loads(r.waypoints),
        created_at=r.created_at,
        started_at=r.started_at,
        completed_at=r.completed_at
    ) for r in routes]

@router.get("/{route_id}", response_model=Route)
def get_route(route_id: str, db: Session = Depends(get_db)):
    """Get a specific route by ID"""
    route = db.query(RouteDB).filter(RouteDB.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    return Route(
        id=route.id,
        crew_id=route.crew_id,
        status=route.status,
        algorithm_used=route.algorithm_used,
        total_distance_km=route.total_distance_km,
        estimated_time_minutes=route.estimated_time_minutes,
        actual_time_minutes=route.actual_time_minutes,
        bin_ids=json.loads(route.bin_ids),
        waypoints=json.loads(route.waypoints),
        created_at=route.created_at,
        started_at=route.started_at,
        completed_at=route.completed_at
    )

@router.patch("/{route_id}/status", response_model=Route)
def update_route_status(
    route_id: str, 
    req: UpdateRouteStatusRequest, 
    db: Session = Depends(get_db)
):
    """Update route status (start, complete, cancel)"""
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
        
        # Save to history
        history = RouteHistoryDB(
            route_id=route.id,
            crew_id=route.crew_id,
            bins_collected=len(json.loads(route.bin_ids)),
            total_distance_km=route.total_distance_km,
            total_time_minutes=route.actual_time_minutes or route.estimated_time_minutes,
            fuel_efficiency_score=(
                len(json.loads(route.bin_ids)) / route.total_distance_km
                if route.total_distance_km > 0 else 0
            ),
            completion_date=route.completed_at,
            notes=req.notes
        )
        db.add(history)
    
    db.commit()
    db.refresh(route)
    
    return Route(
        id=route.id,
        crew_id=route.crew_id,
        status=route.status,
        algorithm_used=route.algorithm_used,
        total_distance_km=route.total_distance_km,
        estimated_time_minutes=route.estimated_time_minutes,
        actual_time_minutes=route.actual_time_minutes,
        bin_ids=json.loads(route.bin_ids),
        waypoints=json.loads(route.waypoints),
        created_at=route.created_at,
        started_at=route.started_at,
        completed_at=route.completed_at
    )

@router.delete("/{route_id}", status_code=204)
def delete_route(route_id: str, db: Session = Depends(get_db)):
    """Delete a route"""
    route = db.query(RouteDB).filter(RouteDB.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    db.delete(route)
    db.commit()
    return None

@router.get("/analytics/performance")
def get_route_analytics(db: Session = Depends(get_db)):
    """Get route performance analytics from history"""
    from sqlalchemy import func
    
    history = db.query(RouteHistoryDB).all()
    
    if not history:
        return {
            "total_routes_completed": 0,
            "total_bins_collected": 0,
            "total_distance_km": 0,
            "average_efficiency": 0,
            "average_time_minutes": 0
        }
    
    total_routes = len(history)
    total_bins = sum(h.bins_collected for h in history)
    total_distance = sum(h.total_distance_km for h in history)
    avg_efficiency = sum(h.fuel_efficiency_score or 0 for h in history) / total_routes
    avg_time = sum(h.total_time_minutes for h in history) / total_routes
    
    return {
        "total_routes_completed": total_routes,
        "total_bins_collected": total_bins,
        "total_distance_km": round(total_distance, 2),
        "average_efficiency": round(avg_efficiency, 3),
        "average_time_minutes": round(avg_time, 2)
    }