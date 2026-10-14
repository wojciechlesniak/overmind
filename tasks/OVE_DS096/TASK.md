---
id: OVE_DS096
title: Build canvas editing interactions (palette drop, snapping, connections, keyboard, undo)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS039, OVE_DS067, OVE_DS095]
soft_depends_on: ["OVE_SETUP010"]
provides: ["ui:CanvasInteractions", "lib:canvasKeymap", "lib:canvasHistory"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "lib:skillDragPayload", "ui:SkillDropZone"]
owns: ["packages/ui-kit/src/canvas/flow/interactions/**"]
reads: ["OVE_SETUP010"]
design: design.png
design_source: "Main#canvas/skill-item-dragging + drop target (crop 72,652,240,92 CSS px); design-drop.png = Main (crop 820,745,190,110); design-chip.png = Main (crop 860,698,180,50)"
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 3"]
adr_refs: [18, 19, 3]
---

# OVE_DS096: Build canvas editing interactions (palette drop, snapping, connections, keyboard, undo)

## 1. Summary

Adds the editing behaviour on top of OVE_DS095: dropping nodes from the palette, Skill drops onto a node's Skills tab (using the kit DnD helpers), snapping to the 22px grid, connection rules feedback, selection (single, box, multi), keyboard operation (move, connect, delete, navigate the graph), and undo/redo through a pure history reducer. Emits intents only.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.6, C11.7, B3 (SkillsTab drop target), E29, E19. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The Owner builds Workflows by dragging Agents/operators from the palette and Skills onto tiles (SPEC 8, 3). The runtime is separate (ADR 0019): every change is an intent that the feature sends to the engine, which validates and persists a new version (`Edytuj jako v8`). Tauri must have `dragDropEnabled: false` on the window, otherwise native file-drop swallows HTML5 drag events (OVE_SETUP010).

## 3. Scope (in)

- Palette-to-canvas drop (node creation intent with world position), Skill drop on SkillsTab with `canAccept` re-check, snap, connection validation UI, selection/multi-select, keyboard map, delete, undo/redo history reducer, live region announcements, drag auto-pan at the edge.

## 4. Out of scope

- Applying changes to the Workflow (feature + engine), validation rules content (engine returns reasons), palette visuals (OVE_DS097, OVE_DS098).

## 5. Detailed requirements

1. Intents emitted (typed, exported): `AddNodeIntent { kind: NodeKind; position: Point }`, `AttachSkillIntent { nodeId: string; skill: { id: string; version: string } }`, `MoveNodesIntent`, `ConnectIntent`, `DeleteIntent { nodeIds; edgeIds }`, `ResizeGroupIntent`. The component NEVER changes the model; it calls `onIntent(intent)` and shows pending/refused feedback from props (`pendingIntentId`, `refused: { intentId; reason }`).
2. Palette node drop: the palette (OVE_DS098) uses a custom MIME `application/x-overmind-node+json` payload `{ v: 1, kind }` validated against the `NodeKind` allowlist; on `drop` over the canvas pane the screen point converts with `screenToWorld`, then snaps; invalid payloads are ignored. Dropping outside the pane cancels. While dragging, a ghost outline of the default size follows the pointer (kit `NodeTile` in `ghost` rendering, opacity .5).
3. Skill drop: uses `lib:skillDragPayload` and the module-scoped drag store from OVE_DS067 (`dataTransfer` data is unreadable during `dragover`): on `dragenter` over a node the adapter calls `canAccept(nodeId, skill)` (supplied by the feature: checks agent kind, duplicate, visibility rule: a PRYWATNY Skill cannot go to a PUBLICZNY Agent, ADR 0028) and sets `drop.accepting` on that node (`valid`/`invalid`, visuals in OVE_DS089); on `drop` it RE-CHECKS `canAccept` with the validated payload and emits `AttachSkillIntent`; otherwise shows the reason (live region + invalid flash). Only the SkillsTab and the face hit area of the node accept; the drop target is the whole tile in the mock, the tab shows the text.
4. Keyboard alternative (mandatory, WCAG 2.5.7): every drag has a keyboard path: palette item `Enter`/menu `Przypisz do…` (a `ui:Menu` listing nodes) and palette node `Enter` = `Dodaj Węzeł` at the viewport centre; node focus + `Shift+F10`/context key opens the node menu (`Dodaj Skill…`, `Połącz z…`, `Usuń`).
5. Selection: click selects one node/edge (violet ring), `Shift`/`Cmd` click toggles, drag on empty pane = selection box (React Flow `selectionOnDrag` with `panOnDrag=[1,2]`; Space or middle drag still pans), `Cmd/Ctrl+A` selects all, `Esc` clears. Selection changes call `onSelectionChange`; the Inspector (OVE_DS103) follows the single selection.
6. Snapping: node positions snap to 22px (`snapGrid=[22,22]`) when `snap` is on (default on, toggle `Alt` to disable while dragging); group resize snaps to 22. Connection: dragging from an out-port shows a live preview using `EdgeShape` (idle style) and every compatible in-port pulses; incompatible ports show `not-allowed` and a tooltip with the engine/`canConnect` reason (`Join przyjmuje tylko wyjścia Agentów`); duplicate edges and cycles (outside the declared loop) are refused with the reason. Dropping a connection on empty space cancels (no node creation).
7. Keyboard map (documented, exposed through `lib:canvasKeymap` as data so the help dialog can render it): arrows move the selected nodes by 22 (Shift = 110) in edit mode, `Tab`/`Shift+Tab` cycle nodes in reading order (top-to-bottom, left-to-right by position), `Enter` on a node opens the Inspector focus, `C` starts a connection from the focused node's out-port then arrows/Tab choose the target and `Enter` confirms (`Esc` cancels), `Delete`/`Backspace` removes the selection (emits `DeleteIntent`, the feature confirms when a running Run uses it), `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z` undo/redo, `+ - 0 1` zoom (from the stage). In `view` mode only navigation and Inspector opening work.
8. Undo/redo (`lib:canvasHistory`): a pure reducer `{ past: Snapshot[]; present; future }` with `push/undo/redo/clear` and a cap of 100 entries, snapshots store ONLY the minimal diff (`Intent` + inverse). It is local UI history of the DRAFT version (`Edytuj jako v8`); after the feature saves a version the history clears. Toolbar buttons `Cofnij`/`Ponów` (OVE_DS099) use its `canUndo/canRedo`.
9. Auto-pan: while dragging a node or connection within 40px of the pane border, the viewport pans up to 12px per frame (stops on drop/Esc; disabled under reduced motion in favour of no auto-pan).
10. Live region (`aria-live=polite`, visually hidden): announces `Dodano Węzeł Agent`, `Skill review-rubric przypisany do Senior Reviewer`, `Odrzucono: <reason>`, `Połączono A z B`, `Usunięto 2 Węzły`.
11. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
12. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
13. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
14. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
15. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
16. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
17. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Skill palette item in the mid-drag state in the left panel (dashed magenta border, `przeciągasz na Senior Reviewera`). `design-drop.png`: the Senior Reviewer tile as drop target (Skills tab `upuść → 1 skill`). `design-chip.png`: the rotated magenta drag chip `review-rubric` over the canvas. Not drawn: palette node ghost, connection preview, selection box, invalid drop reason, keyboard focus rings.

