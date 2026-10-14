---
id: OVE_PERM026
title: Add gateway routes for policies, profiles, overrides, effective permissions and checks
area: PERM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ENGINE012, OVE_ENGINE019, OVE_PERM009, OVE_PERM010, OVE_PERM011, OVE_PERM012]
soft_depends_on: []
provides: ["api:perm.policies", "api:perm.profiles", "api:perm.overrides", "api:perm.effective", "api:perm.check", "lib:api-client-perm"]
needs: ["lib:route-module", "lib:gateway-auth", "lib:api-client-core"]
owns: ["packages/gateway/src/routes/perm/policy-*.route.ts", "packages/gateway/src/routes/perm/profile-*.route.ts", "packages/gateway/src/routes/perm/override-*.route.ts", "packages/gateway/src/routes/perm/effective.route.ts", "packages/gateway/src/routes/perm/check.route.ts", "packages/contracts/src/perm/routes/policies.ts", "packages/api-client/src/perm/policies.ts"]
reads: ["packages/application/src/perm/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.10"]
adr_refs: [3, 6, 21]
---

# OVE_PERM026: Add gateway routes for policies, profiles, overrides and checks

## 1. Summary

The HTTP-like API (over the owner-only Unix socket) for permission administration and for the agent-facing "can I?" query. Every route is a thin adapter: validate, map the authenticated caller to a `Principal`, call a use case, map the `Result`.

## 2. Context

Route modules are auto-registered (ARCH009); contracts first (ARCH008); scopes enforced before handlers (SEC005 G7). Widening routes carry `localProof` in the body and are Owner-desktop only.

## 3. Scope (in)

Routes, request/response contracts, api-client methods, error declarations.

## 4. Out of scope

Use case logic (PERM010..012), approvals (PERM027), access requests (PERM028), UI.

## 5. Detailed requirements

All request bodies `.strict()`; none contains `principal`, `channel` or `local` fields. Scope column: O = owner (desktop), A = agent, T = channel:telegram (never for these routes).
| id | method path | scope | notes |
|---|---|---|---|
| perm.policy.get | GET /v1/permissions/policies/{id} | O | |
| perm.policy.list | GET /v1/permissions/policies?scope=&subjectId= | O | |
| perm.policy.directory.add | POST /v1/permissions/policies/{id}/directories | O + localProof | body `{rawPath, rights, primary?, label?, expectedVersion, localProof:{confirmationId}}` |
| perm.policy.directory.remove | DELETE /v1/permissions/policies/{id}/directories/{dirId}?expectedVersion=&acknowledgeActiveRuns= | O | narrowing, no proof |
| perm.policy.directory.update | PATCH /v1/permissions/policies/{id}/directories/{dirId} | O (+ proof if widening) | body `{rights?, primary?, label?, expectedVersion, localProof?}` |
| perm.policy.capabilities.set | PUT /v1/permissions/policies/{id}/capabilities | O (+ proof if widening) | |
| perm.profile.list/get/create/update/delete/duplicate | /v1/permissions/profiles[...] | O (+ proof if widening) | built-ins immutable |
| perm.override.list | GET /v1/permissions/approval-overrides?workspaceId= | O | |
| perm.override.lift | PUT /v1/permissions/approval-overrides/{actionClass} | O + localProof | body `{workspaceId|null, ownerRuleId?, localProof}` |
| perm.override.restore | DELETE /v1/permissions/approval-overrides/{id} | O | |
| perm.effective.preview | GET /v1/permissions/effective?workspaceId=&agentId=&workflowId= | O | EffectivePermissions + explain |
| perm.check | POST /v1/permissions/check | A (own Run) | body `{action}` raw path allowed; returns `AccessDecision` with `requestable`; never returns other layers' data, only reason code |
1. Responses carry the new `version`; `409 perm.policy_conflict` on stale versions.
2. Declared errors per route: `perm.local_approval_required`, `perm.owner_required`, `perm.policy_conflict`, `perm.not_found`, `perm.profile_builtin_immutable`, `perm.profile_in_use`, `perm.override_not_allowed`, `perm.invalid_policy`, `gateway.unauthenticated`, `gateway.forbidden_scope`.
3. `perm.check` is rate limited (60/min per Run) and records violations for denials via `CheckAccess`; the Agent gets `{verdict, reason, requestable}` and a hint key, no policy contents.
4. Agent tokens on Owner routes return 403 (and a violation `agent_scope_violation`); another Agent's ids return `perm.not_found`.
5. The route registry test (SEC005 authorisation matrix) runs against these routes; a test asserts every widening route declares `localProof` and every narrowing route does not.
6. Idempotency: `key-required` for POST directory add; `natural` for PUT/DELETE.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineRoute`/`defineRouteModule`, use cases, error mapping (ARCH003), api-client generator.

## 8. Architecture and code placement

One `*.route.ts` per row under `packages/gateway/src/routes/perm/`; contracts in `packages/contracts/src/perm/routes/`. Handlers hold no logic.

## 9. Security and safety

Strict schemas reject forged channel fields; scope checks precede handlers; widening requires the proof; responses reveal no other-layer detail to Agents; `perm.check` cannot be used to enumerate host paths (reason codes only, paths shown relative to the Workspace).

## 10. Errors and edge cases

Missing proof on a widening PATCH: `perm.local_approval_required`. Mixed diff (widen+narrow): treated as widening. Unknown policy id: `perm.not_found`. Oversized body: gateway limit.

## 11. Acceptance criteria

- [ ] Every row exists with contract, scope and declared errors.
- [ ] Telegram and Agent callers are rejected on all Owner routes.
- [ ] Widening without proof fails; narrowing without proof works.
- [ ] `perm.check` for another Run returns `perm.not_found`.
- [ ] Contract check and snapshot pass.

## 12. Test plan

Route tests through the gateway harness per principal; matrix test; contract snapshot. `pnpm vitest run packages/gateway/src/routes/perm`.

## 13. Parallelization notes

Parallel with PERM027/028 (different files). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: `perm.check` is the only permission route available to Agents (via the overmind Skill).
