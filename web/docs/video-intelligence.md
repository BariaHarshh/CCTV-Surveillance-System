# Step 15 — Advanced Video Intelligence

Enterprise video intelligence integrated into AI Campus Guardian. Extends existing cameras, events, alerts, incidents, evidence, policy, automation, map, and job queue — **not** a second camera or notification system.

## Architecture

```
Camera → Stream (secure proxy) → Frame Processor → AI Detection
  → Event Classifier → Policy Engine → Alert / Incident / Automation → Audit
```

## Surfaces

| Path | Purpose |
|------|---------|
| `/video` | Video Intelligence Center |
| `/video/cameras/:id` | Camera detail + health timeline |
| `/video/detections` | AI detection center |
| `/video/review` | Human review |
| `/video/evidence` | Evidence library |
| `/video/search` | Camera / event search |
| `/video/maintenance` | Maintenance tickets + suggestions |
| `/command/video-wall` | Control-room video wall |
| `/admin/video/ai` | Processing modes, demo mode |
| `/admin/video/inventory` | Camera inventory + bulk AI |
| `/admin/video/privacy` | Privacy zones / retention |
| `/analytics/video` | Operational analytics |
| `/super-admin/ai/models` | LLM status + CV model lifecycle |

## Honesty rules

- Never claim **Live** unless the stream is actually live.
- No cameras connected → **DEMO MODE** with **DEMO DATA** labels.
- Clip/snapshot without bytes → **Recording unavailable.** (never fabricate)
- AI language: **“AI detected…”** — confidence is not confirmation.
- Sensitive categories (person/crowd) **off by default**.
- AI must not accuse, discipline, or identify sensitive attributes automatically.
- Model deploy path: `DRAFT → TESTING → APPROVED → DEPLOYED` (no skip).

## Security

- Camera credentials: encrypted / secret refs; `select: false`; never in API responses.
- Streams via backend proxy tokens; no permanent public evidence URLs.
- Downloads: permission + time-limited token + audit.
- Legal hold foundation blocks retention cleanup for protected evidence.
- Org isolation via `orgFilter` + RBAC (`video.permissions`).

## Integration points

- **Alerts:** `CAMERA_OFFLINE` and detection rules use existing alert / event pipeline.
- **Automation:** `WORKFLOW_EVENT` / job queue types `VIDEO_*`.
- **Map:** camera detail links to map; map objects open `/video/cameras/:id`.
- **Copilot tools:** `getVideoDetections`, `summarizeCameraEvents`, `getVideoEvidence`, `searchVideoEvents` (authorization enforced).
- **Feedback:** reviews map to `EventFeedback` (CORRECT / FALSE_POSITIVE) — no auto-retrain.

## Key modules

- `src/lib/video/provider.ts` — CameraProvider (HTTP / RTSP gateway / Demo)
- `src/lib/video/pipeline.ts` — detection ingest, dedupe, cooldown, rate limits, offline
- `src/lib/video/video-service.ts` — dashboard, health score, analytics, test camera
- `src/lib/video/evidence-service.ts` — snapshots, clips, packages, share, legal hold
- `src/models/Video.ts` — VideoEvent, PrivacyZone, policies, deployments, usage
