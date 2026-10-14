---
id: OVE_WFED019
title: "Build the editor session store: state, dispatch, undo/redo, transactions, React hooks"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_WFED002, OVE_WFED003, OVE_WFED005, OVE_WFED007, OVE_WFED008]
soft_depends_on: []
provides: ["lib:editor-session"]
needs: ["lib:editor-commands", "lib:editor-history", "lib:editor-document-model", "lib:editor-node-catalog", "lib:editor-ids", "port:Clock"]
owns: ["apps/desktop/src/features/workflow-editor/session/store.ts", "apps/desktop/src/features/workflow-editor/session/types.ts", "apps/desktop/src/features/workflow-editor/session/selection-state.ts", "apps/desktop/src/features/workflow-editor/session/react/**", "apps/desktop/src/features/workflow-editor/session/*.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED019: Build the editor session store: state, dispatch, undo/redo, transactions, React hooks

## 1. Summary

The framework-free state container of one open Workflow: document, selection, history, mode, source and errors, with a single `dispatch(command)` entry that runs the command engine, records history and notifies subscribers. React hooks sit in `session/react/`. PART 2 and every canvas task read and change the editor only through this session.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The document is plain immutable data (WFED002), changed by commands (WFED007), with history (WFED008). Nothing in React state holds graph data; React components subscribe to slices through `useSyncExternalStore` so a selection change does not re-render all 200 nodes (WFED045). Modes: `view` (a published, immutable Workflow Version) and `edit` (the draft, "Edytuj jako v8" in the mock).

## 3. Scope (in)

- State shape and the `EditorSession` interface.
- `createEditorSession(deps)`.
- Selection state and pruning.
- Transactions API for gestures.
- `EditorProvider`, `useEditorSession`, `useEditorSelector`, `useDocument`, `useSelection`, `useHistoryState`.

## 4. Out of scope

- Loading data (WFED020), dirty/save policy (WFED021, WFED022), command catalogue (WFED009..WFED012), shortcuts (WFED038).

## 5. Detailed requirements

1. ```ts
interface EditorState {
  status: "empty" | "loading" | "ready" | "error";
  mode: "view" | "edit";
  source?: { workflowId: string; kind: "version" | "draft"; versionNo?: number; baseVersionNo?: number; revision?: number };
  doc: EditorDocument; selection: SelectionState; historyState: { canUndo: boolean; canRedo: boolean; undoLabel?: MessageRef; redoLabel?: MessageRef; isDirty: boolean };
  readOnlyReason?: "published_version" | "from_future" | "unreadable" | "archived" | "conflict";
  repairs: readonly Repair[]; loadError?: LoadError;
}
interface SelectionState { nodes: readonly NodeKey[]; edges: readonly EdgeId[]; groups: readonly GroupId[]; focus?: { kind: "node" | "edge" | "group"; id: string } }
interface EditorSession {
  getState(): EditorState; subscribe(l: () => void): () => void; subscribeDocument(l: (doc: EditorDocument, prev: EditorDocument) => void): () => void;
  dispatch(cmd: CommandData): Result<CommandOutcome | { unchanged: true }, CommandError>;
  transaction<T>(label: MessageRef, fn: () => T): T;               // begin; run; commit; abort on throw or on Result error
  undo(): boolean; redo(): boolean;
  setSelection(s: Partial<SelectionState> | ((prev) => SelectionState)): void;
  initialise(input: { doc; mode; source; repairs?; readOnlyReason? }): void;   // used by the loader; clears history and selection
  replaceDocument(doc: EditorDocument, opts: { keepHistory: false }): void;     // used by conflict resolution
  markDirtyExternally(): void;                                                 // loader repairs
  onEffects(listener: (e: CommandEffects, cmd: CommandData) => void): () => void;
  readonly engine: CommandEngine; readonly history: EditorHistory;
}
```
2. `dispatch`: (1) refuses in `view` mode or with a `readOnlyReason` (error `read_only`); (2) calls `engine.execute`; (3) on `unchanged` returns without notifying; (4) sets the new document, records a history entry (forward command, inverse, label, coalesce key, selection before and after) unless inside a transaction (then collected); (5) applies `effects.selection` (if present) pruned to existing elements; (6) emits effects to `onEffects` listeners (announcer WFED038, toasts); (7) notifies subscribers once. All synchronous.
3. `undo/redo`: take the command from history, `engine.execute` it WITHOUT recording a new entry, restore the recorded selection (pruned), emit effects with announce text (`Cofnięto: {label}`). They return false at the ends.
4. `transaction(label, fn)`: used by gestures (a multi-node drag, paste, group creation, nudge burst): all dispatches inside produce ONE history entry; if `fn` throws or any dispatch returns an error, the transaction aborts and executes the returned inverse commands so the document is exactly as before (atomic); the error is rethrown/returned.
5. Selection pruning: after every document change, selection entries whose element no longer exists are removed (cheap, by set lookup). `setSelection` ignores unknown ids. In `view` mode selection works (the Inspector shows read-only details).
6. Slices and equality: `useEditorSelector(selector, isEqual = Object.is)` uses `useSyncExternalStore` with a cached snapshot; exported ready-made selectors: `selectDocument`, `selectSelection`, `selectMode`, `selectHistoryState`. Components MUST select narrow slices (a node component selects only its own node).
7. Store updates are immutable (`state` object replaced), the document object identity changes only when a command changed it.
8. Disposal: `dispose()` unsubscribes everything and aborts an open transaction; the provider calls it on unmount. Multiple sessions can coexist (tests, two windows); no module-level singletons.
9. Dependencies injected: `{ engineFactory, historyFactory, clock, catalog }`; defaults wired in the provider.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Engine and history (WFED007, WFED008), selectors (WFED002). Do not add a state library (no new dependency): `useSyncExternalStore` suffices (KISS, SPEC 19.7).

## 8. Architecture and code placement

Layer: application-style state container in `session/` (framework-free) with React bindings only in `session/react/` (layering test, WFED001). Depends on `document`, `commands`, `history`; is depended on by `canvas`, `palette`, `skills` and PART 2.

## 9. Security and safety

The session is the single write path to the document: it enforces mode (`view` is immutable) so a published Workflow Version can never be edited by a bug elsewhere (ADR 0002). Command effects are not logged with content. A transaction abort guarantees no half-applied multi-step change. Nothing is persisted here (no localStorage of documents).

## 10. Errors and edge cases

- Dispatch while `status !== "ready"`: `read_only`.
- Undo during an open transaction: refused (returns false).
- Selection references a node removed by undo: pruned.
- Two rapid dispatches in one tick: two history entries or one coalesced (policy of history), subscribers notified per dispatch (React batches).
- `initialise` called while a transaction is open: aborts it first.
- Listener throws: caught, logged with the listener name, others still run.

## 11. Acceptance criteria

- [ ] Given edit mode, When `dispatch(node.add)` then `undo()`, Then the document equals the original and `canRedo` is true.
- [ ] Given view mode, Then any dispatch returns `read_only` and the document identity is unchanged.
- [ ] Given a transaction with a failing member, Then the document is unchanged and no history entry exists.
- [ ] Given a component selecting only node "po", When another node moves, Then it does not re-render (render counter test).
- [ ] Given `initialise`, Then history and selection are cleared and `isDirty` is false.

## 12. Test plan

Unit tests with the fake clock; React Testing Library render-count tests for hooks; transaction atomicity tests. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/session`.

## 13. Parallelization notes

Parallel with WFED018. Blocks WFED020..WFED022, WFED024, WFED025.

## 14. Open questions and assumptions

- ASSUMPTION: a single open Workflow per session (the Workflow tab shows one); switching Workflow creates a new session or calls `initialise`.
