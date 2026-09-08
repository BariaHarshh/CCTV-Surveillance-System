# Staff Guide — Field & Operations

## Login

- Use the credentials provided by your organization admin
- Wrong passwords are rate-limited; repeated failures may lock the account temporarily
- Enable MFA when your organization requires it

## Tasks

- Open **Tasks** or **Mobile** (`/mobile`) for assigned work
- Accept, start, pause, complete, or reject per workflow
- Overdue tasks may escalate to supervisors

## Incidents

- View authorized incidents only
- Update status, add notes, upload evidence when permitted
- Unauthorized incident IDs return access denied — do not share URLs across organizations

## Emergency

- Emergency mode surfaces active emergencies, check-ins, and broadcasts
- Acknowledge assignments promptly
- Follow team playbooks; false alarms are resolved by authorized roles with a recorded reason

## Notifications

- In-app notifications on web and mobile shell
- Push depends on `PUSH_PROVIDER` configuration — if unset, delivery is skipped (not silently marked delivered)

## Evidence

- Upload only what policy allows
- Downloads use short-lived single-use tokens
- Hashes detect unexpected modification; they are not automatic legal proof

## Offline mode

- Assigned tasks, drafts, and queued actions may work offline in the mobile PWA
- When back online, sync runs; conflicts are handled without inventing duplicate authoritative records
- After logout or session revocation, clear sensitive local drafts per policy

## Profile

- Update profile fields allowed by your org
- Change password from settings; sessions can be revoked by admins
