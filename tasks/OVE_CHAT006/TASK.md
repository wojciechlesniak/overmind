---
id: OVE_CHAT006
title: Implement the SendOwnerMessage pipeline (routing, redaction, idempotency, persistence)
area: CHAT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_CHAT003, OVE_CHAT004, OVE_DATA002, OVE_DATA005, OVE_DATA010, OVE_PERM010, OVE_PERM020]
soft_depends_on: [OVE_CHAT002, OVE_CHAT005]
provides: ["usecase:SendOwnerMessage", "usecase:GetOrCreateConversation"]
needs: ["usecase:ListAgents", "port:WorkspaceRepository", "lib:redaction", "port:Clock", "port:IdGenerator", "port:EventBus", "port:EventStore", "port:UnitOfWork", "usecase:AppendAudit", "port:PauseStateReader"]
owns: ["packages/application/src/chat/send-owner-message.usecase.ts", "packages/application/src/chat/get-or-create-conversation.usecase.ts", "packages/application/src/chat/chat.module-parts.ts"]
reads: ["packages/domain/src/chat/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16.2", "SPECIFICATION 16.11"]
adr_refs: [23, 6, 16]
---

# OVE_CHAT006: Implement the SendOwnerMessage pipeline (routing, redaction, idempotency, persistence)

## 1. Summary

The entry point for everything the Owner types, from the desktop composer or from Telegram: authenticate-by-channel, normalise, route to Chief, an Agent or a Discussion, redact secrets, store idempotently, publish the event, and hand over to the next stage (delivery to an Agent CLI, Chief turn, or Discussion post).

## 2. Context

SPEC 5: no mention = Chief, `@agent` = that Agent; the Owner's direct command to an Agent is binding and must reach Chief (criterion 11); the desktop has an Agent conversation per Agent. Telegram is `owner_remote` trust (SEC004): authenticated but lower authority. Secrets must not travel through chat (Telegram is not E2E encrypted, ADR 0006) and must not end up in stored history or prompts.

## 3. Scope (in)

- `SendOwnerMessage(input, caller)`; `GetOrCreateConversation(target, workspaceId)`.
- Application of `resolveRoute`, `normaliseMessageText`, redaction and limits.
- The hand-over contract to the next stage (`ChatDispatch` events), implemented by CHAT008 (agent delivery), CHIEF006 (Chief turn) and DISC (Discussion post).

## 4. Out of scope

- Delivery to the CLI: `OVE_CHAT008`. Direct-command gate and relay to Chief: `OVE_CHAT010`. Telegram dedupe plumbing: `OVE_CHAT007`.

## 5. Detailed requirements

