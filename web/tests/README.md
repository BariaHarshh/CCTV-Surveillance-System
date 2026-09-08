# Test layout for AI Campus Guardian (Step 11)

tests/
├── unit/           # Vitest unit tests (permissions, billing, MFA helpers, retention)
├── integration/    # Service + DB integration (add as coverage grows)
├── api/            # Critical HTTP status contracts
├── security/       # Org isolation, IDOR, privilege escalation
├── e2e/            # Full operational flows
├── performance/    # Latency / load experiments
└── accessibility/  # a11y checks

Run: `npm test`
