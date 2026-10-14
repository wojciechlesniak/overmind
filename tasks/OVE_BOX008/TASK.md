---
id: OVE_BOX008
title: Implement the Environment lifecycle (create, start, stop, destroy, list) with verification
area: BOX
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_ARCH013, OVE_BOX001, OVE_BOX004, OVE_BOX006, OVE_BOX007]
soft_depends_on: [OVE_BOX017]
provides: ["lib:environment-lifecycle"]
needs: ["port:Sandbox", "port:EventBus", "port:Clock", "port:IdGenerator", "port:AtomicFileWriter", "lib:data-dir"]
owns:
  - packages/adapters/sandbox-macos/src/lifecycle/**
reads: ["packages/adapters/sandbox-macos/src/spec/", "docs/adr/*-isolation-granularity.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [4, 5, 20]
---

# OVE_BOX008: Implement the Environment lifecycle (create, start, stop, destroy, list) with verification

## 1. Summary

Implement `createEnvironment`, `startEnvironment`, `stopEnvironment`, `destroyEnvironment`, `listEnvironments` and `updateMounts` of the `Sandbox` port with Apple `container`: map the validated `EnvironmentSpec` to `container run` flags, create the container, verify right after creation that what runs equals what was specified, keep a durable registry of Environments, and discard the root filesystem when an Environment is destroyed.

## 2. Context

Granularity is one Environment per Agent per Workspace (OVE_BOX001, default). The root filesystem is read-only with small tmpfs areas; `/work` (host mount) and credential volumes persist (prototype lessons: Codex wrote to `/` which vanished with the container, so the root must be read-only or ephemeral; credentials must survive recreation). Mount changes recreate the Environment (BOX001 rule). `Sandbox.exec` and ports forwards are separate tasks (BOX010, BOX015).

## 3. Scope (in)

- `EnvironmentRegistry` (durable list of Environments created by this install) and the state machine.
- Mapping `EnvironmentSpec` to `container run` arguments (`RunArgs` of OVE_BOX003).
- Post-create verification, drift detection, graceful stop, forced destroy.
- `listEnvironments()` and `updateMounts()` (recreate semantics).

## 4. Out of scope

- Image provisioning (BOX006), exec (BOX010), volumes (BOX009), network relays (BOX012), reaper sweeps (BOX016), memory admission (BOX017).

## 5. Detailed requirements

1. **State machine** per Environment: `creating -> created -> starting -> running -> stopping -> stopped -> destroying -> destroyed`, plus `failed`. Transitions are validated; invalid ones return `box.env_exists` / `box.env_not_found` / `internal.invalid_state`. State is persisted in `<dataDir>/sandbox/environments.json` (atomic, 0600) as `{ id, containerName, specHash, workspaceId, agentId, state, createdAt, startedAt?, lastActivityAt? }` and reconciled with `container list --label app.overmind.managed=true` at engine start (the CLI is the truth for existence, the registry for intent).
2. **create:** (a) health `ready` check via BOX004, (b) image `verify()` via BOX006, (c) admission via BOX017 (`ResourceGate.admit`), (d) validate spec hash and `MacEnvironmentSpecSchema`, (e) `ContainerCli.run` with `--detach`, name `ovm-<install8>-<envId>`, labels from the spec, `--read-only`, `--tmpfs` entries, `--cpus`, `--memory`, `--user`, `--init`, `--workdir /work`, `--mount` for each mount in canonical order, `--volume` for credential volumes (BOX009), the network mode chosen by BOX012, `--env-file` for env (mode 0600, deleted afterwards), no `--privileged`/`--cap-add`/`--device`/`--publish`. If the CLI lacks a required flag (capability probe), fail with `box.cli_missing_capability` before running.
3. **Post-create verification (`verifyEnvironment`)**: `container inspect` must show: the exact image digest, state running or created, mounts equal to the spec (use `assertMountsMatchPlan`), read-only root true, user non-root, memory/cpu limits equal, no extra devices, env names equal to the spec (values not logged), labels equal. Any difference destroys the container immediately and returns `box.mount_drift` (or `box.spec_invalid`) with an audit event `sandbox.violation` (BOX018). Verification also runs after every start.
4. **start:** idempotent when running; starts the entrypoint, waits (max 20 s) until the readiness marker `/run/overmind/ready` exists (checked through a short exec of `test -f`) and relays are bound; timeouts destroy and fail.
5. **stop:** `container stop --time <graceMs/1000>` default 10 s, then `kill` if still running; forwards and bridges for the Environment are closed first (BOX015/BOX020 hooks via `EnvironmentHooks`). Idempotent.
6. **destroy:** stop, `container delete`, remove the bridge sockets and env files, keep volumes unless `keepVolumes: false` AND the caller passes `purgeCredentials` (never the default; credential removal is a separate Owner-confirmed action in BOX009). After destroy the root filesystem, tmpfs and anything written outside `/work` and volumes are gone (ESC-010, ESC-100). Registry entry removed after the CLI confirms deletion.
7. **updateMounts(id, mounts):** implemented as destroy + create with the new spec when no exec is running; if a command is running returns `box.env_busy` (caller cancels or waits). A mount update never mutates a running container's mounts. The new mount list passes through BOX007 (callers pass a new plan, not raw mounts: the port signature carries `Mount[]`, the adapter requires them to equal builder output by comparing against a freshly built spec hash; mismatch is `box.spec_invalid`).
8. **listEnvironments():** from the registry reconciled with the CLI; includes orphans flagged `orphaned: true` (container exists without registry entry) for BOX016. `EnvironmentInfo { id, state, workspaceId, agentId, createdAt, imageDigest, specHash, orphaned }`.
9. **Concurrency:** per-Environment mutex (operations serialised), global creation limited by the semaphore of BOX017; cancellation through `AbortSignal` aborts waiting but a half-created container is destroyed in `finally`.
10. **Events/audit** (BOX018 interface): `sandbox.env_created`, `sandbox.env_started`, `sandbox.env_stopped`, `sandbox.env_destroyed`, `sandbox.violation`.
11. **Idle timers** are not implemented here; the scheduler (PROV019) decides when to stop/destroy using `lastActivityAt` and BOX001 constants.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ContainerCli` (BOX003), spec builder and `assertMountsMatchPlan` (BOX007), `ImageGate` (BOX006), `ResourceGate` (BOX017), `AtomicFileWriter`, `Clock`, `IdGenerator`, `EventBus`.

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/lifecycle/{environment-registry.ts,run-args.ts,create.ts,start.ts,stop.ts,destroy.ts,verify.ts,reconcile.ts,state-machine.ts}`. The state machine and `run-args.ts` are pure (given `EnvironmentSpec` and capabilities). Single responsibility per file; the `Sandbox` facade is assembled in OVE_BOX022.

## 9. Security and safety

Defence in depth: the container that runs must match the spec; verification is not skippable by configuration. The runtime flags are fixed by code, not by input. Env files are 0600 and deleted immediately, never logged. A container created with unexpected mounts is destroyed before any command can run in it (fail closed), and the incident is audited. No `--publish` ever: host-reachable ports are not created here. Labels carry ids only (no paths). The registry file is owner-only and validated on load; a tampered registry cannot cause deletion of non-Overmind containers because every destructive call re-checks the `app.overmind.managed` and install labels.

## 10. Errors and edge cases

- `run` succeeds but `inspect` fails: destroy and report `box.cli_failed`.
- Host sleep during creation: operation times out, destroy path runs on wake via reaper.
- Name collision (stale container with same name from a previous crash): if labels show it is ours and not in the registry, destroy it first (log), otherwise `box.env_exists`.
- Out of disk space while creating: `box.resource_limit`.
- `stop` on an already exited container: ok.
- Engine crash between `run` and registry write: reconcile marks it orphaned, BOX016 removes it.
- OOM kill of the container: state becomes `failed` with `box.oom_killed` on next inspect; start allowed again.

## 11. Acceptance criteria

- [ ] `createEnvironment` produces a container whose inspect output equals the spec (mounts, read-only root, user, limits) and rejects a deliberately mutated fake inspect with `box.mount_drift`.
- [ ] Run arguments never contain `--privileged`, `--cap-add`, `--device`, `--publish`, host network; a test enumerates the argv builder output for random valid specs.
- [ ] Stop is graceful then forced; destroy removes the container, env file and sockets, and keeps volumes by default.
- [ ] `updateMounts` recreates the Environment and refuses while a command runs.
- [ ] Registry/CLI reconciliation reports orphans and ghost entries correctly.
- [ ] Concurrent operations on one Environment are serialised (test with fake runner latencies).
- [ ] Contract suite `Sandbox.contract` lifecycle part passes for this adapter.

## 12. Test plan

Unit tests for state machine, run-args mapper (golden argv), reconcile; fake-runner tests for failure injection (inspect mismatch, run failure, timeout). Integration test on macOS 26 runner: create, start, verify, restart persistence of `/work` only, destroy (ESC-010/100 subset overlaps with TEST007). Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/lifecycle`.

## 13. Parallelization notes

Depends on BOX007 and BOX006 interfaces (stubs allowed). BOX010, BOX015, BOX016 build on its registry. Hotspot: `run-args.ts` (single owner; flags added only with a matching capability probe entry).

## 14. Open questions and assumptions

- ASSUMPTION: `container run` supports read-only root and tmpfs flags in 1.5.x (verified by BOX002); if tmpfs is absent, HOME and `/tmp` become anonymous volumes deleted on destroy (documented fallback, must be proven by ESC-010 non-persistence).
- Open: whether `container` allows `inspect` to show effective capabilities; if not, rely on the escape tests (ESC-032).
