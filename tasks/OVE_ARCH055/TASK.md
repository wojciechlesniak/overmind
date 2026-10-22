---
id: OVE_ARCH055
title: "Collect TypeScript alias writes independently of capability decisions"
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: ["OVE_SETUP002", "OVE_SETUP004"]
soft_depends_on: []
provides: ["lib:boundary-ts-alias-writes"]
needs: ["lib:tsconfig-base", "lib:vitest-workspace"]
owns: ["tools/boundaries/ts-alias-writes.ts", "tools/boundaries/ts-alias-writes.test.ts"]
reads: ["tasks/OVE_ARCH021/TASK.md", "tasks/OVE_ARCH002/TASK.md", "tasks/_proposals/OVE_ARCH055-alias-write-collection.md", "tasks/OVE_SETUP002/TASK.md", "tasks/OVE_SETUP004/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9, 18]
---

# OVE_ARCH055: Collect TypeScript alias writes independently of capability decisions

## 1. Summary

Extract the pure AST alias-write collection seam for OVE_ARCH021's first use.
Return exact symbol/node facts and shared key semantics, without deciding violations.

## 2. Context

Review-driven repairs grew the parent beyond the approximate change-size budget.
This finite child preserves its complete contract; registration is not implementation.

## 3. Scope (in)

Only aliasWritesOf, its associated readonly types/shared helpers and independent tests.
Transfer only the approved collector allocation; OVE_ARCH021 integrates the consumer.

## 4. Out of scope

Capability paths, shadow admission, fixed points and final acceptance: OVE_ARCH021.
Import/comment decisions: OVE_ARCH054. Final boundary proving: OVE_ARCH002.
No product API, root exports, matrix, dependency, policy, configuration or permission change.

## 5. Detailed requirements

1. MUST export aliasWritesOf(source: ts.SourceFile, checker: ts.TypeChecker): AliasWrites.
   AliasSelection has readonly object: ts.Node and segments: readonly string[].
2. MUST expose AliasWrites with readonly writes: ReadonlyMap<ts.Symbol, readonly ts.Expression[]>;
   selections: ReadonlyMap<ts.Symbol, readonly AliasSelection[]>; propertyWrites:
   ReadonlyMap<ts.Symbol, ReadonlyMap<string, readonly AliasSelection[]>>; bindings:
   ReadonlySet<ts.Symbol>; assignmentTargets: ReadonlySet<ts.Identifier>.
3. MUST return shared symbolOf(Identifier): ts.Symbol|undefined, key(Node): string and
   elementKey(Expression): string functions as readonly fields on AliasWrites.
   Preserve their existing distinct named/computed and shorthand/default semantics once.
4. MUST collect variable/parameter initializers, binding symbols, identifier/member writes,
   nested object/array assignment selections, defaults, rest and omitted elements.
   Preserve actual AST/Symbol identities and segment order; fresh facts per invocation.
5. MUST move collect/collectSelection/addWrite/addMemberWrite and their maps/helpers only.
   No forbiddenNames, capability patterns, resolution, lexical-shadow decisions or visitor framework.
6. MUST use the existing pinned TypeScript and real virtual TypeChecker in own tests.
   Never execute scanned source, emit fixtures, perform I/O or import ESLint rules.
7. MUST keep every original parent/054 test body, fixture, offset, checker and budget intact.
   Child tests prove collection directly; do not duplicate the 86 preserved test bodies.

## 6. Design notes

N/A, functionality only. Exact types and allocation are recorded in the finite proposal.

## 7. Reuse

Existing TypeScript and Vitest only. The parent reuses returned symbol/key helpers;
no copied semantics, second policy, new dependency or generalized callback machinery.

## 8. Architecture and code placement

Same-project Tools module with one factory and associated types. Product packages never import Tools.
Parent021 retains forbiddenGlobalsOf, path evaluation, fixed point and three-helper acceptance.

## 9. Security and safety

Source is data; collect syntax without executing modules or granting permission.
No source secrets in diagnostics. Preserve normal gates and all existing input boundaries.

## 10. Errors and edge cases

Test defaults, shorthand-name versus initializer symbols, computed keys, nested/member
assignment targets, arrays/rest/omissions and per-call isolation using actual checker identities.

## 11. Acceptance criteria

- [ ] Actual checker/node facts cover every required collection family and edge case.
- [ ] Shared key/symbol semantics occur once; source is not executed, emitted or read through I/O.
- [ ] Only owned paths change; all original parent/054 cases, assertions and budgets remain intact.
- [ ] Required checks, independent Standards/Spec reviews and exact-head hosted gates pass before merge.

## 12. Test plan

Run pnpm exec vitest run --project tools tools/boundaries/ts-alias-writes.test.ts.
Use actual RED/GREEN, full types/lint before full tests, security and normal lifecycle gates.
Parent021 reruns complete capability/import/comment preservation and acceptance after integration.

## 13. Parallelization notes

Register and claim normally on latest green DEVELOP; no overlap with parent-owned paths.
Parent021 waits for this child DONE/merge; no child author edits its source, tests or Task.

## 14. Open questions and assumptions

The approved collector escrow is the only transfer source; no oversized parent patch is replayed.
All criteria start unchecked; child completion supplies no parent or ARCH002 acceptance.
