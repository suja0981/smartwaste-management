from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, EmailStr


# ─── Auth & User models ───────────────────────────────────────────────────────

class UserRole(str, Enum):
    """
    Fixed: was `class UserRole(str)` which is not an Enum — class attributes
    were plain strings with no enforcement. Now a proper StrEnum so
    role values are validated at the type level.
    """
    ADMIN = "admin"
    USER = "user"
    DRIVER = "driver"


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Password must be at least 8 characters")
    full_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int = 1800   # seconds
    user: UserResponse


class TokenRefreshRequest(BaseModel):
    refresh_token: str


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    token_type: Optional[str] = None   # "access" | "refresh"


# ─── Bin models ───────────────────────────────────────────────────────────────

class Bin(BaseModel):
    id: str = Field(description="Unique bin identifier")
    location: str = Field(description="Human-readable location or GPS coordinates")
    capacity_liters: int = Field(ge=1, description="Bin capacity in liters")
    fill_level_percent: int = Field(ge=0, le=100, description="Current fill level (0-100)")
    status: str = Field(default="ok", description="ok | warning | full | offline | maintenance")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    zone_id: Optional[str] = None


class CreateBinRequest(BaseModel):
    id: str
    location: str
    capacity_liters: int = Field(ge=1)
    fill_level_percent: int = Field(default=0, ge=0, le=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class UpdateBinRequest(BaseModel):
    location: Optional[str] = None
    capacity_liters: Optional[int] = Field(default=None, ge=1)
    fill_level_percent: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# ─── Telemetry models ─────────────────────────────────────────────────────────

class TelemetryPayload(BaseModel):
    bin_id: str
    fill_level_percent: int = Field(ge=0, le=100)
    battery_percent: Optional[int] = Field(default=None, ge=0, le=100)
    temperature_c: Optional[float] = None
    humidity_percent: Optional[int] = Field(default=None, ge=0, le=100)
    timestamp: Optional[datetime] = None


# ─── Crew models ──────────────────────────────────────────────────────────────

class Crew(BaseModel):
    id: str
    name: str
    leader: str
    members_count: int
    status: str
    phone: Optional[str] = None
    email: Optional[str] = None
    current_location: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    zone_id: Optional[str] = None
    created_at: datetime


class CreateCrewRequest(BaseModel):
    id: str
    name: str
    leader: str
    members_count: int = Field(default=3, ge=1)
    phone: Optional[str] = None
    email: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None


class UpdateCrewRequest(BaseModel):
    name: Optional[str] = None
    leader: Optional[str] = None
    members_count: Optional[int] = Field(default=None, ge=1)
    status: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    current_location: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None


# ─── Task models ──────────────────────────────────────────────────────────────

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


# ─── Route models ─────────────────────────────────────────────────────────────

class RouteWaypoint(BaseModel):
    bin_id: str
    latitude: float
    longitude: float
    fill_level: int
    order: int
    estimated_collection_time: int = 10   # minutes


class Route(BaseModel):
    id: str
    crew_id: Optional[str] = None
    status: str
    algorithm_used: str
    total_distance_km: float
    estimated_time_minutes: float
    actual_time_minutes: Optional[float] = None
    bin_ids: List[str]
    waypoints: List[Dict]
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class OptimizeRouteRequest(BaseModel):
    bin_ids: List[str] = Field(description="Bin IDs to include in the route")
    crew_id: Optional[str] = Field(default=None, description="Crew to assign the route to")
    start_latitude: Optional[float] = Field(default=None, description="Starting latitude")
    start_longitude: Optional[float] = Field(default=None, description="Starting longitude")
    algorithm: str = Field(
        default="hybrid",
        description="Algorithm: greedy | priority | hybrid | two_opt",
    )
    save_route: bool = Field(default=False, description="Persist the route to the database")


class RouteOptimizationResult(BaseModel):
    route_id: Optional[str] = None
    algorithm: str
    total_distance_km: float
    estimated_time_minutes: float
    bin_count: int
    waypoints: List[Dict]
    efficiency_score: float   # bins per km


class CompareRoutesRequest(BaseModel):
    bin_ids: List[str]
    start_latitude: Optional[float] = None
    start_longitude: Optional[float] = None


class RouteComparison(BaseModel):
    algorithms: List[RouteOptimizationResult]
    recommended: str   # algorithm name with best efficiency score


class UpdateRouteStatusRequest(BaseModel):
    status: str   # planned | active | paused | completed | cancelled
    actual_time_minutes: Optional[float] = None
    notes: Optional[str] = None
