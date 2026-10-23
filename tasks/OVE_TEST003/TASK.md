---
id: OVE_TEST003
title: Create the shared port contract-test harness and suites for infrastructure ports
area: TEST
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH005, OVE_ARCH056, OVE_ARCH010, OVE_ARCH012, OVE_ARCH013, OVE_ARCH014, OVE_ARCH015, OVE_TEST002, OVE_ARCH057, OVE_ARCH058]
soft_depends_on: [OVE_ARCH010]
provides: ["lib:contract-test-harness", "lib:contract-suites"]
needs: ["port:EventBus", "port:Keychain", "port:Sandbox", "port:ServiceManager", "port:Notifier", "port:Logger", "port:Clock", "port:IdGenerator", "port:AtomicFileWriter", "port:ProcessRunner", "port:Translator", "port:ConfigStore"]
owns: ["packages/testing/src/contracts/harness.ts", "packages/testing/src/contracts/Clock.contract.ts", "packages/testing/src/contracts/IdGenerator.contract.ts", "packages/testing/src/contracts/Logger.contract.ts", "packages/testing/src/contracts/EventBus.contract.ts", "packages/testing/src/contracts/Keychain.contract.ts", "packages/testing/src/contracts/Sandbox.contract.ts", "packages/testing/src/contracts/ServiceManager.contract.ts", "packages/testing/src/contracts/Notifier.contract.ts", "packages/testing/src/contracts/AtomicFileWriter.contract.ts", "packages/testing/src/contracts/ProcessRunner.contract.ts", "packages/testing/src/contracts/Translator.contract.ts", "packages/testing/src/contracts/ConfigStore.contract.ts", "packages/testing/src/contracts/repository-contract.ts"]
reads: ["docs/testing/CONVENTIONS.md", "docs/architecture/dependency-injection.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9, 19, 26]
---

# OVE_TEST003: Create the shared port contract-test harness and suites for infrastructure ports

## 1. Summary

Provide a harness that defines a behavioural test suite once per port and runs it against every implementation (in-memory fake and real adapter). Deliver the suites for the ports created by the ARCH tasks plus a reusable repository-contract helper that DATA and the other areas extend. This guarantees fakes cannot drift from real adapters and that swapping an implementation (herdr, Lima, another logger) is safe.

## 2. Context

Clean Architecture here relies on ports (ARCH006). Use-case tests run on fakes (TEST002), adapters are tested against real systems; without shared suites the fake and the adapter silently diverge, and tests pass for the wrong reason. ADR 0026 explicitly wants herdr replaceable behind an adapter interface; ADR 0009 wants platform code swappable. The harness makes "one suite, N implementations" the default.

## 3. Scope (in)

- `describeContract()` harness with implementation registry, capability flags, setup/teardown, and tagging (`@macos`, `@real`).
- Suites for: Clock, IdGenerator, Logger, EventBus, Keychain, Sandbox (portable subset), ServiceManager, Notifier, AtomicFileWriter, ProcessRunner, Translator, ConfigStore.
- Generic `repositoryContract()` helper (CRUD, optimistic concurrency, not-found codes, pagination, ordering, append-only variant) for DATA and areas to instantiate.
- `<Impl>.contract.test.ts` runner files colocated with each implementation (written by the implementing task, template provided).
- Rule: every port has a suite (enforced via TEST002 fake-integrity test).

## 4. Out of scope

- Suites for ports owned by other areas: written by those areas using this harness (SEC002 PathProbe, SEC005 SecureRandom, DATA repositories, PROV `ModelProvider`, herdr adapter TEST009, BOARD, etc.).
- Real implementations' own integration tests.

## 5. Detailed requirements

1. **Harness API:**
   ```ts
   export function defineContract<P>(name: string, suite: (ctx: ContractContext<P>) => void): ContractSuite<P>;
   export function runContract<P>(suite: ContractSuite<P>, impl: {
     name: string; create: (env: TestEnv) => Promise<{ port: P; dispose?: () => Promise<void>; controls?: Record<string, unknown> }>;
     capabilities?: Record<string, boolean>; tags?: ('macos'|'real'|'slow')[];
   }): void;
   ContractContext<P> = { it: (name, fn: (api: { port: P; env: TestEnv; controls }) => Promise<void>) => void;
                          itIf: (cap: string, name, fn) => void;      // runs only when impl.capabilities[cap] is true, otherwise reported as skipped with reason
                          describe: ... }
   ```
   `TestEnv` provides `clock: FakeClock`, `ids`, `tempDir()`, `logger`. Titles are `Contract <Port> / <impl>: <behaviour>`. Capabilities let an implementation declare unsupported optional behaviours; unsupported behaviours are always visible as skipped with a reason, never silently omitted. A suite may not reference concrete implementations.
2. **Required behaviour per suite** (each bullet is at least one test):
   - **Clock:** `now` monotone with advance, `nowIso` format `YYYY-MM-DDTHH:mm:ss.sssZ`, `monotonicMs` never decreases, `sleep` resolves, `sleep` aborted rejects with `internal.cancelled`, `setTimer` fires once, cancel idempotent, `setInterval` repeats and cancel stops, timers do not fire after cancel, ordering of timers by due time. (Real clock tests use small durations and tolerance; FakeClock uses `controls.advance`.)
   - **IdGenerator:** format per prefix, uniqueness over 10 000, monotonic increasing, prefix validation errors, no collisions across prefixes.
   - **Logger:** levels respected, `child` merges bindings, context fields present, `isLevelEnabled`, redaction of the corpus secrets (uses SEC003 corpus when available), never throws on circular/unserialisable fields, message constant preserved, `err` serialisation of `AppError`.
   - **EventBus:** per-subscription ordering, handler failure isolation, wildcard/prefix matching, unsubscribe (including inside handler), re-entrant publish ordering, `publish` never throws, overflow marker for non-critical events, critical events not dropped, no delivery after unsubscribe, a subscriber does not receive events published before it subscribed (no replay; explicit test).
   - **Keychain:** store/read roundtrip returns `Secret` with `reveal()`, `toString/JSON` hide value, overwrite semantics (`platform.secret_exists` without flag), missing -> `platform.secret_not_found`, `exists`, idempotent `remove`, `list(prefix)` returns refs only, locked state -> `platform.keychain_locked` (capability `lockable`), error messages never contain the secret.
   - **Sandbox (portable subset):** `capabilities()` shape; `kind: 'none'` -> every `exec` fails closed with `platform.sandbox_unavailable`; environment lifecycle (create/start/stop/destroy, idempotent destroy); `EnvironmentSpec` validation rejects non-`/work` workdir, non-canonical or sensitive mounts, secrets in env, unpinned image; `exec` accepts argv only (shell string rejected); `listEnvironments` reflects state; `updateMounts` validates; `setEgressPolicy` records; `forwardPort` TTL and loopback-only (capability `forwardPort`). Tests needing a real container are tagged `@macos @real @slow` and live in BOX.
   - **ServiceManager:** install/uninstall idempotent, status transitions, auto-start flag, no root required, error codes.
   - **Notifier:** notify returns ok/err mapping, permission states, body with secret pattern rejected (capability `guardsContent`), notification failure does not throw.
   - **AtomicFileWriter:** write/read roundtrip, mode 0600, directory 0700, no partial file visible under injected failure at each stage (`controls.failAt`), `keepPrevious`, snapshot interval/keep with fake clock, symlink refusal, concurrent writes serialised, size guard, quarantine preserves bytes.
   - **ProcessRunner:** argv passed literally (metacharacters echoed unchanged), rejects commands with whitespace/metacharacters, timeout kills and flags, output cap truncation, minimal env (secret var from parent not visible), exit code returned not thrown, abort signal, concurrency limit (capability `limits`).
   - **Translator:** key lookup, interpolation, plural forms for `en` and `pl` (counts 1,2,5,12,22), fallback to `en`, missing key behaviour (returns `[key]` and records warning), `withLocale` immutability.
   - **ConfigStore:** load defaults, validation errors, update patch merge, `.bak` kept, corrupt file recovery (`controls.corrupt()`), future version read-only, `onChange` notifications.
3. **`repositoryContract<T>({ create, entityBuilder, idOf, mutate })`** reusable assertions: save then get; get missing -> `data.not_found`; list returns stable ordering by id; pagination (cursor) without gaps/duplicates; optimistic concurrency (`version` mismatch -> `data.conflict`); idempotent re-save of identical entity; transactional behaviour hook (`controls.failNextCommit()` leaves no partial state); append-only variant (`appendOnly: true`: update/delete rejected with `data.immutable`, used for Decisions and Audit events); filter by workspace never leaks entities of another workspace (isolation test with two workspaces); deleted workspace cascade hook. DATA and others call it with their builders.
4. **Implementation runner template:** documented one-liner each implementing task adds, e.g. `runContract(KeychainContract, { name: 'KeychainMacos', tags: ['macos','real'], create: async () => ... })` in `<impl>.contract.test.ts`; the harness refuses to run `@real` implementations unless the corresponding env/CI flag is set, and reports them as skipped.
5. **Coverage report of contracts:** a script `tools/testing/contract-coverage.ts` lists for each port file in `application/src/ports/` the suite and the implementations registered (fake, real); fails if a port has implementations in `adapters/*` but no `runContract` registration for them (detected by scanning for `implements <Port>`), with an allowlist like TEST002's.
6. **Determinism:** suites use `env.clock`/`env.ids`; real-time variants are in the adapter runner with explicit tolerance and `// real-time:` comments.
7. **Mutation sanity:** each suite has a "broken implementation" self-test (a deliberately wrong fake per behaviour group, e.g. `BrokenClock` that goes backwards, `LeakyKeychain` that stringifies the secret) proving the suite fails when it should (like SEC005's sabotage).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Fakes/builders/helpers from TEST002; corpus (SEC003) for Logger/Keychain/Notifier checks; errors from ARCH003; EnvironmentSpec schema from ARCH012; EventBus semantics from ARCH010. Other areas MUST reuse `defineContract` rather than writing ad-hoc "fake vs real" duplicates.

## 8. Architecture and code placement

`packages/testing/src/contracts/{harness.ts,repository-contract.ts,<Port>.contract.ts}`; implementation runners colocated with implementations (`packages/adapters/<x>/src/**/<Impl>.contract.test.ts`), written by the adapter tasks. Tooling in `tools/testing/contract-coverage.ts`. Dependency: testing -> application ports only.

## 9. Security and safety

Suites are where security semantics of ports are fixed: Keychain secrets never stringify, Sandbox fails closed, ProcessRunner never uses a shell, AtomicFileWriter refuses symlinks and keeps 0600. A port implementation that fails these must not merge. Real-implementation runs (Keychain, Sandbox) must use disposable service names/labels (`app.overmind.test.<random>`) and clean up, so tests never touch the Owner's real secrets or environments. Tests marked `@real` never run on a developer machine without an explicit opt-in flag.

## 10. Errors and edge cases

- Implementation lacks an optional capability: declared via `capabilities`, reported as skipped with reason.
- Real adapter unavailable on CI (macOS only): the runner file is excluded on Linux by tag, and the contract coverage script reports "real impl untested on this platform" as information.
- Flaky real-time contract tests: use bounds and `waitFor`; never fixed sleeps.
- A suite becomes outdated when a port gains a method: the port task must add suite tests in the same PR (DoD item 3 for ports); the coverage script warns when a method name from the interface has no mention in the suite (simple AST check, warning).
- Suites must not assume ordering of parallel test files; each `create` gets isolated state.

## 11. Acceptance criteria

- [ ] `defineContract`/`runContract` implemented with capability skipping and tag handling; skipped tests report reasons.
- [ ] Suites for the 12 listed ports exist and cover the bullets in requirement 2.
- [ ] Each suite passes for its TEST002 fake; real-adapter registrations are present for adapters that already exist (Clock, IdGenerator, AtomicFileWriter, ProcessRunner, Logger, Translator, ConfigStore) and are documented as TODO for the others.
- [ ] Each suite fails against its "broken" self-test implementation.
- [ ] `repositoryContract` is demonstrated with an in-memory toy repository, including append-only and workspace isolation.
- [ ] `contract-coverage` script lists ports, suites and registered implementations and fails on an unregistered adapter.
- [ ] Documentation snippet in `docs/testing/CONVENTIONS.md` proposal (since that file belongs to TEST001: filed as `tasks/_proposals/OVE_TEST003-contracts-docs.md`) explains how to add a runner.

## 12. Test plan

Meta-tests for the harness itself (suite registration, skipping, tag filtering), sabotage implementations per suite, toy repository tests. Commands: `pnpm vitest run packages/testing/src/contracts`, `pnpm exec tsx tools/testing/contract-coverage.ts`.

## 13. Parallelization notes

Harness first, then suites in any order (each file independent). Port-defining tasks (ARCH004, 007, 010, 012...) can write their own suite file if they finish earlier — coordinate by claiming the file; files are separate so no conflicts. Hotspot: none (`contracts/index.generated.ts` generated).

## 14. Open questions and assumptions

- ASSUMPTION: `@real` tests for Keychain and Sandbox run only on macOS CI jobs and by opt-in locally (`OVERMIND_REAL_TESTS=1`).
- ASSUMPTION: the Sandbox portable subset avoids requiring Apple `container`; BOX adds the real suite additions.
