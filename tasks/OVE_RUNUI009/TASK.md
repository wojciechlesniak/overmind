---
id: OVE_RUNUI009
title: "Keep the Activity view live: merge pushed events, follow mode and resync"
area: RUNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE017, OVE_ENGINE027, OVE_RUNUI001, OVE_RUNUI005, OVE_RUNUI007, OVE_WFED080]
soft_depends_on: []
provides: ["feature:runs-live"]
needs: ["lib:api-client-events", "api:events.subscribe", "lib:runs-data-hooks", "lib:runs-events-model", "lib:runs-trace-model", "lib:wfed-run-projection"]
owns: ["apps/desktop/src/features/runs/live/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 12"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI009: Keep the Activity view live: merge pushed events, follow mode and resync

## 1. Summary

One subscription for the Activity view that patches the Run list, the Gantt data and the events table in place from pushed events, with batching, follow-mode semantics for the table ('N nowych zdarzeń') and resync after reconnect.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. `events.subscribe` (ENGINE017/027) streams typed events with resume. Without a live layer each region polls and the trace, list and table disagree. The editor's overlay uses the same reducer for Node state; here we need list/trace/feed patches.

## 3. Scope (in)

- `useActivityLive(runId, filters)` hook.
- Patch functions into the query caches.
- Follow-mode state for the table.
- Connection indicator state.

## 4. Out of scope

- Gateway SSE (ENGINE).
- Canvas overlay subscription (`OVE_WFED081`), separate by design (different state shape).

## 5. Detailed requirements

1. Subscribe once per Activity page with filter `{workspaceId, types: ['run.*','approval.*','access_request.*','provider.*','agent.report.received']}` plus `runId` when the table scope is a single Run; the subscription is shared with the list hook (selected Run changes do not resubscribe).
2. Batching: events queue and flush once per animation frame; trace and list patches are coalesced (max 4 flushes/s for trace).
3. Patches: `run.node.*` -> NodeExecution cache entries (insert/update by `executionKey`); `run.*` lifecycle -> Run list item and detail; feed-worthy events -> prepend an `ActivityEntry` built server-side? The client cannot build entries; instead it receives `activity.entry` events (assumed ephemeral event pushed by the engine for each persisted feed entry; `event:activity.entry.created`) and prepends them if they pass the active filters (client-side filter predicate equals the server semantics, unit tested).
4. Follow mode: when the table is scrolled to the top, new rows are inserted directly (no layout jump, rows enter without animation under reduced motion); otherwise a counter increases and the pill 'N nowych zdarzeń' (button) scrolls to top and flushes.
5. Gap/reconnect: on `resync` refetch run detail, executions and the feed head (not the whole history); counts reset.
6. Connection indicator: 'na żywo' (mint dot) / 'łączenie…' (amber) / 'dane sprzed 15 s' (grey) shown next to the Activity heading; announced politely only on change to stale.
7. Stops pushing into the table while replay mode is active (replay owns the view).
8. Memory cap: the in-memory feed window keeps at most 1 000 rows; older rows are dropped from the cache head-to-tail but remain fetchable.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:api-client-events`; reducer `lib:wfed-run-projection` for per-Node status text; query caches from `OVE_RUNUI001`.

## 8. Architecture and code placement

`@RU/live/` (`use-activity-live.ts`, `patch-caches.ts`, `entry-filter.ts` (pure predicate), `follow-mode.ts`). No JSX.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. The client-side filter predicate only decides display; the subscription scope is enforced by the server. Event payloads are schema-validated before patching; invalid ones are dropped.

## 10. Errors and edge cases

- Event arrives for an entry already in the cache (replay overlap): deduplicated by id.
- Filter changes while events are queued: queue re-evaluated against the new predicate.
- Tab hidden: flush on visibility.
- Thousands of events/s: cap and resync.

## 11. Acceptance criteria

- [ ] Given an `activity.entry.created` matching the filters, then it is prepended exactly once.
- [ ] Given scrolled-away follow state, then the counter increases and no layout shift occurs.
- [ ] Given reconnect with a gap, then a resync refetches the head and clears the counter.
- [ ] Given replay active, then live events do not alter the displayed table.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

Hook tests with fake transport and rAF; `entry-filter.test.ts` parity table against server semantics fixtures. `pnpm --filter desktop vitest run src/features/runs/live`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the engine pushes `event:activity.entry.created` (ephemeral) for the unified feed (flagged with `api:activity.list`).
