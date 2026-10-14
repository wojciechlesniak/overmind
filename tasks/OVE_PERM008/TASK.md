---
id: OVE_PERM008
title: Define principals, channel attribution and the decision authority matrix
area: PERM
kind: security
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM001, OVE_ARCH003]
soft_depends_on: [OVE_SEC005, OVE_SEC008]
provides: ["contract:Principal", "lib:decision-authority", "contract:OwnerOperation", "contract:Actor"]
needs: []
owns: ["packages/contracts/src/perm/principal.ts", "packages/contracts/src/perm/owner-operation.ts", "packages/domain/src/perm/authority/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 11", "SPECIFICATION 16.9", "SPECIFICATION 16.10"]
adr_refs: [3, 6, 10, 21]
---

# OVE_PERM008: Define principals, channel attribution and the decision authority matrix

## 1. Summary

One typed answer to "who is asking and what may they decide?". `Principal` is the authenticated identity attached by the gateway to every request; `OwnerOperation` lists the security-relevant operations; the authority matrix is a pure table saying which principal kinds may perform which operation and whether a Local Approval proof is required. All PERM use cases call it first.

## 2. Context

ADR 0006: Telegram may approve an Access Request for the current Run only; permanent changes need Local Approval at the computer. ADR 0021: lifting an approval requirement is local only. SPEC 16.9 and 16.10 are acceptance criteria. SEC005 (G6, G7) defines how the gateway authenticates callers (Owner session, agent token, `channel:telegram`). Channel identity must come from the transport, never from the request body (SEC008 T5).

## 3. Scope (in)

- `Principal` union and `PrincipalSchema` (strict).
- `OwnerOperation` enumeration with metadata (`widens`, `requiresLocalProof`, `telegramAllowed`, `agentMayFile`).
- `authorize(principal, operation, ctx): Result<AuthzGrant>` pure; `AuthzGrant = { scope: 'run'|'permanent'|'n/a', needsLocalProof: boolean }`.
- A generated authorisation table (markdown) for `docs/security/decision-authority.md` produced by a script test (the table is derived from the code, not hand-written).

## 4. Out of scope

Authentication (token checks, sockets): ENGINE and SEC005. Creating local proofs (`OVE_PERM009`). Executing the operations (PERM011/012/014/016).

## 5. Detailed requirements

1. **Principal**
   ```ts
   Principal =
     | { kind:'owner', channel:'desktop', local:true,  sessionId: string }   // desktop UI over the owner-only socket
     | { kind:'owner', channel:'other',   local:false, sessionId: string }   // CLI/api-client or any non-desktop Owner transport (future)
     | { kind:'channel', channel:'telegram', pairedUserId: string }          // in-process Telegram adapter, authenticated by pairing
     | { kind:'agent', agentId: EntityId<'agt'>, runId: EntityId<'run'> }    // scoped agent token
     | { kind:'chief', runId?: EntityId<'run'> }                             // Chief inside the engine
     | { kind:'system', component: string }                                   // timers, sweepers, recovery
   ```
   The gateway builds it from the authenticated transport. No gateway request or event payload may contain a `principal` or `channel` field supplied by the client: request schemas for PERM routes are `.strict()` and none declares such a field (tested by a route-registry test in PERM026/027/028).
2. **OwnerOperation** (extensible array with metadata; new operations are added in new files):
   | operation | widens | local proof | Telegram | Agent | Chief |
   |---|---|---|---|---|---|
   | `approval.decide.approve` | no (one action) | no | yes (current Run only) | no | no |
   | `approval.decide.deny` | no | no | yes | no | no |
   | `approval.request` | n/a | no | no | yes (own Run) | yes |
   | `access.file` (Access Request) | n/a | no | no | yes (own Run) | yes |
   | `access.grant_run` | yes (temporary) | no | **yes** | no | no |
   | `access.grant_permanent` | yes | **yes** | **no** | no | no |
   | `access.deny` | no | no | yes | no | no |
   | `policy.narrow` | no | no | no | no | no (propose only) |
   | `policy.widen` (add directory, raise rights, add capability) | yes | **yes** | no | no | no |
   | `profile.edit` | depends on diff, classified by PERM011 | as `policy.*` | no | no | no |
   | `override.lift` | yes | **yes** | no | no | no |
   | `override.restore` | no | no | no | no | no |
   | `audit.read` | no | no | limited (summary only) | no | no |
   | `audit.export` / `audit.verify` | no | no | no | no | no |
   | `local_confirmation.create` | n/a | n/a | no | no | no |
   `Owner desktop` may do everything the table allows to Owner; `Owner other` (non-desktop Owner transport) is treated like Telegram for widening (denied) and like desktop for narrowing, except `audit.export`. Anything not in the table is denied (`perm.channel_not_permitted`).
