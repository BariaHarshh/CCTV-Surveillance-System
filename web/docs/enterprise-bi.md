# Step 17 — Enterprise Business Intelligence & Executive Intelligence

Extends existing Safety Intelligence (`analytics-service`), executive overview, reports, corrective actions, billing, and governance. **Does not duplicate** auth, incidents, cameras, AI, or audit writers.

## Surfaces

| Path | Purpose |
|------|---------|
| `/executive` | Executive Command Center (KPIs, risks, attention, forecast, copilot) |
| `/executive/alerts` | Needs-attention / decision cards |
| `/executive/actions` | Executive action queue |
| `/executive/review` | Strategic review + copilot |
| `/executive/board` | Simplified leadership view |
| `/governance` | Governance center |
| `/governance/{decisions,data,access,audit,security,ai}` | Governance modules |
| `/strategy` | Strategic initiatives |
| `/reports/executive` | → existing report pipeline |
| `/analytics/{incidents,response,teams,cameras,inspections}` | Analytics entry points |
| `/admin/platform-health` | → system readiness |
| `/admin/data-quality` | → analytics data quality |
| `/admin/executive` | Existing executive overview (still supported) |

## KPI framework

- Models: `KpiDefinition`, `KpiSnapshot`
- Engine: `src/lib/bi/kpi-engine.ts`
- Statuses: `EXCELLENT | GOOD | ATTENTION | CRITICAL | NO_DATA`
- Trends from actual period comparison only

## Honesty rules

- Safety score = **configured operational indicator**, not objective real-world safety
- Forecasts labeled **FORECAST** with confidence; unavailable when history is thin
- Policy compliance defaults to **UNKNOWN** unless verified
- Anomalies labeled **POTENTIAL ANOMALY** — not accusations
- AI executive answers cite source dashboards and never invent numbers
- Billing/cost shown only when billing architecture has data

## Architecture

```
Operational DB → Events → Analytics pipeline → Aggregations / KPIs
  → Executive insight → Decision → Task (existing) → Result → Audit
```
