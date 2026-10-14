---
id: OVE_WFED024
title: "Build WorkflowCanvasPane: render the document through the kit FlowCanvas"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS032, OVE_DS087, OVE_DS095, OVE_DS096, OVE_WFED015, OVE_WFED016, OVE_WFED019, OVE_WFED023, OVE_WFED028]
soft_depends_on: []
provides: ["ui:WorkflowCanvasPane", "lib:editor-announcer", "lib:editor-skill-drop-context"]
needs: ["lib:canvas-model-mapper", "lib:canvas-intent-translator", "lib:editor-session", "lib:editor-agent-directory", "lib:editor-viewport-store", "ui:FlowCanvas", "ui:CanvasInteractions", "ui:CanvasStage", "ui:EmptyState", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/WorkflowCanvasPane.tsx", "apps/desktop/src/features/workflow-editor/canvas/useCanvasProjection.ts", "apps/desktop/src/features/workflow-editor/canvas/usePlanDispatcher.ts", "apps/desktop/src/features/workflow-editor/canvas/overlays.tsx", "apps/desktop/src/features/workflow-editor/canvas/announcer.ts", "apps/desktop/src/features/workflow-editor/canvas/skill-drop-context.ts", "apps/desktop/src/features/workflow-editor/canvas/Announcer.tsx", "apps/desktop/src/features/workflow-editor/canvas/*.test.tsx", "apps/desktop/src/features/workflow-editor/canvas/WorkflowCanvasPane.stories.tsx", "apps/desktop/src/locales/en/wfc-canvas.json", "apps/desktop/src/locales/pl/wfc-canvas.json"]
reads: []
design: design.png
design_source: "Main#canvas/stage (crop 330,386,540,290 CSS px: top part, tiles PUBLICZNY/DYSKUSJA, edges, Start); extra: loop frame (340,668,790,218)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED024: Build WorkflowCanvasPane: render the document through the kit FlowCanvas

## 1. Summary

The React component that draws the Workflow: it projects the session document (WFED015) into the kit `FlowCanvas`, feeds selection and viewport as controlled props, turns kit callbacks into plans (WFED016) and dispatches them to the session. It owns no graph state and exposes overlay slots for PART 2.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The kit `FlowCanvas` (DS095) wraps React Flow behind a controlled interface: props `nodes`, `edges`, `groups`, `viewport`, `mode`, `selection`, `onSelectionChange`, `onNodesMove`, `onConnect`, `onEdgeDelete`, `onNodeDelete`, `canConnect`, `onViewportChange`, `controllerRef`, `overlays`, `empty`, `aria-label`; the interactions of DS096 add Skill drop, palette drop, snapping, keyboard and live-region. React Flow must never be imported by the feature (only `ui-kit` may). The mock region (design.png): Start pill, tiles Product Owner and Designer (PUBLICZNY), the Join ring with caption, the DYSKUSJA tile, edges with captions, the loop frame with label, the amber return edge. Overlays visible in the mock (validation badge, legend, toolbar, minimap) are other tasks or slots.

## 3. Scope (in)

- `WorkflowCanvasPane` component and its props.
- `useCanvasProjection` hook (projector + identity cache + view context).
- `usePlanDispatcher` hook (kit callbacks -> plans -> session, transactions, refusal feedback).
- Overlay slots and composition (topLeft, topRight stack, bottomLeft, bottomRight).
- Strings of the `wfc-canvas` namespace (aria labels, tab words, plural labels).

## 4. Out of scope

- Selection policy (WFED025), move/snap (WFED026), toolbar+minimap (WFED027), viewport store (WFED028), legend/empty (WFED029), palette drop (WFED031), connect tooltips (WFED032), delete UX (WFED033), clipboard (WFED034), grouping (WFED035), lanes (WFED036), menus (WFED037), shortcuts (WFED038), search (WFED039), skill drop (WFED042).
- Validation badge, run state data, Inspector (PART 2).

## 5. Detailed requirements

1. ```ts
interface WorkflowCanvasPaneProps {
  runtime?: ViewContext["runtime"]; issues?: ViewContext["issues"];       // PART 2 inputs (run overlay, validation)
  slots?: { topRight?: ReactNode; topLeft?: ReactNode; bottomLeft?: ReactNode; bottomRight?: ReactNode };   // extra overlays; the pane merges them with its own
  onOpenInspector?(target: { kind: "node" | "edge" | "group"; id: string; section?: "skills" | "model" | "agent" }): void;
  className?: string;
}
export function WorkflowCanvasPane(props: WorkflowCanvasPaneProps): JSX.Element   // must be inside EditorProvider, EditorGatewayProvider
```
2. Projection: `useCanvasProjection(runtime, issues)` builds the `ViewContext` from session mode, catalogue queries, the Agent directory (`lookup`) and the translator, calls the cached projector (WFED015) in `useMemo` keyed on (document identity, agent directory version, runtime, issues, dropFeedback, mode). The result arrays keep identity when nothing changed (render-count test).
3. `FlowCanvas` props: `mode = session.mode`, `selection` from the session (controlled, WFED025), `onSelectionChange` -> `session.setSelection`, `viewport` from the viewport store (WFED028) with `onViewportChange` writing back, `canConnect = makeCanConnect(...)` (WFED016), `controllerRef` stored in an `EditorViewContext` for the toolbar and minimap (WFED027), `aria-label` = `t("canvas.ariaLabel")` ("Canvas Workflow: {name}") with the workflow name from the session source (PART 2 may pass it via context), `aria-describedby` = the constant `CANVAS_INSTRUCTIONS_ID` (`"wfc-canvas-instructions"`, exported from `announcer.ts`); the element itself is rendered by WFED038 and mounted by the side rail (WFED044).
4. `usePlanDispatcher`: wraps every kit callback with `planFromIntent`; `kind: "commands"` -> `session.transaction(label, () => commands.forEach(dispatch))` when more than one command else one dispatch; `kind: "attach-skill"` -> forwarded to the skill assignment service (WFED043) through a context callback (no-op when absent); `refused` -> announce (live region, `lib:editor-announcer`) and a kit invalid flash via `refused` prop; `ignored` -> nothing. All branches are covered by tests.
5. Overlays (screen space, not scaled): bottomLeft = `slots.bottomLeft` ?? the toolbar of WFED027; bottomRight = minimap (WFED027); topRight = a vertical stack `[slots.topRight, legend]` (validation badge from PART 2 above the legend of WFED029); topLeft = `slots.topLeft` (read-only chip of WFED029). The pane only places them; each overlay is its own component.
6. Empty document: `empty` prop with the empty state of WFED029. Read-only: `mode="view"` makes tiles non-draggable and non-connectable (kit behaviour).
7. Opening the Inspector: the kit `onOpenSkills` of a tile and a node double-click or Enter call `onOpenInspector({ kind: "node", id, section })` (Inspector is PART 2); the pane also sets the selection to that node first.
8. Stage frame styles come from the kit (`CanvasStage`: radius 24, `1px #241B36`, `#0C0814`, dot grid 22 px, world 1120x760, default zoom 0.7); the pane adds none of its own colours (G1).
9. Messages (`wfc-canvas`, EN default, PL): `ariaLabel`, `tab.*` (WFED014 list), `skills.count` ICU plural, `skills.dropLabel`, `skills.invalidLabel`, `port.*` labels (`then` "tak"/"yes", `else` "nie"/"no", `pass` "spełnia", `fail` "nie spełnia", `approved`, `changes_requested`), `node.unknown`. This task is the only editor of the file; later tasks use their own slices.
10. Announcer (`lib:editor-announcer`, `announcer.ts` + `Announcer.tsx`): a tiny service `announce(message: MessageRef | string, politeness?: "polite" | "assertive")` and a visually hidden `aria-live` region mounted by the pane (the kit interactions have their own region for drag messages, DS096; this one carries command results). The pane subscribes to `session.onEffects` and announces `effects.announce` (`Dodano Węzeł Agent`, `Połączono A z B`, `Usunięto 2 Węzły`, `Cofnięto: ...`); identical messages within 500 ms are coalesced; messages are cleared after 4 s so screen readers re-read repeated text. WFED038 and WFED046 reuse it.
11. Skill drop context (`skill-drop-context.ts`, capability `lib:editor-skill-drop-context`): a React context with a no-op default, `SkillDropContextValue { canAccept(nodeId: NodeKey, skill: SkillDragPayload): { ok: true } | { ok: false; reason: string }; onAttach(req: { nodeId: NodeKey; targetAgentId: string; skill: { id: string; version: string } }): void; feedback: { nodeId: NodeKey; accepting: "valid" | "invalid"; label: string } | null; reportOver(nodeId: NodeKey | null, accepting?: "valid" | "invalid"): void; skillDragActive: boolean }`. The pane passes `canAccept` to the kit interactions (the DS096 `canAccept(nodeId, skill)` prop), merges `feedback` and `skillDragActive` into the projection context (so the tile shows `upuść → 1 skill`), and forwards `attach-skill` plans to `onAttach`. The Provider with real behaviour is WFED042/WFED043; without it nothing can be dropped (safe default `ok: false`).
12. Cleanup: no listeners are attached outside React effects; the pane unmounts cleanly (test with `renderHook` leak detection).

## 6. Design notes

`design.png` shows (screen px at zoom 0.7, stage origin 330,386): Start pill `start` (44.8x21), tiles with ghost layers, edges in `#5B4596` 2 px with orthogonal routing, the Join ring `join · wszyscy` caption, the DYSKUSJA tile (lavender `#C9B8FF`) with status line `✓ 4 rundy · 3 decyzje`, and the caption `3 decyzje → 5 Zadań na Tablicy` on the edge leading into the loop frame; `design-loop.png` shows the mint frame with label `Pętla jakości · Build → QA → Review · iteracja 2 z 5`, limit label `limit 90 min · 5 iteracji`, the dashed amber return edge and tiles in states working (magenta glow), waiting (amber glow), selected (violet ring), plus the drop-target tile. NOTE: in the mock the lower part of the stage is covered by the toolbar and the minimap and the world is clipped by the stage bottom (y 884); the implementation scrolls/pans, it does not clip. All visuals are produced by the kit; visual regression compares the kit-rendered stage with these crops (WFED048). States not in the mock (hover, port hover while connecting, multi-select box, view-mode cursor) come from the kit tasks; this task only passes the right props.

## 7. Reuse

- `ui:FlowCanvas`, `ui:CanvasInteractions`, `ui:CanvasStage` (DS087, DS095, DS096) as the ONLY canvas rendering; projector and plans (WFED015, WFED016); session hooks (WFED019); announcer (defined in this task). No `@xyflow/react` import (layering test).

## 8. Architecture and code placement

Layer: UI composition in `canvas/`. Depends on kit components (`ui-kit`), session, mappers, directory. No business rules here: the rules live in commands, rules and mappers (SOLID: SRP, DIP).

## 9. Security and safety

All node labels, Agent names, Skill names, lane names and edge labels are untrusted text (they may come from Chief or from Agents): render them as React text nodes only, clamp lengths, never `dangerouslySetInnerHTML`, never interpolate them into i18n keys or selectors. A graph that looks valid in the browser is never trusted: the engine validates on save and on publish (fail closed). The pane never trusts the kit callbacks beyond what builders re-validate. In `view` mode no plan can reach the session. Run overlay and issue inputs are read-only data.

## 10. Errors and edge cases

- Zero nodes: empty state; one Start node: hint overlay (WFED029).
- 200 nodes: performance budget of WFED045 (no full re-render on selection change).
- Tab hidden then shown: viewport preserved.
- A node whose Agent is still loading: neutral status text, no flicker of the attention tab.
- Unknown node type: generic tile, movable and deletable only.
- Window resized: kit stage handles `ResizeObserver`.
- `mode` switches view -> edit after `startEditing`: same viewport, tiles become draggable.

## 11. Acceptance criteria

- [ ] Given the mock fixture in a Storybook story with the fake gateway, Then the rendered stage matches `design.png` within the visual tolerance (OVE_TEST005) once the kit tasks are merged.
- [ ] Given a node drag end, Then exactly one `node.move` history entry exists.
- [ ] Given a selection change, Then unrelated tiles do not re-render (render-count test with 100 nodes).
- [ ] Given `view` mode, Then dragging a tile dispatches nothing.
- [ ] Given a refused connection, Then the live region announces the reason and no document change occurs.
- [ ] The pane contains no import of `@xyflow/react` (layering test).

## 12. Test plan

RTL tests with the fake gateway and kit mocked at `FlowCanvas` boundary (contract test props) plus Storybook stories `Pane/Published`, `Pane/Draft`, `Pane/Empty`, `Pane/Loading` with play functions; visual test against the crops via the harness; axe. Commands: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas` and `pnpm --filter @overmind/desktop test:storybook`.

## 13. Parallelization notes

Can start against a stubbed `FlowCanvas` contract while DS095/DS096 are in review (`soft_depends_on` semantics). Conflict hotspot: `overlays.tsx` (this task owns it; WFED027 and WFED029 export components that it imports, they never edit it).

## 14. Open questions and assumptions

- ASSUMPTION: `FlowCanvas` and `CanvasInteractions` compose as in DS096 stories (interactions wrap or receive the canvas); when merged, adapt the composition only here.
- OPEN: inline rename of a tile title by double-click (F2). Default: not in PART 1, the Inspector (PART 2) renames through `node.setLabel`; the double-click opens the Inspector.
