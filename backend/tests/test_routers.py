"""
Unit tests for API routers
Tests bin management, authentication, and alerts endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime

from main import app
from database import Base, get_db
from models import CreateBinRequest, Bin

# Use in-memory SQLite for testing
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
Base.metadata.create_all(bind=engine)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


class TestBinRouter:
    """Test bin management endpoints"""

    def test_create_bin(self):
        """Test creating a new bin"""
        bin_data = {
            "id": "test_bin_1",
            "location": "Downtown Collection Point",
            "capacity_liters": 100,
            "fill_level_percent": 45,
            "latitude": 21.1458,
            "longitude": 79.0882,
        }
        
        response = client.post("/bins/", json=bin_data)
        
        assert response.status_code == 201
        data = response.json()
        assert data["id"] == "test_bin_1"
        assert data["location"] == "Downtown Collection Point"
        assert data["fill_level_percent"] == 45

    def test_create_bin_duplicate(self):
        """Test that duplicate bin creation fails"""
        bin_data = {
            "id": "test_bin_2",
            "location": "Test Location",
            "capacity_liters": 100,
            "fill_level_percent": 50,
            "latitude": 0,
            "longitude": 0,
        }
        
        # First creation should succeed
        response1 = client.post("/bins/", json=bin_data)
        assert response1.status_code == 201
        
        # Duplicate should fail
        response2 = client.post("/bins/", json=bin_data)
        assert response2.status_code == 409

    def test_list_bins(self):
        """Test retrieving all bins"""
        # Create two bins
        for i in range(2):
            client.post("/bins/", json={
                "id": f"list_test_bin_{i}",
                "location": f"Location {i}",
                "capacity_liters": 100,
                "fill_level_percent": 50 + i * 10,
                "latitude": 0,
                "longitude": 0,
            })
        
        response = client.get("/bins/")
        
        assert response.status_code == 200
        bins = response.json()
        assert len(bins) >= 2

    def test_get_bin(self):
        """Test retrieving a specific bin"""
        # Create a bin first
        bin_data = {
            "id": "get_test_bin",
            "location": "Test Location",
            "capacity_liters": 150,
            "fill_level_percent": 60,
            "latitude": 21.1458,
            "longitude": 79.0882,
        }
        client.post("/bins/", json=bin_data)
        
        # Now retrieve it
        response = client.get("/bins/get_test_bin")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "get_test_bin"
        assert data["location"] == "Test Location"

    def test_get_bin_not_found(self):
        """Test retrieving non-existent bin"""
        response = client.get("/bins/nonexistent")
        assert response.status_code == 404

    def test_update_bin(self):
        """Test updating a bin"""
        # Create a bin first
        client.post("/bins/", json={
            "id": "update_test_bin",
            "location": "Old Location",
            "capacity_liters": 100,
            "fill_level_percent": 50,
            "latitude": 0,
            "longitude": 0,
        })
        
        # Update it
        response = client.patch("/bins/update_test_bin", json={
            "location": "New Location",
            "fill_level_percent": 75,
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["location"] == "New Location"
        assert data["fill_level_percent"] == 75

    def test_delete_bin(self):
        """Test deleting a bin"""
        # Create a bin first
        client.post("/bins/", json={
            "id": "delete_test_bin",
            "location": "Test Location",
            "capacity_liters": 100,
            "fill_level_percent": 50,
            "latitude": 0,
            "longitude": 0,
        })
        
        # Delete it
        response = client.delete("/bins/delete_test_bin")
        assert response.status_code == 204
        
        # Verify it's gone
        response = client.get("/bins/delete_test_bin")
        assert response.status_code == 404


class TestTelemetryRouter:
    """Test telemetry endpoints"""

    def test_send_telemetry(self):
        """Test sending telemetry data"""
        # Create a bin first
        client.post("/bins/", json={
            "id": "telemetry_test_bin",
            "location": "Test",
            "capacity_liters": 100,
            "fill_level_percent": 40,
            "latitude": 0,
            "longitude": 0,
        })
        
        # Send telemetry
        telemetry_data = {
            "bin_id": "telemetry_test_bin",
            "fill_level_percent": 55,
            "battery_percent": 85,
            "temperature_c": 28.5,
            "humidity_percent": 65,
        }
        
        response = client.post("/telemetry/", json=telemetry_data)
        
        assert response.status_code == 202
        data = response.json()
        assert data["bin_id"] == "telemetry_test_bin"

    def test_send_telemetry_invalid_bin(self):
        """Test telemetry for non-existent bin"""
        telemetry_data = {
            "bin_id": "nonexistent_bin",
            "fill_level_percent": 55,
        }
        
        response = client.post("/telemetry/", json=telemetry_data)
        assert response.status_code == 404


class TestAlertsRouter:
    """Test AI alerts endpoints"""

    def test_create_alert(self):
        """Test creating an AI alert"""
        # Create a bin first
        client.post("/bins/", json={
            "id": "alert_test_bin",
            "location": "Test",
            "capacity_liters": 100,
            "fill_level_percent": 50,
            "latitude": 0,
            "longitude": 0,
        })
        
        # Create an alert
        alert_data = {
            "bin_id": "alert_test_bin",
            "alert_type": "spillage",
            "description": "Garbage scattered around bin",
        }
        
        response = client.post("/ai_alerts/", json=alert_data)
        
        assert response.status_code == 202
        data = response.json()
        assert data["bin_id"] == "alert_test_bin"
        assert data["alert_type"] == "spillage"

    def test_list_alerts(self):
        """Test retrieving all alerts"""
        # Create a bin and alert
        client.post("/bins/", json={
            "id": "list_alert_bin",
            "location": "Test",
            "capacity_liters": 100,
            "fill_level_percent": 50,
            "latitude": 0,
            "longitude": 0,
        })
        
        client.post("/ai_alerts/", json={
            "bin_id": "list_alert_bin",
            "alert_type": "fire",
            "description": "Fire detected",
        })
        
        response = client.get("/ai_alerts/")
        
        assert response.status_code == 200
        alerts = response.json()
        assert len(alerts) > 0


class TestStatsRouter:
    """Test statistics endpoints"""

    def test_get_dashboard_stats(self):
        """Test getting dashboard statistics"""
        response = client.get("/stats/stats")
        
        assert response.status_code == 200
        data = response.json()
        assert "total_bins" in data
        assert "bins_online" in data
        assert "bins_full" in data
        assert "active_alerts" in data

    def test_get_bin_stats(self):
        """Test getting bin statistics"""
        response = client.get("/stats/stats/bins")
        
        assert response.status_code == 200
        data = response.json()
        assert "by_status" in data
        assert "total" in data

    def test_get_alert_stats(self):
        """Test getting alert statistics"""
        response = client.get("/stats/stats/alerts")
        
        assert response.status_code == 200
        data = response.json()
        assert "by_type" in data
        assert "total" in data


class TestHealthCheck:
    """Test system health endpoints"""

    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_root_endpoint(self):
        """Test root endpoint"""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data
        assert "features" in data
        assert "endpoints" in data
