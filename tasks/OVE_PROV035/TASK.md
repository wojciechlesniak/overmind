---
id: OVE_PROV035
title: "Provide the BudgetService port: Run and Agent budget checks and consumption"
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_AGENT003, OVE_DATA009, OVE_PROV025]
soft_depends_on: []
provides: ["port:BudgetService", "contract:BudgetStatus"]
needs: ["port:AgentUsageReader", "contract:WorkspaceBudget", "port:Clock", "lib:result"]
owns: ["packages/application/src/ports/BudgetService.ts", "packages/application/src/prov/budget/**", "packages/contracts/src/budget/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 15"]
adr_refs: [7, 15]
---

# OVE_PROV035: Provide the BudgetService port: Run and Agent budget checks and consumption

## 1. Summary

Defines `BudgetService`, the single place that answers "may this Agent, Run or Discussion spend more?" and records consumption against Workspace, Agent and Run Budgets. Discussions, Chief and the runtime call it before starting expensive work and escalate when it says `exhausted`.

## 2. Context

Discussion enforcement (OVE_DISC010, OVE_DISC011) and Chief decisions within Budget need a port that merges the Workspace Budget (OVE_DATA009), the per-Agent limits in AgentConfig (OVE_AGENT003) and measured usage (`ModelUsage`, PROV area). Budgets are expressed in tokens, cost estimate and wall time; the CLI-reported limits percent (SPEC 15) is a separate signal handled by OVE_PROV025.

## 3. Scope (in)

- Contract `BudgetStatus = { scope, limit, used, remaining, state: "ok"|"warning"|"exhausted"|"unlimited", resetsAt? }`.
- Port methods `check(scope, estimate?)`, `consume(scope, usage)`, `status(scope)`, with `scope = {kind: "workspace"|"agent"|"run"|"discussion", id}`.
- Application service that combines the three limit sources and picks the strictest (intersection, never union).
- In-memory fake and contract suite.

## 4. Out of scope

- UI for budget editing: OVE_AGUI007, OVE_WSPACE029.
- Fallback model switching on CLI limits: OVE_CHIEF018.
- Persisting usage rows: owned by the existing usage tables (OVE_PROV area); this task reads them through `AgentUsageReader` and appends via the existing usage use case.

## 5. Detailed requirements

1. `state` is `warning` at 80 percent used (configurable, `ASSUMPTION`) and `exhausted` at 100 percent; `unlimited` only when every source is unset.
2. Effective limit for a scope is `min` over all applicable sources; a missing source is ignored, an unreadable source makes the result `exhausted` (fail closed).
3. `check` is pure with respect to storage (no writes); `consume` is idempotent per `usageId` (duplicate ids are ignored).
4. `estimate` is optional; when given, `check` returns `exhausted` if `used + estimate > limit`.
5. Run and Discussion scopes inherit the Agent and Workspace limits of the Agent running them.
6. Emits `event:budget.warning` and `event:budget.exhausted` once per transition through the event bus (OVE_ARCH010); no repeated events while the state is unchanged.
7. Costs are integers in micro-units of the Owner currency to avoid float drift; token counts are integers.
8. Time source is `Clock`; rolling windows (daily budget) reset at local midnight (`ASSUMPTION`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `WorkspaceBudget` (OVE_DATA009), `AgentUsageReader` (OVE_AGENT003), `Clock` (OVE_ARCH007), event bus (OVE_ARCH010), `lib:result`.

## 8. Architecture and code placement

Layer: application port and service; contracts in `packages/contracts/src/budget/`. No I/O: reads go through ports (DIP). One responsibility: decide and record budget state.

## 9. Security and safety

- A malicious Agent cannot raise its own limit: limits are read-only here and only the Owner edits Workspace and Agent config.
- Usage reports from Agents are declarations; values are clamped to non-negative integers and capped per call to prevent overflow games.
- Fail closed: unreadable limits mean `exhausted`, logged and audited as a budget denial.

## 10. Errors and edge cases

- Negative or NaN usage -> `Err(budget.invalid_usage)`.
- Duplicate `usageId` -> no double counting.
- Missing Workspace Budget -> falls back to Agent and Run limits; all missing -> `unlimited`.
- Concurrent `consume` calls are serialised per scope; totals remain exact.

## 11. Acceptance criteria

- [ ] Given an Agent limit of 100 and a Workspace limit of 50, when used is 50, then state is `exhausted`.
- [ ] Given usage id U consumed twice, then used increases once.
- [ ] Given an unreadable source, then `check` reports `exhausted` and an audit event exists.
- [ ] Given a transition to `warning`, then exactly one event is emitted.

## 12. Test plan

- Unit tests for limit merging (table-driven), property test that `min` never exceeds any source, contract suite for the fake, event emission test. Commands: `pnpm --filter @overmind/application test`, `pnpm typecheck`.

## 13. Parallelization notes

Parallel with PROV tasks that do not touch usage tables. Consumers use the fake. Hotspot: none; new files only.

## 14. Open questions and assumptions

- ASSUMPTION: warning threshold 80 percent; currency and token units follow OVE_DATA009.
- Open: whether the CLI-reported limit percent should feed `BudgetService` or stay separate (default: separate).