3. `authorize` returns `Err(perm.owner_required)` for agent/chief/system on owner-only operations, `Err(perm.local_approval_required)` when the operation needs local proof and the principal is not `owner/desktop/local`, `Err(perm.channel_not_permitted)` for Telegram on desktop-only operations. When Telegram approves, `AuthzGrant.scope === 'run'`; the use cases (PERM014/PERM016) must pass this scope on and **never** let the request body choose a broader scope.
4. **Agents and Chief file requests only.** Chief is not "the Owner": a Chief-originated decision call is rejected (SPEC 16.10).
5. **Rate limits** are policy data in this module (`maxPendingApprovalsPerRun: 20`, `maxPendingAccessRequestsPerAgent: 5`, `maxFilingsPerMinutePerRun: 10`) consumed by the use cases.
6. The doc table generator `tools/gen/perm-authority-doc.ts` is part of the CI check (`pnpm gen --check`) so docs cannot drift from code.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Result`/errors (ARCH003), `Principal` consumed by every PERM route handler through the gateway's `caller` object (ARCH009 `caller: { kind, channel?, runId?, agentId? }`); this contract is the richer superset that the gateway adapter maps from. The gateway infrastructure (ENGINE) provides the mapping function `toPrincipal(caller, session)`; this task defines the target type.

## 8. Architecture and code placement

`packages/contracts/src/perm/principal.ts` and `owner-operation.ts`; `packages/domain/src/perm/authority/{operations.ts,authorize.ts}`. The table is one array of `OperationRule` objects (data) so adding an operation means adding an entry, not editing branching logic.

## 9. Security and safety

This task is the code form of SR-15, SR-16, SR-25. Key controls: (1) default deny for unlisted principal/operation pairs; (2) Telegram can only produce `run` scope and cannot appear on any widening-permanent operation; (3) Chief and agents can never decide; (4) channel comes from the authenticated transport, not payload; (5) the table is tested exhaustively (every operation x every principal kind = expected result), which makes a silent change visible in review. Forged Telegram attribution (a payload field `channel: "desktop"`) is rejected by strict schemas and by the fact that `Principal` is not parseable from request bodies (no schema for it in request contracts).

## 10. Errors and edge cases

- `owner/other` session attempting `access.grant_permanent`: `perm.local_approval_required`.
- Telegram attempting `approval.decide.approve` for an approval whose Run has ended: allowed by this table, rejected later by state (`perm.approval_not_pending`).
- `system` principal: allowed only for `approval.expire` and `access.expire` housekeeping operations (declared in the table as system-only operations), nothing else.
- Unknown operation string: deny.

## 11. Acceptance criteria

- [ ] An exhaustive test iterates all operations x principal kinds and matches the table in requirement 2.
- [ ] Telegram + `access.grant_permanent` yields `perm.local_approval_required` or `perm.channel_not_permitted` (documented one) and never a grant.
- [ ] Chief + `approval.decide.approve` yields `perm.owner_required`.
- [ ] `docs/security/decision-authority.md` is generated and `pnpm gen --check` fails if stale.
- [ ] No request contract in `packages/contracts/src/perm/` contains the keys `principal`, `channel` or `local` (static test over zod shapes).

## 12. Test plan

Unit: exhaustive matrix test; generated-doc snapshot test; static schema key scan. `pnpm vitest run packages/domain/src/perm/authority packages/contracts/src/perm`.

## 13. Parallelization notes

Parallel with PERM003..007. PERM009, PERM011, PERM012, PERM014, PERM016 call `authorize`. The Telegram adapter (TG) only needs the `Principal` type.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram may deny any request and may approve only per-Run (current Run) grants; it cannot narrow policies (not offered). Narrowing from Telegram might be wanted for emergencies: Global Pause (PAUSE) covers that.
- Open: a future CLI as Owner transport (`channel:'other'`); default: treated as non-local.
