# Production Checklist — v1.0.0

Use this before promoting a build beyond staging. Check only what you have actually verified.

## Infrastructure

- [ ] HTTPS terminated at edge; HTTP redirects
- [ ] `NEXT_PUBLIC_APP_URL` is https production origin
- [ ] `TRUST_PROXY=true` only behind trusted reverse proxy
- [ ] Process supervisor / container restart policy
- [ ] `/health` and `/ready` monitored

## Database

- [ ] Production MongoDB provisioned
- [ ] Backups scheduled at infra layer
- [ ] Indexes present (org + time/status)
- [ ] Restore drill completed and recorded in RUNBOOK

## Security

- [ ] No secrets in git (`git ls-files '.env*'` only `.env.example`)
- [ ] All production secrets set (no `change-me`)
- [ ] `CAMERA_ENCRYPTION_KEY`, webhook secrets, `INTERNAL_EVENTS_API_KEY`
- [ ] Security headers verified in browser (CSP does not break maps/video)

## Authentication

- [ ] Login success / failure
- [ ] Lockout + rate limit behavior
- [ ] Logout / session revoke
- [ ] MFA path if required by policy

## Authorization

- [ ] Org A cannot read Org B incidents/cameras/evidence/tasks
- [ ] Staff denied unauthorized resource IDs (API 403/404)
- [ ] Super Admin cannot accidentally expose org data in wrong tenant UI

## AI

- [ ] `AI_PROVIDER` configured or intentionally `NONE`
- [ ] Copilot tools respect org scope
- [ ] High-impact actions require approval where configured
- [ ] Insufficient-data responses observed (no fabrication)

## Video

- [ ] Camera credentials never in network responses
- [ ] Stream session org-bound
- [ ] Evidence download single-use token works; replay fails

## Maps

- [ ] Layers respect permissions
- [ ] Export requires permission and audits

## Notifications

- [ ] In-app works
- [ ] Push SKIPPED when provider unset (not false Delivered)
- [ ] Email provider tested if enabled

## Mobile

- [ ] `/mobile` usable on phone viewport
- [ ] Offline draft + sync smoke test
- [ ] Logout clears sensitive cache per policy

## Backups

- [ ] DB backup job success alert
- [ ] Restore drill documented (start/result/RTO)

## Monitoring

- [ ] Error logging destination configured
- [ ] Alerts for `/ready` down, high 5xx, backup failure

## Testing

- [ ] `npm test` green on release commit
- [ ] `npm run typecheck` green
- [ ] `npm run build` green
- [ ] Staging E2E: login → incident → task → resolve
- [ ] Staging E2E: Super Admin → org → admin → staff

## Documentation

- [ ] README / guides / RUNBOOK reviewed by operators
- [ ] Known limitations communicated to stakeholders

## Deployment

- [ ] Staging deploy of exact artifact
- [ ] Production deploy runbook followed
- [ ] Rollback owner named

## Rollback

- [ ] Previous artifact retained
- [ ] DB restore approval path known
- [ ] Feature flag kill-switches identified

## Sign-off

| Role | Name | Date | Verdict |
|------|------|------|---------|
| Eng | | | |
| Security | | | |
| Ops | | | |

**Platform verdict (engineering):** See [FINAL_TEST_REPORT.md](FINAL_TEST_REPORT.md) — **NOT READY** for unrestricted multi-instance launch; **READY** for controlled staging / single-node pilot after checklist items above.
