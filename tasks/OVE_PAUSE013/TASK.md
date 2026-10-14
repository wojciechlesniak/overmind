---
id: OVE_PAUSE013
title: "Provide the tray menu pause model: Global Pause, Wstrzymaj and Wzn\u00f3w per Workspace"
area: PAUSE
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS042, OVE_DS085, OVE_PAUSE007, OVE_PAUSE010]
soft_depends_on: []
provides: ["lib:use-tray-pause-model"]
needs: ["ui:TrayMenu", "ui:TrayItem", "ui:GlobalPauseButton", "api:pause.workspace", "lib:api-client-pause"]
owns: ["apps/desktop/src/features/pause/tray/**"]
reads: []
design: design.png
design_source: "Tray#tray/item-pause-workspace, tray/item-resume-workspace, tray/global-pause (crop 16,310,348,160); design-header.png = Tray#tray/header (crop 16,16,348,62)"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5]
---

# OVE_PAUSE013: Provide the tray menu pause model: Global Pause, Wstrzymaj and Wznów per Workspace

## 1. Summary

Builds the pause-related data and actions of the menu-bar popover: the `Global Pause` button (toggles to 'Wznów wszystko'), the per-Workspace items 'Wstrzymaj „X”' and 'Wznów „Y”', and the header status tone and text while paused. The TRAY feature renders them through `ui:TrayMenu`.

## 2. Context

The Tray mock shows two Workspace items ('Wstrzymaj „Aplikacja rezerwacji”' with a pause icon, 'Wznów „Research rynku”' with an activity icon) and the tinted-magenta Global Pause button (42px). The popover is also the quickest way to stop everything when the main window is closed (ADR 0005). `ui:TrayMenu` (OVE_DS085) takes `items`, `globalPause` and `status` as props; this task computes them from engine state so the TRAY task only places them.

## 3. Scope (in)

- `useTrayPauseModel()` hook returning `{ status, items, globalPause, workspaceGroupsPaused }` ready for `TrayMenuProps`.
- Item generation rules (which Workspaces get a pause or a resume item, ordering, truncation).
- Header status text for paused and pausing.
- Unit tests and a story composition with `ui:TrayMenu`.

## 4. Out of scope

- The popover window, agent rows, pending-Approvals row, footer items: TRAY area.
- Tauri tray icon and window handling: SETUP010/TRAY.
- Quit confirmation while paused: TRAY.

## 5. Detailed requirements

1. Hook output types follow `TrayMenuProps` of OVE_DS085: `items: TrayItemData[]` (the pause items only; TRAY merges them with 'Napisz do Chiefa…'), `globalPause: { label, active, onToggle }`, `status: { label, tone }` where tone is `paused` or `working` or `idle` as computed.
2. **Workspace items:** for every Workspace the Owner can see (from the Workspaces list read through the api-client, not hard coded), one item: not individually paused -> label `Wstrzymaj „{{name}}”` icon `pause`; individually paused -> `Wznów „{{name}}”` icon `activity`. Order: Workspaces with an active Run first, then alphabetical; at most 6 items, the rest behind one item 'Więcej Workspace\'ów…' that opens the main window on the dashboard (menu height limit E3). Names are truncated to 28 characters with ellipsis.
3. While Global Pause is active the per-Workspace items are replaced by one muted informational item 'Wszystko wstrzymane' (disabled) because resuming a single Workspace under a global pause has no effect; individually paused Workspaces are listed after Global resume.
4. **Global Pause button:** `label` 'Global Pause' when running, 'Wznów wszystko' when paused or pausing; `active` mirrors `view.paused`; `onToggle` runs the same flows as the top bar: pause is immediate (no dialog), resume opens a native-like confirmation inside the popover (small inline confirm row 'Wznowić? [Wznów] [Anuluj]' because opening a dialog from the menu-bar popover loses focus); toast is replaced by the status line changing.
5. **Header status:** 'wstrzymane' with tone `paused` (amber dot, word) when phase is paused; 'wstrzymywanie · {{count}} Agentów' when pausing; otherwise the TRAY task's normal text ('pracuje · 3 z 3 Agentów'). The status is a word, not only colour.
6. Per-Workspace actions call `setWorkspacePause(id, paused)` from the api-client; errors show an inline error line 'Nie udało się. Spróbuj w oknie aplikacji.' in the popover for 4 s.
7. The tray hook reuses the single shared snapshot store of OVE_PAUSE010 (the popover is a separate webview window, so it creates its own store instance with the same implementation; push reconnects independently).

