---
id: OVE_WFED033
title: "Wire deleting nodes, edges and frames with undo toast and focus management"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS037, OVE_WFED016, OVE_WFED019, OVE_WFED024, OVE_WFED025, OVE_WFED038]
soft_depends_on: []
provides: ["lib:editor-delete-wiring"]
needs: ["lib:canvas-intent-translator", "ui:WorkflowCanvasPane", "lib:editor-selection", "lib:editor-session", "ui:useToast", "lib:editor-announcer", "lib:editor-shortcuts", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/useDeleteWiring.ts", "apps/desktop/src/features/workflow-editor/canvas/delete.shortcuts.ts", "apps/desktop/src/features/workflow-editor/canvas/useDeleteWiring.test.ts", "apps/desktop/src/locales/en/wfc-del.json", "apps/desktop/src/locales/pl/wfc-del.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED033: Wire deleting nodes, edges and frames with undo toast and focus management

## 1. Summary

Delete and Backspace remove the selection (nodes with their edges, selected edges, frames without their members) as one undoable step, show a toast with an Undo action, announce the result and move focus to a sensible next element.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. DS096: `Delete`/`Backspace` removes the selection and emits `DeleteIntent`; the feature confirms when a running Run uses the element. A Run pins an immutable Workflow Version (ADR 0002) and edits happen on a draft, so deleting in the draft cannot affect a running Run and no confirmation dialog is needed: the undo toast is the safety net. Deletion cascades (edges, group membership) are produced by the `node.remove` command and restored exactly by its inverse (WFED009).

## 3. Scope (in)

- Delete wiring (`onNodeDelete`, `onEdgeDelete`, `DeleteIntent`, shortcut).
- Frame deletion (ungroup).
- Undo toast and announcements.
- Focus management after deletion.

## 4. Out of scope

- Delete from the context menu (WFED037 calls this hook), lane deletion (WFED036), skill unassignment (WFED043).

## 5. Detailed requirements

1. `useDeleteWiring()` returns `deleteSelection()` and the handlers for the kit callbacks; the plan (WFED016) is one `batch` of `edge.remove` for explicitly selected edges plus `node.remove` for selected nodes plus `group.remove` for selected frames; everything runs in one `session.transaction` so one undo restores everything (edges, memberships, order).
2. Selected frame: Delete removes the FRAME only; its member nodes stay. Selected nodes inside a selected frame are removed with the nodes. The toast distinguishes: "Usunięto grupę {label}" vs "Usunięto {count, plural, ...} Węzłów".
3. Toast (`ui:useToast`, 6 s, polite): text from `wfc-del`: `nodes` ("Usunięto {count} Węzłów"), `edges`, `group`, `mixed`; action button `Cofnij` calls `session.undo()` and is only offered while the entry is still the top of the undo stack (checked by a history position token); the toast disappears when that entry is no longer undoable.
4. Announcement (assertive off, polite): same text as the toast; undo announces `Przywrócono {count} Węzłów`.
5. Focus after deletion: focus moves to the node that was previously connected on the incoming side (first predecessor still present), else the next node in reading order, else the pane; never to `body`. The new selection is cleared.
6. Guards: view mode -> nothing; focus inside an editable control (Inspector text field, search box) -> the key is ignored by the registry (WFED038); an empty selection -> no toast.
7. Deleting the Start or End node is allowed (the validator will flag it); the toast adds the amber note "Workflow nie ma Startu" only when Start was removed, as a hint, not a blocker.
8. Limits: batch up to 500 commands (WFED007); a selection never exceeds 200 nodes + 600 edges so this holds.

## 6. Design notes

Not in the mock. Toast uses the kit toast (surface `bg-surface`, radius 14, `line` border, text 14, action `Button` ghost "Cofnij"); no colour-only meaning. Reduced motion: no slide.

## 7. Reuse

- `planFromIntent` (WFED016), `session.transaction` and `undo` (WFED019), `ui:useToast`, announcer (WFED024), registry (WFED038).

## 8. Architecture and code placement

Shortcut wiring (contract of WFED038): the bindings live in the `*.shortcuts.ts` file owned by this task (`ShortcutBinding[]`, labels come from `wfc-keys`); the behaviour is registered with `useEditorAction(actionId, handler, { enabled })`; the registry applies the guards (view mode, editable focus, open dialogs, IME composition). Layer: `canvas/` wiring hook. The commands own the cascade (no deletion logic here).

## 9. Security and safety

Deleting is destructive but reversible within the draft session (history) and the draft is server-saved only by autosave; published versions cannot be deleted from the editor (view mode). The undo token check prevents undoing an unrelated later edit by a stale toast button.

## 10. Errors and edge cases

- Delete with nothing selected: no-op without toast.
- Undo toast after another edit happened: button disappears.
- Delete during an open transaction (a drag in progress): ignored.
- Selection of 200 nodes: one command batch, applied in one update.
- Delete of a node while the minimap is dragging: independent.

## 11. Acceptance criteria

- [ ] Given a node with 2 edges and group membership, When Delete then toast Cofnij, Then the node, edges and membership are restored exactly.
- [ ] Given a selected frame, Then members remain after Delete.
- [ ] Given a Start deletion, Then the hint note is shown.
- [ ] Given a later edit, Then the toast action is gone.
- [ ] Given view mode, Then Delete does nothing.

## 12. Test plan

Hook tests with the real session and fake toast; undo-token tests. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/useDeleteWiring`.

## 13. Parallelization notes

Parallel with WFED032, WFED034, WFED035.

## 14. Open questions and assumptions

- ASSUMPTION: no confirmation dialog (undo toast instead), unlike DS096 that mentions confirming for a running Run; ADR 0002 makes that unnecessary for drafts.
