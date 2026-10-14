---
id: OVE_SHELL010
title: "Build the app bootstrap: provider stack, router, lazy routes and not-found"
area: SHELL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS032, OVE_DS037, OVE_SETUP009, OVE_SHELL003, OVE_SHELL004, OVE_SHELL005, OVE_SHELL006, OVE_SHELL007, OVE_SHELL008, OVE_SHELL009]
soft_depends_on: []
provides: ["lib:app-router", "lib:app-providers", "lib:use-navigate-to-route", "lib:route-guards-slot"]
needs: ["lib:nav-model", "ui:Skeleton", "ui:EmptyState", "ui:Button", "ui:ToastProvider", "lib:desktop-scaffold"]
owns: ["apps/desktop/src/app/App.tsx", "apps/desktop/src/app/AppProviders.tsx", "apps/desktop/src/app/router/**", "apps/desktop/src/main.tsx"]
reads: ["apps/desktop/index.html"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [18]
---

# OVE_SHELL010: Build the app bootstrap: provider stack, router, lazy routes and not-found

## 1. Summary

Replaces the SETUP009 placeholder `App.tsx` with the real app root: the ordered provider stack, a router generated from the navigation model, lazy route loading with namespace preloading and a Suspense fallback (skeleton), the window-kind switch (`main` vs `tray`), and the shared 'not available yet' and 404 pages.

## 2. Context

SETUP009 left `apps/desktop/src/app/App.tsx` as `// PLACEHOLDER(SHELL): replaced wholesale by the SHELL area` and `main.tsx` unchanged. SHELL owns `src/app/`. Navigation comes from OVE_SHELL009 (`NavModel.routes`), data/events/i18n/theme/platform/API providers from SHELL003..008. The router library is a decision recorded here: `react-router` v7 in declarative/data-router library mode (`createBrowserRouter`; Tauri serves `tauri://localhost` so history API works; deep links are in-app only). Justification (dependency policy): value - lazy routes, nested layouts (shell frame as a layout route), `useMatches` for route meta; cost - one well-maintained MIT dependency; alternatives: `wouter` (too small for nested layouts and matches), TanStack Router (heavier, type generation), hand-rolled (more code). ASSUMPTION until the Owner objects.

## 3. Scope (in)

- Dependency `react-router` (catalog pin) and `docs/dependencies.md` entry.
- `App.tsx` and `AppProviders` composing the fixed provider order.
- Router factory `createAppRouter(navModel)`; layout route placeholders `ShellFrameRoute` (implemented by OVE_SHELL012) and bare routes.
- Route wrapper `LazyFeatureRoute` that preloads namespaces then renders the lazy element inside Suspense + error boundary.
- `NotAvailableRoute` (slot without feature) and `NotFoundRoute` (404) with navigation back to Workspaces.
- Window-kind switch: `?window=tray` renders `TrayApp` lazily (OVE_TRAY002), default renders the main app.
- `main.tsx` stays minimal; no global side effects.

## 4. Out of scope

- Shell frame, rail, top bar (OVE_SHELL012+).
- Error boundary components (OVE_SHELL019), engine-down gate (OVE_SHELL020) and mismatch screen (OVE_SHELL021): this task only mounts the slots where they go.
- Toast host (OVE_SHELL022).
- First-run redirect logic (OVE_SHELL025 with ONB011).

## 5. Detailed requirements

1. Provider order (outermost first), documented in code: `ThemeProvider (ThemeRoot)` > `PlatformProvider` > `I18nProvider` > `ErrorBoundaryRoot` (SHELL019) > `ApiClientProvider` > `QueryProvider` > `EventHubProvider` > `ToastProvider` (ui-kit, SHELL022 mounts its rules) > `ShortcutProvider` (SHELL024) > `WorkspaceProvider` (SHELL011) > `RouterProvider`. A test asserts the order by rendering a probe component that reads every context and by checking that each hook throws outside its provider.
2. Engine gate: inside `RouterProvider`'s root layout, `<EngineStatusGate>` (SHELL020) wraps ALL routes (the wizard also needs the engine) and renders the bare engine-down screen instead of children when state is `unavailable` or `incompatible`; this task mounts a no-op passthrough `EngineGateSlot` that SHELL020 fills (extension point: a registered component, no file edits).
3. Router: `createBrowserRouter` with routes from `navModel.routes`; element = `LazyFeatureRoute` using the manifest `element` (dynamic import), `namespaces` from the model; frame layout by route `meta.frame` (`shell` -> `ShellFrameRoute` layout, `bare` -> `BareFrameRoute`). `basename: '/'`. Scroll restoration disabled (panels scroll, the page does not).
4. `LazyFeatureRoute`: `useRouteNamespaces(namespaces)` (SHELL007) then `<Suspense fallback={<RouteSkeleton/>}>` where `RouteSkeleton` renders the shell frame content area with `ui:Skeleton` blocks (no layout shift); wraps the element in the route-level error boundary of SHELL019 (`RouteErrorBoundary` slot) with `resetKeys=[location.pathname]`.
5. `NotAvailableRoute`: uses `ui:EmptyState` with title key `shell:notAvailable.title` ('Not available yet' / 'Jeszcze niedostępne') and body 'This part of Overmind is not installed in this build.' (never shown in a finished product, but required while views are built in parallel). `NotFoundRoute`: `shell:notFound.title` ('Page not found' / 'Nie znaleziono strony') with a primary button 'Go to Workspaces' / 'Wróć do Workspace\'ów'.
6. Navigation helpers `useNavigateToRoute()` and `isKnownRoute(path)` (membership in the route table) exported for deep-link callers (notifications, tray, toasts).
7. Redirect rules live in route loaders-free guards: `/` renders the Workspaces feature; unknown nav slot default route redirects are not used. First-run redirect is added by OVE_SHELL025 as a layout-level guard using `RouteGuard` slots (list of guard components registered here, evaluated in order).
8. `main.tsx` may only be edited here to import `base.css` (SHELL008) and render `<App/>`; the single permitted non-null assertion remains.
9. Window kind: `const kind = new URLSearchParams(location.search).get('window')`; allowed values `tray` only; anything else is the main window (strict allowlist, no dynamic import of arbitrary names).

## 6. Design notes

N/A, functionality only (the loading skeleton uses DS `Skeleton`).

## 7. Reuse

- `collectAppFeatures`/`NavModel` (OVE_SHELL009), providers from SHELL003..008, `ui:Skeleton`, `ui:EmptyState`, `ui:Button` (DS), `useRouteNamespaces` (SHELL007).
- Do not duplicate route lists: only the nav model.

## 8. Architecture and code placement

`apps/desktop/src/app/{App.tsx,AppProviders.tsx}`, `app/router/{create-router.tsx,lazy-feature-route.tsx,not-found-route.tsx,not-available-route.tsx,guards.ts,use-navigate-to-route.ts}`, `app/main-entry.tsx` (if needed), `main.tsx` edit limited as above. UI composition root of the desktop app (dependency inversion: features register themselves, the app root knows only manifests).

## 9. Security and safety

- Deep links: `navigate(route)` accepts only paths in the route table (`isKnownRoute`); strings from notifications, Telegram or agents are never passed to the router unvalidated (open-redirect style abuse, `javascript:` URLs impossible since only in-app paths are allowed).
- `?window=` allowlist prevents loading arbitrary modules.
- No `dangerouslySetInnerHTML`, no `eval`; CSP stays strict.
- The not-found page never echoes the path unescaped (React text).

## 10. Errors and edge cases

- Unknown URL: `NotFoundRoute`.
- Lazy chunk fails to load: route error boundary with 'Reload' action (SHELL019).
- Feature manifest exists but the element import throws at module evaluation: error boundary, other routes unaffected.
- `/chief/<id>` for a conversation that does not exist: the feature handles it (not the shell).
- Navigation while the engine is down: the gate screen shows; after recovery the original location is kept.
- StrictMode: providers mount twice without duplicate side effects.

## 11. Acceptance criteria

- [ ] Given the full manifest fixtures then every route in the table is reachable and renders its fixture element lazily.
- [ ] Given an unknown path then the 404 page renders with a working link home.
- [ ] Given a slot without a manifest then `NotAvailableRoute` renders and the rail item still navigates.
- [ ] Given `?window=tray` then `TrayApp` is imported; given `?window=evil` then the main app renders.
- [ ] Given navigation to `/onboarding` then the bare frame renders (no rail).
- [ ] Provider order test passes; production bundle splits features into lazy chunks.

## 12. Test plan

- Vitest + Testing Library with `createMemoryRouter` and fixture manifests: route reachability, 404, placeholder, bare vs shell frame, namespace suspense, error boundary reset on navigation.
- Bundle check: feature chunks are separate files (assert in a build test).
- Commands: `pnpm --filter @overmind/desktop test router`.

## 13. Parallelization notes

Starts after SHELL004..009 contracts are stable (fakes allowed). Hotspot: `AppProviders.tsx` is the single place that lists providers; other tasks add providers only through the explicit slots named in this task (EngineGateSlot, RouteGuard list, ToastProvider mount point) and never edit this file; if a new provider is truly needed, file a proposal.

## 14. Open questions and assumptions

- ASSUMPTION: `react-router` v7 library mode (decision recorded in `docs/dependencies.md`).
- ASSUMPTION: the engine-down gate wraps all routes including the wizard.
- OWNERSHIP HAND-OVER: OVE_SETUP009 lists `App.tsx` and `main.tsx` in its `owns` as placeholders; this task takes them over after SETUP009 merges (the linker should drop them from SETUP009 or accept the sequential ownership via depends_on).
- OPEN: should the Workspace id appear in the URL (`/w/:id/board`)? Default NO: the current Workspace is global state (SHELL011) because the Chief view and Workspaces dashboard span Workspaces.
