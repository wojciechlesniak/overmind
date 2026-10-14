---
id: OVE_CHATUI034
title: "Map chat errors to Owner-facing messages and recovery actions"
area: CHATUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_CHAT001, OVE_CHATUI003, OVE_DS037, OVE_DS040]
soft_depends_on: []
provides: ["lib:chat-error-messages"]
needs: ["contract:ChatErrors", "contract:MessageRef", "lib:i18n-ui", "ui:useToast", "ui:InfoNote"]
owns: ["apps/desktop/src/features/chat/errors/**", "apps/desktop/src/locales/en/chat-034.json", "apps/desktop/src/locales/pl/chat-034.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [17, 23]
---

# OVE_CHATUI034: Map chat errors to Owner-facing messages and recovery actions

## 1. Summary

One table that maps every `chat.*`, `perm.*`, `pause.*`, `gateway.*` error the chat views can meet to a localised message, a severity and a recovery action (retry, edit, wait, open page), so no view shows a raw error code or generic failure.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. CHAT001 error codes: `conversation_not_found`, `message_too_large`, `empty_message`, `unknown_mention`, `ambiguous_mention`, `agent_not_in_workspace`, `channel_not_allowed`, `delivery_blocked` (reason enum), `rate_limited`, `search_too_short`. PERM: `local_approval_required`, `approval_expired`, `approval_not_pending`, `owner_required`. PAUSE: `pause.paused`. Gateway: `not_ready`, `unauthenticated`, `rate_limited`, `idempotency_conflict`.

## 3. Scope (in)

- `describeError(error): { messageRef; severity:'info'|'warning'|'error'; action?: 'retry'|'edit'|'wait'|'openConnections'|'openApprovals'; retryAfterSeconds? }`.
- EN and PL texts in the `chat-errors` namespace (`chat-errors:<code>`).
- Test that every registered code has an entry.

## 4. Out of scope

- Generic `errors` namespace (ARCH011).

## 5. Detailed requirements

1. Table-driven registry `errorTable: Record<ErrorCode, Entry>`; unknown code falls back to `errors:generic.unknown` with `retryable` from the error.
2. Texts are specific and calm: `Ta wiadomość jest za długa (max 8000 znaków).`, `Nie znaleziono Agenta @{{mention}} w tym Workspace.`, `Kilku Agentów pasuje do @{{mention}}. Wybierz jednego.`, `Zbyt wiele wiadomości. Spróbuj za {{seconds}} s.`, `Wszystko wstrzymane. Wznów, aby wysyłać.`, `Zatwierdzenie wygasło.`, `Silnik nie jest gotowy. Ponawiam.`.
3. `mention` params are sanitised: max 40 chars, control characters removed, rendered as text.
4. `gateway.idempotency_conflict` with `outcome_unknown` -> action `check state` (refetch the thread) not `retry`.
5. A completeness test iterates the generated error registry (ARCH003) and fails if a `chat.*`/`perm.*`/`pause.*` code used by CHATUI is missing.

## 6. Design notes

N/A, functionality only (texts rendered by existing kit toasts and notes).

## 7. Reuse

- `renderMessage` (OVE_ARCH011), error registry (OVE_ARCH003), `useToast` (OVE_DS037).

## 8. Architecture and code placement

`features/chat/errors/`: pure registry and a thin `useChatErrors()` hook. **i18n namespace:** this task writes its strings into its own namespace `chat-034` (files `locales/en|pl/chat-034.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-034`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Error text never includes server-provided free text, message content or paths; only whitelisted params (mention, seconds). Error messages are plain text. Fail closed: unknown errors keep controls in their safe (disabled or pending) state.

## 10. Errors and edge cases

- Error without code: generic.
- Params missing: message degrades without interpolation, never prints `{{x}}`.
- Locale missing: EN fallback.

## 11. Acceptance criteria

- [ ] Every code in scope has EN and PL texts (lint).
- [ ] Unknown codes show the generic message.
- [ ] No raw code or server text appears in any chat error UI.

## 12. Test plan

- Vitest completeness and interpolation tests; `pnpm i18n:check`.
- Command: `pnpm --filter @overmind/desktop test features/chat/errors`.

## 13. Parallelization notes

Owns the `chat-errors` namespace files; other tasks only reference its keys. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the lint accepts `chat-errors` as a sub-namespace of the chat feature (same assumption as in OVE_CHATUI001).
