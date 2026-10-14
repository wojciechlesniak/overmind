---
id: OVE_CHIEF001
title: Define Chief contracts (actions, proposals, escalations, summaries, config)
area: CHIEF
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_ARCH003, OVE_ARCH007, OVE_ARCH008, OVE_DATA013, OVE_DATA016, OVE_VIS001]
soft_depends_on: [OVE_ARCH010]
provides: ["contract:ChiefAction", "contract:Proposal", "contract:Escalation", "contract:ChiefSummary", "contract:ChiefConfig", "contract:ChiefErrors"]
needs: ["contract:Visibility", "contract:OwnerRule", "contract:ProjectDocRef", "contract:AgentRef"]
owns: ["packages/contracts/src/chief/**", "packages/contracts/src/proposal/**", "packages/contracts/src/errors/chief.errors.ts", "packages/contracts/src/events/chief.proposal.created.event.ts", "packages/contracts/src/events/chief.proposal.decided.event.ts", "packages/contracts/src/events/chief.escalation.raised.event.ts", "packages/contracts/src/events/chief.escalation.resolved.event.ts"]
reads: ["packages/contracts/src/kernel/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 9"]
adr_refs: [15, 16, 12, 28, 3]
---

# OVE_CHIEF001: Define Chief contracts (actions, proposals, escalations, summaries, config)

## 1. Summary

One place for the typed vocabulary of Chief: the `ChiefAction` union that is the ONLY thing a Chief model turn may produce, the `Proposal` entity for things only the Owner can accept, the `Escalation` entity, the dashboard `ChiefSummary` and `ChiefConfig`. Typed output is the structural firewall of OVE_SEC004 (R3): text never becomes permission.

## 2. Context

Chief (one per installation) sees all Workspaces except isolated ones, plans from Project Documentation, delegates, creates Dynamic Agents, starts Workflows, settles Discussion deadlocks within limits and escalates otherwise (ADR 0015, 0016). Chief may propose publishing a Skill, accepting a Dynamic Agent, changing an Owner Rule, upgrading Skill or Agent visibility; only the Owner accepts (ADR 0012, 0016, 0028). The Chief model runs through a CLI or Ollama (ADR 0007), so its output is untrusted text until parsed into these types.

## 3. Scope (in)

- `ChiefAction` discriminated union (what a turn may request).
- `Proposal`, `ProposalKind`, `ProposalStatus`, `Escalation`, `EscalationReason`, `ChiefSummary`, `WorkspaceSummaryRow`, `ChiefConfig`.
- Error catalogue `chief.*`; four events.

## 4. Out of scope

- Behaviour: all other CHIEF tasks. Storage: `OVE_CHIEF014` (proposals), `OVE_CHIEF015` (escalations). Parsing and execution of actions: `OVE_CHIEF006`.

## 5. Detailed requirements

