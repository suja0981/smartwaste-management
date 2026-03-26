"""
Unit tests for ML prediction service
Tests fill prediction, anomaly detection, and collection optimization
"""

import pytest
from datetime import datetime, timedelta
from services.ml_predictor import (
    BinFillPredictor,
    AnomalyDetector,
    CollectionOptimizer,
    MLPredictionService,
)


class TestBinFillPredictor:
    """Test fill level prediction functionality"""

    def test_add_data_point(self):
        """Test adding historical data points"""
        predictor = BinFillPredictor()
        predictor.add_data_point("bin1", 10)
        
        assert "bin1" in predictor.historical_data
        assert len(predictor.historical_data["bin1"]) == 1
        assert predictor.historical_data["bin1"][0][1] == 10

    def test_calculate_fill_rate_with_multiple_points(self):
        """Test fill rate calculation"""
        predictor = BinFillPredictor()
        now = datetime.utcnow()
        
        # Add data points 1 hour apart
        predictor.historical_data["bin1"] = [
            (now - timedelta(hours=2), 20),
            (now - timedelta(hours=1), 40),
            (now, 60),
        ]
        
        rate = predictor.calculate_fill_rate("bin1")
        
        # Expected rate: 20% per hour
        assert rate is not None
        assert 19 <= rate <= 21  # Allow small variance

    def test_calculate_fill_rate_insufficient_data(self):
        """Test that insufficient data returns None"""
        predictor = BinFillPredictor()
        predictor.add_data_point("bin1", 10)
        
        rate = predictor.calculate_fill_rate("bin1")
        
        assert rate is None

    def test_predict_full_time(self):
        """Test full capacity prediction"""
        predictor = BinFillPredictor()
        now = datetime.utcnow()
        
        predictor.historical_data["bin1"] = [
            (now - timedelta(hours=2), 20),
            (now - timedelta(hours=1), 40),
            (now, 60),
        ]
        
        prediction = predictor.predict_full_time("bin1", 60)
        
        assert prediction is not None
        assert prediction["bin_id"] == "bin1"
        assert prediction["current_fill"] == 60
        assert prediction["hours_until_full"] > 0
        assert prediction["hours_until_full"] < 10  # Should be around 2 hours

    def test_predict_full_time_insufficient_data(self):
        """Test that insufficient data returns None"""
        predictor = BinFillPredictor()
        prediction = predictor.predict_full_time("bin1", 50)
        
        assert prediction is None

    def test_get_hourly_pattern(self):
        """Test hourly usage pattern analysis"""
        predictor = BinFillPredictor()
        now = datetime.utcnow()
        
        # Simulate data across different hours
        for hour in range(24):
            time = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            predictor.historical_data["bin1"] = [
                (time - timedelta(hours=1), 10),
                (time, 15 + hour % 10),  # Variable fill based on hour
            ]
        
        pattern = predictor.get_hourly_pattern("bin1")
        
        assert isinstance(pattern, dict)
        # Pattern should contain entries for hours with data
        assert len(pattern) > 0

    def test_max_data_points_limit(self):
        """Test that historical data is limited to 100 points"""
        predictor = BinFillPredictor()
        
        # Add more than 100 points
        for i in range(150):
            predictor.add_data_point("bin1", i % 100)
        
        # Should only keep last 100
        assert len(predictor.historical_data["bin1"]) == 100


class TestAnomalyDetector:
    """Test anomaly detection functionality"""

    def test_update_baseline(self):
        """Test baseline statistics update"""
        detector = AnomalyDetector()
        telemetry = {
            "fill_level_percent": 50,
            "battery_percent": 80,
            "temperature_c": 25.0,
            "humidity_percent": 60,
        }
        
        detector.update_baseline("bin1", telemetry)
        
        assert "bin1" in detector.baselines
        assert 50 in detector.baselines["bin1"]["fill_level"]["values"]

    def test_detect_anomalies_normal_data(self):
        """Test that normal data doesn't trigger anomalies"""
        detector = AnomalyDetector(sensitivity=2.0)
        
        # Build baseline
        for i in range(10):
            telemetry = {
                "fill_level_percent": 50 + i,
                "battery_percent": 80 + i,
                "temperature_c": 25.0 + i * 0.1,
                "humidity_percent": 60 + i,
            }
            detector.update_baseline("bin1", telemetry)
        
        # Check for anomalies in similar data
        telemetry = {
            "fill_level_percent": 55,
            "battery_percent": 85,
            "temperature_c": 25.5,
            "humidity_percent": 65,
        }
        
        anomalies = detector.detect_anomalies("bin1", telemetry)
        
        # Should detect no or very few anomalies
        assert len(anomalies) <= 1

    def test_detect_anomalies_extreme_values(self):
        """Test anomaly detection for extreme values"""
        detector = AnomalyDetector(sensitivity=1.5)
        
        # Build baseline around 50
        for i in range(20):
            telemetry = {
                "fill_level_percent": 48 + i % 4,
                "battery_percent": 78 + i % 4,
                "temperature_c": 24.8 + i % 4 * 0.1,
                "humidity_percent": 58 + i % 4,
            }
            detector.update_baseline("bin1", telemetry)
        
        # Extreme outlier
        telemetry = {
            "fill_level_percent": 99,  # Extremely high
            "battery_percent": 50,     # Extremely low
            "temperature_c": 50.0,     # Very high
            "humidity_percent": 10,    # Very low
        }
        
        anomalies = detector.detect_anomalies("bin1", telemetry)
        
        # Should detect at least some anomalies
        assert len(anomalies) > 0

    def test_insufficient_baseline_data(self):
        """Test with insufficient baseline data"""
        detector = AnomalyDetector()
        
        # Only 1 data point
        telemetry = {"fill_level_percent": 50, "battery_percent": 80}
        detector.update_baseline("bin1", telemetry)
        
        # Try to detect anomalies (need at least 5 points)
        anomalies = detector.detect_anomalies("bin1", telemetry)
        
        # Should return empty since we don't have enough baseline data
        assert len(anomalies) == 0


