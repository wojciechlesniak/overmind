---
id: OVE_CHATUI017
title: "Build the Chief conversation list region (static, props-driven, with fixtures)"
area: CHATUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI001, OVE_CHATUI002, OVE_DS019, OVE_DS020, OVE_DS022, OVE_DS032, OVE_DS033, OVE_DS044, OVE_DS049]
soft_depends_on: []
provides: ["ui:ChiefConversationListView"]
needs: ["ui:PageLayout", "ui:SidePanel", "ui:ConversationList", "ui:ConversationRow", "ui:SectionLabel", "ui:StatusDot", "ui:CountBadge", "ui:Skeleton", "ui:EmptyState"]
owns: ["apps/desktop/src/features/chat/list/view/**", "apps/desktop/src/locales/en/chat-017.json", "apps/desktop/src/locales/pl/chat-017.json"]
reads: []
design: design.png
design_source: "Chief#chief/conversation-list (crop 72,117,270,783)"
spec_refs: ["SPECIFICATION 5"]
adr_refs: [23, 15]
---

# OVE_CHATUI017: Build the Chief conversation list region (static, props-driven, with fixtures)

## 1. Summary

Composes the 270px conversation list of the Chief view from the kit `ConversationList`: pinned Chief row, `AGENCI W TYM WORKSPACE` rows in all Agent states, `DYSKUSJE NA ŻYWO` rows and the dashed `Nowy Agent` button, driven only by props and fixtures. Data wiring is CHATUI021.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. The same list component appears in the Chief view (Chief row selected) and in the direct Agent chat (Agent row selected, Chief row plain). Row states: working (magenta dot and state line), waiting for Approval (amber, badge), done (mint), idle (no dot), waiting for Quality Gate, live Discussion (dashed violet).

## 3. Scope (in)

- `ChiefConversationListView` props and component (thin composition of `ui:ConversationList`).
- Fixtures reproducing the mock (QA working, Security waiting with badge 1, Developer done, Product Owner idle, Designer idle, Senior Reviewer waiting for Quality Gate, one live Discussion).
- Loading, empty, error and many-Agents states.
- `data-region` attributes.

## 4. Out of scope

- Fetching, unread marking, selection state, navigation (CHATUI021).
- The Agent creation flow behind `Nowy Agent` (AGUI area).

## 5. Detailed requirements

1. Props: `{ chief: ConversationItem; agents: ConversationItem[]; discussions: ConversationItem[]; selectedId?: string; loading?: boolean; error?: MessageRef; onSelect(id: string, kind): void; onNewAgent(): void; onRetry(): void }` where items are the kit `ConversationItem` (CHATUI002 produces them).
2. Render inside `ui:SidePanel` (270px) with `data-region='chief/conversation-list'`; the Chief row has `data-region='chief/chief-row'`; each Agent row `data-region` is NOT repeated per row (slugs `agent-row-*` are test hooks derived from state: add `data-state`).
3. Labels from `chat:list.*`: `agentsSection` 'AGENCI W TYM WORKSPACE' (EN 'AGENTS IN THIS WORKSPACE'), `discussionsSection` 'DYSKUSJE NA ŻYWO' (EN 'LIVE DISCUSSIONS'), `newAgent` 'Nowy Agent' (EN 'New Agent'), `navigation` 'Rozmowy' (EN 'Conversations'), `empty` 'Brak Agentów w tym Workspace' (EN 'No Agents in this Workspace').
4. Loading: pass `loading` to the kit (6 skeleton rows, Chief row and button stay).
5. Error: kit `EmptyState` small variant with the message and a `Retry` button inside the scroll region; the Chief row and `Nowy Agent` remain usable.
6. Unread: the amber `CountBadge` (E10) with accessible label `1 nieprzeczytana wiadomość` through `chat:count.unread`.
7. Selection: `aria-current` is handled by the kit; this task does not hold selection state.
8. `Nowy Agent` is hidden when `onNewAgent` is undefined (for example while paused? no: creating an Agent starts no work; keep visible).

## 6. Design notes

`design.png` shows the Chief list: selected Chief row with magenta gradient and the attention line `Security czeka na Twoją Zgodę`, section label `AGENCI W TYM WORKSPACE`, rows QA (`pracuje · testy e2e koszyka` magenta), Security (`czeka na Zgodę` amber, badge 1), Developer (`skończył · 4 pliki` mint), Product Owner and Designer (`bezczynny` grey), Senior Reviewer (`czeka na Quality Gate`), section `DYSKUSJE NA ŻYWO` with the dashed row `Płatności: Stripe czy P24?` / `runda 2 z 4 · 3 uczestników`, and the dashed `Nowy Agent` button at the bottom. Row geometry and tokens: DS049. Not in the mock: loading skeleton, error, empty, hover, focus, long names, many Agents (fade mask).

## 7. Reuse

- `ui:ConversationList`, `ui:ConversationRow`, `ui:SidePanel`, `ui:EmptyState`, `ui:Skeleton` (OVE_DS049, OVE_DS044, OVE_DS032), mappers' output types (OVE_CHATUI002).

## 8. Architecture and code placement

`features/chat/list/view/`: one presentational component + `ChiefConversationListView.fixtures.ts` + stories. No hooks except `useT`. Fixtures are exported for the data task and the Playwright scenarios. **i18n namespace:** this task writes its strings into its own namespace `chat-017` (files `locales/en|pl/chat-017.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-017`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Presentational only: no data access, no network, no storage. All text arrives as props and is rendered as React text; fixtures contain only synthetic data (no realistic secrets). Disabled states carry a reason text, never a silent disabled control.

## 10. Errors and edge cases

- Chief row without attention text: shows the last Chief message preview passed by the caller.
- Agent name 60 characters: ellipsis with `title`.
- 50+ Agents: list scrolls inside the panel.
- Selected id not in the lists: nothing selected (no crash).

## 11. Acceptance criteria

- [ ] The Storybook `Default` story matches `design.png` within the visual tolerance (OVE_TEST005).
- [ ] Storybook stories exist for every state listed here (including those not in the mock), i18n keys have EN and PL entries and `pnpm i18n:check` passes, axe is clean, the component is keyboard operable with a visible focus ring.
- [ ] Loading, empty, error and many-Agents stories exist.
- [ ] No colour-only state: every row has its state word.

## 12. Test plan

- Storybook stories: `Default`, `ChiefNotSelected`, `AgentSelected`, `Loading`, `Empty`, `Error`, `ManyAgents`, `LongNames`, `Pseudolocale`.
- Vitest + Testing Library: callbacks, keyboard roving (Up/Down/Home/End), aria names.
- Visual: `lib:ui-visual-test` crop comparison. Command: `pnpm --filter @overmind/desktop test features/chat/list/view`.

## 13. Parallelization notes

No hotspot. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- Missing kit variant: none found. `Nowy Agent` placement at the bottom is DS049 behaviour.
