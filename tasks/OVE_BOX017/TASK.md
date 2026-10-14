---
id: OVE_BOX017
title: Enforce resource limits, memory admission and the sandbox config section
area: BOX
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_ARCH007, OVE_ARCH010, OVE_ARCH014, OVE_BOX003]
soft_depends_on: [OVE_BOX001, OVE_BOX008]
provides: ["lib:sandbox-resources", "contract:SandboxConfig"]
needs: ["contract:AppConfig", "port:ConfigStore", "port:Clock", "port:EventBus", "port:ProcessRunner"]
owns:
  - packages/adapters/sandbox-macos/src/resources/**
  - packages/contracts/src/config/sections/sandbox.config.ts
reads: ["docs/adr/*-isolation-granularity.md", "docs/research/box-granularity-measurements.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 16"]
adr_refs: [20, 22]
---

# OVE_BOX017: Enforce resource limits, memory admission and the sandbox config section

## 1. Summary

Define the `sandbox` configuration section (CPU, memory, pids, timers, credential scope, reaper interval) with the defaults from OVE_BOX001, enforce per-Environment limits through the runtime, add a host memory admission check before another Environment starts, and watch container stats for OOM and runaway behaviour.

## 2. Context

The prototype measured about 1.3 GiB RAM per active Agent (1.29 GiB, 1.6% CPU, 11 processes). With the default limit of 3 parallel Agents the planning budget is about 4 GiB on top of the macOS workload. SR-37 requires per-environment CPU/memory/pids limits and bounded queues. `maxParallelAgents` itself is enforced by the scheduler (OVE_PROV019); this task only prevents the host from being driven into swap by whatever the scheduler admits.

## 3. Scope (in)

- Config section schema and defaults, validation ranges, secret-free.
- `ResourceGate.admit(request)` host memory admission and `ResourceMonitor` (stats polling, OOM detection).
- `sandbox.resource_limit` behaviour (queue hint to the scheduler).
- `stats()` implementation of the port.

## 4. Out of scope

- Concurrency limiter and queue (OVE_PROV019). Disk quotas on `/work` (host filesystem, informational only, ESC-070). UI for settings (SETUI).

## 5. Detailed requirements

1. **Config section** `sandbox` (zod, file `sandbox.config.ts`): `cpus` default 2 (1..8), `memoryMiB` default 4096 (1024..16384), `memoryEstimateMiB` default 1536 (planning value used by admission), `pidsLimit` default 512 (64..4096), `tmpfsTmpMiB` 512, `tmpfsHomeMiB` 256, `idleStopSeconds` 600, `idleDestroySeconds` 3600, `maxExecPerEnv` 8, `credentialScope` `'cli'|'cli-workspace'` default `'cli'`, `reaperIntervalSeconds` 300 (60..3600), `statsIntervalSeconds` 15, `minFreeMemoryMiB` default 2048, `askTimeoutMs` 120000. Values come from BOX001's ADR where it differs. The section never contains paths or secrets.
2. **Limits at creation:** values map to the spec (`resources` input of BOX007) and the runtime flags (`--cpus`, `--memory`, pids limit if supported by the CLI; if the CLI has no pids flag, the capability probe marks `pidsLimit` unavailable and the image supervisor enforces `ulimit -u` for the `agent` user as an in-container fallback, verified by ESC-070).
3. **Admission (`ResourceGate.admit`)**: reads host memory facts through `ProcessRunner` (`vm_stat`, `sysctl -n hw.memsize` with absolute paths) and the sum of `memoryEstimateMiB` of running Environments; refuses when `freeAndReclaimableMiB < memoryEstimateMiB + minFreeMemoryMiB` returning `box.resource_limit` with `retryAfterMs` and an event `sandbox.admission_denied`; allows when `host total < 8 GiB` only with a startup warning event (`sandbox.low_memory_host`). Admission is advisory for the scheduler (it requeues) and hard for `createEnvironment` (fail, no bypass flag).
4. **Monitor:** every `statsIntervalSeconds` for each running Environment call `ContainerCli.stats`; keep a ring of the last 20 samples; detect: memory above 90% of limit for 3 consecutive samples (`sandbox.resource_pressure`), OOM kill (container exit with OOM indication or `oomKilled` in inspect) => `box.oom_killed` event and audit, pids near the limit, CPU saturation above 95% for 2 minutes (informational). The monitor never kills an Environment by itself except on OOM already done by the kernel; policy actions (stop an Agent) are the scheduler's.
5. **Port `stats(id)`:** returns `{ memoryBytes, memoryLimitBytes, cpuPercent, pids, sampledAt }` from the latest sample or a fresh call if older than the interval.
6. **Config change handling:** limits changed in settings apply to Environments created afterwards; running ones keep theirs (documented in settings help text keys `settings.sandbox.applies_to_new`).
7. **Test hooks:** `ResourceGate` takes a `HostMemoryProbe` interface so tests use fixed numbers; fixtures from real `vm_stat` output.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AppConfig` section mechanism and `ConfigStore` (OVE_ARCH005), `ProcessRunner`, `Clock`, `EventBus`, `ContainerCli.stats` (BOX003).

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/resources/{resource-gate.ts,host-memory-probe.ts,monitor.ts,oom.ts}`; the config schema in `packages/contracts/src/config/sections/sandbox.config.ts` (picked up by the config generator). Pure parsing for `vm_stat`.

## 9. Security and safety

Resource exhaustion by a malicious or runaway Agent (fork bomb, memory balloon, disk fill) must not take down the Mac or the engine (SR-37, ESC-070). Hard limits live in the runtime and in the container, not in the Agent's cooperation. The probe uses absolute command paths and a minimal env. Metrics contain no paths or command lines. If admission cannot be computed (probe failure) the answer is deny with retry, never allow blindly.

## 10. Errors and edge cases

- `vm_stat` output format change: parser rejects, admission denies with `box.cli_output_unparseable` and an issue in health.
- Host under memory pressure from other apps: admission keeps Agents queued; the Owner sees a status via the event (CHIEF/NOTIF decide wording).
- Stats call fails for a container that just exited: ignored once, Environment state reconciled by lifecycle.
- Config set to values above host capability (16 GiB limit on 8 GiB Mac): validation passes (limit is a ceiling), admission still protects the host.
- Clock/timer drift: intervals use monotonic time.

## 11. Acceptance criteria

- [ ] Config defaults and ranges validate; out-of-range values are rejected with field-specific errors; `contracts:check` snapshot updated.
- [ ] Admission denies when free memory is below the threshold and allows above (table tests with fixture outputs).
- [ ] OOM exit is converted into `box.oom_killed` and an audit event within one monitor interval.
- [ ] Limits appear in the `run` argv (or the supervisor fallback is active) for every created Environment.
- [ ] Probe failure denies admission.
- [ ] Settings changes affect new Environments only.

## 12. Test plan

Unit tests for config schema, vm_stat parser, admission arithmetic, monitor state machine with fake clock; integration (macOS runner) for the fork-bomb and memory balloon cases through TEST007 ESC-070. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/resources`.

## 13. Parallelization notes

Config section file should merge early (BOX008, BOX009, BOX016 read it). PROV019 reads `ResourceGate` through an application interface (declared in this task's folder and re-exported by BOX022).

## 14. Open questions and assumptions

- ASSUMPTION: BOX001 ADR may change defaults; update the constants in this file only.
- Open: `container` pids limit flag availability (probed); fallback described above.
