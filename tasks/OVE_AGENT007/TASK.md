---
id: OVE_AGENT007
title: Implement Dynamic Agent creation by Chief and Owner promotion to persistent
area: AGENT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT004, OVE_AGENT006, OVE_CHIEF014, OVE_DATA010, OVE_MEM003, OVE_NOTIF004, OVE_PERM020]
soft_depends_on: [OVE_AGENT005]
provides: ["usecase:CreateDynamicAgent", "usecase:ProposeKeepDynamicAgent", "usecase:AcceptDynamicAgent", "usecase:DeclineDynamicAgent", "api:agents.dynamic", "event:agent.promoted"]
needs: ["port:MemoryAdmin", "port:WorkspaceRepository", "usecase:AppendAudit", "usecase:Notify", "port:ProposalRepository"]
owns: ["packages/application/src/agent/dynamic/**", "packages/gateway/src/routes/agent/agents-dynamic.route.ts"]
reads: ["packages/domain/src/agent/lifecycle.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 10"]
adr_refs: [14, 28, 15, 3]
---

# OVE_AGENT007: Implement Dynamic Agent creation by Chief and Owner promotion to persistent

## 1. Summary

Chief can create a Dynamic Agent for a Task; it is private to the Workspace, runs with narrowed permissions and, when the Task ends, is offered to the Owner to keep (with its memory), choose a visibility for, or delete. Only the Owner turns it into a Persistent Agent.

## 2. Context

SPEC 4: "Agent dynamiczny: tworzony przez Chiefa na potrzeby Zadania, prywatny w swoim Workspace. Po akceptacji Właściciela staje się stały razem ze swoją pamięcią, a Właściciel decyduje, czy ma być publiczny." Mock `Agenci.png` section "DYNAMICZNI · CZEKAJĄ NA AKCEPTACJĘ" with buttons "Zachowaj jako stałego" and "Usuń". ADR 0014: the memory made for the Task is kept on promotion. ADR 0003: Chief may not widen permissions.

## 3. Scope (in)

- `CreateDynamicAgent(input, caller)` (caller must be Chief engine actor).
- `ProposeKeepDynamicAgent`: marks `proposed_for_keep` and creates an Owner proposal (kind `agent_promotion`) through `ProposalRepository` (CHIEF014 consumes).
- `AcceptDynamicAgent(agentId, { visibility, ownerWorkspaceId? })` and `DeclineDynamicAgent(agentId)`: Owner-only.
- Routes: `POST /v1/agents/{id}/dynamic/accept`, `POST /v1/agents/{id}/dynamic/decline`, `GET /v1/agents?lifecycle=dynamic&dynamicStatus=proposed_for_keep` is covered by the list route.

## 4. Out of scope

- Which Agent Chief designs: `OVE_CHIEF010`. Proposal inbox rendering: `OVE_CHIEF014` and AGUI. Memory content: MEM (this task calls `MemoryAdmin.retainForPromotion` only).

## 5. Detailed requirements

1. `CreateDynamicAgent` rules (all checked with domain rules from `OVE_AGENT002`): `visibility: 'private'`, `ownerWorkspaceId` = the Task's Workspace, `lifecycle: 'dynamic'`, `dynamicStatus: 'active'`, `createdBy: { kind: 'chief', taskId }`. `permissionProfileId` MUST be in the Chief-assignable set and MUST pass `assertNarrowing` against Chief's own effective limits; tools default to none enabled. Budget and timeout default to the Workspace defaults and MAY NOT exceed them.
2. Creation is refused in an Owner-paused or isolated-with-no-budget context (`agent.scope_violation`) and when the Workspace already has 10 active Dynamic Agents (ASSUMPTION limit `maxActiveDynamicAgentsPerWorkspace = 10`, configurable in AppConfig).
3. A Dynamic Agent gets its own Agent Memory scope tied to `(agentId, workspaceId)`; no memory exists until the first Task summary is written (MEM).
4. When the originating Task reaches a terminal state (event `task.finished` from BOARD), a subscriber calls `ProposeKeepDynamicAgent`; it sets `dynamicStatus = 'proposed_for_keep'` through a new config version, creates a proposal `{ kind: 'agent_promotion', subjectId: agentId, summary (<=280 chars, built by Overmind from Task title and counts, not from model text), createdBy: 'chief' }` and calls `Notify(kind: 'proposal')`. Not proposing within 7 days is not an error: the Agent stays `proposed_for_keep` and idle.
5. `AcceptDynamicAgent`: Owner on desktop only. Input `{ agentId, expectedVersion, visibility: 'public' | 'private' }` (default private; `public` rejected in isolated Workspaces). Transition `proposed_for_keep -> persistent` through `transitionLifecycle`; new version; `MemoryAdmin.retainForPromotion(agentId, workspaceId)` is called in the same unit of work (or as an outbox event if MEM is async) so memory stays attached; audit `agent.dynamic.accepted`. A proposal resolved elsewhere (CHIEF014) results in the same use case call, never a second implementation.
6. `DeclineDynamicAgent`: sets `declined`, then archives; Agent Memory of that Agent is scheduled for deletion by MEM (`MemoryAdmin.discard(agentId)`); versions are retained for audit and replay. The UI label is "Usuń".
7. A Dynamic Agent can be used by Runs of its Workspace while `active` or `proposed_for_keep`; once `declined/archived`, new Runs fail with `agent.archived`.
8. Dynamic Agents never appear in lists of other Workspaces, in Chief's suggestions for other Workspaces and never in Telegram `@` completion outside their Workspace (VIS).
9. Every create, propose, accept and decline emits events and audit entries.

