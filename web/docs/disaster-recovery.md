# Disaster Recovery

| Metric | Target (configure per deployment) |
|--------|-----------------------------------|
| RPO | ≤ 24h (daily backups) |
| RTO | ≤ 4h |
| Region | Primary + documented failover |
| Failover | Manual promote of restore environment |

Test restore quarterly. A backup file alone is not a successful backup.