## 6. Design notes

`design.png` is the middle block of the popover: the divider, the item 'Wstrzymaj „Aplikacja rezerwacji”' (16px `pause` icon in `#A79BBF`, 14px label), the item 'Wznów „Research rynku”' (activity icon) and the 42px Global Pause button (tint `#2A1026`, border `#5A2A4F`, text `#FFD3F1` 13/700, margin 4 2). `design-header.png` is the header with the status line 'pracuje · 3 z 3 Agentów' (mono 12, magenta). Not in the mock: paused header (status 'wstrzymane' with an amber dot; the whole popover keeps its dark surface, no banner), the inline resume confirmation row, the info item 'Wszystko wstrzymane', the all-Workspaces-running case with no resume items. Items use `ui:TrayItem` hover and focus states (OVE_DS085).

## 7. Reuse

- `ui:TrayMenu`, `ui:TrayItem`, `ui:GlobalPauseButton` look (OVE_DS042/085), `usePause` store and resume flow (OVE_PAUSE010), api-client Workspaces list (WSPACE/ENGINE `api:workspaces.list`).

## 8. Architecture and code placement

`apps/desktop/src/features/pause/tray/{use-tray-pause-model.ts,build-pause-items.ts,*.test.ts}`; pure builders separated from the hook for testing. Exported via the feature barrel; the TRAY feature imports the hook (no reverse dependency).

## 9. Security and safety

- All pause state comes from the gateway; the UI never stores 'paused' in localStorage or decides authority itself (the engine enforces; the UI only reflects).
- All strings are rendered as React text nodes; no HTML injection; labels come from i18n keys with only numeric and Workspace-name params (Workspace names are untrusted text, truncated with ellipsis).
- A failed pause call is shown as an error and the button returns to its previous state; the UI never shows 'paused' before the engine confirmed (no optimistic state), because a false sense of safety is worse than a delay.
- The popover shows Workspace names: isolated Workspaces are listed like others (names are the Owner's own data) but never their paths.
- The tray channel principal is the local app token; resume from the tray is therefore allowed (desktop-class channel), while no network client can claim it.

## 10. Errors and edge cases

- Zero Workspaces: no per-Workspace items, only the Global Pause button.
- Engine unreachable: items disabled, status 'silnik zatrzymany' (TRAY), Global Pause disabled with tooltip.
- A Workspace was deleted while its item is visible: the action returns `pause.workspace_not_found`; the list refreshes.
- More than 6 Workspaces: overflow item as described.
- Paused and pending Approvals together: the pending row stays (TRAY); approve actions are blocked in the main window (PAUSE012).

## 11. Acceptance criteria

- [ ] Given Workspace A running and B individually paused, Then the model lists 'Wstrzymaj „A”' and 'Wznów „B”'.
- [ ] Given Global Pause active, Then per-Workspace items are replaced by the info item and the button reads 'Wznów wszystko'.
- [ ] Given phase pausing with 2 Agents, Then the header status reads 'wstrzymywanie · 2 Agentów'.
- [ ] Clicking Global Pause while running pauses immediately; clicking while paused shows the inline confirm and resumes after confirmation.
- [ ] More than 6 Workspaces collapse into the overflow item.
- [ ] Unit tests cover all rules; the story with `ui:TrayMenu` matches the crop for the running state within tolerance.

## 12. Test plan

Unit: `build-pause-items.test.ts` (table-driven), `use-tray-pause-model.test.ts` with fake api-client; Storybook composition `TrayMenu/PauseModel`; visual test of the middle block against `design.png` (OVE_TEST005). Commands: `pnpm --filter desktop test pause`.

## 13. Parallelization notes

Parallel with OVE_PAUSE011/012/014/015. TRAY (wave 2) consumes `lib:use-tray-pause-model`; this task owns only the `tray/` subfolder of the pause feature.

## 14. Open questions and assumptions

- OPEN: should the tray offer pause for the Workspaces list at all when the app has many Workspaces? DEFAULT: 6 items plus overflow.
- OPEN: the Polish label for the inline resume confirm ('Wznowić?'); default as written.
