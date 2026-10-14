---
id: OVE_ONB005
title: "Implement ProvisionFirstFolder: Workspace, Allowed Directory and policy"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA011, OVE_DATA012, OVE_ONB003, OVE_ONB004, OVE_PERM002, OVE_PERM008, OVE_PERM011, OVE_PERM020, OVE_PERM031]
soft_depends_on: []
provides: ["usecase:ProvisionFirstFolder", "contract:LocalActionOnboarding"]
needs: ["port:LocalApprovalGate", "usecase:RegisterAllowedDirectory", "usecase:PermissionPolicyAdmin", "usecase:CreateWorkspace", "usecase:DeleteWorkspace", "usecase:AppendAudit", "contract:OwnerOperation"]
owns: ["packages/application/src/onboarding/folders/provision-first-folder.ts", "packages/contracts/src/perm/local-actions/onboarding.ts", "tasks/_proposals/OVE_ONB005-local-action-onboarding.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [3, 10, 21, 28]
---

# OVE_ONB005: Implement ProvisionFirstFolder: Workspace, Allowed Directory and policy

## 1. Summary

Implements the transaction behind step 1's 'Dalej': it creates the first Workspace (named after the folder), registers the chosen folder as its Allowed Directory with the chosen rights, creates its permission policy and records the step as done, all idempotently and only with a Local Approval proof.

## 2. Context

Agents see only listed folders; no folder means no access (SPEC 16.1). Step 2 needs an environment to run the isolation test and the CLI login terminal, and an environment belongs to a Workspace (PROV014: login happens in the Environment of a chosen Workspace) mounted from its policy. So the Workspace and its first Allowed Directory must exist before step 2: step 1 creates a provisional Workspace named after the folder ('aplikacja-rezerwacji') and step 3 lets the Owner rename it and confirm. Granting a directory is a permission-widening operation, so it needs a Local Approval (ADR 0003, PERM008/009): the Owner clicking 'Dalej' on the machine is the local confirmation. The default list of consents (ADR 0021) is applied unchanged.

## 3. Scope (in)

- Use case `ProvisionFirstFolder` composing `CreateWorkspace` (DATA011), `RegisterAllowedDirectory` (PERM002) and the policy administration (PERM011) behind `LocalApprovalGate` (PERM031).
- Registration of the local action id `onboarding.provision_first_folder` in `packages/contracts/src/perm/local-actions/onboarding.ts` (PERM031 registry file for this area).
- Idempotency and replacement semantics when the Owner goes back and picks another folder.
- Writing the step result through `OnboardingStepWriter` (ONB003).
- Audit entries via the PERM audit use case.

## 4. Out of scope

- The picker UI and proof creation call (ONB013).
- Folder validation (ONB004; re-run here as a second line).
- Adding further folders later (Workspace settings, WSPACE/PERM).

## 5. Detailed requirements

1. **Input.** `{ folderId, rights: { read: true, write: boolean, execute: boolean }, proof }` (ONB001). Header `Idempotency-Key`. Principal must be the desktop Owner session (`PERM008` matrix: operation `onboarding.provision_first_folder` allowed for `owner:desktop` only, `requiresLocalProof: true`, `telegramAllowed: false`, `agentMayFile: false`).
2. **Steps (single use-case transaction where the ports allow, otherwise compensated):** (1) resolve `folderId` through the registry; if expired -> `onboarding.folder_rejected(expired)` with a hint to re-select; (2) re-validate with `FolderPolicy` and realpath (second line of defence against TOCTOU); (3) `LocalApprovalGate.require({ principal, action: 'onboarding.provision_first_folder', target: { kind: 'path', id: <opaque folder id> }, args: { read, write, execute }, proof })`; (4) if the onboarding state already has a provisioned Workspace for this installation: replace its Allowed Directory (see replacement) else create the Workspace via `CreateWorkspace` with `name = folder label`, `isolated = false` (visibility default per ADR 0028) and a new policy; (5) `RegisterAllowedDirectory` with the canonical path, rights and `addedVia: 'wizard'`, `primary: true`; (6) apply the default Approval consent list (ADR 0021: git push, delete, new domain require Approval) by the policy admin defaults (no overrides); (7) write the step result `{ done: true, workspaceId, directoryId, rights, displayPath }`; (8) audit `onboarding.folder_provisioned` (details allowlist: Workspace id, rights, display path).
3. **Rights rules.** `read` is always true. Defaults from the mock: read true, write true, execute false. `write && execute` is allowed but the audit entry flags `warning: write_execute` (the UI shows the amber warning). Rights are stored exactly as selected; no automatic widening later.
4. **Replacement when the Owner goes back.** If a Workspace was already provisioned in this wizard and the Owner picks a different folder or rights: update the policy (PERM011 diff) removing the previous wizard-added directory and adding the new one under a NEW Local Approval (any change that widens requires proof; narrowing also uses the same operation for simplicity). The Workspace id is stable. If the Workspace already has Runs or other directories (cannot happen before completion) the use case refuses with `onboarding.folder_already_provisioned`.
5. **Idempotency.** Same key and body returns the stored result; same folder and rights without a key is a no-op returning the existing result (no second Workspace).
6. **Failure compensation.** If registration fails after the Workspace was created, the use case deletes the empty Workspace it created in this call (DATA012 delete with the cascade participants) so no orphan remains; if compensation fails, the next call finds the Workspace with no directory and repairs by registering (the state machine handles it).
7. **No wizard bypass of limits.** Directory count and overlap rules (PERM002) apply; errors map to `onboarding.folder_rejected` with the PERM reason.
8. **Events.** `workspace.created` (DATA), `policy.changed` (PERM) and `onboarding.state_changed`; the sandbox layer reacts to `policy.changed` for mount plans (PERM017), nothing starts yet.
9. **Proposal files.** `tasks/_proposals/OVE_ONB005-local-action-onboarding.md` documenting the new action id and the `OwnerOperation` entry for PERM008.

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- `LocalApprovalGate`/`AllowedDirectoryReader` (PERM031), `RegisterAllowedDirectory` (PERM002), `PermissionPolicyAdmin` (PERM011), `CreateWorkspace` and `DeleteWorkspace` (DATA011/012), `AppendAudit` (PERM020), `OnboardingStepWriter` (ONB003), `FolderIdRegistry` (ONB004).

## 8. Architecture and code placement

`packages/application/src/onboarding/folders/provision-first-folder.ts`, `packages/contracts/src/perm/local-actions/onboarding.ts`, proposal file. Application layer orchestrating other areas' use cases through their ports; no SQL here.

## 9. Security and safety

- Local Approval proof is mandatory and bound to the folder id and rights; a replayed or foreign proof is rejected by PERM009.
- Telegram, agents and Chief cannot invoke this operation (principal check in the matrix).
- Second validation at provisioning time defends against a path swapped to a symlink after suggestion.
- The default consent list is not weakened; no Approval override is created by the wizard.
- Audit entry contains no canonical path beyond the display path, no content.

## 10. Errors and edge cases

- Folder id expired: error with hint; UI re-validates via the picker.
- Folder removed between validation and provisioning: `not_a_directory`.
- Two clicks on Next: idempotency key returns the same result.
- Policy admin refuses (overlap with an existing directory): error mapped, no Workspace left behind.
- Engine killed after Workspace creation: repair on next call.
- Name collision for the Workspace name: DATA011 suffixes with ` 2` (rule of CreateWorkspace) and the rename happens in step 3.

## 11. Acceptance criteria

- [ ] Given a valid folder and proof then a Workspace, policy and primary Allowed Directory exist with rights read+write and no execute.
- [ ] Given no proof then `perm.local_approval_required` and nothing is created.
- [ ] Given the Owner returns and picks another folder then the previous directory is replaced and the Workspace id is unchanged.
- [ ] Given a failure after Workspace creation then the empty Workspace is removed.
- [ ] Given the same request twice then one Workspace exists.

## 12. Test plan

- Use-case tests with fakes for every port (success, compensation, replacement, idempotency, principal matrix).
- Security cases in the PERM abuse suite (proof reuse, wrong target).
- Commands: `pnpm vitest run packages/application/src/onboarding/folders`.

## 13. Parallelization notes

After ONB003, ONB004, PERM002/009/011/031 and DATA011. Parallel with ONB006/008.

## 14. Open questions and assumptions

- ASSUMPTION: the click on 'Dalej' is accepted by PERM009 as the local confirmation (the UI creates the proof with `perm.local-confirmation.create` immediately before the call). If PERM009 requires a dedicated confirmation dialog, ONB013 adds it.
- OPEN: the provisional Workspace takes the folder name; the Owner confirms or renames in step 3; alternatively create the Workspace only at step 3 and run step 2 in a 'bootstrap' environment (rejected: more mount plan special cases).
- OPEN: `addedVia: 'wizard'` is a PERM002 field; confirm it exists or use `source`.
