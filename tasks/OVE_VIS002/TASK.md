---
id: OVE_VIS002
title: Implement the pure Visibility domain rules (defaults, isolation, transitions, authority)
area: VIS
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_VIS001, OVE_ARCH003]
soft_depends_on: [OVE_PERM008]
provides: ["lib:visibility-rules"]
needs: []
owns: ["packages/domain/src/visibility/rules/**"]
reads: ["packages/contracts/src/visibility/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 2", "SPECIFICATION 4", "SPECIFICATION 8", "SPECIFICATION 16.3"]
adr_refs: [28, 3, 14]
---

# OVE_VIS002: Implement the pure Visibility domain rules

## 1. Summary

All Visibility decisions that need no I/O, in one pure module used by AGENT, SKILL and WFRT: default visibility at creation, the isolated-Workspace rule, who may change visibility, and whether a transition is legal given the facts supplied by the caller.

## 2. Context

ADR 0028 rules: Owner-created persistent Agent and Skill default Public; Dynamic Agent, Chief-proposed Skill and new Workflow default Private; only the Owner changes visibility (Chief may propose); an isolated Workspace forces Private for everything created in it (it may still use Public items of others); visibility does not change permissions (ADR 0003) or memory boundaries (ADR 0014).

## 3. Scope (in)

`defaultVisibility(input)`, `validateCreationVisibility`, `evaluateVisibilityChange(input)` returning a verdict, `canActorChangeVisibility`, and the helper `describeVisibility` for audit.

## 4. Out of scope

Usage lookup (VIS005 port), persistence and versioning (area use cases), proposals (VIS007), SQL (VIS003).

## 5. Detailed requirements

1. `defaultVisibility({ kind, createdBy: 'owner'|'chief', lifecycle?: 'persistent'|'dynamic', workspace: { id, isolated }, origin?: 'owner'|'chief'|'import' })`: Agent persistent by owner: public; Agent dynamic: private(ws); Skill by owner (incl. import added by Owner): public; Skill by chief: private(ws); Workflow (any creator): private(ws); inside an isolated Workspace: private(ws) always. Returns `VisibilityFields`.
2. `validateCreationVisibility(requested, ctx)`: isolated Workspace and requested public: `vis.isolated_workspace_forces_private`; Dynamic Agent requested public: `vis.dynamic_agent_private_only`; private without a Workspace: `vis.invalid_owner_workspace`.
3. `evaluateVisibilityChange({ actor: Principal-like { kind:'owner', channel:'desktop' } | other, entity: { kind, id, visibility, ownerWorkspaceId, lifecycle?, configVersion }, to: { visibility, ownerWorkspaceId? }, workspaces: lookup of { id, isolated } for the owner/target Workspace, usage: UsageReport, expectedVersion })` returns `Ok({ change: 'noop'|'publish'|'unpublish'|'move_private', needsNewConfigVersion: boolean })` or `Err`:
   - actor not Owner on the desktop: `vis.forbidden_actor` (Chief, agents, Telegram, system all refused; Chief uses VIS007 proposals);
   - same target state: `noop` (idempotent, no new version);
   - private -> public: refused if the item's Workspace is isolated (`isolated_workspace_forces_private`) or the entity is a Dynamic Agent (`dynamic_agent_private_only`);
   - public -> private: requires `ownerWorkspaceId`, which must exist and not be a forbidden target; usage in Workspaces other than the target owner Workspace must be empty else `vis.used_elsewhere` (details: counts only); usage unknown/unavailable: `Err(internal.dependency_unavailable)` (fail closed);
   - private(ws A) -> private(ws B) (moving) is **not allowed** in MVP (`vis.invalid_owner_workspace`): publish then re-privatise instead; reason: moving would silently change which Workspace sees it.
   - stale `expectedVersion`: `vis.version_conflict`.
4. Memory and permissions: the module exports `VISIBILITY_AFFECTS = { memory: false, permissions: false } as const` and an exported doc comment; `evaluateVisibilityChange` has no input or output field touching memory or permissions (type-level test).
5. All functions are pure and total; no clock, ids or I/O.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Visibility*` contracts (VIS001), `Result`/errors (ARCH003). AGENT002 imports this module (`needs: lib:visibility-rules`); they must not copy rules.

## 8. Architecture and code placement

`packages/domain/src/visibility/rules/{defaults.ts,change.ts,authority.ts}`; one file per concern.

## 9. Security and safety

Visibility controls cross-Workspace data exposure (client-specific items must stay in their Workspace). Controls: only the desktop Owner changes it; isolated Workspaces cannot publish; unknown usage blocks the change; no moving between private Workspaces; errors reveal counts, never names of other Workspaces' items. Visibility never grants tools or paths (SR-32).

## 10. Errors and edge cases

- Chief proposes then Owner approves: Owner executes the change through the normal path.
- Archived entity: area use case refuses before calling.
- Publishing a private Skill assigned to a private Agent of the same Workspace: allowed (assignment stays valid).
- Making a Skill private while a public Agent in another Workspace has it assigned **and** that Agent is used there: usage report non-empty, blocked.

## 11. Acceptance criteria

- [ ] Default table (kind x creator x lifecycle x isolated) matches ADR 0028 in a 20-row test.
- [ ] Every refusal in requirement 3 has a test, including Telegram and Chief actors.
- [ ] Moving private between Workspaces is refused.
- [ ] Property: for any inputs, the result is `Ok` only if the target state is legal under invariants (public implies not isolated and not dynamic; private implies owner set).
- [ ] Type-level test shows no memory/permission fields.

## 12. Test plan

Table tests, fast-check invariants. `pnpm vitest run packages/domain/src/visibility/rules`.

## 13. Parallelization notes

Unblocks AGENT002/006 and SKILL/WFRT equivalents. Parallel with VIS003.

## 14. Open questions and assumptions

- ASSUMPTION: no direct move between Workspaces for private items (publish then privatise).
- ASSUMPTION: visibility changes are desktop-Owner only, not from Telegram (not a permission change, but data exposure).
