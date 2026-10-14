---
id: OVE_CHATUI025
title: "Assemble the Chief route: layout, selection and all view states"
area: CHATUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHATUI021, OVE_CHATUI022, OVE_CHATUI023, OVE_CHATUI024, OVE_DS044, OVE_PAUSE011, OVE_PAUSE012, OVE_SHELL011]
soft_depends_on: []
provides: ["ui:ChiefRoute"]
needs: ["ui:PageLayout", "ui:SidePanel", "lib:use-pause-guard", "ui:PauseBannerHost", "lib:active-workspace"]
owns: ["apps/desktop/src/features/chat/routes/ChiefRoute.tsx", "apps/desktop/src/features/chat/routes/chief/**", "apps/desktop/src/locales/en/chat-025.json", "apps/desktop/src/locales/pl/chat-025.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12"]
adr_refs: [23, 5]
---

# OVE_CHATUI025: Assemble the Chief route: layout, selection and all view states

## 1. Summary

Replaces the route placeholder with the real Chief view: `PageLayout` with the conversation list, the Chief thread with composer, and the live-work panel, plus every cross-cutting state (first run empty, engine offline, Workspace switch, Global Pause) that the mock does not show.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. The shell (SHELL area) supplies rail, top bar and the Pause banner (PAUSE011); this route fills the main area of the `Chief` rail item. Screens have a fixed window height and scroll inside panels (styl-wizualny). Layout: list 270, conversation column flexible (max thread 780), live panel 300 (VIEWS section 4).

## 3. Scope (in)

- `ChiefRoute` and layout composition.
- Route params and redirects (`/chief` default).
- State matrix and copy.
- Focus management when switching conversation.

## 4. Out of scope

- Agent chat route (CHATUI032), Discussion route (DISCUI017).

## 5. Detailed requirements

1. Layout via `ui:PageLayout` with `list` = `ChiefConversationList`, `main` = `ChiefThread` + `ChiefComposer`, `detail` = `ChiefLiveWorkPanel`; widths 270 / flex / 300 (kit tokens); below 1280px width the live panel collapses into a toggle button in the header (`chat:panel.toggle`), the mocks cover 1440 only (E-question 7: default supported minimum 1280).
2. State matrix: (a) first run, no messages: empty state in the thread with the Chief greeting prompt and 3 suggestion chips (the quick actions); (b) loading: skeletons in list, thread and panel independently; (c) engine offline (`useConnectionStatus='offline'`): banner `Silnik niedostępny. Praca w tle trwa; ponawiam połączenie.` (EN: `Engine unavailable. Work continues in the background; reconnecting.`), composer disabled with reason, data stays visible; (d) Global Pause: the shell banner is shown by SHELL; composer disabled (CHATUI023); (e) Workspace switch: all three regions reset and reload; (f) no Workspace yet (before the wizard): redirect handled by SHELL.
3. Selection: the Chief view always has the Chief row selected (`/chief`); the list highlights it. Navigating to an Agent or Discussion leaves this route (other routes), the shared list component is reused there.
4. Focus: on route entry focus goes to the thread container (`tabindex=-1`) not the composer, so screen reader users hear the context first; `Escape` in the composer does nothing.
5. Titles: `document.title` `Chief · <Workspace>` (SHELL helper `usePageTitle`).
6. Region attributes for the whole view: `data-region='chief/conversation'` etc. come from child tasks; the route adds none.
7. Error boundary: a crash inside one region (for example the panel) shows a small `Ta część nie działa` card with Retry and leaves the other regions usable (React error boundary per region).
8. Performance: the three regions are code-split lazily except the thread; mount time budget 150 ms on the reference machine in the e2e smoke.

## 6. Design notes

`Chief.png` is the reference for the whole route: list left, thread centre, panel right. Per-region crops are in the static tasks (CHATUI017-020); this task adds no new visuals other than banners and the empty state (derived from `EmptyState`, `InfoNote`).

## 7. Reuse

- `ui:PageLayout`, `ui:EmptyState`, `ui:InfoNote` (OVE_DS044, OVE_DS032, OVE_DS040), regions from CHATUI017-024, shell pause banner (OVE_PAUSE011).

## 8. Architecture and code placement

`features/chat/routes/`: route composition only; error boundary helper in `routes/chief/RegionBoundary.tsx`. No data fetching directly (regions fetch). **i18n namespace:** this task writes its strings into its own namespace `chat-025` (files `locales/en|pl/chat-025.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-025`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. An offline or paused engine fails closed: no control that would start work is enabled. Route params are validated (ULID format) before use.

## 10. Errors and edge cases

- Unknown route param: redirect to `/chief`.
- Region crash: isolated by boundary.
- Narrow window (<1280): panel collapses; no horizontal page scroll.
- Engine restarts while the view is open: banner, then recovery.

## 11. Acceptance criteria

- [ ] The route renders the three regions with live data in the `busy-day` scenario.
- [ ] Every state of the matrix is visible and worded.
- [ ] A crash in the panel does not break chat.
- [ ] No horizontal page scroll at 1280 and 1440 widths.
- [ ] Initial focus lands on the thread region.

## 12. Test plan

- Playwright: `onboarded`, `empty-install`, `busy-day`, `offline-engine`, `paused` scenarios; region crash injection via a test-only prop in Storybook; axe on each state.
- Visual regression of the whole page against `Chief.png` (OVE_DS105 baseline reused).
- Command: `pnpm --filter @overmind/desktop test:e2e features/chat`.

## 13. Parallelization notes

Hot spot: `routes/ChiefRoute.tsx` (owned here only). Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: minimum supported width 1280 (SPEC open question: below 1280 not designed).
