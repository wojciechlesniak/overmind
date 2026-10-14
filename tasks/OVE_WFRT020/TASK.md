---
id: OVE_WFRT020
title: Implement the Parallel node (fan-out to named branches)
area: WFRT
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_WFRT005]
soft_depends_on: [OVE_WFRT011]
provides: ["node:parallel"]
needs: ["lib:result"]
owns: ["packages/contracts/src/workflow/nodes/parallel.config.ts", "packages/domain/src/wfrt/nodes/parallel/**", "packages/workflow-runtime/src/handlers/parallel/**"]
reads: ["packages/domain/src/wfrt/nodes/types.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 9", "SPECIFICATION 16.5", "SPECIFICATION 16.14"]
adr_refs: [2, 19]
---

# OVE_WFRT020: Implement the Parallel node (fan-out to named branches)

## 1. Summary

Parallel copies its input token to N named output ports so that branches (for example Product Owner and Designer, or QA and Security) become ready at the same time. Actual concurrency is bounded by the installation-wide agent cap (WFRT034), not by this node.

## 2. Context

Mock: Product Owner and Designer run in parallel then join; QA and Security run in parallel then the Quality Gate. SPEC 16.14: the engine enforces the cap of 3 Agents at a time; Parallel only declares independence.

## 3. Scope (in)

Config, ports, handler, validation rules for fan-out.

## 4. Out of scope

Waiting for branches (Join, WFRT021). Slot scheduling (WFRT034). Branch pause (WFRT042).

## 5. Detailed requirements

1. Config: `{ branches: Array<{ port: PortName, label: string (<=40) }> }` with 2 to 16 entries, unique ports, default `[{port:'a',label:'A'},{port:'b',label:'B'}]`.
2. Ports: in `in`; out one port per branch, schema equal to the input schema (pass-through; `any_json` when unknown).
3. Handler: `onActivate` returns `complete` emitting an independent deep copy of the input payload on every branch port in declaration order. Token ids are created by the engine from the emission order (deterministic).
4. `branchId` = `<parallelKey>.<port>@<scope>`; recorded on the tokens so pause (WFRT042) and Join (WFRT021) can reference a branch.
5. Rules: `parallel.fan_out_limit` (>16, error), `parallel.single_branch` (fewer than 2, error), `parallel.branch_unconnected` (a declared port without an edge, error), `parallel.no_join` (warning: branches never converge on a Join before the End, which is allowed but flagged), `parallel.branch_port_name_duplicate`.
6. A skipped Parallel (upstream branch not taken) propagates skip to all branches (scheduler, WFRT033).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Registry and conformance helper (WFRT005); deep copy utility from `value.ts` (WFRT016) or a local `cloneJson` placed in `packages/domain/src/wfrt/value-utils.ts` if not yet merged (single definition).

## 8. Architecture and code placement

As the other node tasks: contracts config file, domain definition, runtime handler. No I/O.

## 9. Security and safety

Copies prevent one branch mutating data seen by another (tokens are immutable values anyway). Fan-out cap protects against resource exhaustion. No permissions in config (WFRT014).

## 10. Errors and edge cases

Payload larger than 16 KiB is copied by reference (`payloadRef`) rather than duplicated. Input skipped -> all outputs skipped. Branch port renamed in a later version: edges referencing the old name become `graph.edge_unknown_port` errors.

## 11. Acceptance criteria

- [ ] N branches receive N equal, separately identified tokens in a fixed order.
- [ ] Rules fire for 1 and 17 branches and unconnected ports.
- [ ] Handler is deterministic and passes conformance.

## 12. Test plan

Unit tests; golden fixture check (WFRT050) of two Parallel nodes. Command `pnpm vitest run packages/domain/src/wfrt/nodes/parallel packages/workflow-runtime/src/handlers/parallel`.

## 13. Parallelization notes

Fully parallel with other nodes.

## 14. Open questions and assumptions

- ASSUMPTION: dynamic fan-out over data (map over a list) is not in MVP (later Transform/Subworkflow).

