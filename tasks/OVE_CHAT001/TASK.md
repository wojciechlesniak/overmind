---
id: OVE_CHAT001
title: Define Conversation, ChatMessage and Channel contracts with events and errors
area: CHAT
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_ARCH003, OVE_ARCH007, OVE_ARCH008]
soft_depends_on: [OVE_ARCH010]
provides: ["contract:Conversation", "contract:ChatMessage", "contract:Channel", "contract:ChatErrors", "event:chat.message.created"]
needs: ["contract:AgentRef"]
owns: ["packages/contracts/src/chat/conversation.ts", "packages/contracts/src/chat/chat-message.ts", "packages/contracts/src/chat/channel.ts", "packages/contracts/src/chat/inputs.ts", "packages/contracts/src/errors/chat.errors.ts", "packages/contracts/src/events/chat.message.created.event.ts", "packages/contracts/src/events/chat.message.updated.event.ts", "packages/contracts/src/events/chat.conversation.read.event.ts"]
reads: ["packages/contracts/src/kernel/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 14", "SPECIFICATION 16.13"]
adr_refs: [23, 6, 1]
---

# OVE_CHAT001: Define Conversation, ChatMessage and Channel contracts with events and errors

## 1. Summary

The single, shared description of conversations and messages: one Chief conversation, one direct conversation per Agent and Workspace, and Discussion entries in the list; message types for what the Owner sees in the threads of `Chief.png` and `Czat-Agent.png`; the Channel enum (desktop, Telegram) that both clients share.

## 2. Context

ADR 0023 replaced ADR 0001: the Owner talks to Chief and to each Agent. SPEC 5: Telegram without a mention goes to Chief, `@agent` to that Agent; desktop and Telegram show the same state (criterion 13). SPEC 14: `ChatMessage { id, channel, agentId, author, text, timestamp }`, which this task refines. The Chief thread mixes Owner messages (labelled "z Telegrama · 14:02"), plain Chief text, a per-Workspace summary table, a system/agent-to-Chief note row and an inline Approval card. The agent thread adds a binding notice, a "Plan updated" chip, a rule refusal with an Owner Rule card and a "used Skill" chip.

## 3. Scope (in)

- `Conversation`, `ConversationSummary` (list row), `ChatMessage`, `MessageAuthor`, `MessageType`, `MessageStatus`, `Channel` schemas.
- Input schemas: `SendOwnerMessageInput`, `ListMessagesQuery`, `SearchQuery`, `MarkReadInput`.
- Events `chat.message.created`, `chat.message.updated`, `chat.conversation.read`; `chat.errors.ts` catalogue.
- Structured `parts` are defined in `OVE_CHAT002` (this contract references the discriminated union by import).

## 4. Out of scope

- Storage: `OVE_CHAT004`. Routing and rules: `OVE_CHAT003`. Use cases: CHAT005 onward. Parts (cards, chips): `OVE_CHAT002`.

## 5. Detailed requirements

