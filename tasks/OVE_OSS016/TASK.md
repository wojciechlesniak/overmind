---
id: OVE_OSS016
title: Avoid redundant ADR history queries at an identical validated base
area: OSS
kind: infra
size: S
priority: P0
mvp: true
status: done
depends_on: [OVE_OSS006]
soft_depends_on: []
provides: []
needs: []
owns:
  - tools/adr/history.ts
  - tools/adr/history-performance.test.ts
  - tools/adr/history-performance.int.test.ts
reads: ["tools/adr/ports.ts", "tools/adr/history-blobs.ts", "tools/adr/public-cli-fixture.ts", "tools/adr/archive-history.int.test.ts", "tasks/OVE_OSS006/TASK.md", "tasks/OVE_OSS014/TASK.md", "tasks/_proposals/OVE_OSS016-adr-history-performance.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [8, 16, 17]
---

# OVE_OSS016: Avoid redundant ADR history queries at an identical validated base

## 1. Summary

Remove duplicate per-record history traversal when validated HEAD and comparison base are the same commit. Preserve every historical validation and the original public CLI budgets; an optimization is not acceptance of a failing integration suite.

## 2. Context

OSS006 supplies strict ADR tooling under SPEC 19 and ADR 0008. Two unchanged SETUP024 integration runs reproduced archive-history CLI ETIMEDOUT at 3000 ms inside 15000 ms cases. Root-authorized read-only diagnosis on 2026-10-22 measured redundant queries; the complete timeout cause remains UNCONFIRMED.

## 3. Scope (in)

- Invocation-local reuse of the already validated commit list for an identical validated head/base, with semantic and query-count regressions.
- Real public CLI and original integration verification, retaining raw failure and timing evidence.

## 4. Out of scope

- Legacy history proof, ADR 0029 translation and migration: OSS014; complete production collection/index closure: OSS015.
- CLI startup/import redesign, ports/fixtures/deadlines, dependencies, policy, runtime, workers and unrelated packaging: separately registered owning work if needed.

## 5. Detailed requirements

1. MUST capture bounded current public-CLI timing and production Git call counts before implementation, using isolated real-Git fixtures and unchanged source. Preserve both earlier failed suite receipts; a successful diagnostic does not supersede them.
2. MUST reuse `Set(commits)` only after both full 40-character commit IDs are validated and `head === base`. The existing `git log --format=%H --reverse <head> -- <pathspec>` and `rev-list <base> -- <pathspec>` then select the same commit set; ordering is irrelevant to membership. Reuse remains per invocation and exact per-record pathspec.
3. MUST retain the existing per-record `rev-list` query for every divergent head/base, including matching trees, branches with unpublished changes/reverts and merges. Equality of trees, prefixes or abbreviated IDs cannot authorize reuse.
4. MUST inspect every original historical version and retain all identity, deletion/rename, archive/hash, lifecycle, accepted/superseded body and label checks. Preserve commit/path/query/text/blob/cache budgets, batching, bounded fallback reads, subprocess limits and fail-closed diagnostics; no subset, cutoff, skipped check or permissive fallback.
5. MUST write regressions before the change: equal-head query reuse while real historical violations still deny; divergent history retains its query and label distinction; merge histories, empty histories, invalid IDs, repeat invocations and existing bounds remain correct. Use existing ports/parsers and isolated real-Git fixtures without executing repository content.
6. MUST run the unchanged public archive-history complete/missing/tampered tests and applicable full integration suite with their original 3000 ms child and 15000 ms case budgets, plus normal required gates. If the bounded change does not resolve the failure, retain FAIL and propose a separately owned fix; never mark this task or its blocked consumers accepted.
7. MUST preserve the normal `config-change` label/Owner protection for protected ADR tooling, independent whole Spec and Standards reviews, exact-head hosted gates and ordinary finish/integration. No new dependency or public API is needed.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Reuse OSS006 `checkHistory`, `HistoryGit`, bounded blob reads, lifecycle/parser and confined filesystem boundaries. Add no second checker, copied parser or persistent cache.

## 8. Architecture and code placement

Development tooling remains in the three exact owned paths. Expected production delta is below 40 non-test lines, with no port or consumer contract change. Tests exercise production behavior; original tests and fixtures remain unchanged.

## 9. Security and safety

Git objects, metadata and paths remain untrusted data. Preserve canonical path/symlink/mount restrictions, shell-free bounded argv, isolated fixture Git environment, safe diagnostics and every denial. No secrets, data execution, history rewrite, policy change or new permission; retain append-only audit behavior where available.

## 10. Errors and edge cases

- Invalid/unavailable refs and oversized/malformed history: retain fail-closed behavior before reuse.
- Divergent refs or changed invocation: recompute through the original query; no cross-record or cross-run cache.
- Equal refs with tampered archives, invalid transitions or immutable-body edits: deny normally after complete history inspection.
- Remaining timeout or another gate failure: retain the actual failure and stop acceptance.

## 11. Acceptance criteria

- [x] Actual before/after public timing and Git counts are retained with exact source pins, raw results and original failed receipts; no unconfirmed cause is presented as fact.
- [x] Equal validated refs eliminate redundant per-record `rev-list` calls; fresh regressions prove all historical denials and original resource/query budgets remain intact.
- [x] Divergent, merged, empty, malformed and repeated-invocation cases retain correct original semantics, including unpublished accepted-body authorization.
- [x] Original public archive-history cases and applicable full integration, unit, type/lint/build, security/dependency/license/audit/secrets/SBOM and implemented architecture checks pass without weakening assertions, deadlines, workers or policy.
- [x] Independent whole Spec/Standards reviews and exact-head required hosted gates pass before normal finish/integration; no legacy migration or consumer acceptance is claimed here.

## 12. Test plan

Add semantic/query-count cases in the owned test files through production `checkHistory` and real isolated Git histories. Run focused new regressions RED then GREEN and unchanged `archive-history.int.test.ts`, then normal `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:int`, build and applicable security checks. Compare per-command measurements without relying on machine-speed assertions as semantic proof. Serialize broad checks through the approved coordinator; retain all failures.

## 13. Parallelization notes

OSS006 must be merged first. Add OSS016 as a hard dependency of future OSS014 because both own `history.ts`; preserve OSS014's migration scope and all acceptance criteria. Do not edit SETUP024, ARCH036 or another active worktree. Shared/configuration changes require a finite owning proposal. Follow the linked finite source-handoff sequence; source integration does not complete either task.

## 14. Open questions and assumptions

- Preflight fixture measurements: complete public CLI 2001 ms, 30 `rev-list` calls totaling 638 ms; tampered public CLI 1663 ms, two `rev-list` calls totaling 36.8 ms and the expected denial. Both finished within 3000 ms; no repeated full-suite PASS or sole-cause claim follows.
- This candidate has measured value for the complete case but may not resolve the tampered timeout. If evidence requires broader work, stop the affected implementation and register its finite owning scope; do not widen this task or relax a gate.

### Verification evidence (2026-10-23)

The three owned source/test files are byte-identical to the reviewed source bridge merged in PR #1031. The validated-base optimization retains all original history checks; query-count, denial and resource-budget regressions remain unchanged. Original RED/GREEN, before/after query/timing evidence and failed timeout receipts are retained in the approved source handoff. No sole-cause claim follows.

At repaired DEVELOP `9d8e5f0`, all 123 native integration cases in 30 files passed with exact test identities and runtime verified. On this continuation, real typecheck, owned lint/format, all 41 ADR unit cases and 11 focused integration cases passed, including the original complete/missing/tampered archive cases at unchanged 3000 ms child and 15000 ms case limits. Dependency/license, production-high/all-critical audits, implemented architecture, history/tree secret scans, SBOM, build and docs checks passed. Ordinary staging publication also ran the repository hooks. No dependencies or policy changed.

Exact in-review head `4e88fd4` passed fresh independent whole Standards/Spec reviews and every required hosted check, including 123/123 native integration cases in 30 files with exact identities and runtime verified. The unchanged native finish command performed the DONE transition. Final evidence-head reviews, hosted gates and actual post-DEVELOP verification remain required before integration acceptance. Neither OSS014 migration nor any consumer task is accepted here.
