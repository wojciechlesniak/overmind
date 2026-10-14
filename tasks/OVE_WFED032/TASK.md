---
id: OVE_WFED032
title: "Wire connections: type-checked drag, immediate refusal, keyboard connect, return edges"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS037, OVE_DS095, OVE_DS096, OVE_WFED006, OVE_WFED010, OVE_WFED016, OVE_WFED024, OVE_WFED025]
soft_depends_on: []
provides: ["lib:editor-connect-wiring"]
needs: ["lib:editor-connection-rules", "lib:editor-commands-edge", "lib:canvas-intent-translator", "ui:WorkflowCanvasPane", "ui:CanvasInteractions", "ui:FlowCanvas", "lib:editor-announcer", "ui:useToast", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/useConnectionWiring.ts", "apps/desktop/src/features/workflow-editor/canvas/connection-feedback.ts", "apps/desktop/src/features/workflow-editor/canvas/connect.shortcuts.ts", "apps/desktop/src/features/workflow-editor/canvas/useConnectionWiring.test.ts", "apps/desktop/src/locales/en/wfc-conn.json", "apps/desktop/src/locales/pl/wfc-conn.json"]
reads: []
design: design.png
design_source: "Main#canvas/node-port-left,node-port-right,edge captions (crop 335,430,330,215 CSS px: Start fan-out, ports, Join ring and caption)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED032: Wire connections: type-checked drag, immediate refusal, keyboard connect, return edges

## 1. Summary

Makes connecting ports safe and obvious: while dragging from an output only legal inputs pulse, an illegal drop is refused at once with a readable reason (wrong direction, occupied input, type mismatch, raw cycle), a legal one creates an edge, edges entering a Loop `continue` are drawn as return edges, and the whole flow works by keyboard.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. SPEC 7 and ADR 0002: typed ports; a raw back-edge is a validation error and cycles exist only through the Loop node. DS096: while dragging from an out-port every compatible in-port pulses; incompatible ports show `not-allowed` and a tooltip with the `canConnect` reason; duplicate edges and cycles outside the declared loop are refused with the reason; dropping a connection on empty space cancels (no node creation); keyboard: `C` starts a connection from the focused node out-port, arrows/Tab choose the target, `Enter` confirms, `Esc` cancels. The decision logic is `checkConnection` (WFED006) and the command is `edge.add` (WFED010). design.png shows the ports (14 px circles on the left/right edges), the orthogonal edges from `start` to the two Agents and the Join ring with its caption.

## 3. Scope (in)

- Wiring `canConnect` and `onConnect` of the kit to the rules and commands.
- Reason texts (`wfc-conn`) and non-blocking warnings.
- Keyboard connect mode integration (target list).
- Return-edge behaviour and feedback.

## 4. Out of scope

- The rule logic (WFED006), the command (WFED010), the drag visuals (DS096, DS094).
- Editing edge labels and mappings (PART 2 Inspector).
- Dragging an existing edge end (see section 14).

## 5. Detailed requirements

1. `useConnectionWiring()` returns `{ canConnect, onConnect, candidateTargetsFor(portRef), keyboardTargets(nodeKey) }` consumed by the pane (WFED024): `canConnect = makeCanConnect(doc, q, t)` (WFED016), memoised per (from, to, document identity) because it runs on every pointer move.
2. Legal drop: `onConnect` -> `planFromIntent` -> `buildConnect` -> `session.dispatch`; announce `Połączono {from} z {to}`; if the verdict has warnings (`any_json_into_typed`) show a non blocking toast "Połączono. Typ danych nie jest znany, zostanie sprawdzony przy uruchomieniu".
3. Illegal drop: no document change; the kit shows the reason as tooltip (from `canConnect`) and the flash; this task also announces assertively `Odrzucono: {reason}` and, for `raw_cycle`, adds the explanation line "Cykle są dozwolone tylko przez Węzeł Loop" with a toast action "Dodaj Loop" that opens the quick-add menu on Loop (convenience, optional action label key `conn.addLoop`).
4. Candidate highlighting: the kit calls `canConnect` for compatible-port pulsing; to avoid O(ports x graph) per frame the hook pre-computes `candidateTargetsFor(from)` once at `onConnectStart` (memoised set of port refs) and answers `canConnect` from that set for ports in it, calling the rules only for others (to obtain the reason text lazily on hover).
5. Return edges: when the verdict is `edgeKind: "return"` the created edge has `kind: "return"`; the canvas draws it dashed amber through the projector (`edgeIsReturn`, WFED015); the first time in a session an edge into `continue` is created the toast says "To połączenie powrotne pętli. Rysowane jest linią przerywaną".
6. Keyboard: the kit keyboard mode (`C`) asks for the target list; `keyboardTargets(nodeKey)` returns `candidateTargets` of the node default output (or the chosen output port when the node has several: IF `then`/`else`, Gate `pass`/`fail`; a first step lets the user pick the output port with arrows) ordered in reading order with labels `Węzeł · port` for the live region; the shortcut `C` and `Esc` are registered in `connect.shortcuts.ts` (registry of WFED038) only to document them in the help dialog (the kit executes them).
7. Edge deletion by `Delete` on a selected edge is WFED033. Reconnecting an existing edge by dragging its end uses `buildReconnect` (WFED010) IF the kit emits a reconnect intent; this task wires it when present (see section 14).
8. Reason copy (EN default and PL; keys `wfc-conn:reason.<code>`): see section 6 of WFED006 for the Polish texts; every `RefusalCode` MUST have EN and PL; a test enumerates the union.
9. View mode: ports are not connectable (kit); `canConnect` returns `read_only` with the text "Tylko do odczytu".

## 6. Design notes

`design.png` shows: the `start` pill with two orthogonal edges `#5B4596` 2 px into the PUBLICZNY tiles, input ports (circle 14 px, 2.5 px border in the tile colour, bg `#0A0710`) on the left edges, output ports on the right, the Join ring (26 px, 2.5 px `#5B4596`) with the caption `join · wszyscy`. States not in the mock and how to derive them: connection preview line = `EdgeShape` idle style (DS094); compatible in-ports pulse (kit, 1.2 s, off under reduced motion); incompatible in-ports `not-allowed` cursor with the reason tooltip (`ui:Tooltip`, max width 260, text 13/1.4); refusal flash `#FF8FA3` 400 ms; warnings use the amber tone with a glyph and words.

## 7. Reuse

- `checkConnection`, `candidateTargets` (WFED006), `buildConnect`/`buildReconnect` (WFED010), `makeCanConnect` (WFED016), kit `CanvasInteractions` connection UI (DS096) and `EdgeShape` states (DS094); announcer; `ui:useToast`.

## 8. Architecture and code placement

Layer: `canvas/` wiring hook. No rule logic here (SRP); no new edge drawing.

## 9. Security and safety

The UI check is advisory plus UX; `edge.add` re-runs the rules and the server validates on save and publish, so a patched client cannot publish a raw cycle (fail closed, WFRT013). Reason params are bounded strings rendered as text. Prevents authoring infinite Runs (SPEC 17).

## 10. Errors and edge cases

- Drag from an input port to an output port: normalised, legal if allowed.
- Drop on the source node itself: `self_connection`.
- Connecting into an occupied input: refused, hint to use Join.
- Edge to a node whose type is unknown: `node_type_unknown`.
- Rapid repeated drops: each evaluated independently, no duplicate edges (duplicate rule).
- Graph at 600 edges: `edge_limit`.
- Keyboard target list empty: live region says "Brak dostępnych celów".

## 11. Acceptance criteria

- [ ] Given Developer `result` dragged onto Start `in`, Then refused with `start_has_incoming`, no change, announced.
- [ ] Given a drop on an occupied Agent `in`, Then `input_occupied` with the Join hint.
- [ ] Given A->B->C and a drop C->A (not return), Then `raw_cycle` and the toast offers "Dodaj Loop".
- [ ] Given a legal connection into Loop `continue`, Then the edge is stored with `kind: "return"` and rendered dashed amber.
- [ ] Given a keyboard-only flow (`C`, arrows, Enter), Then the same edge is created.
- [ ] Every `RefusalCode` has EN and PL text.

## 12. Test plan

Hook tests with a fake kit event source; table test over all `RefusalCode`s for copy; Playwright flow in WFED047 (illegal connect rejected with tooltip); a11y keyboard flow in WFED046. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/useConnectionWiring`.

## 13. Parallelization notes

Parallel with WFED033..WFED037 once WFED024 exists.

## 14. Open questions and assumptions

- OPEN (DS095/DS096): whether the kit emits a reconnect intent (drag an existing edge end). Default: not required for MVP; the builder exists.
- ASSUMPTION: pre-computing candidates at connect start is possible through `onConnectStart` (DS095 lists `onConnectStart/End`).
