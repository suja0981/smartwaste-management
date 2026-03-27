# ML-Based Alerts System - How It Works

## 🎯 Current ML Predictor You Have

Your system already has:
```
✅ Fill rate prediction     - "This bin fills 5%/hour"
✅ Overflow prediction      - "This bin will be full in 2 hours"
✅ Anomaly detection        - "Temperature is abnormally high"
✅ Collection optimizer     - "Collect this bin before that one"
```

These run on the **predictions** router at `/predictions/*`

---

## 🔄 How ML Alerts Would Replace AI Alerts

### **Current Flow (CCTV - Not Used):**
```
┌─────────────────────────────────┐
│  CCTV System (Not integrated)   │
└────────────────┬────────────────┘
                 │ POST /ai_alerts
                 ↓ (Never happens)
┌─────────────────────────────────┐
│   AI Alerts DB (Unused)         │
│   - fire, vandalism, overflow   │
└────────────────┬────────────────┘
                 │
                 ↓
      Frontend Dashboard
     (Shows nothing for alerts)
```

### **New Flow (ML-Based - Automatic):**
```
┌──────────────────────────────────────┐
│   IoT Telemetry (Every 30 sec)       │
│   - fill_level, temp, battery        │
└────────────────┬─────────────────────┘
                 │ POST /telemetry
                 ↓
┌──────────────────────────────────────┐
│   Bins Database (Current state)      │
└────────────────┬─────────────────────┘
                 │ GET /bins (for analysis)
                 ↓
┌──────────────────────────────────────┐
│   ML Prediction Service (Automatic)  │
│   ├─ Calculate fill rate             │
│   ├─ Predict overflow time           │
│   ├─ Detect anomalies                │
│   └─ Generate smart alerts           │
└────────────────┬─────────────────────┘
                 │ Store as alerts
                 ↓
┌──────────────────────────────────────┐
│   Smart Alerts DB (Reused)           │
│   - overflow_predicted               │
│   - temperature_anomaly              │
│   - battery_low_imminent             │
│   - unusual_fill_pattern             │
└────────────────┬─────────────────────┘
                 │
                 ↓
      Frontend Dashboard
     (Shows predictive alerts)
```

---

## 📊 Alert Types You Could Generate

### **1. Overflow Prediction Alert**
```json
{
  "alert_type": "overflow_predicted",
  "bin_id": "BIN-001",
  "description": "ML model predicts overflow in 2.5 hours (96% confidence). Current fill: 85%, fill rate: 6%/hour",
  "severity": "high",
  "actions": [
    "Schedule collection within 2.5 hours",
    "Increase frequency to next location",
    "Notify crew of urgent pickup"
  ]
}
```

### **2. Anomaly Alert**
```json
{
  "alert_type": "sensor_anomaly",
  "bin_id": "BIN-005",
  "description": "Temperature spike: 42°C (expected 15-25°C). Z-score: 3.5. Possible malfunction or fire hazard.",
  "severity": "high",
  "actions": [
    "Check thermal sensor",
    "Manual inspection recommended",
    "Verify no fire hazard"
  ]
}
```

### **3. Battery Warning Alert**
```json
{
  "alert_type": "battery_prediction",
  "bin_id": "BIN-012",
  "description": "Battery at 15%. ML predicts 8 hours until dead. Schedule charging/replacement.",
  "severity": "medium",
  "actions": [
    "Schedule battery replacement",
    "Plan for bin maintenance"
  ]
}
```

### **4. Unusual Pattern Alert**
```json
{
  "alert_type": "unusual_pattern",
  "bin_id": "BIN-008",
  "description": "Fill rate dropped from 8%/hour to 1%/hour. Possible sensor malfunction or area activity change.",
  "severity": "low",
  "actions": [
    "Verify sensor is working correctly",
    "Check for area maintenance"
  ]
}
```

---

## 🛠️ Implementation Architecture

### **Setup: Create an ML Alert Generator**

