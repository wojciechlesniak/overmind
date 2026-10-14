---
id: OVE_TEST001
title: Write the test strategy, conventions and test-code lint rules
area: TEST
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP004, OVE_ARCH001]
soft_depends_on: [OVE_SETUP003]
provides: ["doc:test-strategy", "lib:test-lint-rules", "lib:test-naming-convention"]
needs: []
owns: ["docs/testing/STRATEGY.md", "docs/testing/CONVENTIONS.md", "eslint-rules/testing/**", "tools/testing/check-test-titles.ts"]
reads: ["tasks/CONVENTIONS.md", "docs/architecture/ARCHITECTURE.md", "docs/SPECIFICATION.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16", "SPECIFICATION 19"]
adr_refs: [3, 4, 19]
---

# OVE_TEST001: Write the test strategy, conventions and test-code lint rules

## 1. Summary

Define how Overmind is tested: the pyramid and what belongs on each level, Vitest project layout and file naming, naming of tests so they trace back to acceptance criteria, rules for determinism (no real time, randomness, network), what may be mocked (only ports), data/fixture rules, coverage and speed expectations, and security-test obligations. Ship ESLint rules and a small checker that enforce the mechanical parts.

## 2. Context

The Definition of Done requires a test for every requirement and negative tests for denied paths (CONVENTIONS section 8). SPEC 19.5: never simulate tests, store real evidence. SPEC 16 lists 15 acceptance criteria, several of which are only provable by end-to-end or escape tests (7, 8, 9, 10, 14). Many agents write tests in parallel, so conventions must be short, explicit and checkable. `OVE_SETUP004` configures Vitest and coverage thresholds; this task defines what goes in them. Companion tasks: TEST002 (utilities), TEST003 (port contract suites), TEST004 (UI e2e), TEST005 (visual), TEST006 (fake CLI), TEST007 (escape), TEST008 (reporting), TEST009..012 (simulators, a11y, recovery).

## 3. Scope (in)

- `docs/testing/STRATEGY.md`: pyramid, level definitions, ownership, gates, mapping of SPEC 16 acceptance criteria to test levels.
- `docs/testing/CONVENTIONS.md`: how to write a test (structure, naming, fixtures, async, time, randomness, snapshots, mocks, temp dirs, tags).
- ESLint rule set `@overmind/eslint-plugin-testing` and checker `tools/testing/check-test-titles.ts`.
- Test-level tags and Vitest project mapping (names and globs; SETUP004 applies them).

## 4. Out of scope

- Vitest configuration files and coverage numbers: `OVE_SETUP004` (this task states recommended values and SETUP004 may adjust). Test utilities: `OVE_TEST002`. CI wiring: `OVE_SETUP006`/`OVE_TEST008`.

## 5. Detailed requirements

1. **Pyramid and levels** (each with definition, scope, speed budget, runner, where files live):
   | Level | Scope | Files | Runner | Budget |
   |---|---|---|---|---|
   | Unit | one module/class, pure logic or use case with fakes | `src/**/*.test.ts` (colocated) | Vitest `unit` project | whole suite < 90 s on CI, single test < 200 ms |
   | Contract | one port, every implementation | `packages/testing/src/contracts/<Port>.contract.ts` + `<impl>.contract.test.ts` | Vitest `contract` | < 60 s |
   | Integration | real adapter against real dependency (temp dir, SQLite file, child process, real socket) | `*.int.test.ts` | Vitest `integration` | < 5 min |
   | Security | negative/abuse tests for gateway, Telegram, injection, paths, redaction | `*.sec.test.ts` | Vitest `security` | < 3 min |
   | Component | React components in jsdom/happy-dom with Testing Library | `*.test.tsx` | Vitest `ui` | < 90 s |
   | E2E UI | Playwright against the built UI and mock gateway | `apps/desktop/e2e/**/*.spec.ts` | Playwright | < 10 min |
   | Visual | screenshot comparison | `apps/desktop/e2e/visual/**/*.visual.spec.ts` | Playwright | included above |
   | System/escape | real sandbox on macOS | `tools/escape-tests/**` | custom runner (TEST007) | macOS CI only |
   | Recovery | kill/restart engine | `apps/engine/test/recovery/**` (TEST011) | Vitest `integration` | < 5 min |
   Target share: about 70% unit, 20% contract+integration+security, 10% e2e/visual/system. A defect found at a higher level gets a regression test at the lowest level that can express it.
