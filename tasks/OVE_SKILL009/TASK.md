---
id: OVE_SKILL009
title: Implement Chief-written Skill proposals
area: SKILL
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_CHIEF006, OVE_CHIEF014, OVE_DATA002, OVE_PERM020, OVE_SKILL003, OVE_SKILL004, OVE_SKILL006]
soft_depends_on: []
provides: ["usecase:ProposeSkill", "handler:chief.propose_skill"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "port:SkillRepository", "usecase:ScanSkillText", "usecase:CreateProposal", "lib:chief-action-dispatcher"]
owns: ["packages/application/src/skill/propose/**"]
reads: ["packages/contracts/src/skill/**", "packages/contracts/src/chief/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 8"]
adr_refs: [12, 15, 1]
---

# OVE_SKILL009: Implement Chief-written Skill proposals

## 1. Summary

Lets the Chief write a Skill for the Owner: stored as a private `pending_review` version with a Proposal in the Owner's list. Nothing is active until the Owner accepts.

## 2. Context

ADR 0012 and 0015: the Chief may draft Skills but cannot publish or activate them, and never fetches from the internet. The Chief's `propose` action (CHIEF001) carries typed fields; this use case is the handler for the `skill` proposal kind.

## 3. Scope (in)

- Handler for a `propose` action with `kind: 'skill'` or a new version of an existing Skill.
- Linking the proposal id into `source.proposalId`.

## 4. Out of scope

- Accept/reject: SKILL008. Proposal store: CHIEF014.

## 5. Detailed requirements

1. Input comes only from the typed `ChiefAction` (name, description, instructions, requiredTools, reason, optional `basedOnSkillId`); the dispatcher passes an actor `{kind:'chief', turnId}`.
2. Creates a Skill (source `chief`, visibility `private`, `ownerWorkspaceId` = the turn's Workspace) with version 1 `pending_review`, or appends a pending version to an existing Skill the Chief can see (private or public; public Skills are never edited in place).
3. Runs the scanner; `high` findings reject the proposal immediately with `skill.scan_blocking` and a Chief-visible safe message (the Chief can redraft).
4. Creates a Proposal via `CreateProposal` (kind `skill`, payload ids only, summary text <=300 chars) and notifies the Owner through the Proposals flow.
5. Limits: max 5 pending Chief Skill proposals per Workspace; Skill text <=20000; per-day cap 20 (config).
6. Instruction text drafted by the Chief may be derived from untrusted documentation: provenance flag `derivedFromExternal: boolean` is recorded when the turn context included untrusted content, and shown to the Owner at review.
7. Never sets `requiredTools` to grant anything; documented as metadata. The Chief cannot choose `public`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`CreateProposal`, scanner, dispatcher registration pattern from CHIEF006.

## 8. Architecture and code placement

`packages/application/src/skill/propose/propose-skill.ts`; registration in the Chief dispatcher module via `handler:chief.propose_skill`.

## 9. Security and safety

Chief output is a typed action; the Skill text is model-produced and so untrusted until the Owner accepts. The handler cannot activate, assign or publish. The Chief-origin and derived-from-external flags give the Owner context. Caps stop proposal spam.

## 10. Errors and edge cases

- Duplicate name pending: `skill.name_taken`.
- Workspace deleted mid-turn: handler fails with `workspace.not_found`.
- Proposal creation fails after Skill insert: single transaction, rolled back.

## 11. Acceptance criteria

- [ ] Created Skill is private and pending.
- [ ] No path activates or assigns without the Owner.
- [ ] High scan finding rejects.
- [ ] Caps enforced.
- [ ] Flags stored.

## 12. Test plan

Unit tests with fake dispatcher input; adversarial instruction fixtures (injection inside Skill text). Command: `pnpm vitest run packages/application/src/skill/propose`.

## 13. Parallelization notes

After CHIEF014 (Proposal store). Parallel with SKILL010.

## 14. Open questions and assumptions

- ASSUMPTION: Chief edits to public Skills are new pending versions needing Owner acceptance.
- ASSUMPTION: derivedFromExternal flag is set by CHIEF005 context metadata (cross-task).
