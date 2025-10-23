from typing import List, Optional
from datetime import datetime
import os

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import os
from datetime import datetime



# SQLite setup
DATABASE_URL = "sqlite:///./smart_waste.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# SQLAlchemy models
class BinDB(Base):
    __tablename__ = "bins"
    id = Column(String, primary_key=True, index=True)
    location = Column(String)
    capacity_liters = Column(Integer)
    fill_level_percent = Column(Integer)
    status = Column(String)
    battery_percent = Column(Integer, nullable=True)
    temperature_c = Column(Float, nullable=True)
    humidity_percent = Column(Integer, nullable=True)
    last_telemetry = Column(DateTime, nullable=True)

class AIAlertDB(Base):
    __tablename__ = "ai_alerts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bin_id = Column(String)
    alert_type = Column(String)
    description = Column(Text, nullable=True)
    timestamp = Column(DateTime)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
app = FastAPI()
# CORS (development: allow all origins; tighten in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Domain models
class Bin(BaseModel):
    id: str = Field(description="Unique bin identifier")
    location: str = Field(description="Human-readable location or GPS coords")
    capacity_liters: int = Field(ge=1, description="Bin capacity in liters")
    fill_level_percent: int = Field(ge=0, le=100, description="Current fill level percentage")
    status: str = Field(default="ok", description="Operational status: ok, full, offline, maintenance")


class CreateBinRequest(BaseModel):
    id: str
    location: str
    capacity_liters: int
    fill_level_percent: int = 0


class UpdateBinRequest(BaseModel):
    location: Optional[str] = None
    capacity_liters: Optional[int] = Field(default=None, ge=1)
    fill_level_percent: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[str] = None


class TelemetryPayload(BaseModel):
    bin_id: str
    fill_level_percent: int = Field(ge=0, le=100)
    battery_percent: Optional[int] = Field(default=None, ge=0, le=100)
    temperature_c: Optional[float] = None
    humidity_percent: Optional[int] = Field(default=None, ge=0, le=100)
    timestamp: Optional[datetime] = None


# AI Alert model
class AIAlertPayload(BaseModel):
    bin_id: str
    alert_type: str = Field(description="Type of alert, e.g., fire, vandalism, overflow")
    description: Optional[str] = Field(default=None, description="Additional details about the alert")
    timestamp: Optional[datetime] = None





@app.get("/health")
def health_check():
    return {"status": "ok", "service": "smart-waste-backend"}



# Bin CRUD
@app.get("/bins", response_model=List[Bin])
def list_bins(db: Session = Depends(get_db)):
    bins = db.query(BinDB).all()
    return [Bin(
        id=b.id,
        location=b.location,
        capacity_liters=b.capacity_liters,
        fill_level_percent=b.fill_level_percent,
        status=b.status
    ) for b in bins]



@app.post("/bins", response_model=Bin, status_code=201)
def create_bin(req: CreateBinRequest, db: Session = Depends(get_db)):
    existing = db.query(BinDB).filter(BinDB.id == req.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Bin already exists")
    if req.fill_level_percent >= 90:
        status = "full"
    elif req.fill_level_percent >= 80:
        status = "warning"
    else:
        status = "ok"
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


@app.get("/bins/{bin_id}", response_model=Bin)
async def get_bin(bin_id: str):
    doc = await app.state.bins.find_one({"id": bin_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Bin not found")
    return Bin(**doc)


@app.patch("/bins/{bin_id}", response_model=Bin)
async def update_bin(bin_id: str, req: UpdateBinRequest):
    current = await app.state.bins.find_one({"id": bin_id})
    if not current:
        raise HTTPException(status_code=404, detail="Bin not found")
    update_data = {k: v for k, v in req.dict(exclude_unset=True).items()}
    new_fill = update_data.get("fill_level_percent", current.get("fill_level_percent", 0))
    new_status = update_data.get("status", current.get("status", "ok"))
    if new_fill >= 90:
        new_status = "full"
    elif new_status not in {"ok", "offline", "maintenance", "full"}:
        new_status = "ok"
    update_data["status"] = new_status
    await app.state.bins.update_one({"id": bin_id}, {"$set": update_data})
    doc = await app.state.bins.find_one({"id": bin_id}, {"_id": 0})
    return Bin(**doc)


@app.delete("/bins/{bin_id}", status_code=204)
def delete_bin(bin_id: str, db: Session = Depends(get_db)):
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    db.delete(bin_db)
    db.commit()
    return None



# Telemetry ingestion (SQLite)
@app.post("/telemetry", status_code=202)
def ingest_telemetry(payload: TelemetryPayload, db: Session = Depends(get_db)):
    bin_db = db.query(BinDB).filter(BinDB.id == payload.bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not registered")
    effective_timestamp = payload.timestamp or datetime.utcnow()
    if payload.fill_level_percent >= 90:
        status = "full"
    elif payload.fill_level_percent >= 80:
        status = "warning"
    else:
        status = "ok"
    bin_db.fill_level_percent = payload.fill_level_percent
    bin_db.status = status
    if payload.battery_percent is not None:
        bin_db.battery_percent = payload.battery_percent
    if payload.temperature_c is not None:
        bin_db.temperature_c = payload.temperature_c
    if payload.humidity_percent is not None:
        bin_db.humidity_percent = payload.humidity_percent
    bin_db.last_telemetry = effective_timestamp
    db.commit()
    return {"accepted": True, "bin_id": payload.bin_id, "timestamp": effective_timestamp.isoformat() + "Z"}



# AI Alert endpoint (SQLite)
@app.post("/ai_alert", status_code=202)
def ai_alert(payload: AIAlertPayload, db: Session = Depends(get_db)):
    bin_db = db.query(BinDB).filter(BinDB.id == payload.bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not registered")
    effective_timestamp = payload.timestamp or datetime.utcnow()
    alert_db = AIAlertDB(
        bin_id=payload.bin_id,
        alert_type=payload.alert_type,
        description=payload.description,
        timestamp=effective_timestamp
    )
    db.add(alert_db)
    db.commit()
    db.refresh(alert_db)
    return {"accepted": True, "bin_id": payload.bin_id, "alert_type": payload.alert_type, "timestamp": effective_timestamp.isoformat() + "Z"}
# GET /alerts endpoint
@app.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    alerts = db.query(AIAlertDB).order_by(AIAlertDB.timestamp.desc()).all()
    return [
        {
            "id": a.id,
            "bin_id": a.bin_id,
            "alert_type": a.alert_type,
            "description": a.description,
            "timestamp": a.timestamp
        } for a in alerts
    ]


# Convenience root
@app.get("/")
def root():
    return {
        "name": "Smart Waste Management API",
        "version": app.version,
        "endpoints": ["/health", "/bins", "/telemetry"],
    }