2. **What to test where (rules):** domain rules and use cases -> unit with fakes; adapters -> contract + integration; gateway routes -> handler unit tests with fake use cases plus a few integration tests through the real pipeline; UI features -> component tests for logic, Playwright for flows and visuals; workflows -> runtime unit tests with fake providers and fake clock plus replay tests; anything touching the OS sandbox -> macOS-tagged tests and TEST007.
3. **Naming and traceability:** top-level `describe('OVE_<ID>: <subject>')` containing the task ID of the task that introduced the behaviour; `it` names are full sentences in Given/When/Then flavour: `it('denies a path that resolves outside the root through a symlink')`. Acceptance criteria are traced by a comment `// AC: OVE_X#<n>` or the test title containing `[AC<n>]`; `tools/testing/check-test-titles.ts` verifies (a) every changed test file has the prefix, (b) for the current task (`--task`), every acceptance criterion index 1..N appears in at least one test title or `AC:` comment (warns, becomes an error with `--strict`). 
4. **Determinism rules (MUST, lint-enforced):** no `Date.now()`, `new Date()` without args, `Math.random()`, `crypto.randomUUID()`, real `setTimeout`/`setInterval`/`sleep` with literals above 50 ms, `process.env` reads, or network calls in unit/component/contract tests: use `FakeClock`, `FakeIdGenerator`, fakes (TEST002). Integration tests may use real time with generous bounds and `waitFor(predicate, { timeoutMs })` helpers, never fixed sleeps. Tests must not depend on execution order or shared mutable state; each test creates its own temp dir (`withTempDir`) and cleans up. Parallel-safe by default (unique ports/paths from helpers).
5. **Mocking policy:** mock only ports (use fakes, not `vi.mock` of modules); never mock the unit under test; no module-level mocking of `fs`, `child_process` or `Date`; `vi.spyOn` allowed for observing calls on fakes. `vi.mock` is allowed only in UI tests for asset imports. Snapshot tests only for stable, reviewed structured output (generated docs, OpenAPI, JSON schema), never for logs, random or timing data, never containing secrets (SEC003 scan).
6. **Test data:** builders from TEST002 (no inline 40-field object literals); fixtures live next to tests in `__fixtures__/` (small) or `packages/testing/fixtures/` (shared, versioned); generated binary fixtures prohibited unless documented; fake secrets only from the corpus (SEC003).
7. **Assertions:** prefer `Result`-aware matchers (`expectOk`, `expectErr('code')`, TEST002); assert on error `code`, not message; avoid assertions on private structure; one behaviour per test; arrange-act-assert sections separated by blank lines.
8. **Negative and security tests:** every use case that can deny/fail has at least one test per documented error code; every task with a security section lists denied cases and tests for each (SEC007 U4). Property-based tests (fast-check) are required for parsers, canonicalisers, redactors and schedulers; fixed seeds recorded on failure.
9. **Coverage and quality gates (recommended values for SETUP004):** statements/branches per package: contracts 95/90, domain 95/90, application 90/85, workflow-runtime 90/85, gateway 85/80, adapters 75/70, ui-kit 80/70, desktop features 75/65; coverage may not decrease in a PR (compare to main). Mutation testing (Stryker) is optional later for `domain/security/**` (documented as P2).
10. **Flakiness:** a flaky test is a bug; policy in TEST008 (quarantine with issue within 24 h, no retries in unit). Tests must pass 20 consecutive runs locally (`pnpm test:repeat`, documented).
11. **SPEC 16 mapping table** in STRATEGY.md: for each of the 15 acceptance criteria list the level(s), the task(s) that provide the proof (for example criterion 8 -> TEST007 + BOX; 7 -> TEST011; 9/10 -> SEC008 + PERM; 13 -> contract test of channel parity + TEST004), and the evidence artefact produced (TEST008). The review pass uses it to detect gaps.
12. **ESLint rules** (plugin `eslint-rules/testing/`, applied to `**/*.test.*`, `**/*.spec.*`, `**/test/**`): `testing/no-only` (no `.only`), `testing/no-skip-without-reason` (`it.skip('...', ...)` must be `it.skip.if`/carry a comment `// skip: <reason> <issue>` ), `testing/no-ambient-time-random`, `testing/no-real-sleep`, `testing/no-network` (fetch, http, net imports in unit/component/contract), `testing/describe-prefix` (OVE id), `testing/no-vi-mock-modules` (except UI assets), `testing/no-snapshot-of-logs`, `testing/require-assertion` (a test without `expect`/`expectOk`), `testing/no-console`.
13. **Directory convention for test support:** `packages/testing/` (TEST002), per-package `test-support/` for package-specific helpers (not importable by others), `apps/engine/test-support/`.
14. **Documentation for newcomers:** a "Write your first test" walkthrough (use case with fake clock, then a contract suite, then a Playwright flow) with copy-paste snippets.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses `OVE_SETUP004` Vitest workspace, `OVE_ARCH002` plugin structure for custom rules (same folder layout `eslint-rules/<name>/`), `OVE_ARCH009` front matter parser for the title checker (`--task`). Utilities referenced in docs come from TEST002/TEST003.

