from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import get_current_user
from database import BinDB, CrewDB, RouteDB, TaskDB, UserDB, get_db
from routers.routes import _finalize_route, _mark_bin_serviced, _mark_waypoint_done, _sync_crew_status
from utils import get_current_timestamp

router = APIRouter()


class DriverTask(BaseModel):
    id: str
    title: str
    priority: str
    status: str
    location: str
    bin_id: Optional[str] = None
    estimated_time_minutes: Optional[int] = None
    due_date: Optional[datetime] = None


class DriverWaypoint(BaseModel):
    bin_id: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    fill_level: int
    order: int
    estimated_collection_time: int = 10
    done: bool = False
    completed_at: Optional[str] = None


class DriverRoute(BaseModel):
    id: str
    status: str
    total_distance_km: float
    estimated_time_minutes: float
    waypoints: List[DriverWaypoint]
    total_waypoints: int
    completed_waypoints: int
    progress_percent: int


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    location_name: Optional[str] = None


class WaypointDoneRequest(BaseModel):
    bin_id: str


def _get_crew_for_user(user: UserDB, db: Session) -> Optional[CrewDB]:
    return db.query(CrewDB).filter(CrewDB.email == user.email).first()


def _select_current_route(crew_id: str, db: Session) -> Optional[RouteDB]:
    routes = (
        db.query(RouteDB)
        .filter(RouteDB.crew_id == crew_id, RouteDB.status.in_(["active", "paused", "planned"]))
        .order_by(RouteDB.created_at.desc())
        .all()
    )
    for route in routes:
        if route.status == "active":
            return route
    for route in routes:
        if route.status == "paused":
            return route
    return routes[0] if routes else None


def _build_driver_route(route: RouteDB, db: Session) -> DriverRoute:
    raw_waypoints = route.waypoints or []
    bin_ids = [waypoint.get("bin_id") for waypoint in raw_waypoints if waypoint.get("bin_id")]
    bins_map = {
        bin_db.id: bin_db for bin_db in db.query(BinDB).filter(BinDB.id.in_(bin_ids)).all()
    }

    waypoints = []
    for waypoint in raw_waypoints:
        bin_id = waypoint.get("bin_id", "")
        bin_db = bins_map.get(bin_id)
        waypoints.append(
            DriverWaypoint(
                bin_id=bin_id,
                location=(
                    (bin_db.location if bin_db else None)
                    or waypoint.get("location")
                    or bin_id
                ),
                latitude=waypoint.get("latitude") or (bin_db.latitude if bin_db else None),
                longitude=waypoint.get("longitude") or (bin_db.longitude if bin_db else None),
                fill_level=bin_db.fill_level_percent if bin_db else waypoint.get("fill_level", 0),
                order=waypoint.get("order", 0),
                estimated_collection_time=waypoint.get("estimated_collection_time", 10),
                done=bool(waypoint.get("done", False)),
                completed_at=waypoint.get("completed_at"),
            )
        )

    waypoints = sorted(waypoints, key=lambda item: item.order)
    completed_waypoints = sum(1 for waypoint in waypoints if waypoint.done)
    total_waypoints = len(waypoints)
    progress_percent = int(round((completed_waypoints / total_waypoints) * 100)) if total_waypoints else 0

    return DriverRoute(
        id=route.id,
        status=route.status,
        total_distance_km=route.total_distance_km,
        estimated_time_minutes=route.estimated_time_minutes,
        waypoints=waypoints,
        total_waypoints=total_waypoints,
        completed_waypoints=completed_waypoints,
        progress_percent=progress_percent,
    )


@router.get("/tasks", response_model=List[DriverTask])
def get_my_tasks(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crew = _get_crew_for_user(current_user, db)
    if not crew:
        return []

    tasks = (
        db.query(TaskDB)
        .filter(TaskDB.crew_id == crew.id, TaskDB.status.in_(["pending", "in-progress"]))
        .order_by(TaskDB.due_date.asc())
        .all()
    )

    return [
        DriverTask(
            id=task.id,
            title=task.title,
            priority=task.priority,
            status=task.status,
            location=task.location,
            bin_id=task.bin_id,
            estimated_time_minutes=task.estimated_time_minutes,
            due_date=task.due_date,
        )
        for task in tasks
    ]


@router.get("/route/current", response_model=Optional[DriverRoute])
def get_current_route(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crew = _get_crew_for_user(current_user, db)
    if not crew:
        return None

    route = _select_current_route(crew.id, db)
    if not route:
        return None

    return _build_driver_route(route, db)


@router.post("/tasks/{task_id}/complete")
def complete_task(
    task_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crew = _get_crew_for_user(current_user, db)
    task = db.query(TaskDB).filter(TaskDB.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if crew and task.crew_id != crew.id:
        raise HTTPException(status_code=403, detail="Task belongs to a different crew")

    completed_at = get_current_timestamp()
    task.status = "completed"
    task.completed_at = completed_at

    route_completed = False
    if crew and task.bin_id:
        active_route = (
            db.query(RouteDB)
            .filter(RouteDB.crew_id == crew.id, RouteDB.status == "active")
            .order_by(RouteDB.created_at.desc())
            .first()
        )
        if active_route and _mark_waypoint_done(active_route, task.bin_id, completed_at):
            remaining = [
                waypoint
                for waypoint in active_route.waypoints or []
                if not waypoint.get("done", False)
            ]
            if not remaining:
                _finalize_route(active_route, db, completed_at=completed_at)
                route_completed = True

        _mark_bin_serviced(db, task.bin_id, completed_at)

    if crew:
        _sync_crew_status(crew.id, db)

    db.commit()

    return {
        "message": "Task marked as completed",
        "task_id": task_id,
        "route_completed": route_completed,
    }


@router.post("/route/{route_id}/waypoint-done")
def complete_waypoint(
    route_id: str,
    payload: WaypointDoneRequest,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crew = _get_crew_for_user(current_user, db)
    if not crew:
        raise HTTPException(status_code=404, detail="No crew found for this user")

    route = (
        db.query(RouteDB)
        .filter(RouteDB.id == route_id, RouteDB.crew_id == crew.id)
        .first()
    )
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    if route.status != "active":
        raise HTTPException(status_code=400, detail="Waypoint completion requires an active route")

    completed_at = get_current_timestamp()
    if not _mark_waypoint_done(route, payload.bin_id, completed_at):
        raise HTTPException(status_code=404, detail="Waypoint not found in this route")

    for task in (
        db.query(TaskDB)
        .filter(
            TaskDB.bin_id == payload.bin_id,
            TaskDB.crew_id == crew.id,
            TaskDB.status.in_(["pending", "in-progress"]),
        )
        .all()
    ):
        task.status = "completed"
        task.completed_at = completed_at

    _mark_bin_serviced(db, payload.bin_id, completed_at)

    remaining = [
        waypoint
        for waypoint in route.waypoints or []
        if not waypoint.get("done", False)
    ]
    route_completed = False
    if not remaining:
        _finalize_route(route, db, completed_at=completed_at)
        route_completed = True

    _sync_crew_status(crew.id, db)
    db.commit()

    return {
        "updated": True,
        "route_completed": route_completed,
        "bin_id": payload.bin_id,
    }


@router.post("/location")
def update_location(
    payload: LocationUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    crew = _get_crew_for_user(current_user, db)
    if not crew:
        raise HTTPException(status_code=404, detail="No crew found for this user")

    crew.current_latitude = payload.latitude
    crew.current_longitude = payload.longitude
    if payload.location_name:
        crew.current_location = payload.location_name
    db.commit()

    return {"updated": True, "crew_id": crew.id}
