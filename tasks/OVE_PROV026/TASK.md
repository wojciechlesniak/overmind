---
id: OVE_PROV026
title: Compose the provider module (registry, ports, handlers, jobs, start and stop sequence)
area: PROV
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH006, OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_BOX019, OVE_BOX020, OVE_BOX022, OVE_ENGINE002, OVE_ENGINE004, OVE_ENGINE005, OVE_ENGINE016, OVE_ENGINE029, OVE_PROV004, OVE_PROV005, OVE_PROV008, OVE_PROV010, OVE_PROV011, OVE_PROV012, OVE_PROV013, OVE_PROV014, OVE_PROV015, OVE_PROV016, OVE_PROV017, OVE_PROV018, OVE_PROV019, OVE_PROV020, OVE_PROV022, OVE_PROV023, OVE_PROV025, OVE_PROV027, OVE_PROV028, OVE_PROV029, OVE_PROV034]
soft_depends_on: [OVE_PROV030, OVE_PROV031, OVE_PROV032, OVE_PROV021]
provides: ["lib:provider-module", "adapter:ProviderRegistry", "lib:provider-registry"]
needs: ["lib:composition-root", "lib:composition-root-wiring", "port:RecoveryParticipant", "port:ShutdownParticipant", "port:JobScheduler", "usecase:EnsureSandboxReady", "port:IsolationStatus", "port:SandboxSocketBridge", "port:Sandbox", "port:EventBus", "port:Clock", "port:Logger", "port:AuditSink"]
owns:
  - apps/engine/src/composition/modules/provider.module.ts
  - packages/adapters/providers/src/registry.ts
  - packages/adapters/providers/src/index.ts
  - packages/adapters/herdr/src/index.ts
  - docs/providers/README.md
