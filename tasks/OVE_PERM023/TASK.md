---
id: OVE_PERM023
title: Expose the audit query API (gateway routes, filters, pagination, channel-limited views)
area: PERM
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ENGINE012, OVE_ENGINE019, OVE_PERM008, OVE_PERM020, OVE_PERM022]
soft_depends_on: []
provides: ["api:audit.events.list", "api:audit.events.get", "api:audit.verify", "api:audit.export", "usecase:QueryAudit", "lib:api-client-audit"]
needs: ["lib:route-module", "lib:gateway-auth", "lib:api-client-core"]
owns: ["packages/application/src/audit/query-audit.ts", "packages/contracts/src/audit/query.ts", "packages/gateway/src/routes/audit/**", "packages/api-client/src/audit/**"]
reads: ["packages/application/src/ports/AuditLog.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 11"]
adr_refs: [3, 6]
---

# OVE_PERM023: Expose the audit query API

## 1. Summary

Read access to the audit log for the Owner (Activity, violations view, approvals history) with typed filters, cursor pagination and a reduced view for Telegram. Agents have no access.

## 2. Context

SPEC 15: Activity shows who, when, what, with what result. The violations log is a filter (`category=violation`). The store is append-only; this API is read-only except triggering verify/export, which delegate to PERM022.

## 3. Scope (in)

`QueryAudit` use case, routes, api-client module, view projections per principal.

## 4. Out of scope

UI (RUNUI/APPRUI), store (PERM020), verify/export logic (PERM022).

## 5. Detailed requirements

1. `GET /v1/audit/events?category=&action=&result=&actorKind=&workspaceId=&runId=&agentId=&severity=&from=&to=&cursor=&limit=` (limit 1..200, default 50; ordered by `seq` desc; cursor = opaque base64 of `seq`; all filters typed and bound, no free-text search or SQL fragments). `GET /v1/audit/events/{id}`. `POST /v1/audit/verify` (runs `VerifyAuditChain`, scope owner desktop). `POST /v1/audit/exports` body `{filter, folderId?}` (owner desktop). Request schemas `.strict()`.
2. Scopes: `owner` for all. `channel:telegram` only `GET /events` with a forced projection: categories `approval|access|pause|violation` of the last 7 days, no `details`, `target.display` Workspace-relative only, max 20 rows. Agents: no route (scope omitted, SEC005 matrix denies); an agent token gets 403 and a violation.
3. Response event view `AuditEventView = AuditEvent minus {prevHash, hash, keyId}` plus `i18nKey: 'audit:<action>'`; a separate `includeProof=true` flag (owner only) returns hashes.
4. Time range max 366 days per query; `from`/`to` ISO; unknown filter values return an empty page, not an error; invalid format `validation.invalid_input`.
5. Unknown ids: `perm.not_found`.
6. Rate limit 20 req/s per session. Queries are read-only and use an index (tests assert the query plan uses an index for each filter combination via `EXPLAIN QUERY PLAN` in the adapter test).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AuditLog.iterate/readRange/count`, `authorize` (PERM008), route helpers (ARCH009), api-client generator (ARCH008).

## 8. Architecture and code placement

Use case in `packages/application/src/audit/`, routes in `packages/gateway/src/routes/audit/{list,get,verify,export}.route.ts`, contracts in `packages/contracts/src/audit/query.ts`.

## 9. Security and safety

Read minimisation by principal; Telegram sees summaries only; no free text search (no injection, no content oracle); events never contain secrets by construction (PERM021) and the view drops hashes by default; responses are paginated and bounded to avoid dumping history through a hijacked channel.

## 10. Errors and edge cases

Empty log returns empty page; cursor from another filter set is ignored safely (cursor holds only `seq`); `to` before `from` returns validation error.

## 11. Acceptance criteria

- [ ] Agent token on every audit route is rejected and a violation is logged.
- [ ] Telegram view contains no `details` and no host paths.
- [ ] Each filter combination uses an index (plan test).
- [ ] Pagination is stable under concurrent appends.
- [ ] Verify/export routes reject non-desktop Owners.

## 12. Test plan

Route tests with each principal, adapter query-plan tests, pagination tests. `pnpm vitest run packages/gateway/src/routes/audit packages/application/src/audit`.

## 13. Parallelization notes

Parallel with PERM022. Authorisation matrix test of SEC005 picks up the routes automatically.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram gets a 7-day, 20-row summary only.
