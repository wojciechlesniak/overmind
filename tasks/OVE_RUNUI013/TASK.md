---
id: OVE_RUNUI013
title: "Build the replay engine: seekable playback of recorded Run events (pure, no re-execution)"
area: RUNUI
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA006, OVE_RUNUI001, OVE_WFED080, OVE_WFRT006, OVE_WFRT007, OVE_WFRT051]
soft_depends_on: []
provides: ["lib:runs-replay-engine"]
needs: ["contract:RunTrace", "event:run.versions_pinned", "lib:wfed-run-projection", "lib:event-replay", "api:runs.events", "lib:runs-data-hooks"]
owns: ["apps/desktop/src/features/runs/replay/engine/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI013: Build the replay engine: seekable playback of recorded Run events (pure, no re-execution)

## 1. Summary

A pure, deterministic controller for 'Replay zdarzeń': it loads a Run's recorded events, builds snapshots for fast seeking, advances a playhead with speed control and gap compression, and yields the overlay state (the same reducer as the canvas) at any position. Replay only re-displays history; it never calls Agents, tools or the engine's execution paths.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. SPEC 7: 'trace i replay zdarzeń'; SPEC 15: 'Odtwarzalność Runu: wersja grafu, Agenta, Skilla i modelu'. Events are the source of truth (SQLite WAL event log, ADR 0005). Replay therefore reads events (`api:runs.events`, cursor paged, includes `seq` and `at`) and applies the reducer from the editor overlay model (`lib:wfed-run-projection`), so the Gantt, list and canvas show identical states at the playhead.

## 3. Scope (in)

- `createReplay(events, options)` state machine: `idle|loading|ready|playing|paused|ended`.
- Seek by seq, by time and by percentage; step (next/previous event, next/previous Node change).
- Speed and gap compression; snapshots every 200 events.
- Selectors `stateAt(position)`, `traceRowsAt(position)`.

## 4. Out of scope

- Replay UI (`OVE_RUNUI014`).
- Fetching events (`OVE_RUNUI001`).

## 5. Detailed requirements

1. Inputs: `ReplayEvent { seq, at (ms epoch), type, payload }[]` sorted by seq (the loader pages until `hasMore=false`, max 200 000 events; larger Runs refuse with 'Run zbyt duży do replay w aplikacji' and offer the exported report).
2. Position model: `{ index: number }` (events applied so far); `timeAt(index)`; `indexAtTime(t)` by binary search; progress 0..1 by recorded time, not by event count.
3. Playback: `tick(deltaRealMs)` advances recorded time by `delta * speed` with gap compression: any recorded gap longer than `maxGapMs` (default 1 500 ms at speed 1) is compressed to `maxGapMs`; waiting periods (Approval, timers) are therefore skipped visually but labelled ('pominięto 3 min oczekiwania' marker in the timeline).
4. Speeds: 0.5, 1, 2, 4, 8 and 'max' (one event per frame, capped 60/s).
5. Snapshots: reducer state saved every 200 events; seeking backwards restores the nearest earlier snapshot and re-applies events (O(200) work); stepping back by one event is therefore cheap; memory cap 50 snapshots (LRU).
6. Determinism: the same events and the same sequence of controller calls give identical states (tested with a fixed fake clock; no `Date.now()`; injected `now` and `raf`).
7. Pinned versions: `pinnedAt(index)` returns the `run.versions_pinned` record (static for the Run) so the UI shows what version the Run executed under; the graph shown in replay is the pinned Version (the loader fetches the Version by id).
8. Ended state at the last event; a live Run replays up to the last known event and offers 'Wróć do bieżącego stanu' (leaves replay).
9. Marker list: `markers(events)` returns notable points (Node failure, Approval wait, Gate failure, loop iteration, escalation) for the timeline with kind and index.
10. Safety: replay performs no I/O besides reading events; the controller has no references to command routes or mutation hooks (enforced by a lint boundary: the replay folder may import only read hooks).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Overlay reducer `lib:wfed-run-projection` (single projection, DRY); `lib:event-replay` semantics for ordering.

## 8. Architecture and code placement

Pure TypeScript `@RU/replay/engine/` (`controller.ts`, `snapshots.ts`, `gap-compression.ts`, `markers.ts`, `fixtures/`). No React.

## 9. Security and safety

Replay is read-only by construction (no mutation imports, enforced by an ESLint `no-restricted-imports` rule scoped to the folder). Event payloads are data: nothing from them is executed or interpreted as instructions. Large inputs are bounded (200 000 events).

## 10. Errors and edge cases

- Missing seq (retention gap): replay shows a 'luka w zdarzeniach' marker and continues; state may be incomplete and is flagged.
- Event types unknown to this app version: ignored with a counter shown in the details.
- Seek beyond the end: clamps.
- Time going backwards (clock anomaly): `timeAt` is made monotonic by clamping.

## 11. Acceptance criteria

- [ ] Given the golden `run-14.events.json`, then `stateAt(end)` equals the overlay computed from the final snapshot (replay-equivalence).
- [ ] Seeking backwards and forwards yields identical states for the same index (property test).
- [ ] A gap of 3 minutes is compressed to 1.5 s at speed 1 and marked.
- [ ] Controller output is identical across two runs with the same inputs (determinism test).
- [ ] The folder does not import mutation hooks (lint rule test).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`controller.test.ts`, `snapshots.test.ts`, `gap-compression.test.ts`, `markers.test.ts`, property tests (fast-check) over seek/step sequences, lint boundary test. `pnpm --filter desktop vitest run src/features/runs/replay/engine`.

## 13. Parallelization notes

Shares the reducer with the editor overlay: needs `OVE_WFED080` merged. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `api:runs.events` returns raw typed events (not presentation entries) with `seq` and `at`; the unified feed is for the table only.
- ASSUMPTION: 200 000 events cap and 1.5 s default gap compression.
