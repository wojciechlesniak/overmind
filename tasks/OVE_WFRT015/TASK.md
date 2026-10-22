---
id: OVE_WFRT015
title: Specify the safe expression grammar and implement the lexer and parser
area: WFRT
kind: security
size: M
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_ARCH003, OVE_WFRT060]
soft_depends_on: [OVE_WFRT001]
provides: ["lib:expression-parser", "contract:ExpressionAst", "doc:expression-grammar"]
needs: ["lib:result", "contract:AppError", "lib:expression-parser-prerequisite", "doc:expression-grammar-prerequisite"]
owns: []
reads: ["tasks/OVE_WFRT058/TASK.md", "tasks/OVE_WFRT059/TASK.md", "tasks/OVE_WFRT060/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 19]
---

# OVE_WFRT015: Specify the safe expression grammar and implement the lexer and parser

## 1. Summary

The expression language used by IF conditions, Quality Gate conditions, edge mappings and End outputs, defined as a small formal grammar with a hand-written lexer and recursive-descent parser. It produces a bounded AST; it never produces or runs JavaScript.

## 2. Context

SPEC 7: "Expressions are computed by a safe evaluator, never `eval`". CONVENTIONS section 7 forbids `eval` and `new Function` on data. The spec example `testsPassed = 100% AND criticalVulnerabilities = 0 AND seniorReview = approved` must parse as written. Expressions are authored by the Owner or Chief (trusted-but-fallible text, stored in a Workflow Version); values come from agent output (untrusted data). Data is never parsed as an expression.

## 3. Scope (in)

Final end-to-end acceptance of the complete merged grammar, lexer, parser, AST, limits, errors, printer and documentation. OVE_WFRT058 owns tokens/AST/limits, OVE_WFRT059 the printer, and OVE_WFRT060 the parser/tests/documentation. This task changes only its own final acceptance/evidence/status; it owns no implementation path. Every original requirement and all five criteria below remain mandatory.

## 4. Out of scope

Evaluation (WFRT016), typing and enum barewords (WFRT017), UI editing.

## 5. Detailed requirements

1. **Lexical grammar.** Whitespace: space, tab, newline. Comments: none. Tokens: `NUMBER` (`[0-9]+(\.[0-9]+)?`, no exponent, no leading `+`, max 15 significant digits), `PERCENT` (a NUMBER immediately followed by `%`; value is the number itself, so `100%` equals `100`, documented), `STRING` (single or double quoted, escapes `\\ \' \" \n \t \uXXXX`, max 1 000 chars, no raw newline), `IDENT` (`[A-Za-z_][A-Za-z0-9_]*`, max 64), punctuation `( ) [ ] , .`, operators `= == != <> < <= > >= + - * / && || !`, keywords (exact case, lower or upper only): `and AND or OR not NOT in IN true false null` (mixed case like `And` is an `IDENT`). Anything else (including backtick, `$`, `{`, `}`, `;`, `@`, `#`, `\`, `?`, `:`, `~`, `^`, `&`, `|` alone, non-ASCII characters outside string literals) is a lexical error `expr.illegal_character` with the position. Fullwidth and homoglyph operators are NOT normalised; they are illegal characters (explicit security decision).
2. **Syntax (EBNF, precedence low to high).**
   ```
   expr    = or ;
   or      = and { ("or"|"OR"|"||") and } ;
   and     = not { ("and"|"AND"|"&&") not } ;
   not     = ("not"|"NOT"|"!") not | cmp ;
   cmp     = add [ ("="|"=="|"!="|"<>"|"<"|"<="|">"|">="|"in"|"IN") add ] ;   (* non-associative *)
   add     = mul { ("+"|"-") mul } ;
   mul     = unary { ("*"|"/") unary } ;
   unary   = "-" unary | postfix ;
   postfix = primary { "." IDENT | "[" expr "]" } ;
   primary = NUMBER | PERCENT | STRING | "true" | "false" | "null"
           | IDENT [ "(" [ expr { "," expr } ] ")" ]
           | "(" expr ")" | "[" [ expr { "," expr } ] "]" ;
   ```
   `=` and `==` are the same equality operator; `<>` equals `!=`. Chained comparisons (`a < b < c`) are a syntax error. No assignment, no ternary, no lambdas, no object literals, no regex, no string templates, no function definitions, no method calls on values (`a.b(c)` is a syntax error; only global whitelisted functions `name(args)`).
3. **AST** (readonly, JSON-serialisable): `Literal {kind:'num'|'str'|'bool'|'null'|'pct', value}`, `Ident {name}`, `Member {object, property}`, `Index {object, index}`, `Call {name, args}`, `Unary {op:'-'|'not'}`, `Binary {op, left, right}` (`and|or|eq|ne|lt|le|gt|ge|in|add|sub|mul|div`), `ArrayLit {items}`; every node has `pos: {start, end}`. Parser output is frozen.
4. **Limits (from `limits.ts`, WFRT001 §9):** source length <= 1 000 chars, AST nodes <= 200, nesting depth <= 20, call arguments <= 8, array literal items <= 50. Exceeding yields `expr.too_complex` with the limit name, found at parse time and enforced iteratively where possible (the parser itself is recursive but guarded by the depth counter before recursion). After syntax and all existing bounds pass, admission also requires canonical text from `printExpression` to contain at most 1 000 characters. Exceeding this additional `canonicalSourceLength` bound returns `expr.too_complex` with `limit: "canonicalSourceLength"` and the whole original source span. Preserve every original bound, check raw length before lexing, guard descent, and also bound produced AST depth, including left-associated binary and postfix chains.
5. `parseExpression(source: string): Result<ExpressionAst, ExprSyntaxError[]>` returns at most 5 errors (first error wins for recovery; no error recovery beyond the first in MVP, list has one entry) with `{code, pos, expected?: string[], limit?: string}`. Messages are keys + params, never echo more than 20 chars of source.
6. `printExpression(ast): string` returns canonical text (single spaces, uppercase `AND OR NOT IN`, `=` for equality, `%` literals preserved); used for hashing (`conditionHash`) and shown in the editor. For every accepted AST, parsing its canonical text succeeds and preserves every semantic AST field. Source `pos` fields describe each particular input and are excluded from semantic equality; exact positions are tested separately. The canonical admission bound guarantees that accepted ASTs print within the unchanged source limit.
7. Reserved: identifiers `__proto__`, `constructor`, `prototype`, `this`, `eval`, `Function` are rejected by the parser with `expr.forbidden_identifier` anywhere (as IDENT, member name or call name).
8. Documentation `docs/architecture/workflow-expressions.md`: grammar, precedence table, examples (the three Gate examples from the spec, IF examples `input.score >= 7 AND len(input.issues) = 0`), what is deliberately missing and why, and the rule "no other module may add syntax; extend via WFRT016 function table only".

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Result` (ARCH003). The AST is consumed by WFRT016 (evaluation) and WFRT017 (typing); there must be exactly one parser (DRY).

## 8. Architecture and code placement

`packages/domain/src/wfrt/expression/{lexer,parser,ast,limits,print}.ts`. Pure TypeScript, no regex with nested quantifiers (hand-written scanning), no dependencies, no `eval`, `Function`, `RegExp` constructor from data.

## 9. Security and safety

The grammar's smallness is the security property. Hostile source (injection attempts like `constructor.constructor("return process")()`, backticks, `${}`, unicode confusables, zero-width characters, right-to-left overrides, 10 MB strings, 1e6 nested parentheses) must produce a bounded error in bounded time. Source length is checked before lexing. Positions are reported so the editor can underline; no source text is logged at info level.

## 10. Errors and edge cases

`100 %` with a space is a NUMBER followed by illegal `%`: error. `1.` and `.5` are errors. `a.b.c[0].d` parses. `not not true` parses. `x in [1,2,3]` and `"a" in "abc"` parse (typing in WFRT017). Empty expression: `expr.empty`. Unterminated string: `expr.unterminated_string`. Trailing tokens: `expr.unexpected_token`.

## 11. Acceptance criteria

- [x] The three spec example conditions and 20 further examples parse and print canonically.
- [x] Every illegal character class in requirement 1 yields `expr.illegal_character`.
- [x] Limits enforced with the specified error codes; 1e6 parentheses terminates quickly with an error (no stack overflow).
- [x] Round-trip semantic equality and canonical-print idempotence hold for accepted ASTs, with positions tested separately. The actual 988-character/29-node/depth-15 counterexample is rejected with `expr.too_complex`, `limit: "canonicalSourceLength"` and span 0..988 because canonical length is 1 030. Cover canonical length 1 000 acceptance and 1 001 rejection without changing any original bound.
- [x] Forbidden identifiers rejected in all positions.

## 12. Test plan

Unit tests per token class, table of valid/invalid sources (60+ rows), property tests (print/parse round trip) with a seeded generator, resource tests (time and memory ceilings). Command `pnpm vitest run packages/domain/src/wfrt/expression`.

## 13. Parallelization notes

The exact sequence is ARCH003 -> WFRT058 -> WFRT059 -> WFRT060 -> this final acceptance. Original downstream consumers remain dependency-blocked until WFRT015 really passes all five criteria and final gates. Never publish a partial prerequisite as parent completion or edit a child-owned implementation from this task.

## 14. Open questions and assumptions

- ASSUMPTION: `100%` means the number 100 (scale 0-100) because evidence such as `testsPassed` is stored as a percentage; documented in WFRT026.
- ASSUMPTION: no modulo operator (the `%` sign is only a percent literal); `mod(a,b)` is a function (WFRT016).


## Verification status (2026-10-21)

The final parent acceptance checked the merged WFRT058/059/060 implementation on
DEVELOP 5737019 without changing child source or tests. All 350 expression cases
and full configured coverage of 1326 tests in 118 files passed after full format,
types and lint. The unchanged 400-case seeded property test and exact raw/AST/
canonical bounds passed, including canonical 1000/1001 and the 988-to-1030 case.

A separate public-API probe passed the three actual Gate clauses, combined Gate,
IF example and 24 further canonical examples, with semantic roundtrip/frozen-AST
checks, 56 illegal classes and 18 reserved-name positions. A bounded resource
probe made 1000 API calls in 74 ms with a 64 MiB heap cap and measured peak RSS
100576 KiB, below its fixed 192 MiB ceiling; an external 15-second limit and
2-second API-batch ceiling remained enforced. Million-parenthesis and 10 MiB
inputs denied before scanning. These are parser acceptance proofs, not product
penetration or evaluator permission.

Dependency/license policies, both audits, history/tree secret scans, SBOM and
workspace build passed. Secret scans retained zero findings and one Keychain
warning each. The architecture orchestrator retained warnings for unimplemented
foundation checks; no real boundary/task-ownership PASS is inferred. No standalone
expression integration suite exists; the real parser suites exercise the merged
lexer/printer, while unrelated packaging failures remain recorded separately.

The original head and all nine WIP files remain byte/mode-identical in verified
ZIP and Git stash escrow; no obsolete child implementation was reapplied. Missing
19-October temporary receipts remain unavailable historical references. Independent
whole reviews, fresh exact-head hosted checks and normal final task lifecycle
remain required before completion or DEVELOP integration. Downstream tasks remain
blocked until that completion.
