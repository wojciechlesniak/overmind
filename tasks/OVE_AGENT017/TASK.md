---
id: OVE_AGENT017
title: Add Agent-area Workspace cascade, shutdown and recovery participants
area: AGENT
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT003, OVE_AGENT010, OVE_AGENT011, OVE_AGENT012, OVE_ARCH007, OVE_DATA012, OVE_ENGINE004, OVE_ENGINE005]
soft_depends_on: []
provides: ["participant:agents-cascade", "participant:agent-presence-shutdown", "participant:agent-messages-shutdown", "participant:agent-messages-recovery"]
needs: ["port:WorkspaceCascadeParticipant", "port:ShutdownParticipant", "port:RecoveryParticipant", "port:AgentStateStore", "port:AgentMessageRepository", "port:AgentRepository", "port:Clock"]
owns: ["packages/adapters/sqlite/src/agent/cascade.ts", "apps/engine/src/composition/modules/agent-lifecycle.module.ts"]
reads: ["packages/application/src/agent/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 16"]
adr_refs: [5, 10, 26]
---

# OVE_AGENT017: Add Agent-area Workspace cascade, shutdown and recovery participants

## 1. Summary

Registers the lifecycle participants of the Agent area: deleting a Workspace removes its private Agents, Agent messages and state; shutdown stops the presence projector and message deliverer cleanly; recovery repairs in-flight AgentMessage deliveries.

## 2. Context

SPEC 10: deleting a Workspace deletes its private Agents (after local approval, DATA012). ENGINE004 and ENGINE005 define the multi-ports; each area plugs in. Without this, a crash mid-delivery could leave a message `sending` forever or re-send it blindly.

## 3. Scope (in)

- `agents-cascade` (id `agents`), presence and deliverer shutdown participants, message recovery participant, composition module.

## 4. Out of scope

- Chat equivalents: CHAT014. Run-level participants: AGENT019.

## 5. Detailed requirements

1. `agents-cascade`: preview returns counts of private Agents, versions, messages and state rows of the Workspace; `deleteFor` removes private Agents owned by the Workspace (all versions), `agent_messages` where either end is in the Workspace, `agent_state` rows. Public Agents are never deleted; their `agent_state` and messages for that Workspace are removed. Participant `order` runs before Skills and Workspace row.
2. Refuses to delete (blocking item) a private Agent that is the pinned Agent of a non-terminal Run: DATA012 already refuses Workspaces with active Runs, so this is a defensive check.
3. `agent-presence-shutdown` (phase `quiesce`, timeout 2 s): stops the projector subscription, flushes pending state writes, records last processed event seq so restart resumes without gaps.
4. `agent-messages-shutdown` (phase `stop_accepting` then `checkpoint`): stops accepting new deliveries, waits for the in-flight attempt to settle within its timeout, otherwise leaves the attempt row `sending` for recovery.
5. `agent-messages-recovery` (order after DATA recovery): for every `AgentMessage` in `sending` with an attempt row, never retries blindly: if the target session shows evidence of receipt (message ref in the transcript read by gateway) mark `delivered`, else mark `delivery_unknown` and create an Owner-visible Escalation-lite notification `agent.message.delivery_unknown`; `queued` messages resume normal delivery after the state gate passes.
6. Presence is rebuilt from the event log and live evidence at start (ENGINE005 hint-only rule): no state is trusted from before the crash except `finished_unread` flags which are durable.
7. All participants log structured counts and never block startup beyond their budgets.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Patterns from DATA012 and ENGINE004/005.

## 8. Architecture and code placement

Cascade in the sqlite adapter; lifecycle module wires multi-tokens in `agent-lifecycle.module.ts`.

## 9. Security and safety

Cascade must not touch other Workspaces and must delete private data completely; recovery must not duplicate a message typed into a CLI (non-idempotent) and must fail toward Owner awareness.

## 10. Errors and edge cases

- Delivery attempt crashed mid-write: `delivery_unknown`.
- Gateway unavailable at recovery: messages stay queued, retried when available.
- Timeout in shutdown: logged, leaves state for recovery.

## 11. Acceptance criteria

- [ ] Cascade removes only the Workspace's data (fixture test).
- [ ] Shutdown flushes presence without losing seq.
- [ ] Crashed delivery never re-sent automatically.
- [ ] Unknown deliveries create an Owner notification.

## 12. Test plan

Cascade tests with the DATA012 harness; recovery scenarios from TEST011 style (kill between attempt row and send). Command: `pnpm vitest run packages/adapters/sqlite/src/agent apps/engine/src/composition/modules`.

## 13. Parallelization notes

Depends on ENGINE004/005/DATA012 port files merging first (names used as needs).

## 14. Open questions and assumptions

- ASSUMPTION: `agent.message.delivery_unknown` event added to AGENT011 events (cross-task).
