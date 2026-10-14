---
id: OVE_BOARDUI009
title: "Task detail hook and panel: provenance, origin, timeline, evidence"
area: BOARDUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD013, OVE_BOARDUI001, OVE_BOARDUI004, OVE_BOARDUI005, OVE_BOARDUI006, OVE_DS032, OVE_DS040, OVE_DS044, OVE_DS063, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:use-task-detail"]
needs: ["ui:TaskDetail", "ui:Timeline", "ui:ProvenanceBlock", "ui:EvidenceList", "ui:SidePanel", "ui:EmptyState", "ui:Skeleton", "api:board.task.get", "lib:api-client-board", "lib:use-gateway-resource", "lib:use-selected-task", "lib:route-links"]
owns: ["apps/desktop/src/features/board/state/use-task-detail.ts", "apps/desktop/src/features/board/regions/detail.region.tsx", "apps/desktop/src/features/board/components/TaskDetailPanel.tsx", "apps/desktop/src/locales/en/board-detail.json", "apps/desktop/src/locales/pl/board-detail.json"]
reads: []
design: design.png
design_source: "Tablica#board/task-inspector (crop 1120,117,320,783 CSS px)"
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10"]
adr_refs: [11, 16, 8]
---

# OVE_BOARDUI009: Task detail hook and panel: provenance, origin, timeline, evidence

## 1. Summary

Loads the selected Task's detail (`GET /workspaces/:wid/tasks/:id`) and renders the 320px panel with `ui:TaskDetail`: title, the Documentation reference card with its quote, the origin (Discussion and Decision) link, the history timeline and the evidence Artifacts.

## 2. Context

The Task detail is the place where the Owner verifies provenance: every Task points to the Documentation fragment it follows (ADR 0016) and, when it came from a Discussion, to the Decision (D-12). Timeline entries are append-only (history is immutable). Evidence are Artifacts, not agent claims (ADR 0026). `TaskDetail` (BOARD011) contains `card`, sanitised `description`, `docRef {path, anchor, gitCommit, quote, stale}`, `origin`, `acceptanceCriteria`, `timeline` (latest 50 ascending, `moreBefore`), `evidence`, `allowedNextLanes`, `chatTarget`, `canDefer`.

## 3. Scope (in)

- `useTaskDetail(taskId)` hook with invalidation on events of that Task.
- `TaskDetailPanel` composing `ui:TaskDetail` from `taskDetailToProps`.
- `regions/detail.region.tsx` (slot `detail`) choosing between empty state, loading, loaded, not found.
- Open handlers: doc reference (in-app viewer route), origin Discussion/Decision links, evidence Artifact (opens the Artifact preview route).

## 4. Out of scope

- Action buttons Czat/Odłóż (OVE_BOARDUI010), acceptance-criteria editing (not planned), loading older timeline pages (post-MVP).

## 5. Detailed requirements

1. `useTaskDetail(taskId?)` uses `useGatewayResource(['task', workspaceId, taskId], ...)`, `enabled: !!taskId`, `invalidateOn` events `task.moved|assigned|status_changed|deferred` where `payload.taskId === taskId`, and `task.progress_reported` (ephemeral) which patches only `card.progress` locally without refetch.
2. Mapping with `taskDetailToProps` (OVE_BOARDUI004); the panel passes `loading` while the first load runs and keeps old data with `refreshing` when switching between Tasks quickly (no empty flash).
3. Provenance block: `doc.onOpen` navigates through `routes.projectDoc(path, anchor)` (SHELL route helper, reported) only when `isRelativeDocPath` is true; `quote` is shown as plain text (never Markdown), `commit` shown as `main @ <sha7>`. If `docRef.stale` is true show the amber note `board:detail.docStale` (`Dokumentacja zmieniła się od utworzenia Zadania`) below the card.
4. Missing doc reference (defensive): ui:ProvenanceBlock warning variant is used and the Task id is reported once to the console in dev.
5. Origin row: label `POCHODZENIE`; content `Dyskusja „<title>” · Decyzja D-<seq>` where each part is a link: Discussion link via `routes.discussion(id)`, Decision via `routes.decision(id)`; titles may be missing: show ids. If the origin is `owner`/`chief_plan` without discussion, the row shows `board:detail.originPlan` (`Plan Chiefa`) or `board:detail.originOwner` (`Dodane przez Ciebie`) as text.
6. Timeline: ui:Timeline from `timelineToItems`; the newest item is last; when `moreBefore` is true show a muted line `board:detail.moreHistory` (`Starsze wpisy pominięto`) (paging is post-MVP). Times use the OS time zone.
7. Evidence: `ui:EvidenceList` max 6 with `+N`; clicking an item calls `routes.artifact(artifactId)`; names are plain text; the checksum is available as `title` (first 12 hex chars).
8. Acceptance criteria (if present) are rendered as a compact checklist section `board:detail.criteria` (`KRYTERIA`) with `✓`/`○` glyphs by `met` (true/null) and the `evidenceRef` name; read-only. Placed after the origin row (ASSUMPTION: the mock does not draw it, derived from DS StatusText).
9. Empty selection renders `ui:EmptyState` (`board:detail.none` = `Wybierz Zadanie, aby zobaczyć szczegóły.`). A 404 for the id renders `board:detail.notFound` and clears the selection after 3 s (no information leak about other Workspaces).
10. The panel scrolls internally; actions row stays pinned (ui-kit). Focus is not moved when the detail changes; an `aria-live="polite"` region announces the title of the newly selected Task.

