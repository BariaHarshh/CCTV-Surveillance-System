# Security

- Password hashing (bcrypt)
- MFA (TOTP + recovery codes)
- Session revoke / absolute idle policies
- Rate limiting on auth endpoints (in-process; set `TRUST_PROXY` correctly at edge)
- Org isolation on tenant APIs (`orgFilter` + RBAC)
- API keys stored hashed
- Webhook HMAC signatures (**required** — unsigned payment webhooks rejected)
- Evidence cryptographic hashes + single-use download token hashes
- Append-only audit logs (`organizationId` + mutation hooks)
- Encrypted camera credentials (dedicated key required in production)
- CSP + secure headers via `next.config.ts` in production
- Secrets via SecretManager / env — never in source

## Checklist before production

HTTPS, secure cookies, MFA available, RBAC, rate limits, CSRF posture, XSS/CSP, file validation, backups **restore-tested**, monitoring, webhook/payment signature verification.

See also root [SECURITY.md](../SECURITY.md) and [SECURITY_AUDIT.md](../SECURITY_AUDIT.md).
