# Security

## Authentication

- Passwords hashed with bcrypt (never stored or returned in plaintext)
- Session cookie `acg_session`: HttpOnly, SameSite=Lax, Secure in production
- Account lockout after repeated failures; rate limits on login / password reset
- MFA (TOTP) available for accounts that enable it
- Session revocation supported

## RBAC & data isolation

- Every tenant API must scope by `organizationId` (`orgFilter` / service layer)
- Roles: Super Admin, Org Admin, managers, staff, viewers (as configured)
- Frontend navigation hiding is **not** authorization

## Secrets

- Provided via environment / SecretManager
- Camera credentials encrypted at rest; never sent to normal clients
- Payment and internal webhooks fail closed without secrets in production

## File & evidence security

- Size/type checks on uploads where implemented
- Evidence downloads require auth, permission, and **single-use hashed tokens**
- Evidence hashes detect unexpected modification — not legal validity claims

## AI security

- Tools must obey existing authorization
- High-impact actions require human approval where configured
- Insufficient data must be stated — no fabricated incidents/KPIs/costs

## Audit

- Sensitive actions write audit records with `organizationId` when known
- Audit logs are append-only at the Mongoose layer (updates/deletes rejected)
- Org audit queries use `organizationId` (with legacy metadata fallback)

## Incident reporting (product security)

Report suspected vulnerabilities privately to the platform operator. Do not file public issues with exploit details or secrets.

## Backup & disclosure

See [docs/backup.md](docs/backup.md). Responsible disclosure: contact Super Admin / security owner; rotate affected secrets immediately.

## Headers

Production responses include CSP (conservative), HSTS, `X-Frame-Options`, `nosniff`, Referrer-Policy. Validate against Maps / Video / AI integrations after deploy.

## Known limitations

- In-memory rate limiting (multi-instance gap)
- CSRF tokens not used; cookie SameSite=Lax relies on browser protections for cookie-auth mutations
- Dependency advisories on transitive Next/postcss and `xlsx` — tracked in SECURITY_AUDIT.md
