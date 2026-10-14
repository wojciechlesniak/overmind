---
id: OVE_SETUP004
title: Unit test runner (Vitest) workspace configuration and coverage thresholds
area: SETUP
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP001, OVE_SETUP002]
soft_depends_on: [OVE_SETUP008]
provides: ["lib:vitest-workspace", "lib:vitest-shared-config", "lib:coverage-thresholds"]
needs: []
owns:
  - vitest.config.ts
  - vitest.shared.ts
  - packages/*/vitest.config.ts
  - packages/adapters/*/vitest.config.ts
  - apps/*/vitest.config.ts
  - tools/vitest.config.ts
  - tools/vitest-setup/**
reads: ["tsconfig.base.json", "pnpm-workspace.yaml"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [18]
---

# OVE_SETUP004: Unit test runner (Vitest) workspace configuration and coverage thresholds

## 1. Summary

Configure Vitest 5 as the single unit and contract test runner for the whole monorepo with one root config that discovers a project per package, a shared options module, per-layer environments (Node for backend, jsdom for UI), V8 coverage with enforced thresholds, and deterministic test execution (fixed timezone, locale, no network).

## 2. Context

DoD requires `pnpm test` in CI and a test for every requirement (CONVENTIONS section 8). Versions (verified 2026-10-13): `vitest@5.0.4` and `@vitest/coverage-v8@5.0.4` (peers: `vite ^6.4||^7||^8`, `@types/node ^22||>=24`, `jsdom` optional; engines Node `^22.12||^24||>=26`), `jsdom@30.1.2` (engines Node `^22.22.2||^24.15||>=26`), `@types/node@22.20.5` (matches the Node 22 line; the registry `latest` 26.x is NOT used), `@testing-library/react@16.3.3`, `@testing-library/jest-dom@7.0.1`. The test harness extras (fakes, builders) are OVE_TEST002; Playwright is OVE_TEST004; visual regression OVE_TEST005. This task is only the runner configuration.

## 3. Scope (in)

- Root `vitest.config.ts` using `test.projects` to include each package's own `vitest.config.ts`.
- `vitest.shared.ts` exporting `sharedConfig()` and `coverageThresholds` per layer.
- A minimal `vitest.config.ts` in each package (imports shared, sets `name` and `environment`).
- `tools/vitest-setup/setup-node.ts` and `setup-dom.ts` (global hardening).
- Placeholder test per package proving discovery (`src/index.test.ts` asserting the module loads).

## 4. Out of scope

- Test utilities (fake clock, in-memory ports): OVE_TEST002. Contract test suites for ports: OVE_TEST003.
- Playwright and Storybook test runners: OVE_TEST004, OVE_DS tasks.
- Integration tests that need real SQLite files or processes: they use the same runner with a separate project name `*-int` defined by the owning area tasks; naming rule only here.
- CI job wiring: OVE_SETUP006.

## 5. Detailed requirements

1. **Discovery.** Root `vitest.config.ts`: `test.projects: ["apps/*/vitest.config.ts", "packages/*/vitest.config.ts", "packages/adapters/*/vitest.config.ts", "tools/vitest.config.ts"]`. (If the pinned Vitest names this key differently, use its documented multi-project key; record in the PR.)
2. **Shared config** (`vitest.shared.ts`) returns: `test.include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"]`, `exclude: ["**/*.int.test.ts"]` for the default project (integration files are picked up only by the project named `<pkg>-int` and by `pnpm test:int`), `globals: false`, `restoreMocks: true`, `clearMocks: true`, `unstubGlobals: true`, `unstubEnvs: true`, `testTimeout: 5000`, `hookTimeout: 10000`, `pool: "forks"` (process isolation, safer for native modules and `process` stubbing), `passWithNoTests: false`, `setupFiles` per environment, `env: { TZ: "UTC", LANG: "C.UTF-8" }`, `reporters: ["default"]` (CI adds `junit` and `github-actions` in OVE_SETUP006).
3. **Environments.** Node environment for `contracts`, `domain`, `application`, `workflow-runtime`, `gateway`, `adapters/*`, `engine`, `tools`. `jsdom` for `ui-kit`, `desktop`, `api-client` only when a test file opts in with `// @vitest-environment jsdom` or the package config sets it (ui-kit and desktop default to jsdom; api-client defaults to Node).
4. **Setup files.** `setup-node.ts`: fail the test when `process.on('unhandledRejection')` fires; replace `globalThis.fetch` with a function that throws `Error("Network access is forbidden in unit tests, inject a port")` unless the test file imports the allow marker `allowLocalhost` (tests that start a gateway on a Unix socket do not use fetch to the internet). `setup-dom.ts`: register `@testing-library/jest-dom` matchers via `vitest` extend, auto-cleanup after each test, stub `matchMedia`, `ResizeObserver`, `IntersectionObserver` (React Flow and layout need them) and `scrollTo`.
5. **Coverage.** Provider `v8`; `reporter: ["text-summary", "lcov", "json-summary"]`, output `coverage/`; include `src/**`; exclude `**/*.test.*`, `**/*.stories.*`, `**/fixtures/**`, `**/*.generated.ts`, `**/index.ts` barrels, `src-tauri/**`. Thresholds by layer (fail the run when below): `domain`, `application`, `workflow-runtime`: lines 90, functions 90, branches 85, statements 90; `contracts`, `gateway`, `adapters/*`: lines 80, functions 80, branches 75; `ui-kit`, `desktop`, `api-client`: lines 70, functions 70, branches 65; `tools`: 70/70/60. Coverage thresholds are per project (set in each package config via `coverageThresholds.<layer>`), a package's tests cannot be rescued by another package's coverage. New packages inherit the threshold of their layer (ASSUMPTION list above). Thresholds only ever go up: lowering requires a proposal and an Owner decision.
6. **Scripts** (names from OVE_SETUP001): `test` = `vitest run`, `test:watch` = `vitest`, `test:coverage` = `vitest run --coverage`; add `test:int` = `vitest run --project "*-int"` (script added as a pure addition).
7. **File naming.** Unit `*.test.ts(x)`; contract suites `*.contract.test.ts`; integration `*.int.test.ts`; type tests `*.test-d.ts` (typecheck project only when a contract task needs it). Test files sit next to the source or in `test/`.
8. **Determinism.** Tests MUST NOT depend on wall-clock time or randomness; the shared setup exposes nothing for that (the Clock port and ULID utilities come from OVE_ARCH007/TEST002) but lint (OVE_ARCH007) bans `Date.now()` in domain/application.
9. **Sharding.** `vitest run --shard=i/n` works with the projects layout; CI uses it if total time exceeds 8 minutes (OVE_SETUP006).
10. **Placeholder tests.** Every package gets `src/index.test.ts`: `it("loads", async () => { await import("./index"); })`. Removing them is allowed once real tests exist (`passWithNoTests: false` stays).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

