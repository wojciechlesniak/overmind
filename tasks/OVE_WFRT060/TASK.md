---
id: OVE_WFRT060
title: "Implement guarded expression grammar and canonical admission"
area: WFRT
kind: security
size: S
priority: P0
mvp: true
status: in_progress
depends_on: ["OVE_WFRT058", "OVE_WFRT059"]
soft_depends_on: []
provides: ["lib:expression-parser-prerequisite", "doc:expression-grammar-prerequisite"]
needs: ["lib:result", "lib:expression-lexer-prerequisite", "contract:expression-syntax-prerequisite", "lib:expression-printer-prerequisite"]
owns: ["packages/domain/src/wfrt/expression/parser.ts", "packages/domain/src/wfrt/expression/parser.test.ts", "docs/architecture/workflow-expressions.md"]
reads: ["tasks/OVE_WFRT015/TASK.md", "tasks/OVE_WFRT058/TASK.md", "tasks/OVE_WFRT059/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 19]
---

# OVE_WFRT060: Implement guarded expression grammar and canonical admission

## 1. Summary

Implement the complete guarded recursive-descent grammar and admission required by WFRT015.

## 2. Context

This final implementation child follows the lexer/AST and printer prerequisites. WFRT015 keeps its original
five final criteria/providers and independently accepts the combined merged result; no partial helper closes it.

## 3. Scope (in)

Public parser, full grammar/security/property/resource tests and the original grammar documentation.

## 4. Out of scope

No lexer/printer ownership, new syntax, evaluation, callable table, UI or downstream completion.

## 5. Detailed requirements

1. Implement the exact WFRT015 EBNF and `parseExpression(source: string): Result<ExpressionAst, ExprSyntaxError[]>`. Preserve every original operator/precedence, global-call-only syntax and non-associative comparison. No method calls, assignment, exponent literals or other excluded syntax.
2. Reuse WFRT058 tokens/AST/limits and WFRT059 printer. Check raw source before scanning, guard recursion before descent and iteratively enforce produced AST depth, including left-associated binary/postfix chains. Preserve nodes 200, depth 20, arguments 8 and items 50; freeze every output node/position/child array.
3. Enforce the exact Owner-approved canonicalSourceLength 1000 admission cap after syntax and every original bound. Exceeding returns `expr.too_complex`, `limit: "canonicalSourceLength"` and the whole original span; no cap increase or silent property-fixture filtering.
4. Preserve one safe positioned MVP error with optional limit name; empty, unterminated, unexpected and illegal input have their specified codes. Deny every reserved identifier from WFRT015 requirement 7 in every identifier/member/call position.
5. Prove semantic parse/print/reparse equality and print idempotence for accepted ASTs with a fixed-seed generator, excluding only position fields from semantic comparison. Test positions separately. Preserve the actual 988/1030 counterexample and exact canonical 1000/1001 boundaries.
6. Document the exact EBNF, precedence, actual specification Gate condition/clauses, the required IF example, deliberate omissions and the rule that only WFRT016's function table may extend callable names, never syntax. Document percent scale and the approved bound.

## 6. Design notes

Use a small guarded parser; never generate JavaScript or execute source. Do not copy a second parser into tests.

## 7. Reuse

One parser and the two merged prerequisite APIs. No new dependency, policy or runtime function whitelist.

## 8. Architecture and code placement

Only the three owns paths. Pure Domain; documentation remains English. The parent is final acceptance only.

## 9. Security and safety

Deny malformed/unavailable checks, source execution, forbidden names, Unicode confusables outside strings,
and excessive resources. Keep fixed diagnostics and every original raw/AST/argument/item bound.

## 10. Errors and edge cases

Cover original edge cases, mixed-case identifiers, operator aliases, escaped controls/backslashes/Unicode,
chained comparisons/method calls, all reserved positions and exact nodes/depth/argument/item boundaries.

## 11. Acceptance criteria

- [x] The exact original grammar and examples parse with frozen positioned ASTs; all unsupported syntax and reserved positions deny.
- [x] All original resource boundaries and approved canonical 1000/1001 plus actual 988/1030 counterexample have real public parser proof; million-parenthesis/10MB sources deny quickly without overflow.
- [x] Actual 60+ valid/invalid rows, seeded accepted-AST semantic roundtrip/idempotence and separate exact-position tests pass without silent discards.
- [x] Grammar documentation and all normal native/security/independent whole review/exact hosted/integration gates pass; parent five final criteria remain for WFRT015 acceptance.

## 12. Test plan

Meaningful public RED/GREEN slices, complete original valid/invalid/resource/position tables and seeded properties.
Run normal typecheck/lint/test, applicable security checks and fresh exact-head hosted gates; retain all failures.

## 13. Parallelization notes

Claim only after both prerequisites merge; never edit their owns. WFRT015 then accepts the complete merged API.

## 14. Open questions and assumptions

There is no acceptance waiver: all original WFRT015 requirements and exact approved canonical contract remain.

### Verified implementation (2026-10-19)

The parser passed 166 cases; types/lint and 1170 covered tests passed.
Latest-DEVELOP source hooks passed 1170 tests; security7 and strict source CI passed.
Both independent whole-source and completed-publication reviews passed.
Evidence, original depth Spec finding/regression and remaining final gates: PR #1016.