1. `ChiefAction` (strict, each with `actionId: string<=40` for idempotency in a turn and bounded fields; `schemaVersion: 1`):
   - `reply { text<=4000 }`;
   - `plan_from_docs { workspaceId, docRefs: Array<{ path, anchor? }> (max 20), tasks: Array<{ title<=120, description<=1000, docRef: { path, anchor?, gitCommit? } (REQUIRED), laneHint?, assigneeHint?, dependsOnTitles?: string[] }> (max 30), gaps: Array<{ kind: 'how'|'what', question<=300, proposedOption?<=300 }> (max 10) }`;
   - `delegate { taskId, agentId, narrowing?: { tools?: string[], timeoutSeconds?, maxMinutesPerTask? } }`;
   - `create_dynamic_agent { workspaceId, taskId, name<=60, role<=120, instructions<=4000, skillIds[], tools[], budget? }`;
   - `start_workflow { workspaceId, workflowId, inputRef? }`;
   - `record_decision { title, problem, alternatives[2..6], selectedOption, rationale, kind: 'how_gap'|'deadlock'|'selection', evidenceRefs? }`;
   - `start_discussion { workspaceId, runId?, branchId?, agenda<=600, participantAgentIds[2..8], rounds: 1..10, reason<=300 }` (Chief-initiated, pauses the Run branch and waits for the Owner);
   - `propose { proposal: ProposalDraft }`; `escalate { reason: EscalationReason, summary<=400, subjectRef? }`;
   - `update_board { taskId, toLane?, status?, note?<=300 }` (limited to Chief's Board authority);
   - `answer_status { scope: 'general'|'detailed', rows? }` (a structured status the Overmind renderer turns into text).
   Fields never include permission, rule or configuration mutations: those are proposals only. A contract test asserts no action carries `permissions`, `policy`, `allowedDirectories`, `approve`, `grant`.
2. `Proposal`: `{ id: EntityId<'prp'>, kind: 'skill_publish'|'skill_make_public'|'agent_promotion'|'agent_make_public'|'rule_change'|'doc_change', workspaceId?, subject: { type: 'skill'|'agent'|'rule'|'doc', id?: string, path?: string }, summary<=280, detail?<=2000 (plain text), rationale<=600, payload: kind-specific strict object (for `rule_change`: `{ ruleId?, newText<=500, action: 'create'|'edit'|'remove' }`), createdBy: { kind: 'chief' } | { kind: 'owner' } | { kind: 'agent', agentId }, status: 'pending'|'accepted'|'rejected'|'withdrawn'|'expired', createdAt, decidedAt?, decidedBy?: 'owner', decisionNote?<=300, sourceRunId?, sourceMessageId? }`.
3. `Escalation`: `{ id: EntityId<'esc'>, workspaceId?, reason: 'over_budget'|'doc_conflict'|'rule_conflict'|'missing_what'|'missing_doc_link'|'no_fallback_model'|'deadlock_out_of_bounds'|'plan_drift'|'chief_unavailable'|'other', summary<=400, subjectRef?: { type, id }, options?: Array<{ key, label<=80 }> (max 4), status: 'open'|'resolved'|'dismissed', resolution?: { optionKey?, note?<=300, resolvedAt }, raisedAt, raisedBy, runId?, taskId?, notifiedAt? }`.
4. `ChiefSummary`: `{ generatedAt, rows: Array<{ workspaceId, workspaceName, state: 'working'|'ok'|'paused'|'idle'|'attention', sentence<=200, counts?: { tasksDone, tasksTotal, blocked, waitingForOwner } }> (max 50), attention: { pendingApprovals, openEscalations, pendingProposals, waitingDiscussions } }`. Isolated Workspaces appear only when the Owner views them from inside (never in Chief's cross-Workspace summary).
5. `ChiefConfig`: `{ providerId, modelId, fallbackModel?: { providerId, modelId }, maxParallelAgentsOverride?: never, autonomy: { maxDecisionCostUnits: number>=0, allowHowGapDecisions: boolean (default true) } }`. Persisted via `ConfigStore` (ARCH005).
6. Error codes `chief.*`: `action_invalid` 422, `doc_link_required` 422, `outside_autonomy` 403 (details: the limit exceeded), `rule_conflict` 409 (details: ruleIds), `proposal_not_found` 404, `proposal_not_pending` 409, `owner_required` 403, `escalation_not_found` 404, `isolated_workspace` 403, `model_unavailable` 503 (retryable), `turn_timeout` 504 (retryable), `invalid_model_output` 502.
7. Events (persisted): `chief.proposal.created`, `chief.proposal.decided`, `chief.escalation.raised`, `chief.escalation.resolved` (ids and enums only, no texts).

## 6. Design notes

N/A, functionality only. (The mock "Chief proposes a new Skill: release-checklist ... Zobacz tresc / Akceptuj / Odrzuc" is a `Proposal(kind: skill_publish)`.)

## 7. Reuse

`EntityId`, `Result`, `defineErrors`, `defineEvent`; `OwnerRule`, `ProjectDocRef` (DATA); `AgentRef` (AGENT001).

## 8. Architecture and code placement

`packages/contracts/src/chief/*.ts`, `packages/contracts/src/proposal/*.ts` (separate folder because AGENT007 and SKILL009 also create proposals), errors and events as listed. Pure schemas.

## 9. Security and safety

The union is the capability boundary: a model turn can only request these actions, each re-validated and executed by use cases that check authority (autonomy, rules, visibility, permissions). `tasks[].docRef` is mandatory in the schema (ADR 0016 at the type level). Free-text fields are bounded and treated as data when displayed. No action can modify Owner Rules, permissions, approvals or configuration; `propose` creates only a pending Proposal.

## 10. Errors and edge cases

- Unknown action type from a newer model prompt version: `chief.action_invalid`, the action is dropped, other actions in the turn continue.
- Duplicate `actionId` in a turn: the second is ignored.
- Proposal payload not matching its kind: parse error.
- Escalation options with duplicate keys: parse error.

## 11. Acceptance criteria

- [ ] Every action schema accepts its fixture and rejects missing `docRef` in `plan_from_docs` tasks.
- [ ] Contract test proves no action schema contains permission-like keys.
- [ ] Proposal payload schemas cover all kinds, including `rule_change`.
- [ ] Error and event registries pass uniqueness and naming tests.
- [ ] JSON Schema snapshots committed; additive-only check passes.

## 12. Test plan

Contract tests with valid/invalid tables; schema key scan; fixtures from the mock (release-checklist proposal, "Payments: Stripe or P24?" discussion start). Command: `pnpm vitest run packages/contracts/src/chief packages/contracts/src/proposal`.

## 13. Parallelization notes

First in CHIEF; every other CHIEF task, SKILL009, AGENT007 and CHAT010 depend on it. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Proposals of all kinds share one table and contract (a single Owner inbox).
- ASSUMPTION: `maxDecisionCostUnits` default 0 means Chief makes no decision that increases cost beyond the existing Budget (see CHIEF003).
