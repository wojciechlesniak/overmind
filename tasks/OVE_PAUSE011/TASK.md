---
id: OVE_PAUSE011
title: "Show the paused state of the top bar: banner, drain text and Workspace scope"
area: PAUSE
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS043, OVE_PAUSE010]
soft_depends_on: []
provides: ["ui:PauseBannerHost"]
needs: ["ui:TopBar", "ui:PausedBanner", "ui:Button", "lib:use-pause"]
owns: ["apps/desktop/src/features/pause/PauseBannerHost/**"]
reads: []
design: design.png
design_source: "Pulpit#shell/top-bar (one-row variant) (crop 72,0,1368,67); the paused banner itself is NOT in any mock (E33), see Design notes"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5]
---

# OVE_PAUSE011: Show the paused state of the top bar: banner, drain text and Workspace scope

## 1. Summary

Feeds the top bar's `banner` slot with the DS `PausedBanner` driven by the live pause snapshot: 'Wszystko wstrzymane' with 'Wznów' for Global Pause, a drain message while Agents finish their current step, and a Workspace-scoped variant when only the current Workspace is paused.

## 2. Context

Inventory E33 says: no view shows Global Pause active; recommended design is a magenta-tint banner 'Wszystko wstrzymane' with a 'Wznów' button in the top bar. The DS provides the `PausedBanner` and the TopBar `banner` slot (OVE_DS042/043). This task selects the right banner variant from engine state for every desktop view.

## 3. Scope (in)

- `PauseBannerHost` component returning the banner node (or null) for the current Workspace.
- Variants: running (none), pausing, paused-global, paused-workspace, paused-both.
- Document title and live-region announcements.

## 4. Out of scope

- The pure banner component: OVE_DS042. Resume confirmation: reused from OVE_PAUSE010 (`GlobalPauseControl` exposes `requestResume()` through the hook).
- Composers/approvals disabled state: OVE_PAUSE012.

## 5. Detailed requirements

1. `PauseBannerHost({ workspaceId? })` reads `usePause()` and the current Workspace id from the router context (SHELL provides `useCurrentWorkspaceId()`; the prop overrides it for tests and for the Workspaces dashboard where there is none).
2. Variant selection (pure function `selectBanner(view, workspaceId)` in the same folder, unit tested): (1) global `paused` and `phase: 'pausing'` -> message `Wstrzymywanie: {{count}} Agentów kończy bieżący krok`; the 'Wznów' button is already shown (the Owner may change their mind); (2) global `phase: 'paused'` -> `Wszystko wstrzymane` + 'Wznów'; (3) only the current Workspace paused -> `Ten Workspace jest wstrzymany` + 'Wznów Workspace'; (4) global paused AND current Workspace paused -> global message plus a secondary line `Ten Workspace jest też wstrzymany osobno`; (5) nothing paused -> null.
3. 'Wznów' (global) calls the same resume flow with confirmation as the top bar button (shared function from OVE_PAUSE010). 'Wznów Workspace' calls `setWorkspacePause(id,false)` without confirmation (narrow effect) and shows a toast 'Workspace wznowiony'.
4. On the Workspaces dashboard (no current Workspace) variants (1), (2) are shown; (3) is not (dashboard cards show their own state, OVE_PAUSE014).
5. Accessibility: the banner container has `role="status"`; entering the paused state is announced once ('Wszystko wstrzymane'); the drain counter updates are throttled to one announcement per 5 s (`aria-live="polite"`, text node changes only when the number changes).
6. The document title becomes `⏸ Overmind` while globally paused (restored on resume); handled by a `useEffect` with cleanup.
7. i18n keys (`pause` namespace): `banner.paused`, `banner.pausing` (plural), `banner.workspacePaused`, `banner.workspaceAlso`, `banner.resume`, `banner.resumeWorkspace`, `toast.workspaceResumed`.

## 6. Design notes

