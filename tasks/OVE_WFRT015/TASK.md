---
id: OVE_WFRT015
title: Specify the safe expression grammar and implement the lexer and parser
area: WFRT
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003]
soft_depends_on: [OVE_WFRT001]
provides: ["lib:expression-parser", "contract:ExpressionAst", "doc:expression-grammar"]
needs: ["lib:result", "contract:AppError"]
owns: ["packages/domain/src/wfrt/expression/lexer.ts", "packages/domain/src/wfrt/expression/parser.ts", "packages/domain/src/wfrt/expression/ast.ts", "packages/domain/src/wfrt/expression/limits.ts", "docs/architecture/workflow-expressions.md"]
reads: []
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

Grammar document, lexer, parser, AST types, structural limits, error codes with positions, pretty-printer for canonical form.

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
4. **Limits (from `limits.ts`, WFRT001 §9):** source length <= 1 000 chars, AST nodes <= 200, nesting depth <= 20, call arguments <= 8, array literal items <= 50. Exceeding yields `expr.too_complex` with the limit name, found at parse time and enforced iteratively where possible (the parser itself is recursive but guarded by the depth counter before recursion).
5. `parseExpression(source: string): Result<ExpressionAst, ExprSyntaxError[]>` returns at most 5 errors (first error wins for recovery; no error recovery beyond the first in MVP, list has one entry) with `{code, pos, expected?: string[]}`. Messages are keys + params, never echo more than 20 chars of source.
6. `printExpression(ast): string` returns canonical text (single spaces, uppercase `AND OR NOT IN`, `=` for equality, `%` literals preserved); used for hashing (`conditionHash`) and shown in the editor. `parse(print(parse(x)))` equals `parse(x)` (round-trip property).
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

- [ ] The three spec example conditions and 20 further examples parse and print canonically.
- [ ] Every illegal character class in requirement 1 yields `expr.illegal_character`.
- [ ] Limits enforced with the specified error codes; 1e6 parentheses terminates quickly with an error (no stack overflow).
- [ ] Round-trip property holds for generated ASTs.
- [ ] Forbidden identifiers rejected in all positions.

## 12. Test plan

Unit tests per token class, table of valid/invalid sources (60+ rows), property tests (print/parse round trip) with a seeded generator, resource tests (time and memory ceilings). Command `pnpm vitest run packages/domain/src/wfrt/expression`.

## 13. Parallelization notes

Independent leaf; WFRT016 and WFRT017 start from the AST types (merge `ast.ts` first as a tiny PR if needed).

## 14. Open questions and assumptions

- ASSUMPTION: `100%` means the number 100 (scale 0-100) because evidence such as `testsPassed` is stored as a percentage; documented in WFRT026.
- ASSUMPTION: no modulo operator (the `%` sign is only a percent literal); `mod(a,b)` is a function (WFRT016).

