from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr

# ============================================
# Authentication & Authorization Models
# ============================================

class UserRole(str):
    ADMIN = "admin"
    USER = "user"

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
    role: str  # "admin" or "user"
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
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

# Bin models
class Bin(BaseModel):
    id: str = Field(description="Unique bin identifier")
    location: str = Field(description="Human-readable location or GPS coords")
    capacity_liters: int = Field(ge=1, description="Bin capacity in liters")
    fill_level_percent: int = Field(ge=0, le=100, description="Current fill level percentage")
    status: str = Field(default="ok", description="Operational status: ok, full, offline, maintenance")
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class CreateBinRequest(BaseModel):
    id: str
    location: str
    capacity_liters: int
    fill_level_percent: int = 0
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class UpdateBinRequest(BaseModel):
    location: Optional[str] = None
    capacity_liters: Optional[int] = Field(default=None, ge=1)
    fill_level_percent: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

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
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    created_at: datetime

class CreateCrewRequest(BaseModel):
    id: str
    name: str
    leader: str
    members_count: int = 3
    phone: Optional[str] = None
    email: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None

class UpdateCrewRequest(BaseModel):
    name: Optional[str] = None
    leader: Optional[str] = None
    members_count: Optional[int] = None
    status: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    current_location: Optional[str] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None

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

# Route Models (NEW)
class RouteWaypoint(BaseModel):
    """Represents a single waypoint in a route"""
    bin_id: str
    latitude: float
    longitude: float
    fill_level: int
    order: int
    estimated_collection_time: int = 10  # minutes

class Route(BaseModel):
    """Complete route information"""
    id: str
    crew_id: Optional[str] = None
    status: str
    algorithm_used: str
    total_distance_km: float
    estimated_time_minutes: float
    actual_time_minutes: Optional[float] = None
    bin_ids: List[str]
    waypoints: List[Dict]  # List of waypoint dictionaries
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class OptimizeRouteRequest(BaseModel):
    """Request to optimize a route"""
    bin_ids: List[str] = Field(description="List of bin IDs to include in route")
    crew_id: Optional[str] = Field(default=None, description="Crew ID for route assignment")
    start_latitude: Optional[float] = Field(default=None, description="Starting latitude (crew location)")
    start_longitude: Optional[float] = Field(default=None, description="Starting longitude (crew location)")
    algorithm: str = Field(default="hybrid", description="Algorithm: greedy, priority, hybrid, two_opt")
    save_route: bool = Field(default=False, description="Whether to save the route to database")

class RouteOptimizationResult(BaseModel):
    """Result of route optimization"""
    route_id: Optional[str] = None
    algorithm: str
    total_distance_km: float
    estimated_time_minutes: float
    bin_count: int
    waypoints: List[Dict]
    efficiency_score: float  # bins per km

class CompareRoutesRequest(BaseModel):
    """Request to compare multiple routing algorithms"""
    bin_ids: List[str]
    start_latitude: Optional[float] = None
    start_longitude: Optional[float] = None

class RouteComparison(BaseModel):
    """Comparison of multiple algorithms"""
    algorithms: List[RouteOptimizationResult]
    recommended: str  # Which algorithm is recommended

class UpdateRouteStatusRequest(BaseModel):
    """Update route status"""
    status: str  # planned, active, completed, cancelled
    actual_time_minutes: Optional[float] = None
    notes: Optional[str] = None