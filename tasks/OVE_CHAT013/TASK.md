---
id: OVE_CHAT013
title: Expose chat through gateway routes, push events and the api-client
area: CHAT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_CHAT006, OVE_CHAT009, OVE_CHAT011, OVE_CHAT012, OVE_ENGINE012, OVE_ENGINE019, OVE_SHELL006]
soft_depends_on: [OVE_CHAT010]
provides: ["api:chat.conversations", "api:chat.messages", "api:chat.send", "api:chat.read", "api:chat.search", "lib:api-client-chat", "contract:ChatPushEvents"]
needs: ["lib:route-module", "lib:gateway-auth", "lib:event-hub", "lib:api-client-core"]
owns: ["packages/gateway/src/routes/chat/**", "packages/contracts/src/chat/api/**", "packages/api-client/src/chat/**"]
reads: ["packages/application/src/chat/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 13", "SPECIFICATION 16.13"]
adr_refs: [23, 6, 5]
---

# OVE_CHAT013: Expose chat through gateway routes, push events and the api-client

## 1. Summary

The Owner-facing API for everything chat: list conversations, read history, send, mark read, search, plus the push-event subscription mapping that keeps desktop windows live, and typed `api-client` functions used by the desktop (CHATUI) and the Telegram adapter.

## 2. Context

The gateway is an authenticated owner-only local API (ARCH008/009, ENGINE). Push delivery of `chat.*` events uses the hub semantics of ARCH010 (replay by `afterEventId`, heartbeat, `events.resync_required`). Telegram does not use these HTTP routes for inbound messages (it uses `IngestChannelMessage`), but its status renderer reuses the read use cases.

## 3. Scope (in)

- Routes: `GET /v1/chat/conversations?workspaceId=`, `GET /v1/chat/conversations/{id}`, `POST /v1/chat/conversations/agent` (open or create for `{agentId, workspaceId}`), `GET /v1/chat/conversations/{id}/messages?beforeSeq=&afterSeq=&limit=`, `POST /v1/chat/messages` (send), `POST /v1/chat/conversations/{id}/read`, `GET /v1/chat/search?q=&...`, `POST /v1/chat/messages/{id}/dismiss-card` (for "Leave as is"), `POST /v1/chat/messages/{id}/change-rule` (creates the Rule proposal draft, desktop only).
- Request and response schemas in `packages/contracts/src/chat/api/`.
- Push contract `ChatPushEvents` (types `chat.message.created`, `chat.message.updated`, `chat.message.delta`, `chat.conversation.read`, `channel.status.changed`) with the mapping of event to a minimal client payload.
- api-client functions and a streaming helper `subscribeChat(handler)`.

## 4. Out of scope

- Hub transport and reconnect: ENGINE. Use case behaviour: earlier CHAT tasks. UI: CHATUI.

## 5. Detailed requirements

1. All routes `auth: 'owner'`; agent tokens are rejected. `POST /v1/chat/messages` takes `SendOwnerMessageInput` where `channel` is forced to `desktop` by the route from the authenticated session (the body field is optional and ignored if equal, rejected if different: `chat.channel_not_allowed`).
2. `clientMessageId` is mandatory on send; a second POST with the same id returns 200 with `deduplicated: true` and the original message; a first success returns 201.
3. Message payloads exclude nothing the Owner may see, but `redacted` messages never include the original; list responses embed `parts`. Response size bounded: history `limit <= 100`, total response body <= 2 MB (messages with huge text are already truncated at 32 000 characters).
4. `change-rule` is available only on `rule_refusal` messages and returns `{ proposalId }`; it returns `perm.local_only` when the session channel is not desktop.
5. Error mapping through `toErrorResponse`; `chat.rate_limited` returns 429 with `Retry-After` seconds; `chat.message_too_large` 413.
6. Push: `subscribeChat` wraps the gateway subscription with `types` filter and `workspaceId`; `chat.message.created/updated` push minimal payloads (ids, seq, type, status); clients fetch bodies via `GET .../messages?afterSeq=` (ensures one source of truth and keeps secrets out of push frames); `chat.message.delta` carries only `appendedText` and offsets (already redacted at the source).
7. Resync: when the hub signals `events.resync_required`, the client helper refetches the latest page of each open conversation and the list.
8. Idempotent retries in the client: `send` retries only with the same `clientMessageId` and only on network errors or 5xx; never on 4xx.
9. Generated JSON Schema snapshots per route (additive only).
10. The Owner's Telegram status screen reuses `ListConversations` and `GetAgentStates` through application ports, not through these routes (documented to avoid a second implementation).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Route and client infrastructure from ENGINE/ARCH008; use cases from CHAT006-012; error mapping from ARCH003.

## 8. Architecture and code placement

Routes `packages/gateway/src/routes/chat/{conversations,messages,search,cards}.route.ts` (auto-registered), schemas `packages/contracts/src/chat/api/`, client `packages/api-client/src/chat/{chat-client.ts,subscribe.ts}`.

## 9. Security and safety

Owner-only. Channel taken from the session so a desktop client cannot claim Telegram. Push frames carry ids and minimal metadata, not full text (except already-redacted deltas). Rule-change helpers are desktop-only. Body sizes and rates bounded. Message text in responses is untrusted content for the UI (sanitised rendering is CHATUI's job; documented in the contract comments).

## 10. Errors and edge cases

- Send during engine startup (not ready): 503 `gateway.unavailable`, retryable.
- Conversation id of another Workspace scope: 404.
- Client behind by more than the hub replay window: resync flow.
- Duplicate click on "Leave as is": idempotent.
- Large pasted text above the limit: 413 with the limit in details.

## 11. Acceptance criteria

- [ ] Every route has generated schemas, route tests and conformance with the contracts.
- [ ] Agent tokens get 403 on all routes.
- [ ] Send with a body channel `telegram` from a desktop session is rejected.
- [ ] Double POST with the same `clientMessageId` yields one message.
- [ ] `change-rule` fails with `perm.local_only` for non-desktop sessions and never edits a Rule.
- [ ] Push frames for created/updated messages contain no `text` field (schema test).
- [ ] Client resync refetches after `events.resync_required` (mock hub test).

## 12. Test plan

Route tests with in-process gateway; client tests with mock transport and hub; schema snapshot tests; push-frame schema test. Command: `pnpm vitest run packages/gateway/src/routes/chat packages/api-client/src/chat`.

## 13. Parallelization notes

Last in CHAT; CHATUI tasks can start against the `api/` schemas earlier (merge the schema files first). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: push frames carry no message text; clients fetch by `afterSeq` (extra request, safer logs).
- ASSUMPTION: `/v1` prefix as in AGENT005.
