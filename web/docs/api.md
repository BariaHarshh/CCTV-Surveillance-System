# API Overview

Base URL: `/api`

Auth: session cookie `acg_session` (browser) or future API key (`Authorization: Bearer acg_...`).

## Health

- `GET /api/health` — basic
- `GET /api/health/live` — process alive
- `GET /api/health/ready` — dependencies ready

## Billing

- `GET /api/billing/overview`
- `GET /api/billing/plans`
- `POST /api/billing/upgrade`
- `GET /api/billing/invoices`

## Settings

- `GET/PATCH /api/settings/organization`
- `GET/PATCH /api/settings/security`
- `GET/POST /api/settings/mfa`
- `GET/POST/DELETE /api/settings/api-keys`
- `GET/POST /api/settings/webhooks`

OpenAPI stub: `docs/openapi.yaml`
