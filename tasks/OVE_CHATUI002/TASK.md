---
id: OVE_CHATUI002
title: "Map chat contracts to ui-kit props with pure view-model functions"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_CHAT001, OVE_CHAT002, OVE_CHATUI001, OVE_DS040, OVE_DS046, OVE_DS049, OVE_DS050]
soft_depends_on: []
provides: ["lib:chat-view-models"]
needs: ["contract:Conversation", "contract:ChatMessage", "contract:MessagePart", "contract:AgentState", "ui:UiDomainTypes", "ui:stateMaps", "ui:ConversationList", "ui:MessageBubble", "ui:ChatHeader"]
owns: ["apps/desktop/src/features/chat/model/**", "apps/desktop/src/locales/en/chat-002.json", "apps/desktop/src/locales/pl/chat-002.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 9"]
adr_refs: [23, 26]
---

# OVE_CHATUI002: Map chat contracts to ui-kit props with pure view-model functions

## 1. Summary

Implements the pure functions that turn engine contracts (`ConversationSummary`, `ChatMessage`, `AgentStateView`) into the props of the kit components: list items, header data, message bubble data, state words and tones, Agent hue and initials. No React, no I/O, fully table-tested.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. The kit components take display-level props (`ConversationItem`, `AgentState` display union, `MessageBubbleProps`). The engine speaks `agentState: 'working'|'waiting_approval'|'needs_login'|'idle'|'finished_unread'`. Mapping in exactly one place keeps DRY and keeps the kit free of contract knowledge.

## 3. Scope (in)

- Agent State mapping (engine -> kit `AgentState`).
- `toConversationItem`, `toChiefItem`, `toDiscussionRow`.
- `toMessageView` (the discriminated view of one `ChatMessage` for the renderer).
- State line text keys and unit words.
- Agent hue and initials helpers (using `hueForAgentId`).

## 4. Out of scope

- Rendering (CHATUI011).
- Fetching (CHATUI004).
- Cache merge logic (CHATUI005).

## 5. Detailed requirements

1. `mapAgentState(view: AgentStateView): { state: KitAgentState; reasonKey?: string }`: `working`->`working`, `waiting_approval`->`waiting-approval`, `finished_unread`->`done`, `idle`->`idle`, `needs_login`->`waiting-approval` with `reasonKey:'chat:state.needsLogin'` and tone amber (a login is a thing the Owner must do; never shown as idle). `paused=true` overrides the kit state to `paused` while keeping the word of the underlying state in `stateLabel`. Exhaustive `switch` with a `never` check.
2. `stateLabel(view, ctx)`: composes the second line of a row: working -> `pracuje · <taskTitle>` (task title from the summary, max 40 chars, ellipsis done by CSS), waiting -> `czeka na Zgodę`, done -> `skończył · <n> pliki` only when the summary carries a file count else `skończył`, idle -> `bezczynny`, needs login -> `wymaga zalogowania`. All words come from i18n keys passed in `ctx.t`; the function never builds sentences by concatenating hard-coded words.
3. `toConversationItem(summary, ctx): ConversationItem` with `id=conversation.id`, `kind`, `name` (Agent name from the Agent directory map in `ctx`; Chief is `Chief`), `hue=hueForAgentId(agentId)` (Chief `chief`), `initials` (first letters, max 2, uppercase; special case: names that already look like initials are kept), `badge={count: unreadCount, label: t('chat:unread.label',{count})}` only when `unreadCount>0`, `meta`.
4. `toChiefItem(summary, attention)`: the Chief row state line is the server-assembled attention sentence (CHAT011 requirement 4), passed through as plain text, max 2 lines (CSS). Never assemble it in the UI.
5. `toDiscussionRow(summary)`: `meta` = `runda {current} z {max} · {n} uczestników` through i18n plural keys (`chat:discussion.round`, `chat:count.participants`).
6. `toMessageView(m: ChatMessage): MessageView` where `MessageView = { id, seq, role:'owner'|'chief'|'agent'|'system', kind: MessageType, authorAgentId?, source:'desktop'|'telegram'|'engine', status, timeLabel, text, parts: MessagePart[], redacted, truncated, dismissed?: boolean }`; unknown `parts` types are dropped, unknown `type` falls back to `system`-style plain text (forward compatibility, CHAT002 requirement 5).
7. `sourceLabel(view, formatTime)`: `z Telegrama · 14:02` for `origin==='telegram'` (REQUIRED whenever origin is telegram), otherwise the time `14:18` for Owner messages, nothing for Chief/Agent text. Day separators: `groupByDay(views, now)` returns `{ dayLabelKey|date, items }` using the locale helpers `formatDate/formatRelative` (ARCH011); a separator is emitted whenever the local calendar day changes or after a gap of more than 60 minutes (the mock shows `dziś, 14:02`).
8. All functions are pure, take `ctx` (`t`, `formatTime`, `now`, `agentDirectory`) explicitly and never read globals; they never throw on unknown input (return a safe fallback and a `warn` result field for tests).

