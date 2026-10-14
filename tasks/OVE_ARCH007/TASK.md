---
id: OVE_ARCH007
title: Provide ULID id generation and the Clock port with system implementations
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH001, OVE_ARCH003]
soft_depends_on: []
provides: ["port:Clock", "port:IdGenerator", "lib:ids", "contract:EntityId"]
needs: []
owns: ["packages/contracts/src/kernel/ids.ts", "packages/application/src/ports/Clock.ts", "packages/application/src/ports/IdGenerator.ts", "packages/adapters/system/src/clock/**", "packages/adapters/system/src/ids/**"]
reads: ["docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 14", "SPECIFICATION 19"]
adr_refs: [5, 8]
---

# OVE_ARCH007: Provide ULID id generation and the Clock port with system implementations

## 1. Summary

All time and randomness enter the system through two ports: `Clock` (now, monotonic time, sleep, timers) and `IdGenerator` (ULIDs with a typed prefix per entity). Domain and application code never call `Date.now()`, `Math.random()` or `crypto.randomUUID()`; tests substitute deterministic fakes.

## 2. Context

Event sourcing in SQLite (ADR 0019, spec 12) needs sortable, unique, collision-safe ids and trustworthy timestamps; Run replay and tests need determinism. ULIDs are lexicographically sortable by creation time, which keeps event log ordering simple. Boundary lint (ARCH002) forbids the ambient APIs in inner layers.

## 3. Scope (in)

- Branded id types and zod schemas in `packages/contracts/src/kernel/ids.ts`.
- Ports `Clock`, `IdGenerator`.
- `SystemClock`, `UlidIdGenerator` (monotonic within a millisecond) in `adapters/system`.
- Helper utilities: `Instant` ISO string type, duration parsing helpers (`ms`, `seconds`), `isoNow()` convenience through the port.

## 4. Out of scope

- `FakeClock` and `FakeIdGenerator`: `OVE_TEST002` (interface and required behaviours specified here).
- Entity-specific id schemas beyond the prefix registry: each area registers its prefix by adding a file under `packages/contracts/src/kernel/id-prefixes/<area>.ts`.
- Cryptographic randomness for tokens: `OVE_ENGINE` / SEC (separate `SecureRandom` port is defined in SEC005 if needed).

## 5. Detailed requirements

1. **Id format.** `<prefix>_<ULID>` where `ULID` is 26 chars Crockford base32, e.g. `run_01JC8Z3Q7M5V9K2X4T6W8Y0ABC`. Prefix registry (initial): `ws` Workspace, `agt` Agent, `run` Run, `nex` NodeExecution, `wfl` Workflow, `wfv` WorkflowVersion, `tsk` Task, `lan` Lane, `brd` Board, `dsc` Discussion, `dec` Decision, `msg` ChatMessage, `amg` AgentMessage, `cnv` Conversation, `apr` ApprovalRequest, `acr` AccessRequest, `aud` AuditEvent, `evt` domain event, `skl` Skill, `skv` SkillVersion, `art` Artifact, `con` Connection, `ntf` Notification, `req` request/correlation id, `rul` OwnerRule. Areas add prefixes in their own file; the registry test enforces 3-letter lowercase and uniqueness.
2. Types: `type EntityId<P extends string> = string & { readonly __prefix: P }` plus zod `entityId('run')` that validates prefix and ULID alphabet/length (26, first char <= `7`), and `parseEntityId`. Ids are opaque to clients except for prefix checks.
3. `IdGenerator`:
   ```ts
   export interface IdGenerator { next<P extends IdPrefix>(prefix: P): EntityId<P>; }
   ```
   The system implementation is monotonic: ids generated within the same millisecond increase (increment the random part), and clock regression never produces a smaller id than the previous one (keeps last timestamp). Randomness from `node:crypto.randomBytes` inside the adapter only.
4. `Clock`:
   ```ts
   export interface Clock {
     now(): Date;                        // wall clock
     nowIso(): string;                   // UTC ISO-8601 with ms, 'Z'
     monotonicMs(): number;              // performance.now()-like, never decreases
     sleep(ms: number, opts?: { signal?: AbortSignal }): Promise<void>;
     setTimer(fn: () => void, ms: number): Cancel;      // one-shot
     setInterval(fn: () => void, ms: number): Cancel;
   }
   ```
   `sleep` rejects with `internal.cancelled` (AppError) on abort. Timers are cancelled idempotently. `unref` semantics: timers do not keep the engine process alive unless created through `setTimer(..., { ref: true })` (explicit).
