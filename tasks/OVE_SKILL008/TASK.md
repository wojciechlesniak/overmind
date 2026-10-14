---
id: OVE_SKILL008
title: Implement Owner review of pending Skill versions (accept or reject)
area: SKILL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_PERM020, OVE_SKILL002, OVE_SKILL003, OVE_SKILL004, OVE_SKILL006]
soft_depends_on: []
provides: ["usecase:DecideSkillVersion", "usecase:AcceptSkillProposal", "usecase:RejectSkillProposal", "usecase:ListPendingSkillReviews"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "port:SkillRepository", "lib:skill-rules", "usecase:ScanSkillText"]
owns: ["packages/application/src/skill/review/**"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 13"]
adr_refs: [12, 15, 28]
---

# OVE_SKILL008: Implement Owner review of pending Skill versions (accept or reject)

## 1. Summary

The single gate through which imported and Chief-proposed Skill versions become active: the Owner reads the text and the scan, then accepts or rejects.

## 2. Context

Chief-written Skills are private proposals (ADR 0015, 0012) and imports are untrusted. Accepting is Owner-only. CHIEF014 calls `AcceptSkillProposal`/`RejectSkillProposal` from the Proposals list; the Skills view calls `DecideSkillVersion`. Both must run the same checks.

## 3. Scope (in)

- Accept/reject pending versions, re-scan on accept, hash verification, optional visibility choice on accept, listing of pending reviews.

## 4. Out of scope

- Creating proposals: SKILL009. Import: SKILL007. UI: SKUI.

## 5. Detailed requirements

1. `DecideSkillVersion { skillId, version, decision, visibility?, confirmFindings?: string[] , note? }` Owner-only; the version must be `pending_review` (`skill.not_pending_review` otherwise).
2. On accept: recompute content hash and compare with stored (`skill.hash_mismatch`, audited), rescan with the current scanner; if any `high` finding exists, require `confirmFindings` to list every high finding's `rule:line` key, else `skill.scan_blocking`. Rescan results replace the stored scan.
3. Accept sets status `accepted`, moves `currentVersion`, and applies `visibility` if given (default stays private; making public needs `confirmPublic`, same rule as SKILL005). Events: `skill.version_decided`.
4. Reject sets `rejected`; text retained for audit but excluded from resolution. A rejected import with no accepted versions leaves an archived-looking Skill hidden from the library by default filter.
5. `AcceptSkillProposal(proposalRef)` and `RejectSkillProposal(proposalRef)` are thin wrappers keyed by the Chief proposal id (stored in `source.proposalId`) used by CHIEF014; they refuse when the proposal does not match the pending version.
6. `ListPendingSkillReviews(workspaceId?)` returns summaries (no full text) with severity and source; the text is read with `GetSkill`.
7. Audit `{decision, skillId, version, hash, confirmedRules}`; notify event for the Owner inbox is emitted by CHIEF014 or the UI, not here.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`lib:skill-rules`, scanner, event/audit helpers.

## 8. Architecture and code placement

`packages/application/src/skill/review/{decide-skill-version.ts,proposal-wrappers.ts,list-pending.ts}`.

## 9. Security and safety

Accept is a security decision: Owner-only actor check, hash re-verification (detects tampering between review and accept), scanner re-run, explicit confirmation of high findings, no auto-accept path for any non-Owner actor. Telegram cannot accept Skills (ASSUMPTION).

## 10. Errors and edge cases

- Two simultaneous decisions: second gets `skill.not_pending_review`.
- Newer pending version exists: older pending is decided independently; accepting an older version never lowers `currentVersion`.
- Proposal withdrawn by Chief: reject allowed, accept refused.
- Hash mismatch: refuse and audit as integrity violation.

## 11. Acceptance criteria

- [ ] Non-Owner actors refused.
- [ ] High findings need explicit confirmation.
- [ ] Hash tamper detected.
- [ ] Pending versions never appear in `getAcceptedVersion`.
- [ ] Wrappers used by CHIEF014 behave identically to the direct use case.

## 12. Test plan

Unit tests with fakes; tamper test via direct repository mutation; contract test for wrapper equivalence. Command: `pnpm vitest run packages/application/src/skill/review`.

## 13. Parallelization notes

Parallel with SKILL007/009. CHIEF014 depends on the wrapper capability names.

## 14. Open questions and assumptions

- ASSUMPTION: confirmation of high findings is per finding key.
- OPEN: should the Owner be able to edit text before accepting a proposal? Current rule: edit creates a new Owner version via SKILL004.
