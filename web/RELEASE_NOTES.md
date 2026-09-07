# Release Notes — v1.0.0

**Release identifier:** `v1.0.0` (`package.json`)

## Major features

- Multi-tenant foundation: auth, orgs, RBAC, admin/staff
- Campus map, cameras, monitoring alerts/events
- Incident & emergency response workflows
- Video intelligence (detections, review, evidence, privacy, wall)
- Mobile / field operations with offline sync foundations
- AI intelligence layer (copilot tools, governance hooks)
- Enterprise BI / executive KPIs and governance views
- Platform billing, audit, health/ready endpoints

## Security (Step 18)

- Payment webhooks **fail closed** without HMAC secret
- Evidence download tokens stored as hashes and **single-use**
- Stream proxy sessions bound to caller organization (IDOR fix)
- Internal event ingest hardened (no open non-prod bypass when key set)
- Audit logs gain `organizationId` + immutability hooks
- Production env validation expanded; security headers + `/health` `/ready` rewrites
- Rate-limit client IP no longer trusts spoofable `X-Forwarded-For` unless `TRUST_PROXY=true`

## Performance

- Compound indexes added for common org+status/time queries (incidents, video events, evidence)
- Pagination remains required on large list endpoints — do not remove limits

## Bug fixes

- Map export GET no longer returns false `{ ok: true }` success
- Mobile notification PATCH returns 400/404 instead of silent success
- Health error messages no longer reference env file paths

## Known limitations

- Push delivery requires configured `PUSH_PROVIDER` (otherwise SKIPPED)
- Live video depends on reachable camera HTTP streams / gateway — demo mode is labeled
- Forecasts/KPIs show insufficient data when history is thin — not guarantees
- Auth rate limits are process-local (multi-instance needs Redis-backed limiter)
- Full browser matrix / device lab E2E not automated in CI
- Dependency advisories: Next transitive postcss/sharp; `xlsx` (no upstream fix) — see SECURITY_AUDIT.md
- Restore drill must be executed on customer infrastructure before claiming backup validity

## Honesty statements

This release does **not** claim 100% security, zero bugs, guaranteed emergency delivery, or guaranteed uptime.
