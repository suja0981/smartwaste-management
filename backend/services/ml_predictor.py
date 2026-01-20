"""
Machine Learning Prediction Service

Features:
- Fill level prediction (when will bin be full?)
- Anomaly detection in sensor data
- Usage pattern analysis
- Optimal collection time prediction
"""

import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
import json

class BinFillPredictor:
    """Predicts when bins will reach full capacity"""
    
    def __init__(self):
        self.historical_data = {}  # bin_id -> list of (timestamp, fill_level)
        self.patterns = {}  # bin_id -> learned patterns
    
    def add_data_point(self, bin_id: str, fill_level: int, timestamp: datetime = None):
        """Add a historical data point for training"""
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        if bin_id not in self.historical_data:
            self.historical_data[bin_id] = []
        
        self.historical_data[bin_id].append((timestamp, fill_level))
        
        # Keep only last 100 data points per bin
        if len(self.historical_data[bin_id]) > 100:
            self.historical_data[bin_id] = self.historical_data[bin_id][-100:]
    
    def calculate_fill_rate(self, bin_id: str) -> Optional[float]:
        """Calculate average fill rate (% per hour)"""
        if bin_id not in self.historical_data:
            return None
        
        data = self.historical_data[bin_id]
        
        if len(data) < 2:
            return None
        
        # Calculate rate between consecutive points
        rates = []
        for i in range(1, len(data)):
            prev_time, prev_level = data[i-1]
            curr_time, curr_level = data[i]
            
            time_diff = (curr_time - prev_time).total_seconds() / 3600  # hours
            
            if time_diff > 0:
                level_diff = curr_level - prev_level
                
                # Ignore negative differences (bin was emptied)
                if level_diff > 0:
                    rate = level_diff / time_diff
                    rates.append(rate)
        
        if not rates:
            return None
        
        # Use median to reduce impact of outliers
        return float(np.median(rates))
    
    def predict_full_time(self, bin_id: str, current_fill: int) -> Optional[Dict]:
        """
        Predict when bin will reach 100% capacity
        
        Returns:
            Dict with prediction info or None if insufficient data
        """
        fill_rate = self.calculate_fill_rate(bin_id)
        
        if fill_rate is None or fill_rate <= 0:
            return None
        
        # Calculate hours until full
        remaining_capacity = 100 - current_fill
        hours_until_full = remaining_capacity / fill_rate
        
        # Calculate predicted full time
        predicted_time = datetime.utcnow() + timedelta(hours=hours_until_full)
        
        # Calculate confidence based on data points
        data_points = len(self.historical_data.get(bin_id, []))
        confidence = min(0.95, data_points / 50)  # Max 95% confidence at 50+ points
        
        return {
            "bin_id": bin_id,
            "current_fill": current_fill,
            "fill_rate_per_hour": round(fill_rate, 2),
            "hours_until_full": round(hours_until_full, 1),
            "predicted_full_time": predicted_time.isoformat(),
            "confidence": round(confidence, 2),
            "data_points_used": data_points
        }
    
    def get_hourly_pattern(self, bin_id: str) -> Dict[int, float]:
        """Analyze fill rate by hour of day"""
        if bin_id not in self.historical_data:
            return {}
        
        hourly_rates = {hour: [] for hour in range(24)}
        data = self.historical_data[bin_id]
        
        for i in range(1, len(data)):
            prev_time, prev_level = data[i-1]
            curr_time, curr_level = data[i]
            
            hour = curr_time.hour
            time_diff = (curr_time - prev_time).total_seconds() / 3600
            
            if time_diff > 0 and curr_level > prev_level:
                rate = (curr_level - prev_level) / time_diff
                hourly_rates[hour].append(rate)
        
        # Calculate average rate per hour
        pattern = {}
        for hour, rates in hourly_rates.items():
            if rates:
                pattern[hour] = round(float(np.mean(rates)), 2)
        
        return pattern


