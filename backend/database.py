from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os

# ─── Database URL ────────────────────────────────────────────────────────────
# Read from environment so config.py's DATABASE_URL is respected.
# Falls back to SQLite for local dev if not set.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smart_waste.db")

# SQLite-specific args; PostgreSQL doesn't need check_same_thread
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    # PostgreSQL (or other databases)
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,              # Connection pool size
        max_overflow=20,           # Max overflow connections
        pool_pre_ping=True,        # Test connections before using
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── User Authentication ──────────────────────────────────────────────────────

class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String, nullable=True)   # nullable for OAuth users
    role = Column(String, default="user")              # "admin" or "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime)
    # Firebase / OAuth fields
    firebase_uid = Column(String, unique=True, nullable=True, index=True)
    auth_provider = Column(String, default="local")    # "local" | "google" | "firebase"


# ─── JWT Blacklist (Token Revocation) ─────────────────────────────────────────

class TokenBlacklistDB(Base):
    """Tracks revoked JWTs (e.g., on logout)"""
    __tablename__ = "token_blacklist"
    id = Column(Integer, primary_key=True, autoincrement=True)
    token_jti = Column(String, unique=True, index=True, nullable=False)  # JWT ID claim
    email = Column(String, index=True)  # For debugging / user account tracking
    revoked_at = Column(DateTime, index=True)  # When the token was revoked
    expires_at = Column(DateTime, index=True)  # Auto-cleanup old entries


# ─── Bins ─────────────────────────────────────────────────────────────────────

class BinDB(Base):
    __tablename__ = "bins"
    id = Column(String, primary_key=True, index=True)
    location = Column(String)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    capacity_liters = Column(Integer)
    fill_level_percent = Column(Integer)
    status = Column(String)
    battery_percent = Column(Integer, nullable=True)
    temperature_c = Column(Float, nullable=True)
    humidity_percent = Column(Integer, nullable=True)
    last_telemetry = Column(DateTime, nullable=True)
    zone_id = Column(String, nullable=True, index=True)   # future multi-zone support


# ─── Telemetry (NEW — persistent history per bin) ────────────────────────────

class TelemetryDB(Base):
    """Stores every telemetry reading so we have a queryable history."""
    __tablename__ = "telemetry"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bin_id = Column(String, ForeignKey("bins.id"), index=True)
    fill_level_percent = Column(Integer)
    battery_percent = Column(Integer, nullable=True)
    temperature_c = Column(Float, nullable=True)
    humidity_percent = Column(Integer, nullable=True)
    timestamp = Column(DateTime, index=True)

    bin = relationship("BinDB")


# ─── AI Alerts ────────────────────────────────────────────────────────────────


# ─── Crews ────────────────────────────────────────────────────────────────────

class CrewDB(Base):
    __tablename__ = "crews"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    leader = Column(String)
    members_count = Column(Integer, default=3)
    status = Column(String, default="available")   # available | active | break | offline
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    current_location = Column(String, nullable=True)
    current_latitude = Column(Float, nullable=True)
    current_longitude = Column(Float, nullable=True)
    created_at = Column(DateTime)
    zone_id = Column(String, nullable=True, index=True)

    tasks = relationship("TaskDB", back_populates="crew")
    routes = relationship("RouteDB", back_populates="crew")


# ─── Tasks ────────────────────────────────────────────────────────────────────

class TaskDB(Base):
    __tablename__ = "tasks"
    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text, nullable=True)
    priority = Column(String)
    status = Column(String)
    bin_id = Column(String, nullable=True)
    location = Column(String)
    estimated_time_minutes = Column(Integer, nullable=True)
    crew_id = Column(String, ForeignKey("crews.id"), nullable=True)
    alert_id = Column(Integer, nullable=True)
    created_at = Column(DateTime)
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    crew = relationship("CrewDB", back_populates="tasks")


# ─── Routes ───────────────────────────────────────────────────────────────────

class RouteDB(Base):
    __tablename__ = "routes"
    id = Column(String, primary_key=True, index=True)
    crew_id = Column(String, ForeignKey("crews.id"), nullable=True)
    status = Column(String, default="planned")   # planned | active | completed | cancelled
    algorithm_used = Column(String)
    total_distance_km = Column(Float)
    estimated_time_minutes = Column(Float)
    actual_time_minutes = Column(Float, nullable=True)
    # Store as native JSON — SQLAlchemy handles (de)serialisation automatically.
    # Do NOT json.dumps() before assigning these fields.
    bin_ids = Column(JSON)
    waypoints = Column(JSON)
    created_at = Column(DateTime)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    crew = relationship("CrewDB", back_populates="routes")


class RouteHistoryDB(Base):
    __tablename__ = "route_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    route_id = Column(String, ForeignKey("routes.id"))
    crew_id = Column(String)
    bins_collected = Column(Integer)
    total_distance_km = Column(Float)
    total_time_minutes = Column(Float)
    fuel_efficiency_score = Column(Float, nullable=True)
    completion_date = Column(DateTime)
    notes = Column(Text, nullable=True)


#IoT API Keys (for device auth)

class APIKeyDB(Base):
    """Lightweight API-key auth for IoT devices (no Firebase needed on hardware)."""
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key_hash = Column(String, unique=True, index=True)   # store SHA-256 hash, never plain
    label = Column(String)                                # e.g. "Bin Sensor - Site A"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime)
    last_used_at = Column(DateTime, nullable=True)


# DB Session Dependency

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()