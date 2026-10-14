---
id: OVE_WFED037
title: "Build the context menu for nodes, edges, frames and the canvas with keyboard opening"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS022, OVE_DS029, OVE_WFED024, OVE_WFED025, OVE_WFED031, OVE_WFED033, OVE_WFED034, OVE_WFED035, OVE_WFED036, OVE_WFED038, OVE_WFED042]
soft_depends_on: []
provides: ["ui:EditorContextMenu"]
needs: ["ui:WorkflowCanvasPane", "lib:editor-selection", "lib:editor-add-node", "lib:editor-clipboard-wiring", "lib:editor-group-wiring", "lib:editor-lane-wiring", "lib:editor-skill-menu", "lib:editor-delete-wiring", "ui:Menu", "ui:Kbd", "lib:editor-shortcuts", "lib:editor-announcer", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/EditorContextMenu.tsx", "apps/desktop/src/features/workflow-editor/canvas/context-menu-model.ts", "apps/desktop/src/features/workflow-editor/canvas/useContextMenuTrigger.ts", "apps/desktop/src/features/workflow-editor/canvas/context-menu-model.test.ts", "apps/desktop/src/features/workflow-editor/canvas/EditorContextMenu.test.tsx", "apps/desktop/src/features/workflow-editor/canvas/EditorContextMenu.stories.tsx", "apps/desktop/src/locales/en/wfc-ctx.json", "apps/desktop/src/locales/pl/wfc-ctx.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED037: Build the context menu for nodes, edges, frames and the canvas with keyboard opening

## 1. Summary

One context menu for the whole canvas: right-click, the Context-menu key or Shift+F10 on a node, edge, frame or empty canvas opens a menu whose items are built from the target and the mode. It is the keyboard and non-drag path for adding, connecting, copying, grouping, binding to a Lane, assigning Skills and deleting.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. DS096 requires keyboard alternatives for every drag: node focus + `Shift+F10` or the context key opens a node menu (`Dodaj Skill…`, `Połącz z…`, `Usuń`). VIEWS lists the context menu as a state not shown in the mock. The menu model is data (a list of items with ids, labels, shortcuts, enabled state and reasons), built by a pure function, so it is testable and extensible (OCP: sections come from registered providers).

## 3. Scope (in)

- `buildContextMenu(target, state)` pure model builder with sections from providers.
- `EditorContextMenu` component using `ui:Menu`.
- Triggers: pointer, keyboard.
- The initial set of items and their enablement rules.

## 4. Out of scope

- The actions themselves (their owning tasks), search (WFED039), Skill library (WFED040).

## 5. Detailed requirements

1. Targets: `{ kind: "node", keys }` (single or multi), `{ kind: "edge", id }`, `{ kind: "group", id }`, `{ kind: "pane", at: Point }`. A right-click on an unselected element selects it first (replace selection) like most editors; right-click on a selected element keeps the multi-selection.
2. Trigger (`useContextMenuTrigger`): the pane container `onContextMenu` resolves the target from the event through the kit callback `onContextMenu({ target, clientX, clientY, viaKeyboard })` when provided (ASSUMPTION, see section 14) else by the `data-node-id` / `data-edge-id` / `data-group-id` attributes the kit renders; `Shift+F10` and the ContextMenu key open it for the focused element (`selection.focus`) at the element rectangle bottom-left; `Esc` closes and returns focus to the element.
3. Items for a node: `Otwórz w Inspektorze` (Enter), `Dodaj Skill… ▸` (submenu listing assignable Skills with reasons for disabled ones, WFED041/042), `Połącz z…` (starts keyboard connect, WFED032), `Duplikuj` (Cmd+D), `Kopiuj`/`Wytnij` (Cmd+C/X), `Grupuj jako… ▸` (WFED035), `Dodaj do grupy ▸`/`Usuń z grupy`, `Przypisz do Toru ▸` (WFED036), `Obramuj pętlę` (Loop nodes only), separator, `Usuń` (Delete, destructive tone). Multi-selection hides single-node items (`Otwórz w Inspektorze`, `Dodaj Skill…`, `Połącz z…`).
4. Items for an edge: `Otwórz w Inspektorze`, `Usuń połączenie` (Delete). Frame: `Zmień nazwę`, `Rozgrupuj`, `Zaznacz członków`. Pane: `Dodaj Węzeł ▸` (quick-add list, WFED031), `Wklej` (Cmd+V, enabled when the last fragment exists), `Zaznacz wszystko` (Cmd+A), `Dopasuj widok`, `Przyciąganie do siatki` (checkable), `Pokaż legendę`, `Skróty klawiszowe` (opens the help dialog, WFED038).
5. Each item: `{ id, labelKey, shortcut?, icon?, enabled, disabledReasonKey?, destructive?, children?, run }`; disabled items stay visible with the reason as tooltip text (never hidden silently, except items that make no sense for the target). Shortcut hints rendered with `ui:Kbd` using platform glyphs.
6. Mode `view`: only read-only items remain enabled (`Otwórz w Inspektorze`, `Kopiuj`, `Zaznacz wszystko`, `Dopasuj widok`, `Dodaj Skill…` because assignment changes the Agent, not the draft, `Skróty klawiszowe`); editing items are disabled with the reason "Tylko do odczytu".
7. Extension: other tasks contribute sections through `registerMenuSection({ id, order, build(target, state): Item[] })` in files `canvas/menu-sections/*.section.ts` collected by `import.meta.glob`; this task ships the sections for the items above by calling the hooks of the owning tasks (it does not re-implement actions).
8. Accessibility: `role="menu"`, roving focus with arrows, type-ahead, Home/End, submenus on ArrowRight/Left, `aria-keyshortcuts`, focus returns to the origin; opens within the viewport (flip logic from `ui:Menu`).
9. Messages in `wfc-ctx` (EN default and PL), one key per item and reason.

## 6. Design notes

Not in the mock: use the kit `Menu` (surface `bg-surface`, radius 14, `line-strong` border, item height 36, text 14, shortcut `Kbd` 12 mono right aligned, destructive item text `#FF8FA3` with a trash icon, separators `Divider`). Disabled items at opacity .4 with `aria-disabled` and the reason as tooltip. Reduced motion: no scale animation.

## 7. Reuse

- `ui:Menu`/`MenuItem`/`MenuSeparator`, `ui:Kbd` (DS); wiring hooks of WFED031, WFED033..WFED036; `selection.focus` (WFED025).

## 8. Architecture and code placement

Layer: `canvas/` UI. The model builder is pure; sections registered via glob (OCP). No actions implemented here (SRP).

## 9. Security and safety

The menu never performs an action the underlying task would refuse; every item calls the same guarded hook as its shortcut. Labels shown for nodes come from untrusted text and are rendered as text.

## 10. Errors and edge cases

- Right-click on an unselected node selects it first.
- Menu opened near the viewport edge: flips.
- Menu opened while a drag is active: ignored.
- Target removed while the menu is open (undo elsewhere): menu closes.
- No enabled items (view mode on an edge): menu still opens with the disabled list.
- Multi-select of mixed types: only commonly applicable items enabled.

## 11. Acceptance criteria

- [ ] Given a right-click on Developer, Then the menu lists the node items in the specified order with shortcuts.
- [ ] Given `Shift+F10` on a focused node, Then the same menu opens and Esc returns focus to the node.
- [ ] Given view mode, Then `Usuń` is disabled with "Tylko do odczytu" and `Dodaj Skill…` stays enabled.
- [ ] Given a Loop node, Then `Obramuj pętlę` is present; for an Agent node it is absent.
- [ ] Given a new menu section file, Then it appears without editing this task files.

## 12. Test plan

Pure tests of `buildContextMenu` per target/mode (table), RTL tests with keyboard navigation, Storybook stories per target, axe. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/context-menu-model src/features/workflow-editor/canvas/EditorContextMenu`.

## 13. Parallelization notes

Last of the wiring tasks (depends on the hooks of WFED031, WFED033..WFED036). Parallel with WFED038..WFED043.

## 14. Open questions and assumptions

- PROPOSAL to DS095: `FlowCanvas` should expose `onContextMenu({ target: { kind, id }, clientX, clientY, viaKeyboard })`; default used here is that API with a DOM-attribute fallback.
