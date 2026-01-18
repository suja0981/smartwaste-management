from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

# Bin models
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

# Telemetry models
class TelemetryPayload(BaseModel):
    bin_id: str
    fill_level_percent: int = Field(ge=0, le=100)
    battery_percent: Optional[int] = Field(default=None, ge=0, le=100)
    temperature_c: Optional[float] = None
    humidity_percent: Optional[int] = Field(default=None, ge=0, le=100)
    timestamp: Optional[datetime] = None

# AI Alert models
class AIAlertPayload(BaseModel):
    bin_id: str
    alert_type: str = Field(description="Type of alert, e.g., fire, vandalism, overflow")
    description: Optional[str] = Field(default=None, description="Additional details about the alert")
    timestamp: Optional[datetime] = None

class AIAlert(BaseModel):
    id: int
    bin_id: str
    alert_type: str
    description: Optional[str] = None
    timestamp: datetime

# Crew models
class Crew(BaseModel):
    id: str
    name: str
    leader: str
    members_count: int
    status: str
    phone: Optional[str] = None
    email: Optional[str] = None
    current_location: Optional[str] = None
    created_at: datetime

class CreateCrewRequest(BaseModel):
    id: str
    name: str
    leader: str
    members_count: int = 3
    phone: Optional[str] = None
    email: Optional[str] = None

class UpdateCrewRequest(BaseModel):
    name: Optional[str] = None
    leader: Optional[str] = None
    members_count: Optional[int] = None
    status: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    current_location: Optional[str] = None

# Task Models
class Task(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    bin_id: Optional[str] = None
    location: str
    estimated_time_minutes: Optional[int] = None
    crew_id: Optional[str] = None
    alert_id: Optional[int] = None
    created_at: datetime
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class CreateTaskRequest(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    location: str
    bin_id: Optional[str] = None
    estimated_time_minutes: Optional[int] = 30
    alert_id: Optional[int] = None
    due_date: Optional[datetime] = None

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    crew_id: Optional[str] = None
    estimated_time_minutes: Optional[int] = None
    completed_at: Optional[datetime] = None

class AssignTaskRequest(BaseModel):
    crew_id: str