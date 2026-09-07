# Operations Runbook

## Service outage

1. Check `/health` and `/ready`  
2. Check process / container logs (`server.ts`, Next errors)  
3. Verify MongoDB connectivity  
4. If only UI broken, restart app after confirming DB healthy  
5. Escalate if RTO budget at risk  

## Database failure

1. Confirm from `/ready` (503) and DB metrics  
2. Failover to replica if configured  
3. If restore needed: use last verified backup in **non-prod first** when possible  
4. Record RPO impact (data since last backup may be lost)  

**Suggested targets (adjust to your infra):** RPO ≤ 24h daily backups; RTO ≤ 4h for single-node restore. Measure actuals in restore drills.

## Notification failure

1. Check provider env (`EMAIL_PROVIDER`, `PUSH_PROVIDER`)  
2. Confirm statuses show Failed/Skipped — never mark Delivered without provider proof  
3. Retry queued jobs; inspect job error logs  

## AI failure

1. If `AI_PROVIDER=NONE`, tools-only mode is expected  
2. Provider errors should surface as unavailable — do not invent answers  
3. Disable agent automations via feature flags if runaway behavior  

## Video failure

1. Camera offline events should surface honestly  
2. Stream proxy requires org-bound session — 404 if unauthorized/expired  
3. Do not expose camera credentials in logs  

## Storage failure

1. Evidence writes may mark recording unavailable  
2. Preserve legal holds; do not purge protected objects  

## Emergency system issue

1. Prefer fail-safe: keep existing emergency visible; avoid duplicate activations without operator review  
2. Use alternate channels (phone tree) if app notifications fail  
3. After restore, run after-action review  

## Backup restore drill

| Field | Record |
|-------|--------|
| Start | |
| Backup ID / timestamp | |
| Environment | staging |
| Result | success / fail |
| Issues | |
| Recovery time | |

A backup is **not** considered valid until this drill succeeds.
