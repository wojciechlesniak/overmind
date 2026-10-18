---
id: OVE_ARCH024
title: "Prove the complete independent boundary fixture oracle"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH023"]
soft_depends_on: []
provides: ["lib:boundary-proving-oracle"]
needs: ["lib:boundary-public-tools"]
owns: ["tools/boundaries-fixtures/cases/apps/desktop/src/bad-adapter.ts.txt", "tools/boundaries-fixtures/cases/apps/desktop/src/bad-domain.ts.txt", "tools/boundaries-fixtures/cases/apps/desktop/src/bad-fs.ts.txt", "tools/boundaries-fixtures/cases/apps/desktop/src/bad-tauri.ts.txt", "tools/boundaries-fixtures/cases/apps/desktop/src/features/one/bad-peer.ts.txt", "tools/boundaries-fixtures/cases/packages/adapters/herdr/src/bad-runtime.ts.txt", "tools/boundaries-fixtures/cases/packages/adapters/sqlite/src/bad-peer.ts.txt", "tools/boundaries-fixtures/cases/packages/api-client/src/bad-application.ts.txt", "tools/boundaries-fixtures/cases/packages/application/src/bad-adapter.ts.txt", "tools/boundaries-fixtures/cases/packages/application/src/bad-deep.ts.txt", "tools/boundaries-fixtures/cases/packages/application/src/bad-gateway.ts.txt", "tools/boundaries-fixtures/cases/packages/application/src/bad-relative.ts.txt", "tools/boundaries-fixtures/cases/packages/contracts/src/bad-domain.ts.txt", "tools/boundaries-fixtures/cases/packages/domain/src/bad-clock.ts.txt", "tools/boundaries-fixtures/cases/packages/domain/src/bad-disable.ts.txt", "tools/boundaries-fixtures/cases/packages/domain/src/bad-dynamic.ts.txt", "tools/boundaries-fixtures/cases/packages/domain/src/bad-env.ts.txt", "tools/boundaries-fixtures/cases/packages/domain/src/bad-fs.ts.txt", "tools/boundaries-fixtures/cases/packages/domain/src/bad-layer.ts.txt", "tools/boundaries-fixtures/cases/packages/domain/src/bad-testing.ts.txt", "tools/boundaries-fixtures/cases/packages/domain/src/bad.generated.ts.txt", "tools/boundaries-fixtures/cases/packages/gateway/src/bad-adapter.ts.txt", "tools/boundaries-fixtures/cases/packages/gateway/src/bad-domain.ts.txt", "tools/boundaries-fixtures/cases/packages/ui-kit/src/bad-contracts.ts.txt", "tools/boundaries-fixtures/handwritten/boundaries.json.txt", "tools/boundaries-fixtures/boundaries.fixtures.test.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH024: Prove the complete independent boundary fixture oracle

## 1. Summary

Use the existing complete oracle: all 24 independent bad files and required good cases, exact EXPECT sets in both public engines, handwritten and generated real policy, and deletion/weakening of EACH of seven rules must fail.

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

1. Keep the entire existing boundaries.fixtures.test.ts oracle and all 24 EXPECT fixture files, not a new partial-cohort harness. Mini workspace is pnpm-less and one throwaway package per layer.
2. Generate a policy copy from real JSON at test time AND run the independent handwritten miniature matrix. Expected results derive from committed // EXPECT: <ruleId> <line> headers, never from implementation output.
3. Run ESLint class API and public standalone check.ts over each case; compare exact sets of path/rule/line/column as represented by the oracle: no missing or extra violations and no cross-engine agreement replacing independent expectations.
4. Required negatives cover all OVE_ARCH002 requirement6 imports/capabilities/features/test-only/relative cases plus independent dynamic, generated and suppression fixtures; a forbidden manifest dependency is separately denied.
5. Required positives cover every package permitted dependency, type-only, adapter application/ports, exact desktop Tauri bridge, testing from tests and Tools imports. Ambient test permissions remain denied.
6. Independently delete EACH rule and independently weaken EACH rule; every one of seven mutations must fail the same full oracle. Assert every rule appears in independent EXPECT data.
7. Keep explicit exact handling of noInlineConfig warning; never ignore warnings/extra diagnostics or fabricate skipped-file success.

The exact independent bad-file inventory (paths relative to tools/boundaries-fixtures/cases/) is:

| Fixture | Independent EXPECT header |
| --- | --- |
| apps/desktop/src/bad-adapter.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| apps/desktop/src/bad-domain.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| apps/desktop/src/bad-fs.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_BUILTIN 2` |
| apps/desktop/src/bad-tauri.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_PACKAGE 2` |
| apps/desktop/src/features/one/bad-peer.ts.txt | `// EXPECT: BOUNDARY_FEATURE_CROSS_IMPORT 2` |
| packages/adapters/herdr/src/bad-runtime.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| packages/adapters/sqlite/src/bad-peer.ts.txt | `// EXPECT: BOUNDARY_CROSS_ADAPTER 2` |
| packages/api-client/src/bad-application.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| packages/application/src/bad-adapter.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| packages/application/src/bad-deep.ts.txt | `// EXPECT: BOUNDARY_DEEP_IMPORT 2` |
| packages/application/src/bad-gateway.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| packages/application/src/bad-relative.ts.txt | `// EXPECT: BOUNDARY_DEEP_IMPORT 2` |
| packages/contracts/src/bad-domain.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| packages/domain/src/bad-clock.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_GLOBAL 2` |
| packages/domain/src/bad-disable.ts.txt | `// EXPECT: BOUNDARY_NO_DISABLE 2` |
| packages/domain/src/bad-dynamic.ts.txt | `// EXPECT: BOUNDARY_DYNAMIC_IMPORT 2` |
| packages/domain/src/bad-env.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_GLOBAL 2` |
| packages/domain/src/bad-fs.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_BUILTIN 2` |
| packages/domain/src/bad-layer.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| packages/domain/src/bad-testing.ts.txt | `// EXPECT: BOUNDARY_TEST_ONLY 2` |
| packages/domain/src/bad.generated.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_BUILTIN 2` |
| packages/gateway/src/bad-adapter.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| packages/gateway/src/bad-domain.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |
| packages/ui-kit/src/bad-contracts.ts.txt | `// EXPECT: BOUNDARY_FORBIDDEN_IMPORT 2` |

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

- [ ] All 24 independently declared bad files match exact expected sets for BOTH engines under real and handwritten policies.
- [ ] Every required good case passes; forbidden dependency fails; every seven-rule delete AND weaken mutation is rejected.
- [ ] Fixture execution never loads offending code, and malformed source/policy/unknown packages retain fail-closed results.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/boundaries-fixtures/boundaries.fixtures.test.ts
- pnpm exec vitest run --config vitest.int.config.ts tools/boundaries/cli.int.test.ts; retain full oracle not a new cohort harness.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
