import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple, List

import numpy as np

logger = logging.getLogger(__name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── BinFillPredictor ─────────────────────────────────────────────────────────

class BinFillPredictor:
    """
    Predicts when bins will reach full capacity using stabilized rate estimation
    with outlier detection and confidence scoring.

    Storage: in-memory dict, rebuilt from DB on startup via rebuild_from_db().
    Keeps the last MAX_POINTS readings per bin to stay memory-bounded.
    
    IMPROVEMENTS:
    - Outlier detection & removal (IQR method)
    - Minimum data requirements (20+ points for stable prediction)
    - Rate smoothing using weighted moving average
    - Improved confidence based on data consistency
    - Edge case validation (timestamps, rates, fill transitions)
    - Realistic upper bounds on predictions
    """

    MAX_POINTS = 480   # ~8 hours at 1 reading/min for better stability
    MIN_POINTS_FOR_PREDICTION = 20
    MAX_HOURS_PREDICTION = 72  # Unrealistic to predict beyond 3 days

    def __init__(self):
        # bin_id → list of (datetime, fill_level_int)
        self.historical_data: Dict[str, list] = {}
        self.data_quality: Dict[str, dict] = {}

    def add_data_point(self, bin_id: str, fill_level: int, timestamp: datetime = None):
        """Safely add a data point with validation."""
        if timestamp is None:
            timestamp = _now()
        else:
            # Ensure timestamp is timezone-aware (UTC)
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)

        # Validate input
        if not isinstance(fill_level, (int, float)) or fill_level < 0 or fill_level > 100:
            logger.warning(f"Invalid fill_level {fill_level} for bin {bin_id}, skipping")
            return

        bucket = self.historical_data.setdefault(bin_id, [])
        
        # Validate timestamp is monotonic (within tolerance for concurrent readings)
        if bucket and timestamp < bucket[-1][0] - timedelta(minutes=1):
            logger.warning(f"Out-of-order timestamp for bin {bin_id}, skipping")
            return

        bucket.append((timestamp, int(fill_level)))

        # Keep most recent points, trim if needed
        if len(bucket) > self.MAX_POINTS:
            self.historical_data[bin_id] = bucket[-self.MAX_POINTS:]

    def _get_rates(self, bin_id: str) -> List[float]:
        """Calculate raw fill rates (% per hour), only for filling periods."""
        data = self.historical_data.get(bin_id, [])
        if len(data) < 2:
            return []

        rates = []
        for i in range(1, len(data)):
            prev_time, prev_level = data[i - 1]
            curr_time, curr_level = data[i]

            time_delta = (curr_time - prev_time).total_seconds()
            if time_delta <= 0:  # Skip concurrent/reversed timestamps
                continue

            hours = time_delta / 3600
            delta = curr_level - prev_level

            # Only count filling periods (delta > 0), ignore emptying/resets
            if delta > 0:
                rate = delta / hours
                # Sanity check: rate should be reasonable (<100% per minute)
                if 0 < rate < 6000:  # 6000% per hour = 100% per minute max
                    rates.append(rate)

        return rates

    def _remove_outliers(self, rates: List[float]) -> List[float]:
        """Remove outliers using Interquartile Range (IQR) method."""
        if len(rates) < 4:
            return rates

        q1 = np.percentile(rates, 25)
        q3 = np.percentile(rates, 75)
        iqr = q3 - q1

        # Define bounds: typically 1.5 * IQR
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr

        return [r for r in rates if lower <= r <= upper]

    def calculate_fill_rate(self, bin_id: str) -> Optional[float]:
        """
        Returns smoothed, stabilized fill rate in % per hour.
        Uses median of outlier-cleaned rates.
        Returns None if insufficient data or no filling observed.
        """
        rates = self._get_rates(bin_id)
        if len(rates) < 2:
            return None

        # Remove outliers for stability
        clean_rates = self._remove_outliers(rates)
        if not clean_rates:
            return None

        # Use median for robustness against remaining noise
        median_rate = float(np.median(clean_rates))

        # Apply gentle smoothing: if we have historical rate, blend current estimate
        # This prevents wild swings between measurements
        bucket_key = bin_id
        if bucket_key not in self.data_quality:
            self.data_quality[bucket_key] = {"last_rate": median_rate}
        else:
            last_rate = self.data_quality[bucket_key].get("last_rate", median_rate)
            # Exponential smoothing: 70% history + 30% new
            median_rate = 0.7 * last_rate + 0.3 * median_rate

        self.data_quality[bucket_key]["last_rate"] = median_rate
        return median_rate if median_rate > 0 else None

    def _calculate_confidence(self, bin_id: str, hours_until_full: float) -> float:
        """
        Multi-factor confidence score (0-1):
        - Data quantity: more points = higher confidence
        - Data consistency: lower variance = higher confidence  
        - Prediction reasonableness: predictions > 72h are less confident
        """
        data = self.historical_data.get(bin_id, [])
        n_points = len(data)

        # Factor 1: Data quantity (20+ points = 0.6 confidence base)
        if n_points < 5:
            return 0.0
        quantity_factor = min(0.6, n_points / 50)

        # Factor 2: Data consistency (low variance = high confidence)
        rates = self._get_rates(bin_id)
        if len(rates) > 1:
            consistency_factor = 1.0 - (np.std(rates) / (np.mean(rates) + 0.1)) * 0.3
            consistency_factor = max(0.3, min(1.0, consistency_factor))
        else:
            consistency_factor = 0.3

        # Factor 3: Prediction horizon (closer predictions more reliable)
        if hours_until_full < 12:
            horizon_factor = 1.0
        elif hours_until_full < 48:
            horizon_factor = 0.8
        else:
            horizon_factor = 0.5

        # Combined confidence
        confidence = quantity_factor * 0.4 + consistency_factor * 0.4 + horizon_factor * 0.2
        return round(max(0.0, min(1.0, confidence)), 2)

    def predict_full_time(self, bin_id: str, current_fill: int) -> Optional[dict]:
        """
        Predict when bin will be full with realistic bounds and confidence.
        Returns None if insufficient data or unrealistic conditions.
        """
        data = self.historical_data.get(bin_id, [])
        if len(data) < self.MIN_POINTS_FOR_PREDICTION:
            return None

        fill_rate = self.calculate_fill_rate(bin_id)
        if fill_rate is None or fill_rate <= 0:
            return None

        remaining = 100 - current_fill
        hours_until_full = remaining / fill_rate

        # Cap at maximum reasonable prediction horizon
        if hours_until_full > self.MAX_HOURS_PREDICTION:
            hours_until_full = self.MAX_HOURS_PREDICTION

        predicted_time = _now() + timedelta(hours=hours_until_full)
        confidence = self._calculate_confidence(bin_id, hours_until_full)

        # Additional data quality metrics
        rates = self._get_rates(bin_id)
        rate_std = float(np.std(rates)) if rates else 0

        return {
            "bin_id": bin_id,
            "current_fill": current_fill,
            "fill_rate_per_hour": round(fill_rate, 2),
            "hours_until_full": round(hours_until_full, 1),
            "predicted_full_time": predicted_time.isoformat(),
            "confidence": confidence,
            "data_points_used": len(data),
            "rate_stability": round(1.0 - min(1.0, rate_std / (fill_rate + 0.1)), 2),
            "prediction_quality": "high" if confidence >= 0.7 else "medium" if confidence >= 0.5 else "low",
        }

    def get_hourly_pattern(self, bin_id: str) -> Dict[int, float]:
        """Average fill rate per hour of day (0-23). Useful for scheduling."""
        data = self.historical_data.get(bin_id, [])
        hourly: Dict[int, list] = {h: [] for h in range(24)}

        for i in range(1, len(data)):
            prev_time, prev_level = data[i - 1]
            curr_time, curr_level = data[i]

            hours = (curr_time - prev_time).total_seconds() / 3600
            if hours > 0 and curr_level > prev_level and hours < 1:  # Only short intervals
                rate = (curr_level - prev_level) / hours
                if 0 < rate < 6000:  # Sanity check
                    hourly[curr_time.hour].append(rate)

        return {
            h: round(float(np.median(v)), 2)
            for h, v in hourly.items()
            if v and len(v) >= 2  # Require at least 2 samples
        }


