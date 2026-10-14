---
id: OVE_AGENT020
title: "Define the AgentDirectory port and its repository-backed implementation"
area: AGENT
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_AGENT003, OVE_AGENT004, OVE_ARCH003]
soft_depends_on: []
provides: ["port:AgentDirectory"]
needs: ["port:AgentRepository", "contract:AgentRef", "lib:result"]
owns: ["packages/application/src/ports/AgentDirectory.ts", "packages/application/src/agent/directory/**", "packages/adapters/sqlite/src/agent/agent-directory.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11"]
adr_refs: [7, 10]
---

# OVE_AGENT020: Define the AgentDirectory port and its repository-backed implementation

## 1. Summary

Provides the narrow read-only `AgentDirectory` port other areas (Board, Discussions, Decisions, Chief) use to check that an Agent exists, belongs to a Workspace and is assignable. It hides the Agent repository so consumers never see configuration versions or tables.

## 2. Context

Eleven tasks need `port:AgentDirectory` (Board assignment, Discussion participants, Decision authors, Chief selection). OVE_AGENT003 owns the Agent tables and OVE_AGENT004 the full CRUD use cases, but neither exposes a minimal cross-area lookup port, so consumers would depend on the wide `AgentRepository` (ISP violation). Cross-area use of an entity goes through its contract and use cases (PLAN section 6).

## 3. Scope (in)

- Port `AgentDirectory` with `getRef(agentId): Result<AgentRef | null>`, `listAssignable(workspaceId, filter): AgentRef[]`, `exists(agentId, workspaceId): boolean`, `getDisplay(agentIds): Map<AgentId, {name, avatarHue, kind}>`.
- Implementation over `AgentRepository` and an in-memory fake with the shared contract suite.
- Visibility filtering: Private Agents are returned only for their Workspace (ADR 0028).

## 4. Out of scope

- Write operations on Agents: OVE_AGENT004.
- Agent state or presence: OVE_AGENT010.
- Agent summary for audit and permissions: OVE_AGENT016.

## 5. Detailed requirements

1. `AgentRef` is the existing contract from OVE_AGENT001; this task adds no new entity fields.
2. `listAssignable` excludes archived Agents and returns Dynamic Agents only while they are active; results are sorted by name with a stable ULID tiebreak and capped at 200.
3. `getDisplay` accepts at most 200 ids and silently omits unknown ids; the caller decides how to render a missing Agent.
4. All methods are read-only and MUST NOT open a write transaction; the port is safe to call inside another use case's `UnitOfWork` read phase.
5. The fake lives in `lib:agent-fake` style under the AGENT test support and is registered in the shared fakes of OVE_TEST002 by AGENT, not by this task.
6. Visibility: an Agent whose Visibility is Private is returned only when `workspaceId` matches its owning Workspace; Public Agents are returned for every Workspace.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `AgentRepository` (OVE_AGENT003), `AgentRef` (OVE_AGENT001), visibility rules (OVE_VIS area), `lib:result` (OVE_ARCH003).

## 8. Architecture and code placement

Layer: port in application, implementation in the SQLite adapter folder of AGENT. Consumers depend on the port only (ISP, DIP); no consumer imports `AgentRepository`.

## 9. Security and safety

- Read-only by construction: the interface has no mutator and the adapter uses a read-only statement set.
- Output contains no instructions or configuration text, so prompt injection cannot travel through this port.
- Cross-Workspace leak is the main abuse case: a Private Agent must never be listed for another Workspace; covered by a negative test.

## 10. Errors and edge cases

- Unknown agent id -> `Ok(null)` for `getRef`, `false` for `exists`; never an exception.
- Archived Agent -> `getRef` returns it with `archived: true`, `listAssignable` omits it.
- More than 200 ids -> `Err(agent.too_many_ids)`.

## 11. Acceptance criteria

- [ ] Given a Private Agent of Workspace A, when listing assignable Agents for B, then it is absent.
- [ ] Given an archived Agent, when `listAssignable` runs, then it is absent but `getRef` still resolves it.
- [ ] Given 201 ids, `getDisplay` returns the typed error.
- [ ] Fake and SQLite implementations pass one contract suite.

## 12. Test plan

- Contract suite `agent-directory.contract` run against fake and SQLite; negative visibility test; `pnpm --filter @overmind/application test`; `pnpm check:boundaries`.

## 13. Parallelization notes

Can start as soon as OVE_AGENT004 is in review (stub over the repository). Consumers use the fake. No shared files are edited; the port file is new.

## 14. Open questions and assumptions

- ASSUMPTION: only name, hue and kind are needed for display; extra fields are added later additively.