## 6. Design notes

N/A, functionality only. Value sources: state words from `tasks/_design/VIEWS.md` section 4 copy list (`pracuje · testy e2e koszyka`, `czeka na Zgodę`, `skończył · 4 pliki`, `bezczynny`, `czeka na Quality Gate`).

## 7. Reuse

- `hueForAgentId`, `agentStateTone`, `labelKeys` (OVE_DS040).
- Locale format helpers (OVE_ARCH011).
- Contract types from `@overmind/contracts` (OVE_CHAT001, OVE_CHAT002, OVE_AGENT001).

## 8. Architecture and code placement

Pure UI-model layer in `features/chat/model/`. Depends on `contracts` and `ui-kit` types only (types imported with `import type`); no React imports (lint rule on this folder). Open for extension: a new MessageType or part type is one new mapper entry in a registry object, not a new `if` (OCP). **i18n namespace:** this task writes its strings into its own namespace `chat-002` (files `locales/en|pl/chat-002.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-002`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Mapping must not widen trust: `toMessageView` copies `text` verbatim and never interprets it; `parts` are validated by the contract zod schema at the api-client boundary and again narrowed here by `type`. `needs_login` is never mapped to `idle` (fail visible). Telegram origin is never dropped when mapping (spoofing protection: the Owner always sees where text came from).

## 10. Errors and edge cases

- `agentState` missing for an Agent (no session): treat as `idle` with reason `no_session` word `bezczynny`.
- Unknown part type: dropped, the message text still renders.
- `unreadCount` negative or NaN: treated as 0.
- Very long Agent names: no truncation here (CSS ellipsis in kit).
- Clock skew (message in the future): shown with its own time, day separator by local day.

## 11. Acceptance criteria

- [ ] Every engine `AgentState` maps to exactly one kit state and a test fails to compile if a new engine state is added without a mapping.
- [ ] `needs_login` renders as an amber, worded state, never idle.
- [ ] A telegram-origin message always yields a source label.
- [ ] Day separators appear on day change and after >60 min gaps, in PL and EN.
- [ ] Pure: the folder has no React or api-client import (lint).

## 12. Test plan

- Vitest table tests: `state-map.test.ts` (all 5 states x paused), `labels.test.ts` (PL plural forms for unread and participants), `message-view.test.ts` (unknown part, unknown type, telegram, truncated, redacted), `day-groups.test.ts` (DST change day, midnight), `conversation-items.test.ts` (fixtures from the Chief mock: QA working, Security waiting with badge 1, Developer done, Product Owner idle).
- Fixtures typed with contract builders (OVE_CHAT002 builders).

## 13. Parallelization notes

No hotspots; pure folder. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: `finished_unread` shows as `done` (mint) with the file count only if the engine summary carries `resultFileCount`; otherwise just `skończył`. Ask CHAT011 owner to add the optional field if wanted.
- ASSUMPTION: `needs_login` uses the amber `waiting-approval` look because the kit has no separate `needs-login` state; flag to DS (OVE_DS040) as a possible additional variant.
