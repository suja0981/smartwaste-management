from datetime import datetime
from typing import List, Dict, Optional
import uuid
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from auth_utils import require_admin, get_current_user
from database import get_db, BinDB, TaskDB
from services.ml_predictor import MLPredictionService
from pydantic import BaseModel
from utils import get_current_timestamp

router = APIRouter()
PREDICTION_TASK_MARKER = "[AUTO_PREDICTION]"

# Global prediction service instance
# NOTE: This performs statistical analysis and linear extrapolation on fill rates
# to predict when bins will reach capacity. It's NOT deep learning.
# In production, consider moving to Redis or a time-series DB for multi-worker deployments.
prediction_service = MLPredictionService()

# ─── Pydantic models ──────────────────────────────────────────────────────────

class PredictionResponse(BaseModel):
    bin_id: str
    current_fill: int
    fill_rate_per_hour: Optional[float] = None
    hours_until_full: Optional[float] = None
    predicted_full_time: Optional[str] = None
    confidence: Optional[float] = None
    data_points_used: Optional[int] = None
    rate_stability: Optional[float] = None
    prediction_quality: Optional[str] = None

class AnomalyResponse(BaseModel):
    metric: str
    current_value: float
    expected_mean: float
    expected_range: tuple
    z_score: float
    severity: str
    baseline_points: int

class BinAnalysisResponse(BaseModel):
    bin_id: str
    current_fill: int
    prediction: Optional[Dict] = None
    anomalies: List[Dict] = []
    collection_recommendation: Dict
    usage_pattern: Dict = {}
    analysis_timestamp: str
    data_quality: Dict = {}

class CollectionRecommendation(BaseModel):
    bin_id: str
    current_fill: int
    should_collect: bool
    urgency: str
    reason: str
    recommended_time: str
    confidence: float

class ServiceStatsResponse(BaseModel):
    total_bins_tracked: int
    total_data_points: int
    bins_with_predictions: int
    prediction_coverage: float
    bins_with_anomaly_baseline: int
    predictor_memory_points: int
    min_points_for_prediction: int


class PredictionTaskSyncResponse(BaseModel):
    timeframe_hours: int
    alerts_considered: int
    created: int
    updated: int
    skipped_existing: int
    task_ids: List[str] = []
    bin_ids: List[str] = []


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/predict/{bin_id}", response_model=PredictionResponse)
def predict_fill_time(bin_id: str, db: Session = Depends(get_db), _user = Depends(get_current_user)):
    """
    Predict when a specific bin will be full.
    
    Uses historical data with:
    - Outlier detection and removal
    - Rate smoothing for stability
    - Confidence scoring based on data quantity and consistency
    
    Returns 400 if insufficient data (need 20+ readings for reliable prediction).
    """
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")

    prediction = prediction_service.fill_predictor.predict_full_time(
        bin_id, bin_db.fill_level_percent
    )

    if prediction is None:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient data for prediction. Need at least "
                   f"{prediction_service.fill_predictor.MIN_POINTS_FOR_PREDICTION} data points.",
        )

    return PredictionResponse(**prediction)


@router.get("/analyze/{bin_id}", response_model=BinAnalysisResponse)
def analyze_bin(bin_id: str, db: Session = Depends(get_db), _user = Depends(get_current_user)):
    """
    Comprehensive ML analysis of a bin including:
    - Fill time prediction with confidence scoring
    - Anomaly detection on all sensor metrics
    - Collection urgency recommendation
    - Hourly usage pattern analysis
    - Data quality indicators
    """
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")

    current_data = {
        "fill_level_percent": bin_db.fill_level_percent,
        "battery_percent": bin_db.battery_percent,
        "temperature_c": bin_db.temperature_c,
        "humidity_percent": bin_db.humidity_percent,
    }

    analysis = prediction_service.analyze_bin(bin_id, current_data)
    return BinAnalysisResponse(**analysis)


@router.get("/collection-priority", response_model=List[str])
def get_collection_priority(db: Session = Depends(get_db), _user = Depends(get_current_user)):
    """
    Get bin IDs sorted by collection urgency.
    
    Prioritizes:
    1. Bins exceeding capacity threshold
    2. Bins predicted to fill soon (high confidence)
    3. Bins with current high fill levels
    4. Bins with medium urgency
    """
    bins_db = db.query(BinDB).all()
    bins_data = [
        {
            "id": b.id,
            "fill_level_percent": b.fill_level_percent,
        }
        for b in bins_db
    ]
    
    priority = prediction_service.collection_optimizer.optimize_collection_route(bins_data)
    return priority


