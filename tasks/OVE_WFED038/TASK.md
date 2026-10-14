---
id: OVE_WFED038
title: "Build the shortcut registry, the editor action bus and the shortcuts help dialog"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS022, OVE_DS026, OVE_DS036, OVE_WFED019, OVE_WFED021, OVE_WFED022, OVE_WFED024, OVE_WFED025, OVE_WFED026, OVE_WFED027]
soft_depends_on: []
provides: ["lib:editor-shortcuts", "ui:ShortcutsDialog", "lib:editor-action-bus", "ui:CanvasKeyboardInstructions"]
needs: ["lib:editor-session", "lib:editor-selection", "lib:editor-announcer", "lib:editor-autosave", "lib:editor-save-state", "ui:EditorViewControls", "lib:editor-snap", "ui:Dialog", "ui:Kbd", "ui:SectionLabel", "ui:SearchField", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/shortcuts/registry.ts", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/keys.ts", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/all-bindings.ts", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/action-bus.ts", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/useEditorKeyboard.ts", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/editor.shortcuts.ts", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/ShortcutsDialog.tsx", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/CanvasKeyboardInstructions.tsx", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/*.test.ts", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/*.test.tsx", "apps/desktop/src/features/workflow-editor/canvas/shortcuts/ShortcutsDialog.stories.tsx", "apps/desktop/src/locales/en/wfc-keys.json", "apps/desktop/src/locales/pl/wfc-keys.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED038: Build the shortcut registry, the editor action bus and the shortcuts help dialog

## 1. Summary

One place that owns keyboard shortcuts of the editor: a declarative binding format, a registry assembled from `*.shortcuts.ts` files (adding a shortcut means adding a file, not editing the registry), an action bus that wiring hooks use to attach behaviour, safe guards (view mode, text inputs, dialogs, IME) and the `?` help dialog that lists everything. It also registers the editor-wide shortcuts: undo, redo, save now, zoom, fit, search, snap toggle.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. DS096 already executes some keys inside the kit canvas (Select all, Esc, arrows, `C` to connect, Enter to open the Inspector, `Shift+F10`), WCAG 2.1.4 asks that single-character shortcuts can be turned off or are scoped to a focused component, and WCAG 2.5.7 asks for a keyboard alternative for every drag. Other WFED tasks already name their bindings in their own `*.shortcuts.ts` file (`quick-add`, `connect`, `delete`, `clipboard`, `group`, WFED031..WFED035) and use this registry for the guards. The product runs in a Tauri webview on macOS first (ADR 0009), so `mod` means Cmd there and Ctrl elsewhere (tests cover both).

## 3. Scope (in)

- `ShortcutBinding` type, key-string parser and matcher (`keys.ts`).
- `registry.ts` (collect, conflict detection, lookup by action) and `all-bindings.ts` (assembles every `*.shortcuts.ts` of the feature with `import.meta.glob`).
- `action-bus.ts` with `useEditorAction` and `runAction`.
- `useEditorKeyboard` (one `keydown` listener on the editor region, not on `window`).
- `editor.shortcuts.ts`: undo, redo, save now, zoom in/out/reset, fit, search, snap, help.
- `ShortcutsDialog`, `CanvasKeyboardInstructions` and the `wfc-keys` strings.

## 4. Out of scope

- The behaviour of delete, clipboard, group, connect, add (their own tasks register handlers).
- Global application shortcuts of the shell (SHELL area).
- User-customisable shortcuts (post-MVP).
- Executing the keys the kit already executes (they are listed only for help, `handledBy: "kit"`).

## 5. Detailed requirements

1. ```ts
interface ShortcutBinding {
  id: string;                       // unique, "<group>.<verb>", e.g. "history.undo"
  action: ActionId;                 // equals id unless several bindings share one action
  keys: readonly string[];          // alternatives, e.g. ["mod+z"]; syntax: modifiers mod|ctrl|meta|alt|shift joined by "+", then a key name compared against KeyboardEvent.key lower-cased ("z", "delete", "arrowup", "?", "=")
  group: "edit" | "selection" | "view" | "nodes" | "connect" | "help";
  modes: readonly ("edit" | "view")[];                // where the binding is live
  handledBy: "registry" | "kit" | "dom-event";        // kit = executed by the kit canvas, dom-event = real copy/paste events (WFED034); both are only documented here
  repeat?: "allow" | "ignore";                         // default ignore; allow only for undo, redo, zoom, delete
  allowInEditable?: false;                             // always false in MVP, field exists so a test can assert nobody sets it
}
interface EditorActionBus { register(id: ActionId, handler: () => void | Promise<void>, opts?: { enabled?: () => boolean }): () => void; run(id: ActionId, source: "keyboard" | "menu" | "toolbar"): "ran" | "disabled" | "missing"; isEnabled(id: ActionId): boolean }
function useEditorAction(id: ActionId, handler: () => void, opts?: { enabled?: boolean }): void   // registers in an effect, unregisters on unmount
```
2. Assembly: each `*.shortcuts.ts` file has a default export `ShortcutBinding[]`. `all-bindings.ts` collects them with `import.meta.glob("../**/*.shortcuts.ts", { eager: true })` and flattens in file-name order. The registry validates at module load in dev and in tests: unique ids, parsable keys, no two bindings with the same normalised key combination and an overlapping mode (a conflict is a test failure that names both ids), every `action` has a label in `wfc-keys` (`action.<id>`), and `handledBy: "registry"` bindings are never single printable characters without `shift`/`alt` unless the group is `connect` or `nodes` and the binding is documented as scoped (the editor region only). Adding a shortcut therefore requires only a new file.
3. Matching: the listener is attached to the editor region element (the container of the pane and the side rail, `data-wfc-region="editor"`, a React ref owned by `useEditorKeyboard`) in the bubble phase, so focus inside the Inspector or a dialog portal never reaches it. It ignores the event when: `event.defaultPrevented` (the kit or an input handled it), `event.isComposing` or `keyCode === 229` (IME), the target is an editable element (`input`, `textarea`, `select`, `[contenteditable]`, `[role=textbox|combobox|searchbox]`), a modal dialog is open (`document.querySelector("[aria-modal=true]")`), or the binding mode does not include the session mode. Matching uses `event.key` (layout independent, Polish programmer layout works) with `event.code` only for `+`/`=`/`-` zoom fallbacks; `mod` is `metaKey` on macOS (detected once from `navigator.userAgentData?.platform ?? navigator.platform`) and `ctrlKey` otherwise; extra modifiers that the binding does not list must be absent (so `mod+z` does not match `mod+shift+z`).
4. Dispatch: a match calls `bus.run(action, "keyboard")`; when the result is `ran` the registry calls `preventDefault` and `stopPropagation` (so Cmd+S never reaches the webview, Cmd+D never bookmarks, Cmd+F never opens a native find); `disabled` (view mode, nothing to undo, empty selection) still `preventDefault`s for the keys that have a browser meaning (`mod+s`, `mod+d`, `mod+f`, `mod+g`) and does nothing else; `missing` (no handler mounted) does nothing and lets the event continue.
5. Action bus: `register` throws in development when an id is registered twice at the same time (a wiring bug), in production the later registration wins and the earlier is restored on its unmount; handlers run inside `try/catch`, a thrown error is logged with the action id only and announced (`wfc-keys:error.action`), it never breaks the listener. `useEditorAction` keeps the latest handler in a ref so re-renders do not re-register. The bus is also what the context menu (WFED037) and the toolbar call, so a menu item and its shortcut always run the same code.
6. Bindings owned here (`editor.shortcuts.ts`, all `handledBy: "registry"` unless noted): `history.undo` `mod+z` (calls `session.undo`, enabled when `canUndo`), `history.redo` `mod+shift+z` and `ctrl+y` (non-mac only), `draft.saveNow` `mod+s` (calls `autosave.flush()` of WFED022, announces `Zapisano wersję roboczą` or the conflict state; in `view` mode it is disabled and `preventDefault`s), `view.zoomIn` `mod+=` and `mod++`, `view.zoomOut` `mod+-`, `view.zoomReset` `mod+0` (back to 70 %), `view.fit` `shift+1`, `search.open` `mod+f` (calls `openSearch` of the view context, works in both modes), `snap.toggle` `shift+g` (toggle of WFED026, announces `Przyciąganie do siatki: włączone|wyłączone`), `help.shortcuts` `?` (a printable key: scoped to the editor region and ignored in inputs, satisfying WCAG 2.1.4). Documented only: `selection.all` `mod+a` and `selection.clear` `escape` (kit), `node.open` `enter` (kit), `node.nudge` arrows (kit, WFED026), `context.menu` `shift+f10` (WFED037), `clipboard.copy|cut|paste` (`dom-event`, WFED034).
7. Zoom handlers call the viewport controller from `EditorViewContext` (WFED027); they are no-ops while the container is hidden. Undo and redo announce their label through the announcer (`Cofnięto: {label}` is produced by the session effects, WFED019, so this task does not announce twice).
8. `ShortcutsDialog` (`ui:Dialog`, size md, title `Skróty klawiszowe`): groups in the order edit, selection, nodes, connect, view, help, each row `label` + one or more `ui:Kbd` rendered with platform glyphs (`⌘`, `⇧`, `⌥`, `⌫` on macOS; `Ctrl`, `Shift`, `Alt` elsewhere); rows of bindings that are not live in the current mode are dimmed with `(tylko edycja)`; a `ui:SearchField` filters rows by label (case and diacritics insensitive); open with `?`, the context menu, and the toolbar overflow of PART 2; Esc closes and focus returns to the opener; the dialog lists bindings from the registry, never from a hand-written table (DRY).
9. `CanvasKeyboardInstructions` (`ui:CanvasKeyboardInstructions`): a visually hidden element with `id = CANVAS_INSTRUCTIONS_ID` (`wfc-canvas-instructions`, WFED024) that the canvas references through `aria-describedby`; text (`wfc-keys:instructions`, PL) `Canvas Workflow. Tab przechodzi między Węzłami. Strzałki przesuwają zaznaczony Węzeł, C zaczyna połączenie, Delete usuwa, Enter otwiera Inspektora, Shift+F10 otwiera menu, znak zapytania pokazuje wszystkie skróty.`; it is generated from the live registry for the keys it names (so a rebinding cannot make it wrong), and in `view` mode only the read-only sentences are included.
10. `ariaKeyShortcuts(actionId): string | undefined` helper (W3C `aria-keyshortcuts` syntax: `Meta+Z`, `Control+Z`) used by menu items and toolbar buttons; `formatKeys(binding, platform)` is the single source for glyph text used by tooltips (`Cofnij · ⌘Z`).
11. Strings (`wfc-keys`): `title`, `search`, `empty`, `group.edit|selection|nodes|connect|view|help`, `action.<id>` for EVERY binding in the registry (labels of bindings owned by other tasks live here too, so no other task edits this file), `onlyEdit`, `error.action`, `announce.snapOn`, `announce.snapOff`, `announce.saved`, `announce.saveFailed`.

## 6. Design notes

Not in the mock: the help dialog follows the kit `Dialog`: radius 20, `bg-surface`, `line-strong` border, title 20/700, group headings as `ui:SectionLabel` (mono 11, `#8C80A6`, +0.1em), rows 36 px with a label 14 and key caps right-aligned (`ui:Kbd`: mono 12, radius 6, `1px line-control`, bg `#0C0814`). No colour carries meaning. Width 560, max height 80 vh, the list scrolls inside the dialog.

## 7. Reuse

- `ui:Dialog`, `ui:Kbd`, `ui:SectionLabel`, `ui:SearchField`; session `undo/redo/canUndo` (WFED019); autosave `flush` (WFED022); snap preference (WFED026); `EditorViewContext` (WFED027); announcer (WFED024); `lib:canvasKeymap` of the kit only for reading which keys the kit owns (the registry does not import its handlers).

## 8. Architecture and code placement

Layer: UI wiring in `canvas/shortcuts/`. `keys.ts`, `registry.ts` and `action-bus.ts` are framework-free and fully unit tested; only `useEditorKeyboard`, `useEditorAction` and the dialog import React. DIP: wiring tasks depend on the bus interface, not on each other; OCP: new bindings are new files found by the glob.

## 9. Security and safety

Shortcuts are an input path and must obey the same guards as the mouse: no action runs in `view` mode unless its binding says so; a shortcut never runs while the user types in a field (so pasting a Skill name into the search box cannot delete nodes); `Delete` while an Inspector input has focus is the browser editing key; the listener ignores synthetic events (`event.isTrusted === false`) so a script in a rendered label cannot trigger actions; `preventDefault` is limited to keys that were matched and run, never blanket. No key is ever logged.

## 10. Errors and edge cases

- Two bindings with the same keys in the same mode: the registry test fails at build time naming both.
- `mod+z` while a text field has focus: the field undoes its own text, the editor does not.
- Keyboard layout without `=` on the same key as `+` (Polish programmer layout): `mod+=` and `mod++` both match through `key` or `code`.
- Key repeat on `Delete`: allowed, one history entry per press is merged by the delete task.
- Dialog open: no editor shortcut fires.
- Handler registered twice (wiring bug): dev error, production keeps the newest.
- `?` typed in the node search box: ignored (editable target).
- Window loses focus mid chord: modifiers are read from the event, no stuck state is kept.

## 11. Acceptance criteria

- [ ] Given the real set of `*.shortcuts.ts` files, Then the registry test passes: unique ids, no conflicts, every action has a `wfc-keys` label.
- [ ] Given focus in a text input, When the user presses `Delete` or `mod+z`, Then no editor action runs.
- [ ] Given `edit` mode and one undoable change, When `mod+z` is pressed on the canvas, Then `session.undo` runs once and the default is prevented.
- [ ] Given `view` mode, When `mod+s` is pressed, Then nothing is saved and the browser save dialog does not open.
- [ ] Given a platform of macOS, Then `mod+z` is Cmd+Z and Ctrl+Z does nothing; given another platform the opposite.
- [ ] Given a new file `foo.shortcuts.ts` with one binding, Then it appears in the help dialog without editing any other file.
- [ ] Given `?` pressed on the canvas, Then the dialog opens, lists every live binding with glyphs and returns focus on Esc.

## 12. Test plan

Unit tests for the key parser (table), matcher (modifiers, layouts, IME, repeat), registry conflict detection (positive and negative fixtures), action bus (register, duplicate, disabled, error isolation); RTL tests of `ShortcutsDialog`; a jsdom keyboard integration test with the real session; axe on the dialog. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/shortcuts`.

## 13. Parallelization notes

Other tasks register behaviour through the bus; they only need the types of this task, so it can be merged early (S-sized core: `keys.ts`, `registry.ts`, `action-bus.ts`). Conflict hotspot: none (every other task adds its own `*.shortcuts.ts`).

## 14. Open questions and assumptions

- ASSUMPTION: bindings are not user-configurable in MVP; the `ShortcutBinding` shape leaves room for a user override layer.
- ASSUMPTION: `mod+s` means "save the draft now" because autosave already persists (WFED022); PART 2 may bind Publish to a different key and must register it as its own `*.shortcuts.ts` file.
- OPEN (Owner): single-character shortcuts (`C`, `?`) are scoped to the focused editor region; confirm that no global toggle to disable them is needed (WCAG 2.1.4 is met by scoping).
