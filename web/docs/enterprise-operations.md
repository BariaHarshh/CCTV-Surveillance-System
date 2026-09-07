# Enterprise operations (Step 13)

## Layout

Enterprise control sits above campus ops:

1. **Event bus** (`publishEnterpriseEvent`) — durable, secret-free events; fans out to workflow jobs.
2. **Policy engine** — deterministic ALLOW / DENY / REQUIRE_APPROVAL; DENY always wins; AI never authorizes.
3. **Workflow engine** — automations run only when ACTIVE; forbidden actions are hard-blocked; dry-run sandbox available.
4. **Approvals** — human gate for high-impact / AI / automation requests.
5. **Agents** — registry + kill switch + tool execution gated by policy → approval → audit.
6. **Jobs / DLQ** — background WORKFLOW_EVENT processing with retry and dead-letter retry.
7. **Health / readiness / services** — real counts and config probes (no invented stats).

## Org APIs

Under `/api/enterprise/*` — `organizationId` always from session (`requireOrgMember`). Create paths audit `AUTOMATION_CREATED` / `POLICY_CREATED`.

## Super-admin APIs

Under `/api/super-admin/ai-agents*`, `ai-governance`, `system/jobs`, `services`, `incidents/postmortems`.

## Safety invariants

- No autonomous high-impact writes enabled by default.
- Integration health returns CONNECTED / NOT_CONFIGURED without secrets.
- Export jobs expire in 24h.
- UI dashboards fetch live API counts only.
