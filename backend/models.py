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