---
id: OVE_PERM015
title: Define the AccessRequest contract and its state machine (Run vs permanent scope)
area: PERM
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM001, OVE_PERM008, OVE_ARCH010, OVE_SEC002]
soft_depends_on: []
provides: ["contract:AccessRequest", "lib:access-request-state-machine", "event:access_request.requested", "event:access_request.decided", "event:access_request.expired", "event:access_request.created", "event:access_request.resolved"]
needs: []
owns: ["packages/contracts/src/perm/access-request.ts", "packages/domain/src/perm/access-request/**", "packages/contracts/src/events/access-request-requested.event.ts", "packages/contracts/src/events/access-request-decided.event.ts", "packages/contracts/src/events/access-request-expired.event.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14", "SPECIFICATION 16.9", "SPECIFICATION 16.10"]
adr_refs: [3, 6, 20]
---

# OVE_PERM015: Define the AccessRequest contract and its state machine

## 1. Summary

An Access Request is how an Agent asks the Owner for a directory outside the Allowed Directories. It grants nothing by itself. This task defines its shape, the pure state machine, and the rule that the scope of a grant (current Run or permanent) depends only on the channel that decides it.

## 2. Context

Glossary: Access Request, Local Approval. SPEC 11: the Agent pauses, a sound and a notification fire; approval at the computer adds the directory to the Workspace permanently; approval from Telegram applies to the current Run only. SPEC 14: `AccessRequest: id, agentId, path, scope (run or permanent), status, channel`. Acceptance criterion 9 and 10 apply.

## 3. Scope (in)

- `AccessRequest` contract, `AccessGrant` outcome shape, events.
- State machine: `pending → granted_run | granted_permanent | denied | expired | cancelled`.
- Pure guards: `scopeAllowedForChannel`, `rightsAllowedToGrant`, `isDuplicate`.

## 4. Out of scope

Use cases, Run-grant storage, mount updates (PERM016, PERM017), routes (PERM028), notification and sound (NOTIF), UI (APPRUI).

## 5. Detailed requirements

1. **Entity**
   ```ts
   AccessRequest = { id: EntityId<'acr'>, workspaceId, runId, agentId, nodeExecutionId?,
     requested: { rawPathDisplay: string /* what the agent typed, <=500, display only, never used for decisions */,
                  canonicalPath: CanonicalPath /* verified by PathGuard when filed */, rights: RightSet, justification: string /* <=500, untrusted text from the agent */ },
     status: 'pending'|'granted_run'|'granted_permanent'|'denied'|'expired'|'cancelled',
     requestedAt, expiresAt, decidedAt?, 
     decision?: { by: 'owner_desktop'|'owner_telegram', grantedRights?: RightSet /* may be narrower than requested */, runGrantId?: EntityId<'rgr'>, addedDirectoryId?: EntityId<'adr'>, note?: string },
     channelOfDecision?: 'desktop'|'telegram' }
   ```
   `scope` from SPEC 14 is derived: `granted_run` = run scope, `granted_permanent` = permanent; it is never an input field.
2. **Filing guards:** the request path must be canonical, an existing directory or file's parent (PathGuard `canonicalizeRoot` for directories; for a single file, the parent directory is requested and the file named in the justification), not a protected location (those are never requestable: `perm.protected_location`), not already inside the effective set with the requested rights (`already_allowed`: no new request is created; the Agent is told to retry). Rights requested are validated (`RightSet`) and `execute` requests are flagged for the UI.
3. **Transitions:**
   - `pending → granted_run` (any Owner channel; creates a Run grant bound to this Run);
   - `pending → granted_permanent` (**only** `owner_desktop` with a Local Approval proof; `owner_telegram` cannot reach this state: the guard rejects it);
   - `pending → denied` (desktop or Telegram), `pending → expired` (timeout), `pending → cancelled` (Run ends, Agent withdraws, or the Agent no longer needs it).
   Terminal states stay terminal. `granted_*` may be narrower than requested (Owner chooses `read` instead of `read,write`): `grantedRights ⊆ requested.rights` is enforced (an Owner cannot grant more than asked through this flow; use settings for that).