reads: ["apps/engine/src/composition/", "packages/adapters/providers/src/", "packages/adapters/herdr/src/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 18, 22, 26]
---

# OVE_PROV026: Compose the provider module (registry, ports, handlers, jobs, start and stop sequence)

## 1. Summary

Wire every PROV piece into the engine through one composition module: the `ProviderRegistry` (the only place that knows the concrete providers), the CLI profiles, the herdr-backed terminal layer, the session gateway and its guard, handlers for blocked states, the limiter, the jobs (usage probes, detection, idle policy, terms check), and the start, recovery and stop order. After this task the rest of the engine consumes the PROV ports by token only.

## 2. Context

ARCH006 defines one module file per area with topological resolution and `start`/`stop` hooks (I/O only in `start`, `build` synchronous). ENGINE002 composes modules, ENGINE005 runs recovery participants at startup, ENGINE004 stops participants at shutdown. Sandbox (BOX022) provides `Sandbox`, `IsolationStatus`, `SandboxSocketBridge`, `EnsureSandboxReady`. The provider module must start after the sandbox module, must not start any CLI by itself, and must survive an unavailable sandbox (isolation fails closed: no sessions, detection `unknown`).

## 3. Scope (in)

- `ProviderRegistry` implementation (`ProviderRegistry` interface from PROV001) registering `claude`, `codex`, `ollama` and the CLI profiles.
- Composition module `provider.module.ts` with tokens for all PROV ports and use cases.
- Registration of handlers (`BlockedStateHandler`s), recovery participant, shutdown participant, jobs and config hot reload.
- Package entry points (`packages/adapters/providers/src/index.ts`, `packages/adapters/herdr/src/index.ts`).
- Start/stop sequence documentation.

## 4. Out of scope

- Any logic inside the wired components, routes (auto-registered, PROV021), sandbox module (BOX022), engine bootstrap (ENGINE002).

## 5. Detailed requirements

1. **Registry:** `DefaultProviderRegistry implements ProviderRegistry` (`get(id)`, `list()`, `capabilitiesOf(id)`); unknown ids return `provider.not_found` (fail closed). Registration is explicit in `registry.ts` (an array of factories `[claudeProvider, codexProvider, ollamaProvider]`); adding a provider is adding one line plus its package folder (OCP). `CliProfileRegistry` is filled from the same factory list and runs the launch-spec validator at registration (PROV034); an invalid profile aborts module start with `internal.invalid_config` (the app refuses to run with a bad profile).
2. **Tokens provided by the module:** `ModelProviderRegistryToken`, `TerminalLayerToken`, `HerdrClientFactoryToken`, `AgentSessionGatewayToken`, `DeliveryGuardToken`, `SessionRegistryToken`, `ConcurrencyLimiterToken`, `ConnectionRepositoryToken`, `ProviderUsageToken`, `ModelUsageRepositoryToken`, `FallbackRepositoryToken`, `ProviderHealthReaderToken`, `TermsStateRepositoryToken`, `TextCompletionToken` (a router over the providers by `providerId`), use case tokens (`StartAgentSession`, `EnsureAgentEnvironment`, `ResolveModelForAgent`, `ResolveModelSelection`, `SwitchAgentModel`, `HandleProviderLimit`, `DetectConnections`, `TestConnection`, `StartCliLogin`, `CancelCliLogin`, `GetCliLoginStatus`, `RunProviderTermsCheck`, `VerifyTurnOutcome`, `TranslateCliDialogToApproval`, `AnswerCliDialog`, `InstallSessionSkills`) and, when PROV030-PROV032 are present, `AgentTurnRunnerToken`, `DiscussionTurnRunnerToken`, `SummariserModelToken`.
3. **`build` (synchronous, no I/O):** constructs objects from ports; reads config section `prov` and `herdr`; no CLI, socket or database call.
4. **`start` order:** (1) wait for the sandbox module `start` (dependency declared), (2) register blocked-state handlers in this order: `NeedsLoginHandler` (PROV014), `PermissionDialogHandler` (PROV013), `LimitHandler` (PROV018), `UsageProbeHandler` (PROV017); each handler is independent and idempotent, (3) subscribe `connection.status_changed` for cache invalidation, (4) register the `RecoveryParticipant` that calls `RecoverAgentSessions` (PROV028) after BOX016's `sweepCompleted` and isolation ready, (5) start jobs through `JobScheduler`: `DetectConnections` (startup + every 30 min), usage probe scheduler, idle Environment policy, `RunProviderTermsCheck` (delayed 10 min), terms/usage/fallback retention jobs, (6) hot reload hook: `config.changed` -> `limiter.setLimit`, intervals.
5. **`stop` order (ShutdownParticipant):** stop jobs; stop observers and herdr client reconnect loops; close login forwards (BOX015) and cancel an active login session; release leases without stopping Environments or CLIs (work continues in the background service model and sessions are resumed after restart, ADR 0005); flush journals. Stop completes within 10 s; each step has its own timeout.
6. **Degraded start:** if the sandbox is not ready, the module still starts; `StartAgentSession` fails closed (`box.isolation_unavailable`), detection reports `unknown`, recovery is deferred until `IsolationStatus` becomes ready (subscription), Ollama and terms checks still run.
7. **Pause integration:** the module subscribes to Pause events only through the guard and limiter ports (no direct logic here).
8. **Fake composition:** `provider.module.fake.ts` (test composition) wires `FakeModelProvider`, `FakeTerminalLayer`, `FakeAgentSessionGateway` for `createTestEngine` (ENGINE018) and the dev mock mode (SETUP012); a release build assertion proves the fake module cannot be selected (shared with TEST006/TEST009 bundle checks).
9. **Entry points:** `packages/adapters/providers/src/index.ts` exports only the factories and types needed by the module (no internals); `packages/adapters/herdr/src/index.ts` exports `HerdrClient`, `HerdrTerminalLayer`, detection rule installer factories. Barrels are generated where the convention requires (ARCH009); these two files are hand-owned entry points.
10. **Docs:** `docs/providers/README.md` with the component diagram (herdr, gateway, guard, providers), start/stop sequences, tokens table, how to add a provider (profile, provider, registry line, hosts, fixtures, contract suite), and a security summary.
11. **Telemetry:** at start log the provider list, profile versions, herdr pinned version, config summary (no secrets) at `info`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineModule` and composition helpers (ARCH006), `RecoveryParticipant` (ENGINE005), `ShutdownParticipant` (ENGINE004), `JobScheduler`, sandbox module tokens (BOX022). No business logic is added; everything is delegation.

## 8. Architecture and code placement

Only the composition root layer may depend on all adapters: `apps/engine/src/composition/modules/provider.module.ts` imports from `packages/adapters/{providers,herdr,sqlite}` and `packages/application`. The registry lives in the providers adapter so the application layer never learns provider names. Dependency direction preserved: adapters do not import each other; the module wires them (CONVENTIONS section 6).

## 9. Security and safety

Composition is where a fake or unsafe implementation could be wired by mistake: the release build rejects the fake module; the module refuses invalid CLI profiles; no feature flag disables the guard, isolation ticket or login rules; handlers are registered unconditionally. Degraded start keeps the engine alive but blocks agent execution (fail closed). Startup logs contain no secrets. Stop never kills user work in sandboxes.

## 10. Errors and edge cases

- herdr bundle missing or tampered: `StartAgentSession` fails closed through BOX; module logs `provider.herdr_unavailable`; detection continues for Ollama.
- A handler throws: isolated (logged, audited), other handlers still run; the gateway never crashes on a handler error.
- Config invalid at start: engine start fails with a clear error (ENGINE002 behaviour), not a silent default.
- Duplicate provider id in the registry: start fails.
- Shutdown during an active login: forward closed, session cancelled.
- Module started twice in tests: idempotent `start` guards.

## 11. Acceptance criteria

- [ ] Engine composition starts with real wiring against fakes of Sandbox and herdr and exposes all listed tokens.
- [ ] An invalid CLI profile fixture aborts start; an unknown provider id returns `provider.not_found`.
- [ ] With a not-ready sandbox the module starts degraded, session start fails closed, recovery runs after the sandbox becomes ready.
- [ ] Stop order is verified (jobs, observers, forwards) and leaves Environments and sessions untouched.
- [ ] A release-mode build cannot select the fake provider module (assertion test).
- [ ] Handler registration order and idempotency are covered by tests; a throwing handler does not stop others.
- [ ] Dependency-boundary lint passes (adapters do not import each other, application imports no adapter).

## 12. Test plan

Composition tests with `createTestEngine`; start/stop sequence tests with fake scheduler and fake sandbox; degraded-start tests; release-build assertion test shared with TEST006/TEST009. Commands: `pnpm vitest run apps/engine/src/composition/modules/provider packages/adapters/providers/src/registry`.

## 13. Parallelization notes

Last in the PROV chain: needs the other tasks' factories (stubs possible). Hotspots: `provider.module.ts` and `registry.ts` (single owner). Optional tasks (PROV030-PROV032) register themselves by exporting factories listed here (one line each).

## 14. Open questions and assumptions

- ASSUMPTION: sessions and Environments keep running when the engine stops gracefully (background service model); resumption after restart is PROV028.
- Open: whether `TextCompletionToken` routing should prefer Ollama for summaries by default (decided in PROV032 config).
