---
id: OVE_AGENT002
title: Implement pure Agent domain rules (versioning, lifecycle, config validation)
area: AGENT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_PERM005, OVE_VIS002]
soft_depends_on: []
provides: ["lib:agent-rules"]
needs: ["lib:visibility-rules", "lib:effective-permissions"]
owns: ["packages/domain/src/agent/**"]
reads: ["packages/contracts/src/agent/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 11", "SPECIFICATION 16.3"]
adr_refs: [3, 7, 14, 28]
---

# OVE_AGENT002: Implement pure Agent domain rules (versioning, lifecycle, config validation)

## 1. Summary

Pure functions that decide whether an Agent configuration change is valid, what the next version is, which lifecycle transitions are legal and whether a delegated configuration only narrows permissions. No I/O: every later use case calls these rules.

## 2. Context

ADR 0028 and SPEC 4: each change creates a new version, runs pin the version, visibility changes version too. ADR 0003: delegation may only narrow. Lifecycle: a Dynamic Agent is created by Chief, private, and becomes persistent only through Owner acceptance (with its memory kept, ADR 0014). The domain package has no I/O (CONVENTIONS 6).

## 3. Scope (in)

- `nextVersion(current, patch, ctx): Result<AgentConfig, AppError>` (merge, validate, detect no-op).
- `diffConfig(a, b): ChangedField[]` for events and the Versions tab.
- Lifecycle state machine `transitionLifecycle`.
- `validateAgentConfig(config, refs)` where `refs` is a plain object of already-loaded facts (skills visible flags, profile existence, known tools) supplied by the caller.
- `assertNarrowing(parent, child)` helper used by Chief delegation (checks `tools`, `budget`, `timeoutSeconds` are not larger; permissions themselves are PERM).
- `canSeeAgent(agent, workspaceId)` visibility predicate delegating to VIS rules.

## 4. Out of scope

- Loading refs from repositories and persistence: `OVE_AGENT004`. Permission set arithmetic itself: PERM `lib:effective-permissions`. Skill assignment use case: `OVE_SKILL007`.

## 5. Detailed requirements

1. `nextVersion` MUST return `agent.invalid_config` when the merged config fails `AgentConfig` parsing, and `agent.version_conflict` is NOT produced here (it is a persistence concern, `OVE_AGENT004`). It returns `{ config, changedFields }` and a `noop: true` marker when `configHash` is unchanged so callers do not create empty versions.
2. Name uniqueness is NOT checked here (needs a repository); the function exposes `normaliseName(name)` (NFC, trim, collapse spaces, case-folded key) used for the uniqueness index. Names are unique per visibility scope: among public Agents globally, and among private Agents within one Workspace; a private name may equal a public one only if the caller passes `allowShadowing: false` (default) as false, i.e. the default is to forbid it to avoid ambiguity in `@mentions` (CHAT003).
3. Lifecycle transitions: `dynamic/active -> dynamic/proposed_for_keep` (Chief or system after task end), `proposed_for_keep -> persistent` (Owner only; `visibility` is chosen by the Owner in the same call, default stays `private`), `proposed_for_keep -> declined` (Owner), `declined -> archived` (system), `persistent -> archived` (Owner). Any other transition returns `agent.lifecycle_transition_invalid`. A `persistent` Agent can never become `dynamic`.
4. Visibility rules: `public -> private` requires `ownerWorkspaceId` supplied and `usedElsewhere === false` (a boolean fact computed by AGENT006), otherwise `agent.visibility_in_use`. `private -> public` allowed for the Owner only. In an isolated Workspace every new Agent is forced `private` and cannot become public (ADR 0028): rule `forcePrivateIfIsolated(ctx.workspace.isolated)`.
5. Dynamic Agents created by Chief: `visibility` MUST be `private` and `ownerWorkspaceId` set; `createdBy.kind` MUST be `chief`; `skills` MUST each be visible in that Workspace; the `permissionProfileId` MUST be one that Chief is allowed to reference (the caller passes `chiefAssignableProfileIds`, the domain only checks membership).
6. `validateAgentConfig` checks, given `refs`: every skill exists and is visible in the owner scope of the Agent (a private Skill on a public Agent is allowed but is flagged `scopedTo: workspaceId` in the result, ADR 0028 "works only in its own Workspace"); the profile exists; `tools` are known; `fallbackModel` differs from the primary (warning, not error); `timeoutSeconds >= budget.maxMinutesPerTask*60` is NOT required but a warning is returned when the timeout is shorter than the budget minutes.
7. `assertNarrowing(parent, child)`: for each numeric limit child <= parent; `tools` child enabled set subset of parent enabled set; returns the first violation with a field path. Anything not comparable fails closed.
8. All functions are total, deterministic, side-effect free and take `Clock`-free inputs (timestamps are passed in by callers).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AgentConfig` and errors (`OVE_AGENT001`), VIS rules for visibility predicates, `Result` helpers (ARCH003). Do not re-implement visibility arithmetic: call `lib:visibility-rules`.

## 8. Architecture and code placement

`packages/domain/src/agent/{next-version.ts,diff-config.ts,lifecycle.ts,validate-config.ts,narrowing.ts,names.ts,index.ts}`. Domain imports only `contracts`. Table-driven tests live beside the code.

## 9. Security and safety

Narrowing and force-private are security rules, so they fail closed: unknown fields in a comparison make the check fail. No rule here reads or widens permissions; `tools[]` and `skills[]` are never treated as grants. The domain never receives secrets.

## 10. Errors and edge cases

- Patch changes only `skills` order: treated as a change (order is significant for prompt assembly), `changedFields = ['skills']`.
- Patch removes the last Skill: allowed.
- A Dynamic Agent promoted while its Workspace has been deleted: caller supplies `workspace: null`, result `agent.not_found`-like error `agent.private_requires_workspace`.
- Name differing only by case or Unicode normalisation: same `normaliseName` key.

## 11. Acceptance criteria

- [ ] `nextVersion` returns `noop` for an unchanged patch and a new config plus `changedFields` otherwise.
- [ ] Every row of the lifecycle table in requirement 3 is tested, including all illegal transitions.
- [ ] `public -> private` is rejected while `usedElsewhere` is true and allowed otherwise.
- [ ] A Dynamic Agent config with `visibility: public` is rejected.
- [ ] `assertNarrowing` rejects a child with a larger timeout, an extra enabled tool, or an unknown limit.
- [ ] Forced-private rule applies in isolated Workspaces.

## 12. Test plan

Vitest table tests per function; property test: `diffConfig(a, nextVersion(a, p).config)` equals the keys of `p` that changed; fast-check test that `assertNarrowing(c, c)` is always ok. Command: `pnpm vitest run packages/domain/src/agent`.

## 13. Parallelization notes

Runs in parallel with `OVE_AGENT003` after AGENT001. Hotspot: none. The VIS capability can be stubbed with a local type until it lands.

## 14. Open questions and assumptions

- ASSUMPTION: private names may not shadow public names (default), to keep `@name` mentions unambiguous.
- ASSUMPTION: Chief-assignable profiles are a PERM list; Chief can only reference profiles equal or narrower than its own.
