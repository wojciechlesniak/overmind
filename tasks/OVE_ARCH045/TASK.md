---
id: OVE_ARCH045
title: "Remove completed Vitest transition"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH043", "OVE_ARCH057"]
soft_depends_on: []
provides: ["lib:vitest-static-discovery"]
needs: ["lib:vitest-relocation-batch-four", "lib:ids"]
owns: ["tools/vitest-projects/discovery.ts", "tools/vitest-projects/discovery.test.ts", "tools/vitest-projects/coverage.ts", "vitest.config.ts", "vitest.shared.ts", "tools/tsconfig.json", "tools/boundaries/vitest-projects.test.ts", "packages/adapters/system/vitest.config.ts", "tools/vitest-projects/packages/adapters/system/vitest.config.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md", "tasks/OVE_ARCH057/TASK.md", "tasks/_proposals/OVE_ARCH057-system-workspace-wiring.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH045: Remove completed Vitest transition

## 1. Summary

Remove legacy locations after all 17 products, including system, are registered.
Retain 18 actual workspaces plus the separate boundary-rules project, coverage-root
parity and the real two-shard union in the final static config inventory.

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

1. After 043 and 057 merge, require tools/vitest-projects/<package>/vitest.config.ts for all 17 products. Move only the added system config from packages/adapters/system/vitest.config.ts to tools/vitest-projects/packages/adapters/system/vitest.config.ts, deleting its old copy in the same commit; preserve adapter-system/node, its original package root, shared setup, includes/excludes and infrastructure 80/80/75/80 thresholds. Each relocation batch keeps its original four-move allocation; only the registered system inventory counts change. Remove only legacy-location selection support from discovery/coverage; Tools and boundary-rules keep their configs.
2. Deny a surviving old config, a missing new one, duplicate path, symlink/escape or unknown workspace instead of falling back or skipping. Static coverage imports must list each canonical selected module once.
3. Keep exactly 18 workspace projects (17 products + Tools) plus boundary-rules = 19 test projects. Compare real workspace discovery against the independently declared expected path/name/environment/threshold inventory.
4. Adapt tools/boundaries/vitest-projects.test.ts to use the new static coverage module and separate plugin project count. Preserve all 18 workspace threshold keys at original package/src/** roots, including system; none of the original 17 keys may disappear or weaken.
5. Prove all 17 relocated configs occur in the actual root TypeScript test program and none in Tools production program; retain exact config-subtree exclusion installed by 036.
6. Run real full discovery/two-shard union and existing merged-coverage denial after fallback removal; no config import waiver or missing-project success remains.

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

- [ ] All 17 products use only new configs; old/missing/duplicate/unknown/symlink inputs fail closed.
- [ ] Actual inventory is 18 workspaces plus plugin = 19 projects, with unchanged names/environments/source thresholds and two-shard test union.
- [ ] Actual test compiler includes all 17 moved configs and production compiler excludes them; coverage negative test retains its original failure.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/vitest-projects/discovery.test.ts tools/boundaries/vitest-projects.test.ts tools/ci/coverage-merge.test.ts
- Run actual root two-shard reports and configured CI discovery; pnpm typecheck.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
