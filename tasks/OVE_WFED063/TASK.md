---
id: OVE_WFED063
title: "Compose the Inspector panel: selection routing, empty, multi-select and non-Agent states"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS032, OVE_DS044, OVE_DS103, OVE_WFED025, OVE_WFED050, OVE_WFED061]
soft_depends_on: []
provides: ["feature:wfed-inspector"]
needs: ["ui:AgentInspector", "ui:InspectorSection", "ui:EmptyState", "ui:SidePanel", "feature:editor-selection", "lib:wfed-data-hooks", "lib:wfed-live-validation", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/inspector/InspectorPanel.tsx", "apps/desktop/src/features/workflow-editor/inspector/select-inspector.ts", "apps/desktop/src/features/workflow-editor/inspector/sections/registry.ts", "apps/desktop/src/features/workflow-editor/inspector/index.ts", "apps/desktop/src/locales/en/wfed-inspector.json", "apps/desktop/src/locales/pl/wfed-inspector.json"]
reads: []
design: design.png
design_source: "Main#canvas/inspector (crop 1150,162,290,738)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED063: Compose the Inspector panel: selection routing, empty, multi-select and non-Agent states

## 1. Summary

The right-hand 290 px panel. It reads the canvas selection and renders the right content: Agent Inspector for an Agent Node, a config form for operator Nodes, a Workflow-level section when nothing is selected, a shared-actions view for multi-select. Sections plug in through a registry so each Node type adds its own without editing this file.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). Mock region `canvas/inspector` (1150,162,290,738): header (avatar, 'Developer', 'Agent stały · konfiguracja v3'), then STAN AGENTA, WIDOCZNOŚĆ AGENTA, MODEL, SKILLE, UPRAWNIENIA W TYM WĘŹLE and a pinned 'Otwórz czat z Developerem' button. DS103 builds the panel as `AgentInspector`; its `children` slot hosts the reduced views for non-Agent Nodes. Part 1 owns selection state.

## 3. Scope (in)

- `InspectorPanel` (SidePanel right 290, scroll inside).
- `selectInspector(selection, document)` pure: `{kind:'agent'|'operator'|'workflow'|'multi'|'edge'|'none'}`.
- Section registry: `registerInspectorSection({ nodeTypes, order, component })` (OCP), auto-discovered via `import.meta.glob('./sections/*.section.tsx')`.
- Header composition for each kind; focus management (Enter on a Node focuses the panel heading, Esc returns focus to the Node).

## 4. Out of scope

- Agent sections (`OVE_WFED064`, `OVE_WFED065`, `OVE_WFED066`, `OVE_WFED067`, `OVE_WFED068`).
- Operator forms (`OVE_WFED069` and following).

## 5. Detailed requirements

1. Selection kinds: one Agent Node -> Agent view; one Start/End/Parallel/Join/IF/Loop/Discussion/Review/Quality Gate/Save Decisions Node -> operator form from the forms registry (`OVE_WFED069`); one Edge -> edge view with label field (edit mode) and 'mapping' summary (read-only list of `mapping` expressions, edited in `OVE_WFED070` form); nothing -> Workflow section; several -> multi view.
2. Workflow section (`none`): name, description, visibility word, `inputSchema` summary, Run limits (`maxDurationMs`, cost), lanes count; in edit mode editable through the forms registry key `workflow` (limits form is part of `OVE_WFED072`'s shared limit inputs).
3. Multi view: 'Zaznaczono 3 Węzły' with shared actions supplied by part 1 commands (`Wyrównaj`, `Usuń`, `Grupuj`); the actions are callbacks from `lib:editor-commands`; disabled in view mode.
4. Non-Agent Node header: type icon, label, type word ('IF', 'Pętla', ...), plus validation issues for the Node (from the issue index) listed first in an amber/error `Card` ('2 błędy w tym Węźle') with 'Pokaż'.
5. Panel header focus: the heading has `tabIndex=-1`; `Enter` on a selected Node (canvas) focuses it; `Esc` in the panel returns focus to the canvas Node.
6. Loading skeleton while Agent data loads; error state per section (a failing section does not hide the others).
7. In `view` mode every control is read-only (`aria-disabled`) and the panel shows the note 'Tryb tylko do odczytu' at the top.
8. Scroll: panel scrolls internally; the 'Otwórz czat' button stays pinned at the bottom for Agent view.
9. Dynamic Agent (private, created by Chief, awaiting Owner acceptance): shows `DynamicAgentCard` note from `ui:AgentInspector` children (accept happens in Agenci view, link provided).

## 6. Design notes

`design.png` is the full inspector for the selected 'Developer' Node: panel bg `#0F0A18`, padding 18 19, column gap 14. Sections stack in the order of the mock; all section content is delivered by the follow-up tasks. States NOT in the mock: none selected (EmptyState 'Wybierz Węzeł, aby zobaczyć Agenta' + tips 'Przeciągnij Węzeł z palety', 'Upuść Skill na zakładkę kafelka'), multi, edge, operator, view-only banner, loading, section error.

## 7. Reuse

- `ui:AgentInspector`, `ui:InspectorSection`, `ui:EmptyState`, `ui:SidePanel`, `feature:editor-selection` (part 1), `lib:editor-commands`.

## 8. Architecture and code placement

`@WF/inspector/` host. Sections live in `@WF/inspector/sections/<name>.section.tsx` and are owned by the task that writes them (one file each, no shared editing).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. The panel never offers a control that widens permissions; non-Agent forms cannot contain permission fields (strict schemas, WFRT014).

## 10. Errors and edge cases

- Selection changes while a field is being edited: pending edit commits (blur) before the panel switches.
- Selected Node deleted by undo: panel falls back to `none`.
- Two Agent Nodes selected (multi): no Agent details, only shared actions.
- Agent of the Node no longer exists (archived): header shows 'Agent niedostępny' and the validator error is listed.

## 11. Acceptance criteria

- [ ] Given one Agent Node selected, then the panel shows the sections in the mock order and equals `design.png` for the 'Developer' fixture.
- [ ] Given nothing selected, then the empty state with tips shows.
- [ ] Given three Nodes selected, then only shared actions render.
- [ ] Given a new section file added under `sections/`, then it appears without editing the host (glob test).
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Pure `select-inspector.test.ts`; stories for all kinds; glob-registry test; axe; visual crop test.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: part 1 exposes `feature:editor-selection` with `useSelection()` and `lib:editor-commands` shared commands.
