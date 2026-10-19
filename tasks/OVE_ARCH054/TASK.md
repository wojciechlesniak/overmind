---
id: OVE_ARCH054
title: "Implement independent TypeScript import and comment helpers"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH017"]
soft_depends_on: []
provides: ["lib:boundary-ts-imports-comments"]
needs: ["lib:boundary-workspace-resolution"]
owns: ["tools/boundaries/ts-imports.ts", "tools/boundaries/ts-comments.ts", "tools/boundaries/imports-comments.test.ts"]
reads: ["tasks/OVE_ARCH021/TASK.md", "tasks/OVE_ARCH002/TASK.md", "docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tasks/CONVENTIONS.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH054: Implement independent TypeScript import and comment helpers

## 1. Summary

Deliver the import-reference and genuine-suppression-comment portions of OVE_ARCH021 through independent TypeScript syntax helpers.

## 2. Context

Owner approved smaller tasks and PRs for OVE_ARCH002 without a size or policy exception.
OVE_ARCH021 exceeded the normal change budget; this finite child preserves its existing requirements and final acceptance.

## 3. Scope (in)

Implement only importsOf and suppressionPositions in the exact owned paths, with their independently preserved tests.
Coordinate shared paths through the integrator and affected owner; no foreign source or TASK edits.

## 4. Out of scope

No global capability analysis, scanner integration, ESLint violation decisions, new product scope, dependency or policy exception.
No acceptance of OVE_ARCH021, OVE_ARCH002 or any downstream consumer; do not replay preserved OVE_ARCH002 bulk implementation.

## 5. Detailed requirements

1. Export importsOf(SourceFile)->ImportReference[] and suppressionPositions(SourceFile)->number[]. ImportReference retains readonly node: ts.Node and specifier: string | undefined. Preserve the original public signatures.
2. Enumerate static imports/reexports/import-equals/import-type and import()/require calls. Preserve the precise AST node and undefined specifier for nonliteral targets; never execute or omit dynamic input.
3. Return actual directive offsets for boundary/blanket suppressions and inline rule reconfiguration. Distinguish genuine comments from string/template/regular-expression/JSX text, while retaining real expression-island and trailing EOF comments.
4. Use TypeScript AST/token locations for later exact line/column parity. Helpers import no ESLint rule implementation, perform no I/O and never execute scanned source, including generated modules.
5. Transfer only approved OVE_ARCH021 escrow source bytes and modes after registration and normal claim. Preserve the 31 imports/comments cases exactly once in imports-comments.test.ts; retain every AST body, assertion, fixture literal, offset and budget. The other 55 capability cases remain with OVE_ARCH021.
6. Independently test both syntax families before scanner integration. This child supplies only the portions allocated from original OVE_ARCH021 requirements 1, 2, 5 and 6; all six parent requirements and four final criteria remain binding there.

## 6. Design notes

N/A, functionality only. Existing public signatures and explicit malformed/denied cases define the contract.

## 7. Reuse

Use the existing TypeScript/Vitest and bounded tooling APIs without dependency changes.
Canonical policy remains single-source; independent helpers do not call or copy ESLint violation decisions.

## 8. Architecture and code placement

Keep the two pure helpers and their focused tests under tools/boundaries. Product packages never import Tools.
The existing SourceFile test fixture follows these tests; the real virtual TypeChecker fixture remains with OVE_ARCH021.

## 9. Security and safety

Source/configuration text is data. Preserve canonical/symlink/regular-file/size/UTF8 rules at existing input boundaries.
No secrets, source execution, new allowance, permission, install exception or duplicate policy; preserve normal hooks and independent review.

## 10. Errors and edge cases

Nonliteral import targets stay explicitly unverifiable; malformed or denied input never becomes a silent omission or allowlist.
Keep every historical failed check and review. A prerequisite failure stops dependent work; registration is not implementation evidence.

## 11. Acceptance criteria

- [ ] Every required import syntax retains its exact AST reference; nonliteral targets remain explicitly unverifiable and scanned modules are never executed.
- [ ] Genuine directive comments yield exact offsets, including expression/EOF cases; displayed strings/templates/JSX text remain valid negatives.
- [ ] All 31 allocated cases are preserved exactly once, with unchanged AST bodies/assertions/fixtures/budgets, and the two helpers import no ESLint rule implementation.
- [ ] Applicable CONVENTIONS Definition of Done, independent Standards/Spec review and fresh exact-head hosted gates pass before normal DEVELOP merge.

## 12. Test plan

- pnpm exec vitest run tools/boundaries/imports-comments.test.ts
- Independently prove all 86 original test bodies are allocated once across this child and OVE_ARCH021. OVE_ARCH021 executes both final suites after this child completes.

These are required future checks, not performed evidence. Preserve original assertions, budgets and retry0.

## 13. Parallelization notes

Claim normally after registration lands, OVE_ARCH017 passes and the existing parent claim metadata has been narrowed without overlapping writers.
OVE_ARCH021 additionally waits for this child; all downstream consumers still wait for full OVE_ARCH021 acceptance.
Historical OVE_ARCH002 overlap requires finite coordination; any other active path overlap stops. Rebase on latest DEVELOP.

## 14. Open questions and assumptions

Registration leaves this child and all parent criteria unchecked; no current WIP becomes accepted or a prerequisite provider before completion.
The integrator verifies ID/provider uniqueness, exact finite ownership and normal parent claim provenance before the child claim.
Measured scope, frozen escrow hashes and execution receipts belong in the proposal/PR, not recursive TASK evidence.
