---
id: OVE_CHATUI005
title: "Implement the message cache reducer: merge pages, deltas and updates by id and seq"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT001, OVE_CHAT013, OVE_CHATUI002]
soft_depends_on: []
provides: ["lib:chat-message-cache"]
needs: ["contract:ChatMessage", "contract:ChatPushEvents"]
owns: ["apps/desktop/src/features/chat/model/cache/**", "apps/desktop/src/locales/en/chat-005.json", "apps/desktop/src/locales/pl/chat-005.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23]
---

# OVE_CHATUI005: Implement the message cache reducer: merge pages, deltas and updates by id and seq

## 1. Summary

A pure, framework-free reducer that keeps the messages of one conversation correct under paging, live push, streaming deltas, retries and resyncs. It guarantees order by `seq`, no duplicates and gap detection, so the thread never shows a wrong or duplicated message.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. CHAT001: `seq` is monotonic and gapless per conversation; push events carry only ids and seq (`chat.message.created/updated`), bodies are fetched by `afterSeq`; streaming text arrives as `chat.message.delta { appendedText, offset }` and the stored message has `status:'streaming'` until `complete` (CHAT009). Owner messages sent from this client exist first as local optimistic entries (CHATUI007) identified by `clientMessageId`.

## 3. Scope (in)

- State shape and actions.
- Merge rules for pages (older/newer), created/updated notifications, deltas, optimistic entries.
- Gap detection and `needsResync` flag.
- Selectors.

## 4. Out of scope

- Network calls (CHATUI004, 006).
- Rendering (CHATUI011).
- Optimistic send lifecycle (CHATUI007) beyond the reducer actions it needs.

## 5. Detailed requirements

1. State: `ConversationCache = { byId: Record<MessageId, CachedMessage>; order: MessageId[] /* ascending seq, optimistic entries last */; firstSeq?: number; lastSeq?: number; hasMoreOlder: boolean; lastReadSeq: number; needsResync: boolean; streaming?: { messageId; nextOffset: number } }`. `CachedMessage = MessageView & { local?: { clientMessageId: string; state:'sending'|'failed' } }`.
2. Actions: `pageLoaded(page, direction)`, `messageUpserted(view)` (from fetch by id after an event), `deltaApplied({messageId, appendedText, offset})`, `optimisticAdded(view)`, `optimisticConfirmed(clientMessageId, serverView)`, `optimisticFailed(clientMessageId, error)`, `readAdvanced(seq)`, `resyncRequested()`, `reset()`.
3. Ordering: server messages are ordered by `seq` only. An optimistic entry has no seq and is rendered after the last server message until confirmed; confirmation replaces it in place (same React key = `clientMessageId`) so the bubble does not jump or flash.
4. De-duplication: the identity of a message is `id`; an upsert with an equal or newer `updatedAt` replaces, an older one is ignored. A server message carrying a `clientMessageId` equal to an optimistic entry confirms that entry (covers the case when the push arrives before the POST response).
5. Deltas: applied only when `offset === current text length` of the streaming message (counted in UTF-16 code units as produced by the engine); a smaller offset (duplicate) is ignored; a larger offset (gap) sets `needsResync` and the stored text is refreshed by `fetch by id`. A delta for an unknown message creates a placeholder `streaming` entry only if its `seq` fits the contiguous tail, else sets `needsResync`.
6. Gap detection: when a newer page or upsert has `seq > lastSeq + 1` and `afterSeq` fill has not run, set `needsResync`; the sync layer (CHATUI006) fetches `afterSeq=lastSeq` until contiguous, then clears the flag. Never display a hole silently: if a gap cannot be filled the thread shows a `chat:thread.gap` notice row (view model flag `gapBefore: seq`).
7. Bounds: keep at most 1000 messages in memory per conversation; when exceeding, drop the oldest beyond the window and set `hasMoreOlder=true` (the virtualised thread, CHATUI010, will page them back).
8. Selectors: `selectViews(cache)`, `selectUnreadBoundary(cache)` (first server seq > lastReadSeq), `selectLastSeq`, `selectHasGap`.
9. Pure and immutable (Immer is NOT added; use structural copies). Deterministic: no clock or randomness inside.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `MessageView` (OVE_CHATUI002).

## 8. Architecture and code placement

`features/chat/model/cache/` pure module (reducer, selectors, types). No React, no api-client imports. The hook that holds it in state belongs to CHATUI006 (sync) and CHATUI022 (thread wiring). **i18n namespace:** this task writes its strings into its own namespace `chat-005` (files `locales/en|pl/chat-005.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-005`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

The reducer never trusts ordering claims from text: only `seq` and `id` fields from validated contract objects decide order. A hostile or buggy event cannot overwrite a message with a different `conversationId` (the reducer is per conversation and rejects foreign ids). Redacted messages stay redacted: an upsert never replaces `redacted:true` text with an older unredacted copy (compare `updatedAt` and keep `redacted` sticky).

## 10. Errors and edge cases

- Duplicate delta (same offset): ignored.
- Delta after `complete`: ignored.
- Message `failed` while streaming: partial text kept, status shown (CHAT009).
- Two optimistic entries with the same clientMessageId: second ignored (guard).
- Server rejects optimistic entry: state `failed`, text preserved for retry.

## 11. Acceptance criteria

- [ ] Pages merge into strictly ascending, duplicate-free order in every interleaving of older/newer pages.
- [ ] Optimistic confirmation keeps the same key and position.
- [ ] An out-of-order delta triggers `needsResync` and never corrupts text.
- [ ] `redacted` is sticky.
- [ ] 1000-message bound keeps the newest and sets `hasMoreOlder`.

## 12. Test plan

- Vitest property-style tests (fast-check is NOT added; use seeded permutations): all orderings of 3 pages; duplicate events; delta sequences with gaps; optimistic confirm before and after push; redacted stickiness; bound trimming.
- Command: `pnpm --filter @overmind/desktop test features/chat/model/cache`.

## 13. Parallelization notes

Pure folder, no hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: delta `offset` counts UTF-16 code units (JS string length). Ask CHAT009 owner to state the unit in the contract; until then compare by `text.length`.
