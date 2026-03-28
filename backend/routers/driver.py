"""
routers/driver.py  —  Phase 4: Driver-specific API endpoints.

These are simplified, mobile-optimised views designed for crew members
on Android phones rather than the full admin dashboard.

Endpoints:
  GET  /driver/tasks          → my assigned tasks (for crew leader's phone)
  GET  /driver/route/current  → active route with waypoints for navigation
  POST /driver/tasks/{id}/complete  → mark a task done from the field
  POST /driver/route/{id}/waypoint-done  → mark a single bin as collected
  POST /driver/location       → update crew's current GPS coordinates

Why separate from /tasks and /routes?
  - Response shapes are slimmer (only what the mobile PWA needs)
  - No admin fields like algorithm_used, efficiency_score, etc.
  - The /driver/* endpoints can later have their own rate limits and
    mobile-specific auth (e.g., PIN re-auth for field use)

Authentication:
  Standard Bearer JWT — the crew leader logs in via the PWA.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import get_current_user
from database import get_db, TaskDB, RouteDB, CrewDB, BinDB, UserDB
from utils import get_current_timestamp

router = APIRouter()


# ─── Pydantic schemas (slim, mobile-optimised) ───────────────────────────────

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


class DriverRoute(BaseModel):
    id: str
    status: str
    total_distance_km: float
    estimated_time_minutes: float
    waypoints: List[DriverWaypoint]


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    location_name: Optional[str] = None


# ─── Helper: find crew for current user ──────────────────────────────────────

def _get_crew_for_user(user: UserDB, db: Session) -> Optional[CrewDB]:
    """Find the crew where the leader email matches the logged-in user."""
    return db.query(CrewDB).filter(CrewDB.email == user.email).first()


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/tasks", response_model=List[DriverTask])
def get_my_tasks(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return tasks assigned to this crew leader's crew.
    Only shows pending + in-progress tasks (not completed).
    """
    crew = _get_crew_for_user(current_user, db)
    if not crew:
        return []

    tasks = (
        db.query(TaskDB)
        .filter(
            TaskDB.crew_id == crew.id,
            TaskDB.status.in_(["pending", "in-progress"]),
        )
        .order_by(TaskDB.due_date.asc())
        .all()
    )

    return [
        DriverTask(
            id=t.id,
            title=t.title,
            priority=t.priority,
            status=t.status,
            location=t.location,
            bin_id=t.bin_id,
            estimated_time_minutes=t.estimated_time_minutes,
            due_date=t.due_date,
        )
        for t in tasks
    ]


@router.get("/route/current", response_model=Optional[DriverRoute])
def get_current_route(
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the currently active route for this crew, if any."""
    crew = _get_crew_for_user(current_user, db)
    if not crew:
        return None

    route = (
        db.query(RouteDB)
        .filter(RouteDB.crew_id == crew.id, RouteDB.status == "active")
        .order_by(RouteDB.created_at.desc())
        .first()
    )

    if not route:
        return None

    # Enrich waypoints with current bin fill levels
    waypoints = []
    raw_waypoints = route.waypoints or []
    bin_ids = [w.get("bin_id") for w in raw_waypoints if w.get("bin_id")]
    bins_map = {
        b.id: b for b in db.query(BinDB).filter(BinDB.id.in_(bin_ids)).all()
    }

    for wp in raw_waypoints:
        bid = wp.get("bin_id", "")
        b = bins_map.get(bid)
        waypoints.append(DriverWaypoint(
            bin_id=bid,
            location=b.location if b else wp.get("location", ""),
            latitude=wp.get("latitude") or (b.latitude if b else None),
            longitude=wp.get("longitude") or (b.longitude if b else None),
            fill_level=b.fill_level_percent if b else wp.get("fill_level", 0),
            order=wp.get("order", 0),
            estimated_collection_time=wp.get("estimated_collection_time", 10),
        ))

    return DriverRoute(
        id=route.id,
        status=route.status,
        total_distance_km=route.total_distance_km,
        estimated_time_minutes=route.estimated_time_minutes,
        waypoints=sorted(waypoints, key=lambda w: w.order),
    )


@router.post("/tasks/{task_id}/complete")
def complete_task(
    task_id: str,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a task as completed from the field."""
    crew = _get_crew_for_user(current_user, db)
    task = db.query(TaskDB).filter(TaskDB.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if crew and task.crew_id != crew.id:
        raise HTTPException(status_code=403, detail="Task belongs to a different crew")

    task.status = "completed"
    task.completed_at = get_current_timestamp()
    db.commit()

    return {"message": "Task marked as completed", "task_id": task_id}


@router.post("/location")
def update_location(
    payload: LocationUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the crew's current GPS coordinates (called by PWA during active route)."""
    crew = _get_crew_for_user(current_user, db)
    if not crew:
        raise HTTPException(status_code=404, detail="No crew found for this user")

    crew.current_latitude = payload.latitude
    crew.current_longitude = payload.longitude
    if payload.location_name:
        crew.current_location = payload.location_name
    db.commit()

    return {"updated": True, "crew_id": crew.id}