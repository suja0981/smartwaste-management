"""
tests/test_routers.py

Fixes from original:
  1. Removed all /ai_alerts/ tests (no CCTV in this project)
  2. Fixed /stats/ paths (/stats/stats → /stats/, etc.)
  3. Telemetry POST now includes JWT auth (Phase 2 added auth requirement)
  4. Added a shared auth_headers fixture for convenience

New coverage added:
  5. TestCrewRouter      — CRUD + zone assignment + crew tasks
  6. TestTaskRouter      — CRUD + assign endpoint + 403 enforcement
  7. TestRouteRouter     — optimize, compare, status update, analytics
  8. TestDriverRouter    — tasks, location update, task complete
  9. TestAdminOnly       — verify non-admin users receive 403 on protected endpoints
  10. TestZoneFiltering  — query param filtering on bins, crews, tasks
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

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
    if not db.query(UserDB).filter(UserDB.email == "testadmin@example.com").first():
        db.add(UserDB(
            email="testadmin@example.com",
            full_name="Test Admin",
            hashed_password=pwd_context.hash("Admin@1234"),
            role="admin",
            is_active=True,
            created_at=datetime.now(timezone.utc),
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


@pytest.fixture(scope="session")
def user_token():
    """Create a regular (non-admin) user and return its access token."""
    db = TestingSessionLocal()
    if not db.query(UserDB).filter(UserDB.email == "testuser@example.com").first():
        db.add(UserDB(
            email="testuser@example.com",
            full_name="Test User",
            hashed_password=pwd_context.hash("User@12345"),
            role="user",
            is_active=True,
            created_at=datetime.now(timezone.utc),
            auth_provider="local",
        ))
        db.commit()
    db.close()

    resp = client.post("/auth/login", json={
        "email": "testuser@example.com",
        "password": "User@12345",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}


# ─── Shared setup helpers ─────────────────────────────────────────────────────

def _make_bin(bin_id: str, fill: int = 50, zone: str = None):
    payload = {
        "id": bin_id,
        "location": f"Location for {bin_id}",
        "capacity_liters": 100,
        "fill_level_percent": fill,
        "latitude": 21.1458,
        "longitude": 79.0882,
    }
    r = client.post("/bins/", json=payload)
    assert r.status_code in (201, 409)
    return r


def _make_crew(crew_id: str, email: str = None):
    payload = {
        "id": crew_id,
        "name": f"Team {crew_id}",
        "leader": "Test Leader",
        "members_count": 3,
        "phone": "+91-9876543210",
        "email": email or f"{crew_id}@waste.test",
        "current_latitude": 21.1458,
        "current_longitude": 79.0882,
    }
    r = client.post("/crews/", json=payload)
    assert r.status_code in (201, 409)
    return r


def _make_task(task_id: str, bin_id: str = None, priority: str = "medium"):
    payload = {
        "id": task_id,
        "title": f"Task {task_id}",
        "description": "Test task",
        "priority": priority,
        "location": "Test Location",
        "bin_id": bin_id,
        "estimated_time_minutes": 30,
    }
    r = client.post("/tasks/", json=payload)
    assert r.status_code in (201, 409)
    return r


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

    def test_signup_weak_password(self):
        r = client.post("/auth/signup", json={
            "email": "weakpass@example.com",
            "password": "password",   # no uppercase, digit, or special char
            "full_name": "Weak Pass",
        })
        assert r.status_code == 422

    def test_login_valid(self, admin_token):
        assert admin_token

    def test_login_invalid_password(self):
        r = client.post("/auth/login", json={
            "email": "testadmin@example.com",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = client.get("/auth/me")
        assert r.status_code == 403

    def test_me_with_auth(self, auth_headers):
        r = client.get("/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "testadmin@example.com"

    def test_logout_and_token_revoked(self, admin_token):
        """After logout, the same token must be rejected."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        # Use a fresh login so we don't revoke the session-scoped admin_token
        resp = client.post("/auth/login", json={
            "email": "testadmin@example.com",
            "password": "Admin@1234",
        })
        fresh_token = resp.json()["access_token"]
        fresh_headers = {"Authorization": f"Bearer {fresh_token}"}

        r = client.post("/auth/logout", headers=fresh_headers)
        assert r.status_code == 200

        r = client.get("/auth/me", headers=fresh_headers)
        assert r.status_code == 401


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

    def test_list_bins_filter_by_status(self):
        _make_bin("filter_bin_full", fill=95)
        r = client.get("/bins/?status=full")
        assert r.status_code == 200
        # All returned bins should have status=full
        for b in r.json():
            assert b["status"] == "full"

    def test_list_bins_filter_by_min_fill(self):
        _make_bin("min_fill_bin", fill=85)
        r = client.get("/bins/?min_fill=80")
        assert r.status_code == 200
        for b in r.json():
            assert b["fill_level_percent"] >= 80

    def test_get_bin(self):
        _make_bin("get_test_bin", fill=60)
        r = client.get("/bins/get_test_bin")
        assert r.status_code == 200
        assert r.json()["id"] == "get_test_bin"

    def test_get_bin_not_found(self):
        r = client.get("/bins/nonexistent_xyz")
        assert r.status_code == 404

    def test_update_bin(self):
        _make_bin("update_bin", fill=50)
        r = client.patch("/bins/update_bin", json={
            "location": "New Location",
            "fill_level_percent": 75,
        })
        assert r.status_code == 200
        assert r.json()["location"] == "New Location"
        assert r.json()["fill_level_percent"] == 75

    def test_update_bin_status_auto_from_fill(self):
        """Fill >= 90 should auto-set status to 'full'."""
        _make_bin("status_auto_bin", fill=30)
        r = client.patch("/bins/status_auto_bin", json={"fill_level_percent": 92})
        assert r.status_code == 200
        assert r.json()["status"] == "full"

    def test_delete_bin(self):
        _make_bin("delete_bin", fill=50)
        assert client.delete("/bins/delete_bin").status_code == 204
        assert client.get("/bins/delete_bin").status_code == 404

    def test_zone_assignment_requires_admin(self, user_headers):
        _make_bin("zone_bin_auth_test", fill=40)
        r = client.patch("/bins/zone_bin_auth_test/zone?zone_id=north", headers=user_headers)
        assert r.status_code == 403

    def test_zone_assignment_admin(self, auth_headers):
        _make_bin("zone_bin_admin", fill=40)
        r = client.patch("/bins/zone_bin_admin/zone?zone_id=north", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["zone_id"] == "north"

    def test_zone_filter_returns_matching_bins(self, auth_headers):
        _make_bin("zone_filter_bin", fill=40)
        client.patch("/bins/zone_filter_bin/zone?zone_id=east", headers=auth_headers)
        r = client.get("/bins/?zone_id=east")
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()]
        assert "zone_filter_bin" in ids


