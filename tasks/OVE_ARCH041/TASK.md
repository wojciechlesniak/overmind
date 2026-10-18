---
id: OVE_ARCH041
title: "Relocate four Vitest configurations: workflow-runtime, herdr, keychain and notifications"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH039"]
soft_depends_on: []
provides: ["lib:vitest-relocation-batch-three"]
needs: ["lib:vitest-relocation-batch-two"]
owns: ["packages/workflow-runtime/vitest.config.ts", "tools/vitest-projects/packages/workflow-runtime/vitest.config.ts", "packages/adapters/herdr/vitest.config.ts", "tools/vitest-projects/packages/adapters/herdr/vitest.config.ts", "tools/vitest-projects/discovery.ts", "tools/vitest-projects/discovery.test.ts", "tools/vitest-projects/coverage.ts", "packages/adapters/keychain-macos/vitest.config.ts", "tools/vitest-projects/packages/adapters/keychain-macos/vitest.config.ts", "packages/adapters/notifications-macos/vitest.config.ts", "tools/vitest-projects/packages/adapters/notifications-macos/vitest.config.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH041: Relocate four Vitest configurations: workflow-runtime, herdr, keychain and notifications

## 1. Summary

Move exactly these four canonical configurations while preserving every project name/environment/root/include/exclude/setup/coverage threshold. The dual-location discovery must find exactlyone configuration per product package; missing or duplicate is denied. Update only the four selected static coverage imports; retain both actual shard union and no omitted project.

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

1. Move ONLY these four <package>/vitest.config.ts files to tools/vitest-projects/<package>/vitest.config.ts; delete each old config in the same commit after the new root is correct. packages/workflow-runtime: name=workflow-runtime, environment=node, coverage=core; packages/adapters/herdr: name=adapter-herdr, environment=node, coverage=infrastructure; packages/adapters/keychain-macos: name=adapter-keychain-macos, environment=node, coverage=infrastructure; packages/adapters/notifications-macos: name=adapter-notifications-macos, environment=node, coverage=infrastructure.
2. Each config root remains the absolute ORIGINAL product directory, never the Tools destination. Preserve its sharedConfig setup and export the same coverageThreshold metadata.
3. Keep literal coverage groups (lines/functions/branches/statements): core90/90/85/90, infrastructure80/80/75/80, ui70/70/65/70. Coverage keys remain <package>/src/**; no aggregate rescue between packages.
4. Keep src/**/*.test.{ts,tsx} and test/**/*.test.{ts,tsx} inclusion, **/*.int.test.ts exclusion, setup-node/per-file DOM behavior, TZ=UTC, LANG=C.UTF-8, globals:false, retry0, passWithNoTests:false and original worker/deadline settings.
5. Update exactly these four selected paths/static coverage imports in036 discovery. At every boundary each of16 products has exactlyone old/new config; missing and duplicate must deny. Retain Tools plus boundary-rules for18 total projects, without duplicate workspace registrations.
6. Keep all configs checked in the root test compiler and excluded from Tools production compile only by the dedicated config subtree; no product ambient/global/import exception.
7. Run the real four selected projects and actual two-shard union/parity reports; retain every other project and all configured CI shard/coverage regressions unchanged.

Actual selected project identities and fixed source roots:

| Product root | Project name | Environment | Threshold group |
| --- | --- | --- | --- |
| packages/workflow-runtime | workflow-runtime | node | core |
| packages/adapters/herdr | adapter-herdr | node | infrastructure |
| packages/adapters/keychain-macos | adapter-keychain-macos | node | infrastructure |
| packages/adapters/notifications-macos | adapter-notifications-macos | node | infrastructure |

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

- [ ] All four names/environments/original source roots and exact thresholds match the table in requirement1; both old/new copies never coexist.
- [ ] Discovery negative cases still reject missing/duplicate/symlink/wrong-root configs and actual root has18 projects once each.
- [ ] Original includes/excludes/setup/timezone/deadlines/coverage source globs remain exact; root test/production typing separation passes.
- [ ] Two actual shards include each original test ID once and selected projects retain all real tests, with no omitted other workspace.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/vitest-projects/discovery.test.ts
- pnpm exec vitest run --project workflow-runtime --project adapter-herdr --project adapter-keychain-macos --project adapter-notifications-macos
- Actual root --shard=1/2 and --shard=2/2 reports: verify test-ID union once; retain configured CI shards/coverage gates.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
