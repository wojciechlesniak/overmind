---
id: OVE_SHELL025
title: "Manage page titles, route focus and the first-run guard"
area: SHELL
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ONB011, OVE_SHELL009, OVE_SHELL010]
soft_depends_on: ["OVE_ONB011"]
provides: ["lib:first-run-guard", "lib:use-document-title"]
needs: ["lib:use-onboarding-state", "lib:route-guards-slot", "lib:route-table"]
owns: ["apps/desktop/src/app/router-behaviour/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [10]
---

# OVE_SHELL025: Manage page titles, route focus and the first-run guard

## 1. Summary

Adds three small cross-cutting behaviours to the router: the document title per route ('Pulpit · Overmind'), focus and announcement management on navigation (accessibility), and the first-run route guard that sends a new installation to the onboarding wizard and back to the app after completion.

## 2. Context

Fourteen views share the shell; each route has a manifest with a title key (SHELL009 route meta). The wizard (ONB) is a bare route outside the shell frame. SHELL010 evaluates `RouteGuard` slots in order and left the first-run guard to this task; the guard consumes `lib:use-onboarding-state` from ONB011. Focus management matters because the page does not scroll as a document and the rail is persistent: after navigation, keyboard users must land on the new content.

## 3. Scope (in)

- `useDocumentTitle()` driven by route meta `titleKey` and optional dynamic suffix hook (`useRouteTitleSuffix(name)` for entity pages).
- `RouteFocusManager`: on pathname change (not on search/hash changes) moves focus to `<main id="main">` heading (`h1` or the container with `tabIndex=-1`) and sets a polite live-region message 'Widok: {{title}}'.
- `FirstRunGuard` registered into `RouteGuard` slots: loading -> shell skeleton; `needsOnboarding` -> redirect to `/onboarding` (replace); onboarding done and on `/onboarding` -> redirect to `/`.
- Deep links (notification route) pass through the same guard.

## 4. Out of scope

- The wizard itself (ONB011+), onboarding state API (ONB003/009).
- Offline/engine gate (SHELL020, evaluated before this guard).
- Scroll restoration (disabled by design).

## 5. Detailed requirements

1. **Title format.** `{{page}} · Overmind`; page from `t(meta.titleKey)`; for the Workspace-scoped views `{{page}} · {{workspace}} · Overmind`; wizard: `Pierwsze uruchomienie · Overmind`. Title updates after namespace load (no flash of keys). The Tauri window title mirrors `document.title` via the platform call `desktopShell.setTitle` only if the shell exposes it (otherwise unchanged).
2. **Focus.** After navigation, `requestAnimationFrame` then focus the first of: `[data-autofocus]`, the first `h1` in `main`, `main` itself (`tabIndex=-1`, outline suppressed only for programmatic focus via `:focus-visible` semantics). Skipped when the navigation was caused by a pointer click on a rail item (focus remains on the rail item to keep roving order) and when a dialog is open. The live region announcement is debounced 150 ms.
3. **Guard logic.** `useOnboardingState()` (ONB011) returns `{ status: 'loading'|'ready', needsOnboarding: boolean, step: 1|2|3|4|'done' }`. Rules: (1) loading and not on `/onboarding` -> render `RouteSkeleton`; (2) `needsOnboarding` and path not under `/onboarding` -> `<Navigate to='/onboarding' replace/>` (the wizard resumes at the stored step); (3) not `needsOnboarding` and path under `/onboarding` -> `<Navigate to='/' replace/>`; exception: the final hand-off screen of ONB022 keeps the route until the Owner continues.
4. **Detection rule.** First run = no completed onboarding record (ONB003). A reinstall with existing data is NOT first run. The guard never infers it from the Workspace list.
5. **Settings access during onboarding.** Routes other than `/onboarding` are blocked while `needsOnboarding` (the Owner finishes or skips the optional step 4, but folder and CLI are required: SPEC 16.1: no folder, no agent access).
6. **Engine ordering.** The guard runs inside `EngineStatusGate`, so it only evaluates when the engine is ready.
7. **Window size.** On `/onboarding` the window uses the same minimum size (SHELL008); no special sizing.
8. **Tests helper.** `renderWithOnboardingState(state)` using a fake `useOnboardingState` provider for features' tests.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `RouteGuard` slot (SHELL010), route meta (SHELL009), `useOnboardingState` (ONB011), `desktopShell` (SHELL003), live-region utility (SHELL011/SHELL012 patterns).

## 8. Architecture and code placement

`apps/desktop/src/app/router-behaviour/{use-document-title.ts,route-focus-manager.tsx,first-run-guard.tsx,register-guards.ts,testing.tsx}`. UI infrastructure; guard registered through the slot, no edits to SHELL010 files.

## 9. Security and safety

- The guard is a UX gate, not a security control: the engine enforces permissions regardless of the route; the wizard cannot grant access through URL manipulation.
- Redirects use `replace` and fixed targets (no open redirect from query params).
- Titles are built from i18n keys and a Workspace name as text.

## 10. Errors and edge cases

- Onboarding state call fails: the guard shows the route error card with retry (does not assume done or not done).
- Owner deletes all Workspaces after finishing the wizard: not first run; the dashboard shows its empty state.
- Back/forward into `/onboarding` after completion: redirect to `/`.
- Stored step greater than 4 or invalid: the wizard clamps to step 1 and keeps stored answers (ONB003 decides).
- Direct deep link to a route while first run: redirected; the original target is forgotten (no auto-resume to it).

## 11. Acceptance criteria

- [ ] Given a fresh installation then the app opens `/onboarding` at the stored step.
- [ ] Given onboarding completed then `/onboarding` redirects to `/`.
- [ ] Given navigation by keyboard then focus lands in `main` and the title updates.
- [ ] Given a pointer click on a rail item then focus is not stolen.
- [ ] Given the state call failing then an error card with retry appears, not a redirect.

## 12. Test plan

- Vitest + Testing Library with `createMemoryRouter`, fake onboarding state: guard table, title builder, focus.
- Playwright: fresh data dir -> wizard; after completion -> dashboard.
- Commands: `pnpm --filter @overmind/desktop test router-behaviour`.

## 13. Parallelization notes

After SHELL010 and ONB011 (can be developed against the `testing.tsx` fake). Independent of other SHELL tasks.

## 14. Open questions and assumptions

- ASSUMPTION: `lib:use-onboarding-state` exists with the shape above (ONB011); if ONB changes it, only the adapter line here changes.
- OPEN: `desktopShell.setTitle` is not in SHELL003; the macOS title bar may show the static 'Overmind'; acceptable.
