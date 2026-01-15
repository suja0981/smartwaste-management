from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, CrewDB
from models import Crew, CreateCrewRequest, UpdateCrewRequest
from utils import get_current_timestamp

router = APIRouter()

@router.get("/", response_model=List[Crew])
def list_crews(db: Session = Depends(get_db)):
    """Get all crews."""
    crews = db.query(CrewDB).all()
    return [Crew(
        id=c.id,
        name=c.name,
        leader=c.leader,
        members_count=c.members_count,
        status=c.status,
        phone=c.phone,
        email=c.email,
        current_location=c.current_location,
        created_at=c.created_at
    ) for c in crews]

@router.post("/", response_model=Crew, status_code=201)
def create_crew(req: CreateCrewRequest, db: Session = Depends(get_db)):
    """Create a new crew."""
    existing = db.query(CrewDB).filter(CrewDB.id == req.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Crew already exists")
    
    crew_db = CrewDB(
        id=req.id,
        name=req.name,
        leader=req.leader,
        members_count=req.members_count,
        status="available",
        phone=req.phone,
        email=req.email,
        created_at=get_current_timestamp()
    )
    db.add(crew_db)
    db.commit()
    db.refresh(crew_db)
    
    return Crew(
        id=crew_db.id,
        name=crew_db.name,
        leader=crew_db.leader,
        members_count=crew_db.members_count,
        status=crew_db.status,
        phone=crew_db.phone,
        email=crew_db.email,
        current_location=crew_db.current_location,
        created_at=crew_db.created_at
    )

@router.get("/{crew_id}", response_model=Crew)
def get_crew(crew_id: str, db: Session = Depends(get_db)):
    """Get a specific crew by ID."""
    crew_db = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    if not crew_db:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    return Crew(
        id=crew_db.id,
        name=crew_db.name,
        leader=crew_db.leader,
        members_count=crew_db.members_count,
        status=crew_db.status,
        phone=crew_db.phone,
        email=crew_db.email,
        current_location=crew_db.current_location,
        created_at=crew_db.created_at
    )

@router.patch("/{crew_id}", response_model=Crew)
def update_crew(crew_id: str, req: UpdateCrewRequest, db: Session = Depends(get_db)):
    """Update a crew's information."""
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
    
    db.commit()
    db.refresh(crew_db)
    
    return Crew(
        id=crew_db.id,
        name=crew_db.name,
        leader=crew_db.leader,
        members_count=crew_db.members_count,
        status=crew_db.status,
        phone=crew_db.phone,
        email=crew_db.email,
        current_location=crew_db.current_location,
        created_at=crew_db.created_at
    )

@router.delete("/{crew_id}", status_code=204)
def delete_crew(crew_id: str, db: Session = Depends(get_db)):
    """Delete a crew."""
    crew_db = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    if not crew_db:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    db.delete(crew_db)
    db.commit()
    return None

@router.get("/{crew_id}/tasks")
def get_crew_tasks(crew_id: str, db: Session = Depends(get_db)):
    """Get all tasks assigned to a specific crew."""
    crew_db = db.query(CrewDB).filter(CrewDB.id == crew_id).first()
    if not crew_db:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    from database import TaskDB
    from models import Task
    
    tasks = db.query(TaskDB).filter(TaskDB.crew_id == crew_id).all()
    return [Task(
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
        completed_at=t.completed_at
    ) for t in tasks]