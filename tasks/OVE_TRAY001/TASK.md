---
id: OVE_TRAY001
title: "Decide the menu-bar popover architecture: webview window, positioning and lifecycle"
area: TRAY
kind: decision
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_SETUP010]
soft_depends_on: []
provides: ["decision:tray-popover-webview", "doc:tray-architecture"]
needs: ["port:Notifier", "lib:desktop-platform", "lib:tauri-capabilities"]
owns: ["docs/architecture/tray.md", "tasks/_proposals/OVE_TRAY001-tray-window.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 9, 18]
---

# OVE_TRAY001: Decide the menu-bar popover architecture: webview window, positioning and lifecycle

## 1. Summary

Records the decision that the menu-bar menu is a small borderless Tauri webview window (`label: tray`) opened under the menu-bar icon and rendered with ui-kit's `TrayMenu`, not a native NSMenu, and fixes its geometry, lifecycle, capability set and the Rust requests that follow. Output is a short architecture document and proposal files; no code.

## 2. Context

The Tray mock (`Tray.png`, 380x560 viewport, popup 348 px wide, radius 16, large shadow) shows custom UI that a native menu cannot draw: round-initial agent avatars, state words in colour, an amber marker row, a 42 px tinted Global Pause button and a keyboard hint. ARCH012 defines a `Tray` interface with `setStatus`, `setMenu`, `onAction`, `show`, `hide`; its `setMenu(model)` assumes data-driven native items. SHELL010 already reserves `?window=tray` for `TrayApp` (OVE_TRAY002) and SHELL008 proposes hide-on-close, which makes the menu-bar icon the only way back to a hidden app (ADR 0005), so the tray must be robust. SETUP010 sets `macOSPrivateApi = false`, which forbids transparent windows in Tauri 2 on macOS.

## 3. Scope (in)

- Decision record `docs/architecture/tray.md` with options, choice and consequences.
- Window specification: label `tray`, size 380x560, `decorations: false`, `resizable: false`, `alwaysOnTop: true`, `skipTaskbar`, `visible: false` at creation, hide on blur, shown by the icon click, positioned under the icon.
- Lifecycle: the tray webview is created hidden at app start and stays alive (it keeps the icon status in sync even when the main window is hidden).
- Capability proposal `tray.json` (deny by default) and Rust command list.
- Proposal files for SETUP010 and SHELL008 alignment.

## 4. Out of scope

- Implementing any of it (TRAY002, TRAY007 and SETUP010).
- The menu content and look (TRAY005/006).
- Windows and Linux tray (ADR 0009: macOS first).

## 5. Detailed requirements

1. **Decision.** Webview popover (`tray` window). Rejected: native NSMenu (cannot render the mock; no live agent rows), `NSPopover` through private plugin code (more Rust, more risk, ADR: Rust stays thin). Consequence: one more webview process (about 40-60 MB resident); acceptable, and it doubles as the always-on host of the icon-status sync and the native notification bridge election (SHELL023).
2. **Geometry.** Window 380x560 fixed (the mock viewport). The popup card (348 px wide, 16 px margin) is drawn by the web content; because transparency needs `macOSPrivateApi`, the default is an OPAQUE window filled with the app background and the card flush at the margins; the 16 px margin shows `bg-app`. A later switch to transparency is a one-line change recorded in open questions. Content taller than 560 scrolls inside the card (the mock content is 613 px tall; E3 menu height limit).
3. **Positioning.** The Rust shell receives the tray icon rect from `TrayIconEvent::Click` and places the window horizontally centred under the icon, vertically below the menu bar, clamped to the visible frame of the screen containing the icon (multi-monitor). No JavaScript computes screen geometry.
4. **Show and hide.** Left click toggles; right click shows the same popover (no native menu). The window hides on blur (`Focused(false)`), on `Esc` (webview calls `hideTray`), after any action that opens the main window, and when the Owner clicks the icon again. While hidden the webview is not destroyed.
5. **Focus.** On show the webview receives focus; the first menu item gets keyboard focus (Tab order top to bottom, arrow keys move between items, DS029 menu behaviour). VoiceOver announces the popover as a menu region named 'Overmind'.
6. **Capability `tray.json`.** `windows: ['tray']`; permissions: `core:event:allow-listen/unlisten`, `allow-gateway-request`, `allow-gateway-subscribe`, plus custom `allow-hide-tray`, `allow-show-main-window`, `allow-set-tray-status`, `allow-quit-app`. No `pick_directory`, no `shell`, no `fs`, no `opener`. The tray cannot call `openExternal`. The CSP is shared with `main`.
7. **Rust commands (proposal to SETUP010, file `tasks/_proposals/OVE_TRAY001-tray-window.md`):** `hide_tray()`, `show_main_window()` (shows, unminimises and focuses `main`), `set_tray_status(status: 'idle'|'working'|'waiting'|'paused'|'error', tooltip: string)` swapping the template icon and tooltip, `quit_app()` exiting the UI process only (the engine keeps running under launchd; stopping the engine is an engine route, TRAY009). Each is a typed command with enumerated inputs; `tooltip` max 80 chars, plain text.
8. **Menu-bar icon.** A template image (monochrome, adapts to light/dark menu bars) with five state variants; the amber and magenta accents cannot be used in a template image, so states are shape-based (dot, pause bars, exclamation) as well as tooltip text (state not by colour alone). Icon artwork is produced in TRAY007.
9. **Always reachable.** The tray icon is created before hide-on-close is enabled (SHELL008 flag) and survives window close. If tray creation fails (menu bar hidden by the user), the Rust shell keeps the main window visible and logs once; the UI shows a one-time hint in App settings (SETUI, out of scope here).
10. **Alignment with ARCH012.** `Tray.setStatus` and `show/hide` are implemented; `setMenu` and `onAction` are intentionally unused (documented as 'content is a webview'); the ARCH012 owner is informed through the open question below. Alternatives for a fallback native menu are NOT built in MVP.

## 6. Design notes

N/A, decision record. The visual spec is `Tray.png` (see TRAY006).

## 7. Reuse

- ARCH012 `Tray` interface, SETUP010 capability pattern, SHELL008 resident-app proposal, SHELL010 window-kind switch.

## 8. Architecture and code placement

`docs/architecture/tray.md` and proposals `tasks/_proposals/OVE_TRAY001-tray-window.md`. No source files.

## 9. Security and safety

- The popover has its own capability file with the minimal command set; compromise of its content cannot reach the file system, shell or external URLs.
- `quit_app` and `show_main_window` take no arguments; no path or URL crosses from the tray webview to Rust.
- The popover reads only through the owner token bridge (injected by Rust, never visible to JS); it shows names and counts, no message content.
- A tray webview that hides on blur cannot be used for clickjacking of approvals: the popover contains no Approve or Reject controls (decisions need the main window and, for widening, Local Approval).

## 10. Errors and edge cases

- Menu bar full (icon hidden by macOS): the app stays usable through the Dock and main window; documented.
- Multiple displays or Spaces: positioning clamps to the display of the icon; full-screen apps: the window uses `visibleOnAllWorkspaces`.
- Rapid double click: toggle debounced 150 ms.
- Tray webview crashed: the Rust shell recreates it on next click (documented requirement).
- Dark/light menu bar change: template images adapt automatically.

## 11. Acceptance criteria

- [ ] Given the document then it states the decision, the rejected options, geometry, capability set and the command list.
- [ ] Given the proposal file then SETUP010 can implement the commands without further questions.
- [ ] Given ARCH012 then the unused `setMenu`/`onAction` are explicitly recorded.

## 12. Test plan

- Review only: the architecture reviewer and the SETUP010 owner read the document; a checklist in the doc maps each requirement to the task that implements it (TRAY002, 007, 009).
- Command: `pnpm docs:lint`.

## 13. Parallelization notes

First TRAY task; TRAY002 and TRAY007 depend on it. No overlap with other areas except the proposal consumers.

## 14. Open questions and assumptions

- OPEN: transparent window requires `macOSPrivateApi = true` (a security-relevant flag); Owner/SETUP010 decide; default opaque.
- OPEN: should right click show a minimal native menu ('Open', 'Quit') as a fallback when the webview is unresponsive? Not in MVP.
- OPEN for ARCH012: mark `setMenu`/`onAction` optional or remove.
