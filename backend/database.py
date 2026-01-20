from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

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
    latitude = Column(Float, nullable=True)  # NEW: for route optimization
    longitude = Column(Float, nullable=True)  # NEW: for route optimization
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

class CrewDB(Base):
    __tablename__ = "crews"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    leader = Column(String)
    members_count = Column(Integer, default=3)
    status = Column(String, default="available")  # available, active, break, offline
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    current_location = Column(String, nullable=True)
    current_latitude = Column(Float, nullable=True)  # NEW: for route optimization
    current_longitude = Column(Float, nullable=True)  # NEW: for route optimization
    created_at = Column(DateTime)
    
    # Relationship to tasks and routes
    tasks = relationship("TaskDB", back_populates="crew")
    routes = relationship("RouteDB", back_populates="crew")

class TaskDB(Base):
    __tablename__ = "tasks"
    id = Column(String, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text, nullable=True)
    priority = Column(String)  # high, medium, low
    status = Column(String)  # pending, in-progress, completed
    bin_id = Column(String, nullable=True)
    location = Column(String)
    estimated_time_minutes = Column(Integer, nullable=True)
    crew_id = Column(String, ForeignKey("crews.id"), nullable=True)
    alert_id = Column(Integer, nullable=True)
    created_at = Column(DateTime)
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationship to crew
    crew = relationship("CrewDB", back_populates="tasks")

class RouteDB(Base):
    """NEW: Stores optimized collection routes"""
    __tablename__ = "routes"
    id = Column(String, primary_key=True, index=True)
    crew_id = Column(String, ForeignKey("crews.id"), nullable=True)
    status = Column(String, default="planned")  # planned, active, completed, cancelled
    algorithm_used = Column(String)  # greedy, priority, hybrid, two_opt
    total_distance_km = Column(Float)
    estimated_time_minutes = Column(Float)
    actual_time_minutes = Column(Float, nullable=True)
    bin_ids = Column(JSON)  # List of bin IDs in order
    waypoints = Column(JSON)  # List of {bin_id, lat, lon, fill_level, order}
    created_at = Column(DateTime)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationship to crew
    crew = relationship("CrewDB", back_populates="routes")

class RouteHistoryDB(Base):
    """NEW: Stores historical route performance data for analytics"""
    __tablename__ = "route_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    route_id = Column(String, ForeignKey("routes.id"))
    crew_id = Column(String)
    bins_collected = Column(Integer)
    total_distance_km = Column(Float)
    total_time_minutes = Column(Float)
    fuel_efficiency_score = Column(Float, nullable=True)  # distance/bins ratio
    completion_date = Column(DateTime)
    notes = Column(Text, nullable=True)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()