"""
services/ml_predictor.py

What this ML actually does (honest description):
  - BinFillPredictor: Time-series extrapolation.
      Stores (timestamp, fill_level) pairs per bin.
      Calculates fill rate = median of consecutive fill deltas / time.
      Predicts hours-until-full = remaining_capacity / fill_rate.
      No ML model — pure statistical extrapolation, works well for IoT.

  - AnomalyDetector: Z-score based outlier detection.
      Maintains running mean + std of each sensor metric per bin.
      Flags readings where abs(z-score) > sensitivity (default 2.5).
      Statistics not ML, but very practical for sensor fault detection.

  - CollectionOptimizer: Rule-based priority scoring.
      Score = fill_level + time_bonus (bins predicted full within 24h).
      Returns a sorted collection order, no model involved.

Key fix: rebuild_from_db() re-hydrates all models from TelemetryDB on startup
so predictions survive server restarts without waiting for new IoT data.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── BinFillPredictor ─────────────────────────────────────────────────────────

class BinFillPredictor:
    """
    Predicts when bins will reach full capacity using linear extrapolation
    on recent fill-rate history.

    Storage: in-memory dict, rebuilt from DB on startup via rebuild_from_db().
    Keeps the last MAX_POINTS readings per bin to stay memory-bounded.
    """

    MAX_POINTS = 120   # ~2 hours at 1 reading/min

    def __init__(self):
        # bin_id → list of (datetime, fill_level_int)
        self.historical_data: Dict[str, list] = {}

    def add_data_point(self, bin_id: str, fill_level: int, timestamp: datetime = None):
        if timestamp is None:
            timestamp = _now()

        bucket = self.historical_data.setdefault(bin_id, [])
        bucket.append((timestamp, fill_level))

        if len(bucket) > self.MAX_POINTS:
            self.historical_data[bin_id] = bucket[-self.MAX_POINTS:]

    def calculate_fill_rate(self, bin_id: str) -> Optional[float]:
        """
        Returns the median fill rate in % per hour for this bin.
        Negative deltas (bin emptied) are excluded.
        Returns None if fewer than 2 usable data points.
        """
        data = self.historical_data.get(bin_id, [])
        if len(data) < 2:
            return None

        rates = []
        for i in range(1, len(data)):
            prev_time, prev_level = data[i - 1]
            curr_time, curr_level = data[i]

            hours = (curr_time - prev_time).total_seconds() / 3600
            if hours <= 0:
                continue

            delta = curr_level - prev_level
            if delta > 0:
                rates.append(delta / hours)

        return float(np.median(rates)) if rates else None

    def predict_full_time(self, bin_id: str, current_fill: int) -> Optional[dict]:
        fill_rate = self.calculate_fill_rate(bin_id)
        if fill_rate is None or fill_rate <= 0:
            return None

        remaining = 100 - current_fill
        hours_until_full = remaining / fill_rate
        predicted_time = _now() + timedelta(hours=hours_until_full)

        n_points = len(self.historical_data.get(bin_id, []))
        confidence = min(0.95, n_points / 50)

        return {
            "bin_id": bin_id,
            "current_fill": current_fill,
            "fill_rate_per_hour": round(fill_rate, 2),
            "hours_until_full": round(hours_until_full, 1),
            "predicted_full_time": predicted_time.isoformat(),
            "confidence": round(confidence, 2),
            "data_points_used": n_points,
        }

    def get_hourly_pattern(self, bin_id: str) -> Dict[int, float]:
        """Average fill rate per hour of day (0-23). Useful for scheduling."""
        data = self.historical_data.get(bin_id, [])
        hourly: Dict[int, list] = {h: [] for h in range(24)}

        for i in range(1, len(data)):
            prev_time, prev_level = data[i - 1]
            curr_time, curr_level = data[i]

            hours = (curr_time - prev_time).total_seconds() / 3600
            if hours > 0 and curr_level > prev_level:
                rate = (curr_level - prev_level) / hours
                hourly[curr_time.hour].append(rate)

        return {
            h: round(float(np.mean(v)), 2)
            for h, v in hourly.items()
            if v
        }


# ─── AnomalyDetector ─────────────────────────────────────────────────────────

class AnomalyDetector:
    """
    Z-score based anomaly detection for IoT sensor readings.
    Maintains rolling mean + std per metric per bin.
    """

    MIN_BASELINE_POINTS = 5

    def __init__(self, sensitivity: float = 2.5):
        self.sensitivity = sensitivity
        self.baselines: Dict[str, Dict[str, dict]] = {}

    def update_baseline(self, bin_id: str, telemetry: dict):
        entry = self.baselines.setdefault(bin_id, {
            metric: {"values": [], "mean": 0.0, "std": 0.0}
            for metric in ("fill_level", "battery", "temperature", "humidity")
        })

        mapping = {
            "fill_level": telemetry.get("fill_level_percent"),
            "battery": telemetry.get("battery_percent"),
            "temperature": telemetry.get("temperature_c"),
            "humidity": telemetry.get("humidity_percent"),
        }

        for metric, value in mapping.items():
            if value is None or value < 0:
                continue
            bucket = entry[metric]
            bucket["values"].append(value)
            if len(bucket["values"]) > 50:
                bucket["values"] = bucket["values"][-50:]
            if len(bucket["values"]) >= self.MIN_BASELINE_POINTS:
                bucket["mean"] = float(np.mean(bucket["values"]))
                bucket["std"] = float(np.std(bucket["values"]))

    def detect_anomalies(self, bin_id: str, telemetry: dict) -> list:
        baseline = self.baselines.get(bin_id)
        if not baseline:
            return []

        mapping = {
            "fill_level": telemetry.get("fill_level_percent"),
            "battery": telemetry.get("battery_percent"),
            "temperature": telemetry.get("temperature_c"),
            "humidity": telemetry.get("humidity_percent"),
        }

        anomalies = []
        for metric, value in mapping.items():
            if value is None or value < 0:
                continue
            b = baseline.get(metric, {})
            std = b.get("std", 0)
            if std == 0 or len(b.get("values", [])) < self.MIN_BASELINE_POINTS:
                continue

            z = abs(value - b["mean"]) / std
            if z > self.sensitivity:
                anomalies.append({
                    "metric": metric,
                    "current_value": value,
                    "expected_range": (
                        round(b["mean"] - self.sensitivity * std, 1),
                        round(b["mean"] + self.sensitivity * std, 1),
                    ),
                    "z_score": round(z, 2),
                    "severity": "high" if z > 3 else "medium",
                })

        return anomalies


# ─── CollectionOptimizer ─────────────────────────────────────────────────────

class CollectionOptimizer:
    """Rule-based collection scheduling. Wraps BinFillPredictor."""

    def __init__(self, predictor: BinFillPredictor):
        self.predictor = predictor

    def should_collect_now(self, bin_id: str, current_fill: int, threshold: int = 80) -> dict:
        if current_fill >= threshold:
            return {
                "should_collect": True,
                "urgency": "high",
                "reason": f"Fill level ({current_fill}%) exceeds threshold ({threshold}%)",
                "recommended_time": "now",
            }

        prediction = self.predictor.predict_full_time(bin_id, current_fill)

        if prediction is None:
            return {
                "should_collect": False,
                "urgency": "low",
                "reason": "Insufficient data for prediction",
                "recommended_time": "unknown",
            }

        h = prediction["hours_until_full"]
        if h <= 24:
            return {
                "should_collect": True,
                "urgency": "medium",
                "reason": f"Predicted full in {h:.1f} hours",
                "recommended_time": f"within {int(h)} hours",
                "prediction": prediction,
            }

        return {
            "should_collect": False,
            "urgency": "low",
            "reason": f"Bin not full for {h:.1f} hours",
            "recommended_time": f"in {int(h - 12)} hours",
            "prediction": prediction,
        }

    def optimize_collection_route(self, bins: list) -> list:
        """Return bin IDs sorted by urgency (most urgent first)."""
        scored = []
        for b in bins:
            bid = b["id"]
            fill = b.get("fill_level_percent", 0)
            score = fill
            pred = self.predictor.predict_full_time(bid, fill)
            if pred and pred["hours_until_full"] <= 24:
                score += (24 - pred["hours_until_full"]) * 2
            scored.append((bid, score))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [bid for bid, _ in scored]


# ─── MLPredictionService ─────────────────────────────────────────────────────

class MLPredictionService:
    """
    Top-level ML service. A single instance lives in the FastAPI process
    (created in predictions.py). rebuild_from_db() is called once at startup
    via the lifespan handler in main.py.

    NOTE: In-memory state is per-process. Multi-worker deployments
    (Gunicorn with N workers) each maintain their own copy. For production
    with multiple workers, move state to Redis or a time-series DB.
    """

    def __init__(self):
        self.fill_predictor = BinFillPredictor()
        self.anomaly_detector = AnomalyDetector(sensitivity=2.5)
        self.collection_optimizer = CollectionOptimizer(self.fill_predictor)

    def rebuild_from_db(self, db) -> int:
        """
        Re-hydrate in-memory models from the TelemetryDB table.
        Call once at application startup (handled by main.py lifespan).
        Returns the number of readings loaded.
        """
        from database import TelemetryDB

        logger.info("[ML] Rebuilding models from database telemetry...")

        bin_ids = [r.bin_id for r in db.query(TelemetryDB.bin_id).distinct().all()]
        total_loaded = 0

        for bid in bin_ids:
            rows = (
                db.query(TelemetryDB)
                .filter(TelemetryDB.bin_id == bid)
                .order_by(TelemetryDB.timestamp.asc())
                .limit(BinFillPredictor.MAX_POINTS)
                .all()
            )
            for r in rows:
                if r.fill_level_percent is not None:
                    self.fill_predictor.add_data_point(bid, r.fill_level_percent, r.timestamp)
                self.anomaly_detector.update_baseline(bid, {
                    "fill_level_percent": r.fill_level_percent,
                    "battery_percent": r.battery_percent,
                    "temperature_c": r.temperature_c,
                    "humidity_percent": r.humidity_percent,
                })
                total_loaded += 1

        logger.info(f"[ML] Loaded {total_loaded} readings for {len(bin_ids)} bins")
        return total_loaded

    def ingest_telemetry(self, bin_id: str, telemetry: dict):
        fill = telemetry.get("fill_level_percent")
        if fill is not None and fill >= 0:
            self.fill_predictor.add_data_point(bin_id, fill)
        self.anomaly_detector.update_baseline(bin_id, telemetry)

    def analyze_bin(self, bin_id: str, current_data: dict) -> dict:
        fill = current_data.get("fill_level_percent", 0)
        return {
            "bin_id": bin_id,
            "current_fill": fill,
            "prediction": self.fill_predictor.predict_full_time(bin_id, fill),
            "anomalies": self.anomaly_detector.detect_anomalies(bin_id, current_data),
            "collection_recommendation": self.collection_optimizer.should_collect_now(bin_id, fill),
            "usage_pattern": self.fill_predictor.get_hourly_pattern(bin_id),
            "analysis_timestamp": _now().isoformat(),
        }

    def get_statistics(self) -> dict:
        total = len(self.fill_predictor.historical_data)
        total_pts = sum(len(v) for v in self.fill_predictor.historical_data.values())
        with_pred = sum(
            1 for bid in self.fill_predictor.historical_data
            if self.fill_predictor.calculate_fill_rate(bid) is not None
        )
        return {
            "total_bins_tracked": total,
            "total_data_points": total_pts,
            "bins_with_predictions": with_pred,
            "prediction_coverage": round(with_pred / total * 100, 1) if total else 0,
        }