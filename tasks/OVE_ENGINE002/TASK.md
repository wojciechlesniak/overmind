---
id: OVE_ENGINE002
title: Engine entry and composition root wiring (module discovery, startup order, test engine)
area: ENGINE
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH006, OVE_ARCH009, OVE_SETUP016, OVE_ARCH005, OVE_ARCH004]
soft_depends_on: []
provides: ["lib:engine-entry", "lib:composition-root-wiring", "lib:engine-bootstrap"]
needs: ["lib:composition-root", "lib:data-dir", "port:Logger", "lib:extension-generators"]
owns: ["apps/engine/src/compose/**", "apps/engine/src/bootstrap/**", "apps/engine/src/commands/run.ts", "apps/engine/test-support/create-test-engine.ts"]
reads: ["apps/engine/src/main.ts", "apps/engine/src/cli.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 18]
---

# OVE_ENGINE002: Engine entry and composition root wiring

## 1. Summary

Turn the SETUP016 scaffold into a real engine process: `startEngine()` loads config, initialises the data directory, builds all area modules with `composeEngine`, starts them in dependency order and keeps the process alive. It is the only place that knows concrete adapters.

## 2. Context

SETUP016 left the hooks `src/compose/index.ts` (`startEngine(options): Promise<never>`) and `src/service/index.ts`. ARCH006 defines `defineModule`/`composeEngine`; ARCH009 generates `modules.generated.ts`. Linux CI must compose the engine with fakes for platform modules (Keychain, Sandbox, ServiceManager, Notifier).

## 3. Scope (in)

- `src/compose/index.ts` (`startEngine`), `bootstrap/` steps, platform module selection, `createTestEngine`.
- Replacement of the optional dynamic import in `commands/run.ts` by a static import (this task takes ownership of that file after OVE_SETUP016 is `done`).

## 4. Out of scope

- Lock and startup ordering rules: ENGINE003. Shutdown: ENGINE004. Recovery: ENGINE005. Gateway: ENGINE010+. Per-area modules: the areas.

## 5. Detailed requirements

1. Bootstrap steps in order, each a small function with a typed result: (1) parse options (`--data-dir`, `--foreground`), (2) `resolveDataDir` + `DataDirInitializer.ensure()` (ARCH005; failure exits 20 with code `config.data_dir_insecure`), (3) load `ConfigStore` (recovered config produces event `config.recovered` after the bus exists), (4) create the logger and log the startup banner (version, protocol, pid, data dir redacted), (5) acquire the single-instance lock (ENGINE003), (6) `composeEngine({ modules, config, overrides })`, (7) `engine.start()`, (8) emit `system.started`, (9) install signal handlers (ENGINE004) and return a never-resolving promise.
2. Module list: `modules.generated.ts` (ARCH009) imported statically; platform split: `platform.macos.module.ts` provides real Keychain, Sandbox (BOX), ServiceManager (launchd), Notifier; `platform.fake.module.ts` provides fakes for Linux CI and dev (`OVERMIND_ENV=dev` and the SETUP012 switches `OVERMIND_KEYCHAIN=memory`, `OVERMIND_SANDBOX=fake`). Selection is made ONLY in `compose/platform-selection.ts` from `process.platform` and the dev env switches read through the single env adapter (ARCH005); a release build constant `__RELEASE__` removes the fake module and the switches (fail closed: a release engine without a real Sandbox module refuses to start, ARCH006 req. 9).
3. `startEngine` never throws to the caller: it maps failures to exit codes of SETUP016 (20 cannot start, 30 incompatible, 70 internal) and prints one structured error line to stderr.
4. Startup budget: 5 s typical, 30 s hard timeout for `engine.start()` (migrations may take longer: the lifecycle state `migrating` extends the timeout to 5 min); expired -> exit 20 and log.
5. `createTestEngine({ overrides, config })` in `apps/engine/test-support/` composes with all fakes (ARCH006 req. 8), in-memory SQLite (`createTestDatabase`, DATA008), a `FakeClock`, a temp data directory and the gateway in in-process mode (no socket) unless `withSocket: true`. Returns `{ engine, client, dataDir, stop() }`.
6. Environment: only `adapters/system/src/env.ts` reads `process.env` (ARCH005); bootstrap receives a typed `EnvConfig`.
7. Uncaught exceptions and unhandled rejections: handlers installed once; log `fatal` (redacted), run emergency shutdown (ENGINE004 fast path), exit 70. They never swallow errors.
8. A `--check` flag (`overmind-engine run --check`) composes the engine without starting listeners or the DB write path and exits 0 (used by CI and SETUP017 verification).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`composeEngine`/`defineModule` (ARCH006), generated module index (ARCH009), config/data-dir (ARCH005), logging (ARCH004), exit codes (SETUP016).

## 8. Architecture and code placement

`apps/engine/src/{compose,bootstrap}/`, outermost layer; nothing imports from `apps/engine`. No business logic: only wiring and sequencing.

## 9. Security and safety

Release builds cannot select fake platform modules (compile-time removal); a missing real Sandbox/Keychain provider aborts startup. Startup banner never prints tokens or environment. Fatal handlers do not print stack traces to stdout. The data directory is verified before anything is written (SR-26).

## 10. Errors and edge cases

- Module build throws: `di.module_failed`, exit 70, log with module id.
- Config recovered from corrupt file: engine continues with defaults and notifies later.
- Data dir on a read-only volume: exit 20 with a clear key.
- Startup interrupted by SIGTERM: shutdown fast path, exit 0.

## 11. Acceptance criteria

- [ ] `run --check` exits 0 on Linux CI with fakes and non-zero when a required token has no provider.
- [ ] A release-flag build refuses fake platform modules (test with `__RELEASE__=true`).
- [ ] Bootstrap order is asserted by a test with spy modules.
- [ ] Unhandled rejection triggers logged fatal and exit 70 in a child-process test.
- [ ] `createTestEngine` composes in under 500 ms (informational).

## 12. Test plan

Unit tests for each bootstrap step with fakes; child-process tests for exit codes; composition smoke tests. Commands: `pnpm --filter @overmind/engine test`.

## 13. Parallelization notes

First ENGINE task after the protocol decision. Hotspot: `commands/run.ts` ownership handoff from SETUP016 (state it in the PR).

## 14. Open questions and assumptions

- ASSUMPTION: one process, one event loop; heavy work (git, hashing large blobs) uses streams or child processes, no worker threads in MVP.
