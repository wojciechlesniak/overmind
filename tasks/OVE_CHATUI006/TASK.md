---
id: OVE_CHATUI006
title: "Sync chat live: subscribe to chat events, resume by seq, resync on demand"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT001, OVE_CHAT009, OVE_CHAT013, OVE_CHATUI003, OVE_CHATUI004, OVE_CHATUI005, OVE_ENGINE027]
soft_depends_on: []
provides: ["lib:chat-live-sync"]
needs: ["lib:api-client-chat", "contract:ChatPushEvents", "lib:api-client-events", "event:chat.message.created", "event:chat.message.delta"]
owns: ["apps/desktop/src/features/chat/data/sync/**", "apps/desktop/src/locales/en/chat-006.json", "apps/desktop/src/locales/pl/chat-006.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 6]
---

# OVE_CHATUI006: Sync chat live: subscribe to chat events, resume by seq, resync on demand

## 1. Summary

Wires the chat push stream to the message cache and the conversation list: subscribes with `subscribeChat`, fetches message bodies by `afterSeq` when an event names a new message, applies streaming deltas, survives reconnects (`afterEventId`) and engine restarts, and runs the resync procedure when the hub says `events.resync_required`.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. Push frames are minimal on purpose (ids, seq, type, status; CHAT013 requirement 6): the UI fetches bodies from `GET .../messages?afterSeq=`. `chat.message.delta` carries only `appendedText` and `offset`, redacted at the source. ENGINE027 provides reconnect with exponential backoff, de-duplication and `onResync`. Desktop and Telegram must show the same state (SPEC 16 criterion 13): Telegram-origin messages arrive through the same events.

## 3. Scope (in)

- `useConversationSync(conversationId)`: owns the cache for one open conversation.
- `useChatListSync(workspaceId)`: updates the conversation list read model on events.
- Resync procedure and status exposure.
- Marking the conversation as read while visible (calls `markRead`).

## 4. Out of scope

- Optimistic send (CHATUI007).
- Rendering and virtualisation (CHATUI010-012).
- Approval or card status updates (CHATUI013 subscribes to approval events itself).

## 5. Detailed requirements

1. `useConversationSync(id)` loads the latest page (limit 50) then subscribes with `types:['chat.message.created','chat.message.updated','chat.message.delta','chat.conversation.read']`, `workspaceId`. Order: subscribe first (buffer), then load, then flush: no message can fall between load and subscribe (the api-client resume uses `afterEventId` after the first event id).
2. On `created` or `updated` with `seq`: if `seq <= cache.lastSeq` and it is an update, fetch the message by id (`GET /v1/chat/messages/{id}` if provided by CHAT012 `GetMessage`, else `afterSeq=seq-1&limit=1`); if `seq > lastSeq`, fetch `afterSeq=lastSeq` in pages of 100 until `hasMore=false`, applying `pageLoaded(..,'newer')`. Concurrent fetches for the same conversation are serialised (single-flight with a queued re-run).
3. On `delta`: dispatch `deltaApplied`; if the reducer sets `needsResync`, fetch the message by id once and clear the flag. Deltas are coalesced to at most one React render per animation frame (`requestAnimationFrame` batch) to keep typing smooth.
4. `onResync`: invalidate the list, re-run the latest-page load for each open conversation, keep the rendered messages until the new page arrives (no blank flash), then clear `needsResync`. Return the promise so the api-client resumes only after state is fresh.
5. Reconnect banner: expose `status: 'live'|'reconnecting'|'offline'` (from `useConnectionStatus`) and `lastSyncedAt` so the thread can show `chat:sync.reconnecting` and the composer can keep working in 'reconnecting' (send is queued by CHATUI007) but is disabled in 'offline' with a reason.
6. Mark-as-read: while the conversation is open, the tab is visible and the thread is scrolled within 48px of the bottom, call `markRead(id, cache.lastSeq)` (debounced by CHATUI004); when new messages arrive while the user is scrolled up, do not mark them read (the kit shows the new-messages jump control).
7. `chat.conversation.read` from another window updates `lastReadSeq` only.
8. `useChatListSync`: on `created` for any conversation of the Workspace, refetch the list summary (debounced 300 ms, coalesced); on `agent.state.changed` update the affected row state without refetching the list.
9. Unsubscribe on unmount and on Workspace switch; all timers cleaned.

## 6. Design notes

N/A, functionality only (a reconnect banner copy is defined in CHATUI025).

## 7. Reuse

- `useEventSubscription`, `useResource` (OVE_CHATUI003), hooks (OVE_CHATUI004), reducer (OVE_CHATUI005).

## 8. Architecture and code placement

`features/chat/data/sync/`. Orchestration layer between api-client hooks and the pure reducer; components only see the selectors. No direct `fetch` and no global stores. **i18n namespace:** this task writes its strings into its own namespace `chat-006` (files `locales/en|pl/chat-006.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-006`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Never applies a push frame as truth for text: bodies are always fetched through the authenticated API. Frames for other Workspaces or conversations are ignored by id check even though the engine already filters. Telegram-origin messages are fetched like any other and keep their origin field. No message text is logged. Resync clears nothing that could re-enable an action: approval status always comes from PERM by id (CHATUI013).

## 10. Errors and edge cases

- Push before initial load completes: buffered and flushed after load.
- Fetch by `afterSeq` fails: `needsResync` stays true, retry with backoff 1, 2, 4 s up to 3, then show a retry notice row.
- Event for a deleted conversation (Workspace deleted): list refetch removes it, view navigates to the Chief conversation.
- Engine restart: status `reconnecting`, messages stay, resume with `afterEventId`.
- Hub `events.closed token_rotated`: handled by the transport; sync only observes status.

## 11. Acceptance criteria

- [ ] A message created by another channel appears within one event round trip without a manual refresh.
- [ ] Streaming text appends smoothly and the final `updated` replaces it without duplicates.
- [ ] After `events.resync_required` the thread is correct and no message is duplicated or lost (fake hub test).
- [ ] Marking read happens only when the user can see the bottom.
- [ ] All subscriptions are released on unmount (fake client counts).

## 12. Test plan

- Vitest with fake api-client and a scripted hub (`lib:gateway-test-support` fakes): subscribe-load-flush race, gap fill, delta coalescing with fake rAF, resync, reconnect, list refresh debounce.
- Playwright scenario in CHATUI035 covers `dropConnection()` and `events.resync_required`.

## 13. Parallelization notes

Depends on three earlier tasks; start after they are merged. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: a `GetMessage` route exists (CHAT012 exports `usecase:GetMessage`, CHAT013 does not list a route for it). Fallback `afterSeq=seq-1&limit=1` is used until a `GET /v1/chat/messages/{id}` capability (`api:chat.message.get`) is provided; reported in the gap list.