# ─── Telemetry ────────────────────────────────────────────────────────────────

class TestTelemetryRouter:
    def test_send_telemetry_requires_auth(self):
        _make_bin("tel_bin", fill=40)
        r = client.post("/telemetry/", json={
            "bin_id": "tel_bin",
            "fill_level_percent": 55,
        })
        assert r.status_code == 401

    def test_send_telemetry_with_auth(self, auth_headers):
        _make_bin("tel_bin_auth", fill=40)
        r = client.post("/telemetry/", json={
            "bin_id": "tel_bin_auth",
            "fill_level_percent": 55,
            "battery_percent": 85,
            "temperature_c": 28.5,
            "humidity_percent": 65,
        }, headers=auth_headers)
        assert r.status_code == 202
        assert r.json()["bin_id"] == "tel_bin_auth"

    def test_send_telemetry_updates_bin_status(self, auth_headers):
        """Telemetry above 90% should set bin status to full."""
        _make_bin("tel_status_bin", fill=30)
        r = client.post("/telemetry/", json={
            "bin_id": "tel_status_bin",
            "fill_level_percent": 93,
        }, headers=auth_headers)
        assert r.status_code == 202
        assert r.json()["status"] == "full"

    def test_send_telemetry_invalid_bin(self, auth_headers):
        r = client.post("/telemetry/", json={
            "bin_id": "no_such_bin",
            "fill_level_percent": 55,
        }, headers=auth_headers)
        assert r.status_code == 404

    def test_get_telemetry_history(self, auth_headers):
        _make_bin("hist_bin", fill=40)
        client.post("/telemetry/", json={
            "bin_id": "hist_bin",
            "fill_level_percent": 55,
        }, headers=auth_headers)
        r = client.get("/telemetry/hist_bin")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1

    def test_telemetry_history_bin_not_found(self):
        r = client.get("/telemetry/ghost_bin")
        assert r.status_code == 404


