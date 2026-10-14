---
id: OVE_MEM009
title: "Handle memory on Agent promotion and deletion without changing scope"
area: MEM
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_AGENT007, OVE_ENGINE029, OVE_MEM003, OVE_MEM004, OVE_MEM007]
soft_depends_on: []
provides: ["usecase:memory.on-agent-promoted", "usecase:memory.on-agent-deleted"]
needs: ["event:agent.promoted", "event:agent.deleted", "port:AgentMemoryRepository", "port:MemoryDeleteGuard", "port:JobScheduler"]
owns: ["packages/application/src/memory/lifecycle/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.3"]
adr_refs: [14, 28]
---

# OVE_MEM009: Handle memory on Agent promotion and deletion without changing scope

## 1. Summary

Keep a Dynamic Agent's recollections when it is promoted to Persistent (re-tagged, still in the same Workspace), purge them when the Agent is deleted, and prove that changing a Workspace's Visibility does not move or expose memory.

## 2. Context

ADR 0014: Agent Memory is per Workspace even for a public Agent. ADR 0028: Visibility does not change memory boundaries. Promotion creates continuity but not widening.

## 3. Scope (in)

- Two event handlers and a boundary test.

## 4. Out of scope

- Promotion itself: AGENT.

## 5. Detailed requirements

1. On `agent.promoted`: entries of the Dynamic Agent keep their workspace; `promotedFrom: 'dynamic'` is set via a new provenance-retag compaction-free status update; no content change (immutable), implemented by a `promotion_retag` marker row if the column is not mutable.
2. On `agent.deleted`: delete all of the Agent's entries through the `agent_deleted` guard; emit `memory.entries.purged`.
3. Handlers idempotent by event id.
4. Test: `workspace.visibility_changed` (public/private) leaves entries, scope sets and context packs identical.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Delete guard from MEM004.

## 8. Architecture and code placement

Application handlers.

## 9. Security and safety

Purge only for the event's Agent; promotion never copies entries into other Workspaces; visibility toggles cannot widen reads.

## 10. Errors and edge cases

- Event replayed: no second purge side effects.
- Agent promoted while a summary job is running: job writes under the same Agent id.

## 11. Acceptance criteria

- [ ] Deleted Agent leaves no entries or FTS rows.
- [ ] Promoted Agent entries remain readable only in their Workspaces.
- [ ] Visibility change test passes for both directions.

## 12. Test plan

- Handler tests with fakes. Commands: `pnpm vitest run packages/application/src/memory/lifecycle`.

## 13. Parallelization notes

Independent.

## 14. Open questions and assumptions

- ASSUMPTION: promotion event carries old and new Agent ids if they differ.
