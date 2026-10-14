---
id: OVE_PERM017
title: Derive the sandbox mount plan and egress plan from Effective Permissions
area: PERM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_ARCH012, OVE_BOX023, OVE_PERM005, OVE_PERM007, OVE_PERM010, OVE_PERM020, OVE_SEC002]
soft_depends_on: [OVE_PERM016, OVE_TEST007]
provides: ["lib:mount-plan", "contract:MountPlan", "port:MountPlanApplier", "usecase:PrepareRunMounts", "usecase:HandlePolicyChangedForSandboxes", "usecase:BuildMountPlan"]
needs: ["port:Sandbox", "lib:path-guard", "port:EventBus", "usecase:AppendAudit", "port:RunContextReader", "lib:provider-hosts"]
owns: ["packages/domain/src/perm/mount-plan/**", "packages/contracts/src/perm/mount-plan.ts", "packages/application/src/perm/mounts/**", "packages/application/src/ports/MountPlanApplier.ts", "apps/engine/src/composition/modules/perm-mounts.module.ts"]
reads: ["packages/application/src/ports/Sandbox.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1", "SPECIFICATION 16.8"]
adr_refs: [3, 4, 20, 21]
---

# OVE_PERM017: Derive the sandbox mount plan and egress plan

## 1. Summary

Turn Effective Permissions plus active Run grants into the exact list of mounts and the network egress policy that the BOX area applies to an Agent's environment. The mount list is the real wall (ADR 0004/0020): only Allowed Directories are ever mounted, with the right access mode. Adding a directory means attaching a mount; removing one detaches it.

## 2. Context

ARCH012 defines `Sandbox.createEnvironment(spec)` with `Mount = { hostPathCanonical, containerPath, mode: 'ro'|'rw' }` and `updateMounts(id, mounts)`, `setEgressPolicy(id, policy)`. Prototype facts (docs/research/prototyp-wnioski.md): the CLI must always start in `/work` (the Workspace folder); everything else in the container is read-only or ephemeral; the network goes through a proxy with a host allowlist, provider hosts pre-allowed, any other domain needs an Approval (ADR 0021). BOX implements the adapter; PERM decides what goes in.

## 3. Scope (in)

- Pure `deriveMountPlan(effective, options)` and `deriveEgressPlan(effective, preallowedHosts)`.
- `MountPlanApplier` port (`applyForRun`, `detachForRun`) with the application implementation that calls `Sandbox.updateMounts` and `setEgressPolicy`.
- `PrepareRunMounts` (at Run start, and on engine restart for running Runs): re-canonicalise and re-verify roots (device/inode), derive, apply, record the plan hash.
- Handler for `policy.changed`, `run_grant.changed` and `pause.changed` events to keep running environments in sync (including removal on narrowing).

## 4. Out of scope

The Apple `container` adapter and the actual mounting (BOX), credential volumes for CLI logins (BOX, never part of this plan), the proxy implementation (BOX), policy storage (PERM024).

## 5. Detailed requirements

1. **MountPlan**
   ```ts
   MountPlan = { workdir: '/work', mounts: PlannedMount[], excluded: { path: string, reason: ExcludeReason }[], planHash: string }
   PlannedMount = { hostPathCanonical: CanonicalPath, containerPath: string, mode: 'ro'|'rw', exec: boolean, source: 'policy'|'run_grant', primary: boolean, fingerprint?: {dev,ino} }
   ExcludeReason = 'no_read_right' | 'protected_location' | 'verification_failed' | 'too_many_mounts' | 'overlaps_data_dir'
   ```