## 7. Reuse

Uses OVE_DS067 (`lib:skillDragPayload`, `ui:SkillDragChip`, drag store), OVE_DS089 drop visuals, `EdgeShape` for the connection preview (OVE_DS094), `ui:Menu` for the keyboard alternatives, `ui:Tooltip` for refusal reasons. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default). Lives in `canvas/flow/interactions/**` (React Flow allowed there only). Intent types are plain data exported for `apps/desktop`; the history reducer is framework-free and unit-tested.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). Drag payloads from outside the app (a dragged file or text from another window or a malicious page in a webview) are ignored: payloads must carry our MIME, pass strict schema validation (ids/versions only, max 256 chars, no HTML) and `canAccept` re-checks on drop (the payload is a hint, never authority). Dropping can only create INTENTS; permissions of a Skill (e.g. network) are never widened by a drop: attaching a Skill to an Agent still follows the Skill/permission rules in the engine (ADR 0003: nothing is granted by the UI). Delete of nodes used by an active Run is refused by the engine; the UI only requests.

## 10. Errors and edge cases

- Payload invalid/unknown MIME -> ignored, no feedback noise.
- `canAccept` throws or times out (>200ms) -> treated as invalid with a generic reason.
- Drop on a disabled node -> invalid.
- Palette node dropped at a position occupied by another node -> offset by 22 until free (max 10 tries).
- Intent refused by the engine -> toast/live region with reason, local history entry removed.
- Tab navigation with 0 nodes -> focus stays on the pane.

## 11. Acceptance criteria

- [ ] Given a Skill dragged over a valid node, Then its Skills tab reads `upuść → N skill`; When dropped, Then exactly one `AttachSkillIntent` is emitted.
- [ ] Given a Skill dragged over an invalid node, Then the invalid style and reason show and a drop emits nothing.
- [ ] Given a drag with foreign MIME, Then nothing changes.
- [ ] Given the keyboard path (`Przypisz do…`), Then the same intent is emitted without any pointer.
- [ ] Given a node moved with arrow keys by one step, Then the position changes by 22 world px.
- [ ] Given Cmd+Z after an AddNode, Then history yields the inverse intent.
- [ ] Given `mode=view`, Then no intent can be emitted.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Pure unit tests for the history reducer, payload validation, snapping and the keymap data. Playwright (via the Storybook test runner) tests real DnD with `dragTo` plus keyboard-only paths.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review. Touches only `canvas/flow/interactions/**`; consumes (does not edit) OVE_DS095 and OVE_DS067.

## 14. Open questions and assumptions

- OPEN: multi-node paste/duplicate (post-MVP).
- ASSUMPTION: Tauri window config `dragDropEnabled: false` (OVE_SETUP010) - required for HTML5 DnD to work in the webview.
- OPEN: whether cycles outside the loop frame are always refused (default yes; the engine owns the rule).
