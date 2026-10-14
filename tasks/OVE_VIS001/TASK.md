---
id: OVE_VIS001
title: Define the Visibility contract, defaults and VIS error codes
area: VIS
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH008]
soft_depends_on: []
provides: ["contract:Visibility", "contract:VisibilityFields", "contract:VisibleEntityKind", "lib:vis-errors"]
needs: []
owns: ["packages/contracts/src/visibility/visibility.ts", "packages/contracts/src/visibility/entity-kind.ts", "packages/contracts/src/errors/vis.errors.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 2", "SPECIFICATION 4", "SPECIFICATION 8", "SPECIFICATION 16.3"]
adr_refs: [28, 14, 3]
---

# OVE_VIS001: Define the Visibility contract, defaults and VIS error codes

## 1. Summary

The shared shape of Visibility used by Agents, Skills and Workflows: `visibility: 'public' | 'private'` plus `ownerWorkspaceId`, a reusable zod fragment with the cross-field rule, and the VIS error catalogue.

## 2. Context

ADR 0028: persistent Agents, Skills and Workflows are Public (usable in all Workspaces) or Private (exist only in the Workspace they were created in). AGENT001 already expects `contract:Visibility` with `ownerWorkspaceId` required iff private and forbidden when public.

## 3. Scope (in)

`Visibility` enum, `VisibilityFields` zod fragment (spread into entity schemas via `.merge` or `withVisibility()` helper), `VisibleEntityKind = 'agent'|'skill'|'workflow'`, error codes, JSON Schema snapshot.

## 4. Out of scope

Rules (VIS002), query helper (VIS003), entity schemas (AGENT/SKILL/WFRT).

## 5. Detailed requirements

1. `Visibility = z.enum(['public','private'])`.
2. `VisibilityFields = { visibility: Visibility, ownerWorkspaceId?: EntityId<'ws'> }` with refinement: `private` requires `ownerWorkspaceId`; `public` forbids it. Exported as a function `withVisibility(shape)` returning a refined object schema, and as a plain refinement `refineVisibility` for entities that need a custom object.
3. `VisibleEntityKind` enum and a `VisibleRef = { kind, id }` type.
4. Errors (`vis.*`, strict details, `telegramSafe: true`): `forbidden_actor` (403), `isolated_workspace_forces_private` (409), `used_elsewhere` (409, details `{ usageCount, workspaceCount }` only), `no_common_workspace` (422), `invalid_owner_workspace` (422), `version_conflict` (409), `already_in_state` (200-style no-op code, not an error in routes), `not_visible` (404, same body as not found), `dynamic_agent_private_only` (409), `proposal_not_pending` (409), `proposal_limit` (429).
5. Contract snapshot committed; additive-only afterwards.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EntityId<'ws'>`, `defineErrors`, contract pipeline. Area entities MUST import this fragment instead of redefining the pair.

## 8. Architecture and code placement

`packages/contracts/src/visibility/*.ts`, `packages/contracts/src/errors/vis.errors.ts`. No dependency on other entities.

## 9. Security and safety

The refinement makes "private without owner" and "public with owner" unrepresentable, so a missing owner can never mean "visible everywhere". `not_visible` is indistinguishable from not found, preventing enumeration of other Workspaces' private items. Visibility carries no permission semantics (SR-32).

## 10. Errors and edge cases

`visibility:'private'` with a malformed workspace id: invalid. Unknown visibility value (`'shared'`): invalid.

## 11. Acceptance criteria

- [ ] The four invalid combinations are rejected, the two valid ones accepted.
- [ ] Error codes registered with `http`, `messageKey`, `detailsSchema`.
- [ ] Snapshot committed; AGENT001 can import `Visibility` and `withVisibility`.

## 12. Test plan

Schema table tests, registry tests. `pnpm vitest run packages/contracts/src/visibility`.

## 13. Parallelization notes

Unblocks AGENT, SKILL, WFRT contracts; merge first in VIS.

## 14. Open questions and assumptions

- ASSUMPTION: `ownerWorkspaceId` is absent (not null) for public items, as AGENT001 specifies.
