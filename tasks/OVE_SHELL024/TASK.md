---
id: OVE_SHELL024
title: "Provide keyboard shortcuts: provider, registry, rail shortcuts and hints"
area: SHELL
kind: feature
size: S
priority: P2
mvp: true
status: todo
depends_on: [OVE_SHELL007, OVE_SHELL009, OVE_SHELL010]
soft_depends_on: ["OVE_SHELL013"]
provides: ["lib:shortcuts", "lib:use-shortcut", "lib:format-shortcut"]
needs: ["lib:use-navigate-to-route", "lib:nav-model", "lib:i18n-provider"]
owns: ["apps/desktop/src/app/shortcuts/**", "apps/desktop/src/locales/en/shell-keys.json", "apps/desktop/src/locales/pl/shell-keys.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [9, 18]
---

# OVE_SHELL024: Provide keyboard shortcuts: provider, registry, rail shortcuts and hints

## 1. Summary

Adds an in-window shortcut system (`ShortcutProvider`, `useShortcut`, `formatShortcut`) with scopes that respect dialogs and text fields, registers the app-level shortcuts (open Settings, jump to rail sections, close palette/dialog) and exposes shortcut hint formatting used by components such as the menu-bar menu (⌘O).

## 2. Context

The only shortcut drawn in the mocks is `⌘O` ('Otwórz Overmind') in the menu-bar menu (Tray). The webview has no OS-global shortcut permission (SETUP010 capability deny-by-default), so shortcuts exist only while the window has focus; macOS menu-bar shortcuts such as ⌘Q and ⌘W are a Rust menu proposal. The canvas has its own keymap (DS096 `canvasKeymap`) that must take priority inside the canvas. Features need one registry so they never attach raw `keydown` listeners.

## 3. Scope (in)

- `ShortcutProvider` mounted by SHELL010 (position in provider order is fixed there).
- API: `useShortcut(spec)`, `registerShortcut(spec)`, `formatShortcut(keys, platform)` -> '⌘O', `useShortcutHint(id)`.
- Scope stack: `global` < `route` < `panel` < `dialog`; the top scope wins; dialogs block lower scopes.
- Default shortcuts: `Mod+,` Settings; `Mod+1..5` rail sections (Workspaces, Chief, Workflow, Board, Decisions) and `Mod+6` Agents; `Mod+O` focus/open the main window (used when the Tray window triggers it); `Esc` handled by components, not here.
- Conflict detection in dev: two registrations of the same keys in the same scope throw.
- Help list `useShortcutList()` for a later help overlay (not built).

## 4. Out of scope

- OS-global shortcuts, macOS menu bar items (Rust proposal only).
- A command palette (not in the MVP mocks).
- Canvas keymap (DS096).
- Global Pause shortcut (deliberately absent, see open questions).

## 5. Detailed requirements

1. **Spec.** `{ id: string; keys: string /* 'Mod+O' */; scope; labelKey: string; when?: () => boolean; handler(e): void; allowInInput?: boolean }`. `Mod` = ⌘ on macOS (the only supported OS in MVP, ADR 0009), displayed as the glyph; other modifiers `Shift`, `Alt`, `Ctrl`.
2. **Input guard.** A shortcut without a modifier never fires while focus is in `input`, `textarea`, `select` or `[contenteditable]`, unless `allowInInput`. Modified shortcuts fire in inputs except when the same keys are reserved for text editing (`Mod+A/C/V/X/Z`, never registrable: a registration check throws).
3. **Scopes.** Dialog and menu open (`aria-modal` or `[role=menu]` in the DOM) -> only `dialog` scope handlers run. The canvas sets scope `panel` while focused so global rail shortcuts do not steal `Mod+1..` combos from it: canvas keymap does not use digits with Mod, and the provider ignores events whose `defaultPrevented` is already true.
4. **Navigation shortcuts.** Implemented through `useNavigateToRoute(railId)`; a shortcut for a rail slot with no installed route is not registered. Items come from the nav model (SHELL009) so adding a rail slot does not require editing this task.
5. **Settings.** `Mod+,` opens the last Settings sub-tab (`last-tab` memory from SHELL014).
6. **Main-window shortcut `Mod+O`.** Registered for symmetry with the tray hint: focuses the main window and navigates to the last route (no-op if already focused). Tray's own handler is TRAY007.
7. **Display.** `formatShortcut('Mod+O')` -> '⌘O', `Mod+Shift+P` -> '⇧⌘P' (macOS order: control, option, shift, command); `aria-keyshortcuts` attribute helper `ariaKeyshortcuts(keys)` returns 'Meta+O'. Tooltips of rail items append the hint (SHELL013 reads `useShortcutHint`).
8. **Teardown.** Registrations are removed on unmount; handlers are not captured stale (ref pattern); a single `keydown` listener on `window` in the capture phase.
9. **Accessibility.** Shortcuts never replace a visible control; every action has a pointer path. Sticky/IME composition (`event.isComposing`) is ignored.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `useNavigateToRoute` (SHELL010), nav model (SHELL009), `useWindowActivity` (SHELL008), `desktopShell.showWindow` (SHELL003), DS tooltip hint rendering.

## 8. Architecture and code placement

`apps/desktop/src/app/shortcuts/{shortcut-provider.tsx,use-shortcut.ts,format-shortcut.ts,parse-keys.ts,default-shortcuts.tsx,shortcut-registry.ts}`, locale file `apps/desktop/src/locales/{en,pl}/shell-keys.json`. UI infrastructure.

## 9. Security and safety

- No OS-global shortcuts are registered (no capability for it); a hostile page cannot listen outside the window.
- Shortcut handlers only trigger navigation or UI focus; none triggers an engine mutation (so a stuck key or paste cannot approve, pause or delete).
- Reserved text-editing combos cannot be hijacked.

## 10. Errors and edge cases

- Same keys registered twice in different scopes: higher scope wins, lower is shadowed (dev warning).
- Non-US keyboard layouts: match on `event.key` for letters and digits, `event.code` for `,`; tests for Polish programmer layout.
- Key repeat: `repeat` events ignored for navigation shortcuts.
- Focus in the terminal pane: terminal consumes keys; the provider ignores events from `[data-terminal]` unless the combination includes Mod and is registered as `allowInInput`.
- Window not focused: nothing fires.

## 11. Acceptance criteria

- [ ] Given `Mod+,` then the app opens Settings on the last sub-tab.
- [ ] Given focus in a text field then `Mod+1` navigates but a plain `g` shortcut does not fire.
- [ ] Given a dialog open then rail shortcuts do not fire.
- [ ] Given `formatShortcut('Mod+O')` then '⌘O'.
- [ ] Given duplicate registration in dev then an error is thrown.

## 12. Test plan

- Vitest + Testing Library with `user-event`: parsing, scopes, input guard, layouts, cleanup.
- Commands: `pnpm --filter @overmind/desktop test shortcuts`.

## 13. Parallelization notes

After SHELL009/010. Parallel with others. SHELL013 will read hints via `useShortcutHint` (soft dependency).

## 14. Open questions and assumptions

- DESIGN GAP: only ⌘O is drawn (Tray). All other shortcuts are proposals for the Owner.
- OPEN: a Global Pause shortcut is NOT provided (accidental trigger risk vs convenience); the Owner decides.
- OPEN: native menu bar (⌘Q, ⌘W, ⌘,) is a Rust request to SETUP010; hide-on-close with ⌘W must keep the engine running.
