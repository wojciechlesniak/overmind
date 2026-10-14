---
id: OVE_DISCUI010
title: "Wire the Discussions list: running and finished sections, selection, live updates"
area: DISCUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DISCUI004, OVE_DISCUI005, OVE_SHELL011, OVE_SHELL027]
soft_depends_on: []
provides: ["ui:DiscussionList"]
needs: ["lib:active-workspace", "lib:shell-navigation"]
owns: ["apps/desktop/src/features/discussions/list/wiring/**", "apps/desktop/src/locales/en/discussions-010.json", "apps/desktop/src/locales/pl/discussions-010.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6"]
adr_refs: [15, 28]
---

# OVE_DISCUI010: Wire the Discussions list: running and finished sections, selection, live updates

## 1. Summary

Connects `DiscussionListView` to `useDiscussionList` and `useDiscussionListSync`: running Discussions of the active Workspace, finished ones loaded lazily, selection synced with the route `/chief/discussion/:discussionId`, and live updates of rows.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. The list is a pure navigator: it never starts, ends or deletes a Discussion (the Owner cannot start one, ADR 0015). Visibility follows ADR 0028: only Discussions of the active Workspace.

## 3. Scope (in)

- `DiscussionList` container component.
- Selection from route params.
- Lazy load of the finished section.
- Row refresh on events.

## 4. Out of scope

- Starting Discussions (not an Owner action).
- Search and filters (post-MVP).

## 5. Detailed requirements

1. Data: `useDiscussionList(workspaceId)` (DISCUI003) plus `useDiscussionListSync` (DISCUI004); the container maps nothing itself, it passes row models and `selectedId` from the route to the view.
2. Selecting a row navigates to `/chief/discussion/:discussionId` with `navigate({ to:'chief.discussion', params })`; selecting the same row again does nothing.
3. The finished section loads on first expansion or when the route opens a finished Discussion; until loaded it shows the kit skeleton rows (3).
4. The status `escalated` row stays in the running group with the word `przekazana Tobie` and an amber dot (it waits for the Owner).
5. Workspace switch: reset selection and caches, show loading; if the open Discussion belongs to the old Workspace navigate to `/chief`.
6. Empty running section: `Brak trwających Dyskusji` and a hint line `Chief albo Workflow rozpoczyna Dyskusję, gdy potrzebna jest decyzja kilku Agentów` (Owner has no create button).
7. Pause has no effect on the list (read only).
8. Keyboard: roving focus is the kit's; Enter selects; the selected row scrolls into view on route changes.

## 6. Design notes

N/A beyond DISCUI005 (same visual).

## 7. Reuse

- `DiscussionListView` (OVE_DISCUI005), data hooks (OVE_DISCUI003, 004), navigation (SHELL).

## 8. Architecture and code placement

`features/discussions/list/wiring/`: container plus `useDiscussionSelection(route)`. Presentational/container split. **i18n namespace:** this task writes its strings into its own namespace `discussions-010` (files `locales/en|pl/discussions-010.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-010`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). The container ignores rows whose `workspaceId` differs from the active Workspace (defence in depth). Titles are plain text; a Discussion title can come from an Agent-influenced source.

## 10. Errors and edge cases

- List request fails: view `error` state with Retry.
- Selected Discussion disappears: show the not-found state via the route (DISCUI017).
- Event storm: coalesced by the sync layer.
- Finished request fails: running section stays usable, finished section shows its own error.

## 11. Acceptance criteria

- [ ] Rows reflect new, concluded and escalated Discussions within one event round trip.
- [ ] Selection follows route changes and back/forward.
- [ ] The finished section loads lazily and survives a Workspace switch correctly.
- [ ] No create or delete control exists.

## 12. Test plan

- Vitest + Testing Library with fake hooks; Playwright scenario `disc-running` (DISCUI018).
- Command: `pnpm --filter @overmind/desktop test features/discussions/list/wiring`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: route name `chief.discussion` is registered through the DISCUI001 manifest.
