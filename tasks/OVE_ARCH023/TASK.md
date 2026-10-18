---
id: OVE_ARCH023
title: "Implement public checker and complete local plugin"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH019", "OVE_ARCH020", "OVE_ARCH022"]
soft_depends_on: []
provides: ["lib:boundary-public-tools"]
needs: ["lib:boundary-structural-rules", "lib:boundary-capability-rules", "lib:boundary-workspace-scanner"]
owns: ["tools/boundaries/check.ts", "tools/boundaries/cli.int.test.ts", "eslint-rules/boundaries/index.ts"]
reads: ["tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH023: Implement public checker and complete local plugin

## 1. Summary

Public text/JSON exit1 failures and native ESLint loading; seven complete rules exposed through boundariesConfig; safe malformed-policy diagnostics.

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

1. Provide boundaryPlugin(root) with exactly seven rules and boundariesConfig(root)->flat ESLint config[]. Each rule is enabled as error; noInlineConfig is true, without silencing the explicit no-disable rule.
2. Implement tools/boundaries/check.ts with strict --root and --json arguments. Default root is cwd; success exit0, any diagnostic/analysis failure exit1. Do not spread the plugin into global root config yet.
3. Text output is path:line:col ruleId message; JSON is {schemaVersion:1,diagnostics:[Diagnostic...]}. Locations and codes must match scanner results without multiline/raw-input leaks.
4. Malformed/unavailable analysis returns one safe BOUNDARY_ANALYSIS_ERROR at .:1:1 with a fixed message; do not print source, paths from exceptions, stacks or partial success.
5. Use native ESLint class/flat config and the real public TypeScript CLI in disposable repositories; do not replace command tests with direct function calls.
6. Root-facing module remains an export API only until053; no always-green reserved script or incomplete architecture CI gate is introduced.

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

- [ ] Native CLI valid root returns0; real forbidden source returns1 with exact text and schema1 JSON locations.
- [ ] Malformed policy/arguments return1 with fixed safe diagnostics and no leaked hostile input.
- [ ] Native ESLint loads all seven rule factories as error and explicit suppression still fails, with only the independently asserted noInlineConfig warning.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run --config vitest.int.config.ts tools/boundaries/cli.int.test.ts
- pnpm exec vitest run --project boundary-rules; root activation is out of scope.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
