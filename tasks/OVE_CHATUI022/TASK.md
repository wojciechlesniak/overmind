---
id: OVE_CHATUI022
title: "Wire the Chief thread: history, live sync, virtualisation, cards and unread boundary"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI006, OVE_CHATUI010, OVE_CHATUI011, OVE_CHATUI012, OVE_CHATUI018, OVE_CHIEF019, OVE_SHELL011]
soft_depends_on: []
provides: ["ui:ChiefThread"]
needs: ["lib:active-workspace", "api:chief.config", "lib:api-client-chief"]
owns: ["apps/desktop/src/features/chat/thread/wiring/**", "apps/desktop/src/locales/en/chat-022.json", "apps/desktop/src/locales/pl/chat-022.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 15"]
adr_refs: [23, 6]
---

# OVE_CHATUI022: Wire the Chief thread: history, live sync, virtualisation, cards and unread boundary

## 1. Summary

Connects the static Chief column to the cache, live sync, windowing, renderer and the card slots: loads history, follows live messages, pages older history on scroll, shows the unread boundary, announces new messages accessibly and exposes the sync status.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. Desktop and Telegram messages are interleaved in the Chief conversation with their source labelled. The thread contains Owner messages, Chief text, relayed Agent notes (`QA → Chief:`), the workspace summary table, approval cards and system notices.

## 3. Scope (in)

- `ChiefThread` container (`useConversationSync` + `useWindowedThread` + `MessageRenderer`).
- Provide card slots through `CardSlots` context.
- Header data from `api:chief.config`.
- Unread boundary and scroll restore on revisit.

## 4. Out of scope

- Composer (CHATUI023).
- Route and view assembly (CHATUI025).

## 5. Detailed requirements

1. Conversation id: the Chief conversation id from `useConversations` (`kind:'chief'`).
2. Data flow: `useConversationSync(id)` -> `selectViews` -> `groupByDay` -> windowed rows -> `MessageRenderer`. `onNeedOlder` -> `loadOlder`. `onReachTop` of the kit also routes here.
3. Provide `CardSlots = { approval: ApprovalSlot, rule: RuleRefusalSlot, proposal: ProposalSlot }` via context around the thread.
4. Header subtitle: from `api:chief.config` (`providerLabel`, `modelLabel`) and the count of visible Workspaces; if the call fails show only `Chief`.
5. Unread boundary: on opening, compute `selectUnreadBoundary`; scroll to it (CHATUI010) and render the `Nowe wiadomości` divider once; after the user scrolls to the bottom the divider is removed on next mount, not live.
6. Announcements: new Owner-relevant messages (Chief text, pending Approval card) are announced through the kit log; Owner's own messages are not announced; streaming is handled by CHATUI012.
7. Scroll restore: leaving and returning to the Chief view restores the scroll position if the anchor message still exists (kept in a session Map keyed by conversation id; cleared on reload).
8. Sync status: pass `syncStatus` to the column; while `offline` hold the last data.
9. Performance: re-render only changed rows (stable keys, memoised row components); the thread must handle 5000 cached messages with at most 60 mounted rows.
10. Region attributes come from the column task.

## 6. Design notes

N/A beyond CHATUI018 (same visual, now with live data).

## 7. Reuse

- `ChiefConversationColumn` (OVE_CHATUI018), sync (OVE_CHATUI006), windowing (OVE_CHATUI010), renderer (OVE_CHATUI011, 012), card slots (OVE_CHATUI013-016).

## 8. Architecture and code placement

`features/chat/thread/wiring/`: container components and hooks only. Slot context keeps cards optional: a missing slot degrades to the default neutral card. **i18n namespace:** this task writes its strings into its own namespace `chat-022` (files `locales/en|pl/chat-022.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-022`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Cards are mounted only for typed parts. `chief.config` text (model labels) is plain text.

## 10. Errors and edge cases

- Initial load fails: error state; live subscription still attempts reconnect.
- History page fails: inline `Retry` row at the top.
- Conversation not found (Workspace deleted): navigate to Workspaces.
- Huge burst of messages: coalesced fetches (CHATUI006).
- Unread boundary message not in the first page: fetch pages until reached (max 5), else scroll to the oldest loaded.

## 11. Acceptance criteria

- [ ] Opening the Chief view shows the latest page and live messages without refresh.
- [ ] Scrolling up pages older history without jumps.
- [ ] The unread divider appears once at the right place.
- [ ] Approval cards update live and never unmount while focused.
- [ ] With 5000 messages the DOM stays small.

## 12. Test plan

- Vitest + Testing Library with fake sync; Playwright `busy-day` and `long-history` scenarios (CHATUI035, 036) including reconnect.
- Command: `pnpm --filter @overmind/desktop test features/chat/thread/wiring`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: `api:chief.config` returns `providerLabel` and `modelLabel`; fallback is the neutral header.
