---
id: OVE_PERM016
title: Implement the Access Request flow with Run grants and permanent grants
area: PERM
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT018, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_ENGINE029, OVE_PERM008, OVE_PERM009, OVE_PERM010, OVE_PERM011, OVE_PERM015, OVE_PERM017, OVE_PERM018, OVE_PERM020, OVE_SEC002]
soft_depends_on: [OVE_PERM017, OVE_PERM029]
provides: ["usecase:FileAccessRequest", "usecase:DecideAccessRequest", "usecase:ExpireAccessRequests", "usecase:ListAccessRequests", "port:AccessRequestRepository", "port:RunGrantRepository", "event:run_grant.changed", "usecase:CreateAccessRequest", "usecase:ListPendingRequestsForAgent"]
needs: ["lib:path-guard", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "usecase:RecordViolation", "usecase:GetRunSummary", "port:Scheduler", "port:MountPlanApplier"]
owns: ["packages/application/src/perm/access-request-flow/**", "packages/application/src/ports/AccessRequestRepository.ts", "packages/application/src/ports/RunGrantRepository.ts", "packages/contracts/src/events/run-grant-changed.event.ts", "apps/engine/src/composition/modules/perm-access-requests.module.ts"]
reads: ["packages/domain/src/perm/access-request/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 16.1", "SPECIFICATION 16.9", "SPECIFICATION 16.10"]
adr_refs: [3, 6, 20]
---

# OVE_PERM016: Implement the Access Request flow

## 1. Summary

Use cases for the whole life of an Access Request: an Agent files it (and is told to wait), the Owner grants for the current Run (desktop or Telegram), grants permanently (desktop with Local Approval only), denies it, or it expires; plus the Run-grant store that makes a Run-scoped grant disappear when the Run ends. A grant is only real once the sandbox mount was updated.

## 2. Context

ADR 0003/0006/0020: a permanent grant adds the directory to the Workspace policy and attaches it to the sandbox ("a Zgoda for a new directory means attaching it to the VM; a settings entry is not enough"). A Telegram grant is valid for the Run in which it was requested. SPEC 16.9 requires the difference to be tested.

## 3. Scope (in)

- `FileAccessRequest`, `DecideAccessRequest` (decisions `grant_run`, `grant_permanent`, `deny`), `CancelAccessRequest`, `ExpireAccessRequests`, `ListAccessRequests`, `GetAccessRequest`.
- `RunGrant` entity `{ id: 'rgr', runId, workspaceId, path, rights, createdFromRequestId, createdAt, revokedAt? }`, `RunGrantRepository`, revoke on Run end.
- Mount application via `MountPlanApplier` (port from PERM017) with rollback semantics.

## 4. Out of scope

