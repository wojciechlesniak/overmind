---
id: OVE_PROV019
title: Enforce the parallel Agent limit (default 3) with queue, idle policy and ProvConfig
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_BOX017, OVE_ENGINE016, OVE_ENGINE029, OVE_PAUSE001, OVE_PROV009]
soft_depends_on: [OVE_PROV027, OVE_PROV028, OVE_BOX016]
provides: ["port:ConcurrencyLimiter", "adapter:InMemoryConcurrencyLimiter", "lib:idle-environment-policy", "contract:ProvConfig", "event:provider.concurrency_changed"]
needs: ["contract:AppConfig", "port:ConfigStore", "port:Clock", "port:EventBus", "port:JobScheduler", "port:PauseState", "port:Sandbox", "port:AuditSink", "lib:define-event", "lib:sandbox-resources"]
owns:
  - packages/application/src/prov/concurrency/**
  - packages/application/src/ports/ConcurrencyLimiter.ts
  - packages/contracts/src/config/sections/prov.config.ts
  - packages/contracts/src/events/provider.concurrency_changed.event.ts
reads: ["docs/SPECIFICATION.md", "packages/adapters/sandbox-macos/src/resources/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 20, 22]
---

# OVE_PROV019: Enforce the parallel Agent limit (default 3) with queue, idle policy and ProvConfig

## 1. Summary

Only three Agents run at the same time on the whole installation by default (Spec 9, criterion 14), because the subscription limit is shared and each Agent costs about 1.3 GiB of RAM. This task implements the `ConcurrencyLimiter` (slots, fair queue, leases that survive crashes), the policy that stops and destroys idle Environments, and the `prov` configuration section that holds every PROV tunable in one place.

## 2. Context

Spec 9: default 3 Agents at once for the whole installation, changeable in settings; later an option where Chief sizes it to the remaining limit (not planned here). BOX017 provides memory admission (`ResourceGate.admit`) and states that `maxParallelAgents` is enforced by the scheduler, here. BOX008 leaves idle stop/destroy decisions to this scheduler using `lastActivityAt` and BOX001 constants. Sessions are started by PROV027 (which calls `acquire`) and recovered by PROV028. `waiting_approval` or `needs_login` agents hold their slot (they are still alive); stopped sessions release it.

## 3. Scope (in)

- `ConcurrencyLimiter` port and in-memory implementation with persistence-free leases rebuilt from the session registry at start.
- Fair FIFO queue with per-request timeout; priority for Owner direct chats over workflow turns (ASSUMPTION).
- Idle Environment policy and its job.
- `ProvConfig` zod section (all PROV tunables), config change handling.
- Status for UI: active, queued, limit.

## 4. Out of scope

- Memory admission itself (BOX017), starting and stopping sessions (PROV027/PROV029), Chief-driven dynamic limits (later), Run scheduling and parallel node slots (WFRT034 uses this port's status), Settings UI (SETUI).

## 5. Detailed requirements

1. **Port:**
   ```ts
   interface ConcurrencyLimiter {
     acquire(req: { agentId: AgentId; runId?: RunId; priority: 'owner_chat'|'run'; wait: 'queue'|'fail'; signal?: AbortSignal }): Promise<Result<SlotLease, AppError>>;
     release(lease: SlotLease | { agentId: AgentId }): Promise<void>;                // idempotent
     renew(lease: SlotLease): void;                                                  // heartbeat
     status(): { limit: number; active: number; queued: number; leases: { agentId; since }[] };
     setLimit(n: number): void;                                                      // from config change
   }
   ```
   `acquire` for an Agent that already holds a lease returns the same lease (idempotent). `wait: 'fail'` with no free slot returns `prov.concurrency_limit` (details `{ limit, active }`).
2. **Limit:** `ProvConfig.maxParallelAgents` default 3, range 1..16 (the hard ceiling 16 protects the machine; BOX017 admission still applies per Environment). A change applies to new acquires immediately; a lowered limit never kills running Agents (they finish; new ones wait).
3. **Queue:** FIFO within priority class; `owner_chat` served before `run` but a `run` request waiting longer than 5 min is promoted (starvation guard). Queue timeout `queueTimeoutMs` default 900000, then `prov.concurrency_limit` (retryable). The queue is bounded (100); beyond that `prov.concurrency_limit` immediately.
4. **Leases and crash safety:** a lease has a heartbeat (`renew`, every 30 s from the observer) and expires after 3 missed beats unless the registry still shows a live session (checked before expiry); leases are rebuilt at engine start from the session registry (PROV028 recovery calls `acquire` for resumed sessions in priority order, respecting the limit). A lease whose session ended is released by PROV029 `stop` and by the observer on `stopped`.
5. **Admission coupling:** after a slot is granted, the caller (PROV027) still goes through `ResourceGate.admit`; if admission fails with `box.resource_limit` the caller releases the slot (this task exposes `releaseOnFailure` helper; no coupling code here beyond the documented sequence).
6. **Pause:** while Global Pause is on, `acquire` returns `prov.paused`; queued requests are rejected with `prov.paused` when Pause starts; leases of running sessions remain.
7. **Idle policy (`IdleEnvironmentPolicy`, job every `reaperIntervalSeconds` from `SandboxConfig`):** for each Environment from `Sandbox.listEnvironments` with a lease-free Agent: stop when idle longer than `idleStopSeconds` (default 600, BOX017) and destroy when stopped longer than `idleDestroySeconds` (default 3600). Idle means: no lease, no running exec (BOX010 `lastActivityAt` older than the threshold), no open Approval or Access Request for the Agent, no unresolved delivery, no active Run node. Environments with a lease are never stopped. Credential volumes are never touched. Stop/destroy go through `Sandbox.stopEnvironment`/`destroyEnvironment` (no force); `box.env_busy` is retried at the next tick.
8. **Events:** `provider.concurrency_changed { limit, active, queued }` (non-persisted, throttled to 1/s) for the UI status bar and the tray; audit `provider.slot_acquired/released` aggregated per minute.
9. **`ProvConfig` (zod, file `prov.config.ts`, section `prov`):** `maxParallelAgents` 3; `queueTimeoutMs` 900000; `verifyStartMs` 5000 (PROV008); `noWorkTimeoutMs` 20000 and `stallMs` 300000 (PROV015); `loginTtlMs` 300000 (PROV014); `usageProbeIntervalMs` 900000 (PROV017); `limitConfirmSamples` 2 (PROV018); `fallbackDecidedBy` `'chief'|'provider'` default `'chief'`; `autoSwitchBack` true; `fallbackChain` `['other_cli','ollama']`; `fallbackOnLoginExpired` false; `termsCheckIntervalDays` 7 (PROV023); `ollamaMaxConcurrent` 2 (PROV016). No paths and no secrets. All values documented with ranges; unknown keys rejected; hot reload via `config.changed` (ENGINE024) calls `setLimit`.
10. **Status:** `status()` is synchronous and cheap; PROV021 uses `active` for `activeAgents` in `connections.status`.

## 6. Design notes

N/A, functionality only. Settings labels belong to SETUI ("Parallel Agents": 1..16, default 3).

## 7. Reuse

Memory admission and `sandbox` config (BOX017), `Sandbox` lifecycle (ARCH012/BOX008), `JobScheduler`, `Clock`, `PauseState` (PERM010), config pipeline (ARCH005, ENGINE024), `defineEvent` (ARCH010).

## 8. Architecture and code placement

`packages/application/src/prov/concurrency/{in-memory-limiter.ts,queue.ts,lease.ts,idle-policy.ts,idle-job.ts}`; port `packages/application/src/ports/ConcurrencyLimiter.ts`; config `packages/contracts/src/config/sections/prov.config.ts`; event file under `packages/contracts/src/events/`. Pure logic over ports (queue and lease are deterministic with an injected `Clock`). No SQLite: leases are rebuilt from the registry, avoiding a second source of truth.

## 9. Security and safety

The limiter is a resource-safety control: it stops a runaway workflow or a malicious Agent message loop from spawning unbounded CLIs, Environments and subscription burn. Limits are enforced in the engine, not the UI; the hard ceiling cannot be raised by an Agent or by Telegram (config changes are Owner desktop scope, ENGINE024). Idle stop never touches an Environment with a pending Approval or unresolved delivery, so work is not lost silently. Queue and lease records contain ids only. Fail closed: if the limiter errors, no slot is granted.

## 10. Errors and edge cases

- Engine crash with leases held: leases are rebuilt from the registry; stale rows without a live terminal are released.
- Two simultaneous acquires for the same Agent: same lease returned.
- Limit lowered below active count: no kills; new acquires wait until `active < limit`.
- A resumed session after restart competes with queued requests: recovery acquires in the order owner_chat, run, oldest first.
- Idle policy races with a new acquire: the policy re-checks the lease immediately before `stopEnvironment`; `box.env_busy` is tolerated.
- Clock jump: monotonic timers for timeouts.
- Config value out of range: rejected by the schema, previous value kept.

## 11. Acceptance criteria

- [ ] With limit 3 and 5 acquires (`wait: 'queue'`), three run, two queue in FIFO order, and releasing one grants the next.
- [ ] `wait: 'fail'` returns `prov.concurrency_limit`; the queue times out after `queueTimeoutMs` (fake clock).
- [ ] Owner-chat requests are served before workflow requests, and a workflow request waiting over 5 min is promoted.
- [ ] A lease without heartbeat for 3 intervals is released unless the registry shows a live session.
- [ ] Pause rejects acquires and queued requests with `prov.paused`.
- [ ] Idle policy stops/destroys only lease-free, idle, approval-free Environments and never touches volumes.
- [ ] `ProvConfig` rejects out-of-range values and unknown keys; hot reload changes the limit without killing sessions.
- [ ] No more than `limit` sessions are ever started in a stress test with random acquire/release/abort sequences (property test).

## 12. Test plan

Deterministic unit tests with `FakeClock`; property test for the invariant `active <= limit` under random operations; idle policy tests with `FakeSandbox` and registry fakes; config schema tests. Commands: `pnpm vitest run packages/application/src/prov/concurrency packages/contracts/src/config/sections`.

## 13. Parallelization notes

Early merge helps PROV027 and PROV028. The `ProvConfig` schema is owned here; other PROV tasks only read keys (add keys by proposal to this task's owner).

## 14. Open questions and assumptions

- ASSUMPTION: Owner direct chats have priority over workflow turns when slots are scarce.
- ASSUMPTION: hard ceiling 16 and default 3 (Spec 9); the dynamic "Chief picks the number from remaining limit" option is later.
- Open: whether Discussion turns (tool-free, no session) consume a slot; default no, they use `TextCompletion` and are bounded by provider limits (PROV031).