```python
# backend/services/ml_alert_generator.py

class MLAlertGenerator:
    """Generate alerts based on ML predictions"""
    
    def check_all_bins(self, db: Session):
        """Run periodically (every 5-10 minutes)"""
        bins = db.query(BinDB).all()
        
        for bin_db in bins:
            alerts = []
            
            # 1. Check overflow prediction
            prediction = self.predict_overflow(bin_db)
            if prediction['hours_until_full'] < 3:  # Alert if < 3 hours
                alerts.append({
                    'type': 'overflow_predicted',
                    'severity': 'high' if prediction['hours_until_full'] < 1 else 'medium',
                    'description': f"Will overflow in {prediction['hours_until_full']} hours"
                })
            
            # 2. Check for anomalies
            anomalies = self.detect_anomalies(bin_db)
            for anomaly in anomalies:
                if anomaly['z_score'] > 2.5:  # Only critical anomalies
                    alerts.append({
                        'type': 'anomaly_detected',
                        'severity': 'high',
                        'description': f"{anomaly['metric']} is abnormal"
                    })
            
            # 3. Check battery health
            if bin_db.battery_percent < 20:
                alerts.append({
                    'type': 'battery_warning',
                    'severity': 'medium',
                    'description': f"Battery at {bin_db.battery_percent}%"
                })
            
            # Store alerts in DB
            for alert in alerts:
                self.store_alert(bin_db.id, alert, db)

# Run automatically via background task
```

---

## 📅 Workflow Timeline

### **Hour 0: Normal Operation**
```
Bin fill status: 45%
Sensors reading every 30 seconds
ML tracking fill rate: 5%/hour
```

### **Hour 1: Pattern Detected**
```
Bin fill status: 50%
ML Alert Generated: "Overflow in 11 hours (Low urgency)"
Status: INFO → Dashboard shows yellow flag
```

### **Hour 6: Half Way**
```
Bin fill status: 75%
ML Alert Updated: "Overflow in 5 hours (Medium urgency)"
Status: WARNING → Dashboard shows orange flag
```

### **Hour 8: Urgent**
```
Bin fill status: 85%
ML Alert Updated: "Overflow in 3 hours (High urgency)"
Status: CRITICAL → Dashboard shows red flag
Notification sent to crew: "BIN-001 needs urgent collection"
```

### **Hour 10: Override If Needed**
```
Crew acknowledges alert and schedules pickup
ML Alert Resolved: Mark as "collection_scheduled"
Stop generating new alerts until bin is empty
```

---

## 💻 Code Example: Integration

### **Add to your predictions router:**

```python
# backend/routers/predictions.py

from services.ml_alert_generator import MLAlertGenerator

alert_generator = MLAlertGenerator()

@router.post("/check-all-bins", status_code=202)
def trigger_ml_alert_check(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Called periodically (every 5 minutes via cron or scheduler)
    Generates ML-based alerts for all bins
    """
    background_tasks.add_task(alert_generator.check_all_bins, db)
    
    return {
        "status": "Alert check started",
        "message": "ML will analyze all bins and generate alerts"
    }

@router.get("/active-alerts", response_model=List[Dict])
def get_ml_alerts(
    bin_id: Optional[str] = None,
    alert_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get alerts generated by ML model
    Same schema as CCTV alerts but ML-generated
    """
    query = db.query(AIAlertDB)
    
    if bin_id:
        query = query.filter(AIAlertDB.bin_id == bin_id)
    
    if alert_type:
        query = query.filter(AIAlertDB.alert_type == alert_type)
    
    alerts = query.order_by(AIAlertDB.timestamp.desc()).all()
    return alerts
```

---

## 🎛️ Configuration: When to Alert

```python
# backend/config.py

class MLAlertConfig(BaseSettings):
    # Overflow alerts
    OVERFLOW_ALERT_THRESHOLD_FILL = 75          # Alert when > 75% full
    OVERFLOW_ALERT_THRESHOLD_HOURS = 3          # Alert when < 3 hours to full
    
    # Temperature alerts
    TEMP_ALERT_THRESHOLD_HIGH = 35              # Alert if > 35°C
    TEMP_ALERT_THRESHOLD_LOW = 0                # Alert if < 0°C
    TEMP_ANOMALY_Z_SCORE = 2.5                  # Statistical threshold
    
    # Battery alerts
    BATTERY_ALERT_THRESHOLD = 15                # Alert when < 15%
    
    # Pattern detection
    FILL_RATE_CHANGE_THRESHOLD = 50             # Alert if rate changes > 50%
    
    # General
    ML_ALERT_CHECK_INTERVAL_MINUTES = 5         # Run check every 5 min
    ALERT_PERSISTENCE_DAYS = 7                  # Keep alerts for 7 days
```

---

## 📱 Frontend: Display ML Alerts

