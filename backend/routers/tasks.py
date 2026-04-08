"""
routers/tasks.py

Phase 3: Added FCM push notification when a task is assigned to a crew.
Phase 6: Added zone_id filter to list_tasks.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from auth_utils import require_admin
from database import get_db, TaskDB, CrewDB, BinDB
from models import Task, CreateTaskRequest, UpdateTaskRequest, AssignTaskRequest
from utils import get_current_timestamp

logger = logging.getLogger(__name__)
router = APIRouter()


def _task_to_model(t: TaskDB) -> Task:
    return Task(
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


@router.get("/", response_model=List[Task])
def list_tasks(
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    crew_id: Optional[str] = Query(default=None),
    zone_id: Optional[str] = Query(default=None, description="Filter by bin zone (Phase 6)"),
    limit: int = Query(default=100, ge=1, le=500, description="Max records to return"),
    offset: int = Query(default=0, ge=0, description="Number of records to skip"),
    db: Session = Depends(get_db),
):
    """Get all tasks with optional filters."""
    query = db.query(TaskDB)
    if status:
        query = query.filter(TaskDB.status == status)
    if priority:
        query = query.filter(TaskDB.priority == priority)
    if crew_id:
        query = query.filter(TaskDB.crew_id == crew_id)
    if zone_id:
        # Use a subquery instead of loading all bin IDs into Python
        if zone_id == "unassigned":
            bin_subq = db.query(BinDB.id).filter(BinDB.zone_id.is_(None)).subquery()
        else:
            bin_subq = db.query(BinDB.id).filter(BinDB.zone_id == zone_id).subquery()
        query = query.filter(TaskDB.bin_id.in_(bin_subq))

    return [
        _task_to_model(t)
        for t in query.order_by(TaskDB.created_at.desc()).offset(offset).limit(limit).all()
    ]


@router.post("/", response_model=Task, status_code=201)
def create_task(req: CreateTaskRequest, db: Session = Depends(get_db)):
    if db.query(TaskDB).filter(TaskDB.id == req.id).first():
        raise HTTPException(status_code=409, detail="Task already exists")

    if req.bin_id and not db.query(BinDB).filter(BinDB.id == req.bin_id).first():
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
        due_date=req.due_date,
    )
    db.add(task_db)
    db.commit()
    db.refresh(task_db)
    return _task_to_model(task_db)


@router.get("/{task_id}", response_model=Task)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task_db = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not task_db:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_to_model(task_db)


@router.patch("/{task_id}", response_model=Task)
def update_task(task_id: str, req: UpdateTaskRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _admin=Depends(require_admin)):
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
        if req.status == "completed" and task_db.completed_at is None:
            task_db.completed_at = get_current_timestamp()
    if req.location is not None:
        task_db.location = req.location
    if req.crew_id is not None:
        if not db.query(CrewDB).filter(CrewDB.id == req.crew_id).first():
            raise HTTPException(status_code=404, detail="Crew not found")
        old_crew = task_db.crew_id
        task_db.crew_id = req.crew_id
        if task_db.status == "pending":
            task_db.status = "in-progress"
        # Fire FCM if crew changed — run in background so it never blocks the response
        if old_crew != req.crew_id:
            background_tasks.add_task(_notify_assignment, task_db.id, task_db.title, task_db.location, task_db.crew_id)
    if req.estimated_time_minutes is not None:
        task_db.estimated_time_minutes = req.estimated_time_minutes
    if req.completed_at is not None:
        task_db.completed_at = req.completed_at

    db.commit()
    db.refresh(task_db)
    return _task_to_model(task_db)


@router.post("/{task_id}/assign", response_model=Task)
def assign_task(task_id: str, req: AssignTaskRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    """Assign a task to a crew, auto-start the task and notify the crew (Phase 3)."""
    task_db = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not task_db:
        raise HTTPException(status_code=404, detail="Task not found")

    crew_db = db.query(CrewDB).filter(CrewDB.id == req.crew_id).first()
    if not crew_db:
        raise HTTPException(status_code=404, detail="Crew not found")

    task_db.crew_id = req.crew_id
    if task_db.status == "pending":
        task_db.status = "in-progress"
    if crew_db.status == "available":
        crew_db.status = "active"

    db.commit()
    db.refresh(task_db)

    # Phase 3: FCM push notification — non-blocking background task
    background_tasks.add_task(_notify_assignment, task_db.id, task_db.title, task_db.location, task_db.crew_id)

    return _task_to_model(task_db)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db), _admin=Depends(require_admin)):
    task_db = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not task_db:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task_db)
    db.commit()
    return None


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _notify_assignment(task_id: str, task_title: str, location: str | None, crew_id: str | None) -> None:
    """Fire an FCM push notification when a task is assigned. Runs as a background task. Non-fatal."""
    if not crew_id:
        return
    try:
        from database import SessionLocal
        from services.notifications import notify_task_assigned
        db = SessionLocal()
        try:
            notify_task_assigned(
                task_id=task_id,
                task_title=task_title,
                location=location,
                crew_id=crew_id,
                db=db,
            )
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"[FCM] Task assignment notification failed: {e}")
