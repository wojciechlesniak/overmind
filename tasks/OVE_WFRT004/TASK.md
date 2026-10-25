---
id: OVE_WFRT004
title: Implement the PortSchema subset and the dependency-free value validator
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_ARCH003]
soft_depends_on: [OVE_WFRT001]
provides: ["contract:PortSchema", "lib:port-schema-validator", "lib:port-schema-compat"]
needs: ["lib:result", "contract:AppError"]
owns: ["packages/contracts/src/workflow/port-schema/**", "packages/domain/src/wfrt/port-schema/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 15"]
adr_refs: [2, 19]
---

# OVE_WFRT004: Implement the PortSchema subset and the dependency-free value validator

## 1. Summary

Typed ports need contracts: a small, safe subset of JSON Schema (`PortSchema`) used for node inputs/outputs, Agent structured output and expression typing, plus (a) a validator that checks a JSON value against it and (b) an assignability check between two schemas. Implemented in-house, because the common validator generates code with `new Function`, which our rules forbid.

## 2. Context

SPEC 7: "Conditions operate on structured data (Agent output per JSON schema), not free text". An Agent's output is untrusted (SEC004 R4): it must be parsed and validated before any decision depends on it. The static validator (WFRT012) needs "can port A feed port B" and the runtime needs "is this value valid".

## 3. Scope (in)

`PortSchema` zod definition, `validateValue`, `isAssignable(source, target)`, `describeSchema` (short human summary for error messages), JSON Schema export (so the contract pipeline and UI can show it).

## 4. Out of scope

Expression typing (WFRT017 uses `isAssignable` and the schema walker). Using schemas in nodes (their tasks). `$ref`, `oneOf`, `allOf`, `pattern`, `format` (excluded on purpose).

## 5. Detailed requirements

1. **Subset (`PortSchema`)**, strict recursive zod type: `type` one of `string|number|integer|boolean|null|object|array` or an array of those for nullable unions (max 2 entries, one must be `null`); `description?` (max 200); `enum?` (max 50 primitives); `const?`; number: `minimum?`, `maximum?`; string: `minLength?`, `maxLength?` (default max 10 000 applied when absent); object: `properties?` (max 50 keys, key `^[A-Za-z_][A-Za-z0-9_]{0,40}$`), `required?` (subset of properties), `additionalProperties?: false` (the only allowed value; default false); array: `items` (single schema), `minItems?`, `maxItems?` (default 1 000). Max nesting depth 8; max total schema nodes 500. Forbidden keywords produce `wfrt.schema_unsupported_keyword` listing the keyword.
2. `validateValue(schema, value, opts?: { maxDepth: 12 }): Result<void, SchemaViolation[]>` where `SchemaViolation = { path: string (JSON pointer), code: 'type'|'required'|'enum'|'const'|'range'|'length'|'items'|'unknown_property'|'depth', message }`; max 20 violations reported; messages contain no value content longer than 40 chars (values may be sensitive).
3. The validator accepts only JSON-compatible input (`null`, boolean, finite number, string, array, plain object with own enumerable string keys); anything else (`undefined`, functions, Date, NaN, Infinity, symbols, class instances, cyclic structures) is a violation `type`. Objects with keys `__proto__`, `constructor`, `prototype` are violations `unknown_property` even if the schema allowed them.
4. `isAssignable(source, target): boolean` — true when every value valid for `source` is valid for `target` (structural subtyping): numeric ranges contained, `integer` assignable to `number`, enum subset, object has all target-required properties with assignable types and no property the target forbids (since `additionalProperties` is false by default, extra source properties are NOT assignable unless the target lists them), array item assignability and length bounds containment, nullable handling. Documented table of cases with examples.
5. `describeSchema(schema): string` returns text like `object{goal: string<=200, scope: array<string>}` (max 120 chars) for validator messages.
6. `toJsonSchema(schema)` returns standard JSON Schema 2020-12 for docs and the Agent output instruction (WFRT019); `fromAgentOutputExample` is NOT provided.
7. Parsing helper `parseJsonStrict(text, maxBytes)`: rejects duplicate keys, prototype keys, depth > 20, size > `maxBytes`; used by the Agent node on CLI output.
8. Performance: validation is O(size of value); no regex is used for user-supplied patterns (no `pattern` keyword), so there is no ReDoS surface.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Result`, `AppError` (ARCH003). The schema contract is reused by WFRT003 (`inputSchema`), node port declarations (WFRT005), the evaluator (WFRT016), Evidence (WFRT026).

## 8. Architecture and code placement

Contract (zod): `packages/contracts/src/workflow/port-schema/port-schema.ts`. Pure logic: `packages/domain/src/wfrt/port-schema/{validate.ts,assignable.ts,describe.ts,to-json-schema.ts,parse-json-strict.ts}`. No I/O, no Node built-ins, no dependency.

## 9. Security and safety

This validator is a trust boundary for Agent output. It is total (never throws; returns violations), bounded in time and memory, and ignores unknown keys by rejecting them. No code generation anywhere. Violation messages never echo long values. A unit test asserts the source tree contains no `eval`, `new Function` or `RegExp` built from data (grep test).

## 10. Errors and edge cases

`required` lists a property absent from `properties`: schema rejected at parse. Recursive schemas are impossible (no `$ref`). A value nested deeper than 12 -> violation `depth`. Big arrays: `maxItems` default 1 000 applies. `integer` accepts `3` and `3.0`, rejects `3.5` and `1e400`. `-0` is accepted and normalised to `0` by `normalizeJson` helper (also provided, used before hashing).

## 11. Acceptance criteria

- [ ] All forbidden keywords rejected with a stable code.
- [ ] Validator rejects prototype keys, NaN, cycles, Date, undefined.
- [ ] `isAssignable` passes the case table including nullable, enum subset, range containment, extra properties.
- [ ] Property test: any value generated from schema S validates against S; any generated value for an assignable pair (A, B) validates against B.
- [ ] No dynamic code execution found by the grep test.

## 12. Test plan

Unit tests per file; property tests with a schema-driven value generator in `packages/testing/src/wfrt/` is not owned here, so the generator lives in the test folder of this package. Command `pnpm vitest run packages/domain/src/wfrt/port-schema`.

## 13. Parallelization notes

Independent leaf task; start immediately. WFRT003, 012, 016, 019 consume it. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: no `oneOf`/`anyOf` in MVP; tagged results use an enum field plus optional properties (for example Review verdict).
- ASSUMPTION: string `maxLength` default 10 000 is enforced so unbounded Agent text cannot reach expressions.

