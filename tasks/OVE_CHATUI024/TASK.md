---
id: OVE_CHATUI024
title: "Wire the live-work panel: working Agents, mini terminal, Board counts, recent Decisions"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_AGENT010, OVE_BOARD013, OVE_CHATUI003, OVE_CHATUI009, OVE_CHATUI020, OVE_DEC011, OVE_PROV002, OVE_PROV019, OVE_PROV036, OVE_SHELL011, OVE_SHELL027]
soft_depends_on: []
provides: ["ui:ChiefLiveWorkPanel"]
needs: ["api:agents.states", "lib:api-client-agents", "api:board.progress", "lib:api-client-board", "api:decision.list", "lib:api-client-decision", "api:connections.status", "api:agents.terminal", "lib:active-workspace", "lib:shell-navigation", "contract:ProvConfig"]
owns: ["apps/desktop/src/features/chat/panel/wiring/**", "apps/desktop/src/locales/en/chat-024.json", "apps/desktop/src/locales/pl/chat-024.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15"]
adr_refs: [11, 26]
---

# OVE_CHATUI024: Wire the live-work panel: working Agents, mini terminal, Board counts, recent Decisions

## 1. Summary

Connects the right panel to data: Agents that are working or waiting (with the slots used out of the parallel limit), a sanitised excerpt of the active Agent's tests, Board lane counts, and the latest Decisions, all refreshed by events.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. Sources: `api:agents.states` (Agent State with `taskId`, `runId`, `paused`), `ProvConfig` parallel limit (default 3, `provider.concurrency_changed`), Board progress counts (`api:board.progress`), Decision list (`api:decision.list`, newest first, max 5). The mini terminal excerpt comes from the read-only terminal API (`api:agents.terminal`, see CHATUI029) and shows only the last 4 non-empty lines of the active Agent.

## 3. Scope (in)

- Container for the panel.
- Slots label from limit and active Agents.
- Excerpt subscription for at most the single most recently active Agent.
- Lane counts and Decisions loading and navigation.

## 4. Out of scope

- Terminal transport (CHATUI029): this task reuses its `useTerminalExcerpt`.
- Board and Decision views.

## 5. Detailed requirements

1. Agents list: Agents with state `working` or `waiting_approval` in this Workspace, plus Agents of other Workspaces that are working (shown with `workspaceName`; the engine returns them only if not isolated, VIS). Order: working first, then waiting, then others. `headline` = `<Agent> · <task title>`.
2. Slots: `used` = number of Agents with state `working` across the installation (as reported by `ProvConfig`/concurrency read model), `total` = parallel limit; label via i18n plural (`3 z 3 slotów`). When `used === total` and queued Agents exist, add the tooltip `chat:panel.slotsFull`.
3. Mini terminal: `useTerminalExcerpt(agentId, { lines: 4 })` for the first working Agent only (one subscription; others show no excerpt) and progress text if the CLI profile's test summary parser provides it (`progress {done,total}` is optional; if absent no bar). Lines pass through `safeTerminalLines` (type brand required by CHATUI020).
4. Lanes: `GET board progress` -> counts per lane in the order Build, QA, Review, Done (labels from the Workflow's Lane names; if the Workspace has other Lanes show the first 4 by board order); the lane with the most active Agents has `emphasis`; click navigates to the Board filtered by lane.
5. Decisions: `api:decision.list?limit=5&workspace=` -> `title`, meta `<creator> · <kind> · <time>`; click navigates to `/decisions/:id`. Isolated Workspaces: only that Workspace's Decisions are shown (server).
6. Refresh: Agent states by `agent.state.changed`; counts on `board.task.moved` events (debounced 500 ms); Decisions on `decision.recorded` events; terminal by its own stream with 1 s coalescing.
7. Visibility rule: private Agents of other Workspaces never appear (engine); the UI additionally filters `workspaceId` mismatch only for private ones it cannot name.
8. Pause: the panel keeps showing states; Agents paused show `wstrzymany`; no controls here.

## 6. Design notes

N/A beyond CHATUI020.

## 7. Reuse

- `ChiefLiveWorkPanelView` (OVE_CHATUI020), `useTerminalExcerpt` (OVE_CHATUI029), `safeTerminalLines` (OVE_CHATUI009), api-client board, decision and agents.

## 8. Architecture and code placement

`features/chat/panel/wiring/`. Depends on other areas only through their api-client modules. No cross-feature imports from BOARDUI/DECUI (navigation by route name). **i18n namespace:** this task writes its strings into its own namespace `chat-024` (files `locales/en|pl/chat-024.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-024`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. The excerpt is the only place where raw CLI output enters the Chief view; it must pass `safeTerminalLines` and the branded type. Agent State is a hint, not proof (ADR 0026): the panel labels states by words and never claims a Task is done on `done`.

## 10. Errors and edge cases

- Terminal unavailable: the card shows only the headline.
- Board API fails: tiles hidden with a retry link; the rest works.
- Parallel limit unknown: slots label shows only the used count.
- No Decisions yet: section hidden.
- Agent working in an isolated Workspace not visible to Chief: not listed.

## 11. Acceptance criteria

- [ ] The panel updates when an Agent changes state, a Task moves lane or a Decision is recorded.
- [ ] Only one terminal subscription exists regardless of the number of working Agents.
- [ ] Excerpt text passes through the sanitise + redact pipeline (secret never visible in a fuzz test).
- [ ] Lane tiles and Decision cards navigate to the right pages.
- [ ] Slots label matches the limit.

## 12. Test plan

- Vitest with fakes (agents, board, decision, terminal); secret-leak test using the SEC003 corpus on the terminal stream; Playwright `busy-day` scenario (CHATUI035).
- Command: `pnpm --filter @overmind/desktop test features/chat/panel/wiring`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Gap: no `api:agents.terminal` capability exists (see CHATUI029); until provided, the excerpt is hidden.
- ASSUMPTION: event names `board.task.moved` and `decision.recorded` exist (BOARD/DEC); wire by prefix `board.*`, `decision.*` otherwise.
