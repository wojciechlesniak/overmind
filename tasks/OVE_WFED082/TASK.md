---
id: OVE_WFED082
title: "Render the Run overlay on the canvas: glows, edge traces, Loop iteration counter"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS088, OVE_DS089, OVE_DS090, OVE_DS091, OVE_DS092, OVE_DS094, OVE_DS095, OVE_WFED061, OVE_WFED072, OVE_WFED080, OVE_WFED081]
soft_depends_on: []
provides: ["feature:wfed-run-overlay"]
needs: ["ui:NodeStateStyles", "ui:NodeTile", "ui:EdgeShape", "ui:GroupFrame", "ui:QualityGate", "ui:JoinNode", "ui:FlowCanvas", "ui:canvasNodeTypes", "feature:editor-canvas-surface", "lib:wfed-run-projection", "lib:wfed-loop-frame-label", "lib:wfed-live-validation"]
owns: ["apps/desktop/src/features/workflow-editor/run-overlay/render/**", "apps/desktop/src/locales/en/wfed-overlay.json", "apps/desktop/src/locales/pl/wfed-overlay.json"]
reads: []
design: design.png
design_source: "Main#canvas/stage (crop 330,386,802,498)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED082: Render the Run overlay on the canvas: glows, edge traces, Loop iteration counter

## 1. Summary

The adapter that decorates the canvas with Run state: DS node state styles (magenta working glow, amber waiting-for-Approval glow, mint check, error), edge traces and active glow, the Loop frame label 'Pętla jakości · Build → QA → Review · iteracja 2 z 5', Gate evaluation, Join member badges and validation error borders from the issue index.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The canvas kit (DS087-100) draws nodes, edges and group frames from `CanvasModel`; the React Flow adapter is `FlowCanvas`. Part 1 builds the `CanvasModel` from the editor document; this task supplies a decoration layer (`stateByNode`, `edgeState`, `groupState`) and per-Node status text ('● testy e2e 38 z 52', '◆ czeka na Zgodę · npmjs.org', '✓ 4 pliki · testy 112 z 112', '○ czeka na Quality Gate'). Mock crops show the stage with all states at once.

## 3. Scope (in)

- `useCanvasDecorations({ overlay, issueIndex, document })` returning the decoration props for the part 1 canvas surface.
- Status text composer per Node (from overlay + progress hints).
- Edge decoration: active glow for in-flight tokens, subtle trace for traversed edges, amber dashed return edge activation.
- Group frame decoration: iteration counter and state (`idle|active|escalated`).
- Validation error styling (DS089 `error` state) and error badge counts from the issue index.
- Reduced-motion behaviour and legend-independent behaviour (legend is `OVE_WFED084`).

## 4. Out of scope

- Overlay state (`OVE_WFED080`), subscription (`OVE_WFED081`).
- Finished-Run presentation (`OVE_WFED083`).
- Canvas editing (part 1).

## 5. Detailed requirements

1. Node state mapping to `ui:NodeStateStyles`: `working` -> `working` (glow `0 0 0 4px rgba(242,95,196,.16), 0 0 36px rgba(242,95,196,.45)`, status text magenta with `●`), `waiting-approval` -> `waiting-approval` (amber glow, `◆`), `done` -> `done` (`✓`), `queued` -> `queued` (`○`), `error` -> `error` (`✗`), `skipped` -> `skipped` (`– pominięty`), `cancelled` -> `skipped` look with text `✗ anulowany`, `waiting-other` -> `queued` look with the wait word ('czeka na timer', 'czeka na slot', 'czeka na Dyskusję'). Selected ring (violet 4px) stays independent of the run state.
2. Status text sources: Agent/Review Nodes: last progress line from the Node's execution summary (`progress.label`, bounded 60 chars) else a default per state; waiting for Approval: `◆ czeka na Zgodę · <target>` where target is the Approval's short subject from the engine (domain or action word, bounded); Quality Gate: caption from `OVE_WFED076` label; Discussion: '✓ 4 rundy · 3 decyzje' from the Discussion summary.
3. Iteration badge on Nodes inside a Loop: small mono 'it. 2' next to the state text.
4. Edges: `inFlight` -> `EdgeShape` state `active` (magenta glow segment, 1.4px, moving dash animation only when motion is allowed); `traversed` -> trace style (violet-light 1.5px at 60% opacity); `dropped` -> dashed grey with a ✗ marker; return edge when active -> amber glow; others unchanged. Edge hover tooltip: 'Przekazano 3 razy · ostatnio 14:21:07'.
5. Group frame: `iteration` prop from loop overlay (`current`, `max`), label composed `Pętla jakości · Build → QA → Review · iteracja 2 z 5` (the base label comes from `GroupDef.label`, the counter is appended by the renderer with i18n key `wfed.overlay.iteration`); `state` = `active` while the Loop iterates, `escalated` after `loop.exhausted` (amber border + 'Eskalacja' pill).
6. Join: caption plus member badges ('2 z 3') while waiting; Quality Gate: diamond turns `error` state on a failed evaluation for 1.5 s and shows the evidence line under the label ('testy 96% · wymagane 100%'); passed -> mint.
7. Validation: Nodes with errors in the issue index get the error border (DS089 `error`) and a corner count, warnings an amber dot. Validation styling and Run styling coexist: in edit mode the error border wins over a run glow; in `published` and `viewing_run` modes validation styling is not drawn.
8. Performance: decorations are memoised per Node (`React.memo` with selector equality); only Nodes whose overlay slice changed re-render; 200 Nodes with 10 updates/s stay under 4 ms per frame in the benchmark story.
9. `prefers-reduced-motion`: no moving dash, no pulsing; glows stay static.
10. Accessibility: every state change of a Node is announced politely through the page live region (shared with the strip; throttled 2 s) as 'QA: pracuje'; Nodes expose `aria-description` with the state text; state is never colour-only (glyph + word).
11. Click on a Node while a Run is active selects it and the Inspector shows execution info (`OVE_WFED083` adds the execution list).

