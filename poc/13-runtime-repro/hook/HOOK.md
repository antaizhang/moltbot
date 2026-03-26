---
name: data-guardrail
description: Rewrite sensitive data in message events before downstream processing
metadata: { "openclaw": { "emoji": "🛡️", "events": ["message:received", "message:preprocessed"] } }
---

# data-guardrail hook

Mask sensitive text in inbound message events and record summary stats only.

## What it does

- Detects: phone, email, Chinese ID, API key-like tokens
- Rewrites `event.context.content` in place
- Appends a short summary message to `event.messages`

## Notes

- This is a minimal reproduction hook for local validation.
- Keep the hook first in your message processing chain.
