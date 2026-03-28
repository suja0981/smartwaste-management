"""
tests/test_routers.py

Fixes from original:
  1. Removed all /ai_alerts/ tests (no CCTV in this project)
  2. Fixed /stats/ paths (/stats/stats → /stats/, etc.)
  3. Telemetry POST now includes JWT auth (Phase 2 added auth requirement)
  4. Added a shared auth_headers fixture for convenience
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime

from main import app
from database import Base, get_db, UserDB
from passlib.context import CryptContext

# ─── Test database setup ──────────────────────────────────────────────────────

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def admin_token():
    """Create an admin user and return its JWT access token."""
    db = TestingSessionLocal()
    # Create admin if not exists
    if not db.query(UserDB).filter(UserDB.email == "testadmin@example.com").first():
        db.add(UserDB(
            email="testadmin@example.com",
            full_name="Test Admin",
            hashed_password=pwd_context.hash("Admin@1234"),
            role="admin",
            is_active=True,
            created_at=datetime.utcnow(),
            auth_provider="local",
        ))
        db.commit()
    db.close()

    resp = client.post("/auth/login", json={
        "email": "testadmin@example.com",
        "password": "Admin@1234",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ─── Health ───────────────────────────────────────────────────────────────────

class TestHealthCheck:
    def test_health_check(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_root_endpoint(self):
        r = client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert "name" in data
        assert "version" in data
        assert "features" in data


# ─── Auth ─────────────────────────────────────────────────────────────────────

class TestAuth:
    def test_signup(self):
        r = client.post("/auth/signup", json={
            "email": "newuser@example.com",
            "password": "NewPass@1234",
            "full_name": "New User",
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_signup_duplicate(self):
        data = {"email": "dup@example.com", "password": "Dup@12345", "full_name": "Dup"}
        client.post("/auth/signup", json=data)
        r = client.post("/auth/signup", json=data)
        assert r.status_code == 400

    def test_login_valid(self, admin_token):
        assert admin_token  # fixture already validates login

    def test_login_invalid_password(self):
        r = client.post("/auth/login", json={
            "email": "testadmin@example.com",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = client.get("/auth/me")
        assert r.status_code == 403   # no bearer header → 403 from HTTPBearer

    def test_me_with_auth(self, auth_headers):
        r = client.get("/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "testadmin@example.com"


# ─── Bins ─────────────────────────────────────────────────────────────────────

class TestBinRouter:
    def test_create_bin(self):
        r = client.post("/bins/", json={
            "id": "test_bin_1",
            "location": "Downtown Collection Point",
            "capacity_liters": 100,
            "fill_level_percent": 45,
            "latitude": 21.1458,
            "longitude": 79.0882,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["id"] == "test_bin_1"
        assert data["fill_level_percent"] == 45

    def test_create_bin_duplicate(self):
        payload = {
            "id": "dup_bin",
            "location": "Somewhere",
            "capacity_liters": 100,
            "fill_level_percent": 50,
        }
        client.post("/bins/", json=payload)
        r = client.post("/bins/", json=payload)
        assert r.status_code == 409

    def test_list_bins(self):
        r = client.get("/bins/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_bin(self):
        client.post("/bins/", json={
            "id": "get_test_bin",
            "location": "Test Location",
            "capacity_liters": 150,
            "fill_level_percent": 60,
        })
        r = client.get("/bins/get_test_bin")
        assert r.status_code == 200
        assert r.json()["id"] == "get_test_bin"

    def test_get_bin_not_found(self):
        r = client.get("/bins/nonexistent_xyz")
        assert r.status_code == 404

    def test_update_bin(self):
        client.post("/bins/", json={
            "id": "update_bin",
            "location": "Old Location",
            "capacity_liters": 100,
            "fill_level_percent": 50,
        })
        r = client.patch("/bins/update_bin", json={"location": "New Location", "fill_level_percent": 75})
        assert r.status_code == 200
        assert r.json()["location"] == "New Location"
        assert r.json()["fill_level_percent"] == 75

    def test_delete_bin(self):
        client.post("/bins/", json={
            "id": "delete_bin",
            "location": "Temp",
            "capacity_liters": 100,
            "fill_level_percent": 50,
        })
        assert client.delete("/bins/delete_bin").status_code == 204
        assert client.get("/bins/delete_bin").status_code == 404


# ─── Telemetry ────────────────────────────────────────────────────────────────

class TestTelemetryRouter:
    def test_send_telemetry_requires_auth(self):
        """Phase 2: telemetry endpoint now requires auth."""
        client.post("/bins/", json={
            "id": "tel_bin",
            "location": "Test",
            "capacity_liters": 100,
            "fill_level_percent": 40,
        })
        r = client.post("/telemetry/", json={
            "bin_id": "tel_bin",
            "fill_level_percent": 55,
        })
        # Without auth header → 401
        assert r.status_code == 401

    def test_send_telemetry_with_auth(self, auth_headers):
        client.post("/bins/", json={
            "id": "tel_bin_auth",
            "location": "Test",
            "capacity_liters": 100,
            "fill_level_percent": 40,
        })
        r = client.post("/telemetry/", json={
            "bin_id": "tel_bin_auth",
            "fill_level_percent": 55,
            "battery_percent": 85,
            "temperature_c": 28.5,
            "humidity_percent": 65,
        }, headers=auth_headers)
        assert r.status_code == 202
        assert r.json()["bin_id"] == "tel_bin_auth"

    def test_send_telemetry_invalid_bin(self, auth_headers):
        r = client.post("/telemetry/", json={
            "bin_id": "no_such_bin",
            "fill_level_percent": 55,
        }, headers=auth_headers)
        assert r.status_code == 404

    def test_get_telemetry_history(self, auth_headers):
        client.post("/bins/", json={
            "id": "hist_bin",
            "location": "Test",
            "capacity_liters": 100,
            "fill_level_percent": 40,
        })
        client.post("/telemetry/", json={"bin_id": "hist_bin", "fill_level_percent": 55},
                    headers=auth_headers)
        r = client.get("/telemetry/hist_bin")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ─── Stats ────────────────────────────────────────────────────────────────────

class TestStatsRouter:
    def test_get_dashboard_stats(self):
        r = client.get("/stats/")       # was incorrectly tested as /stats/stats
        assert r.status_code == 200
        data = r.json()
        assert "total_bins" in data
        assert "bins_online" in data
        assert "average_fill_level" in data

    def test_get_bin_stats(self):
        r = client.get("/stats/bins")   # was /stats/stats/bins
        assert r.status_code == 200
        data = r.json()
        assert "by_status" in data
        assert "total" in data

    def test_get_zone_stats(self):
        r = client.get("/stats/zones")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)