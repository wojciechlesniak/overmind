---
id: OVE_DATA011
title: Workspace use cases (create, rename, update, isolation, get, list) and gateway routes
area: DATA
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH009, OVE_DATA002, OVE_DATA005, OVE_DATA010, OVE_ENGINE010, OVE_PERM031]
soft_depends_on: []
provides: ["usecase:CreateWorkspace", "usecase:RenameWorkspace", "usecase:UpdateWorkspace", "usecase:SetWorkspaceIsolation", "usecase:GetWorkspace", "usecase:ListWorkspaces", "api:workspaces.list", "api:workspaces.get", "api:workspaces.create", "api:workspaces.rename", "api:workspaces.update", "api:workspaces.set_isolation"]
needs: ["port:UnitOfWork", "port:EventStore", "port:Clock", "port:IdGenerator", "port:LocalApprovalGate", "lib:route-module", "lib:gateway-server"]
owns: ["packages/application/src/data/workspace/**", "packages/contracts/src/workspace/workspace.routes.ts", "packages/gateway/src/routes/data/workspaces-*.route.ts", "apps/engine/src/composition/modules/data.module.ts", "packages/api-client/src/data/workspaces.ts"]
reads: ["packages/application/src/ports/WorkspaceRepository.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 2", "SPECIFICATION 10", "SPECIFICATION 11"]
adr_refs: [3, 10, 21]
---

# OVE_DATA011: Workspace use cases and gateway routes

## 1. Summary

The application layer for Workspaces: create, rename, update description or budget, change isolation, get and list. Each is a gateway route and writes its domain event in the same transaction.

## 2. Context

Only the Owner creates Workspaces (wizard, Workspaces view). Chief, Agents and Telegram have no scope for these routes. Turning isolation OFF exposes Decisions to cross-Workspace search, which widens exposure, so it needs Local Approval (SR-25); turning it ON restricts and needs none.

## 3. Scope (in)

- Six use cases with `execute(input, caller)` returning `Result`.
- Route contracts, route modules, thin api-client wrappers.
- Composition module `data.module.ts` (sole owner; other DATA tasks add separate module files).

## 4. Out of scope

- Deletion: `OVE_DATA012`. Creating the Permission Policy: PERM reacts to `workspace.created` (or ONB orchestrates). UI: WSPACE.

## 5. Detailed requirements

1. `CreateWorkspace`: validate, build entity (`IdGenerator`, `Clock`, `version 1`, `status 'active'`); in `UnitOfWork.run`: `repo.insert` + append `workspace.created`. Caller kind must be `owner` (checked again in the use case, defence in depth).
2. `RenameWorkspace { id, name, expectedVersion }`: no-op when equal; else `update` + `workspace.renamed`.
3. `UpdateWorkspace { id, description?, budget?, expectedVersion }`: event `workspace.updated` listing changed field names only.
4. `SetWorkspaceIsolation { id, isolated, expectedVersion }`: OFF calls `LocalApprovalGate.require({ action: 'workspace.make_shared', target: id })` and proceeds only with a grant bound to that action and id; event `workspace.updated` with `changed: ['isolated']`, `audit: true`.
5. `GetWorkspace`, `ListWorkspaces` (keyset, default 50, max 200); `deleting` Workspaces are hidden.
6. Routes (all `scope: ['owner']`): `GET /v1/workspaces`, `GET /v1/workspaces/{id}`, `POST /v1/workspaces` (`idempotency: 'key-required'`), `POST /v1/workspaces/{id}/rename`, `PATCH /v1/workspaces/{id}`, `POST /v1/workspaces/{id}/isolation`. Declared errors: `data.workspace_name_taken`, `data.version_conflict`, `data.not_found`, `perm.local_approval_required`, `validation.invalid_input`.
7. `data.module.ts` via `defineModule` (ARCH006) requires repository, uow, event store, clock, ids, approval gate; provides the six use-case tokens.
8. api-client wrappers only call the generated route table (`client.call(route, input)`), no URLs by hand.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`UnitOfWork` (DATA002), `EventStore` (DATA005), `WorkspaceRepository` (DATA010), `defineRouteModule` (ARCH009). The zod request schema is the only input validation.

## 8. Architecture and code placement

Use cases `packages/application/src/data/workspace/*.usecase.ts` (no I/O). Routes `packages/gateway/src/routes/data/`. Module `apps/engine/src/composition/modules/data.module.ts`. Dependencies point inward only.

## 9. Security and safety

Owner-only scope at the gateway and in the use case. Isolation relaxation needs Local Approval (single use, replay-safe, Owner desktop session). Mutations are audited by persisted events in the same transaction. Names are untrusted text, stored as data.

## 10. Errors and edge cases

- Duplicate name: `data.workspace_name_taken`, no event.
- Same Idempotency-Key retried: one Workspace, same response.
- Approval denied: nothing changes.
- Rename during deletion: `data.not_found`.
- Two windows editing: `data.version_conflict`.

## 11. Acceptance criteria

- [ ] Workspace and `workspace.created` exist together or not at all.
- [ ] Every route returns 403 `gateway.forbidden_scope` for agent and Telegram callers (authorisation matrix).
- [ ] Isolation OFF without grant yields `perm.local_approval_required`.
- [ ] Double POST with one Idempotency-Key creates one Workspace.
- [ ] Routes pass `contracts:check` and appear in the generated client.

## 12. Test plan

Use-case tests with fakes (FakeClock, InMemory repos, fake gate); route tests via `createGatewayUnderTest` (ENGINE018). Commands: `pnpm vitest run packages/application/src/data packages/gateway/src/routes/data`.

## 13. Parallelization notes

`data.module.ts` is only edited here; later DATA tasks add `data-<topic>.module.ts` files.

## 14. Open questions and assumptions

- ASSUMPTION: relaxing isolation needs Local Approval; tightening does not.
- Open: whether creating the first Workspace also creates the policy synchronously; default eventual via event, ONB waits for `policyId`.
