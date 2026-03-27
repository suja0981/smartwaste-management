"""
Seed demo users into the database.

FIX: Old demo password "password123" fails the PasswordPolicy that's now
     enforced at signup (requires a special character).
     Demo passwords updated to "Admin@1234" and "User@1234".
"""

import sys
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal, UserDB, engine, Base
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def seed_users():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        admin_email = "admin@example.com"
        user_email = "user@example.com"
        admin_password = "Admin@1234"
        user_password = "User@1234"

        admin = db.query(UserDB).filter(UserDB.email == admin_email).first()
        if admin:
            print("✓ Admin user already exists")
        else:
            db.add(UserDB(
                email=admin_email,
                full_name="Admin User",
                hashed_password=get_password_hash(admin_password),
                role="admin",
                is_active=True,
                created_at=datetime.utcnow(),
                auth_provider="local",
            ))
            print(f"✓ Created admin: {admin_email} / {admin_password}")

        user = db.query(UserDB).filter(UserDB.email == user_email).first()
        if user:
            print("✓ Regular user already exists")
        else:
            db.add(UserDB(
                email=user_email,
                full_name="Regular User",
                hashed_password=get_password_hash(user_password),
                role="user",
                is_active=True,
                created_at=datetime.utcnow(),
                auth_provider="local",
            ))
            print(f"✓ Created user:  {user_email} / {user_password}")

        db.commit()
        print("\n✅ Database seeded successfully!")
        print("\n" + "─" * 50)
        print("ADMIN:  admin@example.com  /  Admin@1234  (full access)")
        print("USER:   user@example.com   /  User@1234   (read-only)")
        print("─" * 50)

    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding database: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed_users()