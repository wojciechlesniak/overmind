---
id: OVE_ARCH019
title: "Implement structural ESLint rules"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH018"]
soft_depends_on: []
provides: ["lib:boundary-structural-rules"]
needs: ["lib:boundary-eslint-resolution"]
owns: ["eslint-rules/boundaries/allowed-imports.ts", "eslint-rules/boundaries/no-deep-imports.ts", "eslint-rules/boundaries/test-only.ts", "eslint-rules/boundaries/no-cross-adapter.ts", "eslint-rules/boundaries/no-disable.ts", "eslint-rules/boundaries/allowed-imports.test.ts", "eslint-rules/boundaries/no-deep-imports.test.ts", "eslint-rules/boundaries/test-only.test.ts", "eslint-rules/boundaries/no-cross-adapter.test.ts", "eslint-rules/boundaries/no-disable.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH019: Implement structural ESLint rules

## 1. Summary

All 5 RuleTester suites retain codes/locations and valid cases, including cross-feature imports and no-disable.

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

1. Implement allowedImports(root),noDeepImports(root),testOnly(root),noCrossAdapter(root),noDisable(root) as ESLint RuleModule factories, using018 metadata and canonical policy only.
2. allowed-imports reports FORBIDDEN_IMPORT,DYNAMIC_IMPORT,UNKNOWN_PACKAGE,UNRESOLVED_IMPORT and FEATURE_CROSS_IMPORT with the BOUNDARY_ prefix; apply the same matrix to type imports and segment-confined desktop peer features.
3. no-deep-imports reports BOUNDARY_DEEP_IMPORT for unexported/private targets, including @overmind/pkg/src; application/ports is allowed only by allowedSubpaths. Avoid duplicate classifications when a stronger unknown/cross-adapter/test-only rule owns the diagnostic.
4. Production access to testOnly packages/support targets reports BOUNDARY_TEST_ONLY. Sibling adapter access reports BOUNDARY_CROSS_ADAPTER; preserve permitted self/ports and established test matrix behavior.
5. no-disable examines actual comments, reporting BOUNDARY_NO_DISABLE for boundary-specific or blanket ESLint disable/inline-config. Message directs the contributor to file a proposal and ADR; quoted comment-like source is not a directive.
6. Each factory has its own valid/invalid RuleTester cases with exact IDs/locations, including normal imports, reexports, types and relative aliases.

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

- [ ] All five rule suites pass exact expected diagnostics, including forbidden domain->application and desktop cross-feature access.
- [ ] Public application/ports/type/test imports pass only where permitted; deep and production-testing imports fail under their own rule IDs.
- [ ] Boundary and blanket disable directives fail; source-string lookalikes do not; no matrix copy or escape hatch is added.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run --project boundary-rules eslint-rules/boundaries/allowed-imports.test.ts eslint-rules/boundaries/no-deep-imports.test.ts eslint-rules/boundaries/test-only.test.ts eslint-rules/boundaries/no-cross-adapter.test.ts eslint-rules/boundaries/no-disable.test.ts
- pnpm exec tsc -b eslint-rules/boundaries; verify all five exported RuleModule factories typecheck.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
