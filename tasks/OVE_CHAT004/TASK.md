---
id: OVE_CHAT004
title: Add SQLite tables, repositories and full-text search for chat
area: CHAT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT001, OVE_CHAT003, OVE_DATA001, OVE_DATA002, OVE_DATA005]
soft_depends_on: [OVE_CHAT002]
provides: ["port:ConversationRepository", "port:ChatMessageRepository", "table:conversations", "table:chat_messages", "table:chat_read_state", "table:chat_messages_fts"]
needs: ["lib:sqlite-core", "port:UnitOfWork", "port:EventStore"]
owns: ["packages/application/src/ports/ConversationRepository.ts", "packages/application/src/ports/ChatMessageRepository.ts", "packages/adapters/sqlite/src/chat/**", "packages/adapters/sqlite/migrations/V202610141100__OVE_CHAT004__chat.sql"]
reads: ["packages/contracts/src/chat/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14", "SPECIFICATION 10"]
adr_refs: [23, 8]
---

# OVE_CHAT004: Add SQLite tables, repositories and full-text search for chat

## 1. Summary

Persistence for conversations, messages, read markers and FTS5 search, with gapless per-conversation sequence numbers, keyset pagination and an idempotency key that makes repeated sends harmless.

## 2. Context

Every conversation with Chief or an Agent goes to history so Chief and the Decision Register can see where a change came from (ADR 0023). SPEC 10 proposes SQLite + FTS. Telegram redelivers updates, desktop retries sends: the store must dedupe. Messages in Workspaces that get deleted are deleted with the Workspace (SPEC 10), except the global Chief conversation, whose messages of that Workspace are removed by `deleteForWorkspace`.

## 3. Scope (in)

- Ports `ConversationRepository`, `ChatMessageRepository`; SQLite adapter; migration.
- FTS5 virtual table kept in sync by triggers.
- Retention hook `deleteForWorkspace(workspaceId)`.

## 4. Out of scope

- Use cases (CHAT006 onward), read model composition (CHAT011), search ranking beyond FTS bm25 (CHAT012).

## 5. Detailed requirements

1. Tables:
   - `conversations(id PK, kind CHECK IN ('chief','agent','discussion'), workspace_id NULL, agent_id NULL, discussion_id NULL, title, created_at, last_message_at NULL, last_message_seq INTEGER NOT NULL DEFAULT 0, archived_at NULL)`, unique indexes: one chief row (`UNIQUE(kind) WHERE kind='chief'`), `UNIQUE(agent_id, workspace_id) WHERE kind='agent'`, `UNIQUE(discussion_id) WHERE kind='discussion'`; CHECK constraints tying kind to nullable columns.
   - `chat_messages(id PK, conversation_id REFERENCES conversations, seq INTEGER NOT NULL, type, author_kind, author_agent_id NULL, origin, text, parts_json, status, client_message_id NULL, channel_message_ref NULL, reply_to_id NULL, run_id NULL, task_id NULL, redacted INTEGER, truncated INTEGER, created_at, updated_at, delivered_at NULL, workspace_id NULL, UNIQUE(conversation_id, seq))`, plus `UNIQUE(origin, client_message_id) WHERE client_message_id IS NOT NULL` and `UNIQUE(channel_message_ref) WHERE channel_message_ref IS NOT NULL` (Telegram update dedupe).
   - `chat_read_state(conversation_id PK, last_read_seq INTEGER NOT NULL, updated_at)`.
   - `chat_messages_fts` (FTS5, content=`chat_messages`, columns `text`; tokenizer `unicode61 remove_diacritics 2` so Polish search without diacritics works), triggers on insert, update, delete. Only `complete` messages of type owner, chief, agent, result are indexed (not `system`, not streaming).
