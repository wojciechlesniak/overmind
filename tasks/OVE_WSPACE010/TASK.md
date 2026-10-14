---
id: OVE_WSPACE010
title: "Dashboard states: empty, loading, error, stale and section error boundaries"
area: WSPACE
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS031, OVE_DS032, OVE_WSPACE002, OVE_WSPACE003]
soft_depends_on: ["OVE_WSPACE011"]
provides: []
needs: ["ui:EmptyState", "ui:Skeleton", "ui:Button", "ui:Card"]
owns: ["apps/desktop/src/features/workspaces/components/DashboardStates.tsx", "apps/desktop/src/features/workspaces/components/SectionBoundary.tsx", "apps/desktop/src/features/workspaces/components/boundary/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [10]
---

# OVE_WSPACE010: Dashboard states: empty, loading, error, stale and section error boundaries

## 1. Summary

Implements the states the Pulpit mock does not draw: first-run empty state with 'Nowy Workspace', loading skeletons, per-section errors with retry, stale data marker, and error boundaries so a failing section never blanks the dashboard.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). VIEWS lists the missing states: no Workspaces yet (CTA 'Nowy Workspace'), loading skeleton for cards and notifications, empty notification centre, degraded system status, Global Pause active. They are derived from design-system rules (ui:EmptyState, ui:Skeleton).

## 3. Scope (in)

- `components/DashboardStates.tsx`: `EmptyWorkspaces`, `GridSkeleton`, `SectionError`, `StaleBadge`.
- `components/SectionBoundary.tsx` (React error boundary per slot, reports to the logger).
- Wiring in `Grid.slot` through the `vm.sections` status of OVE_WSPACE002 using the documented slot props (no edit of other tasks' files: states are exported and the route composes them).

## 4. Out of scope

- Per-component states of the chief strip, notifications and system list (their own tasks).
- The New Workspace dialog (OVE_WSPACE011).

## 5. Detailed requirements

1. Empty (Workspaces `ready` with 0 items): `ui:EmptyState` icon `home`, title `empty.title` ('You have no Workspace yet' / PL 'Nie masz jeszcze Workspace\'u'), body `empty.body` ('A Workspace is a project with its own folder access, Task Board and memory. Agents see nothing outside it.'), primary CTA `empty.cta` 'New Workspace' that opens the dialog of OVE_WSPACE011 (through the header action's exported `openNewWorkspace()`), secondary link to docs (route `/help` if present, else hidden). The Chief strip is hidden; side column stays visible.
2. Loading: first load shows 4 `CardSkeleton` placeholders in the grid with the same grid CSS (no layout shift), notification skeleton (kit `loading`), system skeleton rows; minimum display time 200 ms to avoid flicker (timer on the injectable clock).
3. Error (first load, no data): grid area shows `SectionError` `error.workspaces` ('Could not load Workspaces.') + `Retry` calling `sections.workspaces.refetch`; the error code is mapped to a message by `renderMessage` (ARCH011) and never shows raw server text; a collapsible 'Details' shows only `code` and `requestId`.
4. Stale: when a section has data but `status==='stale'`, show `StaleBadge` ('Showing data from {{age}} ago · Retry') above the section; announce once through the live region.
5. Global Pause active: a slim banner under the header: `pause.bannerHint` ('Everything is paused. Cards show the paused state.') - only if the top-bar banner of OVE_PAUSE011 is not present; ASSUMPTION: the shell shows its banner, so this is a text line only, not a second banner. Cards are handled by OVE_WSPACE006.
6. Boundary: each slot is wrapped in `SectionBoundary`; on render error it shows `SectionError` with 'Reload section' that remounts; errors are logged through the UI logger (no stack to the DOM).
7. Focus: after Retry succeeds focus moves to the first card; empty state CTA is focusable first.
8. Reduced motion: skeleton shimmer disabled under `prefers-reduced-motion` (kit).

## 6. Design notes

Derived from `ui:EmptyState`/`ui:Skeleton`/`ui:Card` (no mock). Layout of the empty state is centred in the grid area with max width 480; skeleton cards use `ui:Skeleton shape='card'` at 380x250.

## 7. Reuse

- `ui:EmptyState`, `ui:Skeleton`, `ui:Button`, `ui:Card`.
- `renderMessage` (ARCH011), `useT`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: error details never include response bodies; the boundary prevents a malformed server value from crashing the whole screen (availability) but never swallows silently (logged).

## 10. Errors and edge cases

- Empty and error at once (list failed): error wins.
- Retry spam: button disabled while refetching.
- Slot throws on every render: boundary stays in error state, no loop.
- Zero Workspaces but notifications exist: side column normal.

## 11. Acceptance criteria

- [ ] Given 0 Workspaces, Then the empty state with CTA shows and no card grid or Chief strip.
- [ ] Given first load, Then skeleton cards occupy the same grid and are replaced without layout shift.
- [ ] Given a failed list, Then an error with Retry shows and a retry refetches once.
- [ ] Given a throwing slot, Then only that slot shows the error.
- [ ] axe clean for all states.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `DashboardStates.test.tsx`, `SectionBoundary.test.tsx` (throwing child, reset), `empty-state.e2e.ts` (CTA opens dialog), stories per state. Commands: `pnpm --filter @overmind/desktop test components/DashboardStates`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/components/DashboardStates.tsx`, `apps/desktop/src/features/workspaces/components/SectionBoundary.tsx` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the route (OVE_WSPACE003) wraps slots with `SectionBoundary` from this task; if 003 merges first it renders a plain fallback and the PR of this task flips the import through the exported `SECTION_BOUNDARY` registry constant in `routes/placeholders.tsx` (owner 003)... To avoid editing 003, the route imports `SectionBoundary` lazily by glob `components/boundary/*.boundary.tsx`. Implementers coordinate through the proposal file if needed.
