# Database

MongoDB with organization-scoped collections. Prefer indexes:

- `organizationId`
- `organizationId + createdAt`
- `organizationId + status`
- `organizationId + severity`

Use connection pooling via mongoose. Production should enable TLS and least-privilege DB users.
