"""
Alembic migration: add device_tokens table (Phase 3 FCM)
and add zone_id to routes table (Phase 6)

To apply:
  cd backend
  pip install alembic
  alembic init migrations            # first time only
  # Edit migrations/env.py to import your Base and DATABASE_URL
  alembic revision --autogenerate -m "phase3_device_tokens_phase6_route_zone"
  alembic upgrade head

Or run this script directly for a quick one-shot migration:
  python add_device_tokens_migration.py
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text, inspect

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smart_waste.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


def column_exists(conn, table: str, column: str) -> bool:
    inspector = inspect(conn)
    return any(c["name"] == column for c in inspector.get_columns(table))


def table_exists(conn, table: str) -> bool:
    inspector = inspect(conn)
    return table in inspector.get_table_names()


def run_migration():
    with engine.begin() as conn:

        # ── device_tokens table ──────────────────────────────────────────────
        if not table_exists(conn, "device_tokens"):
            print("Creating device_tokens table…")
            conn.execute(text("""
                CREATE TABLE device_tokens (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    token       VARCHAR UNIQUE NOT NULL,
                    platform    VARCHAR DEFAULT 'android',
                    created_at  DATETIME,
                    updated_at  DATETIME
                )
            """))
            # Index for fast lookup by user_id
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_device_tokens_user_id ON device_tokens(user_id)"
            ))
            print("  ✓ device_tokens created")
        else:
            print("  ✓ device_tokens already exists")

        # ── zone_id on routes ────────────────────────────────────────────────
        if not column_exists(conn, "routes", "zone_id"):
            print("Adding zone_id to routes…")
            conn.execute(text("ALTER TABLE routes ADD COLUMN zone_id VARCHAR"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_routes_zone_id ON routes(zone_id)"
            ))
            print("  ✓ routes.zone_id added")
        else:
            print("  ✓ routes.zone_id already exists")

        print("\n✅ Migration complete")


if __name__ == "__main__":
    run_migration()