# 📋 Restricted Area Detection - Integration Requirements & API Contract

This document specifies the integration contract for connecting **Restricted Area Detection** with the **Risk Assessment Engine** and **Campus Security Dashboard**.

---

## 📡 Event Contract (`RestrictedAreaEvent`)

When an intrusion occurs, `RestrictedAreaProcessor.update()` returns a list of `RestrictedAreaEvent` objects in `new_events`:

```json
{
  "event_id": "RA-RESTRICTED_ZONE_A-150",
  "event_type": "zone_breach",
  "zone_name": "RESTRICTED ZONE A",
  "person_ids": [17],
  "confidence": 0.88,
  "severity": "high",
  "timestamp": 12.5,
  "camera_id": "CAM-01",
  "location": "Campus Grounds",
  "duration_seconds": 0.5,
  "metadata": {
    "foot_point": [225.0, 310.0],
    "zone_name": "RESTRICTED ZONE A"
  }
}
```

---

## 📊 Summary Output Interface

The `update()` method returns a dictionary with summary statistics for Risk Assessment:

```python
{
    "summary": {
        "total_persons": 4,
        "active_intruders_count": 1,
        "total_zones": 2,
        "has_breach": True,
        "status": "ALERT"  # 'SECURE' or 'ALERT'
    }
}
```

---

## 🔗 Risk Assessment Engine Integration

The Risk Assessment Engine can consume this telemetry as follows:

```python
from features.restricted_area import RestrictedAreaProcessor

# Inside main surveillance pipeline loop
ra_output = restricted_area_processor.update(tracked_persons, current_time=video_time)

if ra_output["summary"]["has_breach"]:
    risk_score += 40  # Escalate risk score for zone breach
```