@router.get("/anomalies/{bin_id}", response_model=List[AnomalyResponse])
def detect_anomalies(bin_id: str, db: Session = Depends(get_db), _user = Depends(get_current_user)):
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
        "humidity_percent": bin_db.humidity_percent,
    }

    anomalies = prediction_service.anomaly_detector.detect_anomalies(bin_id, telemetry)
    return [AnomalyResponse(**a) for a in anomalies]


@router.get("/collection/recommend/{bin_id}", response_model=CollectionRecommendation)
def get_collection_recommendation(bin_id: str, db: Session = Depends(get_db), _user = Depends(get_current_user)):
    """
    Get AI-powered collection recommendation for a bin.
    Considers current fill level and predicted fill time.
    """
    bin_db = db.query(BinDB).filter(BinDB.id == bin_id).first()
    if not bin_db:
        raise HTTPException(status_code=404, detail="Bin not found")

    recommendation = prediction_service.collection_optimizer.should_collect_now(
        bin_id, bin_db.fill_level_percent
    )

    return CollectionRecommendation(
        bin_id=bin_id,
        current_fill=bin_db.fill_level_percent,
        **recommendation,
    )


@router.get("/collection/optimize", response_model=List[str])
def optimize_collection_order(db: Session = Depends(get_db), _user = Depends(get_current_user)):
    """
    Get optimized collection order for all bins.
    Bins are ordered by urgency (fill level + prediction).
    """
    bins = db.query(BinDB).all()
    bin_data = [{"id": b.id, "fill_level_percent": b.fill_level_percent} for b in bins]
    return prediction_service.collection_optimizer.optimize_collection_route(bin_data)


@router.get("/patterns/{bin_id}")
def get_usage_pattern(bin_id: str, _user = Depends(get_current_user)):
    """
    Get hourly usage pattern for a bin.
    Shows average fill rate for each hour of the day.
    """
    pattern = prediction_service.fill_predictor.get_hourly_pattern(bin_id)

    if not pattern:
        raise HTTPException(
            status_code=400,
            detail="Insufficient data to determine usage pattern",
        )

    return {
        "bin_id": bin_id,
        "hourly_fill_rates": pattern,
        "peak_hours": sorted(pattern.items(), key=lambda x: x[1], reverse=True)[:3],
    }


@router.get("/stats")
def get_ml_statistics(_user = Depends(get_current_user)):
    """Get ML service statistics and health."""
    stats = prediction_service.get_statistics()
    return {
        "service": "ML Prediction Service",
        "status": "operational",
        "statistics": stats,
        "models": {
            "fill_predictor": "active",
            "anomaly_detector": "active",
            "collection_optimizer": "active",
        },
    }


@router.post("/seed")
def seed_ml_from_db(db: Session = Depends(get_db), _admin = Depends(require_admin)):
    """
    Synchronously rebuild in-memory ML models from all persisted telemetry.

    This is the CORRECT way to populate the ML service after bulk-inserting
    historical data (e.g. during tests or migrations).  The older /train
    endpoint runs in a background task and is not awaitable from tests.

    Returns the number of data points loaded and bins processed.
    """
    count = prediction_service.rebuild_from_db(db)
    bins_loaded = len(prediction_service.fill_predictor.historical_data)
    return {
        "seeded": True,
        "data_points_loaded": count,
        "bins_loaded": bins_loaded,
    }


@router.post("/train")
async def train_models(background_tasks: BackgroundTasks, _admin = Depends(require_admin)):
    """
    Trigger model training on historical data.
    Runs in background — prefer /seed for synchronous use (e.g. tests).
    """
    def train():
        # Bug fix: background tasks must open their own DB session.
        # The request-scoped session from Depends(get_db) is closed before
        # the background task executes, causing 'Session already closed' errors.
        from database import SessionLocal
        db = SessionLocal()
        try:
            bins = db.query(BinDB).all()
            for bin_db in bins:
                telemetry = {
                    "fill_level_percent": bin_db.fill_level_percent,
                    "battery_percent": bin_db.battery_percent,
                    "temperature_c": bin_db.temperature_c,
                    "humidity_percent": bin_db.humidity_percent,
                }
                prediction_service.ingest_telemetry(bin_db.id, telemetry)
        finally:
            db.close()

    background_tasks.add_task(train)
    return {"status": "training_started", "message": "Model training initiated in background"}


@router.get("/predictions/all")
def get_all_predictions(db: Session = Depends(get_db), _user = Depends(get_current_user)):
    """Get predictions for all bins (dashboard overview)."""
    bins = db.query(BinDB).all()
    predictions = []
    for bin_db in bins:
        prediction = prediction_service.fill_predictor.predict_full_time(
            bin_db.id, bin_db.fill_level_percent
        )
        if prediction:
            predictions.append(prediction)

    return {
        "total_bins": len(bins),
        "predictions_available": len(predictions),
        "predictions": predictions,
    }


