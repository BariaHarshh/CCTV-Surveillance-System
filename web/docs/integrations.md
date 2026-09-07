# Integrations

Configure via `/admin/integrations` and env:

| Integration | Env |
|-------------|-----|
| Email | `EMAIL_PROVIDER`, `SMTP_*` / provider keys |
| Payments | `PAYMENT_PROVIDER`, `PAYMENT_SECRET`, `PAYMENT_WEBHOOK_SECRET` |
| AI | Org AI settings + provider keys (never returned full) |
| Webhooks | Org webhook endpoints with HMAC |
| Push | `PUSH_PROVIDER` |
| Storage | `STORAGE_URL` |

Camera adapters (RTSP/ONVIF/HTTP) remain separate from business logic.
