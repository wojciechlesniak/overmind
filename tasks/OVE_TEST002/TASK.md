---
id: OVE_TEST002
title: Build the test utilities package with fake clock, in-memory ports and builders
area: TEST
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST001, OVE_ARCH004, OVE_ARCH007, OVE_ARCH012, OVE_ARCH013, OVE_ARCH014, OVE_ARCH015]
soft_depends_on: [OVE_ARCH010]
provides: ["lib:test-utils", "lib:fake-clock", "lib:builders", "lib:memory-logger", "lib:fake-ports", "pkg:testing", "lib:fake-keychain", "lib:test-utilities"]
needs: ["port:Clock", "port:IdGenerator", "port:Logger", "port:AtomicFileWriter", "port:ProcessRunner", "port:Keychain", "port:Sandbox", "port:ServiceManager", "port:Notifier", "port:Translator"]
owns: ["packages/testing/package.json", "packages/testing/tsconfig.json", "packages/testing/src/index.ts", "packages/testing/src/fakes/FakeClock.ts", "packages/testing/src/fakes/FakeIdGenerator.ts", "packages/testing/src/fakes/MemoryLogger.ts", "packages/testing/src/fakes/InMemoryAtomicFileWriter.ts", "packages/testing/src/fakes/FakeProcessRunner.ts", "packages/testing/src/fakes/FakeKeychain.ts", "packages/testing/src/fakes/FakeSandbox.ts", "packages/testing/src/fakes/FakeServiceManager.ts", "packages/testing/src/fakes/FakeNotifier.ts", "packages/testing/src/fakes/FakeTranslator.ts", "packages/testing/src/builders/define-builder.ts", "packages/testing/src/helpers/**", "packages/testing/src/matchers/**", "packages/testing/README.md"]
reads: ["docs/testing/CONVENTIONS.md", "docs/architecture/dependency-injection.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16", "SPECIFICATION 19"]
adr_refs: [5, 9, 19]
---

# OVE_TEST002: Build the test utilities package with fake clock, in-memory ports and builders

## 1. Summary

Create `@overmind/testing`, the single shared package of test doubles and helpers: `FakeClock`, deterministic ids, `MemoryLogger`, in-memory/fake implementations of every platform and infrastructure port defined by the ARCH tasks, a generic builder framework for entity test data, temp-dir and wait helpers, and Result-aware matchers. It is importable only from tests.

## 2. Context

Use cases depend on ports (ARCH006), and macOS code lives behind interfaces (ARCH012), so almost all of the product can be tested on Linux CI with fakes. Tests must be deterministic (TEST001): no real time, randomness, subprocesses or Keychain. Each area defines more ports later; the convention below tells them how to add their fake and contract suite without editing shared files.

## 3. Scope (in)

- Package scaffold `packages/testing` (dev-only, never published).
- Fakes: `FakeClock`, `FakeIdGenerator`, `MemoryLogger`, `InMemoryAtomicFileWriter`, `FakeProcessRunner`, `FakeKeychain`, `FakeSandbox`, `FakeServiceManager`, `FakeNotifier`, `FakeTranslator`.
- Builder framework (`defineBuilder`, sequences, `.many()`).
- Helpers: `withTempDir`, `withFakeHome`, `waitFor`, `deferred`, `flushMicrotasks`, `collect`, `captureEvents(bus)`.
- Matchers: `expectOk`, `expectErr`, `expectNoSecrets` re-export (SEC003 owns the implementation), `expectEventSafe` re-export.
- Conventions for adding fakes and builders (documented in README).

## 4. Out of scope

- Fakes for ports owned elsewhere: `FakePathProbe` (SEC002), `FakeSecureRandom` (SEC005), `FakeTelegramApi` (TEST012), `FakeHerdr` (TEST009), repositories/domain builders (their areas), `InMemoryEventBus` (the real `InProcessEventBus` is used in tests; ARCH010).
- Contract suites: `OVE_TEST003`. Playwright helpers: `OVE_TEST004`.

## 5. Detailed requirements