# ─── AnomalyDetector ─────────────────────────────────────────────────────────

class AnomalyDetector:
    """
    Z-score based anomaly detection with improved stability.
    Maintains rolling mean + std per metric per bin.
    
    IMPROVEMENTS:
    - IQR-based outlier removal before baseline calculation
    - Minimum baseline size requirement
    - Better handling of low-variance metrics
    - Severity classification on percentile distance
    - Skip early baseline period (first 5 readings often unstable)
    """

    MIN_BASELINE_POINTS = 10
    WARMUP_PERIOD = 5  # Skip first N readings for baseline stability

    def __init__(self, sensitivity: float = 2.5):
        self.sensitivity = sensitivity
        self.baselines: Dict[str, Dict[str, dict]] = {}
        self.reading_count: Dict[str, int] = {}  # Track readings per bin for warmup

    def update_baseline(self, bin_id: str, telemetry: dict):
        """Update baseline with warm-up period and outlier removal."""
        # Track readings to skip warmup period
        self.reading_count[bin_id] = self.reading_count.get(bin_id, 0) + 1
        if self.reading_count[bin_id] < self.WARMUP_PERIOD:
            return  # Skip early unstable readings

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
            
            # Keep rolling window
            if len(bucket["values"]) > 100:
                bucket["values"] = bucket["values"][-100:]
            
            # Update stats only after sufficient data
            if len(bucket["values"]) >= self.MIN_BASELINE_POINTS:
                # Remove outliers using IQR before calculating baseline
                values_array = np.array(bucket["values"])
                q1, q3 = np.percentile(values_array, [25, 75])
                iqr = q3 - q1
                
                # For metrics with very low variance, use all points
                if iqr < 0.1:
                    clean_vals = bucket["values"]
                else:
                    lower = q1 - 1.5 * iqr
                    upper = q3 + 1.5 * iqr
                    clean_vals = [v for v in bucket["values"] if lower <= v <= upper]
                
                if clean_vals:
                    bucket["mean"] = float(np.mean(clean_vals))
                    bucket["std"] = float(np.std(clean_vals))

    def detect_anomalies(self, bin_id: str, telemetry: dict) -> list:
        """Detect anomalies with realistic thresholds."""
        baseline = self.baselines.get(bin_id)
        if not baseline:
            return []

        # Skip detection if warmup not complete
        if self.reading_count.get(bin_id, 0) < self.WARMUP_PERIOD:
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
            mean = b.get("mean", 0)
            n_vals = len(b.get("values", []))
            
            # Skip if baseline incomplete or no variance
            if std < 0.01 or n_vals < self.MIN_BASELINE_POINTS:
                continue

            # Calculate z-score
            z = abs(value - mean) / std
            if z > self.sensitivity:
                # Classify severity based on z-score magnitude
                if z > 4.0:
                    severity = "critical"
                elif z > 3.0:
                    severity = "high"
                else:
                    severity = "medium"
                
                anomalies.append({
                    "metric": metric,
                    "current_value": round(value, 1) if isinstance(value, float) else value,
                    "expected_mean": round(mean, 1),
                    "expected_range": (
                        round(mean - self.sensitivity * std, 1),
                        round(mean + self.sensitivity * std, 1),
                    ),
                    "z_score": round(z, 2),
                    "severity": severity,
                    "baseline_points": n_vals,
                })

        return anomalies


