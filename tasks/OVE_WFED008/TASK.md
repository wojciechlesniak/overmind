---
id: OVE_WFED008
title: "Implement undo/redo history with coalescing, transactions and save points"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DS096, OVE_WFED007]
soft_depends_on: []
provides: ["lib:editor-history"]
needs: ["lib:editor-commands", "lib:canvasHistory", "port:Clock"]
owns: ["apps/desktop/src/features/workflow-editor/history/history.ts", "apps/desktop/src/features/workflow-editor/history/coalesce.ts", "apps/desktop/src/features/workflow-editor/history/types.ts", "apps/desktop/src/features/workflow-editor/history/*.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED008: Implement undo/redo history with coalescing, transactions and save points

## 1. Summary

A pure history manager for the draft: it stores command/inverse pairs (not snapshots), merges bursts such as dragging or typing into one entry, groups multi-step gestures into transactions, tracks the last saved position for dirty detection, and caps memory at 100 entries.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. Undo/redo is local to the draft (the mock shows `Cofnij` and `Ponów` in the toolbar; DS099 takes `canUndo`/`canRedo`). The kit provides a generic reducer `lib:canvasHistory` (DS096: `push/undo/redo/clear`, cap 100, snapshots hold an intent and its inverse). Reuse it as the stack engine if its entry type is generic over the payload; otherwise implement the same small stack here and add a proposal to DS096 (see section 14). The public API below is fixed either way.

## 3. Scope (in)

- `EditorHistory` with `record`, `undo`, `redo`, `canUndo`, `canRedo`, labels for tooltips.
- Coalescing by key and time window.
- Transactions (begin/commit/abort).
- Save point tracking: `markSaved`, `isAtSavePoint`, `isDirty`.
- Selection snapshots restored with undo and redo.

## 4. Out of scope

- Applying commands to the document (session, WFED019).
- Keyboard bindings and toolbar buttons (WFED027, WFED038).
- Persisting history (never persisted: a reload starts with an empty history).

## 5. Detailed requirements

1. ```ts
interface HistoryEntry { forward: CommandData; inverse: CommandData; label: MessageRef; coalesceKey?: string; at: number /* monotonic ms from Clock */; selectionBefore: SelectionState; selectionAfter: SelectionState }
interface EditorHistory {
  record(entry: HistoryEntry): void;
  undo(): { command: CommandData; selection: SelectionState; label: MessageRef } | undefined;  // the INVERSE to execute
  redo(): { command: CommandData; selection: SelectionState; label: MessageRef } | undefined;
  readonly canUndo: boolean; readonly canRedo: boolean;
  nextUndoLabel(): MessageRef | undefined; nextRedoLabel(): MessageRef | undefined;
  begin(label: MessageRef): void; commit(): void; abort(): CommandData[];  // abort returns inverses to roll back
  getPosition(): HistoryPosition;                 // opaque monotonic token of the current state
  markSaved(at?: HistoryPosition): void;          // default current position; autosave passes the position it snapshotted
  readonly isDirty: boolean; clear(): void;
}
function createHistory(opts: { clock: Clock; cap?: number /*100*/; coalesceWindowMs?: number /*800*/ }): EditorHistory
```
2. Immutable value semantics: the manager is a small state machine exposing `getState()` and `subscribe` (for `useSyncExternalStore` in the session); `record` clears the redo stack.
3. Coalescing: when the new entry has the same `coalesceKey` as the top of the stack and `at - top.at <= coalesceWindowMs`, the entries merge: `forward = handler.merge(prev.forward, next.forward)` and the inverse stays the OLDEST inverse (undo returns to the state before the burst). The window restarts at each merge (max burst 10 s, then a new entry). Keys come from handlers (`node.move` key `move:<sorted keys>`, `node.setLabel` key `label:<key>`). Keyboard nudges of the same selection coalesce too.
4. Transactions: `begin` opens a group, `record` inside collects entries, `commit` replaces them with ONE entry whose forward/inverse are batches (inverses reversed); nested begin is flattened; `abort` returns the inverse commands the caller must run to roll back and discards the group. A drag that moves 5 nodes and snaps is one transaction.
5. Cap: when `cap` (100) is exceeded the oldest entry is dropped. If the dropped entry is at or before the save point, `isDirty` becomes permanently true until the next `markSaved` (the saved state is no longer reachable by undo).
6. Dirty rule: `isDirty` = the current position differs from the save point; `markSaved(at)` lets autosave record the position that was actually sent, so edits made while a save was in flight keep the draft dirty. `markSaved(at)` lets autosave record the position that was actually sent, so edits made while a save was in flight keep the draft dirty. Undo back to the saved position makes `isDirty` false (no pointless autosave). A load (`clear`) resets stack and save point; loading never creates an entry.
7. Selection: each entry stores the selection before and after; undo returns `selectionBefore`, redo `selectionAfter`; nodes that no longer exist are pruned by the session (WFED025), not here.
8. Labels: `nextUndoLabel()` feeds the tooltip `Cofnij: Przesunięto 3 Węzły`.
9. Time is injected through `Clock` (monotonic), never `Date.now` (testability).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:canvasHistory` (DS096) as the stack primitive when generic (preferred); `Clock` port (ARCH007) for time; command types from WFED007.

## 8. Architecture and code placement

Layer: pure `history/`. No React. The session (WFED019) owns the instance and exposes `useHistoryState`.

## 9. Security and safety

History holds inverse commands, which contain element content (labels, configs). It lives in memory only, is cleared on load, and is never written to localStorage or logs. The cap bounds memory (a hostile 200-node paste cannot grow the history without limit).

## 10. Errors and edge cases

- Undo with an empty stack: returns `undefined`, no throw.
- Coalesced burst interrupted by another command type: a new entry starts.
- Transaction left open when the user navigates away: the session aborts it on unmount.
- Cap overflow while dirty: handled as described, shown as "cannot return to saved version" only through `isDirty` staying true.
- Save during an open transaction: refused by the session (the autosave waits for `commit`).

## 11. Acceptance criteria

- [ ] Given 5 `node.move` commands with the same key within 800 ms, Then one undo returns the node to its original position.
- [ ] Given a transaction with 3 commands, Then one undo reverts all three and one redo reapplies them.
- [ ] Given 101 entries with a save point at entry 1, Then `isDirty` is true after undoing everything and false after `markSaved`.
- [ ] Given save, edit, undo, Then `isDirty` is false; redo then makes it true.
- [ ] Selection returned by undo equals the recorded `selectionBefore`.

## 12. Test plan

Unit tests with a fake clock (`lib:fake-clock`), property test: random sequences of record/undo/redo never produce an inconsistent state (`canUndo` iff stack non empty); transaction tests. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/history`.

## 13. Parallelization notes

Parallel with WFED007 and WFED009. Blocks WFED019 and WFED021.

## 14. Open questions and assumptions

- OPEN: if `lib:canvasHistory` is not generic over its entry type, implement locally and file `tasks/_proposals/WFED008-canvas-history-generic.md`; do not edit the kit.
- ASSUMPTION: coalesce window 800 ms, burst limit 10 s, cap 100 (matches DS096).