## 6. Design notes

N/A, functionality only. (The proposal card copy in the mock: "Chief stworzył go do Zadania T-22, prywatnie w tym Workspace. Po akceptacji wybierzesz, czy ma być publiczny." Message parameters are `taskId`, `workspaceName`.)

## 7. Reuse

Domain lifecycle and narrowing (`OVE_AGENT002`), `UpdateAgentConfig` internals via repository, `ProposalRepository` (CHIEF014), `Notify` (NOTIF), `MemoryAdmin` (MEM).

## 8. Architecture and code placement

`packages/application/src/agent/dynamic/{create-dynamic-agent,propose-keep,accept-dynamic,decline-dynamic}.usecase.ts`; subscriber `on-task-finished.subscriber.ts` registered through the agent module. Gateway route file `agents-dynamic.route.ts`. Dependencies: ports only.

## 9. Security and safety

Core threat: Chief (or an injected model) silently creating a powerful Agent. Mitigations: creation has no permission side effect, profile must be narrower than Chief's and from a whitelist, tools default off, hard cap on count, audit for every step, promotion requires the Owner on desktop. Proposal summaries are built from Overmind data, not model text (R3 of OVE_SEC004). Memory is retained only on Owner acceptance.

## 10. Errors and edge cases

- Task deleted before finishing: Agent proposed for keep anyway only if it produced memory; otherwise archived automatically with an audit entry.
- Accept races with decline from another window: optimistic version check, second call gets `agent.version_conflict`.
- Workspace deleted: Dynamic Agent archived with the Workspace (SPEC 10).
- Accept in isolated Workspace with `public`: refused.
- Memory port failing during accept: whole accept rolls back (fail closed), Agent stays `proposed_for_keep`.

## 11. Acceptance criteria

- [ ] Chief-created Agent is private, dynamic, active; a public request is rejected.
- [ ] Creation with a profile wider than Chief's own limits is rejected.
- [ ] Finishing the Task produces exactly one proposal and one notification.
- [ ] Owner accept makes the Agent persistent, private by default, with memory retained; with `public` it becomes public except in isolated Workspaces.
- [ ] Decline archives the Agent and requests memory discard.
- [ ] Chief or Telegram callers cannot accept (rejected, audited).
- [ ] The 11th active Dynamic Agent in a Workspace is refused.

## 12. Test plan

Unit tests with fakes; integration test `task finished -> proposal -> accept` with in-memory ports; negative security tests listed above. Command: `pnpm vitest run packages/application/src/agent/dynamic`.

## 13. Parallelization notes

After AGENT004 and AGENT006. Hotspot: shares the proposal contract with CHIEF014 (contract file `packages/contracts/src/proposal/` owned by CHIEF001); coordinate through the contract only.

## 14. Open questions and assumptions

- ASSUMPTION: max 10 active Dynamic Agents per Workspace.
- ASSUMPTION: 7 days is only a reminder cadence, not an expiry.
- Question for Owner: should declined Dynamic Agents' versions be purged after N days? Default: keep.
