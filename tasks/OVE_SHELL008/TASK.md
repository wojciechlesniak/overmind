---
id: OVE_SHELL008
title: "Set up the theme root, document base and window chrome integration with the Tauri shell"
area: SHELL
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS004, OVE_DS008, OVE_SETUP010, OVE_SHELL003, OVE_SHELL004]
soft_depends_on: ["OVE_SETUP010"]
provides: ["lib:theme-provider", "lib:use-window-activity", "doc:desktop-window"]
needs: ["ui:ThemeRoot", "ui:theme", "ui:fonts", "lib:platform-provider", "lib:tauri-shell"]
owns: ["apps/desktop/src/app/styles/base.css", "apps/desktop/src/app/window/**", "apps/desktop/src/app/providers/theme-provider.tsx", "docs/architecture/desktop-window.md", "tasks/_proposals/OVE_SHELL008-window-and-resident-app.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13", "SPECIFICATION 11"]
adr_refs: [5, 9, 18]
---

# OVE_SHELL008: Set up the theme root, document base and window chrome integration with the Tauri shell

## 1. Summary

Mounts the design-system `ThemeRoot`, fixes the document so only panels scroll, defines window sizing rules (default 1440x900, minimum 1100x700), resident-app behaviour (closing the window keeps the engine and the tray alive, Cmd+Q quits only the UI) and the focus/refresh behaviour when the window regains focus.

## 2. Context

Design rules (styl-wizualny): 'Ekrany mają stałą wysokość okna i przewijają się wewnątrz paneli'. DS008 provides `ThemeRoot` and base CSS; DS044 `PageLayout` sets `height: 100dvh; min-height: 560px` and asserts `html, body { overflow: hidden }` is the app's concern. SETUP010 creates one decorated window (label `main`, 1440x900, minimum 1024x680) with a deny-by-default capability set and explicitly asks SHELL to decide the title bar (its open question 3). ADR 0005: closing the window does not stop work; the Tray (TRAY area) offers 'Zamknij okno, pracuj dalej' and 'Zakończ Overmind…'. The DS wizard needs 1100x700 (DS073 req. 7), the top bar is guaranteed 67px at widths >= 960 of the content area (DS043), i.e. window >= 1032 wide.

## 3. Scope (in)

- `ThemeRoot` mounting (dark theme only for the MVP, `data-theme="dark"`), document base styles (`html, body, #root { height: 100%; overflow: hidden }`, `color-scheme: dark`, text selection rules).
- Window size policy document and proposal to SETUP010: minimum 1100x700.
- Decision: keep the native decorated macOS title bar (no custom title bar, no drag regions, so no `window:allow-start-dragging` permission is needed).
- Resident-app proposal: on window close request the Rust shell hides the window instead of destroying it (tray keeps running); `Cmd+Q`/tray quit exits only the UI process; plus a `reopen` handler (Dock click or tray 'Otwórz Overmind' shows the window).
- `useWindowActivity()` hook: tracks `focused` and `visible` through DOM `visibilitychange`/`focus` events and calls `connection.retry()` (rate limited 1 per 10 s) when the window regains focus while the engine state is `unavailable`.
- Dev guard: warn when the viewport is smaller than the minimum.

## 4. Out of scope

- Rust implementation of hide-on-close and the size change (SETUP010 owner, via the proposal files listed here).
- Tray window and menu (TRAY area).
- Persisting window position and size (post-MVP; a window-state plugin would need its own review).

## 5. Detailed requirements

