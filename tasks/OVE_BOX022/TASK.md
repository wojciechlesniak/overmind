---
id: OVE_BOX022
title: Assemble the Sandbox facade, composition module and engine lifecycle hooks
area: BOX
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH006, OVE_ARCH012, OVE_ARCH014, OVE_BOX004, OVE_BOX008, OVE_BOX009, OVE_BOX010, OVE_BOX011, OVE_BOX012, OVE_BOX013, OVE_BOX014, OVE_BOX015, OVE_BOX016, OVE_BOX017, OVE_BOX018, OVE_BOX019, OVE_BOX020, OVE_BOX021, OVE_ENGINE029, OVE_PAUSE001, OVE_SETUP015]
soft_depends_on: [OVE_ARCH006]
provides: ["lib:sandbox-macos", "usecase:EnsureSandboxReady"]
needs: ["lib:composition-root", "port:Sandbox", "port:ProcessRunner", "port:JobScheduler", "port:PauseState", "lib:preflight"]
owns:
  - packages/adapters/sandbox-macos/src/index.ts
  - packages/adapters/sandbox-macos/src/sandbox-macos.ts
  - apps/engine/src/composition/modules/sandbox.module.ts
  - docs/sandbox/README.md
reads: ["packages/adapters/sandbox-macos/src/", "apps/engine/src/composition/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [5, 9, 20]
---

# OVE_BOX022: Assemble the Sandbox facade, composition module and engine lifecycle hooks

## 1. Summary

Compose the parts of the earlier BOX tasks into the class implementing `port:Sandbox` for macOS (`MacSandbox`), export the package entry points, register the composition module `sandbox.module.ts` (tokens for Sandbox, IsolationStatus, RequireIsolation, EgressDecider, WorktreeManager, SandboxSocketBridge) and define the engine start and stop sequences for the sandbox.

## 2. Context

`OVE_ARCH006` defines one module file per area with topological resolution and `start`/`stop` hooks (I/O only in `start`). Ports come from ARCH012 (`Sandbox`), BOX019 (`IsolationStatus`), BOX011 (`EgressDecider`), BOX014 (`WorktreeManager`), BOX020 (`SandboxSocketBridge`). TEST007 and other consumers need `lib:sandbox-macos`. The engine is a background service (ADR 0005) and must not leave Environments running unsupervised when it stops normally.

## 3. Scope (in)

- `MacSandbox implements Sandbox` as a thin facade.
- Public exports (`createMacSandbox`, types), `./testing` subpath declaration.
- Composition module, start and stop hooks.
- `usecase:EnsureSandboxReady` wrapper for the first-run wizard.
- `docs/sandbox/README.md` (module map, runbook).

## 4. Out of scope

- The parts themselves (BOX003..BOX021). Gateway route for sandbox status (ENGINE/CONNUI). Deciding when agents start or stop (PROV019).

## 5. Detailed requirements

1. **Facade:** delegates `capabilities/health/ensureReady` (BOX004), `createEnvironment/startEnvironment/stopEnvironment/destroyEnvironment/listEnvironments/updateMounts` (BOX008), `exec` (BOX010), `stats` (BOX017), `setEgressPolicy` (BOX012), `forwardPort` (BOX015). No logic beyond argument adaptation; returns `Result`, never throws for expected failures. There is no method that executes outside the sandbox.
2. **createMacSandbox(deps):** one factory taking ports (ProcessRunner, Logger, Clock, IdGenerator, EventBus, AtomicFileWriter, ConfigStore, AuditSink, ApprovalVerifier, PauseState, JobScheduler, RequestNetworkApproval, PreflightService, SecureRandom, AgentTokenIssuer, gateway socket path provider) constructing internal services once. Internal classes are not exported.
3. **Module** `sandbox.module.ts` via `defineModule`: provides `SandboxToken`, `IsolationStatusToken`, `RequireIsolationToken`, `EgressDeciderToken`, `WorktreeManagerToken`, `SandboxSocketBridgeToken`, `EnsureSandboxReadyToken`; `build` is synchronous with no CLI calls.
4. **Start hook, in order:** (1) create `run` and `sandbox` directories 0700, (2) preflight/health, (3) open the egress proxy host, (4) startup sweep (BOX016) then mark `sweepCompleted`, (5) schedule reaper and stats monitor, (6) subscribe to `PauseState` (close tunnels, refuse new Environments), (7) publish the initial `IsolationSnapshot`. A failing step does not stop the engine (the UI must show the problem); the sandbox is `blocked` (fail closed) with the reason in `IsolationStatus`.
5. **Stop hook (15 s budget):** stop accepting Environments, close tunnels, stop running Environments gracefully in parallel (10 s each), destroy ephemeral ones, close sockets and relays, revoke agent API relays. Over budget: `container kill` the rest and record them for the next sweep. A crash relies on BOX016.
6. **EnsureSandboxReady:** `execute({ approvalToken?, onProgress })` composes health, `ensureReady` with the token (BOX004), `ensureImage` (BOX006) and herdr verification, emitting progress phases `kernel`, `system`, `image`, `verify`; returns the `IsolationSnapshot`. This is the call ONB uses.
7. **Config:** reads the `sandbox` section (BOX017) at start and on live-change events; no `process.env` reads. Invalid values fail the sandbox start closed; defaults are not silently substituted.
8. **Package exports:** `.` (production) and `./testing` (BOX021); `sideEffects: false`; bundle excludes `./testing`.
9. **Docs:** module map, lifecycle diagram (Mermaid), ports and tokens, runbook ("sandbox blocked: what to check"), links to ADRs from BOX001/BOX002 and the escape docs.
10. **Linux CI:** composition with `FakeSandbox` overrides works in `createTestEngine`; a test asserts all tokens resolve and `build` performs zero runner calls.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineModule`/`composeEngine` (OVE_ARCH006), all BOX services, `DataDir` (ARCH005), `JobScheduler`, `createTestEngine`.

## 8. Architecture and code placement

Facade and factory in the adapter package; the module file is the only place importing concrete adapter classes. Adapter depends on application and contracts; the module depends on the adapter. SRP: facade delegates; DIP: ports only.

## 9. Security and safety

No Environment exists before the sweep and health succeed; the stop sequence reduces unsupervised containers; failures leave the engine up but the sandbox blocked (no agent command without isolation). The facade holds no secrets and registers no gateway routes.

## 10. Errors and edge cases

- Preflight throws at start: caught, sandbox blocked, retry at reaper interval.
- Stop during image build: build cancelled, partial image cleaned.
- Hot reload in dev: second `start` is idempotent.
- Sleep/wake: health rechecked, tunnels verified, dead Environments marked failed.
- Non-macOS dev machine: real adapter returns `box.os_unsupported`; fakes via overrides.

## 11. Acceptance criteria

- [ ] `MacSandbox` passes the shared `Sandbox.contract` suite (fake runner; real subset on macOS runner).
- [ ] Composition test: all tokens provided, no I/O in `build`, start order as in requirement 4.
- [ ] A failing sweep leaves the engine up with `IsolationStatus` blocked (`sweep_pending`).
- [ ] Graceful stop stops running Environments in budget; over budget kills the rest.
- [ ] `EnsureSandboxReady` emits progress and never performs setup without an approval token.
- [ ] `./testing` is exported and excluded from the engine bundle.

## 12. Test plan

Fake-based unit/integration tests on Linux (`sandbox.module.test.ts`, facade delegation tables); macOS runner runs TEST007 against this assembly. Commands: `pnpm vitest run packages/adapters/sandbox-macos apps/engine/src/composition/modules/sandbox`, `pnpm escape-tests --impl sandbox-macos`.

## 13. Parallelization notes

Last BOX task. Hotspot: `sandbox-macos.ts` (single owner). Others depend on capability names, not paths.

## 14. Open questions and assumptions

- ASSUMPTION: Environments are not auto-resumed at engine start; PROV009 decides after the sweep and gate.
- Open: surviving engine restarts without stopping Agents; MVP stops them and resumes sessions with `--resume` (ADR 0026).
