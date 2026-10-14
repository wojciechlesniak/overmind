---
id: OVE_TRAY008
title: "Wire tray actions: open app, Chief, Approvals, Workspace pause, close, Global Pause"
area: TRAY
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_PAUSE007, OVE_PAUSE013, OVE_SHELL009, OVE_SHELL010, OVE_TRAY005, OVE_TRAY007]
soft_depends_on: ["OVE_SHELL010"]
provides: ["lib:tray-actions", "lib:use-main-navigation-listener"]
needs: ["lib:use-tray-pause-model", "lib:nav-model", "lib:use-navigate-to-route", "api:pause.workspace", "api:pause.global", "lib:tauri-tray"]
owns: ["apps/desktop/src/features/tray/actions/**", "tasks/_proposals/OVE_TRAY008-cross-window-events.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 15]
---

# OVE_TRAY008: Wire tray actions: open app, Chief, Approvals, Workspace pause, close, Global Pause

## 1. Summary

Implements what each tray item does: 'Otwórz Overmind' (⌘O), 'Napisz do Chiefa…', the pending row ('Zgody'), 'Wstrzymaj/Wznów' per Workspace, Global Pause, 'Zamknij okno, pracuj dalej' and 'Więcej Workspace'ów…'. Every action that needs the main window shows it and navigates to a known route; the popover then closes.

## 2. Context

The popover is a launcher and a safety switch, not a workspace: reading and deciding happens in the main window (OVE_TRAY001). The model of TRAY005 exposes stable item ids; this task owns the single action registry that maps ids to behaviour so the behaviour is reviewable in one file. Navigation across windows needs a message path: the tray window cannot call the main window's router. It asks Rust to show the main window and sends a validated route over an app event that the main window handles.

## 3. Scope (in)

- `trayActions` registry (id -> handler) in one file with a typed signature.
- Cross-window navigation: `requestMainNavigation(route)` using a Tauri app event `app:navigate` (payload `{ route }`) emitted via the platform (proposal) and consumed by the main window hook `useMainNavigationListener()` (owned here, mounted by SHELL010 through the `bridges` slot).
- Pause actions through PAUSE013 handlers (items, Global Pause).
- Close window: `desktopShell.hideMainWindow()` (proposal; hide, never quit).
- Toast-free feedback: inline status line in the popover for failures.

## 4. Out of scope

- Quit flow and engine shutdown choice (TRAY009).
- Rendering (TRAY006) and the pause rules (PAUSE013).
- Any decision-making in the popover (no Approve/Reject).

## 5. Detailed requirements

1. **Registry.** `type TrayActionId = 'open-app'|'chief'|'approvals'|'close-window'|'more-workspaces'|'quit'|`pause-ws:${string}`|`resume-ws:${string}`|'global-pause'`; handlers receive `{ platform, navigate, pause, api }`. Unknown ids are ignored (defensive) and logged at debug level.
2. **open-app (⌘O).** `show_main_window` then `hide_tray`; no navigation (keeps the last route). The webview key handler `Mod+O` (TRAY002) triggers the same action; the item shows `kbd: ⌘O`.
3. **chief.** `show_main_window`, emit `app:navigate { route: '/chief' }` (the Chief view with the composer focused via query `?focus=composer`), hide the tray. The route is a constant from the nav model (`useNavigateToRoute('chief')` resolved in the main window; the tray sends the route id, not a free string: payload `{ routeId: 'chief', params: { focus: 'composer' } }`).
4. **approvals.** Pending row -> `{ routeId: 'approvals' }`; same flow.
5. **more-workspaces.** `{ routeId: 'workspaces' }`.
6. **Per-Workspace pause/resume.** Calls PAUSE013's handlers (`pause.workspace` routes with idempotency keys); on success the summary refetches by event; on error an inline line 'Nie udało się. Spróbuj w oknie aplikacji.' for 4 s (copy from PAUSE013). No navigation, the popover stays open.
7. **Global Pause.** Pause immediately; resume uses the inline confirm row of PAUSE013/TRAY009. The popover stays open to show the status change.
8. **close-window.** Hides the main window (`desktopShell.hideMainWindow()`), the engine and Runs keep running; the item is disabled when the main window is already hidden. Copy is fixed by the mock: 'Zamknij okno, pracuj dalej'.
9. **Main-window listener.** `useMainNavigationListener()` validates `{ routeId, params }` with zod (closed set of route ids from the nav model, params limited to a small allowlist: `focus`, `workspaceId`), resolves the path with `useNavigateToRoute`, then navigates; unknown ids are ignored. If the main window is showing the wizard, navigation is ignored (the first-run guard wins).
10. **Rust requirements (proposal file `tasks/_proposals/OVE_TRAY008-cross-window-events.md`):** `emit_to_main(event: 'app:navigate', payload)` restricted command with a closed event name; capability for the tray window to call it; `hide_main_window()` command; `core:event:allow-listen` for `app:navigate` in `main`.
11. **Focus.** After an action that opens the main window, focus moves to the main content (SHELL025 focus manager).
12. **Global Pause availability.** Never disabled by the engine state except when the engine is unreachable (then TRAY009 shows the error state with the same button using the emergency path of SHELL019).

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `useTrayPauseModel` handlers (PAUSE013), `Tray` and `DesktopShell` platform (TRAY007/SHELL003), nav model route ids (SHELL009), `useNavigateToRoute` (SHELL010), api-client.

## 8. Architecture and code placement

`apps/desktop/src/features/tray/actions/{tray-actions.ts,request-main-navigation.ts,use-main-navigation-listener.ts,navigation-payload.ts}` and the proposal. Application layer; the registry is the only place that maps item ids to effects.

## 9. Security and safety

- Cross-window navigation carries only route ids from a closed set and a tiny params allowlist, validated in the receiving window; a compromised tray webview cannot navigate to arbitrary paths, open URLs or call other commands.
- The popover has no approve/reject action; the pending row only opens the Approvals view in the main window (decisions need the full detail and, when widening, Local Approval).
- Pause is the only mutation; it uses idempotency keys and the standard PAUSE routes (audit by the engine).
- `close-window` hides only; it cannot stop the engine.

## 10. Errors and edge cases

- Main window is closed or hidden: Rust shows it before the event is emitted; the listener buffers the last request until mounted (max 1, 5 s TTL).
- Double click on an item: debounce 300 ms; idempotency key per pause action.
- Engine down: pause actions fail with the inline error; open-app still works (it only shows the window).
- Route id not installed in this build: the main window shows the NotAvailable page (SHELL010).
- Wizard in progress: navigation ignored.

## 11. Acceptance criteria

- [ ] Given 'Otwórz Overmind' then the main window is shown and the tray hidden.
- [ ] Given 'Napisz do Chiefa…' then the main window opens at the Chief view with the composer focused.
- [ ] Given the pending row then the Approvals view opens.
- [ ] Given a Workspace pause item then the pause route is called once and the label flips to 'Wznów' after the event.
- [ ] Given an `app:navigate` payload with an unknown route id then nothing happens.
- [ ] Given 'Zamknij okno, pracuj dalej' then the window hides and the engine stays running.

## 12. Test plan

- Vitest with fake platform, fake pause handlers and a fake event bridge: registry table, payload validation, buffering.
- Playwright (TEST004) with the mock platform: click each item, assert calls.
- Commands: `pnpm --filter @overmind/desktop test features/tray/actions`.

## 13. Parallelization notes

After TRAY005 and TRAY007. Parallel with TRAY009. The listener hook is mounted by SHELL010's `bridges` slot (soft dependency).

## 14. Open questions and assumptions

- OPEN: Chief composer focus via query param: Chief view (CHATUI) must read `?focus=composer`; flag to that area.
- ASSUMPTION: `desktopShell.hideMainWindow()` and `emit_to_main` are added by SETUP010 through the proposals (SHELL003 lists the interface method as an amendment).