1. `Conversation`: `{ id: EntityId<'cnv'>, kind: 'chief'|'agent'|'discussion', workspaceId: EntityId<'ws'> | null (null only for kind chief), agentId?: AgentId (kind agent), discussionId?: EntityId<'dsc'> (kind discussion), title: string<=80, createdAt, lastMessageAt?, lastMessageSeq: int>=0, archivedAt? }`. Invariants: exactly one `chief` conversation per installation; one `agent` conversation per `(agentId, workspaceId)`; one `discussion` conversation per `discussionId` (read-only mirror created by DISC events, the Owner may post into it, SPEC 5).
2. `ConversationSummary = { conversation, lastMessagePreview: string<=140 (plain text, no markup), unreadCount: int, agentState?: AgentState, pinned?: boolean }`; the list ordering rule is in `OVE_CHAT011`.
3. `Channel = 'desktop' | 'telegram'`; messages also carry `origin: Channel | 'engine'` ("engine" for system, Chief and Agent output).
4. `MessageType = 'owner' | 'chief' | 'agent' | 'system' | 'relay' | 'result' | 'approval_card' | 'rule_refusal'`. Meaning: `owner` typed by the Owner; `chief` text by Chief; `agent` text by an Agent; `system` Overmind notices (binding notice, errors, delivery status); `relay` an "A -> Chief" note row; `result` an Agent result with Artifact references; `approval_card` an inline Approval or Access Request (parts hold the id, the decision stays in PERM); `rule_refusal` a refusal naming an Owner Rule.
5. `ChatMessage`: `{ id: EntityId<'msg'>, conversationId, seq: int (monotonic per conversation, gapless), type, author: { kind: 'owner' } | { kind: 'chief' } | { kind: 'agent', agentId } | { kind: 'system' }, origin, text: string, parts: MessagePart[] (max 8), status: 'pending'|'streaming'|'complete'|'failed'|'undelivered', clientMessageId?: string<=64, replyToId?, createdAt, updatedAt, redacted: boolean, truncated: boolean, deliveredAt?, runId?, taskId? }`.
6. Size limits (contract level): owner `text` max 8000 characters, Chief and Agent `text` max 32000 (longer output is truncated with `truncated: true` and the rest stored as an Artifact reference part), `parts` max 8, each part bounded by its own schema.
7. `SendOwnerMessageInput = { conversationId?: ..., target?: { kind: 'chief' } | { kind: 'agent', agentRef: string (id or @name) }, workspaceId?: EntityId<'ws'>, text: string (1..8000), channel: Channel, clientMessageId: string (ULID, required), channelMessageRef?: string (Telegram update id; telegram only) }`. Either `conversationId` or `target` is required.
8. `ListMessagesQuery = { conversationId, beforeSeq?: int, afterSeq?: int, limit: 1..100 default 50 }` (exactly one of before/after, or neither for the latest page).
9. `SearchQuery = { q: string 2..200, conversationId?, workspaceId?, types?: MessageType[], limit: 1..50 }`.
10. Errors (`chat.*`): `conversation_not_found` 404, `message_too_large` 413, `empty_message` 422, `unknown_mention` 422 (details: the mention text, max 40 chars), `ambiguous_mention` 409, `agent_not_in_workspace` 403, `channel_not_allowed` 403, `duplicate_channel_message` 200-class marker (not an error response; use `ok` with `deduplicated: true`), `delivery_blocked` 409 (reason enum), `rate_limited` 429, `search_too_short` 422.
11. Events: `chat.message.created` and `chat.message.updated` (`persisted: true`, payload `{ conversationId, messageId, seq, type, authorKind, status }`, no text; clients fetch text by id), `chat.conversation.read` (payload `{ conversationId, lastReadSeq }`). Streaming deltas are a separate ephemeral event defined in `OVE_CHAT009`.

## 6. Design notes

N/A, functionality only. (Mock-to-type map: Owner bubble with "z Telegrama" = `origin: telegram`; plain Chief text = `type: chief`; workspace summary table = part `workspace_summary`; "QA -> Chief" row = `type: relay`; "Zgoda" card = `approval_card`; rule card = `rule_refusal` with part `owner_rule_ref`; chips = parts.)

## 7. Reuse

`EntityId`, `Result`, `defineErrors`, `defineEvent`; `AgentRef`, `AgentState` from AGENT001; `MessagePart` from CHAT002.

## 8. Architecture and code placement

`packages/contracts/src/chat/*.ts`, events one file per type, errors in `chat.errors.ts`. Pure schemas, depend only on zod and kernel.

## 9. Security and safety

Message text is untrusted content for model and UI purposes: `text` is plain text or restricted Markdown (rendering sanitised by the UI tasks, SR-35). `channelMessageRef` is the dedupe key for forged or replayed Telegram updates (OVE_CHAT007). Event payloads carry ids only. `origin` is set by the engine from the authenticated channel, never from the request body, so a client cannot claim to be Telegram or the engine (the input schema contains `channel` only for the adapter-authenticated path, see CHAT006).

## 10. Errors and edge cases

- Message with `target.kind = 'agent'` and no workspace: derived from the active Workspace by the caller; `agent_not_in_workspace` if the Agent is not visible there.
- Empty text after trimming: `empty_message`.
- Text with only control characters: treated as empty after sanitising.
- `lastMessageSeq` and `seq` never decrease; gaps are a bug and covered by a repository test (CHAT004).
- Unknown `MessageType` from a newer engine: client renders as `system`.

## 11. Acceptance criteria

- [ ] All schemas parse the fixtures derived from the two mock threads (Chief and QA).
- [ ] `SendOwnerMessageInput` without `clientMessageId` fails.
- [ ] A Chief conversation with `workspaceId` set fails; an agent conversation with null workspace fails.
- [ ] Error registry and event registry tests pass.
- [ ] Generated JSON Schemas snapshot committed; additive-only check passes.

## 12. Test plan

Contract tests with valid/invalid tables; fixtures `packages/contracts/src/chat/__fixtures__/chief-thread.json` and `qa-thread.json` (mock content in English translations); type tests. Command: `pnpm vitest run packages/contracts/src/chat`.

## 13. Parallelization notes

Merge first in CHAT; CHAT002, 003, 004 can then run in parallel. UI areas (CHATUI) code against these schemas. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: one agent conversation per `(agentId, workspaceId)` (the list is per Workspace in the mock); Chief conversation is global.
- ASSUMPTION: Discussion conversation is a mirror created from DISC events; the message source of truth for Discussions stays in DISC.