`design.png` is the one-row 67px top bar of the Workspaces view (running state) so the implementer sees exactly where the banner goes: it is rendered ABOVE this row inside the same sticky `<header>` (OVE_DS043 requirement 6: banner 36px + 67px). Anatomy of the banner (DS042 requirement 8, since the mock does not draw it): full width, fill `rgba(242,95,196,.12)`, 1px bottom border magenta at 40% alpha, 16px `pause` icon, message 13/600 in `#FFD3F1`, `Button primary-magenta` size sm 'Wznów' right-aligned. The Workspace-only variant uses the same shape with the neutral violet tint (`rgba(155,123,255,.10)`) to distinguish it from the global emergency state. States not shown: pausing (adds the drain sentence), Workspace scope, both; hover/focus on the button follow Button rules.

## 7. Reuse

- `ui:PausedBanner`, `ui:Button`, `ui:TopBar` banner slot (DS042/043); `usePause`, resume flow (OVE_PAUSE010); api-client `setWorkspacePause` (OVE_PAUSE007); router context hook from SHELL (`useCurrentWorkspaceId`, a `needs` of `lib:shell-context` if SHELL names it differently the linker adapts).

## 8. Architecture and code placement

`apps/desktop/src/features/pause/PauseBannerHost/{PauseBannerHost.tsx,select-banner.ts,*.stories.tsx,*.test.tsx}`; exported through the feature manifest slot `topBar.banner`. Pure selection logic is separated from React so it is unit-testable (SRP).

## 9. Security and safety

- All pause state comes from the gateway; the UI never stores 'paused' in localStorage or decides authority itself (the engine enforces; the UI only reflects).
- All strings are rendered as React text nodes; no HTML injection; labels come from i18n keys with only numeric and Workspace-name params (Workspace names are untrusted text, truncated with ellipsis).
- A failed pause call is shown as an error and the button returns to its previous state; the UI never shows 'paused' before the engine confirmed (no optimistic state), because a false sense of safety is worse than a delay.

## 10. Errors and edge cases

- Snapshot unavailable: no banner (the control shows 'unavailable'); stale banners are never shown after reconnect because the initial snapshot event replaces state.
- Both global and Workspace paused and the Owner resumes global: banner switches to the Workspace variant (still paused).
- Very long Workspace name: not shown in the banner (the Workspace switcher shows it).
- Drain count 0 and phase `pausing` for one tick: shows 'Wszystko wstrzymane' (phase decides, not the number).
- Engine restarts while paused: banner is present from the first snapshot.

## 11. Acceptance criteria

- [ ] Given global paused with drain 2, Then the banner reads 'Wstrzymywanie: 2 Agentów kończy bieżący krok' with a Wznów button.
- [ ] Given phase paused, Then 'Wszystko wstrzymane'; clicking Wznów opens the same confirmation as the top bar.
- [ ] Given only the current Workspace paused, Then 'Ten Workspace jest wstrzymany' and 'Wznów Workspace' resumes it without confirmation.
- [ ] Given nothing paused, Then nothing is rendered and the header height is 67px.
- [ ] The document title shows the pause marker while globally paused.
- [ ] axe clean; the banner is announced once by `role=status`.

## 12. Test plan

Unit: `select-banner.test.ts` (table of all 5 variants), `PauseBannerHost.test.tsx` with fake `usePause`; stories for each variant with layout in the TopBar (visual snapshot of the banner states; baseline created from the DS042 `design-pause-banner.png`); Playwright `pause-banner.spec.ts` against the mock gateway. Commands: `pnpm --filter desktop test pause`.

## 13. Parallelization notes

Parallel with OVE_PAUSE012 to 015 once OVE_PAUSE010 merged. It only exports a slot; the TopBar composition owner (SHELL) wires `banner={<PauseBannerHost/>}` via the manifest.

## 14. Open questions and assumptions

- DESIGN GAP E33: banner not in a mock; the neutral Workspace-scope tint is a proposal (design system rule: scope differences are shown by word and tint, not colour alone).
- OPEN: copy 'Wznów Workspace' vs 'Wznów' (the tray uses 'Wznów „Research rynku”'); default as written.
