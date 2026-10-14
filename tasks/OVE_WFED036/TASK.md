---
id: OVE_WFED036
title: "Bind nodes to Lanes (TOR): Lane list, create, rename, delete and the node menu"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS026, OVE_DS029, OVE_DS036, OVE_WFED011, OVE_WFED014, OVE_WFED024, OVE_WFED025]
soft_depends_on: []
provides: ["lib:editor-lane-wiring", "ui:LaneManagerDialog"]
needs: ["lib:editor-commands-group", "lib:editor-selection", "ui:WorkflowCanvasPane", "lib:editor-node-descriptor", "ui:Menu", "ui:Dialog", "ui:TextField", "ui:ConfirmDialog", "ui:Button", "lib:editor-announcer", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/useLaneWiring.ts", "apps/desktop/src/features/workflow-editor/canvas/LaneMenu.tsx", "apps/desktop/src/features/workflow-editor/canvas/LaneManagerDialog.tsx", "apps/desktop/src/features/workflow-editor/canvas/lane-names.ts", "apps/desktop/src/features/workflow-editor/canvas/lane-names.test.ts", "apps/desktop/src/features/workflow-editor/canvas/LaneManagerDialog.test.tsx", "apps/desktop/src/features/workflow-editor/canvas/LaneManagerDialog.stories.tsx", "apps/desktop/src/locales/en/wfc-lane.json", "apps/desktop/src/locales/pl/wfc-lane.json"]
reads: []
design: design.png
design_source: "Main#canvas/node-developer-selected,node-qa-working (crop 360,740,380,150 CSS px: TOR · BUILD and TOR · QA tiles; the toolbar covers the lower part)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED036: Bind nodes to Lanes (TOR): Lane list, create, rename, delete and the node menu

## 1. Summary

Lets the Owner bind Agent nodes to Board Lanes (TOR) and manage the Lanes a Workflow defines: choose a Lane from a menu, create a new one, rename, delete with a count of affected nodes. A bound tile shows the mint tab `TOR · BUILD` and the node moves the Task through that Lane on the Task Board.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. SPEC 6 and ADR 0011: the Workflow defines the Lanes (for example Build, QA, Review) of the Workspace Board; a Task moves through Lanes as nodes run. In the definition `lanes: LaneDef[]` (`id` = lane key, `name` <= 40, optional `agentRef`) and an Agent node has `config.lane` (WFRT019). The mock shows three bound tiles: `TOR · BUILD` (Developer), `TOR · QA` (QA), `TOR · REVIEW` (Senior Reviewer) and the legend row "TOR – prowadzi Zadania po Tablicy". Board creation from the published version is BOARD/WFRT029, not the editor.

## 3. Scope (in)

- Lane menu on nodes: pick a Lane, `Bez Toru`, `Nowy Tor…`.
- `LaneManagerDialog` (list, rename, delete, add).
- Name validation helper.
- Keyboard access and announcements.

## 4. Out of scope

- Lane commands (WFED011), tab word derivation (WFED014), Board behaviour (BOARD), Inspector lane section (PART 2 may reuse `useLaneWiring`).

## 5. Detailed requirements

1. `useLaneWiring()` returns `{ lanes, bind(nodeKeys, laneKey | null), createLane(name), renameLane(id, name), deleteLane(id), canBind(nodeKeys) }` using `buildBindLane`, `buildCreateLane`, `buildRenameLane`, `buildRemoveLane` (WFED011); every multi-step action runs in one transaction.
2. `LaneMenu` (`ui:Menu`) opened from the node context menu item `Przypisz do Toru ▸` (WFED037 mounts it) with the current selection: lists the Lanes of the Workflow (name, check mark when all selected nodes share it), a separator, `Nowy Tor…`, `Bez Toru`, `Zarządzaj Torami…`. Disabled with a reason when the selection contains nodes that do not support Lanes (`usesAgent` false: "Tory dotyczą tylko Węzłów z Agentem").
3. `Nowy Tor…` opens a small `Dialog` with a `TextField` (label "Nazwa Toru", max 40 chars, live counter), suggestions `Build`, `QA`, `Review` as quick chips when they do not exist yet, `Utwórz i przypisz`; validation (`lane-names.ts`): trim, 1..40 chars, unique case-insensitive among existing Lanes, no control characters; the key comes from `IdSource.laneKey`. Creating from the menu also binds the selected nodes (one transaction, one undo).
4. `LaneManagerDialog`: table of Lanes with columns Name (inline rename), Węzły (count of bound nodes), Agent (read-only text of `agentRef` name if set; editing the Lane Agent is Inspector/Board work, not here), delete action; delete opens `ui:ConfirmDialog` "Usunąć Tor {name}? {count, plural, ...} Węzłów straci przypisanie do Toru." (destructive tone, focus on Cancel). Max 16 Lanes: the add button disables with the reason "Limit 16 Torów".
5. After binding, the tile tab becomes `TOR · {NAME}` through the projector (no extra code); the announcement says `Przypisano {count} Węzłów do Toru {lane}`.
6. Lane renames update every tab at once (tabs read the lane name from the document); Board lane ids stay stable because the lane KEY never changes on rename (only `name`).
7. Lane names that collide with `build|qa|review` keep the matching tile kind (`lane-build` etc.) by the descriptor rule (WFED014); other names use `lane-build` styling with their own tab word.
8. View mode: the menu items are disabled ("Tylko do odczytu"), the manager opens read-only (no edit controls).
9. Strings in `wfc-lane`: `menu.assign`, `menu.none`, `menu.new`, `menu.manage`, `unsupported`, `new.title`, `new.name`, `new.create`, `suggest.*`, `manager.title`, `manager.columns.*`, `delete.title`, `delete.body` (ICU), `limit`, `announce.*`.

## 6. Design notes

`design.png`: tiles with the filled mint tab `TOR · BUILD` and `TOR · QA` (`#62E3B4` fill, ink text, mono 11 bold, letter-spacing .12em), Skills tab `2 skille`, the Developer tile selected (violet 4 px ring) and QA with the working glow (those states come from selection and Run data, not from this task). Dialog and menu use kit components: Dialog width 440, table rows 44 px, chips as `ui:Pill`. States not in the mock: menu, dialogs, empty Lane list ("Ten Workflow nie ma jeszcze Torów"), rename error.

## 7. Reuse

- Lane builders (WFED011), `describeNode` tab rules (WFED014), `ui:Menu`, `ui:Dialog`, `ui:TextField`, `ui:ConfirmDialog`, `ui:Button`; context menu shell (WFED037).

## 8. Architecture and code placement

Layer: `canvas/` UI wiring; validation helper pure. Commands own data changes; the descriptor owns the tab word (single source).

## 9. Security and safety

Lane names are untrusted display text (bounded, no control characters). Binding is limited to Agent nodes by the command. A Lane never carries permissions (ADR 0003). Deleting a Lane never deletes work: only the binding is removed and the action is undoable.

## 10. Errors and edge cases

- Rename to an existing name: inline error, not saved.
- Delete the only Lane: allowed, nodes lose the tab.
- Binding 20 nodes at once: one command, one announcement.
- Lane with the same name as a deleted one: new key via `IdSource` (`build_2`) unless the old key is free.
- Dialog opened in view mode: read-only.

## 11. Acceptance criteria

- [ ] Given Developer selected, When `Przypisz do Toru ▸ Build` is chosen, Then its tab reads `TOR · BUILD` and one undo removes the binding.
- [ ] Given `Nowy Tor…` "Security QA", Then the Lane is created, nodes are bound and the key is `security_qa`.
- [ ] Given deleting a Lane bound to 3 nodes, Then the confirm text names the count and after confirming all 3 tabs fall back to visibility words; undo restores them.
- [ ] Given 16 Lanes, Then the add control is disabled with the reason.
- [ ] Given a Join selected, Then the Lane menu is disabled with the Agent-only reason.

## 12. Test plan

Hook and RTL tests, Storybook (`LaneManager/Default`, `Empty`, `Limit`, `DeleteConfirm`), a11y (dialog focus trap, menu keyboard), Playwright (WFED047). Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/LaneManagerDialog src/features/workflow-editor/canvas/lane-names`.

## 13. Parallelization notes

Parallel with WFED034, WFED035, WFED037 (which mounts `LaneMenu`).

## 14. Open questions and assumptions

- ASSUMPTION: Lane Agent (`LaneDef.agentRef`) is edited in the Inspector (PART 2) or on the Board, not here.
- OPEN: whether the default Build/QA/Review Lanes should be offered when creating the first Agent node in a Workflow (not planned).