One `sharedConfig()` for all packages (DRY); coverage thresholds as data in one object. TEST002/TEST003 reuse the setup files and must not add parallel runners. The jsdom stubs are the only place that fakes browser APIs.

## 8. Architecture and code placement

Layer: tooling. Root config and shared module at repository root; per-package config is five lines (`defineProject(sharedConfig({ name, environment }))`). Test code may import from its own package and from `@overmind/contracts`; cross-layer test helpers come later from `packages/*/test-utils` (OVE_TEST002).

## 9. Security and safety

- Network blocked in unit tests prevents accidental calls to real providers or Telegram and makes prompt-injection fixtures safe.
- `pool: "forks"` prevents shared memory between tests of different packages (important for tests with secrets-redaction fixtures).
- Tests MUST NOT print secrets: snapshots are reviewed for tokens; the redaction suite is OVE_SEC003.
- Coverage reports are build artifacts and never contain source secrets; `coverage/` is gitignored.
- A failed coverage threshold is a hard failure: never mark a test as `skip` to pass (lint rule from OVE_SETUP003).

## 10. Errors and edge cases

- A package with zero test files fails (`passWithNoTests: false`): that is the signal to add the placeholder.
- A test that really needs the network (for example an adapter contract test against a localhost fake server) opts in via the `allowLocalhost` marker; real internet access is never allowed.
- jsdom not available (old Node): engines check in OVE_SETUP001 prevents it.
- Coverage on files never imported: `all`-style inclusion via `coverage.include` so unreferenced files count as 0%.
- Flaky test: do not add retries globally; the owner task fixes the cause (`retry: 0`).

## 11. Acceptance criteria

- [ ] `pnpm test` runs all 17 projects and passes; the report lists each project name.
- [ ] `pnpm test:coverage` fails when a threshold is lowered artificially in a throw-away branch for `packages/domain` (verified once).
- [ ] Given a test calling `fetch("https://example.com")`, then it fails with the "Network access is forbidden" message.
- [ ] Given a test that leaves an unhandled rejection, the run fails.
- [ ] `ui-kit` and `desktop` tests run in jsdom with jest-dom matchers; `domain` tests run in Node (asserted by a smoke test reading `typeof document`).
- [ ] `TZ` is `UTC` inside tests (asserted).
- [ ] `vitest run --shard=1/2` and `2/2` together run every test once.

## 12. Test plan

Meta-tests in `tools/vitest-setup/*.test.ts` (fetch blocked, unhandled rejection reaction via child process, environment per package via a table-driven test over project configs). Commands: `pnpm test`, `pnpm test:coverage`, `pnpm test:int` (no files yet, `--passWithNoTests` only for this script).

## 13. Parallelization notes

Parallel with SETUP003/005/008..012. Hotspots: `vitest.shared.ts` (owned here; area tasks add tests, never edit it; threshold changes go through a proposal). Each area task creates its tests in its own package; the package-level `vitest.config.ts` for a new package is created by the task that adds the package.

## 14. Open questions and assumptions

- ASSUMPTION: thresholds per layer as stated; the Owner may raise them. Nothing below 70% is accepted for any package.
- ASSUMPTION: jsdom (not happy-dom) for fidelity with Testing Library; revisit if slow.
- ASSUMPTION: Vitest browser mode is not used; component rendering in a real browser is Storybook/Playwright (OVE_TEST004, OVE_TEST005).