2. **Rules** (each tested): (a) only directories with `read` are mounted; (b) `mode='rw'` iff `write`; `exec` iff `execute` (BOX maps `exec:false` to noexec when the runtime supports it, else documents the limitation — see 14); (c) the primary directory is mounted at `/work`; if there is no primary, the first by canonical path order becomes `/work`; a Workspace with an empty effective set has **no mounts**, `/work` stays an empty ephemeral directory and the Run must not start (`PrepareRunMounts` returns `perm.deny_by_default`); (d) additional directories are mounted at `/mnt/overmind/<slug>-<hash8>` where `slug` is the sanitised last path component (`[a-z0-9-]`, max 24) and `hash8` is the first 8 hex chars of SHA-256(canonical path), so container paths are stable and cannot be guessed to collide; (e) nested directories: parents before children (mount order), a child with different rights is a separate explicit mount (ordering matters for overlay); a child with identical rights is not emitted; (f) at most 16 mounts (`too_many_mounts` excluded in order of least specific last); (g) never mount `~`, `/`, `/Users`, system folders, the Overmind data directory or its ancestors/descendants (re-checked here even though PERM002 refuses them: defence in depth, reason `protected_location`), nor any path whose `PathGuard.verifyRoot` (dev/inode fingerprint) fails (`verification_failed`); (h) the plan never contains credential volumes, Docker-socket-like paths, or files (only directories).
3. **EgressPlan** `{ mode: 'allowlist'|'deny-all', hosts: HostPattern[], onNewHost: 'ask'|'block' }`: `mode='allowlist'` when effective `network` is an allowlist or provider hosts are needed; hosts = effective allowlist ∪ `preallowedHosts` (provider hosts for the Agent's configured CLI, from `lib:provider-hosts`); `onNewHost: 'ask'` iff `network.mode==='allowlist'` (new-domain Approval, ADR 0021) else `'block'`. If effective network is `deny`, only provider hosts remain (the CLI must reach its provider; ADR 0020) and `onNewHost='block'`. Egress never includes IPs.
4. **Application of the plan:** `MountPlanApplier.applyForRun(runId)`: loads Effective Permissions for each Agent environment of the Run (via `ResolveEffectivePermissions`), derives plans, compares `planHash` with the last applied (stored in the environment labels by BOX), and if different calls `Sandbox.updateMounts` then `setEgressPolicy`. On `Err` the caller treats the grant as failed. `detachForRun(runId)` removes Run-grant mounts.
5. **Order of operations for narrowing:** detach first, then update policy visible to the Agent. For widening: attach first, then confirm the grant to the Agent. Both are guaranteed by callers (PERM011, PERM016) and tested with the fake sandbox.
6. **Run start:** `PrepareRunMounts(runId)` re-verifies every root fingerprint; if the primary fails verification the Run is blocked (`perm.isolation_unavailable` with `details.reason='primary_changed'`) and the Owner is notified (event `perm.mounts.blocked`); non-primary failures exclude only that mount and add a warning event.
7. **Sync handler:** on `policy.changed` / `run_grant.changed` the engine recomputes plans for all running environments of the affected Workspace within 2 s; failures are retried 3 times with backoff then the affected Agents are paused (event) and the Owner notified: **never leave an Agent running with a plan newer than its mounts for a narrowing** (fail closed: if a narrowing cannot be applied, the environment is stopped).
8. **Determinism and hash:** plan sorted, `planHash` SHA-256 over canonical JSON.
9. **Proposal to ARCH012 owners (file in `tasks/_proposals/OVE_PERM017-mount-exec.md`):** extend `Mount` additively with `exec?: boolean` and `labels`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Mount`, `EgressPolicy`, `Sandbox` port (ARCH012), `CanonicalPath`/`PathGuard` (SEC002), `computeEffectivePermissions` via `ResolveEffectivePermissions` (PERM010), `hostMatches` (PERM004), provider host list (PROV `lib:provider-hosts`).

## 8. Architecture and code placement

Pure derivation in `packages/domain/src/perm/mount-plan/{derive.ts,egress.ts,slug.ts}`; port `packages/application/src/ports/MountPlanApplier.ts`; applier and handlers in `packages/application/src/perm/mounts/`; composition `perm-mounts.module.ts`. BOX implements `Sandbox` and never calls PERM; PERM never imports BOX (adapters do not import each other; the module wires them).

## 9. Security and safety

This task converts policy into the OS-level boundary, so it is a primary control for SR-05/SR-33 and acceptance criterion 8. Controls: derivation from Effective Permissions only (no direct policy field is trusted); protected-location refusal twice; fingerprint verification at Run start (symlink swap of an Allowed Directory after registration is detected); container paths derived from a hash, not from agent input; `/work` always the primary; no credential volumes here (BOX owns them, per-CLI, SR-33); narrowing failure stops the environment; plan hash in audit for forensic comparison; the escape tests (TEST007) consume `MountPlan` fixtures: the catalogue includes "a plan is the only source of mounts". Symlinks inside a mounted directory that point outside resolve inside the container where the target does not exist (SEC002 requirement 6a), so they cannot expose host files.

## 10. Errors and edge cases

- Effective set empty: no mounts; Run blocked.
- Directory with `write` but also a child with `read` only: parent `rw`, child additional `ro` mount.
- Two Allowed Directories with the same last component (`/a/src`, `/b/src`): slugs equal, hashes differ, no collision.
- Case-insensitive variant listed twice: deduplicated by PERM002 earlier; here defence by canonical equality.
- External volume unmounted: `verification_failed`, excluded; if primary, Run blocked.
- 17 directories: the least specific are excluded with a warning shown to the Owner.

## 11. Acceptance criteria

- [ ] Empty effective permissions produce no mounts and `PrepareRunMounts` returns `perm.deny_by_default`.
- [ ] Only directories with `read` appear; `mode` follows `write`; the primary is at `/work`.
- [ ] Protected locations, the data directory and its ancestors never appear even if injected into the effective set by a test double.
- [ ] Narrowing a policy removes the mount from a running environment (fake sandbox), and a failing detach stops the environment.
- [ ] Widening attaches before the grant is confirmed to the Agent.
- [ ] The egress plan includes provider hosts when `network` is `deny`, and `onNewHost` is `ask` only with an allowlist.
- [ ] Plan is deterministic for permuted inputs and its hash changes when any mount changes.
- [ ] Consistency property: for every path P and Agent, `evaluateAccess` allows read on P iff P lies under a mount in the plan (excluding exclusions, which the property reports).

## 12. Test plan

Unit tests of `deriveMountPlan`/`deriveEgressPlan` (table + fast-check using PERM005 arbitraries); application tests with `FakeSandbox` (TEST002) incl. failure injection and event-driven sync; consistency property between PERM007 and the plan; fixtures exported for TEST007/BOX. `pnpm vitest run packages/domain/src/perm/mount-plan packages/application/src/perm/mounts`.

## 13. Parallelization notes

Port definition should merge early (PERM016 needs it). BOX can develop against `MountPlan` fixtures. Hotspot: ARCH012's `Mount` type (proposal, not edited here).

## 14. Open questions and assumptions

- ASSUMPTION: extra directories are mounted under `/mnt/overmind/<slug>-<hash8>`; the Agent learns the mapping via the environment description passed by PROV/overmind Skill (not via paths in prompts of the host).
- Open for BOX: whether Apple `container` can enforce `noexec` per mount; if not, `execute` is advisory in MVP and documented as such (the sandbox, not the mount flag, is the wall).
- Open: container-per-Agent vs container-per-Workspace (ADR 0020): the plan is per Agent environment either way; bubblewrap inside a Workspace container takes the same plan.