5. Persisted timestamps are ISO-8601 UTC strings produced by `nowIso()`; do not store local time. The UI formats with the user's locale and time zone.
6. Domain functions that need time receive it as a parameter (`now: Date`) or via an injected `Clock` in use cases. Domain code never imports the port directly (domain has no application dependency); use cases pass `clock.now()` into domain calls.
7. Contract tests for `Clock` and `IdGenerator` (suites defined for TEST003): ordering/monotonicity, sleep cancellation, timer cancellation idempotence, ids uniqueness over 100k generations, ULID format, prefix validation. Both `SystemClock`/`UlidIdGenerator` and the fakes MUST pass the same suites.
8. FakeClock requirements (implemented in TEST002): `advance(ms)` runs due timers in order, `set(date)`, timers created inside timers fire within the same `advance`, `sleep` resolves upon advance. FakeIdGenerator: deterministic counter-based ULIDs, per-prefix sequences, `reset()`.
9. Provide `docs` snippet (in `packages/adapters/system/README.md`) with usage examples. No other documentation file.
10. Performance: `next()` under 5 microseconds on average (benchmark in test, informational).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Registered in the composition root via `system.module.ts` (ARCH006) as providers of `ClockToken`, `IdGeneratorToken`. Logger (ARCH004) uses `Clock`. Every repository and use case creating entities uses `IdGenerator`.

## 8. Architecture and code placement

Ports in `packages/application/src/ports/`. Branded ids in `contracts` so UI and api-client share them. Adapters in `packages/adapters/system/src/{clock,ids}/`. Dependency direction: adapters -> application ports -> contracts.

## 9. Security and safety

Ids are identifiers, not secrets: they MUST NOT be used as tokens, capability URLs or approval secrets (ULIDs are guessable by time). Approvals and session tokens use a separate secure random source (SEC005). Sortable ids leak creation time; acceptable (single-owner local app). Clock manipulation by the system clock being changed must not break monotonic ordering of ids or of `monotonicMs`-based timeouts (budgets, timeouts use monotonic time).

## 10. Errors and edge cases

- Clock goes backwards (NTP step): ids stay monotonic; `now()` may go back, `monotonicMs()` does not; document.
- Random part overflow in one millisecond (2^80 increments) is theoretical; throw `InvariantError`.
- Invalid id string at API boundary: zod error becomes `validation.invalid_input`.
- `sleep(0)` yields to the event loop; negative values treated as 0.
- Timer callbacks that throw: caught, logged (`error`), never crash the process (logger injected into the adapter).

## 11. Acceptance criteria

- [ ] 100k ids generated in a tight loop are unique and strictly increasing.
- [ ] After simulating a clock regression, ids still increase.
- [ ] `entityId('run').parse('run_...')` accepts valid ids and rejects wrong prefix, wrong length, lowercase, illegal letters I, L, O, U.
- [ ] Prefix registry rejects duplicates and non 3-letter lowercase prefixes.
- [ ] `sleep` with abort rejects with `internal.cancelled`; `setTimer` cancel is idempotent.
- [ ] Both system and fake implementations pass the shared contract suites.
- [ ] No `Date.now`/`Math.random`/`randomUUID` usage in inner layers (lint from ARCH002 passes).

## 12. Test plan

- `ids.test.ts` (format, schema, registry), `ulid-id-generator.test.ts` (monotonic, regression using an injected time source), `system-clock.test.ts` (timers with real short delays, tolerance), contract suites `Clock.contract.ts`, `IdGenerator.contract.ts` (placed under `packages/testing/src/contracts/`, TEST003 harness).
- Commands: `pnpm vitest run packages/contracts packages/adapters/system`.

## 13. Parallelization notes

Very small and on the critical path: merge interfaces and branded ids first, then adapters. Unblocks ARCH004, ARCH005, ARCH010, TEST002 and all repositories. Id prefix files are per area (no conflicts).

## 14. Open questions and assumptions

- ASSUMPTION: custom ULID implementation (about 60 lines) to avoid a dependency; if `ulid` npm package is preferred, justify in the PR (MIT, small) and wrap it behind the same adapter.
- ASSUMPTION: prefix list above is the initial registry; areas add more through `id-prefixes/<area>.ts`.