State machine and guards (PERM015), mount derivation (PERM017), policy mutation primitives (PERM011's `AddAllowedDirectory` is called), routes (PERM028), notification delivery (NOTIF, TG), UI (APPRUI).

## 5. Detailed requirements

1. **FileAccessRequest** `{ principal(agent|chief), runId, agentId, rawPath, rights, justification }`: verify Run/Agent; canonicalise with `PathGuard` (the **engine** resolves, never the agent); apply filing guards (PERM015); persist `pending`; emit `access_request.requested` (sound + notification); audit `perm.access_request.filed`; respond `{ id, status:'pending', expiresAt }`. The Agent's node goes to `waiting` (WFRT consumes the event; PERM does not control nodes). Pause check: see PERM029.
2. **Decide: grant_run** `{ principal, id, grantedRights? }`: `authorize(principal,'access.grant_run')` (Owner desktop or Telegram); transition; create `RunGrant`; call `MountPlanApplier.applyForRun(runId)` **in the same logical operation**: if the mount update fails the grant is rolled back (`revokedAt` set, request becomes `pending` again with `error` event) and the Owner is told "could not attach the folder"; emit `run_grant.changed`; audit with channel. The grant is revoked automatically when the Run finishes/cancels/fails (subscriber to Run end events), at which point `MountPlanApplier` removes the mount from the Agent's environment.
3. **Decide: grant_permanent** `{ principal, id, grantedRights?, localProof }`: `authorize(principal,'access.grant_permanent')` + `RequireLocalProof` with args `{ accessRequestId, canonicalPath, rights, workspaceId }`; calls `AddAllowedDirectory` (PERM011) with source `access_grant` (re-canonicalising the path again at decision time: if the filesystem changed since filing, the grant fails `path.changed_during_check`); the new directory is attached via `MountPlanApplier` (event `policy.changed` handled by PERM017, plus a synchronous `applyForRun` so the waiting Agent can continue immediately). Telegram or a missing/invalid proof returns `perm.local_approval_required`; the Telegram reply instructs "approve at the computer".
4. **Decide: deny** any Owner channel; audit; the Agent gets `denied` with a generic reason (no mention of the Owner's note unless the Owner wrote one for the Agent, in which case it is passed as untrusted text).
5. **Narrowing at decision:** `grantedRights ⊆ requested.rights`; the Owner may grant `read` for a `read,write` request.
6. **Effective rule of grants:** a Run grant contributes to `EffectivePermissions` only through `computeEffectivePermissions` (PERM005): capped by Agent/Workflow/Tool/Owner layers. A Run grant never changes the Workspace policy, other Runs, or other Agents in the same Run? **Decision (ASSUMPTION):** a Run grant applies to **all Agents of that Run** that are otherwise permitted (Agent layer still caps), because the Owner granted it for the Run; the request records which Agent asked. Mount for other Agents of the Run is applied only to those whose effective rights include the path.
7. **Expiry/sweep:** `ExpireAccessRequests` every 30 s and at start; marks overdue `pending` as `expired`, emits, audits; the waiting Agent gets "expired, ask again if still needed".
8. **Cancel:** the Agent (own Run) or Run end cancels pending requests.
9. **Dedupe/limits** as PERM015, `perm.access_request_limit`.
10. **Concurrency:** decisions use compare-and-set on status; the first decision wins; mount application happens after commit with a compensating revoke on failure.
11. **Restart safety:** pending requests persist; granted Run grants persist until their Run ends; on engine start `PrepareRunMounts` (PERM017) re-derives mounts from `Policy + active RunGrants`, so a crash after the grant but before mounting is healed.
12. **Listing/visibility:** Agents see only their own requests (status, path display they filed); Owner sees all with canonical display path and justification (as plain text); Telegram view is the PERM015 view model.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`registerAllowedDirectory` via `AddAllowedDirectory` (PERM011/PERM002), `authorize` (PERM008), `RequireLocalProof` (PERM009), state machine (PERM015), `computeEffectivePermissions` (PERM005), `MountPlanApplier` (PERM017), `PathGuard`.

## 8. Architecture and code placement

One use case per file in `packages/application/src/perm/access-request-flow/`; ports in `packages/application/src/ports/`; composition module `perm-access-requests.module.ts` owned here. Dependencies point inward; adapters for the mount applier live in BOX/PERM017.

## 9. Security and safety

This flow is acceptance criteria 9 and 10. Controls: `granted_permanent` unreachable without desktop + proof (state machine and use case, two layers); Telegram grants are `granted_run` only and bound to the Run (grant stored with `runId`, revoked at Run end, never added to the policy); the agent cannot influence which path is granted (engine canonicalises, Owner sees the canonical path); path re-validated at decision time (TOCTOU); mounts updated before the Agent is told "granted" (no false sense of access, ADR 0020); a failed mount rolls back; protected locations non-requestable; request flooding bounded; justification is untrusted text. All state changes write audit events with channel; denials of attempted Telegram permanent grants write violations. A Run grant for Agent A is not visible to a Run of Agent B (different Runs, different grants).

## 10. Errors and edge cases

- Owner approves from Telegram after the Run ended: `perm.access_request_not_pending` (cancelled).
- Mount update fails (sandbox unavailable): decision rolled back; request stays pending; Owner notified; Agent continues to wait until expiry.
- Folder deleted between filing and approval: `path.not_found`; request becomes `denied` with system note.
- The same folder is added permanently by the Owner in settings while the request is pending: the request is auto-resolved `cancelled` with reason `already_allowed` and the Agent is told to retry.
- Permanent grant for a path that is inside another Workspace's directory: allowed by PERM (Workspaces may share folders), flagged in the Owner dialog (UI), SR-33 relies on sandbox isolation.
- Engine crashes after commit, before mount: healed at start (item 11).

## 11. Acceptance criteria

- [ ] Telegram `grant_permanent` is rejected, nothing persisted in the Workspace policy; Telegram `grant_run` works and the grant disappears when the Run ends (Run finished event).
- [ ] Desktop `grant_permanent` with a valid proof adds the directory to the Workspace policy (version+1) and the mount plan includes it.
- [ ] Desktop `grant_permanent` without proof, with a proof for another path, or with an expired proof is rejected.
- [ ] After a Run grant, `CheckAccess` allows the path for that Run only; a second Run of the same Workspace is denied.
- [ ] Mount failure rolls the grant back and leaves the request pending.
- [ ] Filing for `/` or `~` creates nothing; a violation is logged.
- [ ] Expired requests cannot be granted.
- [ ] Audit events exist for filed, granted (with channel and scope), denied, expired.

## 12. Test plan

Use case tests with fakes (fake `MountPlanApplier` with failure injection), `FakeClock`; scenario test replicating SPEC 16.9 end-to-end at the application layer; crash/restart test with the recovery harness (TEST011); authorisation matrix. `pnpm vitest run packages/application/src/perm/access-request-flow`.

## 13. Parallelization notes

Needs PERM011 (`AddAllowedDirectory`) and PERM017 port definition (can be stubbed). Blocks PERM028 and PERM030. Hotspot: composition module owned here.

## 14. Open questions and assumptions

- ASSUMPTION: a Run grant applies to every Agent of the Run (subject to its own layers). Alternative: bind to the requesting Agent only. Needs the Owner's confirmation.
- ASSUMPTION: Telegram can grant only the exact rights requested or narrower.
- Open: after a Run-scope Telegram grant, should the Owner be reminded on the desktop to make it permanent? Default: show a non-intrusive hint in the Approvals view ("granted for the current Run via Telegram").
