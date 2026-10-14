---
id: OVE_SHELL009
title: "Collect feature manifests and build the navigation model (rail slots, tabs, routes)"
area: SHELL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DS009]
soft_depends_on: []
provides: ["lib:nav-model", "lib:rail-slots", "doc:desktop-navigation", "lib:route-table"]
needs: ["lib:feature-manifest", "ui:icons"]
owns: ["apps/desktop/src/app/nav/rail-slots.ts", "apps/desktop/src/app/nav/tab-sets.ts", "apps/desktop/src/app/nav/build-nav-model.ts", "apps/desktop/src/app/nav/route-table.ts", "apps/desktop/src/app/nav/collect-app-features.ts", "apps/desktop/src/app/nav/types.ts", "apps/desktop/src/app/nav/__fixtures__/**", "apps/desktop/src/app/nav/__tests__/**", "docs/architecture/desktop-navigation.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [24, 28]
---

# OVE_SHELL009: Collect feature manifests and build the navigation model (rail slots, tabs, routes)

## 1. Summary

Implements the pure functions that turn the auto-discovered `feature.manifest.ts` files into the navigation model of the app: the closed set of seven rail slots (5 + Agents + Settings), the sub-tab sets per slot, the route table with its metadata and the status-item slots. Features plug in by adding a manifest, never by editing a shared file.

## 2. Context

ARCH009 fixes the manifest shape (`defineFeature`) and the generic validation in `collectFeatures`; it says the SHELL area builds the rail, tabs and routes. The product rules come from `docs/design/styl-wizualny.md` ('Lewy pasek ma tylko miejsca, do których wraca się codziennie. Podsekcje idą do zakładek, a sprawy pilne do górnego paska'). Rail: top group Workspace'y (home), Chief (chat), Workflow (workflow), Tablica Zadań (board), Rejestr decyzji (scales); below a divider Agenci (agents); at the very bottom Ustawienia (settings). Tabs: Workflow = Canvas | Runy i Activity; Agenci = Agenci | Skille; Ustawienia = Ten Workspace | Połączenia i modele | Aplikacja. Approvals and Access Requests have NO rail item: they open from the top-bar button with the counter (VIEWS: 'Zgody has no active rail item'). Because every view is built by a different agent area, a closed, typed slot list prevents accidental new rail items.

## 3. Scope (in)

- `RAIL_SLOTS` constant (7 entries: id, icon, group, order, i18n label key, default route) and `TAB_SETS` (which slots have sub-tabs and their expected tab ids).
- `buildNavModel(features): NavModel` pure function and `NavModel` types.
- `buildRouteTable(features): RouteRecord[]` with metadata `frame`, `topBar`, `nav`, `namespaces`, `titleKey`.
- `collectAppFeatures()` wrapper calling `collectFeatures(import.meta.glob('../features/*/feature.manifest.ts', { eager: true }))` (ARCH009) and returning the validated model; unit tests with fixture manifests.
- Convention document `docs/architecture/desktop-navigation.md` (route table of the product, how to add a feature).

## 4. Out of scope

- Rendering the rail and tabs (OVE_SHELL013/014).
- The router (OVE_SHELL010).
- Feature manifests of the view areas (each feature creates its own).

## 5. Detailed requirements

1. `RAIL_SLOTS` (exact, this is the 7-icon rule): `workspaces` icon `home` group `primary` order 10 default route `/`; `chief` icon `chat` primary 20 `/chief`; `workflow` icon `workflow` primary 30 `/workflow`; `board` icon `board` primary 40 `/board`; `decisions` icon `scales` primary 50 `/decisions`; `agents` icon `agents` group `secondary` 10 `/agents`; `settings` icon `settings` group `footer` 10 `/settings/workspace`. Label keys `shell:rail.<id>`; aria label of the nav landmark `a11y:rail.label`. Adding an eighth slot requires editing this constant (a deliberate, reviewed change, documented in the doc).
2. `TAB_SETS`: `workflow: ['canvas','runs']`, `agents: ['agents','skills']`, `settings: ['workspace','connections','app']`. Slots without tab sets (`workspaces`, `chief`, `board`, `decisions`) show no sub-tab bar. Tab order is by manifest `order`, ties by id.
3. Manifest conventions the builder validates on top of ARCH009: a nav item with `area: 'rail'` MUST have an `id` from `RAIL_SLOTS`, otherwise the build model throws `NAV_UNKNOWN_RAIL_SLOT` (message lists the allowed ids); at most ONE manifest may claim each rail slot (`NAV_DUPLICATE_RAIL_SLOT`, both feature ids in the message); a nav item with `area: 'tab'` (or the legacy alias `settings-tab`) MUST have `parent` equal to a slot in `TAB_SETS` and `id` in that set (`NAV_UNKNOWN_TAB`).
4. Route-to-nav link: a route's `meta.nav` equals the nav item id it represents (rail or tab). The rail item's link target is the route whose `meta.nav` equals the slot id; when a slot has tabs the link target is the FIRST tab's route (by order), or the last visited tab of that slot (remembered in memory only by SHELL013).
5. Route `meta` shape (zod, strict, validated in dev): `{ nav?: string; frame?: 'shell' | 'bare' (default 'shell'); topBar?: 'workspace' | 'plain' (default 'workspace'); titleKey?: string; fullBleed?: boolean }`. `frame: 'bare'` routes render without rail/top bar (the onboarding wizard, ONB). `topBar: 'plain'` omits the Workspace switcher (the Workspaces dashboard and App settings, as in the mocks, VIEWS 'Top bar 67px'). Pure validation errors carry the feature id.
6. Product route table (documented, each owned by its feature): `/` Workspaces (WSPACE), `/chief` and `/chief/:conversationId` (CHATUI), `/workflow` (WFED), `/workflow/runs` (RUNUI), `/board` (BOARDUI), `/decisions` (DECUI), `/agents` (AGUI), `/agents/skills` (SKUI), `/settings/workspace` (WSPACE), `/settings/connections` (CONNUI), `/settings/app` (SETUI, topBar plain), `/approvals` (APPRUI, no rail item, frame shell, active rail none), `/onboarding` (ONB, frame bare). Unknown feature route paths that collide fail `collectFeatures` (ARCH009).
7. `NavModel` = `{ rail: { primary: RailEntry[], secondary: RailEntry[], footer: RailEntry[] }, tabs: Record<SlotId, TabEntry[]>, routes: RouteRecord[], statusItems: StatusItem[], namespacesByRoute: Record<path, string[]> }` where `RailEntry = { id, icon, labelKey, to, featureId? }`. A slot whose feature has not been built yet (no manifest) is still present with `to` = its default route and `available: false` (the rail shows it, the router renders the shared 'not available yet' placeholder route from SHELL010).
8. Status items (`statusItems` of manifests with `slot: 'top-bar' | 'tray'`) are collected, sorted by `order`, and exposed for SHELL017 (top bar extra items) and TRAY (tray extras); the core top bar controls (limit meter, slots, Telegram, approvals, Global Pause) are NOT manifest-driven (they are fixed product elements, SHELL016).
9. Deterministic output (sorted, no Map iteration order assumptions) so snapshot tests are stable; the function is pure (no `import.meta`, no React).

## 6. Design notes

N/A, functionality only. (Rail visuals: OVE_SHELL013.)

## 7. Reuse

- `defineFeature`, `collectFeatures`, `FeatureManifest` (OVE_ARCH009 `lib:feature-manifest`), icon names from `ui:icons` (type only).
- No hand-maintained lists of routes anywhere else; the router (SHELL010) and the rail (SHELL013) read the model.

## 8. Architecture and code placement

`apps/desktop/src/app/nav/{rail-slots.ts,tab-sets.ts,build-nav-model.ts,route-table.ts,collect-app-features.ts,types.ts}`, `docs/architecture/desktop-navigation.md`. Pure TypeScript domain-like logic inside the UI app (no React, no router), depends on `shared/extension/collect-features.ts` only.

## 9. Security and safety

- Route metadata and nav labels are static data from the repo; no runtime plugin loading from disk or network (no feature can be injected by data, only by code review).
- A feature cannot silently add a rail icon (closed set) or override another feature's route (duplicate detection).
- Deep links from notifications (`route` strings, NOTIF012) are validated by SHELL010/023 against the route table before navigation (regex plus membership).

## 10. Errors and edge cases

- Two manifests claim `board`: build fails with both ids.
- Manifest declares a tab whose parent has no tab set: `NAV_UNKNOWN_TAB`.
- Feature not built yet: slot present, `available: false`.
- Route without `meta.nav`: allowed (detail routes like `/chief/:conversationId` inherit the nav of the closest parent path, longest-prefix rule, tested).
- Manifest `order` ties: stable by id.
- Settings has no `Aplikacja` feature yet: the tab is hidden, not an error (tab entries come from manifests; `TAB_SETS` only validates ids).

## 11. Acceptance criteria

- [ ] Given fixture manifests for all views then `buildNavModel` returns 5 primary, 1 secondary and 1 footer rail entries in the order above.
- [ ] Given tab fixtures then workflow has `canvas`, `runs`; agents has `agents`, `skills`; settings has three tabs.
- [ ] Given an unknown rail id then the builder throws `NAV_UNKNOWN_RAIL_SLOT` naming the allowed ids.
- [ ] Given `/chief/abc` then the active slot is `chief` (longest-prefix).
- [ ] Given `/approvals` then no rail slot is active.
- [ ] `docs/architecture/desktop-navigation.md` documents the table and the add-a-feature recipe.

## 12. Test plan

- Vitest with fixture manifests under `app/nav/__fixtures__/`: valid full model, each error code, determinism (shuffle input), longest-prefix matching.
- Commands: `pnpm --filter @overmind/desktop test nav`.

## 13. Parallelization notes

Starts early (needs ARCH009's `collectFeatures`); SHELL007/010/013/014 depend on it. Hotspot: `rail-slots.ts` (single owner: this task; changes via proposal).

## 14. Open questions and assumptions

- ASSUMPTION: Approvals live at `/approvals` and are opened from the top-bar button (VIEWS shell).
- ASSUMPTION: `topBar: 'plain'` follows the mocks (no switcher on Workspaces and App settings) although inventory E1 suggests the same bar everywhere; reversing it is a one-line change in the route meta of two features.
- OPEN: whether `settings` default route should be remembered (last visited tab) across restarts; default no.