1. Mount order inside `ThemeRoot`: the app root renders `<ThemeRoot theme="dark">` as the outermost React element (DS008 API) so tokens, fonts (self-hosted, DS004) and focus styles apply to every descendant including portals (toasts, dialogs). Portals render into a container inside `ThemeRoot` (`#overlay-root`) to inherit tokens.
2. Global CSS file `apps/desktop/src/app/styles/base.css` imported once by `main.tsx` wrapper: `html, body, #root { height: 100%; margin: 0; overflow: hidden; background: var(--om-bg-app); }`, `body { -webkit-font-smoothing: antialiased; user-select: none }` with `user-select: text` re-enabled on `.om-selectable`, terminal, message and path elements (DS components already set it; the base only disables accidental drag-selection of chrome), `overscroll-behavior: none` on `body`, no `-webkit-app-region` anywhere. No raw hex: tokens only.
3. Size policy (document in `docs/architecture/desktop-window.md`): default 1440x900 (design viewport), minimum 1100x700. Rationale: wizard needs 1100x700, top bar is stable above 1032 px window width, Workflow canvas panels (240 + 290) leave 570 px for the canvas. Below minimum the OS prevents resizing (Tauri `minWidth/minHeight`); the app does not implement a mobile layout (E1 open question 7 answered for the MVP: desktop only, >= 1100 px).
4. Proposal `tasks/_proposals/OVE_SHELL008-window-and-resident-app.md` for SETUP010: (a) `minWidth: 1100, minHeight: 700` in `tauri.conf.json`; (b) `on_window_event(CloseRequested)` -> `api.prevent_close(); window.hide()` on macOS; (c) `RunEvent::Reopen` shows the main window; (d) `Cmd+Q` default menu item quits the app process only (the engine runs under launchd KeepAlive, ENGINE008); (e) no `devtools` in release; (f) native menu bar minimal (App menu with About/Hide/Quit, Edit menu for copy/paste, Window menu) so standard shortcuts work. Each item lists the capability or Rust change and its security impact (none widen the webview).
5. `useWindowActivity()`: returns `{ focused: boolean, visible: boolean }`; on `focus` after `blur` while `useConnection().state === 'unavailable'` call `retry()`; when `visible` flips to true after being hidden for more than 5 minutes invalidate all gateway queries once (data may be stale because the window was hidden, although SSE continues).
6. Document title: `Overmind`; views append through `useDocumentTitle` (OVE_SHELL025).
7. The decorated title bar height is outside the webview (macOS native), so layout math uses the webview viewport only; the Playwright viewport is 1440x900 as in the mocks.
8. Dev/e2e mode (no Tauri): the same CSS applies; a `?size=1440x900` query is NOT supported (Playwright sets the viewport).

## 6. Design notes

N/A, functionality only. (The shell look is the DS theme; no new visual decisions are made here.)

## 7. Reuse

- `ThemeRoot`, base CSS and tokens (OVE_DS008, DS002..DS007), fonts (DS004).
- `useConnection` (SHELL004), `usePlatform().desktopShell` (SHELL003).
- Proposals go to SETUP010 (it owns `tauri.conf.json` and Rust files).

## 8. Architecture and code placement

`apps/desktop/src/app/styles/base.css`, `apps/desktop/src/app/window/use-window-activity.ts`, `apps/desktop/src/app/providers/theme-provider.tsx`, `docs/architecture/desktop-window.md`, `tasks/_proposals/OVE_SHELL008-window-and-resident-app.md`. No Rust here.

## 9. Security and safety

- Hide-on-close must not hide a running state from the Owner: the tray always shows status and Global Pause (TRAY). The proposal requires the tray icon to exist before hide-on-close is enabled (otherwise the app would be unreachable).
- No new webview permissions are requested (title bar and drag regions deliberately avoided).
- Overlay root inside the theme root prevents unstyled portals that could be spoofed to look like OS dialogs: dialogs show the app name and are only used for in-app decisions; they never mimic native permission prompts.
- Window focus refresh never triggers destructive actions.

## 10. Errors and edge cases

- Window smaller than 1100x700 (OS ignored the minimum): the app renders with the DS fallback (side panels hide first, DS044) and shows a one-time dev console warning.
- Hidden window while the engine restarts: on show, state reconciles through SHELL004/006.
- `localStorage` unavailable: unaffected.
- Tray not yet implemented: hide-on-close is NOT enabled (feature flag in the proposal: only with TRAY007 merged).

## 11. Acceptance criteria

- [ ] Given the app mounts then the root element has `data-theme="dark"` and `document.body` has `overflow: hidden`.
- [ ] Given a dialog portal then it renders inside `#overlay-root` within the theme root and inherits `--om-*` tokens.
- [ ] Given the engine is unavailable and the window regains focus then `retry()` is called once per 10 s at most.
- [ ] `docs/architecture/desktop-window.md` states default and minimum sizes and the resident-app behaviour.
- [ ] Both proposal files exist and list exact Rust and config changes.

## 12. Test plan

- Vitest + jsdom: `use-window-activity` with simulated focus/visibility and fake timers; test that base CSS contains no raw colour literals (token lint).
- Playwright (TEST004): at 1440x900 no page scrollbar, scrolling happens inside a panel.
- Commands: `pnpm --filter @overmind/desktop test window`.

## 13. Parallelization notes

Parallel with SHELL004..SHELL007. The proposals are the only cross-owner output; SETUP010's owner merges them. TRAY007 depends on the resident-app proposal.

## 14. Open questions and assumptions

- ASSUMPTION: dark theme only (inventory open question 4); the `theme` prop exists so a light theme is possible later.
- ASSUMPTION: native title bar; a custom title bar (traffic lights over the rail) is a later design decision.
- OPEN: minimum size 1100x700 vs SETUP010's 1024x680; default is 1100x700 pending the Owner.
