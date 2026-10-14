---
id: OVE_AGENT010
title: Build the Agent presence projection, state store and read API
area: AGENT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_AGENT009, OVE_ARCH007, OVE_ARCH010, OVE_PERM016, OVE_PROV009]
soft_depends_on: [OVE_AGENT005]
provides: ["port:AgentStateStore", "usecase:GetAgentStates", "usecase:MarkResultSeen", "api:agents.states", "service:AgentPresenceProjector", "contract:AgentStateView"]
needs: ["port:AgentSessionGateway", "port:EventBus", "port:Clock", "usecase:ListPendingRequestsForAgent", "contract:AgentStateHint"]
owns: ["packages/application/src/agent/presence/**", "packages/gateway/src/routes/agent/agent-states.route.ts", "packages/application/src/ports/AgentStateStore.ts"]
reads: ["packages/domain/src/agent/state/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12", "SPECIFICATION 16.13"]
adr_refs: [26, 5]
---

# OVE_AGENT010: Build the Agent presence projection, state store and read API

## 1. Summary

A service that subscribes to signals (PROV hints, reports, Run and request events), runs `deriveAgentState` per Agent and Workspace, keeps the current `AgentStateView` in memory with a small persisted snapshot, publishes `agent.state.changed` and serves `GET /v1/agents/states`. Desktop and Telegram read the same projection (criterion 13).

## 2. Context

Conversation lists, the "Teraz pracuje" panel, the Agents view and the tray all show Agent State. The state is evidence-based (`OVE_AGENT009`) and ephemeral: it is rebuilt after an engine restart from the Run event log plus a fresh herdr reconciliation. Agents only exist "in" the Workspace where they currently work, so the key is `(agentId, workspaceId)`.

## 3. Scope (in)

- `AgentPresenceProjector` service (subscriber, start/stop hooks).
- `AgentStateStore` port with in-memory implementation and an optional SQLite snapshot table `agent_state_snapshots` (for fast list after restart).
- `GetAgentStates(workspaceId)`, `MarkResultSeen(agentId, workspaceId)` use cases.
- Route `GET /v1/agents/states?workspaceId=` and `POST /v1/agents/{id}/result-seen`.

## 4. Out of scope

- Producing herdr signals and screen rules: PROV. Notifications for state changes (for example login needed): NOTIF subscribes to `agent.state.changed`.

## 5. Detailed requirements

1. Inputs: bus events `agent.signal.received` (PROV publishes normalised `AgentSignal`s, ephemeral), `run.node.started/succeeded/failed`, `approval.requested/decided`, `access_request.created/decided`, `agent.report.received` (`OVE_AGENT014`), `chat.owner_message.delivered`. The projector maps each to an `AgentSignal` and appends to a per-agent ring buffer (max 50 signals, max age 10 min).
2. On each signal the projector recomputes `deriveAgentState`, applies hysteresis, and when the state, reason or `stale` flag changes it updates the store and publishes `agent.state.changed` (ephemeral) with the `AgentStateView`. Unchanged recomputations publish nothing.
3. A timer (injected scheduler, every 5 s) re-evaluates agents whose TTLs may have expired.
4. Startup reconciliation: for every Agent with an active Run, request `AgentSessionGateway.snapshot(agentId)` (PROV) to seed a fresh `herdr_hint`; if PROV is not ready, all those Agents start as `idle` with reason `no_session` and are corrected as signals arrive. Never carry over `working` from a snapshot older than 60 s.
5. `finished_unread` clears only through `MarkResultSeen` (the Owner opening the Agent chat or the result, or Chief consuming the result) or when a new Task starts for that Agent.
6. `GetAgentStates(workspaceId)` returns one view per Agent visible and active in that Workspace; Agents never worked on there return `idle` with `no_session`. The result never includes Agents of other Workspaces.
7. The route is Owner-only and read-only apart from `result-seen`; Telegram uses the same use case to render status (parity requirement: a contract test asserts the Telegram status renderer input equals this read model).
8. Backpressure: slow subscribers are handled by the bus; the projector itself must process a signal in O(buffer) and never block on I/O (snapshot writes are debounced to at most once per 2 s per agent).
9. Metrics: counters for signals processed, state changes, dropped signals; exposed to the diagnostics endpoint.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`deriveAgentState` (`OVE_AGENT009`), event bus (ARCH010), Clock (ARCH007), `AgentSessionGateway` (PROV), scheduler abstraction from ARCH007 (`Clock.setInterval` fake in tests).

## 8. Architecture and code placement

`packages/application/src/agent/presence/{projector.ts,signal-mappers.ts,store.memory.ts}`; SQLite snapshot adapter `packages/adapters/sqlite/src/agent/agent-state-snapshot.repository.ts` is NOT included (optional later); the in-memory store is enough for MVP (ASSUMPTION), the port allows adding it. Route under `packages/gateway/src/routes/agent/`.

## 9. Security and safety

The projector never sends input to a terminal and never decides permissions; it only classifies. Signals are bounded structs; screen text never enters the store. A forged `agent.signal.received` from an Agent token is impossible because only PROV adapters may publish it (bus publisher identity check in composition, documented) and agent-originated reports pass through `OVE_AGENT014` validation first.

## 10. Errors and edge cases

- Signal for an unknown Agent: dropped with a `warn` counter.
- Engine restart mid-Run: reconciliation as in requirement 4.
- Global Pause: states stay, `paused: true` is set on all views (from `pause.changed`).
- Burst of 1000 signals: buffer cap and hysteresis keep CPU low; test with 10 000 synthetic signals.
- Agent archived: view removed and a final `agent.state.changed` with `idle`.

## 11. Acceptance criteria

- [ ] A fake PROV signal stream produces exactly the expected `agent.state.changed` sequence for the prototype scenarios.
- [ ] `finished_unread` persists until `MarkResultSeen`.
- [ ] After restart reconciliation, no Agent shows `working` from stale data.
- [ ] `GetAgentStates('ws_A')` never contains Agents private to `ws_B`.
- [ ] Desktop route output and the Telegram renderer input derive from the same function (contract test).
- [ ] 10 000 signals processed within 500 ms in the benchmark test (informational threshold).

## 12. Test plan

Unit tests with fake clock and bus; scenario tests replaying fixtures; integration test with fake herdr (TEST009) and `fake-claude` `login-required`, `choice-dialog`, `false-done` scenarios (TEST006). Command: `pnpm vitest run packages/application/src/agent/presence`.

## 13. Parallelization notes

Needs AGENT009 and the PROV signal contract; develop against a stub signal source. Hotspot: `agent.state.changed` event file is owned by AGENT001.

## 14. Open questions and assumptions

- ASSUMPTION: in-memory store with rebuild on start is sufficient for MVP.
- ASSUMPTION: the "unread result" notion is per Agent and Workspace, not per Task.
