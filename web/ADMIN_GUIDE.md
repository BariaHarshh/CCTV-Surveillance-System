# Admin Guide — Organization Administrators

## Scope

Organization Admins manage **their organization only**. They cannot access other tenants or platform-wide Super Admin controls.

## Users & roles

- Create and manage staff accounts under Admin → Users / Staff
- Assign roles and permissions (RBAC is enforced server-side)
- Suspend, unlock, and reset passwords through admin flows
- Temporary passwords must be changed on first use where configured

## Teams

- Create response / operations teams
- Add or remove members
- Assign teams to incidents and emergencies

## Cameras

- Register cameras with connection settings (credentials are encrypted at rest)
- Camera passwords are **never** returned to the browser
- Test connectivity from admin camera tools
- Configure AI detection modules and privacy zones carefully

## Incidents & alerts

- Review alerts and convert/link to incidents
- Assign responders, escalate, resolve, or dismiss with reasons
- Attach evidence; downloads require permission + time-limited tokens

## Emergency

- Activate emergencies per playbook
- Broadcast, assign teams, track acknowledgements and check-ins
- Resolve or mark false alarm with who/when/reason recorded in audit

## Tasks

- Create, assign, monitor overdue/escalated work
- Staff update status from web or `/mobile`

## Reports & analytics

- Generate org-scoped reports (PDF/CSV/XLSX where enabled)
- Executive dashboards aggregate org data only
- Forecasts may show **Insufficient Data** — do not treat estimates as guarantees

## Settings & governance

- Org security policy, retention, MFA expectations
- Governance: policies, exceptions, access reviews
- Review audit logs for sensitive actions

## Important limits

- UI hiding is not authorization — APIs enforce org + role checks
- Demo/test datasets should remain labeled **DEMO DATA**
- Push notifications without `PUSH_PROVIDER` are **SKIPPED**, not delivered
