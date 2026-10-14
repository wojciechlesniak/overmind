---
id: OVE_PERM031
title: Provide LocalApprovalGate and AllowedDirectoryReader ports for other areas
area: PERM
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_PERM009, OVE_PERM024]
soft_depends_on: []
provides: ["port:LocalApprovalGate", "port:AllowedDirectoryReader", "usecase:ListAllowedDirectories"]
needs: ["port:Clock"]
owns: ["packages/application/src/ports/LocalApprovalGate.ts", "packages/application/src/ports/AllowedDirectoryReader.ts", "packages/application/src/perm/local-approval-gate.ts", "packages/application/src/perm/allowed-directory-reader.ts", "packages/testing/src/fakes/FakeLocalApprovalGate.ts"]
reads: ["packages/application/src/perm/local-confirmation/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 11"]
adr_refs: [3, 6, 21]
---

# OVE_PERM031: Provide LocalApprovalGate and AllowedDirectoryReader

## 1. Summary

Two small ports so other areas never reach into PERM internals: `LocalApprovalGate` lets any use case (Workspace deletion, Skill import, backup folder change, Owner Rule edit) demand a Local Approval bound to an action and target; `AllowedDirectoryReader` lets DATA, WSPACE, ONB and BACKUP read a Workspace's Allowed Directories.

## 2. Context

ENGINE and DATA need the Local Approval boundary (PERM009) in a stable, minimal form: `require({action,target})` returns a grant bound to that action and target. Cross-area reads go through ports (PLAN 6).

## 3. Scope (in)

Port definitions, implementations delegating to PERM009 and PERM024, a fake.

## 4. Out of scope

Proof issuing route and store (PERM009), directory mutation (PERM011).

## 5. Detailed requirements

1. `LocalApprovalGate.require(input: { principal: Principal, action: string /* registered OwnerOperation or a registered external action id */, target: { kind: string, id: string }, args?: Record<string,JsonPrimitive>, proof?: LocalProof }): Promise<Result<LocalGrant, AppError>>` where `LocalGrant = { action, target, argsHash, consumedAt }`. It authorises the principal, consumes the proof atomically and binds hash(action, target, args). Failure: `perm.local_approval_required`. External areas register their action ids (`workspace.delete`, `skill.import`, `backup.folder.change`, `owner_rule.edit`) in a registry file under `packages/contracts/src/perm/local-actions/<area>.ts` (one file per area, no shared edits); each is `requiresLocalProof: true`, Telegram never permitted.
2. Unknown action ids are denied.
3. `AllowedDirectoryReader`: `list(workspaceId): Result<{entries: AllowedDirectoryView[], policyVersion}>`, `has(workspaceId): boolean` (used by ONB: wizard must not finish without a folder), `getPrimary(workspaceId)`. Views contain canonical path, display path, rights, primary; read-only; no mutation methods.
4. The reader never returns directories of other Workspaces; callers pass a workspace id they are allowed to see (checked by the gateway scope).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PERM009 `RequireLocalProof`, PERM024 repositories.

## 8. Architecture and code placement

Ports one file each; thin implementations in `packages/application/src/perm/`.

## 9. Security and safety

A single audited gate prevents each area from inventing its own weaker local check; registry makes the list of local-only actions reviewable. Read port exposes no write path.

## 10. Errors and edge cases

Proof for different target: mismatch; action not registered: deny; Workspace without policy: empty list (no access).

## 11. Acceptance criteria

- [ ] Gate rejects Telegram, agents, Chief and missing/mismatched proofs for every registered action (table test).
- [ ] Unknown action denied.
- [ ] Reader returns empty list for a new Workspace and `has` is false.
- [ ] No mutation method exists on the reader (type test).

## 12. Test plan

Unit tests with the fake store and fake repository. `pnpm vitest run packages/application/src/perm/local-approval-gate`.

## 13. Parallelization notes

Other areas depend on the port names; merge early.

## 14. Open questions and assumptions

- ASSUMPTION: action registry files per area; ENGINE/DATA/SKILL/BACKUP add theirs.
