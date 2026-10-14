---
id: OVE_PERM012
title: Implement Approval override administration (lift the requirement locally only)
area: PERM
kind: security
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_PERM006, OVE_PERM008, OVE_PERM009, OVE_PERM020]
soft_depends_on: [OVE_PERM024]
provides: ["usecase:ApprovalOverrideAdmin", "port:ApprovalOverrideRepository", "port:ApprovalOverrideReader", "event:override.changed"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "usecase:RequireLocalProof"]
owns: ["packages/application/src/perm/approval-overrides/**", "packages/application/src/ports/ApprovalOverrideRepository.ts", "packages/application/src/ports/ApprovalOverrideReader.ts", "packages/contracts/src/events/override-changed.event.ts"]
reads: ["packages/domain/src/perm/approval-rules/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.10"]
adr_refs: [21, 3, 6]
---

# OVE_PERM012: Implement Approval override administration

## 1. Summary

Use cases and ports for the Owner's ability to lift the Approval requirement for a selected action class (for example let Agents `git push` alone), globally or per Workspace, and to restore it. Lifting needs a Local Approval proof; restoring does not. Neither Telegram, nor Chief, nor an Agent can do either.

## 2. Context

ADR 0021: the Owner can lift the Approval requirement in Owner Rules, but only locally, never from Telegram. SPEC 16.10: no Agent and no Telegram message removes an Approval requirement. The Owner Rule text itself belongs to DATA/CHIEF (`OwnerRule.consentOverrides`); the Rules UI calls PERM to change overrides so the security logic stays in one place.

## 3. Scope (in)

- `LiftApprovalRequirement({ actionClass, workspaceId|null, ownerRuleId?, localProof })`, `RestoreApprovalRequirement({ overrideId })`, `ListApprovalOverrides({ workspaceId? })`.
- Ports `ApprovalOverrideRepository` (write side) and `ApprovalOverrideReader` (read side used by `CheckAccess`, ISP).
- Event `override.changed`.

## 4. Out of scope

Class metadata and `requiresApproval` (PERM006), SQLite repository (PERM024), routes (PERM026), UI (APPRUI/SETUI), the Owner Rule text/versioning (DATA/CHIEF).

## 5. Detailed requirements

1. **Lift** requires `authorize(principal,'override.lift')` (Owner desktop local) and `RequireLocalProof` with args `{ actionClass, workspaceId }`; the class must be `liftable` (PERM006) else `perm.override_not_allowed`. Creates `ApprovalOverride`, version-independent, emits `override.changed {kind:'lifted', actionClass, workspaceId}`, writes audit `perm.override.lifted` (result `succeeded`; `details`: class, workspace display name).
2. **Restore** requires an Owner principal (desktop or other), no proof: removing an override tightens permissions. Emits `override.changed {kind:'restored'}`. Pending operations that relied on the override are re-evaluated at execution time (PERM014 re-checks).
3. **Scope rules:** `(class, workspaceId)` unique; a global override (`null`) and a Workspace override may coexist; restoring the global override does not remove Workspace overrides. Isolated Workspaces behave like any other for overrides (ADR 0028 changes nothing).
4. **Limits:** max 7 global + 7 per Workspace overrides (one per class).
5. **Owner Rule linkage:** `ownerRuleId` is optional metadata so the Rules UI can show which Owner Rule produced the override; PERM does not validate rule text. Deleting an Owner Rule (DATA) must call `RestoreApprovalRequirement` (documented contract for DATA/CHIEF; an event subscriber `owner_rule.deleted` is specified here: if the rule id matches, the override is restored).
6. **Reader port** returns a snapshot list for a Workspace including globals; used by `CheckAccess` with the cache invalidated on `override.changed`.
7. Every attempt that fails authorisation (Telegram, Agent, Chief, missing/invalid proof) writes a violation audit (`perm.override.lift_rejected`) with reason code only.

## 6. Design notes

N/A, functionality only. UI copy for the confirmation modal is specified in SETUI/APPRUI ("This lets agents push without asking. Confirm on this computer.").

## 7. Reuse

`ACTION_CLASSES`, `requiresApproval` (PERM006), `authorize` (PERM008), `RequireLocalProof` (PERM009), `AppendAudit`, `EventBus`.

## 8. Architecture and code placement

`packages/application/src/perm/approval-overrides/{lift.ts,restore.ts,list.ts}`; ports under `packages/application/src/ports/`; ISP split between read and write ports. Pure checks in domain (PERM006).

## 9. Security and safety

Lifting is a permission-widening operation by definition. Controls: local proof bound to `{actionClass, workspaceId}`; non-liftable classes; no payload field for channel/principal; audit on success and on rejection; restore always available so the Owner can recover quickly; the effect is evaluated at execution time, not cached beyond the invalidation. A prompt-injected Agent that asks the Owner in chat to "just allow pushes" still needs the Owner to open settings and confirm on the desktop.

## 10. Errors and edge cases

- Lift when already lifted: idempotent no-op (no new row).
- Lift `payment`: `perm.override_not_allowed`.
- Restore an unknown id: `perm.not_found`.
- Lift for a Workspace that does not exist: `data.not_found`; Workspace deleted later: overrides removed by the deletion saga (DATA calls `RestoreApprovalRequirement` for each, or the repository cascades).
- Proof for `git_push` global reused for `git_push` Workspace A: mismatch.

## 11. Acceptance criteria

- [ ] Lift from Telegram/Agent/Chief/`owner other` is rejected and audited.
- [ ] Lift with a valid proof creates the override; the same proof cannot lift a second class.
- [ ] After lift, `requiresApproval('git_push', overrides, ws)` is false; after restore it is true on the next check.
- [ ] Non-liftable class cannot be lifted by any principal.
- [ ] Deleting the linked Owner Rule restores the requirement.

## 12. Test plan

Use case tests with fakes; authorisation matrix over principals; event-driven restore test; concurrency test (lift/restore interleaving) with the in-memory repository. `pnpm vitest run packages/application/src/perm/approval-overrides`.

## 13. Parallelization notes

Parallel with PERM011, PERM013. `CheckAccess` (PERM010) needs only the Reader port (stub OK).

## 14. Open questions and assumptions

- ASSUMPTION: overrides do not auto-expire. A "lift for this Run only" is not offered because per-action Approvals already exist.
- Open: whether lifting `new_domain` should accept a host pattern (for example allow `*.npmjs.org` permanently). Default: not in MVP; a per-host permanent allowance is a network capability change via `policy.widen`.
