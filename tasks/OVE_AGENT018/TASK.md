---
id: OVE_AGENT018
title: Define the RunReader port and the GetRunSummary use case
area: AGENT
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_ARCH007, OVE_WFRT006]
soft_depends_on: []
provides: ["port:RunReader", "usecase:GetRunSummary", "contract:RunSummaryLite"]
needs: ["contract:WorkflowRun", "contract:RunStatus", "port:Clock"]
owns: ["packages/application/src/ports/RunReader.ts", "packages/application/src/run-read/**", "packages/contracts/src/run-read/**"]
reads: ["packages/contracts/src/workflow-run/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [5, 19, 3]
---

# OVE_AGENT018: Define the RunReader port and the GetRunSummary use case

## 1. Summary

Defines the narrow read port other areas use to look at Runs (state, Workspace, pinned Agent, active flag) plus a safe summary use case, so ENGINE, PERM, AGENT and CHIEF do not depend on the Run projection internals.

## 2. Context

Gap found: ENGINE005 (find non-terminal Runs), AGENT013/014/015 (validate Run-scoped tokens), CHIEF009 and PERM010/014 need `port:RunReader` and `usecase:GetRunSummary`, but no WFRT task provides them (WFRT006 only defines contracts; Runs are projections of the event stream). Provisional ownership here until WFRT claims it.

## 3. Scope (in)

- The port and an adapter over the WFRT run projection, a lite summary contract, use case.

## 4. Out of scope

- Run lifecycle, transitions, persistence of Runs (WFRT). Run trace and UI lists.

## 5. Detailed requirements

1. `RunReader` methods: `getById(runId)`, `listNonTerminal()`, `listActiveForWorkspace(workspaceId)`, `getPinnedAgent(runId) -> { agentId, agentVersion } | null`, `isActive(runId)`; all return `Result`, no write methods.
2. `RunSummaryLite = { id, number, workflowId, workflowVersionId, workspaceId, status: RunStatus, pauseReasons kinds only, startedAt?, endedAt?, currentAgentIds: AgentId[], mode }`; no inputs, outputs, tokens or errors with details.
3. `GetRunSummary({ runId, scope })` returns `RunSummaryLite`; a Workspace scope hides Runs of other Workspaces as `wfrt.run_not_found`; `system` scope for PERM/ENGINE.
4. Adapter `ProjectionRunReader` reads the WFRT run projection (the persistence task of WFRT, `port:RunProjectionStore`, assumed) and maps statuses; it is read-only and tolerant to unknown future statuses (treated as non-terminal, logged).
5. Fake implementation `InMemoryRunReader` exported for tests of all areas.
6. Performance: `listNonTerminal` uses an indexed status filter, bounded to 1000 rows.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

WFRT006 contracts.

## 8. Architecture and code placement

Port in `ports/RunReader.ts`; use case in `run-read/`; adapter in the WFRT persistence package once available.

## 9. Security and safety

Read-only and narrow: no payloads, so permission and audit consumers cannot leak Run data. Scope filtering is mandatory in the use case.

## 10. Errors and edge cases

- Unknown Run: `wfrt.run_not_found`.
- Projection lagging: documented eventual consistency, `listNonTerminal` for recovery reads the authoritative projection with a rebuild fallback.

## 11. Acceptance criteria

- [ ] Port has no mutators (type test).
- [ ] Scope filter hides other Workspaces.
- [ ] Fake available and used by AGENT013 tests.

## 12. Test plan

Unit tests plus contract test shared by fake and projection adapter. Command: `pnpm vitest run packages/application/src/run-read`.

## 13. Parallelization notes

Small; unblocks ENGINE005, PERM010/014, AGENT013-015 and CHIEF009.

## 14. Open questions and assumptions

- GAP: adapter depends on WFRT's projection store (name assumed `port:RunProjectionStore`); WFRT must expose it.
- OPEN: WFRT may prefer to own this; if so move this task to WFRT.