# ─── Stats ────────────────────────────────────────────────────────────────────

class TestStatsRouter:
    def test_get_dashboard_stats(self):
        r = client.get("/stats/")
        assert r.status_code == 200
        data = r.json()
        assert "total_bins" in data
        assert "bins_online" in data
        assert "average_fill_level" in data

    def test_get_bin_stats(self):
        r = client.get("/stats/bins")
        assert r.status_code == 200
        data = r.json()
        assert "by_status" in data
        assert "total" in data
        assert "fill_distribution" in data

    def test_get_zone_stats(self):
        r = client.get("/stats/zones")
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_telemetry_recent_stats(self):
        r = client.get("/stats/telemetry/recent")
        assert r.status_code == 200
        data = r.json()
        assert "readings_last_24h" in data
        assert "bins_reporting_last_24h" in data


# ─── Crews ────────────────────────────────────────────────────────────────────

class TestCrewRouter:
    def test_create_crew(self):
        r = client.post("/crews/", json={
            "id": "crew_test_1",
            "name": "Alpha Team",
            "leader": "Rajesh Kumar",
            "members_count": 3,
            "phone": "+91-9876543210",
            "email": "alpha@waste.test",
            "current_latitude": 21.1458,
            "current_longitude": 79.0882,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["id"] == "crew_test_1"
        assert data["status"] == "available"

    def test_create_crew_duplicate(self):
        _make_crew("dup_crew")
        r = client.post("/crews/", json={
            "id": "dup_crew",
            "name": "Duplicate",
            "leader": "Someone",
            "members_count": 2,
        })
        assert r.status_code == 409

    def test_list_crews(self):
        r = client.get("/crews/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_crews_filter_by_status(self):
        r = client.get("/crews/?status=available")
        assert r.status_code == 200
        for c in r.json():
            assert c["status"] == "available"

    def test_get_crew(self):
        _make_crew("get_crew_1")
        r = client.get("/crews/get_crew_1")
        assert r.status_code == 200
        assert r.json()["id"] == "get_crew_1"

    def test_get_crew_not_found(self):
        r = client.get("/crews/ghost_crew")
        assert r.status_code == 404

    def test_update_crew(self):
        _make_crew("update_crew_1")
        r = client.patch("/crews/update_crew_1", json={
            "status": "active",
            "members_count": 5,
        })
        assert r.status_code == 200
        assert r.json()["status"] == "active"
        assert r.json()["members_count"] == 5

    def test_delete_crew(self):
        _make_crew("delete_crew_1")
        assert client.delete("/crews/delete_crew_1").status_code == 204
        assert client.get("/crews/delete_crew_1").status_code == 404

    def test_get_crew_tasks(self):
        _make_crew("crew_with_tasks")
        r = client.get("/crews/crew_with_tasks/tasks")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_zone_assignment_requires_admin(self, user_headers):
        _make_crew("crew_zone_user")
        r = client.patch("/crews/crew_zone_user/zone?zone_id=north", headers=user_headers)
        assert r.status_code == 403

    def test_zone_assignment_admin(self, auth_headers):
        _make_crew("crew_zone_admin")
        r = client.patch("/crews/crew_zone_admin/zone?zone_id=south", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["zone_id"] == "south"

    def test_zone_filter(self, auth_headers):
        _make_crew("crew_zone_filter")
        client.patch("/crews/crew_zone_filter/zone?zone_id=west", headers=auth_headers)
        r = client.get("/crews/?zone_id=west")
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert "crew_zone_filter" in ids


# ─── Tasks ────────────────────────────────────────────────────────────────────

class TestTaskRouter:
    def test_create_task(self):
        r = client.post("/tasks/", json={
            "id": "task_test_1",
            "title": "Collect bin at Sitabuldi",
            "priority": "high",
            "location": "Sitabuldi Square",
            "estimated_time_minutes": 30,
        })
        assert r.status_code == 201
        data = r.json()
        assert data["id"] == "task_test_1"
        assert data["status"] == "pending"

    def test_create_task_with_valid_bin(self):
        _make_bin("task_bin_ref", fill=70)
        r = client.post("/tasks/", json={
            "id": "task_with_bin",
            "title": "Task with bin reference",
            "priority": "medium",
            "location": "Test",
            "bin_id": "task_bin_ref",
        })
        assert r.status_code == 201
        assert r.json()["bin_id"] == "task_bin_ref"

    def test_create_task_with_invalid_bin(self):
        r = client.post("/tasks/", json={
            "id": "task_bad_bin",
            "title": "Task with missing bin",
            "priority": "low",
            "location": "Nowhere",
            "bin_id": "does_not_exist",
        })
        assert r.status_code == 404

    def test_create_task_duplicate(self):
        _make_task("dup_task")
        r = client.post("/tasks/", json={
            "id": "dup_task",
            "title": "Duplicate",
            "priority": "low",
            "location": "Somewhere",
        })
        assert r.status_code == 409

    def test_list_tasks(self):
        r = client.get("/tasks/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_tasks_filter_by_priority(self):
        _make_task("high_prio_task", priority="high")
        r = client.get("/tasks/?priority=high")
        assert r.status_code == 200
        for t in r.json():
            assert t["priority"] == "high"

    def test_list_tasks_filter_by_status(self):
        r = client.get("/tasks/?status=pending")
        assert r.status_code == 200
        for t in r.json():
            assert t["status"] == "pending"

    def test_get_task(self):
        _make_task("get_task_1")
        r = client.get("/tasks/get_task_1")
        assert r.status_code == 200
        assert r.json()["id"] == "get_task_1"

    def test_get_task_not_found(self):
        r = client.get("/tasks/ghost_task")
        assert r.status_code == 404

    def test_update_task(self):
        _make_task("update_task_1")
        r = client.patch("/tasks/update_task_1", json={
            "title": "Updated title",
            "priority": "high",
        })
        assert r.status_code == 200
        assert r.json()["title"] == "Updated title"
        assert r.json()["priority"] == "high"

    def test_update_task_to_completed_sets_timestamp(self):
        _make_task("complete_task_1")
        r = client.patch("/tasks/complete_task_1", json={"status": "completed"})
        assert r.status_code == 200
        assert r.json()["status"] == "completed"
        assert r.json()["completed_at"] is not None

    def test_assign_task(self):
        _make_crew("assign_crew_1")
        _make_task("assign_task_1")
        r = client.post("/tasks/assign_task_1/assign", json={"crew_id": "assign_crew_1"})
        assert r.status_code == 200
        data = r.json()
        assert data["crew_id"] == "assign_crew_1"
        assert data["status"] == "in-progress"

    def test_assign_task_crew_not_found(self):
        _make_task("assign_task_bad_crew")
        r = client.post("/tasks/assign_task_bad_crew/assign", json={"crew_id": "ghost_crew"})
        assert r.status_code == 404

    def test_delete_task(self):
        _make_task("delete_task_1")
        assert client.delete("/tasks/delete_task_1").status_code == 204
        assert client.get("/tasks/delete_task_1").status_code == 404

    def test_zone_filter_on_tasks(self, auth_headers):
        """Tasks linked to a zoned bin should appear in zone filter results."""
        _make_bin("zone_task_bin", fill=60)
        client.patch("/bins/zone_task_bin/zone?zone_id=north_zone", headers=auth_headers)
        _make_task("zone_task_1", bin_id="zone_task_bin")
        r = client.get("/tasks/?zone_id=north_zone")
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        assert "zone_task_1" in ids


# ─── Routes ───────────────────────────────────────────────────────────────────

class TestRouteRouter:

    @pytest.fixture(scope="class", autouse=True)
    def setup_bins_and_crew(self):
        """Create bins and a crew needed for route tests."""
        for i in range(1, 6):
            _make_bin(f"route_bin_{i}", fill=50 + i * 5)
        _make_crew("route_crew_1", email="routecrew@waste.test")

    def test_optimize_route(self):
        r = client.post("/routes/optimize", json={
            "bin_ids": ["route_bin_1", "route_bin_2", "route_bin_3"],
            "algorithm": "hybrid",
            "save_route": False,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["bin_count"] == 3
        assert data["total_distance_km"] >= 0
        assert data["algorithm"] == "hybrid_optimized"

    def test_optimize_route_saves_to_db(self):
        r = client.post("/routes/optimize", json={
            "bin_ids": ["route_bin_1", "route_bin_2"],
            "crew_id": "route_crew_1",
            "algorithm": "greedy",
            "save_route": True,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["route_id"] is not None

    def test_optimize_route_missing_bins(self):
        r = client.post("/routes/optimize", json={
            "bin_ids": ["does_not_exist_1", "does_not_exist_2"],
            "algorithm": "hybrid",
        })
        assert r.status_code == 404

    def test_compare_algorithms(self):
        r = client.post("/routes/compare", json={
            "bin_ids": ["route_bin_1", "route_bin_2", "route_bin_3"],
            "start_latitude": 21.1458,
            "start_longitude": 79.0882,
        })
        assert r.status_code == 200
        data = r.json()
        assert "algorithms" in data
        assert "recommended" in data
        assert len(data["algorithms"]) == 4   # greedy, priority, hybrid, two_opt

    def test_list_routes(self):
        r = client.get("/routes/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_route_analytics(self):
        r = client.get("/routes/analytics/performance")
        assert r.status_code == 200
        data = r.json()
        assert "total_routes_completed" in data
        assert "total_distance_km" in data

    def test_route_status_lifecycle(self):
        """Create a route, activate it, then complete it."""
        create = client.post("/routes/optimize", json={
            "bin_ids": ["route_bin_4", "route_bin_5"],
            "algorithm": "priority",
            "save_route": True,
        })
        assert create.status_code == 200
        route_id = create.json()["route_id"]
        assert route_id is not None

        # Activate
        r = client.patch(f"/routes/{route_id}/status", json={"status": "active"})
        assert r.status_code == 200
        assert r.json()["status"] == "active"
        assert r.json()["started_at"] is not None

        # Complete
        r = client.patch(f"/routes/{route_id}/status", json={
            "status": "completed",
            "actual_time_minutes": 45.0,
            "notes": "All bins collected.",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "completed"
        assert r.json()["completed_at"] is not None

    def test_get_route_not_found(self):
        r = client.get("/routes/ghost_route_xyz")
        assert r.status_code == 404

    def test_delete_route(self):
        create = client.post("/routes/optimize", json={
            "bin_ids": ["route_bin_1"],
            "algorithm": "greedy",
            "save_route": True,
        })
        route_id = create.json()["route_id"]
        assert client.delete(f"/routes/{route_id}").status_code == 204
        assert client.get(f"/routes/{route_id}").status_code == 404


# ─── Driver endpoints ─────────────────────────────────────────────────────────

class TestDriverRouter:
    """
    Driver endpoints use get_current_user (JWT auth).
    They look up crews by matching crew.email == user.email.
    We create a user whose email matches an existing crew's email.
    """

    @pytest.fixture(scope="class")
    def driver_token(self):
        """Create a user whose email matches a crew, simulating a crew leader."""
        crew_email = "driver_crew@waste.test"
        db = TestingSessionLocal()

        # Create matching crew
        from database import CrewDB
        if not db.query(CrewDB).filter(CrewDB.id == "driver_crew").first():
            db.add(CrewDB(
                id="driver_crew",
                name="Driver Crew",
                leader="Test Driver",
                members_count=2,
                status="available",
                email=crew_email,
                current_latitude=21.1458,
                current_longitude=79.0882,
                created_at=datetime.now(timezone.utc),
            ))
            db.commit()

        # Create matching user
        if not db.query(UserDB).filter(UserDB.email == crew_email).first():
            db.add(UserDB(
                email=crew_email,
                full_name="Driver User",
                hashed_password=pwd_context.hash("Driver@1234"),
                role="user",
                is_active=True,
                created_at=datetime.now(timezone.utc),
                auth_provider="local",
            ))
            db.commit()
        db.close()

        resp = client.post("/auth/login", json={
            "email": crew_email,
            "password": "Driver@1234",
        })
        assert resp.status_code == 200
        return resp.json()["access_token"]

    @pytest.fixture(scope="class")
    def driver_headers(self, driver_token):
        return {"Authorization": f"Bearer {driver_token}"}

    def test_get_my_tasks_requires_auth(self):
        r = client.get("/driver/tasks")
        assert r.status_code in (401, 403)

    def test_get_my_tasks(self, driver_headers):
        r = client.get("/driver/tasks", headers=driver_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_current_route_no_active_route(self, driver_headers):
        r = client.get("/driver/route/current", headers=driver_headers)
        assert r.status_code == 200
        # No active route → returns null
        assert r.json() is None

    def test_update_location(self, driver_headers):
        r = client.post("/driver/location", json={
            "latitude": 21.1500,
            "longitude": 79.0900,
            "location_name": "Sitabuldi",
        }, headers=driver_headers)
        assert r.status_code == 200
        assert r.json()["updated"] is True

    def test_complete_task_not_owned_by_crew(self, driver_headers):
        """A driver cannot complete a task belonging to a different crew."""
        _make_crew("other_crew_x", email="othercrew@waste.test")
        _make_task("other_task_x")
        # Assign to other_crew_x so it's not driver_crew's task
        client.post("/tasks/other_task_x/assign", json={"crew_id": "other_crew_x"})
        r = client.post("/driver/tasks/other_task_x/complete", headers=driver_headers)
        assert r.status_code == 403


# ─── Admin-only enforcement ───────────────────────────────────────────────────

class TestAdminOnly:
    """
    Verifies that endpoints protected by require_admin correctly return 403
    when called by a regular user, not just when called without auth.
    """

    def test_bin_zone_assignment_non_admin(self, user_headers):
        _make_bin("admin_only_bin", fill=50)
        r = client.patch("/bins/admin_only_bin/zone?zone_id=test", headers=user_headers)
        assert r.status_code == 403

    def test_crew_zone_assignment_non_admin(self, user_headers):
        _make_crew("admin_only_crew")
        r = client.patch("/crews/admin_only_crew/zone?zone_id=test", headers=user_headers)
        assert r.status_code == 403

    def test_reports_export_non_admin(self, user_headers):
        r = client.get("/reports/export?format=xlsx", headers=user_headers)
        assert r.status_code == 403

    def test_reports_export_no_auth(self):
        r = client.get("/reports/export?format=xlsx")
        assert r.status_code in (401, 403)

    def test_reports_summary_public(self):
        """Summary endpoint has no admin requirement — should be accessible."""
        r = client.get("/reports/summary")
        assert r.status_code == 200
        assert "kpis" in r.json()

    def test_api_key_create_non_admin(self, user_headers):
        r = client.post("/auth/api-keys", json={"label": "test"}, headers=user_headers)
        assert r.status_code == 403

    def test_api_key_list_non_admin(self, user_headers):
        r = client.get("/auth/api-keys", headers=user_headers)
        assert r.status_code == 403

    def test_api_key_list_admin(self, auth_headers):
        r = client.get("/auth/api-keys", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)