1. **Package rules:** name `@overmind/testing`, `"private": true`, depends on `contracts`, `domain`, `application` only (type and port imports) and `vitest`/`fast-check` as peer dev dependencies. Boundary lint (ARCH002) allows imports of it only from test files and `test-support` folders. Exports through `src/index.ts` (hand-written for the files owned here) plus generated barrels `fakes/index.generated.ts`, `builders/index.generated.ts`, `contracts/index.generated.ts` (ARCH009) so that other areas' files are picked up without editing.
2. **FakeClock** implements `Clock` (ARCH007): constructor `(start?: Date | string)` default `2026-01-01T00:00:00.000Z`; `advance(ms)` runs due timers in due-time order (ties by creation order), including timers scheduled by callbacks within the advanced window, resolves due `sleep` promises (and awaits microtask flush after each firing so awaiting code runs before the next timer); `advanceTo(date)`, `set(date)` (wall clock jump; monotonic unchanged), `runAll()` (guard against infinite loops: max 10 000 timers), `pendingTimers()`, `now()`, `monotonicMs()` advances with `advance`; `sleep` honours AbortSignal. Intervals reschedule. A misuse guard: creating a `FakeClock` and using real `setTimeout` is not prevented, but lint (TEST001) forbids.
3. **FakeIdGenerator** implements `IdGenerator`: deterministic ULID-shaped ids built from a counter per prefix (`run_00000000000000000000000001` style padded to 26 Crockford chars) and a base time from the clock if provided; lexicographically increasing; `reset()`, `peek(prefix)`. Output must satisfy the id schema of ARCH007.
4. **MemoryLogger** implements `Logger` (ARCH004): records `{ level, msg, fields, context }[]` after applying the real redactor (so tests prove redaction); `child()` shares the record list; helpers `records`, `find(level|msgMatcher)`, `clear()`, `expectNoSecrets()`; `withLogContext` support through a plain object context. Option `captureUnredacted: false` default (never store raw secret values).
5. **InMemoryAtomicFileWriter** implements `AtomicFileWriter` (ARCH013) over a `Map<string, {data, mode}>` with directory model, rolling snapshots using FakeClock, and a failure injector `failNext('write'|'fsync'|'rename', errorCode)`; `files()` and `read(path)` helpers.
6. **FakeProcessRunner** implements `ProcessRunner` (ARCH014): scripted rules `when({ command, args?, logLabel? }).respond({ exitCode, stdout, stderr, delayMs?, hang? })`, `respondSequence`, default behaviour: fail the test with a clear "unexpected process call" (strict by default); recorded `calls` with redacted args; `spawn` returns a controllable handle (`emitStdout`, `exit(code)`).
7. **FakeKeychain** implements `Keychain` (ARCH012): Map store; `lock()` / `unlock()` to simulate `platform.keychain_locked`; `denyAccess()`; stores `Secret`; `snapshot()` returns refs only; never exposes values through `toJSON`.
8. **FakeSandbox** implements `Sandbox`: environment lifecycle state machine, mount validation identical to the real zod spec (reuses `EnvironmentSpecSchema`), records `exec` calls, scripted `exec` results, `capabilities({kind})`, failure injection (`failEnsureReady('box.runtime_missing')`), egress policy recording, `forwardPort` with TTL on FakeClock, and a deliberately LEAKY variant `LeakySandbox` (reads outside mounts) used by TEST007 meta-tests.
9. **FakeServiceManager**, **FakeNotifier** (records notifications, permission toggle), **FakeTranslator** (identity: returns `[key|k=v]`; or real catalog mode using resources).
10. **Builders:** `defineBuilder<T>(defaults: (seq: number) => T)` returns `Builder<T>` with `build(overrides?)`, `buildMany(n, overrides?)`, `with(overrides)` (immutable, returns a new builder), `sequence` counters per builder, deterministic values only (no random; ids from `FakeIdGenerator` or sequence). Builders for entities live in `packages/testing/src/builders/<entity>.builder.ts` and are written by the area that owns the entity (they need the zod schema from contracts to validate): the framework validates built objects against an optional zod schema (`defineBuilder({ schema })`) so builders cannot drift from contracts. Naming: `aWorkspace()`, `anAgent()`, `aRun()` factory functions.
11. **Helpers:** `withTempDir(fn)` (mkdtemp under `os.tmpdir()`, 0700, auto-clean even on failure), `withFakeHome()` (sets a fake home path object passed to `PathProbe`/`DataDirLayout`, never mutates `process.env.HOME` globally), `waitFor(predicate, { timeoutMs = 2000, intervalMs = 10, clock? })`, `deferred<T>()`, `flushMicrotasks()`, `collect(asyncIterable)`, `captureEvents(bus, types?)` returning `{ events, stop() }`, `tickUntilIdle(clock)`. 
12. **Matchers:** `expectOk(result)` returns the value and throws a readable error with the AppError code if `err`; `expectErr(result, 'perm.path_outside_allowed')` returns the AppError and checks code (and optionally `details` subset); `expectCode(result, code)`; Vitest `expect.extend` registrations `toBeOk()`, `toBeErrWith(code)` with type declarations in `matchers/vitest.d.ts`.
13. **Adding a fake (convention documented in README, followed by other areas):** file `packages/testing/src/fakes/Fake<Port>.ts` (behaviour) or `InMemory<Repo>.ts` (stateful), owned by the task that defines the port; it MUST pass the port's contract suite (`packages/testing/src/contracts/<Port>.contract.ts`, TEST003 harness) together with the real adapter; it exposes failure injectors, never silently succeeds for unknown input; exports are picked up by the generated barrel.
14. **Fake integrity check:** a test enumerates every file in `application/src/ports/*.ts` and asserts a fake exists and a contract suite exists, except ports on an explicit allowlist `ports-without-fakes.json` with reason and owner (pending items listed; the allowlist may only shrink).
15. **Typing:** all fakes are typed against the port interface (`implements`), so port evolution causes compile errors in the fake first.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Every test in the repository. Real implementations from other tasks are NOT reused inside fakes except pure pieces (redactor in MemoryLogger, `EnvironmentSpecSchema`, id schema). `expectNoSecrets`/corpus (SEC003) and `PathProbe`/`SecureRandom` fakes (SEC002/SEC005) are re-exported through generated barrels.

