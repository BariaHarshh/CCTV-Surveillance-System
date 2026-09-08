# Deployment

## Pipeline

Git push → lint → typecheck → unit tests → build → staging → smoke → approval → production  

## Local build rule

**Do not run `npm run build` while `npm run dev` is running.** Both write to `.next` and will corrupt chunks (`Cannot find module './5611.js'`, `PageNotFoundError: /_document`).

```bash
# stop the process on port 3000 first, then:
npm run build          # prebuild clears .next automatically
# or:
npm run build:clean
```

After a production build, restart the app with `npm run start` (production) or `npm run dev:clean` (local UI).

## Environments

| Env | Purpose |
|-----|---------|
| development | Local with placeholders |
| staging | Pre-prod verification |
| production | Live traffic |

Never use production secrets in development.

## Zero-downtime foundation

1. Deploy new version  
2. Health check `/api/health/ready`  
3. Shift traffic  
4. Monitor errors/latency  
5. Rollback app version if health fails  

Do not auto-rollback irreversible migrations.
