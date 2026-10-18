---
id: OVE_ARCH022
title: "Implement standalone static workspace scanner"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH017", "OVE_ARCH021"]
soft_depends_on: []
provides: ["lib:boundary-workspace-scanner"]
needs: ["lib:boundary-workspace-resolution", "lib:boundary-ts-analysis"]
owns: ["tools/boundaries/scan.ts", "tools/boundaries/imports.test.ts", "tools/boundaries/safety.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH022: Implement standalone static workspace scanner

## 1. Summary

Real scanner denies dependencies, matrix/deep/test-only/feature/platform/builtin/global/dynamic/suppression cases and unsafe inputs.

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

1. Export checkWorkspace(root)->Diagnostic[]; Diagnostic has path,line,column,ruleId,message. Use the TS compiler API plus017/OVE_ARCH021, independently of ESLint rule implementation.
2. Inspect actual workspace manifests and governed TS/JS files, including *.generated.* and test files. Use only established build/cache/store exclusions; an unowned root helper/ignored output cannot become an import escape.
3. Validate declared runtime dependencies against matrix; forbidden entries report BOUNDARY_FORBIDDEN_DEPENDENCY. Present workspace packages without policy report BOUNDARY_UNKNOWN_PACKAGE even when no other import exists.
4. Validate all import forms/aliases, package exports/ports, peer adapters/features, test-only modules and platform/builtin/global capabilities, with the rule IDs defined by OVE_ARCH002. Nonliteral/unresolved imports and boundary suppressions are errors.
5. Fail closed on missing/invalid policy, malformed source, unsafe paths, missing governed manifests or analysis failure; unknown/unreadable input is never a successful skip. Never import/evaluate scanned source.
6. Report deterministic repository-relative path and one-based line/column. Keep positive per-layer/type/ports/store cases and exact error multiplicity; tests retain ambient restrictions.

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

- [ ] Imports and safety suites prove each import/dependency/global/suppression denial with exact ID/location and all known permitted cases.
- [ ] Generated/unknown-package/missing-manifest/malformed/unsafe inputs cannot evade scan; no blanket symlink/store or ignored-build allowance.
- [ ] The scanner does not call ESLint decisions; public diagnostics remain serializable and stable.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/boundaries/imports.test.ts tools/boundaries/safety.test.ts
- Real whole-repo runtime<20 s remains OVE_ARCH002 proof, not this scoped run.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
