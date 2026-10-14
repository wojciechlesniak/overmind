---
id: OVE_PERM010
title: Implement the PermissionService (checkAccess) application service and its ports
area: PERM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT016, OVE_AGENT018, OVE_ARCH004, OVE_ARCH006, OVE_ARCH007, OVE_PERM005, OVE_PERM006, OVE_PERM007, OVE_PERM008, OVE_PERM012, OVE_PERM018, OVE_PERM020, OVE_SEC002]
soft_depends_on: [OVE_PERM018, OVE_PERM020]
provides: ["usecase:CheckAccess", "port:PolicyReader", "port:RunContextReader", "port:PauseStateReader", "port:SandboxHealthReader", "usecase:ResolveEffectivePermissions"]
needs: ["lib:path-guard", "port:Clock", "port:Logger", "usecase:RecordViolation", "usecase:AppendAudit", "usecase:GetRunSummary", "usecase:GetAgentSummary", "port:ApprovalOverrideReader", "port:RunGrantRepository"]
owns: ["packages/application/src/perm/check-access.ts", "packages/application/src/perm/resolve-effective.ts", "packages/application/src/perm/policy-cache.ts", "packages/application/src/ports/PolicyReader.ts", "packages/application/src/ports/RunContextReader.ts", "packages/application/src/ports/PauseStateReader.ts", "packages/application/src/ports/SandboxHealthReader.ts", "apps/engine/src/composition/modules/perm-check.module.ts"]
reads: ["packages/domain/src/perm/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1", "SPECIFICATION 16.8", "SPECIFICATION 16.10", "SPECIFICATION 19.3"]
adr_refs: [3, 4, 20, 21]
---

# OVE_PERM010: Implement the PermissionService (checkAccess)

## 1. Summary

The one application entry point other areas call to ask "may this Agent do this in this Run?": `checkAccess(agent, run, action)`. It gathers the five policy layers, the Workspace, the Run grants, the pause and sandbox state, canonicalises paths through `PathGuard`, calls the pure `evaluateAccess` and records every deny (violation) and every approval-relevant decision (audit).

## 2. Context

Callers: the Tool Broker (host-side tools), the workflow runtime before starting an Agent (can the Run start at all? empty list means no), the mount planner (`OVE_PERM017`), the overmind Skill "can I?" route (`OVE_PERM026`), and Chief planning. The sandbox mounts are the actual wall for file access; this service protects everything that is decided on the host side and ensures mounts are derived from the same effective set.

## 3. Scope (in)

- `CheckAccess` use case and `ResolveEffectivePermissions` use case (returns `EffectivePermissions` for an Agent in a Run or for a preview without Run).
- Ports: `PolicyReader` (reads the layers), `RunContextReader` (Run status, Workspace, Agent, Workflow ids), `PauseStateReader`, `SandboxHealthReader` (is isolation available), plus read of overrides through `ApprovalOverrideReader` (defined in `OVE_PERM012`).
- Small policy cache keyed by `(layer, subject, version)` with explicit invalidation event handling.

## 4. Out of scope

Persisting policies (PERM024), approval creation (PERM014), mount derivation (PERM017), violation and audit store (PERM018, PERM019, PERM020), the gateway route (PERM026), Global Pause itself (PAUSE area).

## 5. Detailed requirements

1. **Signature**
   ```ts
   checkAccess(input: { principal: Principal /* agent or chief or system */, runId: EntityId<'run'>, agentId: EntityId<'agt'>,
                        action: AccessActionInput /* raw path strings allowed here, canonicalised inside */ }): Promise<Result<AccessDecision, AppError>>
   ```
   `Err` is returned only for infrastructure failures that must be treated as deny by the caller (`perm.policy_unreadable`, `perm.audit_unavailable`); every normal outcome is an `Ok(AccessDecision)`. Callers MUST treat `Err` as deny (documented, and the Tool Broker contract test asserts it).
