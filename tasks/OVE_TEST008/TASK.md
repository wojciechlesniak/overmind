---
id: OVE_TEST008
title: Define test reporting, flake policy and evidence artifacts for CI
area: TEST
kind: infra
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_TEST001, OVE_SETUP006]
soft_depends_on: [OVE_TEST007]
provides: ["lib:test-evidence", "doc:flake-policy"]
needs: []
owns: ["tools/testing/evidence/**", "tools/testing/flaky/**", "docs/testing/evidence-and-flakes.md"]
reads: ["docs/testing/STRATEGY.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16", "SPECIFICATION 19"]
adr_refs: [16, 25]
---

# OVE_TEST008: Define test reporting, flake policy and evidence artifacts for CI

## 1. Summary

Turn test runs into stored, real evidence (SPEC 19.5: never simulate tests, store real evidence) and keep the suite trustworthy: machine-readable reports per level, an acceptance-criteria coverage summary for the 15 SPEC 16 criteria, a quarantine mechanism with expiry for flaky tests, and a retry policy that cannot hide real failures.

## 2. Context

The product itself will store test reports as Artifacts for Quality Gates (SPEC 7); the repository follows the same discipline: every CI run uploads reports, and release candidates carry an evidence bundle (unit/integration/security/e2e/visual/escape results, SBOM, supply-chain check). Many agents add tests; flaky tests would erode trust and block merges.

## 3. Scope (in)

- Reporter configuration contract (JUnit XML + JSON per Vitest project and Playwright) and naming of artifacts.
- `tools/testing/evidence/collect.ts`: assembles the evidence bundle and `evidence-summary.json`/`.md`.
- SPEC 16 criteria coverage matrix generator (from test titles/tags/task metadata).
- Flake policy, quarantine registry, retry rules, nightly repeat job definition.

## 4. Out of scope

- CI workflow files (`OVE_SETUP006` includes fragments from this task). Test content. The in-product Quality Gate evidence storage (WFRT).

## 5. Detailed requirements

1. **Reports:** every test project writes `reports/<project>/junit.xml` and `reports/<project>/results.json` (Vitest `--reporter=junit --reporter=json`, Playwright `junit` + `json` + `html`). CI uploads `reports/**`, Playwright traces on failure, visual report (TEST005), escape report (TEST007), coverage (lcov + summary), SBOM and supply-chain output (SEC006). Retention: 30 days for PRs, 1 year for release candidates.
2. **Evidence bundle** for tags/releases: `evidence/<version>/` with `summary.md`, `summary.json` (commit, date, tool versions, per-level counts pass/fail/skipped, coverage per package, escape verdicts, visual deviations summary, dependency/license status, list of skipped security tests with reasons), `SHA256SUMS`; produced by `pnpm evidence:collect`, reproducible from the downloaded artifacts. It never contains secrets (SEC003 scan runs on the bundle) or absolute paths (home-scrubbed).
3. **Acceptance criteria coverage matrix:** `pnpm evidence:criteria` maps SPEC 16 criteria 1..15 to tests using a registry file `tools/testing/evidence/spec16-map.json` (criterion -> array of test tags/title patterns/task ids; seeded from TEST001's mapping table) and reports for each criterion: tests found, last result, level; criteria without passing tests are listed as GAP. Tests declare the criterion with a title tag `[SPEC16.8]`. Release evidence requires no GAP for criteria marked automatable.
4. **Flake policy (documented and enforced):** (a) unit/contract/security tests run with 0 retries; (b) integration and e2e: 1 retry on PR runs, 0 on `main` and nightly; any test that passes only on retry is recorded as `flaky` in the report; (c) a test flaking twice in 7 days is auto-listed in `tools/testing/flaky/quarantine.json` by the nightly job proposal (a human merges the PR) with owner task id, issue link, date and expiry (14 days); quarantined tests still run in a separate non-blocking job; expiry without fix fails the build (`flaky-expired`); (d) quarantine is forbidden for `*.sec.test.ts`, escape tests and visual self-tests; (e) `it.skip`/`.only` lint (TEST001) stays; (f) nightly `test:repeat` job runs integration and e2e 10 times and reports instability.
5. **Fail-fast hygiene checks (CI step `tests:hygiene`):** detects tests without assertions (TEST001 rule results), skipped test count increase vs `main` (fails when skipped security/escape tests increase), duplicated test titles within a file, changed snapshot files without a changed source file (visual excluded, covered by TEST005).
6. **PR comment:** a summary (counts, new skips, coverage delta, flaky list, visual/escape status) posted as a single updatable comment by the CI step; text contains no log excerpts from tests (avoids leaking data).
7. **Timing budget tracking:** reports include duration per project; CI warns when the unit project exceeds 90 s or integration 5 min (TEST001 budgets); slowest-20 tests listed.
8. **Local helpers:** `pnpm test:repeat -- <pattern> [--times 20]`, `pnpm evidence:collect --local`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

TEST001 conventions and mapping table; TEST005/TEST007 reports; SEC006/SETUP007 outputs; SEC003 scanner; front matter parser (ARCH009).

## 8. Architecture and code placement

`tools/testing/evidence/{collect.ts,criteria.ts,spec16-map.json,render-summary.ts}`, `tools/testing/flaky/{quarantine.json,check.ts,propose.ts}`, docs. Node scripts, no runtime dependencies beyond built-ins and `fast-xml-parser` (MIT; justification: JUnit parsing).

## 9. Security and safety

Evidence is only trustworthy if tests are real: the bundle contains raw reports, not hand-written summaries; checksums prevent silent edits; the collector refuses to run if any required report is missing (fail closed). Reports are scanned for secrets and home paths before upload. Quarantine cannot be used to silence security tests. Release evidence lists any skipped security tests.

## 10. Errors and edge cases

- Missing report for a required level: collector exits non-zero listing which.
- Runs on forks: reports uploaded without secrets-bearing environments; escape tests not run, marked `not-run (fork)`; release evidence cannot be built from fork runs.
- Test title tags malformed: ignored with warning.
- Clock/timezone in summaries: UTC.
- Large traces: capped (50 MB per run); oldest dropped with a note.

## 11. Acceptance criteria

- [ ] CI reporter contract documented and the collector assembles a bundle from sample reports (fixtures) with checksums.
- [ ] SPEC 16 matrix lists all 15 criteria with GAP detection tested on fixtures.
- [ ] Quarantine check fails on expired entries and on quarantined security/escape/visual self-test files.
- [ ] Retry policy documented; a test that passes on retry is flagged `flaky` in the summary fixture.
- [ ] Skipped-security-test increase fails `tests:hygiene`.
- [ ] Bundle scan finds no secrets/home paths in fixtures; planted secret fails the scan.
- [ ] `docs/testing/evidence-and-flakes.md` explains evidence for releases and the flake workflow.

## 12. Test plan

Unit tests with fixture JUnit/JSON files for collector, criteria mapper, quarantine checker; snapshot of the Markdown summary (no secrets). Commands: `pnpm vitest run tools/testing/evidence tools/testing/flaky`, `pnpm evidence:collect --local`.

## 13. Parallelization notes

Independent; can start after TEST001 docs. SETUP006 consumes the CI fragments (`tools/testing/evidence/ci-job.yml`). No shared-file hotspots; `spec16-map.json` is the only data file edited by others (additive, one line per test group).

## 14. Open questions and assumptions

- ASSUMPTION: `[SPEC16.n]` title tags are sufficient to map tests to criteria; PROV/WFRT/PAUSE tasks add them to their relevant e2e/integration tests.
- Open: publishing evidence summaries to GitHub Releases automatically (SETUP014 decision).