def _build_predicted_alerts(bin_rows: List[BinDB], hours_ahead: int) -> List[Dict]:
    predicted_alerts = []

    for bin_db in bin_rows:
        prediction = prediction_service.fill_predictor.predict_full_time(
            bin_db.id, bin_db.fill_level_percent
        )
        if prediction and prediction["hours_until_full"] <= hours_ahead:
            h = prediction["hours_until_full"]
            urgency = "high" if h <= 6 else "medium" if h <= 12 else "low"
            predicted_alerts.append({
                "bin_id": bin_db.id,
                "location": bin_db.location,
                "current_fill": bin_db.fill_level_percent,
                "hours_until_full": h,
                "predicted_time": prediction["predicted_full_time"],
                "urgency": urgency,
            })

    predicted_alerts.sort(key=lambda x: x["hours_until_full"])
    return predicted_alerts


def _prediction_task_priority(hours_until_full: float, current_fill: int) -> str:
    if hours_until_full <= 6 or current_fill >= 90:
        return "high"
    if hours_until_full <= 24 or current_fill >= 75:
        return "medium"
    return "low"


def _parse_prediction_due_date(predicted_time: Optional[str]) -> Optional[datetime]:
    if not predicted_time:
        return None
    try:
        return datetime.fromisoformat(predicted_time.replace("Z", "+00:00"))
    except ValueError:
        return None


def _is_prediction_generated_task(task: TaskDB) -> bool:
    return bool(task.description and PREDICTION_TASK_MARKER in task.description)


def sync_prediction_tasks(
    db: Session,
    *,
    hours_ahead: int = 24,
    target_bin_ids: Optional[List[str]] = None,
) -> Dict:
    bins_query = db.query(BinDB)
    if target_bin_ids:
        bins_query = bins_query.filter(BinDB.id.in_(target_bin_ids))

    alerts = _build_predicted_alerts(bins_query.all(), hours_ahead)
    created = 0
    updated = 0
    skipped_existing = 0
    task_ids: List[str] = []
    bin_ids: List[str] = []
    changed = False

    for alert in alerts:
        open_task = (
            db.query(TaskDB)
            .filter(
                TaskDB.bin_id == alert["bin_id"],
                TaskDB.status.in_(["pending", "in-progress"]),
            )
            .order_by(TaskDB.created_at.desc())
            .first()
        )

        due_date = _parse_prediction_due_date(alert["predicted_time"])
        priority = _prediction_task_priority(
            alert["hours_until_full"],
            alert["current_fill"],
        )
        description = (
            f"{PREDICTION_TASK_MARKER} Auto-created from ML prediction. "
            f"{alert['bin_id']} at {alert['location']} is predicted to reach full "
            f"capacity in {alert['hours_until_full']:.1f} hours."
        )

        if open_task:
            if _is_prediction_generated_task(open_task):
                open_task.title = f"Predicted collection for {alert['bin_id']}"
                open_task.description = description
                open_task.priority = priority
                open_task.location = alert["location"]
                open_task.due_date = due_date
                updated += 1
                changed = True
                task_ids.append(open_task.id)
                bin_ids.append(alert["bin_id"])
            else:
                skipped_existing += 1
            continue

        task_db = TaskDB(
            id=f"pred-task-{uuid.uuid4().hex[:8]}",
            title=f"Predicted collection for {alert['bin_id']}",
            description=description,
            priority=priority,
            status="pending",
            bin_id=alert["bin_id"],
            location=alert["location"],
            estimated_time_minutes=30,
            created_at=get_current_timestamp(),
            due_date=due_date,
        )
        db.add(task_db)
        created += 1
        changed = True
        task_ids.append(task_db.id)
        bin_ids.append(alert["bin_id"])

    if changed:
        db.commit()

    return {
        "timeframe_hours": hours_ahead,
        "alerts_considered": len(alerts),
        "created": created,
        "updated": updated,
        "skipped_existing": skipped_existing,
        "task_ids": task_ids,
        "bin_ids": bin_ids,
    }


@router.get("/alerts/predicted")
def get_predicted_alerts(hours_ahead: int = 24, db: Session = Depends(get_db), _user = Depends(get_current_user)):
    """Predict which bins will need attention in the next N hours."""
    predicted_alerts = _build_predicted_alerts(db.query(BinDB).all(), hours_ahead)
    return {
        "timeframe_hours": hours_ahead,
        "alerts_count": len(predicted_alerts),
        "alerts": predicted_alerts,
    }


@router.post("/alerts/predicted/tasks", response_model=PredictionTaskSyncResponse)
def create_tasks_from_predicted_alerts(
    hours_ahead: int = 24,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """Create or refresh pending collection tasks for bins predicted to fill soon."""
    return sync_prediction_tasks(db, hours_ahead=hours_ahead)
