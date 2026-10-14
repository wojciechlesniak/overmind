---
id: OVE_SHELL011
title: "Provide the current Workspace global state and Workspace list hooks"
area: SHELL
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA009, OVE_DATA011, OVE_DS037, OVE_PERM026, OVE_SHELL005, OVE_SHELL006]
soft_depends_on: []
provides: ["lib:use-current-workspace-id", "lib:use-current-workspace", "lib:use-set-current-workspace", "lib:use-workspaces", "lib:workspace-gate", "lib:active-workspace", "lib:use-active-workspace", "lib:current-workspace"]
needs: ["api:workspaces.list", "api:perm.policies", "ui:Toast", "ui:useToast", "contract:Workspace"]
owns: ["apps/desktop/src/app/workspace/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [10, 28]
---

# OVE_SHELL011: Provide the current Workspace global state and Workspace list hooks

## 1. Summary

Implements the app-wide 'current Workspace' state (`WorkspaceProvider`, `useCurrentWorkspaceId()`, `useCurrentWorkspace()`, `useWorkspaces()`) with validation against the live Workspace list, a remembered choice per viewer and graceful fallback when the selected Workspace is deleted. Views that are Workspace-scoped read it; the Workspaces dashboard and the Chief view span Workspaces and ignore it.

## 2. Context

The top bar shows a Workspace switcher (VIEWS shell: 'Aplikacja rezerwacji' + path `~/Projects/aplikacja-rezerwacji`); the Board, Decision Register (own Workspace plus cross-Workspace search by Chief), Workflow, Agents and Workspace settings views are scoped to the current Workspace. PAUSE011 needs `useCurrentWorkspaceId()` from SHELL by name. The Workspace entity (DATA009) has `id, name, slug, isolated, paused, status, policyId`; there is no path field: the display path is the primary Allowed Directory of its Permission Policy (PERM026 `perm.policy.get`). The Owner has one installation and several Workspaces (ADR 0010); Workspaces are created by the Owner only (wizard step 1/3 or the dashboard). Deleting a Workspace cascades and hides it from lists (`status: 'deleting'`).

## 3. Scope (in)

- `WorkspaceProvider` and hooks in `apps/desktop/src/app/workspace/`.
- Selection rules: stored id (if still valid) -> first Workspace in list order -> `null`.
- Persistence of the selection in `localStorage['overmind.currentWorkspaceId']` (try/catch; per-viewer convenience).
- `useWorkspaceDisplayPath(workspace)` reading the primary directory (display form) from the policy; returns `null` when none.
- Event-driven refresh: `workspace.created|renamed|updated|deleted` and `pause.changed` invalidate `workspaces.list`.
- Switching side effects helper `useOnWorkspaceChange(cb)`.

## 4. Out of scope

- The switcher menu UI and its interactions (OVE_SHELL017).
- Creating a Workspace (WSPACE dashboard; wizard ONB019).
- Deleting a Workspace (WSPACE).
- Per-Workspace pause state (PAUSE014/`usePause`).

## 5. Detailed requirements

1. API: `useWorkspaces(): { items: WorkspaceSummary[]; status: 'loading'|'ready'|'error'; error?: UiError; refetch() }` using `useGatewayQuery('workspaces.list', { limit: 200 })` and the event hub; deleting items are filtered out client-side as well. `useCurrentWorkspaceId(): string | null`, `useCurrentWorkspace(): WorkspaceSummary | null`, `useSetCurrentWorkspace(): (id: string) => void`.
2. Resolution: on first successful list load: read stored id; if it exists in the list use it; else the first item (the list is ordered by `updatedAt desc` by DATA011 default; document this assumption) ; if the list is empty the value is `null` (the first-run guard of OVE_SHELL025 then decides: wizard or the dashboard empty state). When the selected Workspace disappears (deleted elsewhere) switch to the fallback and show a polite toast key `shell:workspace.deletedFallback` ('The Workspace was deleted. Switched to {{name}}.' / 'Workspace został usunięty. Przełączono na {{name}}.').
3. Setting: `setCurrentWorkspace(id)` ignores ids that are not in the list; persists; announces via a polite live region `shell:workspace.switched` ('Workspace: {{name}}'); invalidates nothing itself (consumers use the id in their query keys).
4. Loading state: the raw hook `useCurrentWorkspaceState()` returns `undefined` while loading and `null` for 'none' (typed `string | null | undefined`); `useCurrentWorkspaceId()` returns `string | null` and throws a developer error if called before the provider has resolved, so views are only rendered after `WorkspaceGate` (below) passes. `WorkspaceGate` renders `RouteSkeleton` until the first list load completes (max 3 s then proceeds with `null`).
5. Display path: `useWorkspaceDisplayPath(ws)` fetches `perm.policy.get` for `ws.policyId` (skipped when null) and returns the display path of the entry with `primary: true`; if the policy has several roots only the primary is returned (the top bar shows one path); text is a display form with `~` substitution done by the engine (PERM view) - the UI never expands or builds paths.
6. Isolated Workspaces: `isolated` is exposed for the switcher badge ('izolowany'); no behaviour differences here (visibility rules live in VIS/engine).
7. Paused flag from the list is used only as a hint for the switcher dot (grey); the authoritative pause state is PAUSE's.
8. Testing helper `FakeWorkspaceProvider` for features (`{ workspaces, currentId }` props) exported from `app/workspace/testing.tsx`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `useGatewayQuery`, event hub (SHELL005/006), `api:workspaces.list` (DATA011 route + client), `api:perm.policies` (PERM026), `useToast` (DS037).
- `WorkspaceSummary` type from `@overmind/contracts` (DATA009).

## 8. Architecture and code placement

`apps/desktop/src/app/workspace/{workspace-provider.tsx,use-current-workspace.ts,use-workspaces.ts,use-workspace-display-path.ts,workspace-gate.tsx,testing.tsx}`. UI state layer; it does not own any engine data and never writes Workspaces.

## 9. Security and safety

- The stored id is only a hint: it is validated against the engine's list on every load; an id from another installation or a tampered value is ignored (no information leak, no access effect: the engine authorises every call regardless of the UI's current Workspace).
- Isolated Workspace data stays in the engine; the UI keeps only summaries in memory (data layer rule).
- `localStorage` can be cleared or blocked: the app must work (first Workspace is selected).
- Workspace names are untrusted text: rendered as text, truncated with ellipsis by consumers.

