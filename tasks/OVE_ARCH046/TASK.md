---
id: OVE_ARCH046
title: "Retain timezone proofs in all four pure-package fixtures"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH041", "OVE_ARCH023"]
soft_depends_on: []
provides: ["lib:pure-timezone-fixtures"]
needs: ["lib:vitest-relocation-batch-three", "lib:boundary-public-tools"]
owns: ["packages/application/src/index.test.ts", "packages/domain/src/index.test.ts", "packages/contracts/src/index.test.ts", "packages/workflow-runtime/src/index.test.ts", "tools/boundaries/pure-fixtures.int.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH046: Retain timezone proofs in all four pure-package fixtures

## 1. Summary

Keep all four existing deterministic UTC/LANG proofs while eliminating forbidden ambient reads; no product-global capability or test exemption. Actual same assertions and meaningful failure detection remain.

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

1. Change only application/domain/contracts/workflow-runtime src/index.test.ts timezone fixtures; preserve their actual index import and Node-without-document assertion.
2. Keep deterministic winter AND summer UTC checks using explicit ISO dates (2020-01-01T12:00:00Z and 2020-06-01T12:00:00Z): both getTimezoneOffset() values must equal0.
3. Remove direct process.env/time/random ambient access in these governed pure-package tests; fixed-argument Date is valid, Date.now or zero-arg Date is not a replacement.
4. Retain shared setup TZ=UTC/LANG=C.UTF-8 and all original assertions/timeout. Do not add an exception for tests, broaden matrix permissions or import Tools into product tests.
5. Run all four actual projects and boundary analysis to prove these tests pass while an actual forbidden ambient capability in the same packages remains denied.
6. Add tools/boundaries/pure-fixtures.int.test.ts as a Tools-owned integration proof using the four actual corrected package timezone test sources. Before global OVE_ARCH053 activation, invoke the native ESLint class with the complete boundaryPlugin/boundariesConfig from OVE_ARCH023 explicitly, not the still-unactivated root configuration. Also run the ACTUAL tools/boundaries/check.ts --root <isolated-mini-workspace> --json on copied actual sources with the real policy and confined resolver scaffolding. Reuse existing miniature/CLI fixture seams; declarations may model external imports for static resolution only, never substitute runtime tests. Positive sources must have zero violations; an independent process.env/Date.now/zero-argument Date mutation must fail both tools with the real capability diagnostic. No new --files switch, full-root GREEN claim, variable import or activation dependency.

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

- [ ] All four package tests still import their index, assert no document and verify both seasonal UTC offsets.
- [ ] Boundary scanner and ESLint accept the corrected fixtures but still reject process.env/Date.now/zero-arg Date in the same package test scope.
- [ ] The explicit native complete plugin and actual public checker accept the copied corrected sources and reject the independently injected forbidden-capability control before OVE_ARCH053 exists; original real runtime project tests still run separately.
- [ ] No source API/permission/config/threshold or original test assertion was removed.

## 12. Test plan

- pnpm exec vitest run --project application --project domain --project contracts --project workflow-runtime
- pnpm exec vitest run --config vitest.int.config.ts tools/boundaries/pure-fixtures.int.test.ts; fixture must use native ESLint class with explicit OVE_ARCH023 config AND spawn the actual check.ts --root <isolated-mini-workspace> --json. No root/global lint PASS is claimed before OVE_ARCH053.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
