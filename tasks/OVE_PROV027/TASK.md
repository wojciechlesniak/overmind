---
id: OVE_PROV027
title: Implement StartAgentSession (Environment, token injection, herdr, CLI start in /work)
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_BOX006, OVE_BOX007, OVE_BOX009, OVE_BOX014, OVE_BOX019, OVE_BOX020, OVE_BOX022, OVE_ENGINE016, OVE_ENGINE028, OVE_PERM017, OVE_PROV005, OVE_PROV007, OVE_PROV009, OVE_PROV012, OVE_PROV019, OVE_PROV025, OVE_PROV034]
soft_depends_on: [OVE_PROV028]
provides: ["usecase:StartAgentSession", "usecase:EnsureAgentEnvironment"]
needs: ["usecase:RequireIsolation", "usecase:PrepareRunMounts", "lib:environment-spec-builder", "lib:credential-volumes", "port:WorktreeManager", "port:Sandbox", "port:SandboxSocketBridge", "port:AgentTokenIssuer", "port:ConcurrencyLimiter", "usecase:ResolveModelForAgent", "port:TerminalLayer", "contract:CliProfile", "port:AuditSink", "port:Clock", "port:EventBus", "lib:image-provisioner"]
owns:
  - packages/application/src/prov/session/start/**
reads: ["docs/research/prototyp-wnioski.md", "packages/application/src/ports/AgentSessionGateway.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 12"]
adr_refs: [4, 20, 22, 26, 27]
---

# OVE_PROV027: Implement StartAgentSession (Environment, token injection, herdr, CLI start in /work)

## 1. Summary

The single use case that turns "this Agent needs a live CLI" into a running, isolated session: isolation check, concurrency slot, Environment from the PERM mount plan, git worktree, credential volume, token and variables, herdr server, detection rules, Skill "overmind", named CLI started in `/work`. It fails closed at every step and cleans up what it created.

## 2. Context

AGENT012 and CHAT008 start sessions lazily (agent without a session), WFRT starts them for node execution. Everything the Environment needs is provided by BOX and PERM; the CLI itself is started through `TerminalLayer` (PROV005). Tokens: `AgentTokenIssuer.mint` (ENGINE028) returns the token in memory; BOX020 defines the variables `OVERMIND_API_SOCKET=/run/overmind/agent-api.sock`, `OVERMIND_API_URL=http://127.0.0.1:7077`, `OVERMIND_RUN_ID=<runId>`, and the secret `OVERMIND_API_TOKEN`; the token is passed as `secretEnv` through `Sandbox.exec`, never via spec, labels, files under `/work` or the herdr command line. Prototype: Codex was started in `/` and wrote its file into the container root; `/work` must always be the working directory.

## 3. Scope (in)

- `StartAgentSession.execute` and its step pipeline with compensation (rollback).
- Reuse of a healthy existing Environment for the Agent.
- Variable and secret injection, herdr server start, rule and Skill installation hooks, CLI start, readiness check.
- Events and audit for the lifecycle.

## 4. Out of scope

- Concurrency policy (PROV019 provides the limiter), model choice (PROV025), session registry persistence and resume (PROV028), sending the first prompt (PROV029/caller), login (PROV014), stopping idle Environments (scheduler, PROV019), mount plan derivation (PERM017).

## 5. Detailed requirements

1. **Input/Output:** `{ agentId, workspaceId, runId?, wait?: 'queue'|'fail' (default 'queue'), modelOverride?: ModelRef }` returns `Result<{ session: SessionSnapshot; envId: EnvironmentId; terminal: TerminalRef; degraded: string[] }, AppError>`. Idempotent per Agent: when a live session exists, it is returned unchanged.
2. **Pipeline (each step has a compensating action):**
   1. `ResolveModelForAgent(agentId, modelOverride)` (PROV025); errors pass through (`provider.needs_login`, `provider.limit_reached`, ...), nothing is started.
   2. `RequireIsolation.execute({ purpose: 'start_session', ... })` returns a ticket or `box.isolation_unavailable`.
   3. `ConcurrencyLimiter.acquire({ agentId, runId, wait })`: slot or `prov.concurrency_limit`; the slot is released on any failure and when the session ends.
   4. `PrepareRunMounts` (PERM017) returns the verified `MountPlan` (empty plan: `perm.deny_by_default`, abort).
   5. `WorktreeManager.ensure` (BOX014) for the primary root; `integrity` problems abort with the BOX error.
   6. `credentialVolumes.volumesFor({ cli, workspaceId, isolatedWorkspace })` (BOX009), `buildEnvironmentSpec({ plan, imageRef, worktree, credentialVolumes, env })` (BOX007), `Sandbox.createEnvironment` + `startEnvironment` unless a running Environment for this Agent exists whose `specHash` matches (otherwise `updateMounts`, which BOX rejects while an exec runs: then `box.env_busy` passes through).
   7. `SandboxSocketBridge.attachAgentApi` and `open(envId, 'herdr')` (BOX020), then `prepareBinaries` is done by the lifecycle hook; the herdr server is started by the image entrypoint when `OVERMIND_START_HERDR=1`; readiness = `server.ping` through the client within 20 s.
   8. `AgentTokenIssuer.mint({ runId, agentId, workspaceId })`; token kept in a local variable only. Variables are `agentApiEnv(envId, runId)` of BOX020 plus `HERDR_AGENT=<terminalName>`; the token goes into `secretEnv.OVERMIND_API_TOKEN` of the exec that starts the CLI. If `runId` is absent (direct chat), a chat-scoped run id from the caller is required; absent means `internal.invalid_input`.
   9. `installDetectionRules(envId)` (PROV007), `installOvermindSkill(envId, agent)` (PROV012); failures of rules are warnings (degraded), failure of the Skill is fatal (the Skill is the report channel, ADR 0027).
   10. `TerminalLayer.attach` + `startAgent({ kind, cwd: '/work', resume? })`; the `CliProfile` of the chosen provider (PROV034; concrete profiles PROV010/PROV011) supplies the exact `LaunchSpec` (argv and safe env), validated by `validateLaunchSpec`; the resume case is PROV028.
   11. Wait for `pending -> idle` (prompt visible) up to 30 s; states `needs_login`/`selection_prompt` at this point are not errors: the session is returned with the observation so PROV013/PROV014 can act; `stopped` is an error (`prov.session_unavailable`).
2a. **Reusable part:** steps 2, 4, 5, 6 and 7 (isolation ticket, mount plan, worktree, Environment, bridges, herdr readiness) are exposed as `EnsureAgentEnvironment.execute({ agentId, workspaceId, runId, purpose: 'session'|'text_only' }): Result<{ envId; created: boolean }>`; `StartAgentSession` composes it. The one-shot text-only completions of the CLI providers (PROV010, PROV011, used by PROV031 and PROV032) call it with `purpose: 'text_only'`, which skips the concurrency slot, the CLI start, the token and the herdr readiness wait (tool-free calls hold no slot and mint no Agent token).
3. **Fixed values:** working directory is `/work` (subdirectory only if `/work/<relative>` is requested and validated); one Environment per Agent (BOX001); user `agent`; no root, no additional mounts from this use case.
4. **Compensation:** on failure after step 6 the use case stops the CLI if started, revokes the token (`revokeAgent` is not used: `revokeRun` only when no other session of the Run exists), releases the slot, and keeps the Environment for reuse unless it was created in this call and is not yet verified (then `destroyEnvironment`). The Worktree and its branch are never removed.
5. **Concurrency and cancellation:** per Agent mutex; `AbortSignal` honoured between steps; a cancelled start releases everything created.
6. **Events and audit:** `provider.session_starting`, `provider.session_started { agentId, envId, providerId, modelId, resumed }`, `provider.session_start_failed { code }` (ids only), written through `AuditSink`; token values, env values and argv never appear.
7. **Timing budget:** target under 20 s for a warm Environment and under 60 s for a cold one (BOX001 measurement is the reference; slower start logs `provider.session_slow`).
8. **Pause:** a start while paused returns `prov.paused` before step 2 (PERM029 rules).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

BOX ports listed in `needs`; `PrepareRunMounts` (PERM017); `ResolveModelForAgent` (PROV025); `TerminalLayer` (PROV005); detection rules (PROV007); Skill installer (PROV012); limiter (PROV019). No logic from these may be re-implemented here.

## 8. Architecture and code placement

`packages/application/src/prov/session/start/{start-agent-session.ts,steps/*.ts,compensation.ts,env-vars.ts}`; each step is a small function over ports (SRP) composed by a pipeline runner (OCP: add a step by adding a file). Application layer only; the CLI-specific launch details come from the `CliProfile` looked up in the `CliProfileRegistry`, not from `if (provider === 'claude')` branches.

## 9. Security and safety

This use case wires the isolation, so every step fails closed: no ticket, no Environment, no CLI. The token is minted late, held in memory, injected as `secretEnv` only, bound to run and agent (ENGINE028), and revoked on failure. The real host gateway socket path never reaches the Environment (ESC-040); only the relay endpoint exists. Mounts come only from the PERM plan, `/work` is fixed, the CLI never starts in `/`. Malicious repository content cannot influence any step: the pipeline reads no file from `/work`. Symlinks in the work directory are handled by BOX007/BOX014 (canonicalisation, in-container realpath), not here. Audit events carry ids only.

## 10. Errors and edge cases

- Engine restart mid-start: no registry entry was committed (PROV028 commits at the end); the reaper (BOX016) removes the orphan Environment; token expired with the process.
- Environment exists but its `specHash` differs because the plan changed: updated if idle, `box.env_busy` otherwise (caller retries later).
- herdr readiness timeout: stop, destroy (if created now), `prov.session_unavailable` (retryable).
- Slot available but memory admission refuses (BOX017): `box.resource_limit` with `retryAfterMs`; slot released; with `wait: 'queue'` the use case requeues once the scheduler signals.
- Provider limit reached just before start: `ResolveModelForAgent` returns the fallback model (PROV018) when configured.
- Start while the Run is already cancelled: `internal.cancelled`, nothing created.

## 11. Acceptance criteria

- [ ] With fakes, a cold start produces: ticket, slot, Environment, bridge, token minted once, rules and Skill installed, CLI started with `cwd '/work'`, session returned `idle`.
- [ ] The token appears only in `secretEnv` of one exec; searching spec, labels, argv, logs and audit finds none (`expectNoSecrets`).
- [ ] Failure injected at each step releases the slot, revokes the token and leaves no Environment created by this call (table test over steps).
- [ ] Without isolation (`box.isolation_unavailable`) nothing is created; with Global Pause `prov.paused`.
- [ ] A second call for the same Agent returns the existing session without creating anything.
- [ ] Empty mount plan aborts with `perm.deny_by_default`.
- [ ] Start returns a session with `needs_login` observation without failing when the CLI shows the login screen (fake-claude scenario).

## 12. Test plan

Unit/integration with `FakeSandbox`, `FakeHerdr`, fake token issuer, fake limiter and `fake-claude`/`fake-codex` scenarios (`login_expired`, `choice_dialog`, `slow_start`); step-failure table; abort tests; secret scan. Commands: `pnpm vitest run packages/application/src/prov/session/start`. One opt-in real-container integration test tagged `real-sandbox` (also used by TEST007).

## 13. Parallelization notes

Large fan-in: needs many ports, so start against fakes as soon as PROV009 and PROV005 types exist. Hotspot: none (own folder). PROV028 adds the registry commit through an `afterStart` hook point in this pipeline; agree on the hook name `SessionCommitStep` (declared here).

## 14. Open questions and assumptions

- ASSUMPTION: `buildEnvironmentSpec` accepts the credential volume refs and `env` map exactly as in BOX007's `BuildSpecInput`; if the shape differs the implementer adapts at the call site, not in BOX.
- ASSUMPTION: one Environment per Agent (BOX001 decision); if BOX001 chooses per Workspace, step 6 selects by Workspace and step 10 starts a second terminal in the same Environment.
- Open: direct chats outside a Run need a chat-scoped run id; CHAT008 supplies one (flagged for CHAT/ENGINE028).