4. **Expiry:** default 30 minutes while the Run waits (ASSUMPTION), max 24 h; a pending Access Request keeps the Agent paused ("waiting"), the Run's other branches continue (SPEC 6/ADR 0015 spirit).
5. **Duplicates:** same Run + same canonical path (or an ancestor already requested with covering rights) while one is pending → same request returned; a path previously **denied** in the same Run cannot be re-filed for 10 minutes (anti-nagging; `perm.access_request_limit`, details `{ reason: 'recently_denied' }`).
6. **Limits:** 5 pending per Agent, 10 filings per Run per hour (`maxPending*` from PERM008).
7. **Events:** `access_request.requested` (id, workspaceId, runId, agentId, canonicalDisplayPath, rights, `notify: { sound: true, urgency: 'high' }`), `access_request.decided`, `access_request.expired`. The sound is an OPEN decision of the Spec (SPEC 11, 18) — see 14.
8. **Telegram view model:** `AccessRequestTelegramView` (contract) = path display relative to `~` or a Workspace name, rights, justification excerpt (200 chars), no absolute paths outside the user's home; buttons offered: Approve for this Run / Deny (never "Add permanently").

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`CanonicalPath`, `PathGuard` (SEC002), `RightSet` (PERM001), `defineEvent`. State-machine helpers share a tiny generic `defineStateMachine` util only if one exists in ARCH (otherwise local, KISS; do not create a shared utility in this task).

## 8. Architecture and code placement

`packages/contracts/src/perm/access-request.ts`; `packages/domain/src/perm/access-request/{machine.ts,guards.ts}`; event files per type. No I/O.

## 9. Security and safety

The justification and the raw path string are untrusted agent text: they are display-only, length-bounded, control characters stripped, rendered as plain text, and never fed into any decision or prompt (SEC004). The decision is based solely on `canonicalPath` verified by the engine. The path a Telegram user sees is the engine's display form; a lookalike path trick (`/Users/x/Pr0j` vs `/Users/x/Proj`, bidi characters) is mitigated by showing the canonical path with non-ASCII characters escaped in Telegram and flagged in the desktop (SEC002 `unicodeVariantInput` flag). `granted_permanent` unreachable from Telegram is enforced by the state machine itself, not only by the route.

## 10. Errors and edge cases

- Request for `/` or `~`: `perm.protected_location`, no request created, a violation is logged.
- Request for a path inside an already allowed directory with fewer rights than requested: becomes an "upgrade" request (`rights` includes the missing right); `requestable` only for the same directory (kept simple: allowed).
- Agent files for a symlink target outside: canonical path is the target; the Owner sees the real location.
- Expired request approved late: `perm.approval_expired`.

## 11. Acceptance criteria

- [ ] No sequence of events leads to `granted_permanent` with `owner_telegram` (exhaustive transition test).
- [ ] `grantedRights ⊄ requested.rights` is rejected.
- [ ] Protected locations cannot be requested; already-allowed requests create nothing.
- [ ] Denied path cannot be re-filed within 10 minutes in the same Run.
- [ ] Events contain no justification text, only ids and display path.
- [ ] Contract snapshot committed.

## 12. Test plan

Transition matrix tests; property test over random event sequences asserting the Telegram invariant; filing guard table tests with `FakePathProbe`. `pnpm vitest run packages/domain/src/perm/access-request packages/contracts/src/perm/access-request`.

## 13. Parallelization notes

Parallel with PERM013. PERM016 depends on it. APPRUI/TG can start from the snapshot and the Telegram view model.

## 14. Open questions and assumptions

- OPEN (SPEC 11, 18): the kind of sound and notification for an Access Request. Default: notification urgency `high` with the system default sound (`Notifier.notify({ sound: 'default' })`, ARCH012) repeated once after 5 minutes if still pending. NOTIF owns the final choice.
- ASSUMPTION: expiry 30 minutes; anti-nagging 10 minutes.
