---
id: OVE_PERM011
title: Implement policy and profile administration use cases with built-in profiles
area: PERM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_PERM002, OVE_PERM004, OVE_PERM005, OVE_PERM008, OVE_PERM009, OVE_PERM020, OVE_SEC002]
soft_depends_on: [OVE_PERM024]
provides: ["usecase:PermissionPolicyAdmin", "lib:builtin-profiles", "lib:policy-diff", "port:PolicyRepository", "port:PermissionProfileReader", "event:policy.changed"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "usecase:RequireLocalProof", "lib:path-guard"]
owns: ["packages/application/src/perm/policy-admin/**", "packages/domain/src/perm/policy-diff/**", "packages/domain/src/perm/builtin-profiles.ts", "packages/application/src/ports/PolicyRepository.ts", "packages/application/src/ports/PermissionProfileReader.ts", "packages/contracts/src/events/policy-changed.event.ts", "packages/contracts/src/events/profile-changed.event.ts"]
reads: ["packages/contracts/src/perm/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1", "SPECIFICATION 16.10"]
adr_refs: [3, 6, 20]
---

# OVE_PERM011: Implement policy and profile administration use cases

## 1. Summary

The use cases that create and change Permission Policies and Permission Profiles: add/remove Allowed Directories, change rights and capabilities, assign a profile to an Agent layer, duplicate and edit named profiles. A pure diff classifies every edit as narrowing or widening so that widening requires a Local Approval proof and narrowing does not. Built-in profiles (Development, Read Only) are defined here.

## 2. Context

ADR 0003: the Owner is the only source of permissions. SR-25: new Allowed Directory, lifting an approval requirement and Owner Rule edits happen only with Local Approval on the desktop. Narrowing is safe and may happen quickly (also useful in emergencies). SPEC 16.1: the wizard requires a folder. Agents reference a profile (`permissionProfileId`, AGENT001); the Agent layer policy is derived from it.

## 3. Scope (in)

- Use cases: `CreateWorkspacePolicy` (first folder from the wizard), `AddAllowedDirectory`, `RemoveAllowedDirectory`, `ChangeDirectoryRights`, `SetPrimaryDirectory`, `SetPolicyCapabilities`, `AssignProfile`, `CreateProfile`, `DuplicateProfile`, `UpdateProfile`, `DeleteProfile`, `GetPolicy`, `ListProfiles`, `PreviewEffective` (read).
- `diffPolicies(before, after): PolicyDiff` with `classification: 'narrowing'|'widening'|'neutral'|'mixed'`.
- Built-in profiles and their seeding function.
- Ports `PolicyRepository` (CRUD with optimistic version), `PermissionProfileReader` (read-only: `exists`, `get`, `list`), events.

## 4. Out of scope

Persistence implementation (`OVE_PERM024`), routes (`OVE_PERM026`), UI (WSPACE, APPRUI, AGUI), approval overrides (`OVE_PERM012`), permanent grants originating from Access Requests (`OVE_PERM016` calls `AddAllowedDirectory` as a system-initiated variant with its own proof check).

## 5. Detailed requirements

1. **Widening classification** (`diffPolicies`): widening if any of: a directory entry added; any entry gains a right; `maxRights` increases; any capability field moves toward permissive (`deny`→`allow`, list gains an element, allowlist gains a host, `inherit` replaces a concrete restriction); scope `unrestricted` replaces `list`. Narrowing: only the opposite moves. `mixed` = both; `mixed` is treated as widening. Computed with the same `isNarrowerOrEqual` helpers as PERM004/005 (DRY), plus a property test: `classify(a→b) = narrowing` implies `effective(b) ⊆ effective(a)` for any other layers.
2. **Authorisation:** every command first calls `authorize(principal, operation)`. `policy.narrow` needs an Owner principal (desktop or other); `policy.widen` and `profile.edit` classified widening need `RequireLocalProof` with the exact arguments `{ policyId, expectedVersion, patchHash }` (the proof binds the diff, not the whole policy). Telegram, agents and Chief always fail (`perm.local_approval_required` / `perm.owner_required`).
3. **AddAllowedDirectory**: `{ workspaceId, rawPath, rights, primary?, label?, expectedVersion, localProof }`; canonicalisation through `registerAllowedDirectory` (PERM002); on success: new policy version, event `policy.changed` (with `affectedWorkspaceId`, `widened: true`), audit `perm.policy.directory_added` (target = display path), and `MountPlanApplier` notification is **not** done here: the engine's `PolicyChangedHandler` (PERM017) reacts to the event to update running sandboxes.
4. **RemoveAllowedDirectory / narrowing changes:** no proof, immediate; event `policy.changed { widened: false }` which PERM017 uses to **remove** mounts from running environments (ADR 0020 symmetry) and which BOX/WFRT use to stop Agents that now lack the working directory (primary removal while Runs are active: the Owner gets a confirmation list of active Runs; the API returns `activeRuns` and requires `acknowledgeActiveRuns: true`).
5. **First-run:** `CreateWorkspacePolicy` for a new Workspace requires one directory (`SPEC 16.1`): creating a Workspace without a directory is allowed (it is simply inert, all checks deny) but the wizard use case (ONB) calls this use case with the folder; there is no default folder and no auto-detected folder.
6. **Profiles:** built-in `Development` = `maxRights [read,write,execute]`, `terminal allow`, `git {local allow, remote allow}`, `network allowlist` of provider hosts only (the list is a config constant in `builtin-profiles.ts` shared with PROV: `api.anthropic.com`, `*.anthropic.com`, `api.openai.com`, `chatgpt.com`, `*.openai.com`; ASSUMPTION, PROV owns the final list and this file imports it from `lib:provider-hosts` when it exists), `mcp none`, `tools inherit`. Built-in `Read Only` = `maxRights [read]`, `terminal deny`, `git {local deny, remote deny}`, `network deny`, `mcp none`, `tools inherit`. Built-in profiles are immutable (`perm.profile_builtin_immutable`); Owner duplicates them to edit. A profile in use by any Agent cannot be deleted (`perm.profile_in_use`, uses a `ProfileUsageReader` implemented by AGENT through `PermissionProfileReader.usageCount`).
7. **Profile edits** propagate: a widening profile edit (for instance adding `terminal allow`) requires the local proof because it widens every Agent using it; the confirmation modal lists the Agent count.
8. **Concurrency:** all updates carry `expectedVersion`; mismatch gives `perm.policy_conflict`. All writes in one `UnitOfWork` together with the event outbox entry.
9. **Idempotency:** re-adding an existing directory with identical rights is a no-op returning the current policy (no new version, no event).
10. **Preview:** `PreviewEffective({ workspaceId, agentId?, workflowId?, toolId? })` returns `EffectivePermissions` + `explain` for the UI "what can this Agent do here".
11. **Limits:** at most 64 directories per policy, 200 profiles total, names unique case-insensitively.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PERM002 (`registerAllowedDirectory`, `normalizeDirectoryList`), PERM004/005 (`isNarrowerOrEqual`, compose), PERM008 (`authorize`), PERM009 (`RequireLocalProof`), `AppendAudit`, `UnitOfWork`, `EventBus`.

