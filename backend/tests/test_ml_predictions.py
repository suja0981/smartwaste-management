"""
tests/test_ml_predictions.py

Unit tests for the ML prediction service.
Tests fill prediction, anomaly detection, and collection optimization.

FIX: CollectionOptimizer requires a BinFillPredictor argument.
     All test instantiations previously used CollectionOptimizer() with no
     args, which raises TypeError. Fixed throughout.
"""

import pytest
from datetime import datetime, timedelta, timezone
from services.ml_predictor import (
    BinFillPredictor,
    AnomalyDetector,
    CollectionOptimizer,
    MLPredictionService,
)


def _now():
    return datetime.now(timezone.utc)


# ─── BinFillPredictor ─────────────────────────────────────────────────────────

class TestBinFillPredictor:

    def test_add_data_point(self):
        predictor = BinFillPredictor()
        predictor.add_data_point("bin1", 10)

        assert "bin1" in predictor.historical_data
        assert len(predictor.historical_data["bin1"]) == 1
        assert predictor.historical_data["bin1"][0][1] == 10

    def test_calculate_fill_rate_with_multiple_points(self):
        predictor = BinFillPredictor()
        now = _now()

        predictor.historical_data["bin1"] = [
            (now - timedelta(hours=2), 20),
            (now - timedelta(hours=1), 40),
            (now, 60),
        ]

        rate = predictor.calculate_fill_rate("bin1")

        assert rate is not None
        assert 19 <= rate <= 21   # expect ~20% per hour

    def test_calculate_fill_rate_insufficient_data(self):
        predictor = BinFillPredictor()
        predictor.add_data_point("bin1", 10)

        rate = predictor.calculate_fill_rate("bin1")

        assert rate is None

    def test_predict_full_time(self):
        predictor = BinFillPredictor()
        now = _now()

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
        assert prediction["hours_until_full"] < 10   # ~2 hours at 20%/hr

    def test_predict_full_time_insufficient_data(self):
        predictor = BinFillPredictor()
        prediction = predictor.predict_full_time("bin1", 50)

        assert prediction is None

    def test_get_hourly_pattern(self):
        predictor = BinFillPredictor()
        now = _now()

        for hour in range(24):
            time_point = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            predictor.historical_data["bin1"] = [
                (time_point - timedelta(hours=1), 10),
                (time_point, 15 + hour % 10),
            ]

        pattern = predictor.get_hourly_pattern("bin1")

        assert isinstance(pattern, dict)
        assert len(pattern) > 0

    def test_max_data_points_limit(self):
        predictor = BinFillPredictor()

        for i in range(150):
            predictor.add_data_point("bin1", i % 100)

        assert len(predictor.historical_data["bin1"]) == BinFillPredictor.MAX_POINTS


# ─── AnomalyDetector ─────────────────────────────────────────────────────────

class TestAnomalyDetector:

    def test_update_baseline(self):
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
        detector = AnomalyDetector(sensitivity=2.0)

        for i in range(10):
            detector.update_baseline("bin1", {
                "fill_level_percent": 50 + i,
                "battery_percent": 80 + i,
                "temperature_c": 25.0 + i * 0.1,
                "humidity_percent": 60 + i,
            })

        anomalies = detector.detect_anomalies("bin1", {
            "fill_level_percent": 55,
            "battery_percent": 85,
            "temperature_c": 25.5,
            "humidity_percent": 65,
        })

        assert len(anomalies) <= 1

    def test_detect_anomalies_extreme_values(self):
        detector = AnomalyDetector(sensitivity=1.5)

        for i in range(20):
            detector.update_baseline("bin1", {
                "fill_level_percent": 48 + i % 4,
                "battery_percent": 78 + i % 4,
                "temperature_c": 24.8 + i % 4 * 0.1,
                "humidity_percent": 58 + i % 4,
            })

        anomalies = detector.detect_anomalies("bin1", {
            "fill_level_percent": 99,
            "battery_percent": 5,
            "temperature_c": 60.0,
            "humidity_percent": 5,
        })

        assert len(anomalies) > 0

    def test_insufficient_baseline_data(self):
        detector = AnomalyDetector()
        telemetry = {"fill_level_percent": 50, "battery_percent": 80}
        detector.update_baseline("bin1", telemetry)

        anomalies = detector.detect_anomalies("bin1", telemetry)

        # Need at least MIN_BASELINE_POINTS before detecting
        assert len(anomalies) == 0


