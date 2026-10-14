---
id: OVE_ARCH006
title: Establish ports, adapters and composition-root conventions without a service locator
area: ARCH
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH001, OVE_ARCH003]
soft_depends_on: [OVE_ARCH002]
provides: ["lib:di-conventions", "lib:composition-root", "lib:port-token", "lib:multi-token", "port:DefineModule"]
needs: []
owns: ["packages/application/src/di/**", "apps/engine/src/composition/**", "docs/architecture/dependency-injection.md"]
reads: ["docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [5, 9, 19]
---

# OVE_ARCH006: Establish ports, adapters and composition-root conventions without a service locator

## 1. Summary

Define how ports are declared, how adapters implement them, and how `apps/engine` assembles everything in one composition root using constructor injection and typed tokens, with each area contributing its own wiring module so agents never edit a shared wiring file. Also define how tests swap in fakes.

## 2. Context

Clean Architecture (CONVENTIONS section 6): use cases depend on ports, adapters implement them, the engine wires them. With 40+ areas written in parallel, a hand-edited central wiring file would be the worst conflict hotspot and a global container would invite a service locator. We use typed tokens and per-area modules discovered by a generator, resolved only inside `apps/engine/src/composition`.

## 3. Scope (in)

- `token<T>(name)` helper and `Token<T>` type, port file convention, in `packages/application/src/di/`.
- `defineModule()` and `composeEngine()` in `apps/engine/src/composition/`: topological resolution of area modules, cycle detection, missing/duplicate provider errors, lifecycle (`start`/`stop` hooks in dependency order).
- Naming and file conventions for ports, adapters, use cases, factories.
- Test wiring: `composeEngine({ overrides })`, `createTestEngine()` contract (implementation of fakes in TEST002).
- Documentation `docs/architecture/dependency-injection.md` with do/don't examples.

## 4. Out of scope

- The generator that discovers `*.module.ts` files: `OVE_ARCH009` (this task defines the file shape and a manual list fallback).
- Engine process entry, signal handling, sidecar packaging: `OVE_SETUP011`, ENGINE area.
- Individual ports (each area owns its own; platform ports `OVE_ARCH012`).

## 5. Detailed requirements

1. **Ports.** One file per port: `packages/application/src/ports/<PortName>.ts` exporting (a) the interface, (b) its token, (c) related value types. Interface segregation: split by consumer need (`EventPublisher` vs `EventSubscriber`, `RunReader` vs `RunWriter` where use cases differ). A port method returns `Promise<Result<T, AppError>>` for I/O that can fail in expected ways; pure getters may return plain values. Ports never expose foreign types (no `Database`, `ChildProcess`, `Buffer` from a library other than Node built-in `Uint8Array`).
   ```ts
   export interface Keychain { read(ref: SecretRef): Promise<Result<Secret>>; ... }
   export const KeychainToken = token<Keychain>('port:Keychain');
   ```
2. **Tokens.** `token<T>(id: string): Token<T>` returns a frozen object `{ id, __type?: T }`. `multiToken<T>(id)` declares a collect token: any number of modules may provide it (each contributes one `T`), and a consumer `requires` it to receive `readonly T[]` in module-id order (used for translation bundles, health checks, shutdown hooks; ARCH015). Ordinary tokens still require exactly one provider. Token ids are unique repo-wide; format `port:<Name>`, `usecase:<Name>`, `service:<Name>`, `config:<Name>`. A registry test fails on duplicates.
3. **Use cases** receive dependencies through the constructor as one `deps` object of port interfaces: `new ApproveAccessRequest({ approvals, audit, clock, policies })`. No use case imports a token, a container or a module. No default parameter values that create adapters. Use-case classes have a single public method `execute(input): Promise<Result<Out>>` (or a factory function returning that function). File `<verb-noun>.usecase.ts`.
4. **Adapters** are classes `class SqliteApprovalRepository implements ApprovalRepository` taking their own dependencies (db handle, logger, clock) via constructor. Static factories `createX(config)` allowed for config-to-instance construction only.
5. **Modules.** Each area adds exactly one file `apps/engine/src/composition/modules/<area>.module.ts`:
   ```ts
   export default defineModule({
     id: 'perm',
     requires: { approvals: ApprovalRepositoryToken, audit: AuditSinkToken, clock: ClockToken, logger: LoggerToken },
     provides: [ApproveAccessRequestToken, RequestAccessToken],
     build: ({ approvals, audit, clock, logger }) => ({
       [ApproveAccessRequestToken.id]: new ApproveAccessRequest({ approvals, audit, clock }),
       ...
     }),
     start?: async (built) => {...}, stop?: async (built) => {...},
   });
   ```
   `build` is synchronous and cheap (no I/O); I/O happens in `start`. `requires` is a record of local-name to token; the generic types make `build`'s argument fully typed (type test required).
6. **Resolution.** `composeEngine({ modules, overrides?, config })` (a) validates that every required token has exactly one provider (`di.missing_provider`, `di.duplicate_provider` with both module ids), (b) sorts modules topologically, detecting cycles (`di.cycle` with the path), (c) builds in order, (d) returns an `Engine { get<T>(token): T (internal use only), start(), stop() }`. `get` is exported only to `apps/engine` entry code and to tests; the lint boundary (proposal to ARCH002) forbids importing `composition/` from any package. `start` runs module `start` hooks in dependency order; `stop` in reverse with a per-module timeout (default 10 s) and error aggregation.
7. **No service locator rule:** no code outside `apps/engine/src/composition/` and test setup may call `engine.get`, hold a reference to a container, or import `Token` objects other than in port files, module files and route modules (route modules list their required tokens declaratively, ARCH009). Review rule + lint (`no-restricted-imports` of `composition` outside engine).
8. **Overrides for tests:** `composeEngine({ modules, overrides: { [ClockToken.id]: fakeClock } })`. Overrides replace a provider *after* validation, with type checking by token. `createTestEngine({ overrides })` in `apps/engine/test-support/` pre-registers all fakes from `packages/testing` for every platform port (Keychain, Sandbox, Notifier, ServiceManager, Clock, IdGenerator, Logger, AtomicFileWriter, ProcessRunner) so integration tests never touch macOS APIs. Unit tests do not use the composition at all: they construct the use case with fakes by hand.
9. **Gateway routes** (ARCH009) declare `requires` with the same token mechanism; the ENGINE gateway registrar resolves them from the composed engine at startup, so routes receive use cases by constructor-like injection, never via `ctx.get`.
10. **Lifecycle & errors:** if a module `build` throws, composition fails fast with the module id (`di.module_failed`), engine exits non-zero, log without secrets. Platform guard: modules that need macOS-only adapters live in `*.module.ts` files whose `provides` are satisfied on non-macOS by test fakes (so Linux CI composes the engine).
11. **Factories and config:** per-module configuration is read from `AppConfig` (ARCH005) section passed in `config`; modules never read `process.env`.
12. Document naming: `XxxRepository` (port) / `SqliteXxxRepository` (adapter) / `InMemoryXxxRepository` (test fake in `packages/testing`) / `FakeXxx` for behaviour fakes / `XxxToken`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Logger` (ARCH004), `Clock`/`IdGenerator` (ARCH007), platform ports (ARCH012), fakes (TEST002). Every area reuses `defineModule` and `token`; nobody writes a second DI mechanism.

## 8. Architecture and code placement

- `packages/application/src/di/{token.ts,index.ts}`: only the `token` helper (no container, to keep application free of wiring).
- `apps/engine/src/composition/{define-module.ts,compose-engine.ts,errors.ts,modules/*.module.ts}` (modules owned by the respective area tasks via the `modules/<area>.module.ts` pattern; the generator creates the module list).
- DIP: the composition root is the only place that knows concrete adapters. SRP: one module per area. OCP: a new area adds a file, edits nothing.

## 9. Security and safety

Wiring decides which implementation guards security: the composition test MUST assert that the real `Sandbox`, `Keychain` and `PermissionPolicy` providers cannot be overridden in a release build (override API is compiled only into non-release builds, checked by a build assertion), and that a missing `Sandbox` provider aborts startup rather than falling back to an unsandboxed runner (fail closed). Modules must not export secrets via `build` results; log composition steps without config values.

## 10. Errors and edge cases

- Two modules provide the same token: startup error naming both.
- A module `requires` a token provided by nobody: error lists the chain.
- Optional dependencies: not supported; use a port with a no-op implementation provided explicitly (e.g. `NullNotifier`) so wiring stays explicit.
- Circular dependency between modules: error with the cycle path; resolve by extracting a smaller port.
- `stop` hook hangs: timeout, log, continue shutting down others.
- Hot reload in dev: out of scope; engine restarts.

## 11. Acceptance criteria

- [ ] `token()` helper and a port example compile; duplicate token ids fail the registry test.
- [ ] `defineModule` infers argument types for `build` from `requires` (type-level test).
- [ ] `composeEngine` reports missing provider, duplicate provider and cycle with the specified error codes.
- [ ] Start/stop order follows dependencies and reverse order, with timeout handling tested using a fake clock.
- [ ] `createTestEngine` can compose the whole engine on Linux with only fakes (smoke test with two example modules).
- [ ] A test proves a missing `Sandbox` provider prevents startup (no fallback).
- [ ] `docs/architecture/dependency-injection.md` contains the do/don't list and the naming table.
- [ ] No file outside `apps/engine/src/composition` and tests calls `get`.

## 12. Test plan

- `compose-engine.test.ts`: table tests for resolution errors, ordering, overrides, lifecycle.
- `define-module.types.test.ts`: `expectTypeOf` checks.
- `registry.test.ts`: token id uniqueness across `packages/application/src/ports/*.ts`.
- Integration: a toy module pair (`a.module.ts` providing, `b.module.ts` consuming) composed with fakes.
- Commands: `pnpm vitest run apps/engine packages/application/src/di`.

## 13. Parallelization notes

Merge the `token` helper first (tiny) so every port author can use it; composition code can follow. Conflict hotspot: none, modules are per area and discovered by glob (ARCH009 generator writes `modules.generated.ts`, git-ignored). Until the generator exists, `compose-engine.ts` accepts an explicit array and the engine entry (ENGINE) lists modules via `import.meta.glob`-equivalent `fast-glob` at startup.

## 14. Open questions and assumptions

- ASSUMPTION: a tiny typed-token resolver inside the composition root is acceptable (it is not a service locator because application code never receives it). Alternatives (tsyringe, inversify) rejected for decorator/reflect-metadata cost and magic.
- ASSUMPTION: `application` exports `token` only; the container never leaves `apps/engine`.
