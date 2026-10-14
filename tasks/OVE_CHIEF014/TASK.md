---
id: OVE_CHIEF014
title: Implement the Proposal store and Owner-only acceptance flow
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT006, OVE_ARCH009, OVE_CHIEF001, OVE_CHIEF006, OVE_DATA012, OVE_DATA015, OVE_NOTIF004, OVE_PERM020, OVE_SKILL008]
soft_depends_on: [OVE_AGENT007]
provides: ["port:ProposalRepository", "usecase:CreateProposal", "usecase:DecideProposal", "usecase:ListProposals", "table:proposals", "api:proposals.list", "api:proposals.decide", "participant:proposals-cascade"]
needs: ["usecase:AcceptDynamicAgent", "usecase:DeclineDynamicAgent", "usecase:AcceptSkillProposal", "usecase:RejectSkillProposal", "usecase:ChangeAgentVisibility", "usecase:ApplyOwnerRuleChange", "port:WorkspaceCascadeParticipant", "usecase:Notify", "usecase:AppendAudit", "lib:route-module"]
owns: ["packages/application/src/chief/proposals/**", "packages/application/src/ports/ProposalRepository.ts", "packages/adapters/sqlite/src/chief/proposal-repository.ts", "packages/adapters/sqlite/migrations/V202610141410__OVE_CHIEF014__proposals.sql", "packages/gateway/src/routes/chief/proposals.route.ts"]
reads: ["packages/contracts/src/proposal/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 4", "SPECIFICATION 16.3"]
adr_refs: [16, 12, 28, 3]
---

# OVE_CHIEF014: Implement the Proposal store and Owner-only acceptance flow

## 1. Summary

The single inbox of things only the Owner may accept: publish a Skill, keep a Dynamic Agent, make an Agent or Skill public, change an Owner Rule or Documentation. Chief, Agents and the "Change Rule" action only create Proposals; acceptance is an Owner action on the desktop and executes the real change through the owning area's use case.

## 2. Context

ADR 0012: new Skills enter the library after Owner acceptance. ADR 0016: only the Owner changes Rules and Documentation; Chief may only propose. ADR 0028: Chief may propose making things public. Mock `Skille.png`: "Chief proposes a new Skill: release-checklist ... See content / Accept / Reject". Mock `Agenci.png`: Dynamic Agent card "Keep as permanent / Delete". The Owner cannot be bypassed even if a model is compromised.

## 3. Scope (in)

- Table, repository port and adapter for `Proposal` (CHIEF001).
- `CreateProposal` (callers: Chief handler `propose`, SKILL009, AGENT007, CHAT010 rule change), `DecideProposal` (Owner), `ListProposals`, expiry job.
- Routes `GET /v1/proposals?workspaceId=&status=`, `POST /v1/proposals/{id}/decision`.
- Workspace cascade participant `proposals-cascade`.

## 4. Out of scope

- The effect executors: SKILL (Skill acceptance), AGENT007 (Dynamic Agent), AGENT006 (visibility), DATA/WSPACE (Owner Rule changes). Proposal UI: SKUI, AGUI, WSPACE.

## 5. Detailed requirements

