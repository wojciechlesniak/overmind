---
id: OVE_DISC007
title: "Start a Discussion from a Workflow Node automatically and return its result"
area: DISC
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DATA010, OVE_DISC006, OVE_PERM008, OVE_PERM020, OVE_SKILL003]
soft_depends_on: []
provides: ["usecase:discussion.start-from-node", "port:DiscussionNodeBinding"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "port:AgentDirectory", "port:WorkspaceRepository", "port:SkillCatalog"]
owns: ["packages/application/src/discussion/start-from-node/**", "packages/application/src/ports/DiscussionNodeBinding.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [2, 15]
---

# OVE_DISC007: Start a Discussion from a Workflow Node automatically and return its result

## 1. Summary

Provide the use case the WFRT Discussion Node calls: validate the Node configuration, create the Discussion (idempotent per Node execution), start it without asking the Owner, and expose completion as an event and a result the Node turns into its output.

## 2. Context

SPEC 6: a Discussion written into a Workflow as a Node starts by itself. SPEC 7: Node catalog includes Discussion; the node output is structured data for conditions. The mock canvas shows `DYSKUSJA · GRILL-ME` with `3 decyzje → 5 Zadań na Tablicy`. ADR 0028: participants must be visible in the Workspace.

## 3. Scope (in)

- `startFromNode(input)`, config validation, participant visibility check, idempotency, completion event mapping, `DiscussionNodeBinding` port for WFRT.

## 4. Out of scope

- Node definition/UI: WFRT/WFED. The engine: DISC006. Chief-started: DISC008.

## 5. Detailed requirements

1. **Port** `DiscussionNodeBinding`: `start(i: { workspaceId, runId, branchId?, nodeExecutionId, config: { title, agenda, question, options?, participantAgentIds[], moderator: 'chief' | AgentId, maxRounds?, skillHints? , outcomeRequirement: 'tasks'|'decision'|'either' } }): Promise<Result<{ discussionId }>>`; `result(discussionId): Promise<Result<NodeDiscussionResult>>` where `NodeDiscussionResult = { status: 'concluded'|'escalated'|'cancelled'|'failed', taskIds[], decisionIds[], resolution }`. WFRT waits for `discussion.concluded` (event) and reads `result`.
2. **Validation:** 2..8 participants; every Agent usable in the Workspace (`AgentDirectory.isUsableIn`, ADR 0028: private foreign Agents rejected `disc.participants_invalid`); Chief allowed; moderator valid; `maxRounds` within config bounds (default 4); agenda 1..2000 chars sanitised; `question` defaults to `how` for node-started Discussions unless config says `what`.
3. **Idempotency:** `findByNodeExecution(nodeExecutionId)`: a repeated start returns the existing Discussion; never creates two for one Node execution (unique constraint backstop).
4. **No Owner gate:** `ownerApprovalRequired = (question === 'what')` (ASSUMPTION; a "what" outcome always needs the Owner, ADR 0016); for `how` Discussions the outcome is finalised under Chief's autonomy (DISC012).
5. **Run integration:** the Node itself is `waiting` in the Run; the Discussion does NOT pause the Run (the Node is the pause); `runControl.paused` stays false.
6. **Outcome mapping:** `outcomeRequirement` is enforced at finalisation (DISC012): `tasks` requires >= 1 Task draft, `decision` >= 1 Decision draft, `either` any.
7. **Skills:** participants' Skills are resolved per turn (DISC005); `skillHints` (names) in config are advisory data for the moderator brief, not a way to grant Skills.
8. **Audit:** `discussion.started` event and an audit record with run and node ids.
9. **Pause:** if Global Pause is active at start, the Discussion is created `scheduled` and the runner starts on resume (DISC010).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DISC006 runner registration, `AgentDirectory`, `PauseGate`. Creation helper `createDiscussion()` is exported here and reused by DISC008 (do not duplicate).

## 8. Architecture and code placement

`packages/application/src/discussion/start-from-node/{start-from-node.ts,create-discussion.ts,config-schema.ts}`, port file for the binding. Depends on ports.

## 9. Security and safety

Node configuration comes from a Workflow authored by Chief or Owner and published by the Owner (ADR 0002/0016); even so the agenda is data and sanitised; participants are validated against visibility so a Workflow cannot pull a private Agent from another Workspace into a Discussion. Start is idempotent to prevent duplicated model spend. The Node cannot supply `ownerApprovalRequired = false` for a `what` question.

## 10. Errors and edge cases

- Participant removed after publication: `disc.participants_invalid`, the Node fails (WFRT handles).
- Two Nodes in parallel branches start Discussions: independent.
- Start while Pause: scheduled, not running.
- Chief listed as both participant and moderator: allowed (one entry).

## 11. Acceptance criteria

- [ ] Valid config creates a running Discussion without Owner interaction and returns its id.
- [ ] Repeated start with the same `nodeExecutionId` returns the same Discussion.
- [ ] A private Agent of another Workspace is rejected.
- [ ] `question: 'what'` forces Owner approval of the outcome.
- [ ] During Global Pause the Discussion is `scheduled`.
- [ ] Completion yields `NodeDiscussionResult` with task and decision ids.

## 12. Test plan

- `start-from-node.test.ts` with fakes, idempotency and visibility tables. Commands: `pnpm vitest run packages/application/src/discussion/start-from-node`.

## 13. Parallelization notes

WFRT Discussion Node task consumes `port:DiscussionNodeBinding`. Parallel with DISC008-010.

## 14. Open questions and assumptions

- ASSUMPTION: `ownerApprovalRequired` is true exactly for `what` questions in node-started Discussions.
