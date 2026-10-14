---
id: OVE_CHATUI010
title: "Virtualise long message threads with scroll anchoring and history paging"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI005, OVE_DS032, OVE_DS046]
soft_depends_on: []
provides: ["lib:chat-thread-virtualization"]
needs: ["ui:MessageThread", "ui:Skeleton"]
owns: ["apps/desktop/src/features/chat/thread/virtual/**", "apps/desktop/src/locales/en/chat-010.json", "apps/desktop/src/locales/pl/chat-010.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15"]
adr_refs: [23]
---

# OVE_CHATUI010: Virtualise long message threads with scroll anchoring and history paging

## 1. Summary

Implements `useWindowedThread`: renders only the messages near the viewport inside the kit `MessageThread`, keeps the scroll position stable while heights change (streaming, images, expansion, history loading above), and triggers history paging at the top. The kit guarantees only 200 rows, so threads with thousands of messages need this.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. DS046 states that the kit thread does not virtualise (the feature paginates and the component must not re-render all children on scroll). The cache (CHATUI005) holds up to 1000 messages and `hasMoreOlder`. Messages have variable heights (text, cards, tables). Approval cards and the composer must never be unmounted while they hold focus or an in-flight action.

## 3. Scope (in)

- Windowing hook and spacer logic.
- Height measurement and estimate.
- Scroll anchoring on prepend and on streaming growth.
- Top-reach history paging trigger and bottom-pinned behaviour interplay with the kit thread.
- Focus safety (do not unmount the focused row).

## 4. Out of scope

- Message rendering (CHATUI011).
- Fetching pages (CHATUI004).
- The kit's new-message jump control (already in `MessageThread`).

## 5. Detailed requirements

1. Signature: `useWindowedThread({ items: {key:string; estimatedHeight:number}[]; scrollerRef; overscanPx=800 }) => { range: {start:number; end:number}; topSpacer: number; bottomSpacer: number; measure(key, el): void; scrollToKey(key, align): void }`. The renderer places two empty `div`s (`aria-hidden`, `data-spacer`) of those heights inside the `MessageThread` children around the visible rows, preserving `role='log'` semantics (screen readers read only mounted rows; the log's `aria-relevant='additions'` makes new messages announce).
2. Measurement: a `ResizeObserver` per mounted row stores real heights in a `Map`; unmeasured rows use `estimatedHeight` by kind (owner 64, text 120, table 220, approval 190, refusal 180, chip 40); cumulative offsets are stored in a prefix-sum array updated incrementally (O(log n) update via Fenwick tree or O(k) for the changed tail, whichever is simpler to prove; target <1 ms per update for 1000 items).
3. Range computation uses the scroll container `scrollTop` and `clientHeight` read inside `requestAnimationFrame` (never during React render). `overscanPx` default 800; the last 20 messages are always mounted when the thread is pinned to the bottom.
4. Prepending older messages (history paging): record the anchor row key and its offset before the data change, restore `scrollTop` so the anchor stays at the same pixel position after render (no jump). The same logic compensates height changes of rows above the viewport while the user reads.
5. Pinned-to-bottom behaviour is the kit's (within 48px stays pinned). The hook exposes `isPinned` through the kit callback and never fights it: while pinned it does not apply anchor compensation.
6. History trigger: when `range.start === 0` or `scrollTop < 400` and `hasMoreOlder` and no request is in flight, call `onNeedOlder()` once per attach (the kit's `onReachTop` is used as a second trigger); show 3 `ui:Skeleton` lines above the first row while loading; hide when `hasMoreOlder=false` and show a muted `chat:thread.startOfHistory` note.
7. Focus safety: if the document's active element is inside a row, that row stays mounted regardless of range; rows with a pending action (`approval` card in `submitting`) are pinned mounted too.
8. `scrollToKey` supports jumping to the first unread message (`selectUnreadBoundary`) when opening a conversation with unread messages: scroll so the boundary is at 25% of the viewport and show a `chat:thread.newSince` divider (DaySeparator-like row, kit `DaySeparator` with the label).
9. Find-in-page (Cmd+F) only finds mounted rows: documented limitation; the thread also offers no custom search in MVP.
10. Accessibility: when rows unmount, the log does not announce removals; `aria-setsize`/`aria-posinset` are NOT used (not a listbox). Keyboard: Tab order follows mounted rows; PageUp/PageDown scroll natively.
11. No new dependency by default: the hook is ~150 lines. If implementers prefer `@tanstack/react-virtual`, add a justification block (MIT, headless, ~5 KB) and the entry in `docs/dependencies.md`; the public hook signature above must stay the same.

## 6. Design notes

N/A, functionality only. Skeleton and divider copy: `chat:thread.loadingOlder`, `chat:thread.startOfHistory` ('Beginning of the conversation' / 'Początek rozmowy'), `chat:thread.newSince` ('New messages' / 'Nowe wiadomości').

## 7. Reuse

- `ui:MessageThread` scroll anchoring and jump control (OVE_DS046), `ui:Skeleton` (OVE_DS032), cache selectors (OVE_CHATUI005).

## 8. Architecture and code placement

`features/chat/thread/virtual/`: pure geometry module (`prefix-sums.ts`, `range.ts`, unit-testable without DOM) plus the React hook. The thread component (CHATUI022) composes it; DISCUI012 may import the geometry module through its public index. **i18n namespace:** this task writes its strings into its own namespace `chat-010` (files `locales/en|pl/chat-010.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-010`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Virtualisation must never hide security-relevant UI: a pending Approval card and any card the Owner has focus on stay mounted; an unread Approval card above the fold triggers the unread/attention indicators (kit `new messages` control and the list badge), not silence. Messages are not removed from the cache by windowing (only from the DOM).

## 10. Errors and edge cases

- Row height changes while off-screen: offsets updated lazily; no jump (anchor row logic).
- Window resize: recompute range; keep anchor.
- Zero-height row (empty text, unknown part): minimum 1px estimate so the key stays addressable.
- Huge single message (30 KB): one row, internal scrolling is not used; the message collapses (CHATUI008).
- Rapid streaming growth at the bottom: no compensation when pinned.

## 11. Acceptance criteria

- [ ] A thread with 5000 synthetic messages mounts at most ~60 rows and scrolls at 60 fps in the Playwright perf test (frame budget assertion with generous threshold).
- [ ] Prepending 50 older messages does not move the visible content by more than 1px.
- [ ] The focused row and pending approval rows never unmount.
- [ ] Opening a conversation with unread messages lands on the unread boundary.
- [ ] History loads once per reach of the top.

## 12. Test plan

- Vitest geometry tests (prefix sums, range, anchor math) with randomised height maps (seeded).
- Playwright (CHATUI036) perf and anchoring tests with 5000 messages scenario.
- Storybook story `Windowed5000`. Command: `pnpm --filter @overmind/desktop test features/chat/thread/virtual`.

## 13. Parallelization notes

Independent of rendering; can run in parallel with CHATUI008, 009 once CHATUI005 is merged. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: own implementation instead of a library (see requirement 11); revisit if variable-height edge cases cost more than a library would.
