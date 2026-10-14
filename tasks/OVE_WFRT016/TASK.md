---
id: OVE_WFRT016
title: Implement the safe expression evaluator with function whitelist and resource limits
area: WFRT
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_WFRT004, OVE_WFRT015]
soft_depends_on: [OVE_WFRT001]
provides: ["lib:expression-evaluator", "contract:ExpressionScope"]
needs: ["lib:result", "contract:AppError"]
owns: ["packages/domain/src/wfrt/expression/evaluator.ts", "packages/domain/src/wfrt/expression/functions/**", "packages/domain/src/wfrt/expression/value.ts", "packages/contracts/src/errors/wfrt-expression.errors.ts"]
reads: ["packages/domain/src/wfrt/expression/ast.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 15"]
adr_refs: [2, 19]
---

# OVE_WFRT016: Implement the safe expression evaluator with function whitelist and resource limits

## 1. Summary

A tree-walking interpreter over the AST of WFRT015. It evaluates only against a scope of validated structured values, uses a closed table of pure functions, enforces a step budget and returns typed errors instead of throwing.

## 2. Context

Conditions in IF, Quality Gate, edge mappings and End outputs are computed here, on agent outputs that were already validated against their `PortSchema` (WFRT004). The evaluator is the only place expressions run. It must be deterministic (replay, WFRT046) and total (always terminates, never crashes the engine).

## 3. Scope (in)

Evaluator, value model, operator semantics, function table, error taxonomy, limits, `ExpressionScope` construction from validated values.

## 4. Out of scope

Parsing (WFRT015), static typing (WFRT017), choosing scopes per node (node tasks).

## 5. Detailed requirements

1. **Entry point.** `evaluate(ast, scope: ExpressionScope, opts?: { maxSteps?: number }): Result<ExprValue, ExprEvalError>`. `ExprValue = number | string | boolean | null | ExprValue[] | { readonly [k: string]: ExprValue }` (JSON values only).
2. **Scope.** `ExpressionScope = { roots: Readonly<Record<string, ValidatedValue>> }` where `ValidatedValue` is a branded type obtainable only from `validateValue(schema, raw)` (WFRT004) or from engine-created constants (`run.iteration`). Evaluator deep-freezes and structurally clones roots into null-prototype objects on entry (`toSafeValue`), rejecting non-JSON values. Root names are declared by the use site: IF/mapping: `input`, `run` (`iteration`, `number`, `mode`, `elapsedMs`), `loop` (`iteration`, `limit`, `feedback`); Gate: the evidence names; End output: `input`, `nodes` (named outputs, WFRT018).
3. **Path access.** `Member`/`Index` use own-property checks only (`Object.hasOwn`), keys `__proto__ constructor prototype` fail with `expr.forbidden_key`. Reading a missing property or an out-of-range index yields `expr.missing_path` (error, never `undefined`). Array indices must be integers within range; negative indices are errors. Strings are not indexable.
4. **Operators (strict, no coercion).** `and/or/not` require booleans (no truthiness) and short-circuit. `= !=`: both sides of the same primitive type, or either side `null`; arrays/objects compare by deep equality up to depth 8 and 1 000 nodes. `< <= > >=`: both numbers or both strings (code point order, never locale compare). `+`: number+number or string+string (result length <= 10 000); `- * /`: numbers; division by zero `expr.division_by_zero`; every numeric result must be finite and within +-1e15 (`expr.number_overflow`); `-x` numbers only. `in`: `x in array` (deep equality) or `string in string` (substring). Mismatches produce `expr.type_mismatch` with `{op, left: typeName, right: typeName}`.
5. **Function table** (`functions/<name>.ts` one file each, each declares `arity`, argument types, `returns`, `pure: true`): `len(string|array)`, `contains(string|array, any)`, `startsWith(string,string)`, `endsWith(string,string)`, `lower(string)`, `upper(string)`, `trim(string)`, `abs`, `floor`, `ceil`, `round(number[, digits 0..6])`, `min`/`max` (variadic numbers or one array), `sum(array<number>)`, `avg(array<number>)` (empty array error), `mod(number,number)`, `all(array<boolean>)`, `any(array<boolean>)`, `pluck(array<object>, string)` (field of each; missing field error), `coalesce(a, b, ...)` (first non-null), `isNull(any)`, `num(string)` (strict decimal parse, error on failure), `str(number|boolean)`. Unknown function: `expr.unknown_function`. No function takes or returns a function, has side effects, reads the clock, randomness or environment.
6. **Resource limits.** Step budget default 10 000 (each AST node visit and each element visited by an array function counts one), result size <= 64 KiB serialised, intermediate string/array <= limits of WFRT001 §9; exceed -> `expr.step_budget_exceeded` / `expr.result_too_large`. The evaluator is iterative over the AST depth budget (<= 20) so no stack concerns; no recursion on data.
7. **Errors** (`ExprEvalError` with `code`, `pos`, params; registered via `defineErrors('wfrt', ...)` file `wfrt-expression.errors.ts`): `expr.type_mismatch, expr.missing_path, expr.forbidden_key, expr.division_by_zero, expr.number_overflow, expr.unknown_function, expr.arity, expr.step_budget_exceeded, expr.result_too_large, expr.invalid_scope`. Error params never include values from the scope (only type names and positions) because values may be sensitive agent output.
8. `evaluateBoolean(ast, scope)` convenience returning `Result<boolean>` and `expr.not_boolean` otherwise.
9. **Determinism:** same AST + same scope gives identical result and identical step count on every run and platform; no `Date`, `Math.random`, locale APIs, `toFixed`-style host formatting (rounding implemented explicitly with decimal-safe algorithm: round half away from zero on a scaled integer, documented).
10. Evaluator metadata for the trace: `evaluateWithTrace` returns the sub-results of top-level `and/or` operands (booleans only, names from printed AST) so the Gate report can list which sub-condition failed without re-evaluating.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

