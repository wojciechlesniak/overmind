---
id: OVE_WFED081
title: "Subscribe the overlay to the events hub with resync, throttling and Run selection"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA006, OVE_ENGINE017, OVE_ENGINE027, OVE_WFED050, OVE_WFED080, OVE_WFRT051]
soft_depends_on: []
provides: ["feature:wfed-run-overlay-live"]
needs: ["lib:api-client-events", "api:events.subscribe", "api:runs.get", "api:runs.node-executions", "lib:event-replay", "lib:wfed-run-projection", "lib:wfed-data-hooks"]
owns: ["apps/desktop/src/features/workflow-editor/run-overlay/live/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 12"]
adr_refs: [2, 19, 28]
---

# OVE_WFED081: Subscribe the overlay to the events hub with resync, throttling and Run selection

## 1. Summary

The hook `useRunOverlay(runId)` that loads a Run snapshot, subscribes to its events, feeds the reducer in animation-frame batches, resyncs on gaps or reconnects and exposes the overlay state. Which Run is shown (active, selected from the header pill, or deep link from Activity) is decided here.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). ENGINE017: `events.subscribe` is an SSE hub with replay by `afterEventId`, filtering and heartbeat; ENGINE027 reconnects with resume and signals `resync` when the replay window is lost. The canvas must show the work of a Run that continues after the window was closed (ADR 0005): on page open the snapshot is loaded and then live events applied.

## 3. Scope (in)

- `useRunOverlay(runId | 'active')` hook.
- Run selection logic (`selectOverlayRun`).
- Batching and backpressure, resync handling, connection status indicator state.

## 4. Out of scope

- Reducer (`OVE_WFED080`).
- Rendering (`OVE_WFED082`).
- Replay at arbitrary time (RUNUI).

## 5. Detailed requirements

1. Selection: explicit `?run=<id>` (deep link from Activity/pill) > the Workflow's non-terminal Run (newest) > none. Terminal Runs are shown only when explicitly selected (`OVE_WFED083`).
2. Load: `runs.get` (header data) + `runs.node-executions` (snapshot with `lastEventSeq` and tokens in flight) -> `initialOverlay`; then subscribe with `{ runId, types: ['run.*'], afterEventId: snapshot.lastEventSeq }`.
3. Events are queued and applied once per animation frame (max 1 reduction per frame; a batch of events is reduced in one pass) so a burst cannot freeze the UI; under reduced motion the cadence stays but animation styles are off (`OVE_WFED082`).
4. On `needsResync` or transport `resync` signal: refetch the snapshot, rebuild the state, resubscribe from the new seq; at most 1 resync per 2 s (backoff 2 s, 4 s, 8 s up to 30 s).
5. Connection state exposed: `live | reconnecting | stale`; `stale` after 15 s without heartbeat; a muted chip 'Połączenie z silnikiem… ostatnie dane 14:21:07' appears over the canvas corner in that case.
6. Stops the subscription on unmount and when the Run becomes terminal for 5 s (final state kept).
7. Callback registry `onRunEvent` from `OVE_WFED050` is fed from the same stream so invalidations do not need a second subscription.
8. Switching Runs clears the previous state before showing the new one (no flash of the old Run).
9. A Run of another Workflow or Workspace is rejected with an error state (the gateway would refuse anyway).
10. Global Pause: state follows `pause.changed` and node `blockedBy`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:api-client-events` (resume/resync built in), reducer from `OVE_WFED080`, `lib:event-replay` semantics (server).

## 8. Architecture and code placement

`@WF/run-overlay/live/use-run-overlay.ts`, `batcher.ts` (rAF queue, injectable scheduler), `select-run.ts`. UI adapter layer; no JSX.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Subscription filters are fixed by the UI to one Run id; the server enforces scope (the UI cannot subscribe to other Workspaces' Runs). A flood of events is bounded by batching; payloads are validated by contract schemas before reducing (invalid events dropped and counted).

## 10. Errors and edge cases

- Browser tab hidden: rAF paused, events queue (cap 5 000, then resync on visibility).
- Engine restarts: transport reconnects, snapshot resync, state continues.
- Run deleted by Workspace cascade: error state 'Run nie istnieje'.
- Snapshot and first events overlap: handled by seq filtering.

## 11. Acceptance criteria

- [ ] Given 500 events in one frame, then exactly one reduction pass runs.
- [ ] Given a seq gap, then a resync happens and the final state equals the snapshot-derived state.
- [ ] Given 15 s without heartbeat, then connection state is `stale`.
- [ ] Given `?run=12` for a finished Run, then that Run's final overlay is shown without subscribing.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

Hook tests with a fake events transport (`lib:fake-ports`), fake rAF scheduler; resync test; visibility-hidden test. `pnpm --filter desktop vitest run src/features/workflow-editor/run-overlay/live`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the snapshot route returns `lastEventSeq` consistent with the event log (WFRT048); flagged to the linker.