# ─── CollectionOptimizer ─────────────────────────────────────────────────────

class CollectionOptimizer:
    """
    Rule-based collection scheduling with realistic urgency scoring.
    
    IMPROVEMENTS:
    - Confidence-aware recommendations (don't trust low-confidence predictions)
    - Better urgency thresholds for different fill levels
    - Route optimization with time-window aware scoring
    - Edge case handling (insufficient data, unrealistic predictions)
    """

    def __init__(self, predictor: BinFillPredictor):
        self.predictor = predictor

    def should_collect_now(self, bin_id: str, current_fill: int, threshold: int = 80) -> dict:
        """Determine if a bin needs collection now or later."""
        # Case 1: Already at/exceeding threshold
        if current_fill >= threshold:
            return {
                "should_collect": True,
                "urgency": "critical",
                "reason": f"Fill level ({current_fill}%) exceeds threshold ({threshold}%)",
                "recommended_time": "now",
                "confidence": 1.0,
            }

        # Case 2: Warning level (80-95%)
        if current_fill >= 80:
            return {
                "should_collect": True,
                "urgency": "high",
                "reason": f"Bin at high fill level ({current_fill}%)",
                "recommended_time": "within 2 hours",
                "confidence": 1.0,
            }

        # Case 3: Get prediction-based estimate
        prediction = self.predictor.predict_full_time(bin_id, current_fill)

        if prediction is None:
            return {
                "should_collect": False,
                "urgency": "unknown",
                "reason": "Insufficient data for prediction",
                "recommended_time": "check again in 1 hour",
                "confidence": 0.0,
            }

        h = prediction["hours_until_full"]
        confidence = prediction["confidence"]
        quality = prediction["prediction_quality"]

        # Case 4: Low confidence prediction - be conservative
        if confidence < 0.5:
            if current_fill >= 60:
                return {
                    "should_collect": True,
                    "urgency": "medium",
                    "reason": f"High fill ({current_fill}%) with uncertain prediction",
                    "recommended_time": "within 6 hours",
                    "confidence": confidence,
                }
            return {
                "should_collect": False,
                "urgency": "low",
                "reason": "Prediction confidence too low, insufficient data",
                "recommended_time": "check again later",
                "confidence": confidence,
            }

        # Case 5: High confidence, time-based urgency
        if h <= 2:  # Will be full within 2 hours
            return {
                "should_collect": True,
                "urgency": "critical",
                "reason": f"Predicted full in {h:.1f} hours",
                "recommended_time": "immediately",
                "confidence": confidence,
                "prediction": prediction,
            }
        elif h <= 12:  # Will be full within 12 hours
            return {
                "should_collect": True,
                "urgency": "high",
                "reason": f"Predicted full in {h:.1f} hours",
                "recommended_time": f"within {int(h)} hours",
                "confidence": confidence,
                "prediction": prediction,
            }
        elif h <= 48:  # Will be full within 48 hours
            return {
                "should_collect": True,
                "urgency": "medium",
                "reason": f"Predicted full in {h:.1f} hours",
                "recommended_time": f"within {int(h)} hours",
                "confidence": confidence,
                "prediction": prediction,
            }
        else:  # > 48 hours
            return {
                "should_collect": False,
                "urgency": "low",
                "reason": f"Sufficient capacity for {int(h)} hours",
                "recommended_time": f"in {int(h - 24)} hours or later",
                "confidence": confidence,
                "prediction": prediction,
            }

    def optimize_collection_route(self, bins: list) -> list:
        """
        Sort bin IDs by urgency for efficient collection routing.
        More urgent bins first.
        """
        scored = []
        for b in bins:
            bid = b.get("id")
            if not bid:
                continue
                
            fill = b.get("fill_level_percent", 0)
            
            # Start with fill-level score (0-100)
            score = fill * 2  # High fill gets high score
            
            # Apply urgency boost from prediction
            pred = self.predictor.predict_full_time(bid, fill)
            if pred:
                confidence = pred.get("confidence", 0)
                h = pred.get("hours_until_full", 72)
                
                # Confidence-weighted urgency boost
                if h <= 2:
                    score += 200 * confidence
                elif h <= 12:
                    score += 120 * confidence
                elif h <= 48:
                    score += 60 * confidence
                # Otherwise, no additional boost
            
            scored.append((bid, score))
        
        # Sort by score (highest urgency first)
        scored.sort(key=lambda x: x[1], reverse=True)
        return [bid for bid, _ in scored]


