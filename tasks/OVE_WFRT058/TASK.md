---
id: OVE_WFRT058
title: "Implement bounded expression tokens and syntax contracts"
area: WFRT
kind: security
size: S
priority: P0
mvp: true
status: in_progress
depends_on: ["OVE_ARCH003"]
soft_depends_on: []
provides: ["lib:expression-lexer-prerequisite", "contract:expression-syntax-prerequisite"]
needs: ["lib:result", "contract:AppError"]
owns: ["packages/domain/src/wfrt/expression/ast.ts", "packages/domain/src/wfrt/expression/limits.ts", "packages/domain/src/wfrt/expression/lexer.ts", "packages/domain/src/wfrt/expression/lexer.test.ts"]
reads: ["tasks/OVE_WFRT015/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 19]
---

# OVE_WFRT058: Implement bounded expression tokens and syntax contracts

## 1. Summary

Implement the immutable syntax contract, resource constants and context-free lexer required by WFRT015.

## 2. Context

The measured WFRT015 candidate exceeded the non-test size guideline before full grammar acceptance.
This child supplies a prerequisite; WFRT015 retains all five final criteria and original public providers.

## 3. Scope (in)

Only AST/token types, shared syntax metadata, exact resource constants, lexical scanning and own tests.

## 4. Out of scope

No parser, printer, evaluator, callable table, downstream completion or parent acceptance.

## 5. Detailed requirements

1. Keep every readonly JSON-serialisable AST variant and position from WFRT015 requirement 3. Define operator spelling/precedence once for the parser and printer; add no syntax.
2. Export `lex(source: string): Result<readonly Token[], ExprSyntaxError[]>`. Tokens carry discriminated kind/value and exact UTF-16 start/end offsets. No source execution, logging or input interpolation in errors.
3. Scan exactly WFRT015 requirement 1: ASCII identifiers, exact keyword cases, decimal/adjacent percent, specified quoted strings/escapes, punctuation and longest-match operators. Preserve percent kind and scale. Whitespace is only space/tab/newline; reject every other character class with `expr.illegal_character`.
4. Preserve raw/canonical source 1000, AST nodes 200, depth 20, arguments 8 and items 50, plus lexical identifier 64, number 15 significant digits and string 1000. Check raw length before scanning; constants are one frozen shared policy, not a new permission or bound.
5. Return one fixed positioned error for lexical failure, including `expr.unterminated_string`; named lexical complexity failures use `expr.too_complex` with the bound name. Do not echo source. Stop at the first error.
6. Tokenisation is context-free: operator/identifier sequences are not successful expression admission. WFRT060 owns grammar rejection, forbidden names and structural/canonical AST admission.

## 6. Design notes

Use a hand-written bounded scanner. No nested-quantifier regex or duplicate parser in tests.

## 7. Reuse

Use ARCH003 Result/ok/err and the exact accepted WFRT015 contract; add no dependency.

## 8. Architecture and code placement

Only the four owns paths. Domain remains pure; AST metadata must not import infrastructure or a consumer.

## 9. Security and safety

No eval, Function construction, source imports, I/O or evaluator. Preserve all original bounds and safe errors.

## 10. Errors and edge cases

Cover escaped controls, literal backslashes, Unicode/astral/lone-surrogate string data, raw newlines,
percent adjacency, significant leading zeros, exact keyword case and original source positions.

## 11. Acceptance criteria

- [ ] All specified token classes and exact aliases/cases have actual positive/negative public lexer tests.
- [ ] Raw 1000/1001 and lexical boundaries deny correctly before unsafe or excessive work; all constants match the parent contract.
- [ ] AST/token metadata is readonly and reusable; Result errors are fixed, positioned and bounded to one entry.
- [ ] Normal native/security checks, independent whole reviews and exact hosted/integration gates pass; no parser/parent acceptance is claimed.

## 12. Test plan

Actual public lexer tables, exact positions and denied/malformed/resource boundaries; no implementation mocks.
Run normal typecheck/lint/test, applicable security checks and fresh exact-head hosted gates.

## 13. Parallelization notes

Claim only after this ownership transfer is integrated. WFRT059 waits for this child; never edit its printer.

## 14. Open questions and assumptions

The approved canonical-length rule remains admission in WFRT060. This lexer does not claim full expression validity.