AST and printer (WFRT015); `validateValue` and brand (WFRT004). No other module evaluates expressions.

## 8. Architecture and code placement

`packages/domain/src/wfrt/expression/{evaluator,value,scope}.ts` and `functions/*.ts` with a generated or explicit table module `functions/index.ts` that is owned here (adding a function = new file + one line in this task's index; documented as the single extension point).

## 9. Security and safety

No access to `globalThis`, `process`, modules, prototypes or host functions: values are plain JSON; functions are an own table, not `scope[name]`. The scope object is created with `Object.create(null)`; the evaluator never uses `in`/`[]` on user-supplied keys against objects with prototypes. A guard test runs the evaluator inside a Proxy-sealed global environment to prove nothing global is touched. Error messages carry no data values. Untrusted strings only participate as operands; no function interprets strings as code, paths or regex (no `matches`, no `replace`).

## 10. Errors and edge cases

`null = null` true; `null < 1` type mismatch; `[] = []` true; `0.1 + 0.2 = 0.3` false (documented, exact double semantics); `len(null)` mismatch; `x in []` false; deep structures beyond limits error. `round(2.5)` is 3; `round(-2.5)` is -3.

## 11. Acceptance criteria

- [ ] Operator and function tables fully covered by example tests (positive and negative).
- [ ] Prototype keys and missing paths fail with the specified codes.
- [ ] Step budget stops a crafted expression (nested `sum` over a 1 000 element array inside arithmetic) with the specified error.
- [ ] Results are deterministic across two runs and across Node versions in CI matrix.
- [ ] Scope cloning prevents mutation of caller data (test freezes and compares).

## 12. Test plan

Unit tests per operator/function (`functions/*.test.ts`), table tests, determinism test, sealed-global proxy test, grep test (no `eval`, `new Function`, `RegExp(`, `import(`, `require(` in `packages/domain/src/wfrt/expression/`). Fuzzing is WFRT017. Command `pnpm vitest run packages/domain/src/wfrt/expression`.

## 13. Parallelization notes

Parallel with WFRT017 once `ast.ts` exists. New functions are one-file PRs.

## 14. Open questions and assumptions

- ASSUMPTION: numbers are IEEE doubles within +-1e15; money/precision-sensitive evaluation is out of scope.
- ASSUMPTION: no date/time functions in MVP (they would need the Clock port and complicate replay).

