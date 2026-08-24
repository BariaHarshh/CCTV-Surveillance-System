# 🚨 Centralized Risk Assessment Engine

**Status**: ✅ Active & Production-Ready (Unified Multi-Threat Intelligence)

The **Risk Assessment Engine** serves as the central intelligence and escalation hub for AI Campus Guard, fusing real-time events from **Crowd Detection**, **Behaviour Detection**, **Abandoned Object Detection**, and **Restricted Area Detection** into an explainable 0–100 risk score, managing threat incidents, applying contextual multi-event escalations, and driving the surveillance HUD.

---

## 🏗️ Architecture Flow

```text
Crowd Feeds ────┐
Behaviour Feeds ─┼──> Event Normalizer ──> Incident Manager ──> Risk Calculator (0-100) ──> Risk Classifier ──> Unified HUD
Abandoned Feeds ─┤   (Adapters / Floats)  (Cluster/Correlate)   (Multi-Event Escalation)    (LOW/MED/HIGH/CRIT)
Restricted Feeds ┘
```

---

## 📊 Risk Classification Tiers

| Tier | Risk Score Range | Operational Status | Default Action |
| :---: | :---: | :---: | :--- |
| **LOW** | `0 – 24` | `NORMAL` | Passive CCTV logging and continuous monitoring. |
| **MEDIUM** | `25 – 49` | `ATTENTION` | Visible warning on HUD; tracking area activity. |
| **HIGH** | `50 – 74` | `WARNING` | Important alert; on-duty floor warden alerted. |
| **CRITICAL** | `75 – 100` | `EMERGENCY` | Full emergency escalation; automated campus security patrol dispatch. |

---

## ⚡ Contextual Multi-Event Escalation Rules

| Escalation Rule | Required Events | Bonus Points | Rationale |
| :--- | :--- | :---: | :--- |
| **`crowd_plus_violent_activity`** | Crowd Detected + Fight/Violence | `+15` | Violence in dense crowd risks mass hysteria/stampede. |
| **`restricted_plus_aggression`** | Restricted Zone Breach + Aggression | `+20` | Hostile intent during unauthorized access. |
| **`restricted_plus_violent`** | Restricted Zone Breach + Violence | `+25` | Critical security breach involving physical assault. |
| **`restricted_plus_abandoned_luggage`** | Restricted Zone Breach + Unattended Bag | `+20` | Potential explosive/hazard placed in secure zone. |
| **`crowd_plus_fall`** | Crowd Detected + Fall | `+10` | Stampede/trampling hazard in high-density area. |

---

## 🚀 How to Run

### Central Risk Assessment Dashboard
```powershell
python app/run_risk_assessment.py --video videos/stock/sample.mp4 --ui-mode demo
```

### Live Webcam Mode
```powershell
python app/run_risk_assessment.py --video 0 --ui-mode demo
```

### Main Application Multi-Feature Launcher
```powershell
python app/main.py --feature risk
python app/main.py --feature crowd
python app/main.py --feature behavior
python app/main.py --feature abandoned
python app/main.py --feature restricted
```

### Automated Unit Test Suite
```powershell
python tests/test_risk_assessment.py
```