## 8. Architecture and code placement

Docs: `docs/testing/`. Lint: `eslint-rules/testing/{index.ts,rules/*.ts}` with RuleTester tests. Checker: `tools/testing/check-test-titles.ts`. No production code. Rules are independent modules (OCP); config exported as `testingConfig()` for SETUP003's flat config.

## 9. Security and safety

Tests are part of the security posture: no real secrets, no real tokens, no network, no writes outside temp dirs and `OVERMIND_DATA_DIR` test roots. A lint rule forbids tests from touching the real home directory (`os.homedir()` usage in tests must go through `withFakeHome()` from TEST002). Tests must not weaken production checks (CONVENTIONS rule 7): no env flags in production code paths that exist only for tests unless compiled out in release (build assertion TEST011). Security tests must not be skippable without a capability flag and a reason (SEC005 convention reused).

## 10. Errors and edge cases

- A test legitimately needing real time (timeouts in ProcessRunner): allowed in `*.int.test.ts` with `// real-time: <reason>` comment accepted by the lint.
- Platform-specific tests (macOS): tagged `@macos` via `describe.runIf(process.platform === 'darwin')` helper `describeMacos()` so Linux skips them visibly (reported as skipped with reason).
- Flaky UI timing: use Playwright auto-wait locators; no `waitForTimeout`.
- Very slow property tests: `numRuns` budget helper with env override for nightly runs.
- Generated tests (matrix) must still have distinguishable titles.

## 11. Acceptance criteria

- [ ] `STRATEGY.md` contains the pyramid table, the rules in requirements 2, 4, 5, 8, 9 and the SPEC 16 mapping table with all 15 criteria.
- [ ] `CONVENTIONS.md` contains naming, determinism, mocking, fixtures, assertions and the first-test walkthrough.
- [ ] Each lint rule has RuleTester valid/invalid cases and is exported through `testingConfig()`.
- [ ] The title checker flags a test file without the OVE prefix and (in strict mode) a missing acceptance-criterion reference.
- [ ] A fixture test file using `Date.now()` in a unit test fails lint; the same in `*.int.test.ts` with the real-time comment passes.
- [ ] Documented Vitest project names/globs match those SETUP004 configures (consistency noted in the PR).
- [ ] `pnpm test:repeat` usage documented.

## 12. Test plan

RuleTester suites per rule; unit tests for the title checker with temp fixture trees; markdown lint on docs. Commands: `pnpm vitest run eslint-rules/testing tools/testing`, `pnpm lint`.

## 13. Parallelization notes

Docs first (agents need them to write tests), lint rules after. Independent of TEST002 for docs; the rules reference helper names, so agree on names (`FakeClock`, `withTempDir`, `expectOk`) with the TEST002 author. Conflict hotspot: the root ESLint config (SETUP003) — export `testingConfig()` and request inclusion via proposal.

## 14. Open questions and assumptions

- ASSUMPTION: Vitest projects are named `unit`, `ui`, `contract`, `integration`, `security`, `tools`.
- ASSUMPTION: coverage thresholds above are starting values; SETUP004 may calibrate after the first merge.
- Open: Stryker mutation testing for security-critical modules (P2).
