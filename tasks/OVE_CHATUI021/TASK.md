---
id: OVE_CHATUI021
title: "Wire the conversation list: summaries, selection, unread, open Agent chat, new Agent"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_CHATUI004, OVE_CHATUI006, OVE_CHATUI017, OVE_SHELL011, OVE_SHELL027]
soft_depends_on: []
provides: ["ui:ChiefConversationList"]
needs: ["lib:active-workspace", "lib:shell-navigation", "api:agents.list", "lib:api-client-agents"]
owns: ["apps/desktop/src/features/chat/list/wiring/**", "apps/desktop/src/locales/en/chat-021.json", "apps/desktop/src/locales/pl/chat-021.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 15"]
adr_refs: [23, 28]
---

# OVE_CHATUI021: Wire the conversation list: summaries, selection, unread, open Agent chat, new Agent

## 1. Summary

Connects `ChiefConversationListView` to live data: conversations of the active Workspace (Chief, Agents visible in it, running Discussions), Agent State per row, unread badges, selection synced with the route, creating the Agent conversation on first click, and the `Nowy Agent` navigation.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. CHAT011 read model: Agents visible in the Workspace (public plus private to it) including those with no conversation yet (created on first open), ordered by state priority (`waiting_approval`, `needs_login`, `working`, `finished_unread`, `idle`), then `lastMessageAt`, then name; the UI never re-sorts. Discussions section: Discussions `running` or `waiting_for_owner` of the Workspace (max 20). Unread excludes system notices. Visibility (ADR 0028): a private Agent of another Workspace never appears.

## 3. Scope (in)

- `ChiefConversationList` container component.
- Selection from route params (`/chief`, `/chief/agent/:agentId`, `/chief/discussion/:id`).
- Open or create an Agent conversation.
- `Nowy Agent` navigation.
- Live updates of rows.

## 4. Out of scope

- The Agent creation form (AGUI).
- Search across conversations (later).

## 5. Detailed requirements

1. Data: `useConversations(workspaceId)` + `useChatListSync` (CHATUI004, 006). Row models come from the mappers; the container passes them to the view with `selectedId` derived from the route.
2. Selecting the Chief row navigates to `/chief`; an Agent row to `/chief/agent/:agentId` (the route resolves or creates the conversation: `openAgentConversation` is called by the Agent route, CHATUI032, not here, so the list stays a pure navigator); a Discussion row to `/chief/discussion/:discussionId`.
3. Unread: the badge uses `unreadCount` from the server; opening the conversation marks it read through the thread sync (CHATUI006), after which the badge clears via the `chat.conversation.read` event; the list never clears a badge optimistically on click (the thread has to be visible).
4. `Nowy Agent` calls `navigate({ to:'agents.new', from:'chat' })` (AGUI route).
5. Workspace switch: the container resets selection to the Chief row and shows loading.
6. Pause: no effect on the list (viewing is allowed); the state lines still show Agent states with the paused marker from `AgentStateView.paused` (paused Agents show `wstrzymany` word).
7. Refresh budget: the list refetches at most once per 300 ms on bursts of events (CHATUI006).
8. Keyboard: roving focus is the kit's; Enter/Space selects; the selected row scrolls into view when changed by route.
9. A deleted or archived Agent whose chat is open: the list drops it; the route shows the not-found state (CHATUI032).

## 6. Design notes

N/A beyond CHATUI017 (same visual). The list shows the data of `design.png` of CHATUI017.

## 7. Reuse

- `ChiefConversationListView` (OVE_CHATUI017), data hooks (OVE_CHATUI004, 006), mappers (OVE_CHATUI002), navigation (SHELL).

## 8. Architecture and code placement

`features/chat/list/wiring/`: container + `useListSelection(route)` pure helper. Presentational/container split keeps the view testable without data. **i18n namespace:** this task writes its strings into its own namespace `chat-021` (files `locales/en|pl/chat-021.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-021`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Visibility and Workspace scope are enforced by the engine; the container additionally ignores rows whose `workspaceId` differs from the active Workspace (defence in depth). Agent names are plain text.

## 10. Errors and edge cases

- List request fails: view `error` state with Retry; the selected conversation keeps working.
- Row for an Agent without a session: state `bezczynny`.
- Selected conversation disappears: select Chief.
- Event storm: coalesced.

## 11. Acceptance criteria

- [ ] Rows reflect Agent State changes within one event round trip.
- [ ] Unread badges clear only after the thread is visible and read.
- [ ] Selection follows route changes and back/forward.
- [ ] A Workspace switch shows only the new Workspace's Agents.
- [ ] No re-sorting happens in the UI.

## 12. Test plan

- Vitest + Testing Library with fake hooks; Playwright scenario `busy-day`: states, badge clearing, navigation, workspace switch (CHATUI035).
- Command: `pnpm --filter @overmind/desktop test features/chat/list/wiring`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: `agents.new` is a SHELL/AGUI navigation target; if absent the button is hidden by capability.
