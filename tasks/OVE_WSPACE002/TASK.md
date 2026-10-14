---
id: OVE_WSPACE002
title: "Dashboard data hooks: queries, push-event refresh and Global Pause merge"
area: WSPACE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT010, OVE_BOARD013, OVE_CHIEF007, OVE_DATA011, OVE_ENGINE019, OVE_ENGINE027, OVE_PAUSE007, OVE_PAUSE014, OVE_PERM027, OVE_PERM028, OVE_WFRT051, OVE_WSPACE001]
soft_depends_on: ["OVE_PAUSE014"]
provides: ["lib:use-workspaces-dashboard"]
needs: ["api:workspaces.list", "api:board.progress", "api:chief.summary", "api:agents.states", "api:runs.list", "api:approvals.list", "api:access-requests.list", "api:pause.state", "lib:api-client-events", "lib:use-workspace-pause", "lib:api-client"]
owns: ["apps/desktop/src/features/workspaces/api/**"]
reads: ["apps/desktop/src/features/workspaces/model/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 10]
---

# OVE_WSPACE002: Dashboard data hooks: queries, push-event refresh and Global Pause merge

## 1. Summary

Implements `useWorkspacesDashboard()`: loads Workspaces, Board progress, Chief summary, Agent states, Runs and pending Approvals through `api-client`, keeps them fresh with the engine push channel, merges pause state and returns the `DashboardViewModel` of OVE_WSPACE001 with per-section loading and error status.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). The UI talks only to the gateway through `api-client` (CONVENTIONS 6). All dashboard sections load independently so one failing route never blanks the screen.

## 3. Scope (in)

- `api/useWorkspacesDashboard.ts` (+ small `api/queries/*.ts` per route).
- Push subscription for `workspace.*`, `task.*`, `approval.*`, `access_request.*`, `agent.state.changed`, `pause.changed`, `chief.summary.updated`, `notification.*`, `system.state_changed`.
- Section status model `{status:'loading'|'ready'|'error'|'stale', error?, refetch}` per section.
- Polling fallback when the push channel is down.

## 4. Out of scope

- Rendering (OVE_WSPACE003..010).
- Notification list and read state (OVE_WSPACE008 owns `useNotifications`).
- System rows data (OVE_WSPACE009 owns `useSystemStatus`).

## 5. Detailed requirements

1. Data sources (all owner scope): `api:workspaces.list` (keyset, request `limit=50`; the dashboard shows at most 50 cards, more shows a 'Show all' count in the header), `api:board.progress` (`GET /workspaces/progress?ids=` batch, max 50 ids per call), `api:chief.summary` (`GetChiefSummary`, general mode), `api:agents.states?workspaceId=` per visible Workspace (max 4 concurrent requests, lazy: only for cards in the first 12; later cards load when scrolled into view with `IntersectionObserver`), `api:runs.list?status=active&workspaceId=` (ASSUMPTION, gap), `api:approvals.list?status=pending` and `api:access-requests.list?status=pending` (one call each, grouped client-side by `workspaceId`), `api:pause.state`.
2. Store: a small query cache (module `api/query-cache.ts`: key, `staleTime` 15 s, `gcTime` 5 min, request de-duplication, abort on unmount). ASSUMPTION: no new dependency (a ~80-line cache); if SHELL already introduces a query library the implementer MUST use that instead (record in the PR).
3. Push: `events.subscribe` through `lib:api-client-events` (ENGINE027) with topics above. An event invalidates only the affected section and Workspace (`workspaceId` in payload) and is coalesced with a 300 ms trailing debounce. On reconnect the client receives a resync marker (ENGINE027) and refetches everything once.
4. Polling fallback: when the event stream is not connected for > 10 s, refetch visible sections every 20 s; stop polling on reconnect.
5. Merge: `pause` snapshot feeds `deriveCardState` (OVE_WSPACE001); per-Workspace pause helpers from `lib:use-workspace-pause` (OVE_PAUSE014) are NOT re-implemented: the hook reads `selectCardPauseProps` and passes them to the mapper.
6. Return shape: `{ vm: DashboardViewModel, sections: Record<'workspaces'|'progress'|'chief'|'agents'|'runs'|'approvals', SectionStatus>, refetchAll(): void, isEmpty: boolean }`. `isEmpty` is true only when the Workspaces query is `ready` with zero items.
7. Errors: a failed section keeps its last good data and sets `status:'stale'` with the error; a first-load failure sets `'error'`. `perm.owner_required`/401 errors are never retried and surface a global session error to the shell (`lib:session-error` is SHELL's; this hook just rethrows typed `ApiError`).
8. Retries: GET requests retry twice with 500 ms and 1.5 s backoff on network errors and 503 `gateway.engine_not_ready` (honour `Retry-After`); never retry 4xx.
9. No data is persisted to `localStorage`; the cache is in memory only (isolated Workspace names are not written to disk by the UI).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:api-client` typed functions: `listWorkspaces`, board `getProgressBatch`, chief `getSummary`, agents `getStates`, approvals/access-requests list, pause `getPauseSnapshot`, runs list.
- `lib:api-client-events` subscription (ENGINE027).
- `lib:use-workspace-pause` (OVE_PAUSE014).
- Types and mappers from OVE_WSPACE001.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: ids sent to batch routes come from the previous response, never from URL or user input; the request count is bounded (max 50 Workspaces, 4 concurrent) so a hostile or huge dataset cannot make the UI flood the gateway (gateway rate limits apply, ENGINE014: a 429 is treated as `stale` with `Retry-After`).

## 10. Errors and edge cases

- Zero Workspaces: `isEmpty = true`, other sections are not requested.
- Isolated Workspace: `chief` row is absent by design (not an error).
- Push event for an unknown Workspace id: triggers one refetch of the list.
- Unmount during request: aborted, no state update.
- Gateway restarting (`503 engine_not_ready`): sections show `loading`, then data; no error flash for < 3 s.
- Clock skew: ages come from `formatRelative` with server timestamps; negative age shows 'now'.

## 11. Acceptance criteria

- [ ] Given the mock gateway returns 4 Workspaces, Then `vm.cards` has 4 entries in the specified order.
- [ ] Given `chief.summary` fails with 500, Then cards still render with `summaryMissing` and `sections.chief.status === 'stale'|'error'`.
- [ ] Given a `task.moved` event for Workspace A, Then only A's progress is refetched (one request).
- [ ] Given the event stream drops for 12 s, Then polling starts and stops after reconnect.
- [ ] Given 30 Workspaces, Then at most 4 `agents.states` requests are in flight.
- [ ] Given 429 with Retry-After 5, Then no retry happens before 5 s.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `useWorkspacesDashboard.test.tsx` with a fake `api-client` and fake event hub: first load, partial failure, event invalidation, debounce, reconnect resync, polling fallback, abort on unmount, concurrency cap; `query-cache.test.ts` (staleTime, dedupe, gc). Commands: `pnpm --filter @overmind/desktop test api`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/api/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Hotspot: none; the only shared dependency is the api-client surface of other areas. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: no query library is added by this task; use SHELL's if one exists.
- ASSUMPTION: the route for active Runs is `GET /v1/runs?status=active` (owner: WFRT/RUNUI), see the final report gap list.
- OPEN: a single `GET /v1/dashboard` aggregate would cut requests; not planned (keeps areas decoupled).