# ─── CollectionOptimizer ─────────────────────────────────────────────────────

class TestCollectionOptimizer:
    """
    FIX: CollectionOptimizer.__init__ requires a BinFillPredictor argument.
    All tests now create the predictor first and pass it in.
    """

    def _make_optimizer(self) -> CollectionOptimizer:
        return CollectionOptimizer(BinFillPredictor())

    def test_should_collect_over_threshold(self):
        optimizer = self._make_optimizer()

        result = optimizer.should_collect_now("bin1", 85, threshold=80)

        assert result["should_collect"] is True
        assert result["urgency"] == "high"

    def test_should_collect_under_threshold(self):
        optimizer = self._make_optimizer()
        now = _now()
        optimizer.predictor.historical_data["bin1"] = [
            (now - timedelta(hours=1), 30),
            (now, 50),
        ]

        result = optimizer.should_collect_now("bin1", 50, threshold=80)

        assert result["should_collect"] is False
        assert result["urgency"] == "low"

    def test_should_collect_insufficient_data(self):
        optimizer = self._make_optimizer()

        result = optimizer.should_collect_now("bin_new", 60, threshold=80)

        assert result["should_collect"] is False
        assert result["urgency"] == "low"

    def test_optimize_collection_route(self):
        optimizer = self._make_optimizer()
        now = _now()

        for i in range(5):
            bin_id = f"bin{i + 1}"
            optimizer.predictor.historical_data[bin_id] = [
                (now - timedelta(hours=1), 20 + i * 10),
                (now, 30 + i * 10),
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
        assert all(b in route for b in ["bin1", "bin2", "bin3", "bin4", "bin5"])
        # Higher fill levels should be collected first
        assert route.index("bin5") < route.index("bin1")


# ─── MLPredictionService ─────────────────────────────────────────────────────

class TestMLPredictionService:

    def test_ingest_telemetry(self):
        service = MLPredictionService()
        telemetry = {
            "fill_level_percent": 50,
            "battery_percent": 80,
            "temperature_c": 25.0,
            "humidity_percent": 60,
        }

        service.ingest_telemetry("bin1", telemetry)

        assert "bin1" in service.fill_predictor.historical_data
        assert "bin1" in service.anomaly_detector.baselines

    def test_analyze_bin(self):
        service = MLPredictionService()

        for i in range(5):
            service.ingest_telemetry("bin1", {
                "fill_level_percent": 30 + i * 10,
                "battery_percent": 85,
                "temperature_c": 25.0,
                "humidity_percent": 60,
            })

        analysis = service.analyze_bin("bin1", {
            "fill_level_percent": 70,
            "battery_percent": 85,
            "temperature_c": 25.0,
            "humidity_percent": 60,
        })

        assert analysis["bin_id"] == "bin1"
        assert analysis["current_fill"] == 70
        assert "prediction" in analysis
        assert "anomalies" in analysis
        assert "collection_recommendation" in analysis
        assert "analysis_timestamp" in analysis

    def test_get_statistics(self):
        service = MLPredictionService()

        for i in range(3):
            bin_id = f"bin{i + 1}"
            for j in range(5):
                service.ingest_telemetry(bin_id, {
                    "fill_level_percent": 20 + j * 10,
                    "battery_percent": 80,
                    "temperature_c": 25.0,
                    "humidity_percent": 60,
                })

        stats = service.get_statistics()

        assert stats["total_bins_tracked"] == 3
        assert stats["total_data_points"] == 15
        assert "prediction_coverage" in stats