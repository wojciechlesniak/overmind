---
id: OVE_CHATUI007
title: "Send Owner messages optimistically with idempotency keys, retry and draft safety"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT013, OVE_CHATUI004, OVE_CHATUI005, OVE_ENGINE015, OVE_PAUSE012]
soft_depends_on: []
provides: ["lib:chat-send"]
needs: ["api:chat.send", "lib:api-client-chat", "lib:gateway-idempotency", "lib:use-pause-guard"]
owns: ["apps/desktop/src/features/chat/data/send/**", "apps/desktop/src/locales/en/chat-007.json", "apps/desktop/src/locales/pl/chat-007.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12"]
adr_refs: [23, 5]
---

# OVE_CHATUI007: Send Owner messages optimistically with idempotency keys, retry and draft safety

## 1. Summary

Implements `useSendMessage`: the Owner message appears immediately as a `sending` bubble, is posted with a ULID `clientMessageId` (also the `Idempotency-Key`), is confirmed or marked `failed` with a retry that reuses the same key, and the composer draft is cleared only after the engine accepted the message.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. CHAT013: `POST /v1/chat/messages` takes `SendOwnerMessageInput` with a mandatory `clientMessageId` (ULID); a second POST with the same id returns 200 `deduplicated:true` and the original message, a first success 201; the api-client retries only on network errors or 5xx and never on 4xx. Limits: text 1..8000 characters. The UI composer (kit `ChatComposer`) never clears its own value (DS048 requirement 4).

## 3. Scope (in)

- `useSendMessage(conversationTarget)`.
- Local validation and key generation.
- Optimistic entry lifecycle with the cache actions.
- Retry and discard.
- Draft persistence per conversation (in memory, optional session storage).

## 4. Out of scope

- The composer UI (CHATUI019, 023).
- Server delivery state after acceptance (CHATUI031 shows `delivery_notice` parts).
- Direct command refusal rendering (CHATUI015, 031).

## 5. Detailed requirements

1. `send(text): Promise<SendOutcome>` where `SendOutcome = { ok:true, message } | { ok:false, error }`. Steps: (1) trim; empty -> reject locally without a network call (`chat.empty_message` mapped text); `text.length > 8000` -> reject locally (`chat.message_too_large`); (2) `clientMessageId = ulid()` from the shared id helper (ARCH007) created once per user action; (3) dispatch `optimisticAdded` with `local.state='sending'`, author owner, origin desktop, text as typed; (4) `POST` with `Idempotency-Key = clientMessageId`; (5) on 201 or 200+deduplicated dispatch `optimisticConfirmed`; (6) on error dispatch `optimisticFailed` keeping the text.
2. `target` is either `{ conversationId }` or `{ kind:'agent', agentRef, workspaceId }` (first message in a new Agent chat); the Owner's `@name` mention inside the text is NOT parsed client-side: routing is the server's job (CHAT003).
3. Draft handling: the draft lives in `useDraft(conversationId)` (Map in memory, restored when navigating back; optionally persisted to `sessionStorage` under a key that contains only the conversation id, never the text of other conversations); it is cleared when the engine accepted the message (step 5), NOT on click. If the request fails the composer keeps the text and the failed bubble offers retry.
4. Retry: `retry(clientMessageId)` re-sends with the SAME key and text; allowed for network errors and 5xx, for `chat.rate_limited` after `retryAfterSeconds` (countdown shown by the bubble label), never for 4xx validation errors (`message_too_large`, `empty_message`, `unknown_mention`, `ambiguous_mention`, `agent_not_in_workspace`): those show the error text and a `Edit` action that moves the text back into the composer and removes the failed entry. `discard(clientMessageId)` removes a failed entry.
5. Offline/reconnecting: while status is `reconnecting` a send is queued locally in order (max 5 queued, then the composer disables with the reason `chat:send.queueFull`); on `live` they are posted sequentially preserving order, each with its own key. In `offline` sending is disabled.
6. Pause: if `usePauseGuard` is blocked, `send` refuses locally with `chat.paused` (the composer is already disabled with the reason; this is defence in depth). A server `pause.paused` error is mapped to the inline paused reason, text kept (PAUSE012 requirement 5).
7. Double submit: a re-entrancy guard (`useRef`) ignores a second `send` while one for the same draft is pending; Enter held down cannot send twice.
8. At most 1 concurrent POST per conversation (ordering guarantee); additional sends wait in the queue.
9. `delivery_blocked` (409, reason enum) is not a failure of the send: the message is stored; show it as a failed-delivery state from the server `delivery_notice` part (CHATUI031), and do not retry automatically.
10. Metrics-free; no logging of text.

## 6. Design notes

N/A, functionality only. Bubble states come from `ui:MessageBubble` (`sending` opacity .7, `failed` with retry button).

## 7. Reuse

- Cache actions (OVE_CHATUI005), id helper (OVE_ARCH007), api-client send with `Idempotency-Key` (OVE_CHAT013, OVE_ENGINE015), `usePauseGuard` (OVE_PAUSE012).

## 8. Architecture and code placement

`features/chat/data/send/` (hook, draft store, queue). Application-style logic in the UI layer, testable without React (`createSender(deps)` factory plus a thin hook). Depends on api-client abstractions only. **i18n namespace:** this task writes its strings into its own namespace `chat-007` (files `locales/en|pl/chat-007.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-007`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Idempotency: the same key is reused across retries so a duplicated delivery to an Agent CLI is impossible even if the response was lost (the engine dedupes on `clientMessageId`, CHAT006). The client never invents routing or channel fields: `channel` is forced to `desktop` by the route. Draft storage never contains secrets beyond what the Owner typed and is cleared on Workspace switch and app lock; it is not written to disk (only `sessionStorage`, optional, default off). Owner-typed text is sent verbatim; nothing is interpolated into it.

## 10. Errors and edge cases

- Response lost (network error after the server saved): retry returns 200 `deduplicated:true`, bubble becomes sent, no duplicate.
- Two tabs/windows send simultaneously: independent keys, both accepted.
- `chat.rate_limited` 429: bubble shows `Retry in N s`, auto-retry once when the countdown ends only if the user did not edit.
- `agent_not_in_workspace` / `unknown_mention`: error under the bubble with the offending mention (max 40 chars), `Edit` action.
- Text of exactly 8000 characters passes; 8001 is blocked locally with a counter (the composer shows it, DS048 requirement 8).
- IME composition: handled by the kit composer; `send` is only called with final text.

## 11. Acceptance criteria

- [ ] Sending shows the bubble immediately and it is confirmed in place without jumping.
- [ ] Network failure keeps the text and offers retry with the same key; a replayed request does not duplicate the message (fake engine test).
- [ ] 4xx validation errors never auto-retry.
- [ ] The draft is cleared only after acceptance.
- [ ] Messages sent while reconnecting are delivered in order after reconnect.
- [ ] No send is possible while Global Pause blocks the Workspace.

## 12. Test plan

- Vitest `createSender` with fake api-client: happy path, lost response + dedupe, 5xx retry, 4xx no retry, rate limit countdown (fake timers), queue ordering on reconnect, queue full, pause guard, double Enter.
- Playwright in CHATUI035: send, fail (`gateway.fail`), retry.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the queue limit during reconnect is 5 and queued messages are not persisted across app restarts (they are lost if the app closes while offline; the composer draft restore is the only persistence).
- ASSUMPTION: `sessionStorage` draft persistence is off by default (privacy); enable via a constant after Owner feedback.
