---
id: OVE_WFRT018
title: Implement the Start and End node types
area: WFRT
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_WFRT005, OVE_WFRT016]
soft_depends_on: [OVE_WFRT017]
provides: ["node:start", "node:end"]
needs: ["lib:result"]
owns: ["packages/contracts/src/workflow/nodes/start.config.ts", "packages/contracts/src/workflow/nodes/end.config.ts", "packages/domain/src/wfrt/nodes/start/**", "packages/domain/src/wfrt/nodes/end/**", "packages/workflow-runtime/src/handlers/start/**", "packages/workflow-runtime/src/handlers/end/**"]
reads: ["packages/domain/src/wfrt/nodes/types.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16.5"]
adr_refs: [2, 15]
---

# OVE_WFRT018: Implement the Start and End node types

## 1. Summary

`start` emits the validated Run input; `end` finishes the Run with an outcome (`success`, `failure` or `escalated`) and an optional output computed by safe expressions. A Workflow has exactly one Start and one or more Ends.

## 2. Context

The mock shows a "start" pill. SPEC 7 requires missing start/end to be a validation error. Several Ends let a Workflow separate "delivered", "failed" and "loop exhausted -> escalation" outcomes (criterion 5). WFRT005 gets the `finish_run` NodeStep for this task.

## 3. Scope (in)

Two node definitions (config schemas, ports, expression sites) and two handlers.

## 4. Out of scope

Escalation lifecycle (WFRT040), Run state transitions (WFRT030), scheduling of cancellation of remaining branches (WFRT033).

## 5. Detailed requirements

1. **Start.** Config `{}` (strict). Ports: out `out` with `schemaFrom: 'workflowInput'` (resolved by the registry from `definition.inputSchema`). No inputs. Handler: `onActivate` returns `complete` emitting the Run input payload on `out`. `defaultConfig = {}`. At most one per Workflow (rule in WFRT011).
2. **End config:** `{ outcome: 'success'|'failure'|'escalated', output?: Record<string, string> (field -> expression, max 20), failureCode?: string (^[a-z_]{1,40}$, for outcome failure; default 'end_failure'), escalation?: { reason: 'explicit'|'loop_exhausted'|'budget_exceeded'|'discussion_deadlock', summary: string (<=200) } }`. Ports: in `in` (single edge). `output` allowed only for `success`; `escalation` only for `escalated` (superRefine).
3. **End handler:** evaluate `output` expressions (scope: `input` = incoming payload, `run`, `nodes` = outputs of nodes referenced by key via `run.nodeOutputs[key]` - restricted to nodes that are ancestors, checked statically) with `evaluate` (WFRT016); result validated against `definition.outputSchema` if present. Return `{ kind: 'finish_run', outcome, output, reason }`. An expression error makes the End node fail (`wfrt.end_output_invalid`), which fails the Run with that code (no silent success).
4. **First End wins.** When an End finishes the Run: `success`/`failure` -> engine cancels all other active executions (reason `cancelled_branch`) and abandons nothing silently: started non-idempotent actions are allowed to settle only if already in flight (WFRT042 rule), others cancelled; `escalated` -> Run becomes `escalated` (pause reason `escalation`), nothing else is cancelled so the Owner can resume after resolving. If two Ends arrive in the same scheduler pass, the one with the lowest node key wins, deterministic.
5. Expression sites exposed: `end.output.<field>` (scope as above, expect `any`, with output property schema as expected type when `outputSchema` defines it).
6. Locale keys for palette labels: `workflow:node.start`, `workflow:node.end`; node defaults: End default outcome `success`.
7. Validation rules specific to End: `end.outcome_fields` (output on non-success, escalation on non-escalated), `end.output_mismatch` (static type of output vs `outputSchema`).

## 6. Design notes

N/A, functionality only. (Canvas shows Start as a pill; End styling by outcome belongs to WFED/DS.)

## 7. Reuse

`defineNodeConfig`, `NodeTypeDefinition`, `NodeHandler` (WFRT003, WFRT005), `evaluate`, `typecheck` (WFRT016/017).

## 8. Architecture and code placement

Config files in contracts (one per type); definitions in `packages/domain/src/wfrt/nodes/<type>/definition.ts`; handlers in `packages/workflow-runtime/src/handlers/<type>/handler.ts`. Handlers have no I/O.

## 9. Security and safety

Output expressions run only on validated, structured, untrusted-marked values; failure to evaluate fails the Run rather than defaulting. `escalated` End never auto-continues. The Run input reaching Start was validated against the input schema by StartRun (WFRT035), the handler does not re-trust it blindly: it re-validates (defence in depth) and fails on mismatch.

## 10. Errors and edge cases

Two Ends reached together: deterministic winner. End reached while Run is `paused`: cannot happen (no executions run while paused). End with `output` referencing a node that never ran (skipped branch): `expr.missing_path` -> Run fails; the static check warns `end.output_depends_on_conditional_node`.

## 11. Acceptance criteria

- [ ] Start emits input unchanged; End success returns computed output; failure and escalated outcomes produce the right `finish_run` steps.
- [ ] superRefine rules enforced.
- [ ] Both handlers pass `expectNodeConformance`.
- [ ] Output type mismatch is caught at validation time.

## 12. Test plan

Unit tests for handlers and definitions with fake context; conformance helper; expression error path. Command `pnpm vitest run packages/domain/src/wfrt/nodes/start packages/domain/src/wfrt/nodes/end packages/workflow-runtime/src/handlers/start packages/workflow-runtime/src/handlers/end`.

## 13. Parallelization notes

Parallel with all other node tasks. Needs the `finish_run` step added to WFRT005 (recorded there).

## 14. Open questions and assumptions

- ASSUMPTION: escalated End pauses the Run rather than ending it, so the Owner's resolution (WFRT040) can continue or fail it.

