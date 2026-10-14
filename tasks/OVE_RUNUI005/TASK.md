---
id: OVE_RUNUI005
title: "Build the Run trace model for the Gantt: rows, scale and now marker (pure)"
area: RUNUI
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS040, OVE_RUNUI001, OVE_WFRT003, OVE_WFRT006]
soft_depends_on: []
provides: ["lib:runs-trace-model"]
needs: ["contract:NodeExecution", "contract:WorkflowRun", "contract:WorkflowDefinition", "ui:UiDomainTypes"]
owns: ["apps/desktop/src/features/runs/trace/model/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI005: Build the Run trace model for the Gantt: rows, scale and now marker (pure)

## 1. Summary

A pure function that converts NodeExecutions (plus the pinned Version's node labels and Agents) into `RunTraceProps` rows: label ('Developer · it. 2'), start/end minutes, status, result text ('✓', '✗ 2 testy', '3 decyzje', 'Zgoda'), axis ticks and the running 'now' position.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. The mock Gantt lists: Product Owner ✓, Designer ✓, 'Dyskusja · Zakres MVP' '3 decyzje', 'Developer · it. 1' ✓, QA · it. 1, Security · it. 1, 'Quality Gate · it. 1' ✗ 2 testy, 'Developer · it. 2' ✓, 'QA · it. 2' działa (magenta), 'Security · it. 2' Zgoda (amber hatched). Axis 0..20 min. DS076 `RunTrace` takes `TraceRowData { id, label, sublabel?, hue?, initials?, status, startMin, endMin?, resultLabel, iteration? }`.

## 3. Scope (in)

- `buildTraceRows(executions, labels, run)`.
- Scale selection (`totalMin`, `axisStepMin`).
- Result text derivation per Node type.
- Row ordering and iteration labelling.

## 4. Out of scope

- Rendering (`OVE_RUNUI006`).

## 5. Detailed requirements

1. Time origin = `run.startedAt`; positions are wall-clock minutes from the origin. Paused intervals (from `run.paused`/`run.resumed`) are passed on each row as `pausedSpans` so the bar can show hatched grey gaps (an optional DS prop, see section 14).
2. Row per `NodeExecution` (not per Node): label `<node label>` + sublabel `it. <n>` when `scope` contains a loop iteration; attempts > 1 add `próba 2` as sublabel suffix; Start/End/Parallel/Join operator Nodes are hidden by default (toggle 'Pokaż operatory'); Discussion shows 'Dyskusja · <title>'.
3. Ordering: by `startedAt` asc, ties by `executionKey`; executions never started (`pending|ready`) appear as `queued` rows at the end only when the toggle 'Pokaż oczekujące' is on (default off while running to keep the view short).
4. Status mapping to `TraceStatus`: succeeded -> done, failed -> failed, running -> running, waiting(approval) -> waiting-approval, waiting(other) -> `queued` with result 'czeka: timer', skipped -> skipped, cancelled -> failed look with result 'anulowany'.
5. `endMin`: `endedAt` or for running/waiting `nowMin`.
6. Result labels: done Agent -> '✓' plus a short result from the execution summary (`resultSummary`, bounded 24 chars) such as '4 pliki'; failed -> '✗ <short reason>' ('2 testy' from Gate evidence, or the error code word); Discussion -> '<n> decyzje' from its summary; waiting-approval -> 'Zgoda'; running -> 'działa'; Quality Gate failed -> '✗ 2 testy'.
7. `totalMin`: terminal Run: ceil(duration/5)*5 min at least 5; running: max(ceil(nowMin/5)*5, 20) so the axis does not rescale at every tick (rescales only when `nowMin` crosses 90% of total, to the next 5-min multiple); `axisStepMin`: 5 for total <= 30, 10 for <= 120, 30 beyond.
8. Colour hint `hue` and `initials` from the Agent's display data; non-Agent Nodes have none.
9. `now` marker only for non-terminal Runs.
10. Output is a plain object; deterministic for fixed inputs (the caller passes `now`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `TraceRowData`/`TraceStatus` types from `ui:RunTrace` (DS076).

## 8. Architecture and code placement

Pure TypeScript `@RU/trace/model/` (`build-trace-rows.ts`, `scale.ts`, `result-label.ts`).

## 9. Security and safety

Display mapping only; summaries are bounded text from the engine and rendered as text.

## 10. Errors and edge cases

- Run longer than 24 h: axis in hours (step 1 h) - label function `axisLabel(minutes)` handled by caller with formatter.
- Execution with `startedAt` after `endedAt` (clock anomaly): clamp and flag `anomaly`.
- Two executions of the same Node overlapping (retry after timeout): separate rows with attempt labels.
- 200+ executions: capped at 300 rows with '+N starszych' (virtualised in UI).

## 11. Acceptance criteria

- [ ] The mock Run fixture maps to rows with the exact mock labels and results (golden test).
- [ ] Axis rescales only past 90% of total (stability test).
- [ ] Waiting-approval row maps to `waiting-approval` and result 'Zgoda'.
- [ ] Operators hidden by default and shown with the toggle.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`build-trace-rows.test.ts` with the golden `run-14.executions.json`, `scale.test.ts`, `result-label.test.ts`. `pnpm --filter desktop vitest run src/features/runs/trace/model`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: DS076 gets an optional `pausedSpans` prop; recorded as a DS gap (hatched grey spans) and the first version may ignore it.
