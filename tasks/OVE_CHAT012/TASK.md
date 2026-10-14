---
id: OVE_CHAT012
title: Implement history pagination and scoped search for chat
area: CHAT
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_CHAT004, OVE_DATA010, OVE_VIS002]
soft_depends_on: [OVE_CHAT011]
provides: ["usecase:ListMessages", "usecase:SearchMessages", "usecase:GetMessage"]
needs: ["port:WorkspaceRepository", "lib:visibility-rules"]
owns: ["packages/application/src/chat/history/**"]
reads: ["packages/application/src/ports/ChatMessageRepository.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 10", "SPECIFICATION 15"]
adr_refs: [23, 14]
---

# OVE_CHAT012: Implement history pagination and scoped search for chat

## 1. Summary

Read side for threads: keyset-paginated history (latest page, older, newer) and full-text search across conversations the Owner may see, with snippets. Every conversation is kept (ADR 0023) so Chief and the Decision Register can trace where a change came from.

## 2. Context

`seq` is gapless per conversation (CHAT004), so pagination by sequence is stable even while new messages stream in. Search must not leak private Workspace content into other Workspace views, but the Owner (single user) may search globally when they explicitly choose "all Workspaces"; Chief-only memory rules do not apply to the Owner's own history.

## 3. Scope (in)

- `ListMessages(query)`, `GetMessage(id)`, `SearchMessages(query)` use cases.
- Result shaping (parts included, text for `streaming` messages included up to the current length).
- Search snippet structure `{ messageId, conversationId, seq, snippet: { text, highlights: [{start,end}] }, type, createdAt, workspaceName }`.

## 4. Out of scope

- Storage and FTS: CHAT004. Search UI: CHATUI. Searching Decisions or Memory: DEC/MEM.

## 5. Detailed requirements

1. `ListMessages`: input `ListMessagesQuery` (CHAT001). Without cursors returns the latest `limit` messages in ascending `seq` order. `beforeSeq` returns older messages (ascending order within the page), `afterSeq` newer. Response `{ items, hasMore, firstSeq, lastSeq, lastReadSeq }`. `limit` default 50, max 100.
2. A conversation outside the caller's visible scope returns `chat.conversation_not_found` (not `forbidden`, to avoid existence leaks).
3. Streaming messages are included with their current text and `status: 'streaming'`; clients merge deltas by `messageId` and `offset`.
4. `SearchMessages`: `q` 2..200 characters; filters `conversationId`, `workspaceId`, `types`; default scope = the active Workspace plus the Chief conversation filtered to that Workspace's messages; option `scope: 'all_workspaces'` is Owner-desktop-only and returns Workspace names in results. From Telegram only the current Workspace scope is allowed (ASSUMPTION).
5. Results ordered by FTS rank then recency; maximum 50; snippet max 160 characters; highlights returned as offsets, never as HTML. Messages with `redacted: true` show the redacted text.
6. Only `complete` messages of type owner, chief, agent, result are searchable; system and relay lines are not.
7. Rate limit search to 10 per minute per session to protect the database from scripted scans.
8. Search queries are never logged with their text at info level (log length and scope only), since queries may contain sensitive words.
9. Deleted Workspace content is gone (CHAT004 `deleteForWorkspace`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

CHAT004 repository methods and FTS sanitiser; visibility rules; `PageRequest` conventions of DATA where applicable (here sequence cursors, documented in the contract).

## 8. Architecture and code placement

`packages/application/src/chat/history/{list-messages.usecase.ts,search-messages.usecase.ts,get-message.usecase.ts}`. Thin use cases over ports.

## 9. Security and safety

Scope enforcement prevents cross-Workspace leakage through search; not-found instead of forbidden prevents existence probing; FTS operators neutralised (CHAT004); query text not logged; rate limit. Search results contain text already redacted at write time.

## 10. Errors and edge cases

- Both `beforeSeq` and `afterSeq`: `validation.invalid_input`.
- Cursor beyond range: empty page, `hasMore: false`.
- Query that is only stop-characters: `chat.search_too_short`.
- Large `limit`: clamped to the maximum.
- Archived conversation: readable, searchable.

## 11. Acceptance criteria

- [ ] Paging from latest backwards through 250 messages visits each exactly once in order.
- [ ] New messages arriving between page requests do not cause duplicates or gaps (seq cursor test).
- [ ] Search never returns messages from Workspaces outside the scope.
- [ ] `all_workspaces` scope is rejected for Telegram callers.
- [ ] Search injection strings behave as literals.
- [ ] Highlights offsets map to the snippet text correctly (multi-byte test with Polish characters).

## 12. Test plan

Use case tests with in-memory repository; offsets test; rate-limit test. Command: `pnpm vitest run packages/application/src/chat/history`.

## 13. Parallelization notes

Parallel with CHAT010/011. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram may search the current Workspace only.
- ASSUMPTION: snippets are plain text with offsets.