## 10. Errors and edge cases

- Empty list: current is `null`; no toast.
- Stored id deleted while the app was closed: silently falls back (no toast on startup, only when it happens during the session).
- List call fails: `WorkspaceGate` shows the route-level error state with retry (not a blank screen).
- Name collision/rename: the name updates through `workspace.renamed` invalidation.
- Two Workspaces with the same name differ by slug in the menu tooltip (SHELL017).

## 11. Acceptance criteria

- [ ] Given stored id A present in the list then current is A.
- [ ] Given stored id missing then current is the first list item.
- [ ] Given the current Workspace is deleted during the session then current switches to the fallback and a polite toast appears.
- [ ] Given storage throws then the first Workspace is selected and nothing crashes.
- [ ] Given an empty list then `useCurrentWorkspace()` returns `null`.
- [ ] The path hook returns the primary directory display path from a fixture policy.

## 12. Test plan

- Vitest with `createFakeApiClient` + `FakeEventSource`: resolution table, deletion fallback, storage failure, path hook.
- Commands: `pnpm --filter @overmind/desktop test workspace`.

## 13. Parallelization notes

Parallel with SHELL012..014. PAUSE011 and many views consume `useCurrentWorkspaceId`; keep its signature stable.

## 14. Open questions and assumptions

- ASSUMPTION: `workspaces.list` is ordered by recent activity (`updatedAt desc`); if DATA011 orders differently the 'first' rule stays but yields a different default.
- OPEN: remember the selection in engine config instead of the browser (SETUI) so the tray and the main window agree; default per-window storage, the tray ignores the selection.
- ALIASES: this task also provides `lib:active-workspace`, `lib:use-active-workspace`, `lib:current-workspace`, the names other view areas reported; they are the same module as the primary capability (no second implementation).
