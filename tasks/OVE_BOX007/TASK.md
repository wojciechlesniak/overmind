---
id: OVE_BOX007
title: Build validated EnvironmentSpecs exclusively from the PERM mount plan
area: BOX
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH012, OVE_BOX003, OVE_PERM017, OVE_SEC002]
soft_depends_on: [OVE_BOX001, OVE_BOX005]
provides: ["lib:environment-spec-builder"]
needs: ["contract:MountPlan", "usecase:BuildMountPlan", "lib:path-guard", "port:PathProbe", "port:Sandbox", "port:IdGenerator"]
owns:
  - packages/adapters/sandbox-macos/src/spec/**
reads: ["packages/application/src/platform/", "docs/security/path-canonicalisation.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [3, 4, 20, 21]
---

# OVE_BOX007: Build validated EnvironmentSpecs exclusively from the PERM mount plan

## 1. Summary

Turn "Effective Permissions of this Agent in this Workspace" into the one and only `EnvironmentSpec` the sandbox may run: mounts come exclusively from the PERM mount plan, are re-canonicalised and re-checked here (defence in depth), the working directory is always `/work`, and everything dangerous is unrepresentable. The same builder is used by the product and by the escape-test harness.

## 2. Context

ADR 0020: only Allowed Directories are mounted; a new Zgoda means attaching a directory to the VM. SR-01, SR-04, SR-05. PERM computes Effective Permissions as an intersection and exposes a `MountPlan` (capability `contract:MountPlan`, produced by `usecase:BuildMountPlan`). `OVE_ARCH012` defines `EnvironmentSpec`/`Mount` and `EnvironmentSpecSchema` (rejects non-`/work` workdir, non-canonical or relative paths, `/`, `/Users`, home, secrets in env, unpinned images). `OVE_SEC002` supplies `PathGuard` and the `PROTECTED_LOCATIONS` deny-list. Prototype: Codex wrote to `/` because it started outside `/work`, so the working directory is part of the spec, not a runtime choice.

## 3. Scope (in)

- `EnvironmentSpecBuilder.build(input): Promise<Result<EnvironmentSpec>>` and the pure helpers it uses.
- Container path layout for mounts, the environment variable allowlist, labels and spec hashing.
- Mount verification helper `assertMountsMatchPlan(spec, plan)` reused by BOX008 (post-create check).

## 4. Out of scope

- Computing the plan or deciding permissions: PERM. Worktree creation: OVE_BOX014 (this builder only consumes its result). Credential volumes: OVE_BOX009 (this builder receives volume refs). Egress policy content: OVE_BOX011/BOX013 (receives a policy).

## 5. Detailed requirements

1. **Input:**
   ```ts
   BuildSpecInput = {
     plan: MountPlan;                 // from PERM: { workspaceId, agentId, runId?, policyVersion, entries: MountPlanEntry[] }
     imageRef: ImageRef;              // 'overmind-agent@sha256:...' from OVE_BOX006
     worktree?: { workHostPath: string; gitDir?: string; commonDir?: string };   // from BOX014
     credentialVolumes: VolumeRef[];  // from BOX009
     egress: EgressPolicy;            // from BOX013
     resources: { cpus: number; memoryMiB: number; pidsLimit: number };   // from config (BOX017)
     cli: 'claude' | 'codex' | 'none';
     extraEnv?: Record<string,string>; // non-secret, allowlisted keys only
   }
   MountPlanEntry = { allowedDirectoryId: string; hostPath: string; mode: 'ro'|'rw'; role: 'primary'|'additional'|'docs' }
   ```
2. **Exactly one primary entry.** Its host path (or the worktree path derived from it) is mounted at `/work`. Additional entries are mounted at `/mnt/dirs/<slug>` where `slug` is a deterministic, ASCII-only, collision-free name derived from the last path component plus the first 6 hex of the sha256 of the canonical path. Documentation entries (`role: docs`) are always `ro`. No other container paths are used for host mounts; fixed internal paths (`/opt/overmind/*`, `/run/overmind/*`) are produced by BOX020, not here.
3. **Re-validation of every host path:** `PathGuard.resolveForAccess` on each `hostPath` against the Allowed Directory roots in the plan; the result must equal the plan's canonical path (otherwise `box.mount_drift`, the directory was replaced since planning); `dev` equals the root's `dev` (no mount crossing); the path is a directory, not a symlink; not inside `PROTECTED_LOCATIONS`; not equal to or an ancestor of the Overmind data directory; not an ancestor of the user's home; not `/`, `/Users`, `/Volumes`, `/private`, `/System`, `/Library`. Any failure: `box.mount_forbidden` and nothing is built.
4. **Worktree substitution:** when `worktree` is given, `workHostPath` MUST be inside the primary root (PathGuard check) and is mounted rw at `/work` instead of the root itself; `gitDir` (the worktree's private git directory) and `commonDir` (the repository's `.git`) are additional mounts at `/git/worktree` and `/git/common` (rw), their host paths also validated as inside the primary root. The spec sets `GIT_DIR=/git/worktree`, `GIT_COMMON_DIR=/git/common`, `GIT_WORK_TREE=/work` (see OVE_BOX014 for why and for tamper checks).
5. **Mode rules:** `rw` is allowed only when the plan says `rw`; `ro` entries are mounted read-only at the runtime level (not just by file mode). The builder never upgrades a mode; a child entry nested inside another entry's path is rejected unless it is more restrictive (`ro` inside `rw`).
6. **Fixed spec fields:** `workdir: '/work'`, `user: 'agent'` (uid 1000, via image), `rootFs: 'readonly'`, `tmpfs: ['/tmp', '/home/agent', '/run/overmind']` with size caps (`/tmp` 512 MiB, home 256 MiB), `init: true`, no privileged flag, no device mounts, no host network, `capDropAll: true`, `noNewPrivileges: true`. These are not parameters of the input; they cannot be varied by callers.
7. **Environment allowlist:** the builder starts from the image defaults and adds only: `OVERMIND_ENV_ID`, `OVERMIND_WORKSPACE_ID`, `OVERMIND_AGENT_ID` (opaque ids), `OVERMIND_API_URL=http://127.0.0.1:7077`, `OVERMIND_API_SOCKET=/run/overmind/agent-api.sock`, `OVERMIND_RUN_ID` (added per session by the bridge, not part of the hashed spec), `HTTPS_PROXY`/`HTTP_PROXY=http://127.0.0.1:3128`, `NO_PROXY=127.0.0.1,localhost` (only loopback), `GIT_DIR`/`GIT_COMMON_DIR`/`GIT_WORK_TREE` when applicable, and `extraEnv` keys that match `^[A-Z][A-Z0-9_]{1,40}$` and are in the explicit allowlist table (initially `FAKE_CLI_SCENARIO`, `FAKE_CLI_TIME_SCALE` only in test mode). The agent API token is NOT part of the spec (it is injected at exec time by PROV through a file descriptor or short-lived env on the exec call, never stored in the spec or labels). Values containing secrets patterns are rejected.
8. **Labels:** `app.overmind.managed=true`, `app.overmind.install=<id>`, `app.overmind.env=<EnvironmentId>`, `app.overmind.workspace`, `app.overmind.agent`, `app.overmind.spec-hash`, `app.overmind.created`. `specHash = sha256(canonical-json(spec minus labels and created))`.
9. **Output validation:** the final object is validated with `EnvironmentSpecSchema` (ARCH012) and a BOX-specific stricter schema `MacEnvironmentSpecSchema` (adds tmpfs, capDrop, mount path set). Validation failure is `box.spec_invalid` with the first failing field path only (no host paths in the message).
10. `assertMountsMatchPlan(actual: ContainerInfo['mounts'], spec)` compares the runtime mount list returned by `container inspect` with the spec: same set, same modes, no extra mounts; used by BOX008 right after `run` and periodically by the reaper.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EnvironmentSpecSchema`, `Mount`, `EgressPolicy` (OVE_ARCH012), `PathGuard`, `CanonicalPath`, `PROTECTED_LOCATIONS` (OVE_SEC002), `MountPlan` (PERM), redaction key rule (OVE_ARCH004), `IdGenerator` for `EnvironmentId` (OVE_ARCH007). Never re-implement path logic.

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/spec/{build-spec.ts,mount-layout.ts,env-allowlist.ts,labels.ts,spec-hash.ts,assert-mounts.ts,mac-spec.schema.ts}`. Pure functions except the PathGuard calls (injected). This module has no knowledge of the `container` CLI argument syntax (that is BOX008's mapper), keeping validation independent of the runtime (a future Lima adapter can reuse it by moving to application if needed, proposal at that time).

## 9. Security and safety

This is the choke point for SR-01/SR-04/SR-05. Abuse cases handled: (1) a malicious repo contains `/work/link -> /Users/x/.ssh`: mounts are by directory, symlinks inside never resolve on the host (container sees its own namespace), and the primary root itself being a symlink is refused; (2) the Owner's Allowed Directory is replaced by a symlink between approval and run: re-validation yields `box.mount_drift`; (3) a plan entry for `~` or `/`: refused even if PERM erred; (4) path with comma or `=` attempting to inject extra mount options: refused at the spec level; (5) prompt-injected extra env (`LD_PRELOAD`, `HTTP_PROXY=http://evil`): not in allowlist, rejected; (6) the plan contains two entries to the same directory with different modes: the stricter wins or the plan is rejected (`box.spec_invalid`), never the looser. Fail closed on any exception.

## 10. Errors and edge cases

- Allowed Directory on an external volume that is unmounted: `path.not_found` mapped to `box.mount_forbidden` with a retryable flag; Run blocked with a clear reason.
- Directory with case-variant path text: canonicalised by PathGuard; slug uses canonical text.
- Non-ASCII directory name: slug is ASCII-only (transliteration is not attempted; hash suffix keeps it unique).
- Plan with zero entries: `box.spec_invalid` (empty list means no access, so no Environment for commands at all; PERM reports that earlier).
- Two Agents in direct mode on one directory: allowed, flagged in labels (`app.overmind.shared-dir=true`) for the UI.
- Worktree path outside the primary root: refused.

## 11. Acceptance criteria

- [ ] Table tests: every row of the ESC-080 fail-closed list (non-canonical path, home, `/`, `/Users`, wrong workdir, unpinned image, secrets in env) is rejected by the builder.
- [ ] The only host paths in a built spec are those in the plan (property test over random plans).
- [ ] A directory replaced by a symlink after planning is rejected as `box.mount_drift`.
- [ ] Output contains `workdir '/work'`, read-only root, capDropAll and tmpfs entries regardless of input.
- [ ] `assertMountsMatchPlan` detects an extra mount, a missing mount and a mode difference.
- [ ] Spec hash is stable across runs and changes when a mount mode changes.
- [ ] No host path appears in error messages.

## 12. Test plan

Unit tests with `FakePathProbe` trees (SEC002 builders); property tests (fast-check) for the plan-only rule; golden JSON for a typical spec; negative table for injection strings in paths and env. Integration test on macOS builds a spec for a temp directory with a symlink inside it. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/spec`.

## 13. Parallelization notes

Can proceed with a stub `MountPlan` type until PERM lands (`soft` on the contract). BOX008 and BOX021 consume this builder. Hotspot: `env-allowlist.ts` (additions come as proposals to this owner).

## 14. Open questions and assumptions

- ASSUMPTION: PERM's `MountPlan` entries carry canonical host paths and a `role`; if PERM exposes only Allowed Directory ids, a resolver port `AllowedDirectoryResolver` is added there, not here.
- ASSUMPTION: `/mnt/dirs/<slug>` for additional directories is acceptable because CLIs always start in `/work`. Owner to confirm that multi-directory Workspaces are rare in MVP.
