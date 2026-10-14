---
id: OVE_WFED028
title: "Persist and restore the canvas viewport per Workflow (localStorage, safe)"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS087, OVE_WFED019]
soft_depends_on: []
provides: ["lib:editor-viewport-store"]
needs: ["lib:editor-session", "lib:canvasGeometry"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/viewport-store.ts", "apps/desktop/src/features/workflow-editor/canvas/useWorkflowViewport.ts", "apps/desktop/src/features/workflow-editor/canvas/viewport-store.test.ts", "apps/desktop/src/features/workflow-editor/canvas/useWorkflowViewport.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED028: Persist and restore the canvas viewport per Workflow (localStorage, safe)

## 1. Summary

Remembers zoom and pan for each Workflow so reopening it (or switching from the published version to the draft) lands where the Owner left, and falls back to fit-view when there is nothing sensible to restore. Storage is a per-viewer convenience and may be absent.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The viewport is a view preference, not part of the Workflow (not in the definition, not in the draft, never sent to the engine). Browser storage is per viewer and can be empty, blocked or throw (private window, cleared data), so every access is wrapped and the editor works without it. The default mock viewport is `{ x: 8, y: 12, zoom: 0.7 }` (DS087).

## 3. Scope (in)

- `ViewportStore` with `get(workflowId)`, `set(workflowId, vp)`, `clear(workflowId)` and an in-memory fallback.
- `useWorkflowViewport(workflowId)` controlled-state hook for the pane.
- Restore rules and sanity checks.

## 4. Out of scope

- The fit-on-load call (WFED027).
- Syncing across devices (not planned).
- Persisting selection or open panels.

## 5. Detailed requirements

1. Key `overmind.wfc.viewport.v1`: ONE JSON object `{ v: 1, items: { [workflowId]: { x, y, zoom, at } } }` with at most 50 workflows (LRU by `at`, an injected `Clock`), size < 8 KiB; parse with a strict schema (finite numbers, zoom 0.1..2.0, ids matching the ULID prefix format) and discard the whole object when invalid. Writes are throttled to one per 500 ms after the last `onViewportChange` (trailing) and flushed on `pagehide`.
2. Every `localStorage` access is inside try/catch; on failure the store keeps values in memory for the session. It never throws and never logs values.
3. `useWorkflowViewport(workflowId)` returns `{ viewport, onViewportChange, restored: boolean, reset }`. The in-memory map survives `session.initialise` (switching the same Workflow from view to draft keeps the viewport; switching Workflow loads that one).
4. Restore sanity: a stored viewport is used only if at least one node intersects the visible rectangle given the container size (`visibleWorldRect`, DS087 geometry); otherwise `restored = false` and the caller fits the view. An empty document uses the default `{8, 12, 0.7}`.
5. The viewport is not part of undo/redo and does not make the draft dirty.
6. Versioned key (`v1`) allows future migration; unknown versions are ignored.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:canvasGeometry` for the visibility test; `Clock` port for `at`.

## 8. Architecture and code placement

Layer: `canvas/` (browser storage adapter + hook). Only this file touches `localStorage` for viewports.

## 9. Security and safety

Stored data is non sensitive (numbers and ids) but still validated on read because storage is writable by anything in the origin; invalid content is dropped, never trusted for layout beyond clamped numbers.

## 10. Errors and edge cases

- Storage full (quota): write fails silently, in-memory continues.
- Corrupt JSON: discarded, defaults.
- Workflow deleted: entry ages out by LRU.
- Stored zoom 5: rejected by the schema (clamped to the allowed range only via discard).
- Two windows: last write wins, harmless.

## 11. Acceptance criteria

- [ ] Given a stored viewport for W1, When W1 opens, Then `restored` is true and the viewport equals the stored one.
- [ ] Given a stored viewport where no node is visible, Then `restored` false.
- [ ] Given storage that throws, Then the hook still returns the default and no error escapes.
- [ ] Given 60 workflows saved, Then 50 remain and the oldest are gone.
- [ ] Given `initialise` with the same Workflow, Then the viewport is unchanged.

## 12. Test plan

Unit tests with an injected storage fake (throwing, full, corrupt variants) and fake clock; hook tests. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/viewport-store src/features/workflow-editor/canvas/useWorkflowViewport`.

## 13. Parallelization notes

Parallel with WFED024..WFED029. Blocks WFED024 (the pane imports the hook).

## 14. Open questions and assumptions

- ASSUMPTION: no per-version viewport; per Workflow only (as the brief asks).
