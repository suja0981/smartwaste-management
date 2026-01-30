"""
Script to seed test users into the database
Run this once to create admin and user accounts for testing
"""

import sys
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal, UserDB, engine, Base
from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)

def seed_users():
    """Create initial test users."""
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if users already exist
        admin = db.query(UserDB).filter(UserDB.email == "admin@example.com").first()
        user = db.query(UserDB).filter(UserDB.email == "user@example.com").first()
        
        if admin:
            print("✓ Admin user already exists")
        else:
            admin_user = UserDB(
                email="admin@example.com",
                full_name="Admin User",
                hashed_password=get_password_hash("password123"),
                role="admin",
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(admin_user)
            print("✓ Created admin user: admin@example.com / password123")
        
        if user:
            print("✓ Regular user already exists")
        else:
            regular_user = UserDB(
                email="user@example.com",
                full_name="Regular User",
                hashed_password=get_password_hash("password123"),
                role="user",
                is_active=True,
                created_at=datetime.utcnow()
            )
            db.add(regular_user)
            print("✓ Created user: user@example.com / password123")
        
        db.commit()
        print("\n✓ Database seeded successfully!")
        print("\nTest Credentials:")
        print("─" * 50)
        print("ADMIN ACCOUNT:")
        print("  Email: admin@example.com")
        print("  Password: password123")
        print("  Access: Full permissions to all features")
        print("\nUSER ACCOUNT:")
        print("  Email: user@example.com")
        print("  Password: password123")
        print("  Access: View-only permissions")
        print("─" * 50)
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding database: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()
