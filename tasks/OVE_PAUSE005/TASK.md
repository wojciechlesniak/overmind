---
id: OVE_PAUSE005
title: "Provide the PauseGate port and its in-memory cached implementation"
area: PAUSE
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH010, OVE_PAUSE001, OVE_PAUSE002]
soft_depends_on: []
provides: ["port:PauseGate", "port:PauseGateControl", "lib:pause-gate", "lib:fake-pause-gate"]
needs: ["port:EventBus", "port:Logger"]
owns: ["packages/application/src/ports/PauseGate.ts", "packages/application/src/pause/gate/**", "packages/testing/src/fakes/FakePauseGate.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5]
---

# OVE_PAUSE005: Provide the PauseGate port and its in-memory cached implementation

## 1. Summary

Delivers `port:PauseGate`, the one hook through which the workflow runtime (WFRT), providers (PROV), chat (CHAT) and the gateway ask 'may I start work now?'. The implementation holds the current `PauseSnapshot` in memory so the check is synchronous and cannot fail because of I/O.

## 2. Context

Global Pause must take effect instantly and must not depend on a database read on every dispatch. The gate is a read-mostly cache updated whenever the use cases change state (read-your-write guaranteed) and rebuilt from the repository at boot. Consumers never import PAUSE use cases: they only depend on this small port (DIP, ISP). Fail closed: a gate that cannot determine the state answers 'paused'.

## 3. Scope (in)

- `PauseGate` (read) and `PauseGateControl` (write) interfaces and tokens.
- `PauseAction` classification and `check` semantics.
- `CachedPauseGate` implementation and `FakePauseGate` for other areas tests.
- Contract tests for both.

## 4. Out of scope

- Who calls `check` inside the workflow runtime, providers and chat: those areas (they `need` `port:PauseGate`).
- Draining and signalling in-flight work: OVE_PAUSE006.
- Reading state at boot: OVE_PAUSE008.

## 5. Detailed requirements

1. **Read port** (`packages/application/src/ports/PauseGate.ts`):
   ```ts
   export type PauseAction =
     | 'start_run' | 'dispatch_node' | 'send_to_agent' | 'start_chief_turn'
     | 'start_discussion' | 'resume_waiting' | 'approve_request' | 'schedule_trigger';
   export interface PauseGate {
     snapshot(): PauseSnapshot;                                         // sync, never throws
     isPaused(workspaceId?: EntityId<'ws'>): boolean;                  // global OR workspace
     guard(action: PauseAction, ctx?: { workspaceId?: EntityId<'ws'> }): Result<void, AppError>;   // err = pause.paused
     waitForResume(scope: PauseScope, opts?: { signal?: AbortSignal }): Promise<void>;
     subscribe(handler: (s: PauseSnapshot) => void): Unsubscribe;
   }
   export interface PauseGateControl { load(): Promise<Result<void>>; apply(s: PauseSnapshot): void; }
   export const PauseGateToken = token<PauseGate>('port:PauseGate');
   export const PauseGateControlToken = token<PauseGateControl>('port:PauseGateControl');
   ```
   Consumers MUST use `PauseGate` only; `PauseGateControl` is used by the pause module and use cases.
2. **Semantics of `guard`**: returns `err(pause.paused)` when the global scope or the given Workspace's scope is paused, for every `PauseAction`. Actions that REDUCE activity (cancel a Run, deny an Approval, read status, chat that only reads) do NOT call `guard`; the document lists them (see Design notes of `docs/architecture/pause.md`, section 'what still works while paused').
3. `approve_request`: approving an Approval or Access Request is blocked while paused (E33: 'disable Approval buttons that start work'); denying is always allowed. ASSUMPTION recorded in section 14.
4. **`CachedPauseGate`**: holds `PauseSnapshot` in a field; `apply` replaces it atomically (synchronous assignment of an immutable object) and then notifies subscribers in registration order, catching and logging handler errors. `waitForResume` returns a promise that resolves when the given scope (and global) are not paused, rejects with `internal.cancelled` on abort; promises are resolved in the same tick as `apply`.
5. **Initial state before `load()` completes is PAUSED** (`global.paused = true`, `via: 'system'`). `load()` reads the repository; success replaces the state; failure keeps it paused and returns the error (boot recovery decides what to tell the Owner, OVE_PAUSE008).
6. **Staleness protection**: the gate subscribes to `pause.changed` on the EventBus under the name `pause-gate` and applies `payload.snapshot` if its `global.version` and every listed scope version are not older than the cached ones; this keeps multiple publishers consistent. Use cases additionally call `await control.apply(...)` right after a successful save, so a `guard` call after the use case returned never sees the old state.
7. `FakePauseGate` in `packages/testing/src/fakes/` offers `setPaused({global?, workspaces?})`, records every `guard` call (`calls()`), and is the only fake other areas use in their tests.
8. Performance: `guard` is O(1) (a Set of paused workspace ids built at `apply`); target under 2 microseconds; no allocations on the hot path beyond the result object (a shared frozen `ok` is returned).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Result`, `AppError`, `pause.paused` (OVE_PAUSE001), `EventBus` (ARCH010), `Logger` (ARCH004). Contract suite `PauseGate.contract.ts` in `packages/testing/src/contracts/` is run for the real and the fake implementation (TEST003 conventions).

## 8. Architecture and code placement

Port in `packages/application/src/ports/PauseGate.ts`; implementation in `packages/application/src/pause/gate/cached-pause-gate.ts` (pure, no I/O: it receives the repository through `load()` via a function argument `() => repo.load()` supplied by the module, keeping it free of adapters). Dependency direction: consumers -> port <- implementation.

## 9. Security and safety

- Fail closed everywhere: unknown state means paused; a subscriber that throws cannot prevent the state change; there is no API to un-pause without going through a state snapshot that carries a valid version.
- `PauseAction` is a closed union so a new kind of work must be classified explicitly (lint rule: `guard` argument is not a string variable).
- Agents hold no reference to the gate: only engine modules do; agents learn about pause through the Skill status endpoint (OVE_PAUSE007).

## 10. Errors and edge cases

- `guard` called before `load()` finished: paused result, so nothing starts during boot.
- `apply` with an older snapshot (reordered events): ignored.
- Subscriber registered while an `apply` is notifying: receives the next snapshot only.
- Workspace resumed but global still paused: `guard` still errs (global wins).
- `waitForResume` for a Workspace that is deleted meanwhile: resolves when global is not paused (the scope no longer exists) so waiters do not hang forever.

## 11. Acceptance criteria

- [ ] Given a fresh gate before `load()`, Then `guard('start_run')` returns `pause.paused`.
- [ ] Given `apply` of a snapshot with Workspace A paused, Then `guard('dispatch_node', {workspaceId: A})` errs and the same call for B succeeds.
- [ ] Given global paused, When resumed via `apply`, Then pending `waitForResume` promises resolve and subscribers are called once.
- [ ] Given a stale snapshot (lower version), Then it is ignored.
- [ ] `FakePauseGate` and `CachedPauseGate` both pass `PauseGate.contract`.
- [ ] A throwing subscriber does not stop other subscribers.

## 12. Test plan

Unit and contract tests: `cached-pause-gate.test.ts`, `PauseGate.contract.ts` (also used with the fake), `wait-for-resume.test.ts`, `stale-snapshot.test.ts`, micro-benchmark guard (non-flaky threshold, skipped on CI by default). Commands: `pnpm vitest run packages/application/src/pause/gate`.

## 13. Parallelization notes

Can proceed after OVE_PAUSE001 using the in-memory repository fake; PAUSE002 is a soft prerequisite only for the integration test. WFRT, PROV and CHAT authors start against `FakePauseGate` as soon as this task's port file merges (put the port file in a tiny first PR).

## 14. Open questions and assumptions

- ASSUMPTION: approving an Approval or Access Request is blocked while paused (follows the E33 recommendation). Alternative: record the decision and release the Agent on resume. Owner may choose; the change is one line in `guard`'s action table.
- ASSUMPTION: chat to Chief that merely asks status through Telegram `/status` is a read and works while paused; free text to Chief or an Agent starts a model turn and is blocked.