2. `append(message)` assigns `seq` inside the transaction: `UPDATE conversations SET last_message_seq = last_message_seq + 1 ... RETURNING last_message_seq`, then inserts. Gapless by construction. A conflict on the idempotency unique indexes returns `Result.ok({ deduplicated: true, existing })`.
3. `updateStreaming(messageId, patch)` updates `text`, `status`, `parts_json`, `updated_at` for messages in `streaming` status only (append-only afterwards: a `complete` message is immutable except `delivered_at` and `status` transitions `undelivered -> complete`). Enforced by a trigger.
4. Queries: `latest(conversationId, limit)`, `before(conversationId, seq, limit)`, `after(conversationId, seq, limit)`, `getById`, `findByClientMessageId`, `search(q, filters, limit)` returning snippets (FTS `snippet()` with max 160 chars, highlight markers replaced by structured offsets, never raw HTML), `unreadCountFor(conversationId)` using `chat_read_state`, `markRead(conversationId, seq)` (monotonic: never lowers the marker).
5. `ConversationRepository.getOrCreateAgentConversation(agentId, workspaceId, title)` is atomic (INSERT ... ON CONFLICT DO NOTHING then SELECT) so two concurrent first messages create one row.
6. Search is scoped: the query always binds a visible-workspace set `workspaceIds` supplied by the use case (never "all"); Chief-global messages are included only when the caller passes `includeChief: true`.
7. FTS query strings are sanitised: user input is converted to a quoted-phrase prefix query by `toFtsQuery(q)`; operators (`AND`, `NEAR`, `*` at unexpected places, column filters `col:`) are neutralised so user input cannot change the query structure.
8. `deleteForWorkspace(workspaceId)` removes agent conversations of the Workspace, messages tagged with that `workspace_id` in the Chief conversation, FTS rows and read state, in one transaction.
9. JSON columns validated with the contract on read; corrupt rows return `data.corrupt_row` and are skipped in listings.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

DATA `lib:sqlite-core`, `UnitOfWork`, `PageRequest`; contract schemas from CHAT001; migration naming from ARCH009.

## 8. Architecture and code placement

Ports in `packages/application/src/ports/`; adapter `packages/adapters/sqlite/src/chat/{sqlite-conversation-repository.ts,sqlite-chat-message-repository.ts,fts-query.ts,mappers.ts}`; one migration. Adapter imports ports and contracts only.

## 9. Security and safety

Text stored here may contain things the Owner pasted; secrets are redacted by the use case before append (CHAT006) and the repository asserts `redacted` is set when a redaction occurred but cannot detect secrets itself. FTS query sanitising prevents query-structure injection. Scoped search prevents leaking private Workspace conversations through a global search (VIS defence in depth). Immutability triggers protect history used for audit-like purposes (ADR 0023: every conversation goes to history).

## 10. Errors and edge cases

- Two concurrent appends: seq assigned serially by the transaction; both succeed with distinct seqs.
- Duplicate `clientMessageId`: returns the original, no new row.
- Streaming message never completed (crash): on startup a repair routine marks `streaming` rows older than 5 minutes as `failed` (function exported here, called by the CHAT009 recovery step).
- Very long text (32 000 chars) indexing: allowed; FTS handles it.
- Query with only punctuation: `chat.search_too_short`.

## 11. Acceptance criteria

- [ ] Migration applies cleanly; constraints reject kind/column mismatches.
- [ ] Concurrent appends yield gapless, unique `seq` values (stress test of 200 appends).
- [ ] Duplicate `clientMessageId` and duplicate `channelMessageRef` return `deduplicated`.
- [ ] Completed messages cannot be edited (trigger test).
- [ ] FTS finds "rabatowym" by "rabatowym", ignores diacritics ("zadanie" finds "zadaniu" by prefix), never returns messages of excluded Workspaces.
- [ ] FTS operator injection strings (`" OR x*`, `NEAR(`, `text:secret`) do not change results beyond literal matching.
- [ ] `deleteForWorkspace` removes messages, FTS rows and read markers.

## 12. Test plan

Repository contract suite on SQLite with real migrations; stress test; injection strings table. Command: `pnpm vitest run packages/adapters/sqlite/src/chat`.

## 13. Parallelization notes

Parallel with CHAT002/003. All later CHAT tasks depend on the ports. Hotspot: migrations folder only.

## 14. Open questions and assumptions

- ASSUMPTION: FTS5 `unicode61` tokenizer is sufficient for Polish and English in MVP (no stemming).
- ASSUMPTION: system messages are not indexed.
