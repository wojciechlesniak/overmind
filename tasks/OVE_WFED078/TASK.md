---
id: OVE_WFED078
title: "Build the Board Lane binding UI for TOR nodes (lane picker, WIP preview, Board link)"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD001, OVE_BOARD005, OVE_BOARD013, OVE_DS019, OVE_DS028, OVE_DS030, OVE_SHELL027, OVE_WFED007, OVE_WFED069, OVE_WFRT003]
soft_depends_on: []
provides: ["feature:wfed-lane-binding"]
needs: ["api:board.view", "contract:Lane", "contract:WorkflowDefinition", "usecase:board.reconcile-lanes", "ui:LaneBadge", "ui:Select", "ui:Popover", "lib:editor-commands", "lib:app-navigation", "lib:wfed-node-forms"]
owns: ["apps/desktop/src/features/workflow-editor/lanes/**", "apps/desktop/src/locales/en/wfed-lanes.json", "apps/desktop/src/locales/pl/wfed-lanes.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED078: Build the Board Lane binding UI for TOR nodes (lane picker, WIP preview, Board link)

## 1. Summary

The control that binds an Agent Node to a Board Lane (the green TOR tab: 'TOR · BUILD', 'TOR · QA', 'TOR · REVIEW') and manages the Workflow's lane list (name, order, assignee Agent, WIP limit). A TOR Node moves Tasks through the Board as it executes.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). ADR 0011 / SPEC 6: the Workflow defines the Board's Lanes; a Task moves along Lanes as Nodes run. WFRT003 `LaneDef { id: LaneKey, name (<= 40), agentRef?, teamRef? }` lives in the definition; Agent config `lane?: LaneKey`. BOARD005 reconciles Lanes at Version publish (removed lanes with Tasks raise an Escalation); BOARD010 binds Nodes to lanes at runtime. Inspector helper text: 'W tym Workflow działa jako TOR · Build: każde Zadanie przechodzi przez niego na Tablicy.'

## 3. Scope (in)

- Lane section in the Agent Node form slot: 'Tor Tablicy' select (none / existing lanes / 'Nowy tor').
- Lane list editor (Workflow section): name, order (up/down), default assignee Agent, WIP limit (optional).
- Preview of the current Board counts per lane (read-only, from `board.view`) and 'Otwórz Tablicę'.
- Warnings for removal of a lane that holds Tasks.

## 4. Out of scope

- Board UI (BOARDUI).
- Reconciliation and runtime binding (BOARD005, BOARD010).

## 5. Detailed requirements

1. Binding writes `lane` into the Agent Node config (`updateNodeConfig`); the tile gets the green TOR tab with the lane's name uppercased ('TOR · BUILD'); no lane -> normal PUBLICZNY/PRYWATNY tab (visibility tab shows when not a TOR; the TOR tab replaces it as in the mock).
2. Lane key generation: slug of the name (`build`), unique within the Workflow, immutable after creation (renaming changes `name` only) so Tasks stay attached.
3. Lane fields: name 1..40, optional `agentRef` (select of visible Agents), optional `wipLimit` 1..20; order = position in the list; max 12 lanes (UI cap; server caps at its limit).
4. Creating a lane from the Node select ('Nowy tor') opens an inline mini-form; the lane is added to `definition.lanes` through the editor command `addLane`.
5. Removing a lane: if the published Version's lane currently holds Tasks (count from `board.view`), show the warning 'Tor ma 3 Zadania. Po publikacji Chief zdecyduje, gdzie je przenieść (Eskalacja).' (matches BOARD005); removal still allowed in the Draft.
6. Two Nodes can bind to the same lane (rework loops): allowed, shown as 'współdzielony z: QA'.
7. Board preview row per lane: 'Build · 2 Zadania · WIP 2/3'; fetched only when the panel is open; stale when the Workflow is only a Draft (shows 'dane z opublikowanej wersji').
8. Default board lanes (ASSUMPTION from BOARD005: To do / In progress / Review / Done) are shown as 'domyślne tory' until the Workflow defines its own; creating the first Workflow lane shows the note 'Tory Workflow zastąpią domyślne po publikacji'.
9. `view` mode read-only.

## 6. Design notes

Not in the mock beyond the TOR tab and legend text. Select + inline form using `ui:Select`, `ui:Field`; lane rows as list rows with `ui:LaneBadge` (mint).

## 7. Reuse

- `ui:LaneBadge`, `ui:Select`, `ui:Popover`, `ui:ListRow`; `api:board.view`.

## 8. Architecture and code placement

`@WF/lanes/` (`lane-model.ts` pure: slug, uniqueness, order, usage; `LaneSelect.tsx`, `LaneListEditor.tsx`). Registered into the Agent form slot and the Workflow section through registries.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. A lane binding grants no permissions; lane `agentRef` is only a default assignee. Lane names are plain text.

## 10. Errors and edge cases

- Lane name collides after slugging: suffix `-2`.
- Lane deleted while a Node binds it: Node binding is cleared with a visible note and an undo step.
- Board not provisioned yet: preview hidden.
- Lane assigned to a private Agent of this Workspace in a public Workflow: validator error `references.visibility` surfaces.

## 11. Acceptance criteria

- [ ] Given a new lane 'Build' bound to the Developer Node, then the tile shows 'TOR · BUILD'.
- [ ] Given a lane holding Tasks and removal, then the warning from BOARD005 semantics is shown.
- [ ] Given two Nodes bound to one lane, then both show 'TOR' tabs and the form lists the sharing.
- [ ] Given reorder, then lane positions in the definition change.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`lane-model.test.ts`, component tests, stories.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: Workflow lanes are stored in `definition.lanes` and published with the Version (WFRT003); the Agent config field is `lane`.
- ASSUMPTION: max 12 lanes in the UI.
