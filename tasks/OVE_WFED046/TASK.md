---
id: OVE_WFED046
title: "Audit the canvas for keyboard-only use, screen readers, reduced motion, target size"
area: WFED
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_TEST004, OVE_WFED002, OVE_WFED024, OVE_WFED025, OVE_WFED026, OVE_WFED031, OVE_WFED032, OVE_WFED033, OVE_WFED034, OVE_WFED035, OVE_WFED037, OVE_WFED038, OVE_WFED039, OVE_WFED042, OVE_WFED044]
soft_depends_on: []
provides: ["suite:editor-a11y"]
needs: ["ui:EditorSideRail", "ui:WorkflowCanvasPane", "lib:editor-provider", "lib:editor-shortcuts", "lib:editor-announcer", "lib:editor-test-builders", "lib:playwright-harness", "lib:mock-gateway-control", "lib:e2e-fixtures", "lib:i18n-ui"]
owns: ["apps/desktop/e2e/workflow-editor/a11y.spec.ts", "apps/desktop/e2e/workflow-editor/a11y-matrix.ts", "apps/desktop/src/features/workflow-editor/testing/a11y/**", "apps/desktop/src/locales/en/wfc-a11y.json", "apps/desktop/src/locales/pl/wfc-a11y.json", "docs/frontend/workflow-editor-a11y.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED046: Audit the canvas for keyboard-only use, screen readers, reduced motion, target size

## 1. Summary

Proves that every pointer operation in the editor has a keyboard route and that the canvas is usable with a screen reader: an executable matrix "drag X -> keyboard Y", a keyboard-only walkthrough that builds and edits a Workflow, axe scans of every state, live-region checks, reduced-motion and target-size checks. Findings that belong to the kit are filed against DS, not patched here.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. WCAG 2.2 AA is the target (inventory E17..E19, G4 of the DS tasks): 2.1.1 keyboard, 2.1.4 character shortcuts, 2.4.3 focus order, 2.4.7 focus visible, 2.5.7 dragging movements (every drag needs a single-pointer or keyboard alternative), 2.5.8 target size (24x24 CSS px minimum), 4.1.3 status messages. The drag-driven features of the editor are: moving a node, adding a node from the palette, connecting ports, assigning a Skill, resizing or grouping frames, panning and zooming, multi-select by box. The kit canvas provides the keyboard mechanics (DS096); the editor wiring adds announcements and menus (WFED024..WFED044). This task is the audit.

## 3. Scope (in)

- The matrix file: one row per pointer operation with its keyboard route and a test id.
- Playwright keyboard-only walkthrough and axe scans.
- Live-region assertions (what is announced and when).
- Reduced-motion, forced-colors and zoom (200 % browser zoom) checks.
- Target-size measurement of interactive elements in the editor.
- `wfc-a11y` strings for any audit-only helper text, and the audit document.

## 4. Out of scope

- Fixing defects (each finding is a bug on the owning task or DS; this task only reports and keeps a failing test marked `fixme` with the issue id).
- Screen-reader product testing with real VoiceOver (manual checklist is documented, not automated).
- The shortcuts themselves (WFED038).

## 5. Detailed requirements

1. Matrix (`a11y-matrix.ts`, typed, also rendered into the doc): `move node` -> arrow keys on the focused node (Shift = 5 steps, WFED026); `add node from palette` -> Enter/Space on a chip adds at the viewport centre, `Shift+A` quick-add; `connect` -> `C` from a focused node, arrows to pick the target, Enter, Esc (WFED032); `assign Skill` -> `Przypisz do…` on the Skill row, `Dodaj Skill…` in the node menu (WFED042); `group/ungroup` -> `Cmd+G`, `Cmd+Shift+G`, menu `Grupuj jako…` (WFED035); `rename frame` -> context menu and Enter; `add to frame` -> menu `Dodaj do grupy` (WFED035); `delete` -> Delete; `copy/paste/duplicate` -> keys; `select several` -> `Cmd+A` and Shift+Space to toggle the focused node (kit, asserted); `pan` -> arrow keys on the focused empty canvas move the viewport by 40 px (Shift 200) and `+/-` zoom (kit and WFED038); `zoom` -> `Cmd+=`, `Cmd+-`, `Cmd+0`, toolbar buttons; `box select` -> `Cmd+A` then Shift+Space to deselect; `open Inspector` -> Enter; `search` -> `Cmd+F`. A test fails when a pointer operation exists in the repository list of intents (`AddNodeIntent`, `AttachSkillIntent`, `MoveNodesIntent`, `ConnectIntent`, `DeleteIntent`, `ResizeGroupIntent`) without a matrix row (the intent union is imported as a type, a `satisfies Record<Intent["kind"], Row>` makes a new intent a compile error).
2. Keyboard-only walkthrough (Playwright, no mouse API at all, asserted by a guard that throws on `page.mouse` use): open the editor on a fixture draft; Tab through the rail (Skills search, filter, rows, palette chips) and the canvas; add an Agent with Enter on its chip; move it with arrows; add a second node, connect them with `C`, arrows and Enter; try an illegal connection and read the refusal from the live region; assign a Skill through `Przypisz do…`; group two nodes; undo and redo; open the search and reveal a node; open the shortcuts dialog and close it with Esc; delete a node; every step asserts the focus location (`document.activeElement` data attributes) and the last announced message.
3. Focus rules asserted: a single Tab stop for the rail lists (roving) and one for the canvas with Tab moving through nodes in reading order (top-to-bottom, left-to-right, group order), the focus ring is visible on every focusable element (computed outline or box-shadow present and contrast >= 3:1 against its background), focus is never lost to `body` after delete, undo, paste, ungroup or dialog close (it moves to the neighbouring node, the canvas, or the opener), dialogs trap focus and restore it, no `tabindex > 0` anywhere.
4. Names and roles: the canvas has a name (`Canvas Workflow: {name}`) and a description (the instructions of WFED038); every node tile has an accessible name `{label}, {typeWord}, {Agent visibility word}, {n} skille, {state}` (word-based, never colour-based), ports have names `{Węzeł} · {port}`, edges are exposed as a list reachable from the canvas (`Połączenia: A do B`) or described on the nodes (kit decision, asserted either way), selected state is `aria-selected` or `aria-pressed` as the kit defines; axe-core runs (via `@axe-core/playwright`) on: empty canvas, mock graph, selection, multi-selection, connect mode, each dialog and menu, view mode, the Skill drag state (armed), error and conflict states. Zero serious or critical violations allowed; minor ones need a listed waiver with an issue id in `a11y-waivers.json`.
5. Live regions (`announcer` WFED024 and kit region DS096): a table of events to expected polite or assertive messages (node added, connected, refused, deleted, undone, pasted, grouped, skill assigned, skill refused, save conflict, search count); assertions use a helper that reads the live region text with a 600 ms window and checks (a) one message per event, (b) no duplicate within 500 ms, (c) assertive only for refusals and errors.
6. Reduced motion: with `prefers-reduced-motion: reduce` emulated, no CSS animation or transition longer than 1 ms runs on the canvas, rail and dialogs (checked through `getAnimations()` after each interaction) and viewport changes (fit, reveal, zoom) are instant. Forced colors (`forced-colors: active`) screenshot test of tiles, selection ring, drop target and edges: states stay distinguishable (word and outline).
7. Target size (2.5.8) and zoom: every interactive element in the rail, toolbar, menus, dialogs and the port handles has a hit area >= 24x24 CSS px or sufficient spacing (measured by `boundingBox`); the editor is usable at 200 % browser zoom (rail and canvas reachable, no horizontal page scroll, toolbar not covering the focused node: the canvas scrolls it into view).
8. Manual checklist (documented in `docs/frontend/workflow-editor-a11y.md`, run before a release with VoiceOver on macOS): reading the canvas, navigating nodes, hearing refusals, using `Przypisz do…`, plus how to record results. The doc also holds the matrix table (generated from `a11y-matrix.ts`).
9. Findings workflow: a failing check either gets fixed by its owner or is marked `test.fixme(...)` with the issue id so the suite stays green while the defect is tracked; the number of `fixme` entries is printed by the suite and must be zero for the MVP release candidate (a CI check on the release branch).

## 6. Design notes

N/A, functionality only. The audit reads the rendered states of the Main view as described in `design.png` of the other tasks; it adds no visuals.

## 7. Reuse

- `lib:playwright-harness`, `lib:mock-gateway-control`, `lib:e2e-fixtures` (TEST004); `@axe-core/playwright` (already planned by the DS stories, SETUP area); the editor fixtures of WFED017 and the perf fixtures only for the zoom check.

## 8. Architecture and code placement

Layer: tests only (`e2e/workflow-editor/`, `testing/a11y/`). The matrix is a typed data file so that adding an intent to the kit forces a decision in review (OCP, no hidden gaps).

## 9. Security and safety

No user data. The mouse guard prevents the suite from passing by accident through pointer paths. The suite must not weaken any application guard (for example it never sets a flag that disables the editable-focus rule of the shortcuts).

## 10. Errors and edge cases

- Kit changes the DOM role of tiles: the test reads roles through `getByRole` and fails clearly with the finding instead of passing silently.
- Screen-reader text longer than 250 characters on a tile: warning (verbosity budget).
- Polish diacritics in accessible names: asserted as exact strings.
- Animations created by the OS emulation: `getAnimations()` returns finished ones; only running ones count.
- A waiver without an issue id: the suite fails.

## 11. Acceptance criteria

- [ ] Given the matrix, Then every kit intent kind has a row with a keyboard route and a test id (compile-time and runtime check).
- [ ] Given the keyboard-only walkthrough, Then it completes without any mouse event and with correct focus after each step.
- [ ] Given axe on every listed state, Then there are zero serious or critical violations except the listed waivers.
- [ ] Given each event of the live-region table, Then exactly the expected message is announced once with the right politeness.
- [ ] Given reduced motion, Then `getAnimations()` reports no running animation after any interaction.
- [ ] Given the measured targets, Then none is below 24x24 CSS px without spacing compensation.
- [ ] Given the doc generator, Then `workflow-editor-a11y.md` contains the current matrix.

## 12. Test plan

Playwright + axe (`pnpm --filter @overmind/desktop e2e --grep @a11y`), with a Vitest unit test for the matrix completeness (`vitest run src/features/workflow-editor/testing/a11y`). Runs on PRs that touch the editor feature or the canvas kit.

## 13. Parallelization notes

Parallel with WFED045, WFED047..WFED049 after the wiring tasks; can start with the matrix and the walkthrough skeleton earlier using `test.fixme`.

## 14. Open questions and assumptions

- ASSUMPTION: edges are not individually focusable in the kit (DS096 lists nodes only); the audit then requires an alternative (edge list description or `Połączenia` in the Inspector). Raise with DS if neither exists.
- ASSUMPTION: keyboard pan with arrows on an empty canvas is implemented by the kit; if not, a binding is added to WFED038 (proposal).
- OPEN (Owner): real VoiceOver pass is manual before release; automating it is out of scope.
