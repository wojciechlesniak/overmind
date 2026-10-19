---
id: OVE_WFRT059
title: "Implement canonical printing of bounded expression ASTs"
area: WFRT
kind: security
size: S
priority: P0
mvp: true
status: in_review
depends_on: ["OVE_WFRT058"]
soft_depends_on: []
provides: ["lib:expression-printer-prerequisite"]
needs: ["contract:expression-syntax-prerequisite"]
owns: ["packages/domain/src/wfrt/expression/print.ts", "packages/domain/src/wfrt/expression/print.test.ts"]
reads: ["tasks/OVE_WFRT015/TASK.md", "tasks/OVE_WFRT058/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 19]
---

# OVE_WFRT059: Implement canonical printing of bounded expression ASTs

## 1. Summary

Implement the single canonical printer for the already registered readonly expression AST.

## 2. Context

This is the printer prerequisite in the measured WFRT015 split, not end-to-end grammar acceptance.
The Owner-approved canonical admission cap remains unchanged and is enforced by WFRT060.

## 3. Scope (in)

Only `printExpression(ast: ExpressionAst): string` and its own public behavior tests.

## 4. Out of scope

No parser, lexer change, evaluator, runtime whitelist, downstream completion or parent acceptance.

## 5. Detailed requirements

1. Print every original AST variant using the shared spelling/precedence metadata. Use uppercase AND/OR/NOT/IN, single operator spaces, canonical equality and preserved percent kinds/scale.
2. Preserve semantic tree grouping, including right operands of left-associative operators, non-associative comparison children, NOT precedence and member/index/global-call placement. Never emit method-call syntax.
3. Print numbers in the admitted decimal syntax without exponent notation, including 0.0000001. Strings use only admitted escapes. Controls such as U+0008/U+000C/U+000D use Unicode escapes; do not corrupt escaped-backslash-plus-letter data or Unicode/astral/lone-surrogate data.
4. Source positions do not affect text. Printing is deterministic and pure for grammar-conforming JSON-serialisable ASTs within the original bounds. Do not truncate output or silently discard a node.
5. Do not implement the canonical admission cap by truncating or rejecting printable text here: WFRT060 must compute full canonical text and reject excessive length at the parser boundary. No raw/resource limit is raised.

## 6. Design notes

Use one small printer. Avoid a second lexer/parser or a speculative evaluator interface.

## 7. Reuse

Reuse WFRT058 AST/operator metadata. Add no dependency or alternate syntax policy.

## 8. Architecture and code placement

Only the two owns paths in pure Domain. No I/O or consumer imports.

## 9. Security and safety

AST data is not executable source. Never eval or dynamically import printed text. Preserve all original bounds.

## 10. Errors and edge cases

Cover every node kind, nested comparisons/right operands, unary/index/member combinations, literal escapes,
small decimal values and position-independent canonical idempotence on golden AST fixtures.

## 11. Acceptance criteria

- [x] Actual public printer tests cover every AST variant, spelling/precedence and semantic grouping.
- [x] Decimal/percent and all admitted string/control/Unicode cases print without unsupported syntax or data loss.
- [x] Text is deterministic and independent of positions, with no truncation or added evaluator behavior.
- [x] Normal native/security/review/hosted/integration gates pass; parser roundtrip and parent acceptance remain explicitly pending.

## 12. Test plan

Use explicit grammar-conforming bounded AST fixtures and canonical golden strings. Do not duplicate a parser.
Run normal typecheck/lint/test, applicable security checks and fresh exact-head hosted gates.
WFRT060 and the parent retain real parse/print semantic roundtrip and canonical admission proofs.

## 13. Parallelization notes

Claim from latest DEVELOP only after WFRT058 merges. WFRT060 waits for this printer; owns are disjoint.

## 14. Open questions and assumptions

The API consumes the existing bounded JSON-serialisable AST contract; it is not an untrusted-object validator.

### Verified implementation (2026-10-19)

The public printer passed 75 cases; types/lint and 984 covered tests passed.
Latest-DEVELOP publication hooks passed 1004 tests; security7 and source CI passed.
Both independent whole-source and completed-publication reviews passed.
Evidence, retained failures and remaining final gates: PR #1011.
