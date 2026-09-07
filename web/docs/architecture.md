# AI Campus Guardian — Architecture

Multi-tenant SaaS for campus safety operations.

## Layers

1. **Auth / RBAC** — sessions, MFA, permissions, organization isolation  
2. **Campus** — buildings, rooms, cameras  
3. **Monitoring** — events, alerts, AI detection  
4. **Response** — incidents, emergencies, teams, playbooks  
5. **Intelligence** — analytics, reports, insights, corrective actions  
6. **Platform** — billing, notifications, integrations, retention, backups, health  

## Request path

Authenticate → Identify org → Check role/permission → Validate → Execute → Audit  

Organization ID for authorization always comes from the session, never from the client as a trust source.