class TestCollectionOptimizer:
    """Test collection scheduling optimization"""

    def test_should_collect_over_threshold(self):
        """Test collection recommendation when over threshold"""
        optimizer = CollectionOptimizer()
        
        result = optimizer.should_collect_now("bin1", 85, threshold=80)
        
        assert result["should_collect"] is True
        assert result["urgency"] == "high"

    def test_should_collect_under_threshold(self):
        """Test collection recommendation when under threshold"""
        optimizer = CollectionOptimizer()
        
        # Add some history for prediction
        optimizer.predictor.historical_data["bin1"] = [
            (datetime.utcnow() - timedelta(hours=1), 30),
            (datetime.utcnow(), 50),
        ]
        
        result = optimizer.should_collect_now("bin1", 50, threshold=80)
        
        assert result["should_collect"] is False
        assert result["urgency"] == "low"

    def test_should_collect_insufficient_data(self):
        """Test recommendation with insufficient data"""
        optimizer = CollectionOptimizer()
        
        result = optimizer.should_collect_now("bin_new", 60, threshold=80)
        
        assert result["should_collect"] is False
        assert result["urgency"] == "low"

    def test_optimize_collection_route(self):
        """Test collection route optimization"""
        optimizer = CollectionOptimizer()
        
        # Setup predictor history
        for i in range(5):
            bin_id = f"bin{i+1}"
            optimizer.predictor.historical_data[bin_id] = [
                (datetime.utcnow() - timedelta(hours=1), 20 + i * 10),
                (datetime.utcnow(), 30 + i * 10),
            ]
        
        bins = [
            {"id": "bin1", "fill_level_percent": 30},
            {"id": "bin2", "fill_level_percent": 40},
            {"id": "bin3", "fill_level_percent": 50},
            {"id": "bin4", "fill_level_percent": 45},
            {"id": "bin5", "fill_level_percent": 55},
        ]
        
        route = optimizer.optimize_collection_route(bins)
        
        assert len(route) == 5
        assert all(bin_id in route for bin_id in ["bin1", "bin2", "bin3", "bin4", "bin5"])
        # Higher fill levels should come first
        assert route.index("bin5") < route.index("bin1")


class TestMLPredictionService:
    """Test overall ML prediction service"""

    def test_ingest_telemetry(self):
        """Test telemetry ingestion"""
        service = MLPredictionService()
        
        telemetry = {
            "fill_level_percent": 50,
            "battery_percent": 80,
            "temperature_c": 25.0,
            "humidity_percent": 60,
        }
        
        service.ingest_telemetry("bin1", telemetry)
        
        # Check that data was added to fill predictor
        assert "bin1" in service.fill_predictor.historical_data
        # Check that baseline was updated
        assert "bin1" in service.anomaly_detector.baselines

    def test_analyze_bin(self):
        """Test comprehensive bin analysis"""
        service = MLPredictionService()
        
        # Ingest some data first
        for i in range(5):
            telemetry = {
                "fill_level_percent": 30 + i * 10,
                "battery_percent": 85,
                "temperature_c": 25.0,
                "humidity_percent": 60,
            }
            service.ingest_telemetry("bin1", telemetry)
        
        current_data = {
            "fill_level_percent": 70,
            "battery_percent": 85,
            "temperature_c": 25.0,
            "humidity_percent": 60,
        }
        
        analysis = service.analyze_bin("bin1", current_data)
        
        assert analysis["bin_id"] == "bin1"
        assert analysis["current_fill"] == 70
        assert "prediction" in analysis
        assert "anomalies" in analysis
        assert "collection_recommendation" in analysis
        assert "analysis_timestamp" in analysis

    def test_get_statistics(self):
        """Test ML service statistics"""
        service = MLPredictionService()
        
        # Add some data
        for i in range(3):
            bin_id = f"bin{i+1}"
            for j in range(5):
                telemetry = {
                    "fill_level_percent": 20 + j * 10,
                    "battery_percent": 80,
                    "temperature_c": 25.0,
                    "humidity_percent": 60,
                }
                service.ingest_telemetry(bin_id, telemetry)
        
        stats = service.get_statistics()
        
        assert stats["total_bins_tracked"] == 3
        assert stats["total_data_points"] == 15
        assert "prediction_coverage" in stats
