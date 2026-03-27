"""
SQLite to PostgreSQL Migration Script
- Exports all data from SQLite
- Creates PostgreSQL schema
- Imports data to PostgreSQL
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, inspect, MetaData, Table, select, delete
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from database import Base, UserDB, BinDB, TelemetryDB, CrewDB, TaskDB, RouteDB, RouteHistoryDB, TokenBlacklistDB
from config import get_settings

# ============================================
# EXPORT DATA FROM SQLITE
# ============================================

def export_sqlite_data(sqlite_url: str) -> dict:
    """Export all data from SQLite to dictionary."""
    print("📤 Exporting data from SQLite...")
    
    engine_sqlite = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine_sqlite)
    session = SessionLocal()
    
    # First, create tables if they don't exist
    from sqlalchemy import inspect
    inspector = inspect(engine_sqlite)
    existing_tables = inspector.get_table_names()
    
    if not existing_tables:
        print("  ⚠️  SQLite database is empty (no tables found)")
        print("  📝 Creating schema and seeding initial data...\n")
        
        # Create all tables
        Base.metadata.create_all(bind=engine_sqlite)
        
        # Try to seed users
        try:
            from seed_users import seed_users as seed_users_func
            # We need to commit the session first
            session.close()
            engine_sqlite.dispose()
            
            # Import and run seed_users
            print("  Seeding users...")
            # Reimport to get fresh connection
            from database import SessionLocal as NewSessionLocal
            new_session = NewSessionLocal()
            
            # Add demo users directly
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            
            admin_user = UserDB(
                email="admin@example.com",
                full_name="Admin User",
                hashed_password=pwd_context.hash("Admin@1234"),
                role="admin",
                is_active=True,
                created_at=datetime.utcnow(),
                auth_provider="local"
            )
            regular_user = UserDB(
                email="user@example.com",
                full_name="Demo User",
                hashed_password=pwd_context.hash("User@1234"),
                role="user",
                is_active=True,
                created_at=datetime.utcnow(),
                auth_provider="local"
            )
            new_session.add(admin_user)
            new_session.add(regular_user)
            new_session.commit()
            print("  ✓ Demo users created")
            
            # Create demo bins
            bin1 = BinDB(
                id="BIN-001",
                location="Sitabuldi Square",
                latitude=21.1497,
                longitude=79.0860,
                capacity_liters=100,
                fill_level_percent=45,
                status="ok"
            )
            bin2 = BinDB(
                id="BIN-002",
                location="Dharampeth",
                latitude=21.1346,
                longitude=79.0669,
                capacity_liters=150,
                fill_level_percent=72,
                status="warning"
            )
            bin3 = BinDB(
                id="BIN-003",
                location="Sadar Bazaar",
                latitude=21.1520,
                longitude=79.0877,
                capacity_liters=120,
                fill_level_percent=91,
                status="full"
            )
            new_session.add_all([bin1, bin2, bin3])
            new_session.commit()
            print("  ✓ Demo bins created (3)")
            
            new_session.close()
            session = SessionLocal()
            
        except Exception as e:
            print(f"  ⚠️  Could not seed users: {e}")
            session = SessionLocal()
    
    data = {}
    
    try:
        # Export each table
        for table_class in [UserDB, BinDB, TelemetryDB, CrewDB, TaskDB, RouteDB, RouteHistoryDB, TokenBlacklistDB]:
            table_name = table_class.__tablename__
            rows = session.query(table_class).all()
            
            # Convert rows to JSON-serializable format
            data[table_name] = []
            for row in rows:
                row_dict = {col.name: getattr(row, col.name) for col in inspect(table_class).columns}
                # Convert datetime objects to ISO format strings
                for key, value in row_dict.items():
                    if isinstance(value, datetime):
                        row_dict[key] = value.isoformat()
                data[table_name].append(row_dict)
            
            print(f"  ✓ {table_name}: {len(rows)} rows exported")
        
    finally:
        session.close()
        engine_sqlite.dispose()
    
    return data


def save_export_file(data: dict, export_file: str = "sqlite_export.json"):
    """Save exported data to JSON file."""
    with open(export_file, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"💾 Data saved to {export_file}\n")
    return export_file


def load_export_file(export_file: str) -> dict:
    """Load previously exported data from JSON file."""
    with open(export_file, 'r') as f:
        data = json.load(f)
    print(f"📂 Loaded data from {export_file}\n")
    return data


# ============================================
# IMPORT DATA TO POSTGRESQL
# ============================================

def create_postgresql_schema(postgres_url: str):
    """Create schema in PostgreSQL."""
    print("🏗️  Creating PostgreSQL schema...")
    
    engine = create_engine(postgres_url, poolclass=NullPool)
    Base.metadata.create_all(bind=engine)
    
    print("  ✓ Schema created\n")
    engine.dispose()


def import_data_to_postgresql(postgres_url: str, data: dict):
    """Import data to PostgreSQL."""
    print("📥 Importing data to PostgreSQL...")
    
    engine = create_engine(postgres_url, poolclass=NullPool)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    try:
        # Map table names to ORM classes
        table_map = {
            'users': UserDB,
            'bins': BinDB,
            'telemetry': TelemetryDB,
            'crews': CrewDB,
            'tasks': TaskDB,
            'routes': RouteDB,
            'route_history': RouteHistoryDB,
            'token_blacklist': TokenBlacklistDB,
        }
        
        for table_name, table_class in table_map.items():
            if table_name not in data:
                print(f"  ⚠️  No data for {table_name}")
                continue
            
            rows_to_insert = data[table_name]
            
            for row_dict in rows_to_insert:
                # Convert ISO strings back to datetime
                for key, value in row_dict.items():
                    if isinstance(value, str) and 'T' in value and key.endswith('_at'):
                        try:
                            row_dict[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                        except:
                            pass
                
                # Create ORM instance and add to session
                instance = table_class(**row_dict)
                session.add(instance)
            
            print(f"  ✓ {table_name}: {len(rows_to_insert)} rows imported")
        
        session.commit()
        print("  ✓ All data committed\n")
        
    except Exception as e:
        session.rollback()
        print(f"  ❌ Error during import: {e}\n")
        raise
    finally:
        session.close()
        engine.dispose()


def verify_migration(postgres_url: str, data: dict) -> bool:
    """Verify data was imported correctly."""
    print("✅ Verifying migration...")
    
    engine = create_engine(postgres_url, poolclass=NullPool)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    
    try:
        table_map = {
            'users': UserDB,
            'bins': BinDB,
            'telemetry': TelemetryDB,
            'crews': CrewDB,
            'tasks': TaskDB,
            'routes': RouteDB,
            'route_history': RouteHistoryDB,
            'token_blacklist': TokenBlacklistDB,
        }
        
        all_match = True
        for table_name, table_class in table_map.items():
            if table_name not in data:
                continue
            
            expected_count = len(data[table_name])
            actual_count = session.query(table_class).count()
            
            match = expected_count == actual_count
            status = "✓" if match else "❌"
            print(f"  {status} {table_name}: expected={expected_count}, actual={actual_count}")
            
            if not match:
                all_match = False
        
        print()
        return all_match
        
    finally:
        session.close()
        engine.dispose()


# ============================================
# MAIN MIGRATION ORCHESTRATION
# ============================================

def main():
    """Execute full migration."""
    settings = get_settings()
    
    # Get database URLs
    sqlite_url = "sqlite:///./smart_waste.db"
    postgres_url = os.getenv("DATABASE_URL") or "postgresql://waste_user:Sujal123@localhost:5432/smart_waste"
    
    print("\n" + "="*60)
    print("  SQLite → PostgreSQL Migration")
    print("="*60 + "\n")
    
    print(f"Source (SQLite): {sqlite_url}")
    print(f"Target (PostgreSQL): {postgres_url}\n")
    
    try:
        # Step 1: Export from SQLite
        export_file = "sqlite_export.json"
        if os.path.exists(export_file):
            print("Found existing export file. Load it? (y/n): ", end="")
            response = input().lower()
            if response == 'y':
                data = load_export_file(export_file)
            else:
                data = export_sqlite_data(sqlite_url)
                save_export_file(data, export_file)
        else:
            data = export_sqlite_data(sqlite_url)
            save_export_file(data, export_file)
        
        # Step 2: Create PostgreSQL schema
        create_postgresql_schema(postgres_url)
        
        # Step 3: Import data to PostgreSQL
        import_data_to_postgresql(postgres_url, data)
        
        # Step 4: Verify migration
        if verify_migration(postgres_url, data):
            print("="*60)
            print("  ✅ Migration Successful!")
            print("="*60)
            print("\nNext steps:")
            print("1. Update .env with: DATABASE_URL={postgres_url}")
            print("2. Test backend with: uvicorn backend.main:app --reload")
            print("3. Archive old SQLite DB: rename smart_waste.db to smart_waste.db.backup")
            print()
            return True
        else:
            print("="*60)
            print("  ❌ Migration Verification Failed!")
            print("="*60)
            print("\nPlease check the counts above and retry.\n")
            return False
    
    except Exception as e:
        print(f"\n❌ Migration failed: {e}\n")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
