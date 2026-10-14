---
id: OVE_BOARDUI004
title: "Board view-model mappers and the board i18n namespace"
area: BOARDUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_BOARD001, OVE_BOARDUI002, OVE_DS040]
soft_depends_on: []
provides: ["lib:board-view-models"]
needs: ["contract:BoardView", "contract:TaskCard", "contract:Task", "ui:UiDomainTypes", "ui:stateMaps", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/board/model/**", "apps/desktop/src/locales/en/board.json", "apps/desktop/src/locales/pl/board.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6"]
adr_refs: [11, 16]
---

# OVE_BOARDUI004: Board view-model mappers and the board i18n namespace

## 1. Summary

Pure functions that translate the gateway's Board contracts (`BoardView`, `TaskCard`, `TaskDetail`, `TaskTimelineEntry`) into the plain view-model props of the ui-kit components (`TaskCard`, `Lane`, `Timeline`, `TaskDetail`), plus the shared EN/PL strings of the `board` namespace. Keeps the contract-to-UI mapping in one tested place.

## 2. Context

ui-kit components take plain props and contain no copy (DS rule G3). The Board contracts (OVE_BOARD001/011) use enums such as `TaskStatus = queued|working|awaiting_approval|in_review|blocked|deferred|done|cancelled` and card fields `statusLabelKey`, `progress`, `docRef`, `assignee {name, avatarInitials, avatarColorToken}`. The design uses the unions of OVE_DS040 (`TaskState`, `AgentHue`). This task is the bridge, used by the lane region, the detail region and the live updates. Polish mock copy (Tablica.dc.html) is the PL source of truth.

## 3. Scope (in)

- `taskStatusToUiState(status, laneCategory)` and `taskCardToProps(card, t, handlers)`.
- `laneToProps(laneView, t)` (title, count, hint, `active` rule, footer for hidden older cards).
- `timelineToItems(entries, t, locale)` mapping `TaskTimelineEntry.kind` to tone and text.
- `taskDetailToProps(detail, t, handlers)` for ui:TaskDetail.
- The `board` i18n namespace files (EN source, PL from the mock) for status words, lane hints, filters, detail section labels and shared errors.

## 4. Out of scope

- Fetching (OVE_BOARDUI005), rendering (OVE_BOARDUI007/009), dialogs (OVE_BOARDUI010/012); their own strings go to their own namespace files.

## 5. Detailed requirements

1. Status mapping (exhaustive `Record<TaskStatus, TaskState>` so a new status is a compile error): `queued`->`queued`; `working`->`working`; `awaiting_approval`->`waiting-approval`; `in_review`->`reviewing`; `blocked`->`blocked`; `deferred`->`parked`; `done`->`done`; `cancelled`-> not rendered as a card (the read model already excludes it; the mapper returns `null`). A card with no assignee and status `queued` maps to `unassigned` (mock: `nieprzypisane`).
2. State labels come from `t('board:status.<status>')`: PL `pracuje`, `w kolejce`, `czeka na Zgodę`, `ocenia`, `zablokowane`, `odłożone`, `✓ gotowe`, `nieprzypisane`; EN `working`, `queued`, `waiting for approval`, `in review`, `blocked`, `deferred`, `✓ done`, `unassigned`. The `✓` glyph is part of the label text as in the mock.
3. `progress` -> `{ value: done/total clamped 0..1, label }` where label is `card.progress.label` (<= 40 chars, plainText-sanitised) else `t('board:progress.default', { done, total })` (PL `{{done}} z {{total}}`). Progress is only passed when the state is `working` (ui:TaskProgress shows it only then). The label is a hint reported by the Agent, never styled as a verified fact.
4. `assignee` -> `{ name, hue, initials }` with `hue` from `avatarColorToken` (map the token to `AgentHue`; unknown token -> `hueForAgentId(agentId)` from OVE_DS040). `assignee.unknown === true` renders name `—` with a muted style.
5. `doc` -> `{ path, anchor }` from `card.docRef`; the mapper passes it through `isRelativeDocPath`; an invalid path yields `doc: undefined` plus `docWarning: true` so the card shows the missing-link warning (Task without documentation link violates ADR 0016).
6. Lane mapping: `title` from `lane.name` (plainText), `count` from the view, `hint` from `lane.hint` (Chief-distributes line for the `todo` category defaults to `t('board:lane.todoHint')` = PL `Chief rozdziela, gdy zwolni się slot`), `active` = the lane contains a card with status `working` or the selected card (rule from the mock: QA lane is tinted because it holds the selected working Task), `footer` = `{ label: t('board:lane.showOlder', { count: hiddenOlderCount }) }` when `hiddenOlderCount > 0` (PL `Pokaż {{count}} starszych`, plural forms one/few/many/other), WIP: when `wipExceeded` the count pill tone becomes amber and the hint gets `t('board:lane.wipExceeded', { limit })`.
7. Timeline mapping per `kind`: `created`, `moved` (text `Build · Developer · 4 pliki` style is built from `summary`, which the engine already redacted), `gate_result` failed -> tone `error`, passed -> `mint`, `status_changed` to working on the current run -> `magenta` with `current: true` and time label `teraz` when the entry is the latest and the Task is working; time formatting uses `formatTime`/`formatRelative` from `lib:i18n-ui`. Summaries are shown through `plainText` (they are engine-redacted but may contain agent text).
8. Detail mapping: `laneLabel` = `T-${seq} · ${t('board:detail.lane')} ${laneName}` (PL `T-31 · tor QA`), `origin` -> LinkRow label `board:detail.origin` (`POCHODZENIE`) with discussion title and `Decyzja D-<seq>` when present (titles degrade to ids when missing), `evidence` -> list of `{ id: artifactId, name (plainText), onOpen }`, `provenance.quote` clamped to 400 chars, `stale` doc ref -> `warning` flag for the ProvenanceBlock.
9. i18n namespace `board` keys (EN + PL both complete, lint `pnpm i18n:check`): `nav.title`, `nav.label`, `title`, `laneSource` (`Lanes from the "{{name}}" Workflow`), `filter.all|myApprovals|blocked|deferred`, `status.*`, `progress.default`, `lane.*`, `card.noDoc`, `detail.*` (`WYNIKA Z DOKUMENTACJI`, `POCHODZENIE`, `PRZEBIEG`, `DOWODY · ARTEFAKTY`, `lane`), `errors.*` for BOARD error codes (`doc_ref_required`, `doc_ref_unresolvable`, `doc_ref_outside_documentation`, `wip_limit_reached`, `version_conflict`, `invalid_transition`, `move_not_permitted`).
10. Every mapper is pure and total: unknown enum values (newer engine) map to a neutral state with the raw label, never throw.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

Types and maps from OVE_DS040 (`TaskState`, `taskStateTone`, `hueForAgentId`), `plainText`/`isRelativeDocPath` (OVE_BOARDUI002), `useT`/format helpers (OVE_ARCH011), contracts BOARD001. No visual component is created.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `model/task-state.ts`, `model/task-card.ts`, `model/lane.ts`, `model/timeline.ts`, `model/task-detail.ts`, `model/index.ts`; locale JSON files owned here. i18n namespaces for other board tasks use the pattern `board-<topic>.json` (reported to OVE_ARCH011 for the namespace lint).

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Card from a newer engine with an unknown `status`: neutral card, raw status as label.
- `progress.total` = 0: ignored (contract forbids, defensive).
- Title of 140 characters with a RLO char: sanitised, wraps (ui handles).
- Lane with `hiddenOlderCount` > 0 and zero cards visible: footer still shown.
- `assigneeAgentId` set but `assignee` null (agent archived or not visible in this Workspace): shows `—`, state unchanged.
- Timeline entry with empty summary: falls back to the `kind` label.

## 11. Acceptance criteria

- [ ] Given every `TaskStatus`, Then the mapper returns the documented state and label (table test, exhaustiveness checked at type level).
- [ ] Given a card whose doc path contains `..`, Then `doc` is undefined and `docWarning` is true.
- [ ] Given a Polish locale and `hiddenOlderCount` of 5, Then the footer reads `Pokaż 5 starszych`; for 2 it reads `Pokaż 2 starsze` (plural forms present in PL file).
- [ ] Given the mock fixture of T-31, Then `taskDetailToProps` yields the strings of the mock (`T-31 · tor QA`, `POCHODZENIE`, `PRZEBIEG`).
- [ ] Given unknown enum values, Then no mapper throws.
- [ ] `pnpm i18n:check` passes for namespace `board`.

## 12. Test plan

Vitest table tests: `task-state.test.ts`, `task-card.test.ts`, `lane.test.ts`, `timeline.test.ts`, `task-detail.test.ts` using builders from `lib:board-builders` where reachable through contracts or local fixtures typed against `@overmind/contracts`; i18n key check via `pnpm i18n:check`. Command: `pnpm --filter @overmind/desktop test features/board/model`.

## 13. Parallelization notes

Can start as soon as the BOARD contracts and ui-kit types exist (stub types allowed). The locale files are owned here only; later board tasks add their own `board-<topic>.json` files.

## 14. Open questions and assumptions

- GAP (reported to BOARD): the card does not tell `✓ Quality Gate` from `✓ zaakceptowane` (two done variants in the mock). Until BOARD adds an optional additive field (suggestion `doneKind: 'gate' | 'accepted'`) all done cards use the single label `✓ gotowe`.
- ASSUMPTION: avatar colour token names equal `AgentHue` names.
