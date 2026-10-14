---
id: OVE_CHATUI004
title: "Add chat data hooks over the api-client: conversations, messages, send, read, card actions"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_AGENT010, OVE_CHAT013, OVE_CHATUI002, OVE_CHATUI003, OVE_SHELL011]
soft_depends_on: []
provides: ["lib:chat-data-hooks"]
needs: ["lib:api-client-chat", "api:chat.conversations", "api:chat.messages", "api:chat.send", "api:chat.read", "api:agents.states", "lib:api-client-agents", "lib:active-workspace"]
owns: ["apps/desktop/src/features/chat/data/queries/**", "apps/desktop/src/locales/en/chat-004.json", "apps/desktop/src/locales/pl/chat-004.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23, 6]
---

# OVE_CHATUI004: Add chat data hooks over the api-client: conversations, messages, send, read, card actions

## 1. Summary

Implements the typed hooks the chat views call: `useConversations`, `useMessagesPage`, `useOpenAgentConversation`, `useMarkRead`, `useCardActions` (dismiss, change rule) and `useAgentStates`. They wrap `api-client-chat` (CHAT013) with `useResource`, paging cursors and error mapping, and return view models from CHATUI002.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. Routes (CHAT013): `GET /v1/chat/conversations?workspaceId=`, `GET /v1/chat/conversations/{id}/messages?beforeSeq=&afterSeq=&limit=` (limit max 100, ascending `seq`, response `{items, hasMore, firstSeq, lastSeq, lastReadSeq}`), `POST /v1/chat/conversations/agent`, `POST /v1/chat/conversations/{id}/read`, `POST /v1/chat/messages/{id}/dismiss-card`, `POST /v1/chat/messages/{id}/change-rule`. Sending is in CHATUI007, live updates in CHATUI006.

## 3. Scope (in)

- Read hooks and mutation functions listed in the summary.
- Paging helpers (`loadOlder`, `loadNewer`).
- Mapping to view models and error mapping.

## 4. Out of scope

- Optimistic send (CHATUI007).
- Event wiring (CHATUI006).
- Cache merge (CHATUI005): this task returns pages, the cache task merges them.

## 5. Detailed requirements

1. `useConversations(workspaceId): { chief: ConversationItem, agents: ConversationItem[], discussions: ConversationItem[], attention?: string, status }` from `GET /v1/chat/conversations` plus `useAgentStates` (agent states are part of the summaries; `GET /v1/agents/states` is the fallback refresh on `agent.state.changed`). Ordering is the server's (CHAT011 requirement 1); the UI never re-sorts.
2. `fetchMessagesPage(conversationId, { beforeSeq? afterSeq? limit=50 }): Promise<Result<MessagesPage>>` returns `MessagesPage = { items: MessageView[]; hasMore: boolean; firstSeq: number; lastSeq: number; lastReadSeq: number }`. Exactly one of `beforeSeq`/`afterSeq`, never both (the client throws a typed `InvalidQuery` before sending).
3. `openAgentConversation({agentId, workspaceId}): Result<{conversationId}>` via `POST .../conversations/agent`; idempotent on the server (the first open posts the binding notice, CHAT011 requirement 7).
4. `markRead(conversationId, upToSeq)`: debounced 500 ms, monotonic (never sends a smaller seq than already sent), fire-and-forget with one retry; failures are silent (unread count simply stays).
5. `dismissCard(messageId)` and `requestRuleChange(messageId): Result<{proposalId}>`; the second returns `perm.local_only` when not on desktop (cannot happen on the desktop UI but is mapped).
6. All hooks require `workspaceId` from `lib:active-workspace`; a Workspace switch cancels in-flight requests and resets paging.
7. Every result goes through `toMessageRef` for errors; `chat.rate_limited` carries `retryAfterSeconds`.
8. No hook polls; refresh is by events (CHATUI006) or explicit `refetch`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `useResource` (OVE_CHATUI003), mappers (OVE_CHATUI002), api-client chat and agents functions (OVE_CHAT013, OVE_AGENT005, OVE_AGENT010).

## 8. Architecture and code placement

`features/chat/data/queries/`: one file per hook. UI adapter layer only; no contract schemas are redefined (import from `@overmind/contracts`). Each hook has a single responsibility (ISP); consumers import only what they need. **i18n namespace:** this task writes its strings into its own namespace `chat-004` (files `locales/en|pl/chat-004.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-004`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

`workspaceId` is always from the shell context, never from message content. History pages are only requested for conversations the list returned (the server also enforces scope and answers `chat.conversation_not_found` without leaking existence). Text is not logged.

## 10. Errors and edge cases

- `chat.conversation_not_found`: view shows the not-found state and returns to the list.
- Page request while one is in flight for the same cursor: de-duplicated.
- `hasMore=false`: `loadOlder` is a no-op.
- Response with duplicate `seq`: forwarded unchanged; the cache (CHATUI005) is responsible for de-duplication.
- Network error: `retryable` surfaced; no automatic retry loop beyond one.

## 11. Acceptance criteria

- [ ] Pages request exactly one cursor type; both set is rejected locally.
- [ ] `markRead` never decreases and is debounced (test with fake timers).
- [ ] Switching Workspace aborts in-flight requests.
- [ ] A failing history load keeps the list intact and exposes a typed error.
- [ ] Hooks return view models, never raw contract objects, to components.

## 12. Test plan

- Vitest with the in-process fake api-client: list mapping, paging both directions, markRead debounce and monotonic rule, Workspace switch abort, error mapping table for all `chat.*` codes.
- Command: `pnpm --filter @overmind/desktop test features/chat/data/queries`.

## 13. Parallelization notes

Hot spot: none (one file per hook). Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: `api:chat.conversations` already includes `agentState` and `attention` in each summary (CHAT011); if not, `useAgentStates` merges them client-side.