## 8. Architecture and code placement

Use cases one file per command under `packages/application/src/perm/policy-admin/`; diff in `packages/domain/src/perm/policy-diff/`; built-ins in `packages/domain/src/perm/builtin-profiles.ts`; ports in `packages/application/src/ports/`. Use cases receive `Principal` and depend only on ports. OCP: a new editable policy field adds a diff rule module.

## 9. Security and safety

All widening paths funnel through one authorise-and-prove function (`requireWideningRights(principal, diff, proof)`) so no use case can forget it (DRY and a security invariant); a test enumerates every public use case of the module and asserts that each is either read-only, classified narrowing-only, or calls this function. Untrusted path input is canonicalised on the engine side. An Agent cannot change its own profile: AGENT's `AssignProfile` call from an agent principal is rejected here and the Agent configuration use case (AGENT) assigns a profile only through `PermissionProfileReader.exists`, never changing the profile's content. Events carry no paths in the clear beyond display paths. Failure to write the audit event aborts the change (audit and change are one transaction, or the change is refused with `perm.audit_unavailable`).

## 10. Errors and edge cases

- Widening attempt with a proof for a different diff (extra directory): `perm.local_approval_required` (mismatch).
- Removing the primary directory while Runs are active: needs acknowledgement; without it `409 perm.policy_conflict` with the active Run ids (max 10).
- Duplicate profile name "development " (trailing space/case): rejected as duplicate.
- Deleting a built-in profile: `perm.profile_builtin_immutable`.
- A policy edit that is neutral (reorder): no new version.
- Concurrent edits: second writer gets `perm.policy_conflict`.

## 11. Acceptance criteria

- [ ] Adding a directory from Telegram, an Agent, Chief or without a proof fails and writes a violation audit event.
- [ ] Adding a directory with a valid proof creates version+1, emits `policy.changed{widened:true}` and an audit event.
- [ ] Removing a directory needs no proof and emits `policy.changed{widened:false}`.
- [ ] `diffPolicies` classification matches the table in a 40-row test; the property "narrowing implies effective subset" passes.
- [ ] Built-in profiles are immutable and match requirement 6; `Read Only` effective permissions never contain `write`, `execute`, terminal or network.
- [ ] A profile in use cannot be deleted.

## 12. Test plan

Unit tests per use case with fakes; table test for diff; property test linking diff to effective subset (uses PERM005 arbitraries); transaction/atomicity test with a failing audit store; authorisation matrix test (all principal kinds x all use cases). `pnpm vitest run packages/application/src/perm/policy-admin packages/domain/src/perm/policy-diff`.

## 13. Parallelization notes

Parallel with PERM012, PERM013. Consumers: ONB/WSPACE/AGUI use cases through `PermissionPolicyAdmin`. Hotspot: `builtin-profiles.ts` (single owner here).

## 14. Open questions and assumptions

- ASSUMPTION: the provider host list lives in PROV; until it exists, `builtin-profiles.ts` carries a constant marked `// to be replaced by lib:provider-hosts`.
- Open: should `Development` include `git.remote: allow`? Default yes; pushes are still approval-gated.
- Open: removing the primary directory in an active Run stops the Run (default: acknowledged by the Owner, WFRT cancels affected Runs).
