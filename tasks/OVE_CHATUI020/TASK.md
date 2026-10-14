---
id: OVE_CHATUI020
title: "Build the live-work panel region (Teraz pracuje) as a static composition with fixtures"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI001, OVE_CHATUI002, OVE_DS044, OVE_DS051, OVE_DS052, OVE_DS054]
soft_depends_on: []
provides: ["ui:ChiefLiveWorkPanelView"]
needs: ["ui:LiveWorkPanel", "ui:AgentWorkCard", "ui:SidePanel", "ui:TerminalPane", "ui:StatTile"]
owns: ["apps/desktop/src/features/chat/panel/view/**", "apps/desktop/src/locales/en/chat-020.json", "apps/desktop/src/locales/pl/chat-020.json"]
reads: []
design: design.png
design_source: "Chief#chief/working-now-panel (crop 1140,117,300,783)"
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 9"]
adr_refs: [26, 11]
---

# OVE_CHATUI020: Build the live-work panel region (Teraz pracuje) as a static composition with fixtures

## 1. Summary

Composes the 300px right panel of the Chief view: `Teraz pracuje` with the slots label, the active Agent card with the mini terminal test excerpt, waiting and other-Workspace rows, the Board lane tiles and the latest Decisions. Static, props-driven, with loading and empty states; data wiring is CHATUI024.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. The panel gives the Owner a live overview without leaving the conversation: who is working (slots, parallel limit 3 by default), the Board counts and recent Decisions. Mini terminal text is CLI output, therefore sanitised and redacted before it reaches this component (CHATUI009).

## 3. Scope (in)

- `ChiefLiveWorkPanelView` composition of `ui:LiveWorkPanel`.
- Fixtures for the mock (QA active with 3 test lines and progress `… 38 z 52`, Security waiting, Researcher in another Workspace, lanes 2/3/1/7, two Decisions).
- Loading, empty (`Nikt teraz nie pracuje`), error states.
- Region attributes.

## 4. Out of scope

- Data and events (CHATUI024).
- Navigation targets are callbacks (wiring).

## 5. Detailed requirements

1. Props map 1:1 to `LiveWorkPanelProps` (DS054): `slots.label` `3 z 3 slotów` built by the caller from `chat:panel.slots` (`{{used}} z {{total}} slotów`, EN `{{used}} of {{total}} slots`), `agents: WorkingAgent[]`, `lanes: LaneCount[]`, `decisions: RecentDecision[]`, `loading`, plus `error` and `onRetry`.
2. Region `data-region='chief/working-now-panel'`; sub-regions `chief/working-now-card-active`, `chief/board-tiles`, `chief/recent-decision-card` via a `regionFor` prop of the kit if available, else wrapper elements.
3. Labels: `working` 'Teraz pracuje', `board` 'Tablica', `recentDecisions` 'Ostatnie Decyzje', `empty` 'Nikt teraz nie pracuje' (EN 'Nobody is working right now'). Lane labels: Build, QA, Review, Gotowe (EN Done). Numbers always come with the word through accessible names (`2 Zadania w Build`).
4. Mini terminal lines passed as `string[]` already sanitised; the component marks the terminal `aria-hidden='false'` with `aria-label` `Ostatnie testy` and never auto-announces.
5. Error: a small `EmptyState` `Nie udało się wczytać podglądu pracy` + Retry inside the panel; the rest of the Chief view works.

## 6. Design notes

`design.png` shows the right panel: header `Teraz pracuje` + `3 z 3 slotów`, magenta card `QA · testy e2e koszyka` with mini terminal (`✓ koszyk › dodaje produkt`, `✓ koszyk › zmienia ilość`, `✗ koszyk › kod rabatowy`, `… 38 z 52`), amber row `Security` / `czeka na Zgodę`, row `Researcher` / `Strona fundacji`, heading `Tablica` with tiles 2 Build, 3 QA (emphasis), 1 Review, 7 Gotowe, heading `Ostatnie Decyzje` with two cards. Geometry DS054. Not in the mock: loading, empty, error, more than 3 Agents.

## 7. Reuse

- `ui:LiveWorkPanel`, `ui:AgentWorkCard`, `ui:StatTile`, `ui:TerminalPane mini` (OVE_DS054, OVE_DS051, OVE_DS052).

## 8. Architecture and code placement

`features/chat/panel/view/`: presentational. Fixtures exported for CHATUI024 and e2e. **i18n namespace:** this task writes its strings into its own namespace `chat-020` (files `locales/en|pl/chat-020.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-020`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control. Terminal excerpt must never be passed in raw: the props type is `SafeTerminalLines` (branded string array produced only by `safeTerminalLines`, CHATUI009), so the compiler stops raw CLI output reaching this panel.

## 10. Errors and edge cases

- Agent headline longer than the card: ellipsis.
- Progress with total 0: hidden.
- Lanes missing: tiles hidden, heading kept.
- More than 5 Decisions: only the first 5 shown.

## 11. Acceptance criteria

- [ ] `Default` story matches `design.png`.
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] The `SafeTerminalLines` brand type is required by the props (type test).
- [ ] State is conveyed by words (`czeka na Zgodę`).

## 12. Test plan

- Storybook `Default`, `Loading`, `Empty`, `Error`, `ManyAgents`, `NoTest`, `Pseudolocale`; type-level test for the branded prop; axe; visual comparison.
- Command: `pnpm --filter @overmind/desktop test features/chat/panel/view`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Missing in kit: `StatTile` link behaviour is DS051/DS054; lane tiles navigate with a lane filter param (`board?lane=qa`), defined by BOARDUI.