1. Input and result: `SendOwnerMessageInput` (CHAT001) -> `Result<{ message: ChatMessage; conversation: Conversation; route: Route; deduplicated: boolean }>`. The `caller` carries `{ actor: owner, channel, trust: 'owner' | 'owner_remote' }` set by the gateway from the authenticated session; the body `channel` must equal `caller.channel` or the call fails with `chat.channel_not_allowed`.
2. Pause: Global Pause does not block typing (the Owner can still talk to Chief), but the stored message gets a system follow-up `delivery_notice(blocked, reason: 'paused')` for Agent targets, and no delivery happens until resumed (CHAT008).
3. Steps in order: (a) resolve Workspace context (explicit `workspaceId`, else the active Workspace from the session; Chief target has none), (b) load mention candidates (`ListAgents` visible in the Workspace), (c) `resolveRoute`, (d) `normaliseMessageText` and limit checks, (e) redact secrets (patterns from ARCH004 plus the Owner's declared secret references never appear); if anything is redacted, store `redacted: true` and add a system line "A secret-like value was removed from your message" (i18n `chat.secretRemoved`), (f) get or create the target conversation, (g) append the message in a unit of work together with the event row `chat.message.created`, (h) publish after commit, (i) emit the dispatch signal for the target.
4. Idempotency: same `(origin, clientMessageId)` returns the original message with `deduplicated: true` and does not dispatch again; Telegram uses `channelMessageRef` as well (CHAT007). A key reused with different text returns `validation.idempotency_conflict`.
5. Storage location: a message routed to an Agent is stored in that Agent's conversation (even when typed in the Chief conversation with `@qa`) and the response tells the client `redirectedTo: conversationId` so the UI can show "sent to QA". No copy is stored in the Chief conversation.
6. Rate limit: 20 Owner messages per minute per channel (ASSUMPTION) to protect the shared subscription limit from runaway clients; excess returns `chat.rate_limited`.
7. A message to an Agent that is not active in the Workspace (archived, not visible) is refused with `chat.agent_not_in_workspace` and stored nothing.
8. Trust: Telegram messages get `trust: 'owner_remote'` stored on the dispatch signal so downstream stages (Chief prompt assembly) label them correctly and cannot loosen constraints (SEC004 R5).
9. Audit: message sends are not audited individually; refusals due to channel mismatch or rate limiting are logged, and a changed-channel attempt is audited.
10. The use case does not call any model; it is fast (target: under 50 ms excluding database).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

CHAT003 rules, CHAT004 repositories, `ListAgents` (AGENT004), redaction (ARCH004), idempotency utilities (ARCH007 if provided), event store and bus.

## 8. Architecture and code placement

`packages/application/src/chat/*.usecase.ts`; wiring in `apps/engine/src/composition/modules/chat.module.ts` (this task creates it; later CHAT tasks add their own `chat-<topic>.module.ts`). Dispatch is an application event `chat.owner_message.routed` (ephemeral, internal) to avoid coupling to CHAT008/CHIEF.

## 9. Security and safety

Channel identity comes from the authenticated session, never from the body. Secrets are redacted before storage and before any dispatch. Telegram text is lower trust. The message text is never interpreted by this use case (no commands parsed from text other than the mention). Route resolution is conservative (unknown mention is an error). Flood protection prevents burning the subscription limit.

## 10. Errors and edge cases

- Conversation creation race: atomic upsert (CHAT004).
- Engine crash after append before dispatch: a recovery scan on start re-dispatches messages in status `pending` that have no `delivery_attempt` (handled by CHAT008); no duplicate typed input because delivery writes an attempt row first.
- Text consisting of a mention only (`@qa`): allowed, empty body after mention is treated as non-empty text.
- Message with secret only: after redaction it still has the placeholder, so it is stored as `[removed]` with `redacted: true`.
- Unknown Workspace: `data.not_found`.

## 11. Acceptance criteria

- [ ] Message without mention in Chief conversation routes to Chief; `@qa` routes to QA and is stored in QA's conversation with `redirectedTo`.
- [ ] Repeating a send with the same `clientMessageId` returns `deduplicated: true` with no second row or dispatch.
- [ ] A message containing an API-key-like string is stored redacted with the system line.
- [ ] Body `channel` different from the session channel fails.
- [ ] 21st message in one minute is rate limited.
- [ ] Unknown mention fails with `chat.unknown_mention` and stores nothing.
- [ ] Telegram caller yields dispatch trust `owner_remote`.

## 12. Test plan

Unit tests with in-memory repositories and fake clock; integration with SQLite for atomic append plus event; secret corpus test (SEC003). Command: `pnpm vitest run packages/application/src/chat/send-owner-message`.

## 13. Parallelization notes

After CHAT003/004. CHAT007, 008, 009, 010 consume the dispatch signal contract defined here (`chat.owner_message.routed`); merge that event file early. Hotspot: `chat.module.ts` (owned here).

## 14. Open questions and assumptions

- ASSUMPTION: messages are routed by the engine; a client-side conversation choice is only a hint validated by `resolveRoute`.
- ASSUMPTION: 20 messages per minute per channel.
