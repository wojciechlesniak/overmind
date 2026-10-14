---
id: OVE_VIS007
title: Implement Chief visibility proposals (propose, list, accept, reject)
area: VIS
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_DATA001, OVE_DATA002, OVE_DATA003, OVE_PERM020, OVE_VIS002, OVE_VIS006]
soft_depends_on: [OVE_VIS008]
provides: ["usecase:ProposeVisibilityChange", "usecase:DecideVisibilityProposal", "contract:VisibilityProposal", "port:VisibilityProposalRepository", "event:visibility.proposed", "table:vis_proposals"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "usecase:AppendAudit", "port:UnitOfWork", "lib:sqlite-core", "lib:migration-runner"]
owns: ["packages/contracts/src/visibility/proposal.ts", "packages/application/src/visibility/proposals/**", "packages/application/src/ports/VisibilityProposalRepository.ts", "packages/adapters/sqlite/src/vis/proposals/**", "packages/adapters/sqlite/migrations/V202610141100__OVE_VIS007__create_vis_proposals.sql", "packages/testing/src/fakes/MemoryVisibilityProposalRepository.ts", "packages/contracts/src/events/visibility-proposed.event.ts", "packages/contracts/src/audit/actions/vis-proposal.actions.ts", "packages/contracts/src/kernel/id-prefixes/vis.ts"]
reads: ["packages/application/src/visibility/apply-change.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 4"]
adr_refs: [28, 15, 12]
---

# OVE_VIS007: Implement Chief visibility proposals

## 1. Summary

The Chief may only propose making an item Public (for example a Skill that proved itself in several Runs). A proposal is a stored request the Owner accepts or rejects; accepting executes the normal change through `ApplyVisibilityChange` as the Owner. Chief never changes visibility.

## 2. Context

ADR 0028: only the Owner changes visibility; Chief may propose. SPEC 8: Chief proposes Skills based on successful repeatable processes; they enter the library only after Owner acceptance and a Chief-proposed Skill is Private by default. ADR 0015: Chief acts within Budget and docs but never widens exposure alone.

## 3. Scope (in)

Proposal entity, state machine (`pending, accepted, rejected, expired, superseded`), use cases, repository + migration + fake, event.

## 4. Out of scope

Routes (VIS008 hosts them), UI (SKUI/AGUI), Chief logic deciding when to propose (CHIEF).

## 5. Detailed requirements

1. `VisibilityProposal = { id: EntityId<'vpr'>, ref: {kind,id}, from, to, rationale: string (<=500, untrusted text), evidence: { runIds: EntityId<'run'>[] (max 10) }, proposedBy: 'chief', proposedAt, status, decidedAt?, expiresAt }`. New prefix `vpr` registered in `kernel/id-prefixes/vis.ts` (owned here).
2. `ProposeVisibilityChange` accepts principal `chief` only (and system for tests); allowed proposals: `private -> public` only. Proposing for a Dynamic Agent, an item in an isolated Workspace, or an item already public is refused with the VIS002 error. Dedupe: one pending proposal per item; limit 10 pending in total; a rejected proposal for the same item cannot be re-proposed for 30 days.
3. Expiry 14 days (ASSUMPTION). Proposals auto-supersede when the item changes visibility by other means.
4. `DecideVisibilityProposal({ principal, id, decision })`: Owner desktop only (Telegram can see it but not decide; ASSUMPTION). Accept calls `ApplyVisibilityChange` with the stored target and the **current** config version; the result (success/blocked) is returned; on failure the proposal stays pending with the error visible. Reject marks rejected.
5. `rationale` is untrusted text: stored bounded, shown as plain text, never executed or interpreted, never included in prompts without SEC004 wrapping.
6. Events `visibility.proposed` (id, ref, to) for NOTIF (quiet notification, no sound); audit actions `vis.proposal.created|accepted|rejected|expired`.
7. Table `vis_proposals` (STRICT) with a partial unique index on `(kind, item_id) WHERE status='pending'`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ApplyVisibilityChange` (VIS006), rules (VIS002), standard ports.

## 8. Architecture and code placement

Use cases in `packages/application/src/visibility/proposals/`; adapter in `packages/adapters/sqlite/src/vis/proposals/`.

## 9. Security and safety

Chief cannot change visibility even indirectly: acceptance executes under the Owner principal derived from the transport at decision time, not stored principal data. Proposals cannot be forged by agents (principal check). Rationale text is untrusted. Limits prevent spam. Accepting re-validates everything at decision time (state may have changed).

## 10. Errors and edge cases

Item deleted before decision: proposal `superseded`. Item became used elsewhere? Publishing is never blocked by usage. Two accepts: CAS, one wins.

## 11. Acceptance criteria

- [ ] Only Chief can create; agents/Telegram/owner cannot create through the use case.
- [ ] Only the desktop Owner can accept/reject; acceptance results in a new config version.
- [ ] Re-proposal of a rejected item within 30 days is refused.
- [ ] Isolated-Workspace and Dynamic Agent proposals are refused.
- [ ] Rationale never alters any decision (test with injection strings).

## 12. Test plan

Use case tests, repository contract tests (CAS, partial unique index). `pnpm vitest run packages/application/src/visibility/proposals packages/adapters/sqlite/src/vis/proposals`.

## 13. Parallelization notes

Parallel with VIS008.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram cannot decide proposals; 14-day expiry; 30-day cool-down.
