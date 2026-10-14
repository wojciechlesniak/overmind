---
id: OVE_PERM027
title: Add gateway routes for Approvals (request, list, decide, cancel)
area: PERM
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ENGINE012, OVE_ENGINE019, OVE_PERM014, OVE_PERM025]
soft_depends_on: []
provides: ["api:approvals.list", "api:approvals.get", "api:approvals.request", "api:approvals.decide", "api:approvals.cancel", "lib:api-client-approvals"]
needs: ["lib:route-module", "lib:gateway-auth", "lib:api-client-core"]
owns: ["packages/gateway/src/routes/perm/approval-*.route.ts", "packages/contracts/src/perm/routes/approvals.ts", "packages/api-client/src/perm/approvals.ts"]
reads: ["packages/application/src/perm/approval-flow/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.9", "SPECIFICATION 16.10"]
adr_refs: [6, 21]
---

# OVE_PERM027: Add gateway routes for Approvals

## 1. Summary

API for listing, creating, deciding and cancelling Approvals, used by the desktop Approvals view, the Telegram adapter (in process as `channel:telegram`) and Agents (request/poll for their own Run).

## 2. Context

Decision channel is derived from the authenticated transport, never from the body (PERM008). Approvals are one-shot and Run-bound (PERM013/014).

## 3. Scope (in)

Routes, contracts, api-client.

## 4. Out of scope

Use case logic (PERM014), notifications (NOTIF/TG), UI (APPRUI).

## 5. Detailed requirements

| id | method path | scope | body / notes |
|---|---|---|---|
| approvals.list | GET /v1/approvals?status=&workspaceId=&runId=&cursor=&limit= | O, T (summary), A (own Run, id+status only) | |
| approvals.get | GET /v1/approvals/{id} | O, T (summary), A (own) | preview included for O/T |
| approvals.request | POST /v1/approvals | A, Chief, system | `{runId, agentId, class, structured, nodeExecutionId?}`; idempotency key required; dedupes by hash |
| approvals.decide | POST /v1/approvals/{id}/decision | O, T | `{decision:'approve'\|'deny', note?}` only; no scope field |
| approvals.cancel | POST /v1/approvals/{id}/cancel | A (own) , O | |
1. `structured` is validated per `ActionClass` (PERM013 params schemas); free text fields bounded; the response never echoes agent text into `summary`.
2. Telegram summary projection: no absolute paths outside `~`, preview bodies truncated to 300 chars, no commit author emails.
3. Decide from `A`/Chief returns 403 `perm.owner_required` plus a violation; a second decision returns 409 `perm.approval_not_pending`; expired 410 `perm.approval_expired`.
4. Poll support for Agents: `GET /v1/approvals/{id}` returns `{status}` quickly; long-poll is not offered (the Run is notified by event instead).
5. Request schemas `.strict()`; declared errors listed per route.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Use cases PERM014, projections shared with PERM028 view helpers in `packages/gateway/src/routes/perm/_views.ts` (owned by PERM027; PERM028 imports it).

## 8. Architecture and code placement

One route file per row; thin handlers.

## 9. Security and safety

Agents see only their Run; decisions only by Owner transports; channel from transport; Telegram gets reduced views; request flooding handled by limits in PERM014 and the gateway rate limiter; no preview content in logs.

## 10. Errors and edge cases

Unknown or foreign id: `perm.not_found` (identical response); body with extra field `channel`: validation error; decision after Run end: `perm.approval_not_pending`.

## 11. Acceptance criteria

- [ ] Agent decide attempt: 403, violation logged.
- [ ] Telegram decide works and stores `by: owner_telegram`.
- [ ] Body containing `scope` or `channel` is rejected.
- [ ] Telegram list view has no `details` beyond summary and no foreign absolute paths.
- [ ] Authorisation matrix test passes.

## 12. Test plan

Route tests per principal, projection tests, matrix test. `pnpm vitest run packages/gateway/src/routes/perm/approval`.

## 13. Parallelization notes

Parallel with PERM028. Defines `_views.ts` shared helper.

## 14. Open questions and assumptions

- ASSUMPTION: no long-poll for Agents.
