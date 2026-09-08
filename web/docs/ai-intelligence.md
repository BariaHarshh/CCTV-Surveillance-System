# Step 12 — AI Intelligence Layer

Adds an **AI Copilot + RAG + analytics intelligence** layer on top of Steps 1–11.

## Architecture

User → Copilot → Orchestrator → Permission check → Context → Tools / RAG → Existing APIs → Safety → Audit

## Modes

| Mode | When |
|------|------|
| `tools` | Default when `AI_PROVIDER=NONE` — real DB/API tools only, no invented stats |
| `llm` | When provider key set **and** org privacy allows external providers |
| Fallback | Provider failure → tools results + clear warning |

## Key routes

- `/ai-copilot` — conversational copilot
- `/ai/daily-briefing`, `/ai/executive-summary`, `/ai/predictive-risk`, `/ai/recommendations`
- `/admin/ai/knowledge`, `/admin/ai/privacy`
- `/super-admin/ai/models`, `/observability`, `/testing`

## Security

- Session org isolation on every tool/RAG query
- Same `can()` / role permissions as the rest of the platform
- High-impact tools require Confirm/Cancel
- Prompt injection patterns sanitized; documents never treated as system instructions
- No secrets in AI audit metadata
