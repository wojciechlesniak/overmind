---
id: OVE_BOARDUI005
title: "Board data hook: BoardProvider with filters in the URL, view loading and selected Task"
area: BOARDUI
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD013, OVE_BOARDUI001, OVE_BOARDUI004, OVE_SHELL011, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:use-board"]
needs: ["api:board.view", "api:board.progress", "lib:api-client-board", "lib:use-gateway-resource", "lib:use-active-workspace", "lib:route-links"]
owns: ["apps/desktop/src/features/board/state/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6"]
adr_refs: [11]
---

# OVE_BOARDUI005: Board data hook: BoardProvider with filters in the URL, view loading and selected Task

## 1. Summary

Creates `BoardProvider` and the hooks `useBoardView`, `useBoardFilter` and `useSelectedTask`: loads the Workspace's `BoardView` through the shared resource hook, keeps the filter and the selected Task id in the URL, and exposes lane view-models to the regions.

## 2. Context

`GET /api/v1/workspaces/:wid/board?scope=&assignee=&q=&doneVisible=` returns `BoardView` (lanes ordered by position, counts, cards, `hiddenOlderCount`, `deferredCount`). Filters in the mock: `Wszystkie`, `Moje Zgody` (`scope=my_approvals`), `Zablokowane` (`scope=blocked`) and the `Odłożone · N` button which opens the deferred list. The Owner's active Workspace comes from the shell (`useActiveWorkspace`). Board is the source of truth for work (ADR 0011); the UI is read-mostly.

## 3. Scope (in)

- `BoardProvider` (React context) + `useBoardView()`, `useBoardFilter()`, `useSelectedTask()`.
- URL state: `?filter=all|my_approvals|blocked|deferred&task=<TaskId>&q=`.
- Reload on `task.*` and `board.lanes_changed` events for the active Workspace (details of patching in OVE_BOARDUI013).
- Selection rules (keep, clear, auto-select none).

## 4. Out of scope

- Rendering of anything.
- Task detail loading (OVE_BOARDUI009).
- Incremental event patching and conflict handling (OVE_BOARDUI013).

## 5. Detailed requirements

1. `useBoardView()` returns `{ status, view?: BoardView, lanes: LaneViewModel[], deferredCount, error, refetch }`, built from `useGatewayResource(['board', workspaceId, filter, q], fetcher, { invalidateOn: ['task.created','task.moved','task.assigned','task.status_changed','task.deferred','board.lanes_changed','board.progress_changed'], keepPreviousData: true })`. `lanes` are produced by `laneToProps` and `taskCardToProps` from OVE_BOARDUI004.
2. `useBoardFilter()` returns `{ filter, setFilter(id), q, setQ }` backed by the router's search params through `lib:route-links` helpers; unknown values fall back to `all`. Changing the filter keeps the selection if the selected Task is still in the result, else clears `task`.
3. `filter=deferred` is not a `scope` of the view request; it loads the deferred list (OVE_BOARDUI011 consumes it) while the lanes stay hidden. The provider exposes `mode: 'lanes' | 'deferred'`.
4. `useSelectedTask()` returns `{ taskId?: TaskId, select(id), clear() }`; `select` replaces (not pushes) the history entry so Back leaves the board, not the selection. Selecting never triggers navigation outside the board.
5. Keyboard model data: provider exposes `orderedTaskIds` (lane order then card order) for the roving-focus implementation in the lanes region.
6. When the active Workspace changes the provider resets filter, `q` and selection and the resource key changes (cache is Workspace-scoped).
7. `BoardProvider` never mutates; mutations are done by the dialogs/actions tasks through `useGatewayMutation` and then call `refetch`.
8. Document `doneVisible` default: do not send (engine default 2); `useLaneOlder` (OVE_BOARDUI008) requests more with the lane list endpoint.
9. Performance: lane view-model creation is memoised by `view.generatedAt`; selecting a card does not re-map all lanes (selection is applied via a separate selector).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`useGatewayResource` (OVE_BOARDUI001), mappers (OVE_BOARDUI004), `lib:api-client-board` (OVE_BOARD013), `useActiveWorkspace` and route helpers from SHELL (reported).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `state/BoardProvider.tsx`, `state/use-board-view.ts`, `state/use-board-filter.ts`, `state/use-selected-task.ts`. The provider is mounted by the route (OVE_BOARDUI006).

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- No active Workspace yet: status `idle`, regions show nothing.
- Workspace without a Board (provisioning race): API returns `board.not_found`-like 404; hook exposes `error` and the states task shows the retry message.
- Filter value tampered in the URL: reset to `all`.
- `task` id of another Workspace in the URL: detail returns 404, selection is cleared with no message (does not disclose existence).
- Filter changes while a request is in flight: previous request aborted.
- Event for a lane the client does not know: triggers the normal refetch.

## 11. Acceptance criteria

- [ ] Given `?filter=blocked`, Then the request uses `scope=blocked` and the selector reports `blocked`.
- [ ] Given the Workspace switches, Then filter, query and selection reset and the view reloads.
- [ ] Given a `task.moved` event, Then the view refetches once.
- [ ] Given an unknown filter value in the URL, Then `all` is used and the URL is corrected.
- [ ] Given the selected Task disappears from the filtered result, Then the selection clears.

## 12. Test plan

Hook tests with `renderWithFakeGateway`: `use-board-view.test.tsx`, `use-board-filter.test.tsx`, `use-selected-task.test.tsx` (router memory history). Command: `pnpm --filter @overmind/desktop test features/board/state`.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Region tasks import only the hooks exported from `state/index.ts`.

## 14. Open questions and assumptions

- ASSUMPTION: filter and selected Task live in the URL (deep links from Chief chat, Decisions and notifications work).
- OPEN (design question 3): Owner drag between Lanes is NOT supported (see OVE_BOARDUI013 open questions).
