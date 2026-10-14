---
id: OVE_WFRT012
title: Add typed-port validation rules (compatibility, required connections, contracts)
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_WFRT010, OVE_WFRT004]
soft_depends_on: [OVE_WFRT011]
provides: ["lib:validation-rules-ports"]
needs: ["lib:port-schema-compat"]
owns: ["packages/domain/src/wfrt/validation/rules/port.*.rule.ts", "packages/domain/src/wfrt/validation/port-resolution.ts"]
reads: ["packages/domain/src/wfrt/port-schema/assignable.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19]
---

# OVE_WFRT012: Add typed-port validation rules (compatibility, required connections, contracts)

## 1. Summary

Rules that enforce "typed ports and input/output contracts": an edge may only connect an output whose schema is assignable to the target input schema, required inputs must be connected, and nodes that must declare a contract (for example Agent output) do.

## 2. Context

SPEC 7: typed ports; conditions operate on structured data. With edge `mapping` (WFRT003) a source output can be reshaped before it reaches a target input; mapping expressions are type-checked in WFRT017, this task treats a mapped edge's effective source type as the mapping result type supplied by that task through `effectiveSourceSchema(edge)`.

## 3. Scope (in)

Port resolution helper and the rules below.

## 4. Out of scope

The assignability algorithm (WFRT004). Mapping expression typing (WFRT017). Structural edge checks (WFRT011).

## 5. Detailed requirements

1. `resolvePortSchemas(ctx)` computes for every port its schema from `NodeTypeDefinition.ports(config)`; ports whose schema derives from config (for example Agent `result` = `config.outputSchema`) are resolved with the parsed config; unresolvable ports are skipped with a single `port.unresolved` warning per node.
2. `port.schema_incompatible` (error): edge source schema not assignable to target schema. Params: `from` (`node.port`), `to`, `reason` (one of `type`, `missing_required_property`, `extra_property`, `range`, `enum`, `nullability`, max 120 chars via `describeSchema`).
3. `port.any_json_into_typed` (warning): `any_json` source feeding a typed port (the value will be validated at runtime, WFRT036).
4. `port.required_input_unconnected` (error): a non-`optional` input port with no incoming edge (Start has none; End `in` required). Params `nodeKey`, `port`.
5. `port.required_output_unconnected` (error) for outputs declared `required` by their node definition (Loop `exhausted`, IF both branches, Quality Gate `pass` and `fail`, Review `approved` and `changes_requested`). Optional outputs only warn via WFRT011.
6. `port.contract_missing` (error): a node whose definition requires a contract but the config has none (Agent without `outputSchema` when its `result` feeds an IF, Gate, Review or an edge with `mapping`; an Agent whose output is not consumed by control flow may omit it and then outputs `{ text: string }`).
7. `port.contract_too_loose` (warning): a contract used in a control-flow decision that contains a free-text string without `maxLength` (the default cap applies but the author should bound it) or `additionalProperties` not false.
8. `port.workflow_io_mismatch` (error): Start `out` schema must equal the Workflow `inputSchema` (the Start node has no own schema); End nodes with `outcome: 'success'` that declare `output` must be assignable to `outputSchema` when defined.
9. Direction/unknown-port errors are WFRT011; this task assumes edges are structurally valid and skips invalid ones (no cascade).
10. Deterministic performance: schema assignability is memoised per (source schema hash, target schema hash) within a run of the validator.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`isAssignable`, `describeSchema` (WFRT004); `DefinitionGraph` (WFRT010).

## 8. Architecture and code placement

Rules in `packages/domain/src/wfrt/validation/rules/port.<name>.rule.ts`; helper `port-resolution.ts`. Pure.

## 9. Security and safety

This is what stops an untyped, free-text Agent output from steering a Gate or an IF: an Agent feeding control flow must have a bounded contract (the rule is an error, not a warning, for IF/Gate/Review). Messages contain schema summaries, never sample values.

## 10. Errors and edge cases

Union (nullable) types: a nullable source into a non-nullable target is incompatible (`nullability`). Integer into number is fine, number into integer is not. A port with a schema that failed to parse is skipped (reported by `config.invalid`).

## 11. Acceptance criteria

- [ ] Each rule has failing and passing fixtures.
- [ ] Agent -> IF without an output contract is an error.
- [ ] `any_json` warning fires only for typed targets.
- [ ] Memoisation keeps a 200-node graph under the performance budget.

## 12. Test plan

`rules/port.*.rule.test.ts`; table-driven cases of schema pairs shared with WFRT004's table. Command `pnpm vitest run packages/domain/src/wfrt/validation/rules/port`.

## 13. Parallelization notes

Parallel with WFRT011, 013, 014. Requires WFRT004 merged for `isAssignable`.

## 14. Open questions and assumptions

- ASSUMPTION: an Agent without `outputSchema` outputs `{ text: string<=65536 }` on `result` so plain chains need no schema.

