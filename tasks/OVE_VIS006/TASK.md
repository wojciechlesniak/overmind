---
id: OVE_VIS006
title: Define the visibility change protocol and versioning contract for area use cases
area: VIS
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH006, OVE_ARCH010, OVE_DATA002, OVE_PERM020, OVE_VIS002, OVE_VIS005]
soft_depends_on: [OVE_PERM020]
provides: ["usecase:ApplyVisibilityChange", "port:VisibilityTargetAdapter", "event:visibility.changed", "contract:VisibilityChangeResult", "contract:VisibilityBlockedBody"]
needs: ["port:EventBus", "usecase:AppendAudit", "port:UnitOfWork", "lib:multi-token"]
owns: ["packages/application/src/visibility/apply-change.ts", "packages/application/src/ports/VisibilityTargetAdapter.ts", "packages/contracts/src/visibility/change.ts", "packages/contracts/src/events/visibility-changed.event.ts", "packages/contracts/src/audit/actions/vis.actions.ts"]
reads: ["packages/domain/src/visibility/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 16.3"]
adr_refs: [28, 2, 14, 3]
---

# OVE_VIS006: Define the visibility change protocol and versioning contract

## 1. Summary

A single orchestrating use case `ApplyVisibilityChange` that Agent, Skill and Workflow change endpoints call, so every kind follows the same sequence: authorise, evaluate rules, check usage, create a new configuration version through the area's adapter, emit the event and audit. Running Runs keep their pinned version.

## 2. Context

ADR 0028: a visibility change creates a new configuration version (ADR 0002 pinning). AGENT006 implements the Agent flavour; this task provides the shared protocol and adapter port so SKILL and WFRT do not diverge. Mutation routes stay in each area (for example `PATCH /v1/agents/{id}/visibility`); VIS008 provides the shared dry-run route and the response contracts.

## 3. Scope (in)

`ApplyVisibilityChange`, the `VisibilityTargetAdapter` port, `VisibilityChangeResult` and `VisibilityBlockedBody` contracts, event and audit actions.

## 4. Out of scope

Adapter implementations (AGENT/SKILL/WFRT), routes (areas + VIS008), proposals (VIS007).

## 5. Detailed requirements

1. `VisibilityTargetAdapter` (registered per kind via multi-token): `load(id): {visibility, ownerWorkspaceId, lifecycle?, configVersion, archived}`, `applyVisibility(id, to, expectedVersion): Promise<Result<{ newConfigVersion }>>` (creates a new version containing the changed fields only; Workflow creates a new WorkflowVersion copy with identical graph; previous versions untouched), `activeRunCount(id)`.
2. `ApplyVisibilityChange({ principal, ref, to, expectedVersion })`: (a) `authorize`: Owner desktop only, else `vis.forbidden_actor` plus a violation audit; (b) `load`, refuse archived; (c) `ComputeVisibilityImpact`; if blocked return `vis.used_elsewhere` with `VisibilityBlockedBody` (counts + the Owner-facing report only when the principal is the Owner); (d) in one `UnitOfWork`: `applyVisibility`, append audit `vis.visibility.changed` (details: kind, from, to, fromVersion, toVersion), outbox event `visibility.changed`; (e) return `{ newConfigVersion, runsKeepPinnedVersion: true, activeRuns }`.
3. Noop (already in the target state) returns the current version without a new version, event or audit write (an audit `vis.visibility.change_noop` is not written to avoid noise).
4. Refusals write an audit `vis.visibility.change_refused` with the reason code (not for noops).
5. Event `visibility.changed` payload: `{ kind, id, from, to, ownerWorkspaceId?, configVersion }`; subscribers: UI caches, Chief suggestion cache, repositories' read caches (must invalidate on this event), Telegram view caches.
6. The use case never touches memory or permission ports (dependency list asserted by a test: no `AgentMemory*` or `Permission*` port tokens injected).
7. Concurrency: `expectedVersion` mismatch gives `vis.version_conflict`; the adapter write is compare-and-set.
8. AGENT006 may keep its own wrapper but MUST call this use case rather than re-implementing the sequence (proposal note to AGENT: replace the inline logic with `ApplyVisibilityChange`; if AGENT006 is already implemented its logic is moved here with the same error codes mapped by AGENT).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Rules and impact (VIS002/005), `AppendAudit`, `EventBus`, `UnitOfWork`, multi-token (ARCH006).

## 8. Architecture and code placement

`packages/application/src/visibility/apply-change.ts`; port in `packages/application/src/ports/`; contracts under `packages/contracts/src/visibility/`. Area adapters live in the areas' folders.

## 9. Security and safety

One code path means one place to get authority, usage checks and audit right. Owner-only desktop, fail closed on usage errors, version CAS, atomic version+audit+event, no memory or permission side effects (SR-32, ADR 0014). The blocked body for non-Owner callers contains counts only.

## 10. Errors and edge cases

Adapter fails after impact check: transaction rolls back, no event. Item archived: `agent.archived`-style area error mapped. Concurrent change and workflow edit: whichever commits first wins; the loser gets version conflict.

## 11. Acceptance criteria

- [ ] Chief, agents, Telegram and `owner other` are refused and audited.
- [ ] Blocked change returns the report to the Owner and counts to others.
- [ ] Successful change creates exactly one new version, one audit event and one `visibility.changed` event.
- [ ] Noop writes nothing.
- [ ] Dependency-list test proves no memory or permission ports are injected.
- [ ] Running Run's pinned version is untouched (adapter fake asserts old version immutable).

## 12. Test plan

Use case tests with fake adapters for the three kinds, failure injection in the adapter and audit. `pnpm vitest run packages/application/src/visibility`.

## 13. Parallelization notes

AGENT006, SKILL and WFRT visibility tasks depend on this. Parallel with VIS007.

## 14. Open questions and assumptions

- ASSUMPTION: the Workflow adapter creates a new WorkflowVersion with identical graph for a visibility change (WFRT confirms).
- Open: mutation endpoint ownership stays in each area (flagged in the final report); VIS could ship a unified `PUT /v1/visibility/{kind}/{id}` later.
