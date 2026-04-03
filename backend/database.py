"""
database.py

Changes from original:
- Removed the empty # AI Alerts placeholder (no CCTV in this project)
- Added DeviceTokenDB for Phase 3 Firebase Cloud Messaging push notifications
- PostgreSQL only; SQLite removed
"""

from sqlalchemy import (
    create_engine, Column, Integer, String, Float, DateTime,
    Text, ForeignKey, JSON, Boolean,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os
from dotenv import load_dotenv

load_dotenv()  # load .env before reading DATABASE_URL

# ─── Database URL ─────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set. A PostgreSQL URL is required.")

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── Users ────────────────────────────────────────────────────────────────────

class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String, nullable=True)
    role = Column(String, default="user")          # "admin" | "user" | "driver"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime)
    firebase_uid = Column(String, unique=True, nullable=True, index=True)
    auth_provider = Column(String, default="local")

    device_tokens = relationship("DeviceTokenDB", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettingsDB", back_populates="user", uselist=False, cascade="all, delete-orphan")


# ─── JWT Blacklist ────────────────────────────────────────────────────────────

class TokenBlacklistDB(Base):
    __tablename__ = "token_blacklist"
    id = Column(Integer, primary_key=True, autoincrement=True)
    token_jti = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, index=True)
    revoked_at = Column(DateTime, index=True)
    expires_at = Column(DateTime, index=True)


# ─── FCM Device Tokens (Phase 3) ─────────────────────────────────────────────

class DeviceTokenDB(Base):
    """
    Stores Firebase Cloud Messaging registration tokens for push notifications.
    Each user can have multiple devices (phone, tablet, etc.).
    """
    __tablename__ = "device_tokens"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    platform = Column(String, default="android")   # android | ios | web
    created_at = Column(DateTime)
    updated_at = Column(DateTime, nullable=True)

    user = relationship("UserDB", back_populates="device_tokens")


class UserSettingsDB(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    critical_bins = Column(Boolean, default=True)
    route_updates = Column(Boolean, default=True)
    system_alerts = Column(Boolean, default=False)
    email_digest = Column(Boolean, default=False)
    push_enabled = Column(Boolean, default=False)
    compact_mode = Column(Boolean, default=False)
    auto_refresh = Column(Boolean, default=True)
    updated_at = Column(DateTime, nullable=True)

    user = relationship("UserDB", back_populates="settings")


# ─── Bins ─────────────────────────────────────────────────────────────────────

class BinDB(Base):
    __tablename__ = "bins"
    id = Column(String, primary_key=True, index=True)
    location = Column(String)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    capacity_liters = Column(Integer)
    fill_level_percent = Column(Integer)
    status = Column(String)                              # ok | warning | full | offline | maintenance
    battery_percent = Column(Integer, nullable=True)
    temperature_c = Column(Float, nullable=True)
    humidity_percent = Column(Integer, nullable=True)
    last_telemetry = Column(DateTime, nullable=True)
    zone_id = Column(String, nullable=True, index=True)  # Phase 6


# ─── Telemetry ────────────────────────────────────────────────────────────────

class TelemetryDB(Base):
    """Persistent history of every sensor reading — used to rebuild ML models."""
    __tablename__ = "telemetry"
    id = Column(Integer, primary_key=True, autoincrement=True)
    bin_id = Column(String, ForeignKey("bins.id"), index=True)
    fill_level_percent = Column(Integer)
    battery_percent = Column(Integer, nullable=True)
    temperature_c = Column(Float, nullable=True)
    humidity_percent = Column(Integer, nullable=True)
    timestamp = Column(DateTime, index=True)

    bin = relationship("BinDB")


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
    zone_id = Column(String, nullable=True, index=True)  # Phase 6

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
    bin_id = Column(String, ForeignKey("bins.id", ondelete="SET NULL"), nullable=True)
    location = Column(String)
    estimated_time_minutes = Column(Integer, nullable=True)
    crew_id = Column(String, ForeignKey("crews.id", ondelete="CASCADE"), nullable=True)
    alert_id = Column(Integer, nullable=True)   # kept for schema compat, unused
    created_at = Column(DateTime)
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    crew = relationship("CrewDB", back_populates="tasks")


# ─── Routes ───────────────────────────────────────────────────────────────────

class RouteDB(Base):
    __tablename__ = "routes"
    id = Column(String, primary_key=True, index=True)
    crew_id = Column(String, ForeignKey("crews.id", ondelete="CASCADE"), nullable=True)
    status = Column(String, default="planned")
    algorithm_used = Column(String)
    total_distance_km = Column(Float)
    estimated_time_minutes = Column(Float)
    actual_time_minutes = Column(Float, nullable=True)
    bin_ids = Column(JSON)
    waypoints = Column(JSON)
    created_at = Column(DateTime)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    zone_id = Column(String, nullable=True, index=True)  # Phase 6

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


# ─── IoT API Keys ─────────────────────────────────────────────────────────────

class APIKeyDB(Base):
    __tablename__ = "api_keys"
    id = Column(Integer, primary_key=True, autoincrement=True)
    key_hash = Column(String, unique=True, index=True)
    label = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime)
    last_used_at = Column(DateTime, nullable=True)


# ─── DB Session Dependency ────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
