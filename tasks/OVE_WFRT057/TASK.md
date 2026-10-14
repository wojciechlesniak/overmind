---
id: OVE_WFRT057
title: "Define ActivityEntry and ToolCallRecord contracts and the activity list route"
area: WFRT
kind: contract
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DATA005, OVE_ENGINE011, OVE_ENGINE013, OVE_PERM019, OVE_WFRT006, OVE_WFRT007, OVE_WFRT051]
soft_depends_on: []
provides: ["contract:ActivityEntry", "contract:ToolCallRecord", "api:activity.list", "usecase:ListActivity"]
needs: ["contract:WorkflowRun", "contract:RunTrace", "contract:AuditEvent", "port:EventStore", "lib:route-module", "lib:gateway-principal"]
owns: ["packages/contracts/src/activity/**", "packages/application/src/wfrt/activity/**", "packages/gateway/src/routes/wfrt/activity.route.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [23]
---

# OVE_WFRT057: Define ActivityEntry and ToolCallRecord contracts and the activity list route

## 1. Summary

Defines `ActivityEntry` (one row of the unified Activity feed) and `ToolCallRecord` (one tool invocation of a node), and exposes the Activity feed through `GET /activity`. The feed merges Run events, Approvals, Access Requests, Escalations and audit highlights into one time-ordered list.

## 2. Context

The Activity view (OVE_RUNUI001, OVE_RUNUI007, OVE_RUNUI015) renders a single chronological feed with filters. Without a contract the UI would invent its own union type. Data comes from the event log and audit store through their read models only.

## 3. Scope (in)

- Zod contracts `ActivityEntry = { id, ts, kind, workspaceId, runId?, nodeId?, actor, title, subject, severity, ref }` and `ToolCallRecord = { id, runId, nodeExecutionId, tool, argsSummary, resultSummary, status, startedAt, durationMs, truncated }`.
- Use case `ListActivity` (filters: workspaceId, kind[], runId, severity, from, to; cursor).
- Route `GET /activity` (owner scope).
- Mapper table from event types to `ActivityEntry` kinds, one file per mapped event family (extension point).

## 4. Out of scope

- Rendering: RUNUI tasks.
- Notifications: OVE_NOTIF004.
- Audit export: OVE_PERM023.

## 5. Detailed requirements

1. `kind` is a closed enum (`run`, `node`, `approval`, `access_request`, `escalation`, `decision`, `pause`, `security`); unknown event types are not shown rather than shown raw.
2. Mappers are registered in `packages/application/src/wfrt/activity/mappers/*.ts` and auto-discovered; adding a kind does not edit a shared switch.
3. `ToolCallRecord.argsSummary` and `resultSummary` are redacted (OVE_ARCH004) and capped at 512 characters each; `truncated` marks cuts.
4. Ordering is `ts desc` with `id` tiebreak; cursor is opaque; `limit` max 200.
5. Security-kind entries (denials, violations) are always included even when other filters hide the rest unless `kind` filter explicitly excludes them.
6. The list reads read models and never scans the whole event log; a filter combination without an index is rejected with `422 unsupported_filter`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:route-module` and `lib:route-registrar` (OVE_ARCH009, OVE_ENGINE013) for registration; do not hand-edit registries.
- `lib:gateway-pipeline` envelope, correlation ids and error mapping (OVE_ENGINE011); `lib:result` and `lib:error-catalogue` (OVE_ARCH003).
- `lib:cursor-pagination` (OVE_DATA007), `lib:gateway-idempotency` (OVE_ENGINE015), `lib:gateway-audit` (OVE_ENGINE016).

## 8. Architecture and code placement

Layer: adapter (gateway). Dependency direction: `routes/<area>` -> `application` use cases -> ports; contracts are shared with the api-client. Route modules never import another area's route module or any adapter. New behaviour is added by adding a route module (OCP); the registrar discovers it. Handlers contain no branching on business state (SRP).

## 9. Security and safety

- Activity text may contain agent or repository content: it is data, length-capped and escaped by the UI.
- Private Workspace entries never appear in another Workspace context.
- Read-only route; no state changes.

## 10. Errors and edge cases

- Unknown event type -> skipped and counted in diagnostics.
- Mapper throws -> entry skipped, error logged with event id.
- Time range over 90 days without a workspace filter -> `422 range_too_large` (`ASSUMPTION`).

## 11. Acceptance criteria

- [ ] Given a tool call with a secret-like argument, then the summary is redacted.
- [ ] Given a new mapper file, then the feed includes its kind without other edits.
- [ ] Given filters `kind=approval`, then only Approval entries return.
- [ ] Given an agent token, then 403.

## 12. Test plan

- Contract tests for the route, mapper unit tests (one per family), redaction test, cursor tests. `pnpm --filter @overmind/application test`, `pnpm --filter @overmind/gateway test`.

## 13. Parallelization notes

Parallel with OVE_WFRT051. Hotspot: mappers dir is one file per family to avoid conflicts.

## 14. Open questions and assumptions

- ASSUMPTION: 90-day maximum range without workspace filter.
- Open: whether decisions appear in the Activity feed or only in the Decision Register (default: appear as a link entry).
