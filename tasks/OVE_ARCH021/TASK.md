---
id: OVE_ARCH021
title: "Implement independent TypeScript syntax analysis"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: in_progress
depends_on: ["OVE_ARCH017", "OVE_ARCH054"]
soft_depends_on: []
provides: ["lib:boundary-ts-analysis"]
needs: ["lib:boundary-workspace-resolution", "lib:boundary-ts-imports-comments"]
owns: ["tools/boundaries/ts-globals.ts", "tools/boundaries/syntax.test.ts"]
reads: ["tasks/OVE_ARCH054/TASK.md", "tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH021: Implement independent TypeScript syntax analysis

## 1. Summary

All import/reexport/import-type/require forms, global aliases/shadowing, generated source, suppressions; parser never evaluates scanned code.

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

1. Export importsOf(SourceFile)->ImportReference[], forbiddenGlobalsOf(SourceFile,forbiddenNames,TypeChecker)->Node[] and suppressionPositions(SourceFile)->number[]. These are independent TS analysis helpers, not calls into ESLint decisions.
2. Enumerate static imports/reexports/import-equals/import-type and import()/require calls. Preserve the precise AST node and undefined specifier for nonliteral targets; do not execute or skip dynamic input.
3. Use lexical TypeScript symbols for capabilities, including shorthand assignments, named/global-object aliases and computed paths; retain zero-arg Date versus fixed-date distinction.
4. Only genuine same-file runtime lexical shadows legalize a name; declare/global declarations and other-file symbols must not mask an ambient capability.
5. Comment scanning returns actual directive offsets for boundary/blanket suppressions and inline rule reconfiguration; string/template/fence-like source content is never executed or treated as an arbitrary allowlist.
6. Use TS AST/token locations so the later scanner can emit exact line/column parity; test each syntax family independently before scanner integration.

### Delivery allocation

OVE_ARCH054 delivers importsOf and suppressionPositions for requirements 1, 2, 5 and 6.
OVE_ARCH021 delivers forbiddenGlobalsOf for requirements 1, 3, 4 and 6 and accepts all three helpers together.
The original six requirements and four final criteria above/below remain unchanged; child acceptance supplies no parent or OVE_ARCH002 acceptance.
Preserve all 86 existing cases exactly once: 31 imports/comments cases in OVE_ARCH054 and 55 global capability cases here.
Partition original test AST bodies without changing assertions, fixture text, offsets, budgets or controls; retain the real TypeChecker fixture here.
Use only the approved OVE_ARCH021 escrow after normative registration and coordinated claim metadata refresh; never replay OVE_ARCH002 bulk work.

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

- [ ] All required import syntaxes return exact references and nonliteral targets remain unverifiable rather than disappearing.
- [ ] Global alias/shadow/ambient/computed cases and suppression comments yield exact node/offset sets, with valid string/local-shadow negatives.
- [ ] Helpers import no ESLint rule implementation and execute no scanned module.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/boundaries/syntax.test.ts tools/boundaries/imports-comments.test.ts
- Retain later independent imports/proving tests; do not replace parity with the shared ESLint engine.

These are required future executions, not performed evidence. Preserve original budgets/assertions/retry0.

## 13. Parallelization notes

Claim normally only after registration lands and hard dependencies actually pass. Rebase on latest DEVELOP.
Exact overlapping shared paths have sequential writers; wait for the owner, never interpret a warning as permission.

## 14. Open questions and assumptions

Registration alone supplies no implementation or acceptance proof; claim only after the definition lands on DEVELOP.
Measured scope and line/move/generated-doc metrics belong in the external manifest/PR, not recursive TASK text.
OVE_ARCH002 retains all nine original criteria, including actual hosted forbidden-import and aggregate rejection.
