"""
routers/crews.py

Phase 6: Added optional `zone_id` query param to list_crews.
         Added PATCH /{crew_id}/zone for admin zone assignment.
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from database import get_db, CrewDB
from models import Crew, CreateCrewRequest, UpdateCrewRequest
from utils import get_current_timestamp
from auth_utils import require_admin

router = APIRouter()


def _crew_to_model(c: CrewDB) -> Crew:
    return Crew(
        id=c.id,
        name=c.name,
        leader=c.leader,
        members_count=c.members_count,
        status=c.status,
        phone=c.phone,
        email=c.email,
        current_location=c.current_location,
        current_latitude=c.current_latitude,
        current_longitude=c.current_longitude,
        zone_id=c.zone_id,
        created_at=c.created_at,
    )


@router.get("/", response_model=List[Crew])
def list_crews(
    zone_id: Optional[str] = Query(default=None, description="Filter by zone (Phase 6)"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    limit: int = Query(default=100, ge=1, le=500, description="Max records to return"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    db: Session = Depends(get_db),
):
    """Get all crews, optionally filtered by zone or status."""
    query = db.query(CrewDB)
    if zone_id:
        if zone_id == "unassigned":
            query = query.filter(CrewDB.zone_id.is_(None))
        else:
            query = query.filter(CrewDB.zone_id == zone_id)
    if status:
        query = query.filter(CrewDB.status == status)
    return [_crew_to_model(c) for c in query.order_by(CrewDB.name).offset(offset).limit(limit).all()]


@router.post("/", response_model=Crew, status_code=201)
def create_crew(req: CreateCrewRequest, db: Session = Depends(get_db)):
    if db.query(CrewDB).filter(CrewDB.id == req.id).first():
        raise HTTPException(status_code=409, detail="Crew already exists")

    crew_db = CrewDB(
        id=req.id,
        name=req.name,
        leader=req.leader,
        members_count=req.members_count,
        status="available",
        phone=req.phone,
        email=req.email,
        current_latitude=req.current_latitude,
        current_longitude=req.current_longitude,
        created_at=get_current_timestamp(),
    )
    db.add(crew_db)
    db.commit()
    db.refresh(crew_db)
    return _crew_to_model(crew_db)


@router.get("/{crew_id}", response_model=Crew)
def get_crew(crew_id: str, db: Session = Depends(get_db)):
    crew_db = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    if not crew_db:
        raise HTTPException(status_code=404, detail="Crew not found")
    return _crew_to_model(crew_db)


@router.patch("/{crew_id}", response_model=Crew)
def update_crew(crew_id: str, req: UpdateCrewRequest, db: Session = Depends(get_db)):
    crew_db = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    if not crew_db:
        raise HTTPException(status_code=404, detail="Crew not found")

    if req.name is not None:
        crew_db.name = req.name
    if req.leader is not None:
        crew_db.leader = req.leader
    if req.members_count is not None:
        crew_db.members_count = req.members_count
    if req.status is not None:
        crew_db.status = req.status
    if req.phone is not None:
        crew_db.phone = req.phone
    if req.email is not None:
        crew_db.email = req.email
    if req.current_location is not None:
        crew_db.current_location = req.current_location
    if req.current_latitude is not None:
        crew_db.current_latitude = req.current_latitude
    if req.current_longitude is not None:
        crew_db.current_longitude = req.current_longitude

    db.commit()
    db.refresh(crew_db)
    return _crew_to_model(crew_db)


@router.patch("/{crew_id}/zone")
def assign_zone(
    crew_id: str,
    zone_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Assign or unassign a crew to a zone. Admin only.  Phase 6.
    PATCH /crews/{crew_id}/zone?zone_id=north
    """
    crew_db = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    if not crew_db:
        raise HTTPException(status_code=404, detail="Crew not found")
    crew_db.zone_id = zone_id
    db.commit()
    return {"crew_id": crew_id, "zone_id": zone_id, "updated": True}


@router.delete("/{crew_id}", status_code=204)
def delete_crew(crew_id: str, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    crew_db = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    if not crew_db:
        raise HTTPException(status_code=404, detail="Crew not found")
    db.delete(crew_db)
    db.commit()
    return None


@router.get("/{crew_id}/tasks")
def get_crew_tasks(crew_id: str, db: Session = Depends(get_db)):
    """Get all tasks assigned to a specific crew."""
    if not db.query(CrewDB).filter(CrewDB.id == crew_id).first():
        raise HTTPException(status_code=404, detail="Crew not found")

    from database import TaskDB
    from models import Task

    tasks = db.query(TaskDB).filter(TaskDB.crew_id == crew_id).all()
    return [
        Task(
            id=t.id,
            title=t.title,
            description=t.description,
            priority=t.priority,
            status=t.status,
            bin_id=t.bin_id,
            location=t.location,
            estimated_time_minutes=t.estimated_time_minutes,
            crew_id=t.crew_id,
            alert_id=t.alert_id,
            created_at=t.created_at,
            due_date=t.due_date,
            completed_at=t.completed_at,
        )
        for t in tasks
    ]
