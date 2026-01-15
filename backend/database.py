from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

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
    created_at = Column(DateTime)
    
    # Relationship to tasks
    tasks = relationship("TaskDB", back_populates="crew")

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
# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()