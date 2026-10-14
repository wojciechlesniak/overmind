---
id: OVE_WFRT017
title: Add expression type-checking, validation rules and fuzz and injection tests
area: WFRT
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SEC004, OVE_WFRT004, OVE_WFRT010, OVE_WFRT012, OVE_WFRT016]
soft_depends_on: [OVE_WFRT005]
provides: ["lib:expression-typecheck", "lib:validation-rules-expressions", "lib:expression-fuzz"]
needs: ["lib:port-schema-compat", "lib:injection-corpus"]
owns: ["packages/domain/src/wfrt/expression/typecheck.ts", "packages/domain/src/wfrt/expression/sites.ts", "packages/domain/src/wfrt/validation/rules/expr.*.rule.ts", "packages/domain/src/wfrt/expression/__security__/**"]
reads: ["packages/domain/src/wfrt/expression/evaluator.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 19]
---

# OVE_WFRT017: Add expression static type-checking, validation rules and the fuzz and injection test suite

## 1. Summary

Type-check every expression in a definition against the schemas of the values it can see, at publish time, so that wrong field names or types are caught before a Run. Resolve bareword enum literals (`seniorReview = approved`). Provide the fuzz and injection test suite that proves the parser and evaluator are safe.

## 2. Context

Expressions are stored as strings in node configs and edge mappings. A node definition declares its expression sites (`NodeTypeDefinition.expressionSites(config)`, added to WFRT005) with the scope each sees and the expected result type. SPEC 7 requires conditions on structured data validated against JSON schemas; this task is what makes "validated against schema" true statically. The test suite covers the dedicated "fuzz and injection tests" requirement.

## 3. Scope (in)

Typechecker, enum-bareword resolution, site collection, validation rules `expr.*`, the `__security__` test suite (corpus, property/fuzz tests, architectural greps).

## 4. Out of scope

Parser/evaluator internals (WFRT015, WFRT016). Prompt injection into agents (SEC004). Runtime schema validation of agent output (WFRT019).

## 5. Detailed requirements

1. `typecheck(ast, scopeSchemas: Record<string, PortSchema>, expect): Result<TypedAst, TypeIssue[]>`. Types come from PortSchema: number/integer -> `number`, string, boolean, null, arrays with item type, objects with property map. Member access on a path absent from the schema is `expr.unknown_path` (error with the closest known property name suggestion, from a bounded Levenshtein over <= 50 properties). Operators typed as in WFRT016 requirement 4; comparing a nullable to a value is allowed; `in` operand types checked; function signatures from the function table (arity and arg types).
2. **Bareword enum literals.** An `Ident` that is not a scope root, appearing as an operand of `=`/`!=`/`in` whose other side has a string `enum` type containing that word, is rewritten to a string literal in the `TypedAst` (so `seniorReview = approved` works when `seniorReview` has `enum: ['approved','changes_requested']`). Anywhere else an unknown identifier is `expr.unknown_identifier`. The rewrite happens only in the checker; the evaluator rejects unknown identifiers (it never guesses).
3. `ExpressionSite = { path: string (JSON pointer), source: string, scope: Record<string, PortSchema>, expect: 'boolean' | 'any' | PortSchema }`; `collectSites(definition, registry)` returns sites from node definitions' `expressionSites` plus every edge `mapping` (scope: `input` = source output schema) and `groups` none. Missing `expressionSites` on a node type means it has none.
4. Validation rules (one file each, severity error): `expr.syntax` (parse errors with position), `expr.unknown_identifier`, `expr.unknown_path`, `expr.type_error`, `expr.not_boolean` (a condition site whose result is not boolean), `expr.too_complex` (limits), `expr.constant_condition` (warning: condition always true/false after constant folding, for example `true`), `expr.mapping_incompatible` (a mapping result not assignable to the target input property; ties into WFRT012's `effectiveSourceSchema`).
5. Constant folding is performed by the checker only for diagnostics, never by changing semantics.
6. **Fuzz and injection suite** (`__security__/`), tagged `[SPEC16.5]`, runs in CI on every PR touching `packages/domain/src/wfrt/expression` and nightly with 10x iterations:
   - `corpus/injection.json` of 150+ hostile strings: `constructor.constructor("return process")()`, `__proto__.polluted`, `this.constructor`, `eval("1")`, `Function("return 1")`, backtick templates, `${7*7}`, `<script>`, `'; DROP TABLE`, `\u0000`, zero-width space inside identifiers, fullwidth `＆＆`, RTL override, homoglyph `АND` (Cyrillic А), `1e999`, `9`.repeat(400), `((((` x 100000, 1 MB string, `a.b.c` x 5000, regex-bomb-looking text, path traversal text, SQL fragments, shell metacharacters.
   - Property tests (fast-check, dev dependency with justification in the PR): (a) for arbitrary strings the parser returns Ok or Err in < 50 ms and never throws; (b) for ASTs generated from the grammar, print -> parse round-trips; (c) for random typed scopes and random well-typed expressions, `typecheck` Ok implies `evaluate` never returns `expr.type_mismatch` or `missing_path` for scopes satisfying the schemas (soundness property); (d) evaluator step count is bounded by the declared budget for every generated input; (e) mutation of valid expressions (swap characters, insert corpus fragments) never throws.
   - Behavioural guarantees: no property named `polluted` appears on `Object.prototype` after any run; `globalThis` is Proxy-sealed during evaluation tests and no trap fires; data strings that look like expressions (`"1 = 1"`, `"true"`) stay inert strings when they are values in the scope (a test feeds an Agent-output field containing an expression and checks it is only compared, never parsed).
   - Architectural tests: grep the three packages (`domain/wfrt`, `workflow-runtime`, `application/wfrt`) for `eval(`, `new Function`, `Function(`, `vm.`, `import(`, `require(`, `setTimeout(` with string argument; any hit fails CI.
   - Resource test: 1 000 random expressions of maximum allowed size evaluate within a total 2 s CPU budget on CI.
7. The suite exposes `expectExpressionSafe(source)` helper reused by other tasks that accept expression strings (Gate, IF).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Parser/printer (WFRT015), evaluator (WFRT016), `isAssignable` and `describeSchema` (WFRT004), `injection-corpus` (SEC004) for shared strings, validation framework (WFRT010).

## 8. Architecture and code placement

`packages/domain/src/wfrt/expression/{typecheck,sites,fold}.ts`; rules `packages/domain/src/wfrt/validation/rules/expr.<name>.rule.ts`; tests in `__security__/`. Pure.

## 9. Security and safety

This task is the main verification of SPEC 16.5-adjacent safety: no data reaches an interpreter other than the whitelisted evaluator. The fuzz corpus is versioned; any new bypass found in production adds a corpus entry first (regression rule). Rule messages never echo hostile source beyond 20 chars.

## 10. Errors and edge cases

Expression referencing a field that is optional in the schema: allowed with type `T | missing`; runtime may yield `expr.missing_path` (documented warning `expr.optional_path`). A site in an unreachable node still gets checked. Unknown node type: its sites are skipped.

## 11. Acceptance criteria

- [ ] `testsPassed = 100% AND criticalVulnerabilities = 0 AND seniorReview = approved` type-checks against the spec evidence schema and the enum word resolves.
- [ ] Wrong field name gives `expr.unknown_path` with suggestion.
- [ ] Soundness property holds for 10 000 generated cases.
- [ ] All injection corpus entries are rejected or inert; no prototype pollution; no sealed-global trap fired.
- [ ] Architectural grep test is part of CI and fails when a forbidden call is added in a probe branch.

## 12. Test plan

As above, plus unit tests per rule. Commands: `pnpm vitest run packages/domain/src/wfrt/expression`, nightly `pnpm vitest run packages/domain/src/wfrt/expression/__security__ --config vitest.fuzz.config.ts` (config owned by SETUP004 extension; documented here).

## 13. Parallelization notes

Can start the corpus and parser/evaluator fuzzing while WFRT016 is in review. Node tasks (IF, Gate, End) declare `expressionSites`; they depend on this task only for the helper, not for typing.

## 14. Open questions and assumptions

- ASSUMPTION: `fast-check` (MIT) is acceptable as a dev dependency; justification block required (SETUP008).
- Needs a one-line change in WFRT005 (`expressionSites?` on `NodeTypeDefinition`); recorded there.

