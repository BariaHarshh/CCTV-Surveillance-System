# Super Admin Guide — Platform Operators

## Scope

Super Admins manage the **platform**: organizations, org admins, health, billing configuration, and platform security. Super Admin tools must not leak one organization's operational data into another tenant's UI.

## Organizations

- Create organizations
- Create organization admins
- Suspend / activate / delete organizations (destructive actions require confirmation)
- Review platform-level statistics and usage

## Platform health

- Service catalog and readiness (`/api/enterprise/readiness`, `/ready`)
- Integration health
- AI provider status (do not fabricate provider availability)

## Billing & plans

- Plan limits and feature gates
- Payment webhooks require `PAYMENT_WEBHOOK_SECRET` / `WEBHOOK_SECRET` — unsigned webhooks are rejected
- Internal payment provider is for controlled environments; production should configure real secrets

## Security & audit

- Platform audit and backup job records
- Feature flags for risky capabilities (AI, video AI, advanced analytics)
- Secret rotation via environment / SecretManager — never store secrets in the repo

## Configuration

- Required production env vars — see `.env.example` and `validateEnvironment`
- `INTERNAL_EVENTS_API_KEY` required in production for internal ingest
- `CAMERA_ENCRYPTION_KEY` required in production

## Backups

- Create backup jobs via Super Admin backups API/UI
- A backup is not valid until a **restore drill** succeeds in a non-production environment
- See [docs/backup.md](docs/backup.md) and [docs/disaster-recovery.md](docs/disaster-recovery.md)
