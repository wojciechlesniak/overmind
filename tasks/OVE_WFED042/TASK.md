---
id: OVE_WFED042
title: "Wire Skill drops: tile targets, feedback, refusal reasons, keyboard assign menu"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS029, OVE_DS037, OVE_DS067, OVE_DS096, OVE_WFED014, OVE_WFED019, OVE_WFED023, OVE_WFED024, OVE_WFED025, OVE_WFED040, OVE_WFED041]
soft_depends_on: []
provides: ["lib:editor-skill-drop", "lib:editor-skill-menu"]
needs: ["lib:editor-skill-rules", "lib:editor-skills-data", "lib:editor-skill-drop-state", "lib:editor-skill-drop-context", "ui:WorkflowCanvasPane", "ui:CanvasInteractions", "ui:SkillDnd", "ui:SkillDropZone", "lib:skillDragPayload", "lib:editor-node-descriptor", "lib:editor-agent-directory", "lib:editor-session", "lib:editor-announcer", "ui:useToast", "ui:Menu", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/skills/SkillDropProvider.tsx", "apps/desktop/src/features/workflow-editor/skills/useSkillCanAccept.ts", "apps/desktop/src/features/workflow-editor/skills/useSkillAssignTargets.ts", "apps/desktop/src/features/workflow-editor/skills/skill-menu-items.ts", "apps/desktop/src/features/workflow-editor/skills/drop-feedback.ts", "apps/desktop/src/features/workflow-editor/skills/SkillDropProvider.test.tsx", "apps/desktop/src/features/workflow-editor/skills/useSkillAssignTargets.test.ts", "apps/desktop/src/features/workflow-editor/skills/skill-menu-items.test.ts", "apps/desktop/src/locales/en/wfc-skilldrop.json", "apps/desktop/src/locales/pl/wfc-skilldrop.json"]
reads: []
design: design.png
design_source: "Main#canvas/node-skills-tab (crop 815,700,200,160 CSS px: Senior Reviewer tile as the drop target, Skills tab reads `upuść → 1 skill`); extra: the dragged item in the panel (80,655,225,85) and the drag chip"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED042: Wire Skill drops: tile targets, feedback, refusal reasons, keyboard assign menu

## 1. Summary

Makes the canvas accept a Skill dragged from the panel: tiles that can take it light up and say `upuść → 1 skill`, tiles that cannot show why, dropping hands one request to the assignment service, and the same operation exists without dragging through the `Przypisz do…` menu and the node context menu. All decisions come from the pure rules of WFED041.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. DS096 (kit interactions) owns the DOM drag mechanics: on `dragenter` over a tile it calls `canAccept(nodeId, skill)` supplied by the feature and sets `drop.accepting` (`valid` or `invalid`) on that tile; on `drop` it re-checks and emits `AttachSkillIntent { nodeId, skill: { id, version } }`; keyboard alternatives are mandatory (WCAG 2.5.7). The pane (WFED024) exposes the `SkillDropContext` this task implements; the projector shows the label `upuść → N skill` where N is the current count plus one (the mock Senior Reviewer tile has 0 Skills and reads `upuść → 1 skill`, `design.png`). The drop target in the mock is a Lane (TOR) tile of the published v7 view with an active Run, so dropping is allowed in `view` mode: a Skill assignment edits the Agent, not the Workflow draft or version.

## 3. Scope (in)

- `SkillDropProvider` implementing `SkillDropContextValue` (WFED024) with real data.
- `canAccept` and the tile feedback label.
- Refusal explanation on hover, on drop and for screen readers.
- `useSkillAssignTargets(skillId)` for the palette `Przypisz do…` menu and `skill-menu-items` for the node context menu `Dodaj Skill… ▸`.
- Hand-off of an accepted drop to WFED043.

## 4. Out of scope

- Writing the assignment and undo (WFED043).
- The rules (WFED041), the panel and drag store (WFED040), kit visuals (DS089, DS096).
- Skill chips in the Inspector (PART 2).

## 5. Detailed requirements

1. `SkillDropProvider` (mounted once by `EditorProvider` composition in WFED044) reads: the session document (node -> `agentRef`), the Agent directory, `useInstalledSkills`, the active Workspace, `pending` assignments from WFED043; it supplies `SkillDropContextValue`. It renders no DOM of its own.
2. `canAccept(nodeId, payload)`: looks the Skill up BY ID in the installed list (the payload `name`, `version`, `visibility` are ignored for decisions, a payload is untrusted), reads the node and Agent, calls `evaluateSkillDrop` (WFED041) and maps the verdict to the kit shape `{ ok: true } | { ok: false, reason: string }` where `reason` is the `short` text. Synchronous and allocation-light (it runs on every `dragover`, throttled by the kit to animation frames).
3. Feedback while dragging: `reportOver(nodeId, accepting)` writes `drop-state` (WFED040) with the Agent name and the short reason; the context `feedback` value is `{ nodeId, accepting, label }` with `label` = `upuść → {n}` plural (`wfc-canvas skills.dropLabel`, count = current count + 1) when valid and the invalid label `nie można` (`skills.invalidLabel`) when refused; the projector (WFED015) turns it into the tile Skills tab text and the kit shows the dashed magenta tile outline (valid) or the muted refusal look (invalid). Tiles that cannot accept at all (operator nodes, Discussion) do not light up while a Skill drag is active (`skillDragActive` true shows only accepting tiles as armed).
4. Refusal explanation (blocked drops explain why): (a) hovering a refusing tile shows the long reason as a `ui:Tooltip` anchored at the tile after 300 ms (`role="tooltip"`), (b) the palette row note shows `{Agent}: {short}` (WFED040), (c) the announcer says the long text once per tile entry (assertive off, polite on), (d) a drop on a refusing tile emits no intent, plays the kit invalid flash and raises a toast with the long reason (`ui:useToast`, variant `warning`, 6 s, no action) so the explanation survives the end of the drag. Retryable reasons (`skills_loading`, `agent_loading`) offer `Spróbuj ponownie` in the toast which re-evaluates against the same node and Skill.
5. Accepted drop: the kit emits `AttachSkillIntent`; the plan dispatcher (WFED024) calls `onAttach({ nodeId, targetAgentId, skill })`; this task validates again (fresh `evaluateSkillDrop`, because data can change during the drag) and passes `{ agentId, skillId }` to the assignment service of WFED043. The `targetAgentId` of the intent is IGNORED and recomputed from the document node (an intent is never trusted), and a mismatch is logged as a dev warning.
6. Visibility of the drop in `view` mode: tiles stay non-draggable but still accept Skills when `acceptsSkills` (WFED014); the panel stays enabled. In `edit` mode there is no difference. A node that is not selected is not selected by the drop (no side effects other than the assignment); after a successful assignment focus stays where it was.
7. Keyboard path 1 (palette): the kit `Przypisz do…` menu (Enter or Space on a Skill row) lists `assignTargets` = `useSkillAssignTargets(skillId)`: every node of the document that is Agent-backed (`usesAgent`), one entry per NODE (two nodes with one Agent are two entries, the label adds `· ten sam Agent`), ordered by canvas position top-to-bottom then left-to-right, each `{ id: nodeKey, label: "{node label} · {Agent name}", disabledReason? }` where `disabledReason` is the `short` text from the rules (disabled entries stay visible). Choosing one calls the same accepted-drop path.
8. Keyboard path 2 (canvas): `skill-menu-items.ts` exports `buildSkillMenuItems(nodeKey): MenuItemSpec` for the node context menu (WFED037) `Dodaj Skill… ▸`: a submenu of installed Skills (max 50, type-ahead, the same row text as the panel without drag) with disabled ones showing their reason; selecting runs the accepted-drop path. Hook form `useSkillMenuItems(nodeKey)` memoised by (skills version, directory version).
9. Announcements (`wfc-skilldrop`): `armed` `Przeciągasz Skill {skill}. Upuść na Węzeł z Agentem.`, `over.valid` `Upuść, aby dodać {skill} do Agenta {agent}`, `over.invalid` `{reasonLong}`, `refused.toast`, `retry`, `menu.title` `Dodaj Skill`, `menu.search` `Szukaj Skilla`, `menu.same` `ten sam Agent`.
10. Cleanup: the provider clears `drop-state` on unmount and on every drag end event; no listener is registered outside React effects; Escape during a drag cancels (kit) and clears the state.

## 6. Design notes

`design.png` shows the drop target: the Senior Reviewer tile (mint lane tile with a dashed magenta outline, `TOR ·` tab) whose Skills tab reads `upuść → 1 skill` in a pill with the cube icon and the magenta drag chip `review-rubric` above-left (`design-item.png` shows the source row in the panel with the dashed magenta border). The refusal look (muted tab `nie można`, grey dashed outline), the tooltip and the toast are not in the mock: use kit tokens (`--om-drop-invalid`, the `Tooltip` and `Toast` surfaces). Visibility is never conveyed by colour: the refusal always has words.

## 7. Reuse

- `useSkillDropTarget` semantics and `ui:SkillDropZone` visuals live in the kit (DS067, DS089, DS096): this task only supplies `canAccept`, labels and `onAttach`. `ui:Tooltip`, `ui:useToast`, `ui:Menu`; rules (WFED041); data (WFED040); `describeNode.acceptsSkills` (WFED014); announcer (WFED024).

## 8. Architecture and code placement

Layer: UI wiring in `skills/`; `drop-feedback.ts` (pure label and plural logic) and `skill-menu-items.ts` (pure data builder) are unit tested without React. DIP: the provider depends on the assignment service interface of WFED043, injected by `EditorProvider`.

## 9. Security and safety

All node labels, Agent names, Skill names, lane names and edge labels are untrusted text (they may come from Chief or from Agents): render them as React text nodes only, clamp lengths, never `dangerouslySetInnerHTML`, never interpolate them into i18n keys or selectors. A graph that looks valid in the browser is never trusted: the engine validates on save and on publish (fail closed). The drag payload comes from the HTML5 data transfer and any page or app can craft one with our MIME: the decision uses the Skill id only and looks everything up in trusted state; an id that is not in the installed list is refused (`skill_unknown`). The refusal text never reveals other Workspaces. A drop never changes the draft, so it cannot be used to smuggle a graph change; the only effect is the assignment request that the engine validates again (ADR 0028, ADR 0003).

## 10. Errors and edge cases

- Drag leaves the stage mid-way: kit clears; `drop-state` cleared by `dragend`.
- Two tiles share one Agent: both show the new count after the assignment refresh.
- Drop on a tile whose Agent was archived during the drag: refused with `agent_archived`.
- Skill removed (archived) during the drag: refused with `skill_archived` at drop time.
- Drop in `view` mode on a Lane tile (the mock case): accepted.
- Drop on a Group frame or an edge: not a target, ignored.
- Reduced motion: no pulse animation, the static dashed outline stays.
- Very fast sequence of two drops of two Skills on one Agent: serialised by WFED043, both succeed unless the limit is hit.

## 11. Acceptance criteria

- [ ] Given the mock graph and a drag of `review-rubric` over Senior Reviewer (0 Skills), Then the tile Skills tab reads `upuść → 1 skill` and the panel row note reads `przeciągasz na Senior Reviewer`.
- [ ] Given a drag of a private Skill of another Workspace crafted by a script, Then `canAccept` is false (`skill_unknown`) and nothing is requested.
- [ ] Given a drop on a Discussion node, Then the tile is not armed, no intent is emitted and the toast explains `node_not_agent_backed`.
- [ ] Given a drop on a tile of an Agent that already has the Skill, Then the tooltip and toast say `Już przypisany`.
- [ ] Given the keyboard menu on a Skill row, Then every Agent node is listed, disabled ones show their reason and choosing one assigns exactly once.
- [ ] Given the node context menu `Dodaj Skill…` on a node without an Agent, Then all entries are disabled with `Wybierz Agenta`.
- [ ] Given `view` mode and a published Workflow, Then dropping on a valid tile still calls the assignment service.
- [ ] Given an `AttachSkillIntent` whose `targetAgentId` differs from the node Agent, Then the node Agent is used.

## 12. Test plan

Unit tests for `drop-feedback` and `skill-menu-items`; provider tests with fake directory, fake skills data and fake assignment service (accept, refuse, retryable, stale data between enter and drop, forged intent); RTL tests of `useSkillAssignTargets`; Playwright flow in WFED047 (drag a Skill row onto a tile with a synthetic DataTransfer, drop on a refusing tile). Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/skills`.

## 13. Parallelization notes

Needs WFED040 (data and store) and WFED041 (rules) merged; WFED043 is injected through an interface so both can proceed in parallel against a fake. WFED037 consumes `lib:editor-skill-menu`.

## 14. Open questions and assumptions

- ASSUMPTION: the kit tile exposes a `dropLabel`/`drop.accepting` prop pair (DS089) and the interactions take a `canAccept` prop; if the names differ only `useSkillCanAccept.ts` and the pane context mapping change.
- OPEN (DS): a tile-level `dropReason` prop would let the kit render the tooltip itself; until then the tooltip is rendered by this task as an overlay anchored by `data-node-id`.
- OPEN (Owner): in `view` mode of an OLD published version, should dropping be allowed? The mock shows it for the current published version; an archived older version may be better read-only (default: allowed because only the Agent changes).
