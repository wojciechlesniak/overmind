---
id: OVE_ARCH036
title: "Implement dual Vitest discovery and coverage transition"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_progress
depends_on: ["OVE_SETUP004", "OVE_SETUP017", "OVE_ARCH018", "OVE_ARCH033", "OVE_SETUP024"]
soft_depends_on: []
provides: ["lib:vitest-dual-discovery"]
needs: ["lib:boundary-eslint-resolution", "lib:engine-lifecycle-tooling"]
owns: ["tools/vitest-projects/discovery.ts", "tools/vitest-projects/discovery.test.ts", "tools/vitest-projects/coverage.ts", "vitest.config.ts", "vitest.shared.ts", "tsconfig.tests.json", "tools/ci/coverage-merge.test.ts", "tools/vitest-setup/README.md", "tools/tsconfig.json"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH036: Implement dual Vitest discovery and coverage transition

## 1. Summary

All 17 workspace projects (16 products plus Tools) exactly once, with the separate boundary-rules project retained, either canonical legacy OR relocated config per package; zero or both fail. Coverage keyed to PRODUCT source root, original thresholds/env; both real shards union once.

## 2. Context

Owner approved splitting OVE_ARCH002 on 2026-10-18, without a size or policy exception.
This task provides one independently verifiable prerequisite; OVE_ARCH002 retains final acceptance.

## 3. Scope (in)

Implement only the exact API/data/caller requirements below and the enumerated owns paths.
Shared paths require the integrator and affected owner to approve the exact finite integration.

## 4. Out of scope

No new product behavior, matrix permission, dependency version, policy exception or foreign claim/status.
No acceptance of OVE_ARCH002 or replay of its preserved bulk implementation; keep existing newer guards.

## 5. Detailed requirements

1. Provide discoverProjects(root) with an explicit inventory of16 product package paths plus Tools and the separate boundary-rules project. For each product, admit EITHER <package>/vitest.config.ts OR tools/vitest-projects/<package>/vitest.config.ts, exactlyone canonical regular config.
2. Missing/duplicate/escaping/symlink configurations fail before Vitest executes tests; do not silently skip a missing package or import both alternatives. There are17 workspace projects and one additional plugin project:18 total after 018.
3. Root projects use the admitted exact paths. Add coverage.ts with STATIC literal imports of the presently selected config namespaces; each later batch updates only its four imports. No variable config import or manually omitted project.
4. Move packageCoverage out of vitest.shared.ts so static config imports cannot create a sharedConfig/coverageThresholds initialization cycle. Preserve every 17 workspace threshold under its ORIGINAL <package>/src/** key, never the relocated config directory; the extra plugin project cannot dilute product gates.
5. Before moving any config, exclude only tools/vitest-projects/** from Tools production tsconfig and include every selected config in the root test program. Keep Node/DOM/Vitest typing outside pure product source.
6. Preserve environment/setup/include/exclude/timezone/retry/worker/coverage behavior. Adapt the real isolated coverage-merge fixture to copy its actual required configurations/manifests/helpers; never weaken its per-domain unimported-function failure assertion.
7. Prove discovery transition positives/denials, actual18-project inventory and two-shard test-ID union once each; keep all existing configured CI shards and merged per-package coverage failure controls.

## 6. Design notes

N/A, functionality only. Public signatures/data and explicit denied cases above define the contract.

## 7. Reuse

Use the existing TypeScript/ESLint/Vitest and bounded tooling APIs. Canonical policy stays single-source.
Keep ESLint and standalone violation decisions independent; no copied permissive parser or second matrix.

## 8. Architecture and code placement

Exact source/test/caller paths are listed in owns. Product packages never import Tools.
Reconcile current OVE_SETUP017, OVE_OSS004 and OVE_ARCH003 integrations; preserve their protections.

## 9. Security and safety

Repository/config/source inputs are data. Preserve fail-closed canonical/symlink/regular-file/size/UTF8 rules.
Keep safe diagnostics, no secret values, actual Git isolation and all dependency/license/install controls.
Normal hooks, sensitive configuration labels, ownership and independent review remain mandatory.

## 10. Errors and edge cases

The explicit missing/malformed/unsafe cases above deny, never become a stub, skip or permission exception.
A genuine prerequisite/test failure remains recorded and stops dependent work; obtain a decision for scope conflicts.

## 11. Acceptance criteria

- [x] Every product has exactlyone admitted config; missing, both-present, wrong-root and symlink/escape cases deny before execution.
- [x] Actual root discovers18 unique test projects; all 17 workspace source-root thresholds are unchanged and static imports have no initialization cycle.
- [x] Two actual shards cover every test ID exactlyonce; original CI shard/merge negative coverage probe still fails uncovered domain independently.
- [x] Root test TS includes configs while Tools production TS excludes only the new config subtree; pure source gains no test/DOM ambient types.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/vitest-projects/discovery.test.ts tools/ci/coverage-merge.test.ts
- Run actual root --shard=1/2 and --shard=2/2 with machine-readable reports; compare union/duplicates. Preserve configured CI shards too.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.

Native packaging prerequisite (2026-10-21): the existing verifier rejects the exact
UNIMPLEMENTED=true foundation inputs added by OVE_ARCH034. Packaging repair is
outside this task's owns. At that original checkpoint, integration acceptance remained blocked pending a finite
owning repair and successful rerun of the unchanged checks. See the
[coordination proposal](../_proposals/OVE_ARCH036-engine-packaging-prerequisite.md).

### Continuation verification evidence (2026-10-23)

The original native failure remains recorded. SETUP024 repaired the packaging prerequisite
and merged as 95cecab; its actual post-DEVELOP checks passed. The later ADR CLI startup
repair merged as 9573361 and passed its own actual 123-case/30-file post verification.
Neither baseline result is acceptance of this task.

Unchanged source ab00eb9 passed fresh typecheck, lint, all 1593 unit cases across the
actual 18-project inventory, and both real shards once: 707 plus 886 cases. Their exact
project/test-id sets are disjoint and their union equals the full run with zero missing,
extra or duplicate identities. All 62 focused discovery/coverage cases passed; the original
three-shard merged-coverage uncovered-domain failure assertion and budgets remain intact.

Dependency, license, production-high/all-critical audit, implemented architecture registry,
secret history/tree, SBOM, build, docs and agent-rule checks passed. The standalone boundary
caller is unavailable and is not called passed. Independent whole Standards and Spec reviews
of that source found no issues. Both reviewers approved the finite v6 native inventory
extension: only the two changed Vitest control pins, with all 123 identities in 30 files
and the other 35 pins preserved. This inventory is not an executed native result.

The first four content criteria are supported by those actual checks. The final gate criterion
remains unchecked: native lifecycle, fresh exact-head hosted/security and independent whole
reviews, followed by actual post-DEVELOP verification, are still required. No parent ARCH002,
future relocation-batch, runtime isolation or release acceptance is claimed.

The later 42dde85 staging-claim push failed its 30000ms policy-matrix unit test;
that RED remains separate from the earlier full/shard PASS. Root's finite shared
[fixture-startup repair](../_proposals/OVE_ARCH036-policy-fixture-startup.md) preserves
all 44 real checks and policies. At this pre-execution checkpoint, corrected focus and publication gates remain pending.
