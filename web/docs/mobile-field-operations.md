# Step 16 — Mobile & Field Operations

Extends existing ResponseTask, ResponseTeam, Notification, Emergency, Map, Video, Audit, and job queue. **No second auth, notification, or task system.**

## Surfaces

| Path | Purpose |
|------|---------|
| `/mobile` | Field home (tasks, alerts, status, quick actions) |
| `/mobile/report` | Quick / draft incident report |
| `/mobile/map` | Map entry (Step 14) |
| `/mobile/emergency` | Emergency mode + check-ins |
| `/mobile/profile` | Status, sessions, notification prefs |
| `/tasks`, `/tasks/:id` | Task center + checklist / timeline / proof |
| `/teams`, `/teams/:id` | Response teams |
| `/field` `/supervisor` `/operations` | Role dashboards |
| `/patrol` `/inspections` `/directory` | Field modules |
| `/communication` `/announcements` | Ops messaging + announcements |
| `/analytics/operations` | Operational KPIs (not HR judgment) |
| `/notifications` | Existing notification center (extended types) |

## Mobile APIs

- `GET/PATCH/POST /api/mobile/me` — home, duty status, location sharing, check-in
- `GET/POST /api/mobile/tasks` · `POST /api/mobile/tasks/:id/actions`
- `GET/POST /api/mobile/incidents` · `GET /api/mobile/alerts` · `GET/PATCH /api/mobile/notifications`
- `GET /api/mobile/map` · `POST /api/mobile/checkins` · `GET/POST /api/mobile/sync`
- `GET/PATCH /api/mobile/teams` · `GET/POST /api/mobile/communication` · `GET/POST /api/mobile/ops`

## Honesty rules

- No fake live GPS — location only when user enables sharing; accuracy shown.
- Offline drafts labeled **Pending Sync**; conflicts never silent overwrite.
- Push without `PUSH_PROVIDER` → `SKIPPED` (never claimed delivered).
- Check-in status only from submitted actions.
- Inspection FAIL creates corrective **ResponseTask** (existing task system).
- Missed patrol checkpoint → alert for review, not automatic misconduct.
- DEMO / TEST labels for synthetic or test broadcasts.

## PWA

- `manifest.json` start_url `/mobile`
- Service worker registration from MobileShell
- Installable standalone experience on supported browsers

## Integration chain

```
Command Center → Incident/Emergency → AI+Policy → Team Assignment
  → Mobile Staff → Task → Field Action → Evidence → Supervisor
  → Resolution → Analytics → Audit
```
