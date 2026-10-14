---
id: OVE_DISCUI017
title: "Assemble the Discussion route from list, header, thread, composer and result panel"
area: DISCUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI010, OVE_DISCUI011, OVE_DISCUI012, OVE_DISCUI013, OVE_DISCUI014, OVE_DISCUI015, OVE_DISCUI016, OVE_DS109, OVE_SHELL011, OVE_SHELL027]
soft_depends_on: []
provides: ["ui:DiscussionRoute"]
needs: ["lib:shell-navigation", "lib:active-workspace", "ui:PageGrid"]
owns: ["apps/desktop/src/features/discussions/routes/**", "apps/desktop/src/locales/en/discussions-017.json", "apps/desktop/src/locales/pl/discussions-017.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6"]
adr_refs: [15, 5]
---

# OVE_DISCUI017: Assemble the Discussion route from list, header, thread, composer and result panel

## 1. Summary

Replaces the placeholder with the real route `/chief/discussion/:discussionId`: the three-column layout (list 260, main column, panel 310), data providers, focus order, loading, error and offline states, and the glue between the deadlock block, composer and result panel.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. The route is lazy loaded by the manifest of DISCUI001. The three regions use the grid of the shell content area; the thread and the panel scroll independently.

## 3. Scope (in)

- `DiscussionRoute` component.
- Layout and focus order.
- Provider and subscription lifecycle.
- State glue.

## 4. Out of scope

- Visual details of each region (tasks 005-009).

## 5. Detailed requirements

1. Layout: list 260 px, main column fluid (thread max width 820), panel 310 px; below 1100 px the panel collapses under the thread behind a `Wynik` tab (follows the shell responsive rule).
2. Data lifecycle: `useDiscussion`, `useTranscript` and `useDiscussionSync` are mounted once in the route and passed down by props or a small context; unmount unsubscribes.
3. Glue: `Oddaj głos` from the deadlock block switches the composer mode; thread message links scroll within the thread; document chips navigate.
4. States: loading skeleton for all regions, error with Retry for the detail, `Brak połączenia z silnikiem` banner when offline while keeping the last content visible, `Wznowiono połączenie` toast on reconnect.
5. Focus order: list, header controls, thread, composer, result panel; the page has a single `h1` (the title); regions carry `data-region` slugs from DISCUI001.
6. Opening a Discussion marks its notification read through the existing notification mechanism (no new API).
7. Route title in the window title: `<title> · Dyskusja`.
8. No state is stored in the URL besides the id.

## 6. Design notes

Use the full `Dyskusja.png` composition; compare each region with its own crop in tasks 005-009. Region slugs: `disc/list`, `disc/main`, `disc/positions-panel`.

## 7. Reuse

- All region containers and views of DISCUI005-016; shell layout primitives.

## 8. Architecture and code placement

`features/discussions/routes/DiscussionRoute.tsx` (default export, lazy) and `routes/useDiscussionRoute.ts` (data lifecycle). The route is the only place that knows all regions. **i18n namespace:** this task writes its strings into its own namespace `discussions-017` (files `locales/en|pl/discussions-017.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-017`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). Route params are validated as ids before any request; a malformed id shows not-found without a request. No data of other Workspaces is read.

## 10. Errors and edge cases

- Malformed id: not-found.
- Discussion deleted with its Workspace: navigate to `/chief`.
- Detail loads but transcript fails: header and panel show, thread shows its own error.
- Reconnect storm: handled by the sync layer.

## 11. Acceptance criteria

- [ ] The route matches `Dyskusja.png` for the mock data within the visual tolerance.
- [ ] All regions update live from events.
- [ ] Focus order and landmarks are correct.
- [ ] Offline and reconnect keep content and recover.
- [ ] Unsubscribes on unmount (no leaked subscriptions, test).

## 12. Test plan

- Vitest route test with fake hooks; Playwright full flows in DISCUI019.
- Command: `pnpm --filter @overmind/desktop test features/discussions/routes`.

## 13. Parallelization notes

Integration task: wait for tasks 010-016. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: the shell exposes a responsive breakpoint token for the 1100 px collapse.