## 6. Design notes

`design.png` is the canvas stage at the mock's moment (QA working glow, Security waiting glow, Developer selected with done text, Loop frame with iteration 2 of 5, active edge between Developer and QA). `design-working.png`, `design-waiting.png` zoom into the glow states; `design-frame.png` shows the frame label. Note the mock is clipped at the bottom of the viewport: the stage world is 1120x760 at zoom 0.7 and extends below 900 px (Security, Quality Gate caption, return edge label are partly cut); design for the whole world and make the stage scroll/pan, not the page.

## 7. Reuse

- `ui:NodeStateStyles`, `ui:EdgeShape`, `ui:GroupFrame`, `ui:QualityGate`, `ui:JoinNode`, `ui:FlowCanvas` props (`stateByNode` style hooks per DS089/094/092).
- Overlay model selectors `OVE_WFED080`; issue index `OVE_WFED061`.

## 8. Architecture and code placement

`@WF/run-overlay/render/` (`use-canvas-decorations.ts`, `status-text.ts` pure, `edge-decoration.ts`, `group-decoration.ts`). The part 1 canvas surface accepts a `decorations` prop (capability `feature:editor-canvas-surface`); this task must not edit canvas files.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Status text comes from engine summaries (bounded) and is rendered as text; Approval target strings (domains) are untrusted and escaped. Decorations are display-only; clicking a glow does nothing privileged.

## 10. Errors and edge cases

- Node absent from the pinned Version (draft layout differs): overlay applies only to matching `nodeKey`s of the displayed Version; mismatch banner when the Run's Version differs from the displayed one ('Run działa na v7, oglądasz wersję roboczą v8') — in that case the overlay is hidden unless the page shows the pinned Version.
- Hundreds of events per second: batching in `OVE_WFED081`.
- Very long target string: truncated with ellipsis and `title`.
- Group frame without a Loop node inside: no counter.
- Dry-run: glows use a neutral violet-grey 'symulacja' look (no magenta, magenta means a real Agent works).

## 11. Acceptance criteria

- [ ] Given overlay states for the mock, then the canvas equals `design.png` within tolerance and the glow crops match.
- [ ] Given a node state change event, then only that Node re-renders (render-count test).
- [ ] Given reduced motion, then no animated styles are applied.
- [ ] Given loop iteration 2 of 5, then the frame label reads 'Pętla jakości · Build → QA → Review · iteracja 2 z 5'.
- [ ] Given dry-run, then no magenta glow is used.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`status-text.test.ts`, `edge-decoration.test.ts`, render-count test, Storybook story 'RunOverlay' replaying `run-14.events.json` step by step with a slider, visual regression for the three glow crops and the stage, axe, benchmark story.

## 13. Parallelization notes

Needs part 1's canvas surface `decorations` prop. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: part 1 exposes `feature:editor-canvas-surface` accepting `decorations` (node style by key, edge state by id, group state by id); if not, a proposal is needed and flagged.
- ASSUMPTION: base mock is clipped at the viewport bottom; implementers use the full world.
