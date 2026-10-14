---
id: OVE_RUNUI001
title: "Build the Activity data layer: hooks for Runs, trace, events, usage and replay data"
area: RUNUI
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE019, OVE_ENGINE027, OVE_PERM019, OVE_PERM023, OVE_PROV002, OVE_SHELL005, OVE_WFRT006, OVE_WFRT054, OVE_WFRT057]
soft_depends_on: []
provides: ["lib:runs-data-hooks", "lib:runs-query-keys"]
needs: ["lib:api-client", "lib:api-client-runs", "lib:api-client-usage", "lib:api-client-audit", "lib:api-client-events", "lib:desktop-query-layer", "contract:WorkflowRun", "contract:NodeExecution", "contract:RunTrace", "contract:AuditEvent", "contract:ModelUsage", "contract:ActivityEntry", "contract:ToolCallRecord"]
owns: ["apps/desktop/src/features/runs/data/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI001: Build the Activity data layer: hooks for Runs, trace, events, usage and replay data

## 1. Summary

Typed hooks and query keys for everything the Activity view reads: paged Run list, Run detail, Node executions (for the Gantt), unified Activity feed with filters, usage summaries, tool-call log and the pinned-versions record, with event-driven invalidation and contract validation.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Gateway routes are provided by WFRT (runs), PROV (usage) and PERM/ENGINE (audit); the unified Activity feed route `api:activity.list` and the tool-call route are not yet owned by any task (flagged). The page must show one consistent state: the Run list status, the header pill and the trace come from the same cache.

## 3. Scope (in)

- `runsKeys` factory (all keys start `['runs', workspaceId, ...]`).
- Hooks: `useRunList(filters)` (infinite), `useRun(runId)`, `useNodeExecutions(runId)`, `useActivityFeed(filters)` (infinite, cursor), `useUsageSummary(params)`, `useToolCalls(runId, filters)`, `usePinnedVersions(runId)`.
- Invalidation map from events to keys; throttled refetch helpers.
- Fixtures and a fake gateway.

## 4. Out of scope

- Live merge of stream events into the feed (`OVE_RUNUI009`).
- View-models (`OVE_RUNUI002`, `OVE_RUNUI005`, `OVE_RUNUI007`, `OVE_RUNUI010`).

## 5. Detailed requirements

1. Hooks wrap `lib:api-client` only; results are parsed with contract schemas; parse failures become `client.contract_mismatch`.
2. Unified status shape `{status:'loading'|'ready'|'error'|'empty', data, error: AppErrorView, hasNextPage, fetchNextPage}` (same as the editor data layer for consistency; shared type from `lib:desktop-query-layer`).
3. `useRunList({workflowId?, status?, includeDryRun=false, search?})`: cursor pagination 30 per page; ordering: running first, then by `createdAt` desc (server `sort=active_first`).
4. `useActivityFeed({runId?, agentId?, onlyIssues, kinds?[], before?})`: cursor pagination 50 per page, newest first; `onlyIssues` maps to server filter `result in (blocked, failed, gate_failed, waiting)`.
5. `useUsageSummary({groupBy: 'provider'|'model'|'agent'|'run'|'workspace', runId?, from?, to?})`; response carries `source` per row (`cli|ollama|api`) and `reportedLimit` for CLI rows.
6. `useToolCalls(runId, {agentId?, decision?})`: paged; records are already redacted by the engine (the client never sees raw results).
7. Invalidation: `run.created|started|paused|resumed|cancelled|succeeded|failed|escalated` -> run list and run detail; `run.node.*` -> node executions (throttled to 1 refetch per 2 s) unless the live projection is active (`OVE_RUNUI009` patches in place); `approval.*`, `access_request.*`, `run.action.*` -> feed head; `provider.limit_reached|limit_reset|model_switched` -> usage.
8. Workspace switch drops all keys.
9. Mutations (cancel) are in `OVE_WFED053`, not here (DRY).
10. All list hooks expose `refetch()` and keep previous data while revalidating.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:api-client*`, `lib:desktop-query-layer`, error view type from `OVE_WFED050` if present (shared module `apps/desktop/src/shared/app-error-view.ts` owned by SHELL; if absent this task defines `@RU/data/errors.ts` and WFED imports it later).

## 8. Architecture and code placement

`@RU/data/` (`keys.ts`, `use-run-list.ts`, `use-run.ts`, `use-node-executions.ts`, `use-activity-feed.ts`, `use-usage.ts`, `use-tool-calls.ts`, `invalidation.ts`, `fixtures/`). Adapter layer; depends on api-client and contracts only.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Cache keys include the Workspace id so private Agents, Runs or Decisions of another Workspace never appear. Isolated Workspaces expose nothing outward: the server scopes every route and the client never requests cross-Workspace aggregates except the `workspace` usage grouping which returns only the Owner's Workspaces' totals.

## 10. Errors and edge cases

- Feed cursor invalidated by retention (older events purged): `410`-like error `cursor_expired` -> refetch from head with a notice.
- Run list contains a dry-run: hidden by default, shown with 'dry-run' label when the filter is on.
- Usage route returns `null` limit percent: handled by view-model (`brak danych wg CLI`).
- Two rapid filter changes: previous request cancelled.

## 11. Acceptance criteria

- [ ] Given a `run.succeeded` event, then list and detail refetch once.
- [ ] Given a Workspace switch, then no cached item of the previous Workspace is returned.
- [ ] Given `onlyIssues`, then the request carries the server filter, not a client-side filter.
- [ ] Given a schema violation, then `client.contract_mismatch` is returned.

## 12. Test plan

Vitest with fake gateway: `keys.test.ts`, `invalidation.test.ts`, `pagination.test.ts`, `workspace-switch.test.ts`. `pnpm --filter desktop vitest run src/features/runs/data`.

## 13. Parallelization notes

Parallel with the view-model tasks (they use fixtures). Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: gateway routes `api:runs.list|get|node-executions|tool-calls|events`, `api:usage.summary` and `api:activity.list` exist with the names used in `needs`; `api:activity.list` and `api:runs.tool-calls` have no owner yet (flagged in the final report).
- ASSUMPTION: dry-run Runs are excluded server-side unless `includeDryRun=true`.
