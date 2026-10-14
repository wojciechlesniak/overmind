---
id: OVE_WFRT022
title: Implement the IF node with safe boolean conditions
area: WFRT
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_WFRT005, OVE_WFRT016, OVE_WFRT017]
soft_depends_on: []
provides: ["node:if"]
needs: ["lib:result"]
owns: ["packages/contracts/src/workflow/nodes/if.config.ts", "packages/domain/src/wfrt/nodes/if/**", "packages/workflow-runtime/src/handlers/if/**"]
reads: ["packages/domain/src/wfrt/expression/evaluator.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2]
---

# OVE_WFRT022: Implement the IF node with safe boolean conditions

## 1. Summary

IF routes its input token to `then` or `else` depending on a boolean expression over the structured input. Failure to evaluate fails the node; it never silently picks a branch.

## 2. Context

SPEC 7: IF is in the MVP catalogue; conditions operate on structured data (Agent output per JSON schema), evaluated by the safe evaluator. Edges leaving the other port lead to branches that are skipped (dead-path elimination in WFRT033).

## 3. Scope (in)

Config, ports, expression site, handler, rules.

## 4. Out of scope

Skip propagation (WFRT033). Multi-way routing (Switch, WFRT052).

## 5. Detailed requirements

1. Config: `{ condition: string (expression, <= 1 000 chars), description?: string (<= 200) }`.
2. Ports: in `in` (any schema); out `then`, out `else`; both `required` outputs (WFRT012), schema pass-through of the input.
3. Expression scope: `input` (the incoming payload, typed by the incoming edge schema), `run` (`iteration` of innermost loop or 0, `number`, `mode`), `loop` (innermost `iteration`, `limit`, `feedback` when inside a Loop body, else absent). `expect: 'boolean'`.
4. Handler: parse (cached by `conditionHash`), validate scope values were produced by schema validation (`ValidatedValue`), `evaluateBoolean`; true -> `complete` emitting payload on `then`; false -> on `else`. Evaluation error (`expr.*`) -> `fail` with code `wfrt.expression_error`, `retryable: false`, safe params (expression error code and position, no values).
5. The decision is recorded in `node.succeeded` outputs implicitly (only one token emitted) plus `localState: { result: boolean, conditionHash }` for the trace.
6. Rules: `if.condition_required`, `if.condition_not_boolean`, plus the generic `expr.*` rules via `expressionSites`. Warning `if.same_target` if both ports go to the same node.
7. Dry-run: evaluates normally on example data; if example data cannot satisfy the path, takes the declared `dryRunBranch` from the run request (WFRT044).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`parseExpression`, `typecheck`, `evaluateBoolean` (WFRT015 to WFRT017). No local expression handling.

## 8. Architecture and code placement

Standard node folders; no I/O; expression cache is an in-memory LRU (max 500 entries) inside the handler factory, keyed by hash.

## 9. Security and safety

Input values are untrusted but schema-validated; only declared fields can be read. A condition that depends on an unbounded free-text field is flagged by WFRT012 (`port.contract_too_loose`). No dynamic code. Error messages hide values.

## 10. Errors and edge cases

Missing optional field at runtime: `expr.missing_path` -> node fails (author should use `coalesce`/`isNull`). Non-boolean result: fails with `expr.not_boolean`. Expression edited in a new version: the old Run keeps the old one (pinned).

## 11. Acceptance criteria

- [ ] True/false routing, error handling and trace state tested.
- [ ] Static rules fire for non-boolean and missing condition.
- [ ] Hostile expression strings from the corpus never execute (reuses `expectExpressionSafe`).

## 12. Test plan

Unit tests with table of conditions x inputs; integration inside the golden fixture variant with an IF. Command `pnpm vitest run packages/domain/src/wfrt/nodes/if packages/workflow-runtime/src/handlers/if`.

## 13. Parallelization notes

Parallel with other nodes once WFRT016/017 are merged.

## 14. Open questions and assumptions

- ASSUMPTION: `else` must be wired even if it leads straight to an End, to avoid silent dead paths.

