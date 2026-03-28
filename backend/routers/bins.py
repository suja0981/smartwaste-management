"""
routers/bins.py

Phase 6: Added optional `zone_id` query param to list_bins and zone assignment endpoint.
         Kept all original endpoints unchanged for backward compatibility.
"""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from database import get_db, BinDB
from models import Bin, CreateBinRequest, UpdateBinRequest
from utils import get_current_timestamp, determine_bin_status
from auth_utils import require_admin

router = APIRouter()


@router.get("/", response_model=List[Bin])
def list_bins(
    zone_id: Optional[str] = Query(default=None, description="Filter by zone (Phase 6)"),
    status: Optional[str] = Query(default=None, description="Filter by status: ok|warning|full|offline"),
    min_fill: Optional[int] = Query(default=None, ge=0, le=100, description="Minimum fill level %"),
    db: Session = Depends(get_db),
):
    """Get all bins, optionally filtered by zone, status, or minimum fill level."""
    query = db.query(BinDB)
    if zone_id:
        query = query.filter(BinDB.zone_id == zone_id)
    if status:
        query = query.filter(BinDB.status == status)
    if min_fill is not None:
        query = query.filter(BinDB.fill_level_percent >= min_fill)

    return [
        Bin(
            id=b.id,
            location=b.location,
            capacity_liters=b.capacity_liters,
            fill_level_percent=b.fill_level_percent,
            status=b.status,
            latitude=b.latitude,
            longitude=b.longitude,
        )
        for b in query.order_by(BinDB.fill_level_percent.desc()).all()
    ]


@router.post("/", response_model=Bin, status_code=201)
def create_bin(req: CreateBinRequest, db: Session = Depends(get_db)):
    """Create a new bin."""
    if db.query(BinDB).filter(BinDB.id == req.id).first():
        raise HTTPException(status_code=409, detail="Bin already exists")

    bin_db = BinDB(
        id=req.id,
        location=req.location,
        capacity_liters=req.capacity_liters,
        fill_level_percent=req.fill_level_percent,
        status=determine_bin_status(req.fill_level_percent),
        latitude=req.latitude,
        longitude=req.longitude,
    )
    db.add(bin_db)
    db.commit()
    db.refresh(bin_db)

    return Bin(
        id=bin_db.id,
        location=bin_db.location,
        capacity_liters=bin_db.capacity_liters,
        fill_level_percent=bin_db.fill_level_percent,
        status=bin_db.status,
        latitude=bin_db.latitude,
        longitude=bin_db.longitude,
    )


@router.get("/{bin_id}", response_model=Bin)
def get_bin(bin_id: str, db: Session = Depends(get_db)):
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    return Bin(
        id=bin_db.id,
        location=bin_db.location,
        capacity_liters=bin_db.capacity_liters,
        fill_level_percent=bin_db.fill_level_percent,
        status=bin_db.status,
        latitude=bin_db.latitude,
        longitude=bin_db.longitude,
    )


@router.patch("/{bin_id}", response_model=Bin)
def update_bin(bin_id: str, req: UpdateBinRequest, db: Session = Depends(get_db)):
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")

    if req.location is not None:
        bin_db.location = req.location
    if req.capacity_liters is not None:
        bin_db.capacity_liters = req.capacity_liters
    if req.fill_level_percent is not None:
        bin_db.fill_level_percent = req.fill_level_percent
        bin_db.status = determine_bin_status(req.fill_level_percent)
    elif req.status is not None:
        if req.status in {"ok", "offline", "maintenance", "full", "warning"}:
            bin_db.status = req.status
    if req.latitude is not None:
        bin_db.latitude = req.latitude
    if req.longitude is not None:
        bin_db.longitude = req.longitude

    db.commit()
    db.refresh(bin_db)

    return Bin(
        id=bin_db.id,
        location=bin_db.location,
        capacity_liters=bin_db.capacity_liters,
        fill_level_percent=bin_db.fill_level_percent,
        status=bin_db.status,
        latitude=bin_db.latitude,
        longitude=bin_db.longitude,
    )


@router.patch("/{bin_id}/zone")
def assign_zone(
    bin_id: str,
    zone_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Assign (or unassign) a bin to a zone.  Admin only.
    PATCH /bins/{bin_id}/zone?zone_id=north
    PATCH /bins/{bin_id}/zone          → clears zone (sets to null)
    Phase 6.
    """
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")

    bin_db.zone_id = zone_id
    db.commit()
    return {"bin_id": bin_id, "zone_id": zone_id, "updated": True}


@router.delete("/{bin_id}", status_code=204)
def delete_bin(bin_id: str, db: Session = Depends(get_db)):
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    db.delete(bin_db)
    db.commit()
    return None