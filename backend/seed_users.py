"""
seed_users.py — Seed demo users into the database.

FIX: Old demo password "password123" fails the PasswordPolicy that's now
     enforced at signup (requires a special character).
     Demo passwords updated to "Admin@1234" and "User@1234".

Run once before starting the server:
  python seed_users.py
"""

import sys
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from database import SessionLocal, UserDB, engine, Base
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def seed_users():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        now = datetime.now(timezone.utc)

        admin_email = "admin@example.com"
        admin_password = "Admin@1234"
        admin = db.query(UserDB).filter(UserDB.email == admin_email).first()
        if admin:
            print("  admin user already exists")
        else:
            db.add(UserDB(
                email=admin_email,
                full_name="Admin User",
                hashed_password=get_password_hash(admin_password),
                role="admin",
                is_active=True,
                created_at=now,
                auth_provider="local",
            ))
            print(f"  created admin: {admin_email} / {admin_password}")

        user_email = "user@example.com"
        user_password = "User@1234"
        user = db.query(UserDB).filter(UserDB.email == user_email).first()
        if user:
            print("  regular user already exists")
        else:
            db.add(UserDB(
                email=user_email,
                full_name="Regular User",
                hashed_password=get_password_hash(user_password),
                role="user",
                is_active=True,
                created_at=now,
                auth_provider="local",
            ))
            print(f"  created user:  {user_email} / {user_password}")

        db.commit()
        print("\nDatabase seeded successfully.")
        print("-" * 50)
        print(f"ADMIN:  {admin_email}  /  {admin_password}  (full access)")
        print(f"USER:   {user_email}   /  {user_password}   (read-only)")
        print("-" * 50)

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_users()