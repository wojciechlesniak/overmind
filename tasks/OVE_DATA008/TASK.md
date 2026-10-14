---
id: OVE_DATA008
title: Provide in-memory fakes for the data infrastructure ports and the SQLite contract runners
area: DATA
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_DATA002, OVE_DATA005, OVE_DATA006, OVE_DATA007, OVE_TEST002, OVE_TEST003]
soft_depends_on: []
provides: ["lib:data-fakes", "lib:sqlite-test-harness"]
needs: ["lib:contract-test-harness", "lib:test-utils", "port:EventBus"]
owns: ["packages/testing/src/fakes/InMemoryUnitOfWork.ts", "packages/testing/src/fakes/InMemoryEventStore.ts", "packages/testing/src/fakes/InMemoryCheckpointStore.ts", "packages/testing/src/contracts/UnitOfWork.contract.ts", "packages/testing/src/contracts/EventStore.contract.ts", "packages/testing/src/contracts/CheckpointStore.contract.ts", "packages/adapters/sqlite/test-support/**"]
reads: ["packages/testing/src/contracts/harness.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [19]
---

# OVE_DATA008: In-memory fakes and contract runners for the data infrastructure ports

## 1. Summary

Make every DATA infrastructure port testable without a database (fakes) and prove the fakes behave like the SQLite implementations (shared contract suites). Also provide a throw-away SQLite test harness other areas use for repository integration tests.

## 2. Context

TEST002/TEST003 define the pattern: one contract suite, N implementations. Use-case tests in all areas run against `InMemory*` fakes; adapter tests run the same suites against SQLite. Drift between them is the main risk for event/transaction semantics.

## 3. Scope (in)

- `InMemoryUnitOfWork`, `InMemoryEventStore`, `InMemoryCheckpointStore` with failure injectors.
- Contract suites `UnitOfWork`, `EventStore`, `CheckpointStore`.
- `createTestDatabase()` (temp-file SQLite with all migrations applied) and `withTestDatabase(fn)`.
- Runner files `*.contract.test.ts` for SQLite and fake.

## 4. Out of scope

- Fakes for entity repositories: each entity task owns its `InMemory<Entity>Repository` (DATA owns the ones for its entities: DATA010, 013, 015, 016).
- The harness itself: TEST003.

## 5. Detailed requirements

1. `InMemoryUnitOfWork` keeps registered in-memory repositories enrolled via `enroll(store)`; `run` snapshots enrolled state (structuredClone of Maps), restores on `err`/throw, discards `afterCommit` callbacks on rollback, serialises runs FIFO, supports nested joins and `failNextCommit()`.
2. `InMemoryEventStore`: ordered array, global `seq`, per-run `run_seq` gap-free, payload validation via the same registry as the real one, hash chain computed with the same `computeChainHash` so verifier tests run on both, `readSince` semantics including `resyncRequired`, immutable (no update/delete API except the test-only `cascadeDeleteWorkspace`).
3. `InMemoryCheckpointStore`: same `at_event_seq` rule, prune of 5.
4. Contract suites follow TEST003's `defineContract`: UnitOfWork (commit, rollback on err, rollback on throw, afterCommit order and discard, nested join, concurrent FIFO, timeout with FakeClock capability `timeouts`), EventStore (gap-free run_seq under parallel appends, immutability capability `rawSql` only for SQLite, readSince/resync, payload cap, unsafe payload rejection, publish-after-commit once), CheckpointStore.
5. Sabotage self-tests (TEST003 req. 7): `BrokenEventStore` that reuses a `run_seq` and `LeakyUnitOfWork` that commits on `err`; the suites must fail for them.
6. `createTestDatabase({ migrations?: 'all' | string[] })` returns `{ db, uow, dispose }` using a temp dir (`withTempDir`), runs the real migration runner with the real manifest; tests of other areas call `withTestDatabase`. It never touches the real data directory (guard: path must be under `os.tmpdir()`).
7. A `seedWorkspace(db)` helper is NOT provided here (belongs to DATA010's builder).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineContract`/`runContract`/`repositoryContract` (TEST003), `FakeClock` (TEST002), `computeChainHash` (DATA006), migration runner (DATA003).

## 8. Architecture and code placement

Fakes and suites in `packages/testing/src/{fakes,contracts}` (generated barrels pick them up). SQLite harness in `packages/adapters/sqlite/test-support/` (importable only from tests, boundary lint). Depends on ports and adapters; production never imports either.

## 9. Security and safety

Fakes must enforce the same invariants as the real thing (append-only, payload safety), otherwise tests could pass with unsafe behaviour. The test database factory refuses non-temp paths so a test can never open the Owner's database.

## 10. Errors and edge cases

- Driver unavailable in CI: SQLite runner reports skipped with reason, fake still runs, CI job `data` requires at least one real driver.
- Leaked temp dirs on failure: `dispose` in `finally`; stale dirs cleaned by name prefix.

## 11. Acceptance criteria

- [ ] All three suites pass for fake and SQLite implementations.
- [ ] Sabotage implementations fail the suites.
- [ ] `withTestDatabase` provides a migrated DB in under 300 ms (informational).
- [ ] Refusal test: path outside tmp throws.
- [ ] The fake-integrity test of TEST002 finds fakes and suites for `UnitOfWork`, `EventStore`, `CheckpointStore`.

## 12. Test plan

Meta-tests as above. Commands: `pnpm vitest run packages/testing/src/contracts packages/adapters/sqlite`.

## 13. Parallelization notes

Last of the DATA infrastructure tasks; entity tasks reuse `withTestDatabase`.

## 14. Open questions and assumptions

- ASSUMPTION: fakes share validation code (registry, chain hash) rather than re-implementing it.
