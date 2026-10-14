# Proposal from OVE_ONB036: add a `chief_greeting` kind to `PostSystemMessage` (CHAT)

Owner of the change: the CHAT area (`usecase:PostSystemMessage`, OVE_CHAT010).

Request: add the typed kind `chief_greeting` to the closed `PostSystemMessage` kinds. Parameters: `{ workspaceName: string (max 80), docTitle?: string (max 80) }`, stored as `textKey` + `params` with an English `text` fallback, author `chief`, message type `text`, channels `['desktop']` only (never Telegram fan-out), idempotency by key supplied by the caller (`onboarding-greeting:<workspaceId>`). No free text from callers.

Reason: the first Chief greeting after the wizard (OVE_ONB036) must be Chief-authored and deduplicated; the existing kinds are all notices.

Fallback until merged: ONB036 posts kind `plan_update` with the same parts.
