---
id: OVE_WFED022
title: "Implement draft autosave: debounce, retry, offline handling, revision conflicts"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DS013, OVE_DS036, OVE_DS040, OVE_WFED008, OVE_WFED013, OVE_WFED018, OVE_WFED019, OVE_WFED020, OVE_WFED021]
soft_depends_on: []
provides: ["lib:editor-autosave", "ui:SaveConflictDialog"]
needs: ["lib:editor-save-state", "lib:editor-gateway", "lib:editor-session", "lib:workflow-mappers", "lib:editor-history", "ui:Dialog", "ui:Button", "ui:CalloutAmber", "port:Clock"]
owns: ["apps/desktop/src/features/workflow-editor/session/autosave.ts", "apps/desktop/src/features/workflow-editor/session/save-policy.ts", "apps/desktop/src/features/workflow-editor/session/react/useAutosave.ts", "apps/desktop/src/features/workflow-editor/session/react/SaveConflictDialog.tsx", "apps/desktop/src/features/workflow-editor/session/autosave.test.ts", "apps/desktop/src/features/workflow-editor/session/react/SaveConflictDialog.test.tsx", "apps/desktop/src/features/workflow-editor/session/react/SaveConflictDialog.stories.tsx", "apps/desktop/src/locales/en/wfc-conflict.json", "apps/desktop/src/locales/pl/wfc-conflict.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED022: Implement draft autosave: debounce, retry, offline handling, revision conflicts

## 1. Summary

Persists the draft to the engine automatically: debounced, one request at a time, optimistic revisions, exponential backoff, offline pause, flush on leave, and a resolution dialog when the draft changed elsewhere. The saved definition always comes from the pure mapper, never from React state.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. WFRT002: one mutable draft per Workflow with an integer `revision`; `PUT draft` with `{ definition, expectedRevision }`; a stale revision gives `wfrt.draft_revision_conflict` (409) with `currentRevision` (a second editor tab, or Chief editing the draft). Publishing (PART 2) always re-validates on the server; autosave never publishes and never validates (saving an invalid draft is allowed so work is never lost). "Edytuj jako v8" creates the draft (WFED020).

## 3. Scope (in)

- `createAutosave(deps)` with `flush`, `saveNow`, `pause`, `dispose`.
- Policy constants in `save-policy.ts`.
- Conflict detection and resolution flows.
- `useAutosave()` hook and `SaveConflictDialog`.

## 4. Out of scope

- Status display (PART 2), the state machine (WFED021), validation requests (PART 2), publish (PART 2).

## 5. Detailed requirements

1. Policy (constants, one file): debounce 2 000 ms after the last document change, max wait 15 000 ms from the first unsaved change, minimum interval between request starts 1 000 ms, request timeout 30 000 ms (adapter), retry schedule 2 s, 4 s, 8 s, 16 s, 30 s (5 attempts, jitter +-20 % from an injected `random` so tests are deterministic), then phase `error` with a manual "Spróbuj ponownie".
2. Triggers: `session.subscribeDocument` (change -> schedule), `window` blur and `document.visibilitychange` to hidden (save at once), `flush()` (awaited by the leave guard, WFED021), `saveNow()` (manual), `online` event (retry), mode change. Nothing is saved in `view` mode or when `readOnlyReason` is set.
3. Single flight: while a request is in flight further changes only mark the draft dirty again; when the request resolves a follow-up save starts (respecting the minimum interval). The request snapshots `{ definition: definitionFromDocument(doc), revision, position: history.getPosition() }` at start.
4. Success: `session.setRevision(newRevision)` (source revision updated), `history.markSaved(snapshot.position)` so edits made during the request keep the draft dirty (WFED008), emit `save_ok { updatedAt, stillDirty }` (WFED021).
5. Failure handling by `GatewayError.code`: `network`, `timeout`, `server` -> retry schedule (phase `error` with `nextRetryAt`; the UI shows "Ponawiam za {s} s"); `network` while `navigator.onLine === false` -> `offline` and wait for `online`; `definition_too_large` -> `error` non retryable with message "Workflow jest zbyt duży (limit 512 KiB)"; `archived` or `forbidden` -> `readonly`; `from_future` cannot occur on save. All other codes -> `error` retryable once, then manual.
6. Revision conflict: (1) fetch the server draft with `getDraft`; (2) if its definition equals the one just sent (compare `normalizeDefinition` deep-equality, positions included) the earlier request had succeeded but its response was lost: adopt `revision` silently, no dialog; (3) otherwise enter phase `conflict`, pause autosave and show `SaveConflictDialog` with the server `updatedAt` and a summary computed by `diffSummary(local, server)` (nodes added/removed/changed counts, never contents). Resolutions: `Wczytaj wersję z serwera` (confirm: "Twoje niezapisane zmiany zostaną utracone"; maps the server definition, `session.replaceDocument`, resets history, adopts the revision), `Zachowaj moją wersję` (adopts `currentRevision` as the expected revision and saves again, overwriting the server draft), `Zdecyduj później` (dialog closes, phase stays `conflict`, the header shows it, local editing continues, autosave stays paused, `saveNow` reopens the dialog).
7. Idempotency: the adapter MAY send an idempotency key (ENGINE); regardless, step (2) above makes a lost-response retry safe.
8. Teardown: `dispose()` clears timers, aborts the in-flight request and flushes nothing (the leave guard decides). Timers and `random` are injected (`Scheduler` port) so tests use a fake clock, no real waiting.
9. Concurrency safety: a `load` or `initialise` while a save is in flight aborts it (the loader clears the autosave state through `reset`).
10. Logging: attempt number, status code, duration; never the definition.

## 6. Design notes

`SaveConflictDialog` (not in the mock): kit `Dialog`, width 460, title "Wersja robocza zmieniła się gdzie indziej", body "Ktoś zapisał tę wersję roboczą ({time}). Dodano {added}, usunięto {removed}, zmieniono {changed} Węzłów.", three buttons: secondary `Wczytaj wersję z serwera`, primary violet `Zachowaj moją wersję`, ghost `Zdecyduj później`; destructive confirmation as second step; amber callout `ui:CalloutAmber` with the icon and the words "Konflikt zapisu" (state never colour-only); focus on the primary; Esc = decide later. Stories: Default, Confirm discard step, Reduced motion.

## 7. Reuse

- `ui:Dialog`, `ui:Button`, `ui:CalloutAmber`; `definitionFromDocument`, `documentFromDefinition`, `normalizeDefinition` (WFED013); gateway interface (WFED018); `saveReducer` events (WFED021); history position (WFED008).

## 8. Architecture and code placement

Layer: `session/autosave.ts` is framework-free orchestration over the `EditorGateway` and `Scheduler` ports; React only in `session/react/`. One instance per session.

## 9. Security and safety

Saves only the owner session draft over the authenticated channel; the server enforces size, ownership and visibility. The conflict flow never merges silently: overwriting requires an explicit click, discarding requires a second confirmation, so a stale tab cannot clobber newer work unnoticed (and Chief edits are never lost by accident). The definition never goes to logs. Draft content is not cached in localStorage.

## 10. Errors and edge cases

- Two editor windows: second save conflicts, dialog, no data loss without consent.
- Save succeeds but the response is lost: step (2) makes the retry a no-op.
- Tab hidden while saving: finishing in the background is fine.
- Edit then undo to saved position before the timer fires: not dirty, no request.
- Autosave during an open history transaction: waits for `commit` (a gesture is never half-saved).
- Clock jump: timers use a monotonic `Scheduler`.

## 11. Acceptance criteria

- [ ] Given 10 edits within 1 s, Then exactly one request is sent 2 s after the last edit.
- [ ] Given continuous editing for 20 s, Then a request starts at 15 s (max wait).
- [ ] Given a 409 whose server draft equals the sent definition, Then no dialog and phase `saved`.
- [ ] Given a real conflict and `Zachowaj moją wersję`, Then a second request carries `expectedRevision = currentRevision`.
- [ ] Given offline, Then no retry spam; on `online` one save runs.
- [ ] Given an edit during an in-flight save, Then after success phase is `dirty` and a second save follows.
- [ ] Given `flush()` with nothing dirty, Then it resolves immediately without a request.

## 12. Test plan

Unit tests with the fake gateway (injectable failures), fake scheduler and clock; dialog RTL and Storybook tests; sequence diagrams as table tests. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/session/autosave src/features/workflow-editor/session/react/SaveConflictDialog`.

## 13. Parallelization notes

After WFED021 and WFED020. Parallel with WFED023, WFED024.

## 14. Open questions and assumptions

- ASSUMPTION: no periodic server polling for draft changes; conflicts are detected on save only (an event `workflow.draft_saved`, WFRT002, MAY later refresh a read-only banner).
- OPEN: offer "export my version as JSON" in the conflict dialog (post MVP).