# ─── MLPredictionService ─────────────────────────────────────────────────────

class MLPredictionService:
    """
    Top-level ML service with improved stability and realistic predictions.
    A single instance lives in the FastAPI process.
    
    IMPROVEMENTS:
    - Better error handling and validation
    - Data quality tracking per bin
    - Improved logging for monitoring
    - Graceful degradation with insufficient data
    - Per-bin data freshness tracking
    
    NOTE: In-memory state is per-process. Multi-worker deployments
    (Gunicorn with N workers) each maintain their own copy. For production
    with multiple workers, move state to Redis or a time-series DB.
    """

    def __init__(self):
        self.fill_predictor = BinFillPredictor()
        self.anomaly_detector = AnomalyDetector(sensitivity=2.5)
        self.collection_optimizer = CollectionOptimizer(self.fill_predictor)
        self.data_quality_metrics: Dict[str, dict] = {}

    def rebuild_from_db(self, db) -> int:
        """
        Re-hydrate in-memory models from the TelemetryDB table.
        Call once at application startup (handled by main.py lifespan).
        Returns the number of readings loaded.
        """
        from database import TelemetryDB

        logger.info("[ML] Rebuilding models from database telemetry...")
        start_time = datetime.now(timezone.utc)

        try:
            bin_ids = [r.bin_id for r in db.query(TelemetryDB.bin_id).distinct().all()]
            total_loaded = 0
            skipped = 0

            for bid in bin_ids:
                rows = (
                    db.query(TelemetryDB)
                    .filter(TelemetryDB.bin_id == bid)
                    .order_by(TelemetryDB.timestamp.asc())
                    .limit(BinFillPredictor.MAX_POINTS)
                    .all()
                )
                
                bin_data_count = 0
                for r in rows:
                    try:
                        if r.fill_level_percent is not None and 0 <= r.fill_level_percent <= 100:
                            self.fill_predictor.add_data_point(bid, r.fill_level_percent, r.timestamp)
                            bin_data_count += 1
                        
                        telemetry = {
                            "fill_level_percent": r.fill_level_percent,
                            "battery_percent": r.battery_percent,
                            "temperature_c": r.temperature_c,
                            "humidity_percent": r.humidity_percent,
                        }
                        self.anomaly_detector.update_baseline(bid, telemetry)
                        total_loaded += 1
                    except Exception as e:
                        logger.warning(f"[ML] Error loading telemetry for {bid}: {e}")
                        skipped += 1
                        continue
                
                # Track data quality
                if bin_data_count > 0:
                    self.data_quality_metrics[bid] = {
                        "last_updated": start_time.isoformat(),
                        "total_readings": bin_data_count,
                        "can_predict": bin_data_count >= BinFillPredictor.MIN_POINTS_FOR_PREDICTION,
                    }

            elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
            logger.info(
                f"[ML] Loaded {total_loaded} readings for {len(bin_ids)} bins "
                f"({skipped} skipped) in {elapsed:.2f}s"
            )
            return total_loaded
        except Exception as e:
            logger.error(f"[ML] Error rebuilding from database: {e}")
            return 0

    def ingest_telemetry(self, bin_id: str, telemetry: dict):
        """Ingest new telemetry data into models."""
        try:
            fill = telemetry.get("fill_level_percent")
            if fill is not None and 0 <= fill <= 100:
                self.fill_predictor.add_data_point(bin_id, fill)
                
                # Track data freshness
                if bin_id not in self.data_quality_metrics:
                    self.data_quality_metrics[bin_id] = {"reading_count": 0}
                
                metric = self.data_quality_metrics[bin_id]
                metric["last_updated"] = _now().isoformat()
                metric["reading_count"] = metric.get("reading_count", 0) + 1
                metric["can_predict"] = (
                    len(self.fill_predictor.historical_data.get(bin_id, [])) 
                    >= BinFillPredictor.MIN_POINTS_FOR_PREDICTION
                )
            
            # Update anomaly baseline
            self.anomaly_detector.update_baseline(bin_id, telemetry)
        except Exception as e:
            logger.error(f"[ML] Error ingesting telemetry for {bin_id}: {e}")

    def analyze_bin(self, bin_id: str, current_data: dict) -> dict:
        """Comprehensive bin analysis with error handling."""
        try:
            fill = current_data.get("fill_level_percent", 0)
            
            prediction = self.fill_predictor.predict_full_time(bin_id, fill)
            anomalies = self.anomaly_detector.detect_anomalies(bin_id, current_data)
            recommendation = self.collection_optimizer.should_collect_now(bin_id, fill)
            pattern = self.fill_predictor.get_hourly_pattern(bin_id)
            
            return {
                "bin_id": bin_id,
                "current_fill": fill,
                "prediction": prediction,
                "anomalies": anomalies,
                "collection_recommendation": recommendation,
                "usage_pattern": pattern,
                "analysis_timestamp": _now().isoformat(),
                "data_quality": self.data_quality_metrics.get(bin_id, {}),
            }
        except Exception as e:
            logger.error(f"[ML] Error analyzing bin {bin_id}: {e}")
            return {
                "bin_id": bin_id,
                "error": str(e),
                "analysis_timestamp": _now().isoformat(),
            }

    def get_statistics(self) -> dict:
        """Get comprehensive ML service statistics."""
        total_bins = len(self.fill_predictor.historical_data)
        total_pts = sum(len(v) for v in self.fill_predictor.historical_data.values())
        with_pred = sum(
            1 for bid in self.fill_predictor.historical_data
            if self.fill_predictor.calculate_fill_rate(bid) is not None
        )
        
        # Data quality stats
        healthy_baseline = sum(
            1 for bid in self.anomaly_detector.baselines
            if any(
                len(m.get("values", [])) >= AnomalyDetector.MIN_BASELINE_POINTS
                for m in self.anomaly_detector.baselines[bid].values()
            )
        )
        
        return {
            "total_bins_tracked": total_bins,
            "total_data_points": total_pts,
            "bins_with_predictions": with_pred,
            "prediction_coverage": round(with_pred / total_bins * 100, 1) if total_bins else 0,
            "bins_with_anomaly_baseline": healthy_baseline,
            "predictor_memory_points": BinFillPredictor.MAX_POINTS,
            "min_points_for_prediction": BinFillPredictor.MIN_POINTS_FOR_PREDICTION,
        }