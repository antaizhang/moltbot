---
name: data-guardrail
description: Guardrail instructions for sensitive-data detection and rewrite
metadata:
  {
    "openclaw":
      { "skillKey": "data-guardrail", "requires": { "config": ["hooks.internal.enabled"] } },
  }
---

# data-guardrail skill

Before any tool call or persistence action:

1. Detect sensitive text (phone/email/id/api-key-like tokens).
2. Rewrite/mask sensitive values.
3. Pass only masked text to tools and memory/session persistence.
4. Never put user-provided sensitive values into env variables.

If high-risk values are present and policy requires blocking, return a short user-safe message and stop tool execution.