2. **Steps:** (a) `RunContextReader.get(runId)` verify the Run exists, is active (not cancelled/finished) and that `agentId` and `principal.agentId` match the Run (an Agent cannot ask about another Run or Agent: `perm.not_found`); (b) read the five layers through `PolicyReader` (Owner, Workspace of the Run, Agent via its profile, Workflow of the Run's pinned version, Tool when the action has a `toolId`); (c) read active Run grants for the Run (`RunGrantRepository`, PERM016) and overrides; (d) `computeEffectivePermissions`; (e) canonicalise any `fs` path with `PathGuard.resolveForAccess` using the effective directories as roots (mode derived from `op`), and attach flags; (f) `evaluateAccess` with context `{ runActive, paused, sandboxHealthy, preallowedHosts }`; (g) record: every `deny` writes a violation (`RecordViolation`), every `needs_approval` writes an audit event `perm.access.needs_approval`, every `allow` of a *classified or capability* action writes a low-volume audit event only when the Owner enabled verbose audit (default off, to bound volume; allow decisions for plain fs reads are never audited individually, they are visible in the Activity feed via tool events).
3. **Paused:** `PauseStateReader.isPaused()` true gives deny `paused` for every action that is not a pure read of Overmind's own state (see `OVE_PERM029` for the exact rule). While reading the pause state fails, the service denies with `policy_unreadable` (fail closed).
4. **Sandbox health:** `SandboxHealthReader.isolationAvailable(workspaceId)` false gives deny `isolation_unavailable` for actions with side effects (ADR 0004: no isolation, no action). Read-only queries of Overmind state are not actions.
5. **Cache:** the policy cache holds resolved layers per `(layer, subjectId, version)` for 30 s; subscribes to events `policy.changed`, `profile.changed`, `override.changed`, `run_grant.changed`, `pause.changed` (EventBus) and drops affected keys synchronously **before** acknowledging the originating command, so a narrowing is effective on the next check (no stale allow). Cache miss reads the repository. Any cache or event error clears the cache entirely.
6. **Narrowing is immediate, widening needs the mount:** because checks always evaluate current policies, a narrowed policy takes effect on the next check; a widened policy also allows host-side actions immediately, but file access for Agents only works after the sandbox mounts are updated by `OVE_PERM017`/`OVE_PERM016` (the service reports `mountPending: true` in the preview use case).
7. **Idempotent and side-effect-light:** `checkAccess` never creates approvals or access requests itself (the Tool Broker calls `RequestApproval` when it receives `needs_approval`).
8. **Performance:** under 5 ms typical with a warm cache (benchmarks in the test plan); input action size limits (path max 4096 bytes, host max 253).
9. **Correlation:** reads `requestId` from the log context and attaches `correlationId` to the audit/violation events.
10. **Direct chats (ADR 0023):** a Run-less direct chat with an Agent uses a synthetic "chat Run" created by CHAT/AGENT; the Workflow layer is absent (identity). The service requires a `runId`; no Run-less check exists.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`computeEffectivePermissions`, `evaluateAccess`, `classifyAction` (PERM005..007), `PathGuard` (SEC002), `RecordViolation` (PERM018), `AppendAudit` (PERM020), `EventBus` (ARCH010), `Logger` (ARCH004), `Clock`.

## 8. Architecture and code placement

`packages/application/src/perm/`; ports one file each in `packages/application/src/ports/`. The module file `apps/engine/src/composition/modules/perm-check.module.ts` registers tokens (ARCH006) and is owned here. The service depends only on ports (DIP); adapters for `RunContextReader`/`PauseStateReader` are small wrappers over WFRT/PAUSE use cases, written in the composition module (no cross-area table access).

## 9. Security and safety

Fail closed everywhere: any port error returns `Err` (deny); unknown Run, mismatched Agent/Run, or cancelled Run returns `perm.not_found`/`run_not_active`. The Agent identity comes from the token principal and is cross-checked with the Run, so an Agent cannot evaluate or probe another Agent's permissions. Path strings from Agents are untrusted: canonicalised on the engine side, with `PathGuard` errors converted to deny reasons that reveal nothing about paths outside the roots. Violations are rate-limited and deduplicated by `RecordViolation` so a looping Agent cannot flood the audit store. The cache invalidation is synchronous with writes to avoid TOCTOU between a revocation and a check. Prompt-injected content cannot call this service directly; it is only reachable via the broker and agent-scoped routes that carry run-bound tokens.

## 10. Errors and edge cases

- Agent profile row missing or the Agent has no `permissionProfileId`: AGENT requires a profile, so this is a data error and is treated as `policy_unreadable` (deny), never as identity.
- Run finished while the check is in flight: deny `run_not_active`.
- Two concurrent checks while the Owner narrows a policy: each sees either the old or the new version, never a mixture (layers read in one repository snapshot via `PolicyReader.readLayers(...)` returning a consistent set).
- Path that does not exist yet (write target): `PathGuard` resolves the existing prefix; the write is judged by the parent.
- Action carries a 5000-byte path: deny `path_invalid`.

## 11. Acceptance criteria

- [ ] Given an empty Workspace policy, any `fs` check returns deny `no_allowed_directories` and writes a violation.
- [ ] Given a symlink inside an allowed directory pointing outside, the check denies (PathGuard) and logs a violation with `viaSymlink` detail.
- [ ] Given Owner narrows the policy after a cached allow, the next check denies (invalidation test).
- [ ] Given an Agent token for agent A asking about agent B's Run, the result is `perm.not_found`.
- [ ] Given `PolicyReader` throws or returns `Err`, the result is `Err(perm.policy_unreadable)` and nothing is allowed.
- [ ] Given Global Pause on, all non-read-only-state actions deny with `paused`.
- [ ] Given a lifted `git_push` override, a push check returns allow with `lifted_approval`; the override removal denies again at once.

## 12. Test plan

Use case tests with in-memory fakes of all ports (PERM025 fakes); invalidation tests with a fake event bus; failure-injection tests for each port (returns `Err`, throws, hangs: timeout 2 s → deny); benchmark test (warm cache) with an informative threshold; contract-level test "caller treats Err as deny" for the Tool Broker interface type. `pnpm vitest run packages/application/src/perm`.

## 13. Parallelization notes

Blocks PERM016/PERM017/PERM026/PERM030. Needs PERM018 and PERM020 only as ports (stubs allowed). Hotspot: `perm-check.module.ts` owned here; other PERM modules use their own module files.

## 14. Open questions and assumptions

- ASSUMPTION: allowed plain file reads are not audited individually (volume); denies, approvals, access requests, policy changes are. A verbose-audit switch exists in config (ARCH005 section proposal `audit.verboseAllow`, default false).
- Open: who provides `usecase:GetRunSummary` (WFRT) and `usecase:GetAgentSummary` (AGENT): the capability names are assumed; flagged to the linker.
- Open: `SandboxHealthReader` implementation is BOX's `Sandbox.health()` wrapped in the composition module; default cache 5 s.