class AnomalyDetector:
    """Detects anomalies in sensor data"""
    
    def __init__(self, sensitivity: float = 2.0):
        self.sensitivity = sensitivity  # Standard deviations for anomaly
        self.baselines = {}  # bin_id -> {metric: (mean, std)}
    
    def update_baseline(self, bin_id: str, telemetry: Dict):
        """Update baseline statistics for a bin"""
        if bin_id not in self.baselines:
            self.baselines[bin_id] = {
                "fill_level": {"values": [], "mean": 0, "std": 0},
                "battery": {"values": [], "mean": 0, "std": 0},
                "temperature": {"values": [], "mean": 0, "std": 0},
                "humidity": {"values": [], "mean": 0, "std": 0}
            }
        
        # Add new values
        for metric in ["fill_level", "battery", "temperature", "humidity"]:
            value = telemetry.get(f"{metric}_percent" if metric in ["fill_level", "battery", "humidity"] 
                                 else f"{metric}_c")
            
            if value is not None and value >= 0:
                baseline = self.baselines[bin_id][metric]
                baseline["values"].append(value)
                
                # Keep only last 50 values
                if len(baseline["values"]) > 50:
                    baseline["values"] = baseline["values"][-50:]
                
                # Recalculate statistics
                if len(baseline["values"]) >= 5:
                    baseline["mean"] = float(np.mean(baseline["values"]))
                    baseline["std"] = float(np.std(baseline["values"]))
    
    def detect_anomalies(self, bin_id: str, telemetry: Dict) -> List[Dict]:
        """
        Detect anomalies in current telemetry
        
        Returns:
            List of detected anomalies
        """
        if bin_id not in self.baselines:
            return []
        
        anomalies = []
        
        metrics_to_check = {
            "fill_level": telemetry.get("fill_level_percent"),
            "battery": telemetry.get("battery_percent"),
            "temperature": telemetry.get("temperature_c"),
            "humidity": telemetry.get("humidity_percent")
        }
        
        for metric, value in metrics_to_check.items():
            if value is None or value < 0:
                continue
            
            baseline = self.baselines[bin_id][metric]
            
            if baseline["std"] == 0 or len(baseline["values"]) < 5:
                continue
            
            # Calculate z-score
            z_score = abs(value - baseline["mean"]) / baseline["std"]
            
            if z_score > self.sensitivity:
                anomalies.append({
                    "metric": metric,
                    "current_value": value,
                    "expected_range": (
                        round(baseline["mean"] - self.sensitivity * baseline["std"], 1),
                        round(baseline["mean"] + self.sensitivity * baseline["std"], 1)
                    ),
                    "z_score": round(z_score, 2),
                    "severity": "high" if z_score > 3 else "medium"
                })
        
        return anomalies


