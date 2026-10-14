---
id: OVE_TRAY007
title: "Implement the platform Tray: icon states, show and hide, visibility, Rust requests"
area: TRAY
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_SETUP010, OVE_SHELL003, OVE_TRAY001]
soft_depends_on: []
provides: ["lib:tauri-tray", "lib:tray-icons"]
needs: ["lib:desktop-platform", "lib:tauri-shell", "lib:tauri-capabilities", "lib:engine-ensure-running-contract"]
owns: ["apps/desktop/src/shared/platform/tauri/tray.ts", "apps/desktop/src/shared/platform/web/tray.ts", "apps/desktop/src/shared/platform/mock/tray.ts", "apps/desktop/src-tauri/tray-icons/**", "apps/desktop/scripts/export-tray-icons.mjs", "tasks/_proposals/OVE_TRAY007-tray-rust.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 9, 18]
---

# OVE_TRAY007: Implement the platform Tray: icon states, show and hide, visibility, Rust requests

## 1. Summary

Implements the TypeScript `Tray` platform interface for Tauri (`setStatus`, `show`, `hide`, `onVisibilityChange`, `markReady`) with web and mock variants, defines the five menu-bar icon states and their artwork brief, and writes the Rust-side requirements (tray icon, click handling, window placement, capability) as a proposal for SETUP010.

## 2. Context

OVE_TRAY001 decided on a webview popover. SHELL003 reserved `platform/tauri/tray.ts` for this task (it owns that single file). The Rust shell is intentionally thin (SETUP010): it needs a tray icon with click events, a window that can be positioned under the icon, a status command that swaps the icon, and the capability file for the tray window. SHELL008's hide-on-close depends on the tray existing first, so the resident-app flag in SHELL008's proposal must be conditioned on this task.

## 3. Scope (in)

- `apps/desktop/src/shared/platform/tauri/tray.ts`: `TauriTray implements Tray` calling typed commands `set_tray_status`, `hide_tray`, `show_main_window` and listening to `tray:visibility`.
- `apps/desktop/src/shared/platform/web/tray.ts` and `mock/tray.ts` (records calls; used by tests and `pnpm dev`).
- Interface additions proposal to ARCH012 (`onVisibilityChange`, `markReady`).
- Icon artwork brief and file list `apps/desktop/src-tauri/tray-icons/` (names and sizes), generated from the hex-cell logo.
- Rust requirements proposal `tasks/_proposals/OVE_TRAY007-tray-rust.md` for SETUP010 (icon, click, placement, capability `tray.json`, resident flag).

## 4. Out of scope

- The popover content (TRAY005/006) and actions (TRAY008).
- Writing the Rust code (SETUP010).
- Windows/Linux trays.

## 5. Detailed requirements

1. **TypeScript interface.** `Tray`: `setStatus({ status: TrayIconStatus; tooltip: string }): Promise<Result<void>>`, `show(): Promise<Result<void>>` (programmatic show, used by `Cmd+Shift+O` style actions later), `hide()`, `markReady()` (called once after first paint; Rust shows the window only when ready), `onVisibilityChange(cb): Unsubscribe` and `capabilities(): { visible: boolean }`. `TrayIconStatus = 'idle'|'working'|'waiting'|'paused'|'error'` (closed union, validated by zod at the boundary).
2. **Tauri implementation.** Calls only the typed commands from the proposal; `tooltip` trimmed to 80 chars; all errors mapped to `Result` with code `platform.tray_unavailable`. The visibility event payload `{ visible: boolean }` is zod-validated; unknown shapes are dropped.
3. **Icon states (artwork brief).** Template PNGs, 22 pt at @1x and @2x (44 px), single colour: `idle` hex-cell outline; `working` hex-cell with a filled centre; `waiting` hex-cell with a small solid dot at top right (attention, not colour); `paused` hex-cell with two vertical bars inside; `error` hex-cell with an exclamation mark. Files `tray-idle.png`, `tray-idle@2x.png`, ... (10 files) under `apps/desktop/src-tauri/tray-icons/` (a folder of this task, not SETUP010's `icons/`). Source: the hex-cell mark in `_design/source/Logo-Final.dc.html`; a script `scripts/export-tray-icons.mjs` (own file) rasterises them from an SVG source `tray-icons/source.svg` so they can be regenerated.
4. **Tooltip.** Plain text, same string as the popover header status; updated with each `setStatus`.
5. **Rust requirements (in the proposal):** (1) create the tray icon at setup with the `idle` image as template, tooltip 'Overmind'; (2) left or right click -> toggle the `tray` window and place it under the icon rect (TRAY001); (3) commands `set_tray_status`, `hide_tray`, `show_main_window`, `quit_app`; (4) emit `tray:visibility` on show/hide; (5) hide on blur; (6) show only after `markReady`; (7) create the `tray` window hidden at startup with the label, size and flags of TRAY001; (8) `capabilities/tray.json`; (9) keep the process alive when the main window closes (SHELL008) only if the tray icon was created successfully; (10) `Cmd+Q` quits the UI process only.
6. **Quit.** `quit_app` ends the UI process (menu-bar icon disappears); the engine keeps running unless the UI first called the shutdown route (TRAY009 offers that choice).
7. **Keyboard shortcut ⌘O.** The mock shows `⌘O` as the hint of 'Otwórz Overmind'. Inside the popover the shortcut is handled by the webview (`Mod+O` registered with the tray's own key handler: calls `show_main_window` then `hide_tray`). A macOS global shortcut is NOT registered (no global-shortcut capability).
8. **Dev ergonomics.** The web implementation logs `[tray] setStatus working` in the console in dev only and exposes `window.__overmindTrayCalls` for Playwright.
9. **Docs.** The proposal states the order of work: SETUP010 implements; TRAY007 TypeScript can merge earlier against the mock implementation.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `PlatformProvider` and `Result` (SHELL003/ARCH003), tauri `invoke` wrapper helper from SHELL003 (`tauriInvoke`), capability conventions (SETUP010).

## 8. Architecture and code placement

`apps/desktop/src/shared/platform/tauri/tray.ts`, `.../web/tray.ts`, `.../mock/tray.ts`, `apps/desktop/src-tauri/tray-icons/**`, `apps/desktop/scripts/export-tray-icons.mjs`, `tasks/_proposals/OVE_TRAY007-tray-rust.md`. Platform adapter layer; only file that may call the tray commands.

## 9. Security and safety

- Commands take enumerated or capped plain-text arguments; no path, URL or script crosses.
- `quit_app` and `show_main_window` take no arguments; only the `tray` and `main` windows have them in their capability files (the tray one is limited by TRAY001's list).
- The icon is a template image so it cannot imitate other apps' colours; the tooltip never contains content from Runs or messages (counts and fixed words only).
- Rate limit: `setStatus` ignores identical consecutive values; the Rust side also ignores unknown enum values.

## 10. Errors and edge cases

- Tray creation failed (menu bar hidden, headless CI): `capabilities().visible = false`; calls are no-ops; the app keeps the main window visible (SHELL008 flag respects it).
- `setStatus` called before Rust is ready: queued once, the last value wins.
- Visibility event after the window was destroyed: ignored.
- Two rapid toggles: debounced in Rust (150 ms).
- Retina and non-Retina menu bars: both icon sizes provided.

## 11. Acceptance criteria

- [ ] Given the Tauri implementation with a fake `invoke` then `setStatus('waiting')` sends the expected command and arguments.
- [ ] Given an unknown status value then a type error at compile time and a validation error at runtime.
- [ ] Given `onVisibilityChange` events then callbacks fire with booleans and unsubscribe works.
- [ ] Given the icon export script then ten PNGs of correct sizes are produced and are monochrome.
- [ ] Given the proposal then SETUP010 can implement without further questions (reviewed by that owner).

## 12. Test plan

- Vitest with a fake `invoke` and fake event emitter; image test checks sizes and that pixels are single-colour with alpha (script test).
- Commands: `pnpm --filter @overmind/desktop test platform/tray`; `pnpm --filter @overmind/desktop icons:tray`.

## 13. Parallelization notes

After TRAY001 and SHELL003. TRAY002 and TRAY008 use the interface (mock implementation allows parallel work). The SHELL008 resident flag depends on this task and SETUP010's Rust.

## 14. Open questions and assumptions

- DESIGN GAP: tray icon artwork is not in the mocks; the brief above derives from the hex-cell logo.
- OPEN: show the pending Approvals count as text next to the icon (macOS `setTitle`)? Not in the mock; not done.
- OPEN for ARCH012 owner: add `onVisibilityChange` and `markReady` to `Tray`.
