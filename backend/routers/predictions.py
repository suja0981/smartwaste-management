from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db, BinDB
from services.ml_predictor import MLPredictionService
from pydantic import BaseModel

router = APIRouter()

# Global ML service instance (in production, use dependency injection)
ml_service = MLPredictionService()

# Pydantic models for API
class PredictionResponse(BaseModel):
    bin_id: str
    current_fill: int
    fill_rate_per_hour: Optional[float] = None
    hours_until_full: Optional[float] = None
    predicted_full_time: Optional[str] = None
    confidence: Optional[float] = None
    data_points_used: Optional[int] = None

class AnomalyResponse(BaseModel):
    metric: str
    current_value: float
    expected_range: tuple
    z_score: float
    severity: str

class BinAnalysisResponse(BaseModel):
    bin_id: str
    current_fill: int
    prediction: Optional[Dict] = None
    anomalies: List[Dict] = []
    collection_recommendation: Dict
    usage_pattern: Dict = {}
    analysis_timestamp: str

class CollectionRecommendation(BaseModel):
    bin_id: str
    current_fill: int
    should_collect: bool
    urgency: str
    reason: str
    recommended_time: str

@router.get("/predict/{bin_id}", response_model=PredictionResponse)
def predict_fill_time(bin_id: str, db: Session = Depends(get_db)):
    """
    Predict when a specific bin will be full.
    Uses historical data to estimate fill rate and time until capacity.
    """
    # Get current bin data
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    # Get prediction
    prediction = ml_service.fill_predictor.predict_full_time(
        bin_id, bin_db.fill_level_percent
    )
    
    if prediction is None:
        raise HTTPException(
            status_code=400,
            detail="Insufficient historical data for prediction. Need at least 2 data points."
        )
    
    return PredictionResponse(**prediction)

@router.get("/analyze/{bin_id}", response_model=BinAnalysisResponse)
def analyze_bin(bin_id: str, db: Session = Depends(get_db)):
    """
    Comprehensive ML analysis of a bin including:
    - Fill time prediction
    - Anomaly detection
    - Collection recommendation
    - Usage pattern analysis
    """
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    current_data = {
        "fill_level_percent": bin_db.fill_level_percent,
        "battery_percent": bin_db.battery_percent,
        "temperature_c": bin_db.temperature_c,
        "humidity_percent": bin_db.humidity_percent
    }
    
    analysis = ml_service.analyze_bin(bin_id, current_data)
    
    return BinAnalysisResponse(**analysis)

@router.get("/anomalies/{bin_id}", response_model=List[AnomalyResponse])
def detect_anomalies(bin_id: str, db: Session = Depends(get_db)):
    """
    Detect anomalies in current sensor readings.
    Compares current values against historical baselines.
    """
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    telemetry = {
        "fill_level_percent": bin_db.fill_level_percent,
        "battery_percent": bin_db.battery_percent,
        "temperature_c": bin_db.temperature_c,
        "humidity_percent": bin_db.humidity_percent
    }
    
    anomalies = ml_service.anomaly_detector.detect_anomalies(bin_id, telemetry)
    
    return [AnomalyResponse(**anomaly) for anomaly in anomalies]

@router.get("/collection/recommend/{bin_id}", response_model=CollectionRecommendation)
def get_collection_recommendation(bin_id: str, db: Session = Depends(get_db)):
    """
    Get AI-powered collection recommendation for a bin.
    Considers current fill level and predicted fill time.
    """
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")
    
    recommendation = ml_service.collection_optimizer.should_collect_now(
        bin_id, bin_db.fill_level_percent
    )
    
    return CollectionRecommendation(
        bin_id=bin_id,
        current_fill=bin_db.fill_level_percent,
        **recommendation
    )

@router.get("/collection/optimize", response_model=List[str])
def optimize_collection_order(db: Session = Depends(get_db)):
    """
    Get optimized collection order for all bins.
    Bins are ordered by urgency (fill level + prediction).
    """
    bins = db.query(BinDB).all()
    
    bin_data = [
        {
            "id": b.id,
            "fill_level_percent": b.fill_level_percent
        }
        for b in bins
    ]
    
    optimized_order = ml_service.collection_optimizer.optimize_collection_route(bin_data)
    
    return optimized_order

@router.get("/patterns/{bin_id}")
def get_usage_pattern(bin_id: str):
    """
    Get hourly usage pattern for a bin.
    Shows average fill rate for each hour of the day.
    """
    pattern = ml_service.fill_predictor.get_hourly_pattern(bin_id)
    
    if not pattern:
        raise HTTPException(
            status_code=400,
            detail="Insufficient data to determine usage pattern"
        )
    
    return {
        "bin_id": bin_id,
        "hourly_fill_rates": pattern,
        "peak_hours": sorted(
            pattern.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]  # Top 3 peak hours
    }

@router.get("/stats")
def get_ml_statistics():
    """Get ML service statistics and health"""
    stats = ml_service.get_statistics()
    
    return {
        "service": "ML Prediction Service",
        "status": "operational",
        "statistics": stats,
        "models": {
            "fill_predictor": "active",
            "anomaly_detector": "active",
            "collection_optimizer": "active"
        }
    }

@router.post("/train")
async def train_models(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Trigger model training on historical data.
    Runs in background to avoid blocking the request.
    """
    def train():
        bins = db.query(BinDB).all()
        
        for bin_db in bins:
            # Simulate adding historical data
            # In production, this would load from a time-series database
            telemetry = {
                "fill_level_percent": bin_db.fill_level_percent,
                "battery_percent": bin_db.battery_percent,
                "temperature_c": bin_db.temperature_c,
                "humidity_percent": bin_db.humidity_percent
            }
            
            ml_service.ingest_telemetry(bin_db.id, telemetry)
    
    background_tasks.add_task(train)
    
    return {
        "status": "training_started",
        "message": "Model training initiated in background"
    }

@router.get("/predictions/all")
def get_all_predictions(db: Session = Depends(get_db)):
    """
    Get predictions for all bins.
    Useful for dashboard overview.
    """
    bins = db.query(BinDB).all()
    
    predictions = []
    
    for bin_db in bins:
        prediction = ml_service.fill_predictor.predict_full_time(
            bin_db.id,
            bin_db.fill_level_percent
        )
        
        if prediction:
            predictions.append(prediction)
    
    return {
        "total_bins": len(bins),
        "predictions_available": len(predictions),
        "predictions": predictions
    }

@router.get("/alerts/predicted")
def get_predicted_alerts(hours_ahead: int = 24, db: Session = Depends(get_db)):
    """
    Predict which bins will need attention in the next N hours.
    Useful for proactive planning.
    """
    bins = db.query(BinDB).all()
    
    predicted_alerts = []
    
    for bin_db in bins:
        prediction = ml_service.fill_predictor.predict_full_time(
            bin_db.id,
            bin_db.fill_level_percent
        )
        
        if prediction and prediction["hours_until_full"] <= hours_ahead:
            predicted_alerts.append({
                "bin_id": bin_db.id,
                "location": bin_db.location,
                "current_fill": bin_db.fill_level_percent,
                "hours_until_full": prediction["hours_until_full"],
                "predicted_time": prediction["predicted_full_time"],
                "urgency": "high" if prediction["hours_until_full"] <= 6 else "medium"
            })
    
    # Sort by urgency
    predicted_alerts.sort(key=lambda x: x["hours_until_full"])
    
    return {
        "timeframe_hours": hours_ahead,
        "alerts_count": len(predicted_alerts),
        "alerts": predicted_alerts
    }