class CollectionOptimizer:
    """Optimizes collection scheduling based on predictions"""
    
    def __init__(self):
        self.predictor = BinFillPredictor()
    
    def should_collect_now(self, bin_id: str, current_fill: int, 
                          threshold: int = 80) -> Dict:
        """
        Determine if bin should be collected now
        
        Args:
            bin_id: Bin identifier
            current_fill: Current fill level (%)
            threshold: Collection threshold (default 80%)
        
        Returns:
            Dict with collection recommendation
        """
        # Immediate collection if over threshold
        if current_fill >= threshold:
            return {
                "should_collect": True,
                "urgency": "high",
                "reason": f"Fill level ({current_fill}%) exceeds threshold ({threshold}%)",
                "recommended_time": "now"
            }
        
        # Check prediction
        prediction = self.predictor.predict_full_time(bin_id, current_fill)
        
        if prediction is None:
            return {
                "should_collect": False,
                "urgency": "low",
                "reason": "Insufficient data for prediction",
                "recommended_time": "unknown"
            }
        
        hours_until_full = prediction["hours_until_full"]
        
        # Collect if will be full within next collection window (24 hours)
        if hours_until_full <= 24:
            return {
                "should_collect": True,
                "urgency": "medium",
                "reason": f"Predicted to be full in {hours_until_full:.1f} hours",
                "recommended_time": f"within {int(hours_until_full)} hours",
                "prediction": prediction
            }
        
        return {
            "should_collect": False,
            "urgency": "low",
            "reason": f"Bin not full for {hours_until_full:.1f} hours",
            "recommended_time": f"in {int(hours_until_full - 12)} hours",
            "prediction": prediction
        }
    
    def optimize_collection_route(self, bins: List[Dict]) -> List[str]:
        """
        Determine optimal collection order based on urgency
        
        Args:
            bins: List of bin data dicts
        
        Returns:
            Ordered list of bin IDs to collect
        """
        urgency_scores = []
        
        for bin_data in bins:
            bin_id = bin_data["id"]
            current_fill = bin_data.get("fill_level_percent", 0)
            
            # Calculate urgency score
            score = current_fill
            
            # Boost score if predicted to be full soon
            prediction = self.predictor.predict_full_time(bin_id, current_fill)
            if prediction:
                hours_until_full = prediction["hours_until_full"]
                if hours_until_full <= 24:
                    score += (24 - hours_until_full) * 2
            
            urgency_scores.append((bin_id, score))
        
        # Sort by urgency (highest first)
        urgency_scores.sort(key=lambda x: x[1], reverse=True)
        
        return [bin_id for bin_id, _ in urgency_scores]


class MLPredictionService:
    """Main ML prediction service combining all models"""
    
    def __init__(self):
        self.fill_predictor = BinFillPredictor()
        self.anomaly_detector = AnomalyDetector(sensitivity=2.5)
        self.collection_optimizer = CollectionOptimizer()
        self.collection_optimizer.predictor = self.fill_predictor
    
    def ingest_telemetry(self, bin_id: str, telemetry: Dict):
        """Process incoming telemetry data"""
        fill_level = telemetry.get("fill_level_percent")
        
        if fill_level is not None and fill_level >= 0:
            self.fill_predictor.add_data_point(bin_id, fill_level)
        
        self.anomaly_detector.update_baseline(bin_id, telemetry)
    
    def analyze_bin(self, bin_id: str, current_data: Dict) -> Dict:
        """
        Comprehensive analysis of a bin
        
        Returns:
            Complete analysis including predictions and anomalies
        """
        current_fill = current_data.get("fill_level_percent", 0)
        
        # Get fill prediction
        prediction = self.fill_predictor.predict_full_time(bin_id, current_fill)
        
        # Detect anomalies
        anomalies = self.anomaly_detector.detect_anomalies(bin_id, current_data)
        
        # Get collection recommendation
        collection_rec = self.collection_optimizer.should_collect_now(
            bin_id, current_fill
        )
        
        # Get usage pattern
        pattern = self.fill_predictor.get_hourly_pattern(bin_id)
        
        return {
            "bin_id": bin_id,
            "current_fill": current_fill,
            "prediction": prediction,
            "anomalies": anomalies,
            "collection_recommendation": collection_rec,
            "usage_pattern": pattern,
            "analysis_timestamp": datetime.utcnow().isoformat()
        }
    
    def get_statistics(self) -> Dict:
        """Get overall ML service statistics"""
        total_bins = len(self.fill_predictor.historical_data)
        total_data_points = sum(
            len(data) for data in self.fill_predictor.historical_data.values()
        )
        
        bins_with_predictions = sum(
            1 for bin_id in self.fill_predictor.historical_data
            if self.fill_predictor.calculate_fill_rate(bin_id) is not None
        )
        
        return {
            "total_bins_tracked": total_bins,
            "total_data_points": total_data_points,
            "bins_with_predictions": bins_with_predictions,
            "prediction_coverage": (
                round(bins_with_predictions / total_bins * 100, 1)
                if total_bins > 0 else 0
            )
        }