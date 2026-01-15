from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database import get_db, BinDB
from models import Bin, CreateBinRequest, UpdateBinRequest
from utils import get_current_timestamp, format_timestamp_response, determine_bin_status

router = APIRouter()

@router.get("/", response_model=List[Bin])
def list_bins(db: Session = Depends(get_db)):
    """Get all bins with their current status."""
    bins = db.query(BinDB).all()
    return [Bin(
        id=b.id,
        location=b.location,
        capacity_liters=b.capacity_liters,
        fill_level_percent=b.fill_level_percent,
        status=b.status
    ) for b in bins]

@router.post("/", response_model=Bin, status_code=201)
def create_bin(req: CreateBinRequest, db: Session = Depends(get_db)):
    """Create a new bin."""
    existing = db.query(BinDB).filter(BinDB.id == req.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Bin already exists")
    
    status = determine_bin_status(req.fill_level_percent)
    
    bin_db = BinDB(
        id=req.id,
        location=req.location,
        capacity_liters=req.capacity_liters,
        fill_level_percent=req.fill_level_percent,
        status=status
    )
    db.add(bin_db)
    db.commit()
    db.refresh(bin_db)
    
    return Bin(
        id=bin_db.id,
        location=bin_db.location,
        capacity_liters=bin_db.capacity_liters,
        fill_level_percent=bin_db.fill_level_percent,
        status=bin_db.status
    )

@router.get("/{bin_id}", response_model=Bin)
def get_bin(bin_id: str, db: Session = Depends(get_db)):
    """Get a specific bin by ID."""
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    return Bin(
        id=bin_db.id,
        location=bin_db.location,
        capacity_liters=bin_db.capacity_liters,
        fill_level_percent=bin_db.fill_level_percent,
        status=bin_db.status
    )

@router.patch("/{bin_id}", response_model=Bin)
def update_bin(bin_id: str, req: UpdateBinRequest, db: Session = Depends(get_db)):
    """Update a bin's information."""
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    # Update fields if provided
    if req.location is not None:
        bin_db.location = req.location
    if req.capacity_liters is not None:
        bin_db.capacity_liters = req.capacity_liters
    if req.fill_level_percent is not None:
        bin_db.fill_level_percent = req.fill_level_percent
        # Auto-update status based on fill level
        bin_db.status = determine_bin_status(req.fill_level_percent)
    elif req.status is not None:
        # Only update status if fill level wasn't provided
        if req.status in {"ok", "offline", "maintenance", "full"}:
            bin_db.status = req.status
    
    db.commit()
    db.refresh(bin_db)
    
    return Bin(
        id=bin_db.id,
        location=bin_db.location,
        capacity_liters=bin_db.capacity_liters,
        fill_level_percent=bin_db.fill_level_percent,
        status=bin_db.status
    )

@router.delete("/{bin_id}", status_code=204)
def delete_bin(bin_id: str, db: Session = Depends(get_db)):
    """Delete a bin."""
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    db.delete(bin_db)
    db.commit()
    return None