---
id: OVE_VIS008
title: Add gateway routes for the visibility impact report and proposals
area: VIS
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ENGINE012, OVE_ENGINE019, OVE_VIS005, OVE_VIS006, OVE_VIS007]
soft_depends_on: []
provides: ["api:visibility.impact", "api:visibility.proposals.list", "api:visibility.proposals.decide", "api:visibility.proposals.create", "lib:api-client-visibility"]
needs: ["lib:route-module", "lib:gateway-auth", "lib:api-client-core"]
owns: ["packages/gateway/src/routes/vis/**", "packages/contracts/src/visibility/routes.ts", "packages/api-client/src/vis/**"]
reads: ["packages/application/src/visibility/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 16.3"]
adr_refs: [28, 3]
---

# OVE_VIS008: Add gateway routes for the visibility impact report and proposals

## 1. Summary

The gateway side of Visibility: a read-only dry-run endpoint that returns the "used elsewhere" blocking report before the Owner tries to make an item Private, and the proposal routes. Mutation endpoints remain in the owning areas (agents, skills, workflows) and return the shared blocked-body contract.

## 2. Context

The UI (AGUI, SKUI, WFED) shows a radio card PUBLIC/PRIVATE; before switching to Private it asks what would block. ADR 0028: blocked until removed elsewhere, so the report lists where.

## 3. Scope (in)

Routes, contracts (`VisibilityImpactResponse`, `VisibilityBlockedBody` is from VIS006), api-client.

## 4. Out of scope

Per-area mutation routes (AGENT006 `PATCH /v1/agents/{id}/visibility`, SKILL, WFRT equivalents), UI.

## 5. Detailed requirements

| id | method path | scope | notes |
|---|---|---|---|
| visibility.impact | GET /v1/visibility/{kind}/{id}/impact?to=private&ownerWorkspaceId= | owner | dry-run; returns `{ allowed, reasons[], blockers: UsageReport }`; read-only |
| visibility.proposals.list | GET /v1/visibility/proposals?status= | owner, channel:telegram (view only) | |
| visibility.proposals.create | POST /v1/visibility/proposals | chief (in-process principal) | `{kind,id,rationale,evidence}`; not exposed to agent tokens |
| visibility.proposals.decide | POST /v1/visibility/proposals/{id}/decision | owner desktop | `{decision:'accept'\|'reject'}` |
1. `kind` path parameter is the enum `agent|skill|workflow`; unknown kind 404. Unknown id or an id not visible to the Owner management scope: `vis.not_visible` (same body as not found).
2. The impact response includes Workspace names and referrer names (Owner-only) and counts; truncated at 200 usages.
3. Impact for `to=public` returns `allowed` according to VIS002 (isolated or dynamic refusals) with no usage query.
4. Agent tokens never reach these routes (scope omitted); Telegram can only list proposals with a reduced view (ids, kind, name, rationale excerpt 100 chars).
5. Shared error body: area mutation routes return `409 vis.used_elsewhere` with `VisibilityBlockedBody = { error, details: { usageCount, workspaceCount }, impactUrl }` for non-Owner callers or the full `UsageReport` for the Owner; the contract and a helper `toBlockedResponse` live here/VIS006 so all areas respond identically.
6. `.strict()` request schemas; no `principal`/`channel` fields.
7. Rate limit 30 req/min for impact (usage queries can be heavy), result cached 5 s per (ref, to) and invalidated on `visibility.changed`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ComputeVisibilityImpact` (VIS005), proposals use cases (VIS007), route helpers, api-client generator.

## 8. Architecture and code placement

`packages/gateway/src/routes/vis/*.route.ts` one per row.

## 9. Security and safety

Owner-only reads; the report may contain names of items in other Workspaces, which is acceptable because the Owner already sees everything via owner management scope, but it is never sent to Telegram or Agents; unknown and invisible ids look the same; rate limited; no mutation here.

## 10. Errors and edge cases

Provider outage: `internal.dependency_unavailable` (not "allowed"); impact for a private item viewed from the owner management scope: fine.

## 11. Acceptance criteria

- [ ] Agent and Telegram callers cannot call impact or decide proposals.
- [ ] Impact returns blockers for a Public Agent used in another Workspace's workflow, and empty blockers when only the owner Workspace uses it.
- [ ] Provider failure never yields `allowed: true`.
- [ ] Chief create works in-process only.
- [ ] Authorisation matrix test passes.

## 12. Test plan

Route tests per principal with fake providers. `pnpm vitest run packages/gateway/src/routes/vis`.

## 13. Parallelization notes

Parallel with VIS007 once VIS006 contracts merge.

## 14. Open questions and assumptions

- Flag: AGENT006 defines `PATCH /v1/agents/{id}/visibility`; this plan keeps per-area mutation routes. A unified route is not provided unless the Owner asks.
