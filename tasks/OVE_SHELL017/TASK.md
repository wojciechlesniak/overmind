---
id: OVE_SHELL017
title: "Wire the top-bar interactions: Workspace switching, pause controls and the paused banner"
area: SHELL
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS029, OVE_PAUSE010, OVE_PAUSE011, OVE_SHELL010, OVE_SHELL011, OVE_SHELL016]
soft_depends_on: []
provides: ["lib:use-switcher-controller", "lib:topbar-pause-slots"]
needs: ["ui:GlobalPauseControl", "ui:PauseBannerHost", "lib:use-pause", "lib:use-navigate-to-route", "ui:Menu"]
owns: ["apps/desktop/src/app/topbar/use-switcher-controller.ts", "apps/desktop/src/app/topbar/resolve-target-after-switch.ts", "apps/desktop/src/app/topbar/pause-slots.tsx"]
reads: []
design: design.png
design_source: "Main#shell/top-bar-workspace-switcher + top-bar-global-pause (crop 72,0,480,117: switcher, root path and the wrapped Global Pause row at 92,64 of the 117 px mock)"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [10, 15]
---

# OVE_SHELL017: Wire the top-bar interactions: Workspace switching, pause controls and the paused banner

## 1. Summary

Connects the interactive parts of the top bar: choosing a Workspace in the switcher menu (and creating one), hosting the Global Pause control and the paused banner supplied by PAUSE, and the keyboard and focus behaviour of the bar. No new visuals.

## 2. Context

OVE_SHELL016 renders the bar statically. The switcher menu (DS043 `ui:Menu` listbox) lists every Workspace and 'create'; selecting one must change the app-wide current Workspace (SHELL011) and navigate sensibly. The Global Pause button and the paused banner are owned by PAUSE010/011 (`ui:GlobalPauseControl`, `ui:PauseBannerHost`); SHELL only provides the slots, so the two areas do not edit each other's files. The design (design-main crop of the controls) shows the right-hand controls, including the amber approvals button and the Global Pause button.

## 3. Scope (in)

- `useSwitcherController()`: options mapping, select handler, create handler, announcement.
- Navigation rule after switching: stay on the same route when it is Workspace-scoped; go to the nav rail's section root when the route is a Workspace detail route with ids (e.g. an open Task).
- 'Nowy Workspace' action: navigates to the Workspaces dashboard create flow (`useNavigateToRoute('workspaces.new')`), or opens the wizard step 3 when no Workspace exists.
- Mount `PauseControlSlot` with `ui:GlobalPauseControl` (PAUSE010) and `PauseBannerSlot` with `ui:PauseBannerHost` (PAUSE011) through the slot hooks of SHELL016.
- Keyboard: ArrowDown on the switcher opens the menu; `Esc` closes and returns focus; optional shortcut registration `workspace.switch` consumed by OVE_SHELL024.

## 4. Out of scope

- Pause semantics and confirm dialog (PAUSE010).
- Switcher visuals (DS043).
- Deleting or renaming Workspaces (WSPACE).

## 5. Detailed requirements

1. **Select.** `onSelectWorkspace(id)` -> `setCurrentWorkspace(id)` (SHELL011) then `navigate(resolveTargetAfterSwitch(location, nav))`: if the matched route's meta has `scope: 'workspace'` and no `:id` params, keep the path; if it has entity params (e.g. `/board/tasks/:taskId`), go to the parent list route; routes with `scope: 'global'` (Chief, Workspaces dashboard) keep the path and only change the highlight. Pure function with table tests.
2. **Live region.** After a switch the polite live region announces 'Workspace: {{name}}' (`shell:workspace.switched`, SHELL011). Focus returns to the switcher button.
3. **Create.** `onCreateWorkspace` navigates to the create flow. While Global Pause is active creation is still allowed (it starts nothing); no guard.
4. **Pause slots.** `PauseControlSlot` renders `<GlobalPauseControl />` from PAUSE010 (props-free; it reads `usePause()` itself). `PauseBannerSlot` renders `<PauseBannerHost workspaceId={currentId} />` (PAUSE011). If either import fails at build time the linker error is the signal; at runtime each slot is wrapped in the boundary from SHELL019 with the fallback `Global Pause` button (a bare `ui:Button` calling `pause.global` through `useGatewayMutation`) so stopping everything is always possible.
5. **Tab order.** Switcher, limit popover trigger (if overflow), approvals link, Global Pause; verified by a Playwright keyboard test. The bar is not a toolbar (no roving tabindex).
6. **Approvals badge on the rail.** Not part of the bar; the rail badge (not in the mock) is a DESIGN GAP listed in SHELL013.
7. **Per-Workspace pause hint.** When the current Workspace is paused but Global Pause is off, the switcher `state` is `paused` (grey dot) and PAUSE011's banner explains it; the switcher does not add text.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `useWorkspaces`, `useSetCurrentWorkspace` (SHELL011), `useNavigateToRoute` (SHELL010), `ui:Menu` behaviour inside `ui:WorkspaceSwitcher`, `ui:GlobalPauseControl`, `ui:PauseBannerHost` (PAUSE010/011), slot hooks (SHELL016).

## 8. Architecture and code placement

`apps/desktop/src/app/topbar/{use-switcher-controller.ts,resolve-target-after-switch.ts,pause-slots.tsx}`. UI composition layer. Imports PAUSE components only through the ui or feature barrel named in `needs`.

## 9. Security and safety

- Switching Workspace changes only what the UI requests; the engine authorises every call independently (no client-side trust).
- The fallback Global Pause button uses an idempotency key and the standard mutation hook; it cannot be used to resume without the PAUSE rules (resume confirmation lives in PAUSE010; the fallback only pauses, resume requires the normal control).
- Workspace names are plain text in options (no markup).

## 10. Errors and edge cases

- Selected Workspace deleted between menu open and click: `setCurrentWorkspace` ignores the id; a toast 'Workspace nie istnieje' (`shell:workspace.gone`) appears.
- Switch while a navigation is pending: last choice wins.
- Menu open and the list refreshes: options update, the highlighted index is preserved by id.
- Zero Workspaces: the switcher is not rendered (wizard or empty dashboard).
- PAUSE components not installed (dev build): fallback button shown, console warning in dev only.

## 11. Acceptance criteria

- [ ] Given two Workspaces when the Owner selects the other then the current id changes, the route is kept if scoped, and the live region announces it.
- [ ] Given an open Task route when switching then the app goes to the Board list.
- [ ] Given the Esc key then the menu closes and focus returns to the switcher button.
- [ ] Given PAUSE slots failing to render then the fallback pause button is present and works.
- [ ] Given the keyboard Tab order then it matches the specified order.

## 12. Test plan

- Vitest for `resolveTargetAfterSwitch` (table) and the controller with fake providers.
- Storybook play tests: open menu, arrow keys, select, Esc.
- Playwright (TEST004): switch Workspace, assert URL and focus.
- Commands: `pnpm --filter @overmind/desktop test topbar`.

## 13. Parallelization notes

After SHELL016 and PAUSE010/011. Parallel with SHELL018. Hotspot: none (own files).

## 14. Open questions and assumptions

- ASSUMPTION: route meta carries `scope: 'workspace'|'global'` (SHELL009 route table); if the manifest lacks it, the default is `workspace`.
- OPEN: should the bar offer a keyboard shortcut for the switcher (e.g. ⌘K)? Not in the mock; proposed in SHELL024.