## 8. Architecture and code placement

`packages/testing/src/{fakes,builders,helpers,matchers,contracts,security,fixtures}`; `contracts/` and `security/` subfolders belong to TEST003 and SEC003/SEC004 respectively (separate task ownership by file). Dependency direction: testing -> application ports/contracts; nothing in production imports testing. SRP: one fake per file; DIP: fakes depend on interfaces only.

## 9. Security and safety

Fakes must not weaken real behaviour silently: `FakeKeychain` never writes to disk, `FakeSandbox` rejects non-canonical mounts exactly like the real validation (so tests cannot pass with unsafe specs), `FakeProcessRunner` rejects shell-like commands like the real one. Production code must never import the package (boundary lint + a build assertion that `@overmind/testing` is absent from the engine bundle). `FakeSecureRandom` and similar deterministic sources are refused in release builds (guard throws when `__RELEASE__`). Test data never contains real secrets or real user paths.

## 10. Errors and edge cases

- `FakeClock.advance` while a timer callback throws: error captured and rethrown after the advance completes, remaining timers still run (document).
- Infinite timer loops: `runAll` throws after 10 000 iterations with the list of pending timers.
- `waitFor` with FakeClock: advances the fake clock in steps instead of sleeping.
- Concurrent use of `withTempDir` in parallel tests: unique directories; cleanup errors on Windows-style locking ignored (macOS/Linux only).
- A fake used after `dispose()`: throws a clear error.
- Builders producing invalid entities relative to the schema: build fails with zod issues list.

## 11. Acceptance criteria

- [ ] `FakeClock` passes the `Clock` contract suite (TEST003) and timer-ordering tests, including nested timers and `sleep` cancellation.
- [ ] `FakeIdGenerator` ids satisfy the id schema and are strictly increasing per prefix.
- [ ] `MemoryLogger` stores redacted records (corpus secret never appears in `records`).
- [ ] Each listed fake implements its port type and passes its contract suite once TEST003 lands (placeholders until then).
- [ ] `defineBuilder` supports overrides, sequences, `many`, schema validation; example builders `aWorkspace`-style are shown in README with a toy schema.
- [ ] `expectOk`/`expectErr` give readable failures including the error code and details.
- [ ] Fake-integrity test lists any port without a fake via the allowlist only.
- [ ] Boundary lint passes: `@overmind/testing` importable only from tests.
- [ ] README documents the "add a fake / builder" convention and shows a complete example test (use case with FakeClock and FakeKeychain).

## 12. Test plan

Unit tests for each fake's own behaviour (`*.test.ts` colocated); property test for FakeClock ordering (random timers, assert sorted firing); contract suites via TEST003 harness; the fake-integrity test; type tests for `implements`. Commands: `pnpm vitest run packages/testing`.

## 13. Parallelization notes

Land `FakeClock`, `FakeIdGenerator`, `MemoryLogger`, `expectOk/expectErr`, `defineBuilder` first (small, used by everyone), then the platform fakes. Other areas add files in `fakes/` and `builders/` using the conventions; generated barrels avoid edits to `index.ts`. Hotspot: `packages/testing/package.json` (dependencies) — additions via proposal.

## 14. Open questions and assumptions

- ASSUMPTION: `fast-check` is added as a dev dependency (MIT) with justification in SETUP008 docs.
- ASSUMPTION: `InProcessEventBus` is cheap and deterministic enough to use directly in tests (with `flushMicrotasks`).
- Open: a `FakeGatewayClient` for use-case-level tests of the Telegram adapter belongs to TG/TEST012.
