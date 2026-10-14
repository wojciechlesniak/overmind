---
id: OVE_CHATUI032
title: "Assemble the Agent chat route with list, column, terminal panel and all view states"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI021, OVE_CHATUI022, OVE_CHATUI026, OVE_CHATUI027, OVE_CHATUI028, OVE_CHATUI029, OVE_CHATUI030, OVE_CHATUI031, OVE_DS044, OVE_PAUSE012, OVE_SHELL011]
soft_depends_on: []
provides: ["ui:AgentChatRoute"]
needs: ["ui:PageLayout", "ui:SidePanel", "lib:use-pause-guard", "lib:active-workspace"]
owns: ["apps/desktop/src/features/chat/routes/AgentChatRoute.tsx", "apps/desktop/src/features/chat/routes/agent/**", "apps/desktop/src/locales/en/chat-032.json", "apps/desktop/src/locales/pl/chat-032.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12"]
adr_refs: [23, 26]
---

# OVE_CHATUI032: Assemble the Agent chat route with list, column, terminal panel and all view states

## 1. Summary

Replaces the Agent chat placeholder with the real view: conversation list (Chief row plain, Agent row selected), the Agent column with header, thread and composer, and the 340px terminal panel, with loading, not-found, archived, not-running, offline and paused states.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. Route `/chief/agent/:agentId`; the Chief rail item stays active. The layout is list 270 / chat 758 / terminal 340 (VIEWS section 5).

## 3. Scope (in)

- `AgentChatRoute` composition and states.
- Thread wiring for the Agent conversation (reuse CHATUI022 thread wiring with a different header).
- Region boundaries.
- Focus and title.

## 4. Out of scope

- Each region's internals.

## 5. Detailed requirements

1. Route param `agentId` validated as an Agent id (ULID); invalid -> redirect to `/chief`.
2. Layout via `ui:PageLayout`: `list` = `ChiefConversationList` (selected Agent row), `main` = `AgentChatColumn` + thread wiring + `AgentChatComposer`, `detail` = terminal panel wired with `useTerminalStream` and `useAgentControls`.
3. States: `loading` (skeletons), `notFound` (`EmptyState` `Nie znaleziono Agenta w tym Workspace` with a button to the Chief view), `archived` (read-only banner + history), `needs login` (header link and terminal hint), `Agent not running` (terminal `Terminal niedostępny`, facts show `—`), `offline` and `paused` as in CHATUI025.
4. `markRead`: opening this chat and being at the bottom marks it read (CHATUI006) and calls `MarkResultSeen` (`finished_unread` -> idle) through `api:agents.states` `result-seen` when the Owner opens a chat of a finished Agent.
5. Region error boundaries (terminal panel crash must not break chat).
6. Window below 1280: the terminal panel collapses into a toggle (`chat-agent:terminal.toggle`).
7. `document.title` `<name> · <Workspace>`; initial focus on the thread.
8. Switching Agent from the list swaps conversation without unmounting the list; terminal subscription moves to the new Agent.

## 6. Design notes

`Czat-Agent.png` is the reference for the full route. Region crops are in CHATUI026, 027, 031 (and 015 for the refusal card).

## 7. Reuse

- `ChiefThread` wiring internals (OVE_CHATUI022: export a `ConversationThread` that takes `header` slot; if the Chief task did not export it, raise a proposal rather than copying), regions (OVE_CHATUI026-031).

## 8. Architecture and code placement

`features/chat/routes/`: composition only. **i18n namespace:** this task writes its strings into its own namespace `chat-032` (files `locales/en|pl/chat-032.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-032`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Route params are validated; an Agent of another Workspace is not found (engine); the terminal is read-only; all fail-closed states are worded.

## 10. Errors and edge cases

- Agent deleted while open: notFound state.
- Terminal panel crash: boundary.
- Switching quickly between Agents: stale responses ignored via ids.
- Isolated Workspace Agent: normal.

## 11. Acceptance criteria

- [ ] The route renders all regions with live data in the `busy-day` scenario.
- [ ] Not-found, archived, not-running, offline and paused states exist and are worded.
- [ ] The terminal subscription follows the selected Agent.
- [ ] Opening a finished Agent's chat clears its `finished_unread` state.

## 12. Test plan

- Playwright: `busy-day`, `login-required`, `paused`, `offline-engine`, unknown agent id; axe; whole-page visual comparison with `Czat-Agent.png`.
- Command: `pnpm --filter @overmind/desktop test:e2e features/chat`.

## 13. Parallelization notes

Hot spot: `routes/AgentChatRoute.tsx` (owned here). Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Proposal needed from CHATUI022: export a reusable `ConversationThread` (header slot) so Chief and Agent routes share it (DRY). Until merged, CHATUI022 should export it.
