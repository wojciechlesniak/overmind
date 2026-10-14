---
id: OVE_BOARDUI011
title: "Deferred Tasks view: the Odłożone list with restore"
area: BOARDUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD013, OVE_BOARDUI003, OVE_BOARDUI005, OVE_BOARDUI006, OVE_BOARDUI010, OVE_DS013, OVE_DS032, OVE_DS061]
soft_depends_on: []
provides: ["lib:board-deferred-region"]
needs: ["api:board.view", "api:board.search", "lib:api-client-board", "ui:TaskCard", "ui:EmptyState", "ui:Button", "lib:use-board", "lib:feature-regions"]
owns: ["apps/desktop/src/features/board/regions/deferred.region.tsx", "apps/desktop/src/features/board/components/DeferredList.tsx", "apps/desktop/src/locales/en/board-deferred.json", "apps/desktop/src/locales/pl/board-deferred.json"]
reads: []
design: design.png
design_source: "Tablica#board/deferred-button (crop 986,130,122,56 CSS px)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [11]
---

# OVE_BOARDUI011: Deferred Tasks view: the Odłożone list with restore

## 1. Summary

When the filter is `Odłożone`, the board main area shows the list of deferred (parked) Tasks with their reason and a `Przywróć` action instead of the Lanes.

## 2. Context

The mock only shows the entry button `Odłożone · 1`; the parked view is listed as a design gap in VIEWS.md. The read model offers `listDeferred` (BOARD011) and the Task detail panel stays available for the selected parked Task. Parked Tasks are visually dimmed with dashed border (ui:TaskCard `parked`).

## 3. Scope (in)

- `DeferredList` component and `deferred.region.tsx` (slot `main`, order 10, active only in `mode === 'deferred'`).
- Loading of the deferred list (`scope=deferred`), pagination by cursor, empty state.
- Restore button per row using the action from OVE_BOARDUI010.

## 4. Out of scope

- Bulk restore (not planned), permanent removal (Tasks are never deleted by the Owner here).

## 5. Detailed requirements

1. `deferred.region.tsx` renders only when `useBoardFilter().filter === 'deferred'`; the lanes region renders only for the other filters (the lanes region checks `mode`, see OVE_BOARDUI005 `mode`).
2. Data: `GET /workspaces/:wid/board?scope=deferred` if the API supports it, otherwise `GET /workspaces/:wid/tasks?status=deferred` (the api-client exposes `listDeferred`; ASSUMPTION documented); cursor pagination with `Pokaż więcej` (page size 20).
3. Each row is a ui:TaskCard in state `parked` with an extra muted line `board:deferred.reason` (`Powód: ...`, plain text, `—` when empty) and `Przywróć` (secondary, `sm`) below; selecting the card opens the detail panel; `Przywróć` calls `unblock` with `expectedVersion`.
4. Sorting: most recently deferred first (server order).
5. Header line `board:deferred.title` (`Odłożone Zadania`) and a back link `board:deferred.back` (`Wróć do Torów`) that sets `filter=all`.
6. Empty state `board:deferred.empty` (`Nic nie jest odłożone.`) with the back link.
7. After restore the row disappears (event or refetch); the count in the header updates through `deferredCount`.
8. Keyboard: list with roving focus like the lanes.

## 6. Design notes

`design.png` shows the entry point `Odłożone · 1` (secondary button with count). The list itself is not in the mock: derive it from the DS: a plain column (max width 560, gap 10) of `parked` TaskCards (opacity .7, dashed 1px border) on `bg-app` with the muted reason line and the `sm` secondary button; empty state via `ui:EmptyState`.

## 7. Reuse

`ui:TaskCard` (parked), `ui:EmptyState`, `ui:Button`, `useTaskActions().restore` (OVE_BOARDUI010).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `components/DeferredList.tsx`, `regions/deferred.region.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Many deferred Tasks: pagination.
- Task restored by Chief while listed: row vanishes on event.
- `restore` fails with invalid_transition: toast and refetch.
- Selected Task in the URL not deferred: ignored here.

## 11. Acceptance criteria

- [ ] Given `filter=deferred`, Then the list of parked Tasks replaces the lanes and each shows its reason.
- [ ] Given `Przywróć`, Then the Task returns to its lane after the engine confirms and disappears from the list.
- [ ] Given no deferred Tasks, Then the empty state with the back link shows.
- [ ] Axe clean.

## 12. Test plan

Vitest + Testing Library with a fake api-client from `lib:test-utils`: `DeferredList.test.tsx`, `deferred.region.test.tsx` (mode switching, paging, restore). Storybook stories only where this task adds a component of its own. Axe on every rendered state (`lib:a11y-harness`). Commands: `pnpm --filter @overmind/desktop test board`, `pnpm --filter @overmind/desktop storybook:test`. Playwright and visual tests for the whole view are in OVE_BOARDUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: deferred list endpoint shape as stated; if BOARD013 names it differently, only the api-client call changes.
