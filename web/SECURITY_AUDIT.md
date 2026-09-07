# Security Audit — AI Campus Guardian v1.0.0

**Date:** 2026-08-25  
**Method:** Static review of authz paths, secret handling, webhooks, evidence, streams; unit tests for fail-closed controls.  
**No real secrets are included in this document.**

## Findings

| ID | Severity | Area | Risk | Fix | Verification |
|----|----------|------|------|-----|--------------|
| SA-01 | P0 | Payments webhook | Unsigned webhook could change org plan | Require `PAYMENT_WEBHOOK_SECRET`/`WEBHOOK_SECRET`; HMAC + timing-safe compare | `security-step18.test.ts` |
| SA-02 | P0 | Evidence download | Any unexpired grant allowed download without matching token | Store SHA-256 `tokenHash`; consume once | Code review + schema fields |
| SA-03 | P1 | Stream proxy | Session ID alone allowed cross-org proxy | Bind session to caller `organizationId` | Code review `stream-service.ts` |
| SA-04 | P1 | Internal ingest | Non-prod always allowed | Key required when set; prod always requires key | Unit tests |
| SA-05 | P1 | Audit isolation | Org scoping via metadata/actors only | First-class `organizationId` + query update | Code review |
| SA-06 | P1 | Audit integrity | Admins could theoretically update via Mongoose | Reject update/delete hooks | Schema hooks |
| SA-07 | P1 | Rate limit IP | Spoofable `X-Forwarded-For` | Gate on `TRUST_PROXY=true` | Code review |
| SA-08 | P1 | Rate limit store | In-memory only | Document single-node; Redis future | Known limitation |
| SA-09 | P2 | Health | Error text mentioned Mongo env path | Generic message | `/api/health` |
| SA-10 | P2 | Crypto key | Hardcoded fallback in all envs | Prod throws without dedicated key | `encrypt.ts` |
| SA-11 | P2 | CSRF | Cookie session without CSRF token | SameSite=Lax + document | Residual risk |
| SA-12 | P1 | Dependencies | High CVEs postcss/sharp/xlsx | Track; avoid force Next 16 | `npm audit` |

## Positive controls observed

- bcrypt password hashing
- Org-scoped services using `orgFilter` on most tenant routes
- Camera passwords `select: false` / masked in public DTOs
- Session cookie HttpOnly + Secure in production
- Login / forgot / reset rate limits present
- Production startup `assertEnvironmentOrThrow`

## Residual risk summary

Highest remaining residual risks are **multi-instance rate-limit bypass**, **dependency CVEs requiring major upgrades**, and **unproven backup restore** on customer infrastructure — not open unsigned billing webhooks or tokenless evidence downloads (fixed).

## Responsible disclosure

Report issues privately to the platform security owner. Rotate secrets if exposure is suspected.