1. Table `proposals(id PK, kind, workspace_id NULL, subject_type, subject_id NULL, subject_path NULL, summary, detail, rationale, payload_json, created_by_json, status, created_at, decided_at NULL, decided_by NULL, decision_note NULL, source_run_id NULL, source_message_id NULL, expires_at NULL)` with indexes on `(status, workspace_id)` and `(kind, subject_id)`; at most one pending Proposal per `(kind, subject_id)` (unique partial index) so repeated Chief suggestions do not spam.
2. `CreateProposal`: validates payload by kind; creator may be Chief, an Agent (only through `OVE_AGENT014` flows), or the Owner; sets `expires_at` (default 30 days, ASSUMPTION); emits `chief.proposal.created`, `Notify(kind: 'proposal')` once per new Proposal (not for refreshes), posts an informational part into the Chief conversation. Rate: max 5 new pending Proposals per day created by Chief per Workspace (guards spam); excess is dropped with a log and a counter.
3. `DecideProposal(id, decision: 'accept'|'reject', note?)`: caller MUST be the Owner on the desktop channel (`chief.owner_required` or `perm.local_only` for Telegram: even visibility and Skill proposals are desktop-only because they change the library and rules). On `accept`, the executor for the kind runs inside the same unit of work where possible: `skill_publish` -> `AcceptSkillProposal` (SKILL009; private by default, Owner may choose public), `skill_make_public` and `agent_make_public` -> visibility change use cases, `agent_promotion` -> `AcceptDynamicAgent`/`DeclineDynamicAgent`, `rule_change` -> `ApplyOwnerRuleChange` (DATA, the only writer of Rules), `doc_change` -> record an Owner task "edit this document"; Overmind never edits Documentation itself (ADR 0016: only the Owner changes it).
4. If the executor fails, the Proposal stays `pending` and the error is returned; no partial state.
5. Reject sets `rejected` and prevents the same `(kind, subject)` Proposal from being re-created by Chief for 14 days (cool-down) unless the Owner asks.
6. `ListProposals` filtered by Workspace scope (VIS): Proposals of private subjects of other Workspaces are never returned.
7. Expiry job: pending Proposals older than `expires_at` become `expired` (no effect, no deletion); Dynamic Agent proposals never expire (the Agent stays proposed_for_keep).
8. Cascade participant `proposals-cascade` (id `chief-proposals`, `WorkspaceCascadeParticipant`): deletes Proposals of the deleted Workspace and `expired`-marks references; reports counts for the delete preview.
9. Audit entries for create (by whom), decision, executor result.
10. No endpoint lets anyone but the Owner decide; the route requires an owner session and re-checks the channel.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Contracts of CHIEF001; executors from AGENT/SKILL/DATA; `Notify`; `WorkspaceCascadeParticipant` (DATA012); `UnitOfWork`.

## 8. Architecture and code placement

`packages/application/src/chief/proposals/*.usecase.ts`, executors registry via multi-token (`ProposalExecutor` per kind, so new kinds add a file), SQLite adapter in `packages/adapters/sqlite/src/chief/`, route in `packages/gateway/src/routes/chief/`.

## 9. Security and safety

The inbox is the choke point that stops a compromised model from changing anything that matters: Rule changes, Skill library, visibility. Defence layers: only Owner on desktop can accept; creation rate limits and uniqueness; payload schemas strict; executors enforce their own authority checks again; Telegram cannot accept; full audit. Proposal `detail` text is plain text, displayed with the same sanitisation as chat.

## 10. Errors and edge cases

- Accepting an expired Proposal: `chief.proposal_not_pending`.
- Two windows accept simultaneously: first wins; second gets `proposal_not_pending`.
- Subject deleted before decision: Proposal auto-withdrawn.
- Executor partially applied then fails: executors are transactional; test with fault injection.
- Proposal spam by a loop: dedupe plus daily cap.

## 11. Acceptance criteria

- [ ] A Skill proposal accepted by the Owner on desktop adds the Skill (private by default) via SKILL; from Telegram it is refused.
- [ ] A `rule_change` is applied only through `ApplyOwnerRuleChange` and only after Owner acceptance.
- [ ] Duplicate pending `(kind, subject)` is not created twice.
- [ ] Rejected Proposal cannot be re-created by Chief within the cool-down.
- [ ] Executor failure leaves the Proposal pending.
- [ ] Workspace deletion removes its Proposals and reports counts.
- [ ] A static test asserts no code path other than `DecideProposal` calls the executors.

## 12. Test plan

Repository contract tests; use case tests with fake executors; fault-injection test; channel test; cascade test with DATA012 harness. Command: `pnpm vitest run packages/application/src/chief/proposals packages/adapters/sqlite/src/chief`.

## 13. Parallelization notes

Executors by other areas plug in through the `ProposalExecutor` multi-token. Hotspot: none; one migration file.

## 14. Open questions and assumptions

- ASSUMPTION: 30-day expiry, 14-day cool-down after rejection, 5 Chief proposals per day per Workspace.
- ASSUMPTION: `ApplyOwnerRuleChange` is provided by DATA014 (name to be confirmed by the linker).
