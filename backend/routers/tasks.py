from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, TaskDB, CrewDB, BinDB
from models import Task, CreateTaskRequest, UpdateTaskRequest, AssignTaskRequest
from utils import get_current_timestamp

router = APIRouter()

@router.get("/", response_model=List[Task])
def list_tasks(db: Session = Depends(get_db)):
    """Get all tasks."""
    tasks = db.query(TaskDB).order_by(TaskDB.created_at.desc()).all()
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

@router.post("/", response_model=Task, status_code=201)
def create_task(req: CreateTaskRequest, db: Session = Depends(get_db)):
    """Create a new task."""
    existing = db.query(TaskDB).filter(TaskDB.id == req.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Task already exists")
    
    # Validate bin_id if provided
    if req.bin_id:
        bin_db = db.query(BinDB).filter(BinDB.id == req.bin_id).first()
        if not bin_db:
            raise HTTPException(status_code=404, detail="Bin not found")
    
    task_db = TaskDB(
        id=req.id,
        title=req.title,
        description=req.description,
        priority=req.priority,
        status="pending",
        bin_id=req.bin_id,
        location=req.location,
        estimated_time_minutes=req.estimated_time_minutes,
        alert_id=req.alert_id,
        created_at=get_current_timestamp(),
        due_date=req.due_date
    )
    db.add(task_db)
    db.commit()
    db.refresh(task_db)
    
    return Task(
        id=task_db.id,
        title=task_db.title,
        description=task_db.description,
        priority=task_db.priority,
        status=task_db.status,
        bin_id=task_db.bin_id,
        location=task_db.location,
        estimated_time_minutes=task_db.estimated_time_minutes,
        crew_id=task_db.crew_id,
        alert_id=task_db.alert_id,
        created_at=task_db.created_at,
        due_date=task_db.due_date,
        completed_at=task_db.completed_at
    )

@router.get("/{task_id}", response_model=Task)
def get_task(task_id: str, db: Session = Depends(get_db)):
    """Get a specific task by ID."""
    task_db = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not task_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return Task(
        id=task_db.id,
        title=task_db.title,
        description=task_db.description,
        priority=task_db.priority,
        status=task_db.status,
        bin_id=task_db.bin_id,
        location=task_db.location,
        estimated_time_minutes=task_db.estimated_time_minutes,
        crew_id=task_db.crew_id,
        alert_id=task_db.alert_id,
        created_at=task_db.created_at,
        due_date=task_db.due_date,
        completed_at=task_db.completed_at
    )

@router.patch("/{task_id}", response_model=Task)
def update_task(task_id: str, req: UpdateTaskRequest, db: Session = Depends(get_db)):
    """Update a task's information."""
    task_db = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not task_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if req.title is not None:
        task_db.title = req.title
    if req.description is not None:
        task_db.description = req.description
    if req.priority is not None:
        task_db.priority = req.priority
    if req.status is not None:
        task_db.status = req.status
        # If status changed to completed, set completed_at
        if req.status == "completed" and task_db.completed_at is None:
            task_db.completed_at = get_current_timestamp()
    if req.location is not None:
        task_db.location = req.location
    if req.crew_id is not None:
        # Validate crew exists
        crew_db = db.query(CrewDB).filter(CrewDB.id == req.crew_id).first()
        if not crew_db:
            raise HTTPException(status_code=404, detail="Crew not found")
        task_db.crew_id = req.crew_id
        # If assigning to a crew, change status to in-progress if pending
        if task_db.status == "pending":
            task_db.status = "in-progress"
    if req.estimated_time_minutes is not None:
        task_db.estimated_time_minutes = req.estimated_time_minutes
    if req.completed_at is not None:
        task_db.completed_at = req.completed_at
    
    db.commit()
    db.refresh(task_db)
    
    return Task(
        id=task_db.id,
        title=task_db.title,
        description=task_db.description,
        priority=task_db.priority,
        status=task_db.status,
        bin_id=task_db.bin_id,
        location=task_db.location,
        estimated_time_minutes=task_db.estimated_time_minutes,
        crew_id=task_db.crew_id,
        alert_id=task_db.alert_id,
        created_at=task_db.created_at,
        due_date=task_db.due_date,
        completed_at=task_db.completed_at
    )

@router.post("/{task_id}/assign", response_model=Task)
def assign_task(task_id: str, req: AssignTaskRequest, db: Session = Depends(get_db)):
    """Assign a task to a crew."""
    task_db = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not task_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    crew_db = db.query(CrewDB).filter(CrewDB.id == req.crew_id).first()
    if not crew_db:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    task_db.crew_id = req.crew_id
    # Auto-change status to in-progress
    if task_db.status == "pending":
        task_db.status = "in-progress"
    
    # Update crew status to active
    if crew_db.status == "available":
        crew_db.status = "active"
    
    db.commit()
    db.refresh(task_db)
    
    return Task(
        id=task_db.id,
        title=task_db.title,
        description=task_db.description,
        priority=task_db.priority,
        status=task_db.status,
        bin_id=task_db.bin_id,
        location=task_db.location,
        estimated_time_minutes=task_db.estimated_time_minutes,
        crew_id=task_db.crew_id,
        alert_id=task_db.alert_id,
        created_at=task_db.created_at,
        due_date=task_db.due_date,
        completed_at=task_db.completed_at
    )

@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    """Delete a task."""
    task_db = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not task_db:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task_db)
    db.commit()
    return None