```typescript
// frontend/components/ml-alerts-dashboard.tsx (Same UI, new data source)

export function MLAlertsDashboard() {
  const [alerts, setAlerts] = useState<MLAlert[]>([])
  
  useEffect(() => {
    // Fetch ML-generated alerts (same endpoint, new alert_type values)
    const fetchAlerts = async () => {
      const mlAlerts = await fetch('/ai_alerts?type=ml').then(r => r.json())
      setAlerts(mlAlerts)
    }
    
    fetchAlerts()
    const interval = setInterval(fetchAlerts, 10000) // Poll every 10 sec
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="alerts-grid">
      {alerts.map(alert => (
        <AlertCard
          key={alert.id}
          type={alert.alert_type}  // "overflow_predicted", "anomaly_detected", etc.
          severity={getAlertSeverity(alert)}
          description={alert.description}
          bin_id={alert.bin_id}
          timestamp={alert.timestamp}
          onResolve={() => resolveAlert(alert.id)}
        />
      ))}
    </div>
  )
}
```

---

## ⚡ Advantages Over CCTV Alerts

| Feature | CCTV | ML Alerts |
|---------|------|-----------|
| **Data Source** | Camera footage | Existing sensors |
| **Cost** | ❌ Expensive hardware | ✅ Free (already have data) |
| **Real-time** | ✅ Immediate | ✅ Every 5 minutes |
| **Proactive** | ❌ Reactive (already happened) | ✅ Predictive (hours before) |
| **Accuracy** | ⚠️ Depends on lighting | ✅ Pure data-driven |
| **Coverage** | ❌ Only monitored bins | ✅ All bins with sensors |
| **False Positives** | High | Low (statistical) |
| **Maintenance** | ❌ Hardware problems | ✅ Software only |

---

## 📈 Example Metrics You'd Track

```json
{
  "alert_statistics": {
    "overflow_predicted": {
      "total_generated": 1245,
      "accuracy": 0.92,
      "avg_hours_before_actual": 2.3
    },
    "temperature_anomaly": {
      "total_generated": 89,
      "accuracy": 0.78,
      "false_positive_rate": 0.22
    },
    "battery_warning": {
      "total_generated": 456,
      "accuracy": 0.99,
      "avg_hours_before_dead": 8.1
    }
  },
  "top_problem_bins": [
    {"bin_id": "BIN-001", "alerts_count": 45, "avg_fill_rate": 8.2},
    {"bin_id": "BIN-005", "alerts_count": 38, "avg_fill_rate": 7.5}
  ]
}
```

---

## 🔄 Migration Path (If You Want to Try)

### **Phase 1: Setup (5 min)**
- Create `ml_alert_generator.py`
- Add alert check endpoint
- Include in main.py

### **Phase 2: Testing (30 min)**
- Run manual checks
- Verify alerts generate correctly
- Compare predictions vs actual

### **Phase 3: Automation (10 min)**
- Add background scheduler
- Run check every 5 minutes
- Start seeing alerts on dashboard

### **Phase 4: Refinement (ongoing)**
- Tune alert thresholds
- Track accuracy
- Improve ML model

---

## 🎯 Use Cases Example

### **Scenario 1: Collection Scheduling**
```
Current: Crew checks bins manually
ML Alerts: "BIN-001 will overflow at 3 PM → Schedule pickup at 2 PM"
Result: ✅ Prevent overflow, optimize route
```

### **Scenario 2: Maintenance Alerts**
```
Current: Sensor fails, data missing for days
ML Alerts: "BIN-005 temperature increased 500% → Possible fire hazard"
Result: ✅ Early detection, prevent emergency
```

### **Scenario 3: Battery Management**
```
Current: Bins go offline unexpectedly
ML Alerts: "BIN-012 battery 15% → Replace within 8 hours"
Result: ✅ Proactive maintenance, no downtime
```

### **Scenario 4: Area Analysis**
```
Current: Unknown why bin fills faster some days
ML Alerts: "BIN-008 fill rate increased 5x from 2-4 PM"
Result: ✅ Identify peak usage times, adjust truck routes
```

---

## Summary

**By converting AI Alerts → ML Alerts:**

✅ **Proactive instead of Reactive**
- Know overflow is coming BEFORE it happens
- Not after CCTV catches it

✅ **Uses Your Existing Data**
- No new sensors needed
- IoT telemetry already flowing

✅ **Continuous Intelligence**
- Runs every 5 minutes automatically
- Learns patterns over time

✅ **Actionable Insights**
- "Collect now" → "Collect in 2 hours"
- "Something wrong" → "Temperature 45°C (abnormal)"

✅ **Same UI** 
- Reuse AI alerts dashboard
- Just different alert types

---

## Questions for You

1. **Do you want to try this setup?** I can create the `ml_alert_generator.py` file
2. **What alert thresholds matter most?** (overflow time, temp range, battery %, etc.)
3. **How often should ML check?** (5 min, 10 min, real-time?)
4. **Should alerts auto-resolve?** (When bin collected, alert disappears)

Let me know and I'll implement it! 🚀
