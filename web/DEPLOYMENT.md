# Deployment

## Infrastructure

- **Runtime:** Node.js + Next.js 15 custom server (`server.ts`) with Socket.IO
- **Database:** MongoDB (`MONGODB_URI`)
- **Optional:** Redis (`REDIS_URL`) for future distributed rate limits / queues
- **Storage:** Local `.data` for evidence in default setup; configure object storage for production scale
- **TLS:** Terminate HTTPS at reverse proxy / load balancer; set `NEXT_PUBLIC_APP_URL` to `https://…`
- **Proxy:** Set `TRUST_PROXY=true` only when the reverse proxy strips/forges client IP headers correctly

## Environment variables

Copy `.env.example` → production secret store. Required in production (fail closed):

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Database |
| `SESSION_SECRET` | Session signing |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token secrets |
| `CAMERA_ENCRYPTION_KEY` or `ENCRYPTION_KEY` | Camera credential crypto |
| `PAYMENT_WEBHOOK_SECRET` or `WEBHOOK_SECRET` | Payment webhook HMAC |
| `INTERNAL_EVENTS_API_KEY` | Internal ingest auth |

Never deploy with `change-me` placeholders.

## Database

1. Provision MongoDB with backups enabled  
2. Point `MONGODB_URI` at the cluster  
3. Start app once to ensure indexes (Mongoose `ensureIndexes` / first queries)  
4. Verify `/ready` returns ready  

## Domain & HTTPS

- Point DNS to load balancer  
- Force HTTPS redirect at edge  
- Secure cookies are enabled when `NODE_ENV=production`  

## Monitoring

- Liveness: `GET /health`  
- Readiness: `GET /ready`  
- Application logs via structured logging helpers  
- Alert on: process down, `/ready` 503, elevated 5xx, queue backlog, backup job failure  

## Backups

- Schedule database backups at infrastructure layer  
- Application backup jobs via Super Admin (metadata/jobs)  
- Do not casually backup secrets in plaintext  

## Deploy steps

```bash
npm ci
npm run typecheck
npm test
npm run build
# stop previous process, then:
NODE_ENV=production npm start
```

Smoke: `/health`, `/ready`, login, org-scoped dashboard.

## Staging

Deploy identical build to staging. Run E2E and isolation tests before production cutover.

## Rollback

1. **Application:** Redeploy previous container/build artifact; keep env secrets unchanged  
2. **Database:** Restore from last verified backup only after approval (see RUNBOOK)  
3. **Feature:** Disable risky flags (AI / video AI) without full rollback when possible  
4. **Config:** Revert env changes via secret manager versioning  

Do not auto-rollback irreversible data migrations.

## Known deployment limits

- Auth rate limits are **in-process** today — prefer single-node or sticky sessions until Redis-backed limits exist  
- `xlsx` / Next-bundled `postcss` advisories: see SECURITY_AUDIT.md  