## 6. Design notes

`design.png` is the 320px inspector for T-31: `T-31 · tor QA`, title `Koszyk z kodami rabatowymi` (20/700), doc card with `docs/spec.md#koszyk` and the quote `„Kod rabatowy obniża cenę przed podatkiem i nie łączy się z innymi promocjami.”`, `POCHODZENIE` with the Discussion/Decision link, `PRZEBIEG` with four rows (mint, error, mint, magenta `teraz`), `DOWODY · ARTEFAKTY` chips `unit-report.xml` (mint) and `e2e-trace.zip` (magenta), and the pinned actions. Component styling is entirely ui-kit (OVE_DS063). Not in the mock: loading skeleton (ui-kit), empty selection, not found, stale document note (amber InfoNote), criteria list.

## 7. Reuse

`ui:TaskDetail`, `ui:Timeline`, `ui:ProvenanceBlock`, `ui:EvidenceList`, `ui:EmptyState`, `ui:Skeleton`; `SafeLink`/`isRelativeDocPath` (OVE_BOARDUI002); mappers (OVE_BOARDUI004).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-task-detail.ts`, `components/TaskDetailPanel.tsx`, `regions/detail.region.tsx` (slot `detail`). The actions (`actions` prop of ui:TaskDetail) are supplied by OVE_BOARDUI010 through a small context `useTaskActions()` (optional; absent means no actions row).

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Task deleted with Workspace: 404 -> not found state.
- Two quick selections: the earlier request is aborted; the later wins.
- Evidence Artifact removed: `onOpen` navigates, the Artifact route shows its own not-found.
- Quote contains Markdown or HTML: displayed literally.
- History with 50 entries: panel scrolls; the newest remains visible (scroll to bottom on first render only).
- Discussion title missing (reader unavailable): ids shown, no error.

## 11. Acceptance criteria

- [ ] Given T-31, Then the panel matches `design.png` within tolerance and the strings equal the mock copy (PL).
- [ ] Given `docRef.stale`, Then the amber note is shown.
- [ ] Given a quote with `<script>`, Then it appears as text.
- [ ] Given no selection, Then the empty state shows; given an unknown id, Then the not-found state shows and the selection clears.
- [ ] Given a `task.progress_reported` event for the selected Task, Then the progress label updates without a refetch.
- [ ] Given axe, Then no violations; the panel is a labelled `aside`.

## 12. Test plan

Vitest + Testing Library with a fake api-client from `lib:test-utils`: `use-task-detail.test.tsx`, `TaskDetailPanel.test.tsx` (strings, links, stale, criteria), `detail.region.test.tsx` (empty/not-found), visual test of the panel against `design.png`. Storybook stories only where this task adds a component of its own. Axe on every rendered state (`lib:a11y-harness`). Commands: `pnpm --filter @overmind/desktop test board`, `pnpm --filter @overmind/desktop storybook:test`. Playwright and visual tests for the whole view are in OVE_BOARDUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. The optional actions context is defined in OVE_BOARDUI010; until merged the actions row is absent.

## 14. Open questions and assumptions

- ASSUMPTION: acceptance criteria are shown read-only (not in the mock).
- GAP reported to SHELL: route helpers `routes.projectDoc`, `routes.discussion`, `routes.decision`, `routes.artifact`, `routes.agentChat` (capability `lib:route-links`).
