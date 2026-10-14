---
id: OVE_WFED021
title: "Track dirty state and save status (state machine) and guard unsaved changes on leave"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS036, OVE_WFED008, OVE_WFED019]
soft_depends_on: []
provides: ["lib:editor-save-state", "ui:UnsavedChangesDialog"]
needs: ["lib:editor-session", "lib:editor-history", "ui:ConfirmDialog", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/session/save-state.ts", "apps/desktop/src/features/workflow-editor/session/react/useSaveStatus.ts", "apps/desktop/src/features/workflow-editor/session/react/useUnsavedGuard.ts", "apps/desktop/src/features/workflow-editor/session/react/UnsavedChangesDialog.tsx", "apps/desktop/src/features/workflow-editor/session/save-state.test.ts", "apps/desktop/src/features/workflow-editor/session/react/UnsavedChangesDialog.test.tsx", "apps/desktop/src/features/workflow-editor/session/react/UnsavedChangesDialog.stories.tsx", "apps/desktop/src/locales/en/wfc-save.json", "apps/desktop/src/locales/pl/wfc-save.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED021: Track dirty state and save status (state machine) and guard unsaved changes on leave

## 1. Summary

A pure state machine for the save lifecycle (clean, dirty, saving, saved, error, conflict, offline, read-only), the hooks PART 2 uses to show it in the header, and the guard that stops the Owner from losing unsaved work when leaving the editor.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The mock does not show unsaved changes (listed in VIEWS as a state not shown). Dirty comes from the history save point (WFED008) plus external reasons (repairs on load, WFED020). The actual network saving is WFED022. Only drafts are saved; published versions are never dirty.

## 3. Scope (in)

- `saveReducer` and `SaveStatus` selector.
- `useSaveStatus()`, `useUnsavedGuard()`.
- `UnsavedChangesDialog` (leave with unsaved or failed save).
- Messages `wfc-save`.

## 4. Out of scope

- Performing saves, retry, conflict (WFED022).
- The status text in the header (PART 2).
- Router integration (SHELL/PART 2 call `prepareLeave`).

## 5. Detailed requirements

1. ```ts
type SavePhase = "clean" | "dirty" | "saving" | "saved" | "error" | "conflict" | "offline" | "readonly";
interface SaveStatus { phase: SavePhase; savedAt?: string /* ISO from server updatedAt */; attempt: number; nextRetryAt?: number; error?: { code: GatewayErrorCode; retryable: boolean } }
type SaveEvent = { type: "doc_dirty" } | { type: "doc_clean" } | { type: "save_started" } | { type: "save_ok"; updatedAt: string; stillDirty: boolean } | { type: "save_failed"; code; retryable; attempt; nextRetryAt? } | { type: "conflict" } | { type: "online" | "offline" } | { type: "readonly" } | { type: "reset" }
function saveReducer(s: SaveStatus, e: SaveEvent): SaveStatus
```
2. Transition rules (table-tested): `clean --doc_dirty--> dirty`; `dirty --save_started--> saving`; `saving --save_ok(stillDirty false)--> saved` (then after 3 s the selector reports `clean` with `savedAt` kept; the reducer stays `saved` and the UI decides how long to show "Zapisano"); `saving --save_ok(stillDirty true)--> dirty` (edits arrived during the save); `saving --save_failed--> error` (retryable) or `conflict` / `readonly` by code; `any --offline--> offline` when dirty, `online --> dirty` and an immediate retry request; a `doc_dirty` while `error` or `offline` stays in that phase (the user sees the problem) but marks `needsSave`; `conflict` only leaves through resolution (`reset`).
3. `useSaveStatus()` returns `{ status, label, isDirty, canSaveNow, saveNow }` where `label` is a `MessageRef` among `wfc-save:status.clean|dirty|saving|saved|error|conflict|offline|readonly` (EN: "All changes saved", "Unsaved changes", "Saving…", "Saved", "Could not save", "Conflict", "Offline", "Read-only"; PL equivalents). Words only, no colour-only meaning; PART 2 chooses the icon and placement. `saveNow` is provided by WFED022 through a context and is a no-op in `view` mode.
4. `useUnsavedGuard()` returns `{ shouldBlock: boolean; prepareLeave(): Promise<LeaveDecision> }`. `shouldBlock` is true for phases `dirty`, `saving`, `error`, `offline`, `conflict`. `prepareLeave()` first asks autosave to flush (WFED022 `flush()`); resolves `"clear"` when the flush succeeded or nothing was dirty; otherwise opens `UnsavedChangesDialog` and resolves `"leave"` (discard), `"stay"`. The shell/router (PART 2) awaits it in its blocker. It also registers a `beforeunload` listener (while `shouldBlock`) that sets `returnValue` (WebView closing the window).
5. `UnsavedChangesDialog` uses `ui:ConfirmDialog` (kit): title "Niezapisane zmiany", body "Nie udało się zapisać wersji roboczej. Jeśli wyjdziesz, ostatnie zmiany zostaną utracone.", primary `Zostań i spróbuj ponownie`, secondary (destructive tone) `Wyjdź bez zapisu`; focus lands on the safe primary button; Esc = stay; never auto-confirms.
6. The engine keeps the last saved draft, so "discard" loses only changes made since the last successful autosave (stated in the body with the last saved time when known).
7. Everything is deterministic and clock-free (times come from events).

## 6. Design notes

Not in the mock. Dialog follows the kit `ConfirmDialog` pattern (surface `bg-surface`, radius 20, `line-strong` border, title 18/700, buttons `Button` primary violet and secondary). Status labels are sentence case; the PART 2 header may render them as a mono 12 px caption next to the version badge (`v7 · opublikowana`). States: Default, Destructive focus visible (2 px violet ring), Reduced motion (no transitions).

## 7. Reuse

- `ui:ConfirmDialog` from the kit; history `isDirty` (WFED008); session subscription (WFED019). No second dirty implementation anywhere else (DRY).

## 8. Architecture and code placement

Layer: `save-state.ts` pure; hooks and dialog in `session/react/`. Depends on session and history only.

## 9. Security and safety

Prevents silent data loss; contains no data. The dialog never leaks draft content. `beforeunload` text is generic (browsers ignore custom text).

## 10. Errors and edge cases

- Undo back to the saved position: `doc_clean`, phase returns to `clean`/`saved`.
- Edit during saving: `stillDirty` true, another save follows.
- Draft of a published version (view): `readonly`, never blocks leaving.
- Offline then online with no changes: `clean`.
- Window closed while `saving`: guard blocks and the dialog appears if the flush cannot finish within 3 s.

## 11. Acceptance criteria

- [ ] Given the transition table, every row is covered by a test.
- [ ] Given a dirty draft and a failed flush, Then `prepareLeave` opens the dialog and resolves `stay` on Esc.
- [ ] Given `view` mode, Then `shouldBlock` is false.
- [ ] Given save_ok with `stillDirty: true`, Then phase `dirty`.
- [ ] The dialog passes axe and traps focus.

## 12. Test plan

Reducer table tests, hook tests with the fake session and fake autosave, RTL and Storybook interaction tests (Esc, focus). Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/session/save-state src/features/workflow-editor/session/react`.

## 13. Parallelization notes

Parallel with WFED022 (agree on `SaveEvent` through this file, merged first) and WFED023.

## 14. Open questions and assumptions

- ASSUMPTION: the "Zapisano" confirmation fades after 3 s in the header (PART 2 decides).
