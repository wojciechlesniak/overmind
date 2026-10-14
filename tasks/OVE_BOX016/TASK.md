---
id: OVE_BOX016
title: Implement the Environment cleanup and orphan reaper (startup sweep, crash recovery)
area: BOX
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH012, OVE_BOX008, OVE_ENGINE016, OVE_ENGINE029]
soft_depends_on: [OVE_BOX011, OVE_BOX015, OVE_BOX020]
provides: ["lib:sandbox-reaper"]
needs: ["port:Sandbox", "port:Clock", "port:AuditSink", "port:JobScheduler"]
owns:
  - packages/adapters/sandbox-macos/src/reaper/**
reads: ["packages/adapters/sandbox-macos/src/lifecycle/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 20]
---

# OVE_BOX016: Implement the Environment cleanup and orphan reaper (startup sweep, crash recovery)

## 1. Summary

After an engine crash, a killed `container` helper, a failed create or an app update, resources can be left behind: running containers nobody tracks, stale sockets, env files, login relays, build leftovers. The reaper finds everything labelled as Overmind's, reconciles it with the registry and removes or adopts it safely, at engine start and periodically.

## 2. Context

The engine must survive crashes and restarts (SPEC 12, criterion 7) and must not leave agents running without supervision. Containers keep running when the engine dies (they are VMs); an unsupervised Agent with a mounted folder is a risk and a resource leak (~1.3 GiB each). Labels from OVE_BOX007/BOX008 identify ownership: `app.overmind.managed=true` and `app.overmind.install=<id>`. Work in `/work` is on the host and must never be lost by reaping.

## 3. Scope (in)

- `Reaper.sweep(mode)` with modes `startup` and `periodic`.
- Rules for orphan containers, ghost registry entries, stale sockets/files/processes and abandoned volumes (reporting only).
- Scheduled periodic run through the job scheduler and a manual trigger.

## 4. Out of scope

- Idle-stop policy for healthy Environments (PROV019 uses lifecycle calls). Image pruning (OVE_BOX006). Deleting credential volumes (never automatic, OVE_BOX009).

## 5. Detailed requirements

1. **Inventory:** from `container list` filtered by label `app.overmind.managed=true` AND `app.overmind.install=<this install>`; containers of other installs or without our labels are never touched (reported as `foreign` at debug level only).
2. **Classification:** `tracked` (in registry, state matches), `orphan` (container exists, not in registry), `ghost` (registry entry, container missing), `zombie` (registry says destroyed/stopped but container running), `drifted` (spec-hash label differs from registry). Actions: orphan: if created less than 60 s ago, skip (race with a creating engine) else stop + delete and audit `sandbox.reaped` with reason; ghost: remove registry entry; zombie: stop + delete; drifted: verify with BOX007 `assertMountsMatchPlan` equivalent and destroy on mismatch.
3. **Startup sweep:** runs once after health is `ready` and before the scheduler grants any slot (BOX019 gate waits for `sweepCompleted`). It does NOT auto-resume agents; PROV009 decides about resuming sessions on tracked Environments. If the sweep cannot complete (CLI error), the gate stays closed (fail closed) and a retry is scheduled in 30 s with backoff to 5 min.
4. **Files and processes:** remove socket files in `<runDir>/egress/` and `<runDir>/bridge/` that have no tracked Environment; delete env files (`*.env`) older than 60 s in the run dir; kill host processes labelled `ovm-login-relay` and `ovm-bridge` that belong to dead Environments (labels via a `--label`-like argv tag or a pid file in run dir; no `pkill` by pattern on the whole system, only pids recorded in run-dir pid files and verified by command-line match through `ps -p <pid> -o command=`).
5. **Never destructive to user data:** `/work` and any host project folder are never deleted, moved or modified. Volumes are never deleted; abandoned credential volumes (no Connection references them) are reported as `abandoned_volume` for the Owner to remove in Connections.
6. **Periodic run:** every 5 minutes (config `sandbox.reaperIntervalSeconds`, min 60) via `JobScheduler`; skipped while an Environment create/destroy is in flight. Manual trigger available to the engine for a "Repair sandbox" action (no UI in this task).
7. **Crash mid-command:** an exec that was running when the engine died leaves a process inside a possibly still-running container; the sweep stops the container (orphan/zombie path) so the process dies. For tracked Environments the supervisor (BOX010) kills process groups when stdin closes. Non-idempotent actions are not replayed (that is PROV008/WFRT policy); the reaper records `sandbox.reaped` with `hadActiveExec: true` for the Activity trail.
8. **Resource ceiling:** if more Environments than `maxParallelAgents + 2` are running, the sweep stops the oldest idle ones and audits it.
9. **Report:** `SweepReport { startedAt, durationMs, tracked, reaped: [{id, reason}], errors: [] }` returned and emitted as event `sandbox.sweep_completed` (ids and counts only).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Sandbox.listEnvironments/destroyEnvironment` (BOX008), `ContainerCli` label filter (BOX003), `JobScheduler` port (ENGINE), audit (BOX018), run-dir helpers (BOX012).

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/reaper/{reaper.ts,classify.ts,files.ts,processes.ts,report.ts}`; `classify.ts` is pure (inputs: CLI inventory, registry, clock).

## 9. Security and safety

The reaper deletes things, so its blast radius is limited by construction: label match plus install id, recently created guard, pid-file based process kills with command verification, no path from labels or Agent data is ever used to delete host files, destroyed Environments only. Abuse: an Agent creating a container named like ours cannot, because containers are created only by the engine; labels on foreign containers do not match the install id. A forged `images.json`/registry (tampered) cannot make the reaper delete foreign containers because every delete re-checks labels on the live container.

## 10. Errors and edge cases

- `container` unavailable during sweep: gate stays closed, retry with backoff.
- Container deletion fails (busy): retry once with `kill` then report; the Environment is marked `reap_failed` and blocks slot assignment for that Agent.
- Clock jumps backwards: recently-created guard uses monotonic and wall clock comparisons; if inconsistent, skip orphan deletion for this sweep.
- Two engines running (misconfiguration): the second detects a lock file in the run dir and refuses to start sweeping (the engine singleton guard is ENGINE's job; reaper still checks).
- Thousands of containers (unlikely): batch of 20 per cycle.

## 11. Acceptance criteria

- [ ] An unregistered labelled container older than 60 s is stopped and deleted; younger is left.
- [ ] A container without our labels or with another install id is never touched (test with fake inventory).
- [ ] Ghost registry entries are removed; zombies are stopped.
- [ ] Stale sockets and env files are removed; recorded pids are killed only when the command line matches.
- [ ] Startup gate remains closed until the first sweep completes; failures keep it closed.
- [ ] No host project path or volume is ever passed to a delete call (spy assertions).
- [ ] `SweepReport` and audit events contain ids and counts only.

## 12. Test plan

Unit tests for classification with table inputs and fake clock; fake-runner tests for actions; temp-dir tests for file cleanup; integration on macOS runner: kill the engine process mid-run (script) and verify cleanup on the next start. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/reaper`.

## 13. Parallelization notes

Small and independent after BOX008. Recovery harness (TEST011) can exercise it as part of crash scenarios.

## 14. Open questions and assumptions

- ASSUMPTION: `JobScheduler` exists in ENGINE with `schedule(id, intervalMs, fn)` semantics; otherwise a plain timer owned by the module.
- Open: whether an unregistered but healthy container whose mounts match a known Workspace should be adopted rather than reaped (default: reap; resuming relies on the registry).
