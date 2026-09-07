# Troubleshooting

| Symptom | Fix |
|---------|-----|
| ECONNREFUSED 27017 | Start MongoDB |
| EADDRINUSE 3000 | Kill process on 3000 or `npm run dev:clean` |
| Internal Server Error / missing chunk | `rm -rf .next && npm run dev` |
| MFA invalid | Check clock sync; use recovery code |
| Plan limit reached | Upgrade in `/admin/billing` |

Never paste secrets into tickets.
