---
id: OVE_PERM028
title: Add gateway routes for Access Requests (file, list, decide, cancel)
area: PERM
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ENGINE012, OVE_ENGINE019, OVE_PERM016, OVE_PERM025, OVE_PERM027]
soft_depends_on: []
provides: ["api:access-requests.list", "api:access-requests.get", "api:access-requests.file", "api:access-requests.decide", "api:access-requests.cancel", "lib:api-client-access-requests"]
needs: ["lib:route-module", "lib:gateway-auth", "lib:api-client-core"]
owns: ["packages/gateway/src/routes/perm/access-request-*.route.ts", "packages/contracts/src/perm/routes/access-requests.ts", "packages/api-client/src/perm/access-requests.ts"]
reads: ["packages/gateway/src/routes/perm/_views.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.9", "SPECIFICATION 16.10"]
adr_refs: [3, 6, 20]
---

# OVE_PERM028: Add gateway routes for Access Requests

## 1. Summary

API through which an Agent files an Access Request and polls it, and through which the Owner grants for the Run (desktop or Telegram), grants permanently (desktop plus Local Approval proof) or denies.

## 2. Context

The overmind Skill (ADR 0027) lets Agents file requests. Permanent grants are desktop-only (PERM015/016). The route layer must not offer Telegram any permanent option.

## 3. Scope (in)

Routes, contracts, api-client.

## 4. Out of scope

Use cases (PERM016), notification and sound (NOTIF), UI (APPRUI), Telegram buttons (TG).

## 5. Detailed requirements

| id | method path | scope | body / notes |
|---|---|---|---|
| access-requests.file | POST /v1/access-requests | A, Chief | `{runId, agentId, path, rights, justification}`; idempotency key required |
| access-requests.list | GET /v1/access-requests?status=&workspaceId=&runId= | O, T (view), A (own Run) | |
| access-requests.get | GET /v1/access-requests/{id} | O, T, A (own) | |
| access-requests.decide | POST /v1/access-requests/{id}/decision | O, T | `{decision:'grant_run'\|'grant_permanent'\|'deny', grantedRights?, note?, localProof?}` |
| access-requests.cancel | POST /v1/access-requests/{id}/cancel | A (own), O | |
1. `grant_permanent` from Telegram or without a valid proof returns 403 `perm.local_approval_required`, logs a `telegram_widening_attempt`/`local_proof_invalid` violation and creates nothing.
2. `grant_run` from Telegram is allowed; the response has `scope:'run'`.
3. The Agent's `path` is a raw string: bounded to 4096 bytes, no NUL; the response to the Agent never echoes canonical host paths, only the display form and status.
4. The Telegram view is the PERM015 `AccessRequestTelegramView`; its decision options are only `grant_run` and `deny`.
5. `justification` is stored as untrusted text and is only ever displayed as plain text.
6. `.strict()` schemas; errors declared: `perm.local_approval_required`, `perm.access_request_not_pending`, `perm.access_request_limit`, `perm.protected_location`, `perm.not_found`, `perm.approval_expired`, `path.*`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

PERM016 use cases, `_views.ts` helper from PERM027.

## 8. Architecture and code placement

One route file per row under `packages/gateway/src/routes/perm/`.

## 9. Security and safety

Acceptance criterion 9 and 10 are verified at this boundary too: channel from transport, permanence only with proof, Agents cannot decide, path strings are untrusted, no host layout leak to Agents, flooding bounded.

## 10. Errors and edge cases

Duplicate filing returns the same id; filing for another Run's id: `perm.not_found`; decision with `grantedRights` wider than requested: validation error `perm.invalid_rights`.

## 11. Acceptance criteria

- [ ] Telegram `grant_permanent` rejected and audited; Telegram `grant_run` accepted.
- [ ] Desktop `grant_permanent` without proof rejected; with proof accepted.
- [ ] Agent receives no canonical host path.
- [ ] Filing `~` or `/` is refused.
- [ ] Authorisation matrix passes.

## 12. Test plan

Route tests per principal and decision; matrix test. `pnpm vitest run packages/gateway/src/routes/perm/access-request`.

## 13. Parallelization notes

After PERM027 (shared views helper).

## 14. Open questions and assumptions

- ASSUMPTION: Chief may file Access Requests like an Agent but cannot decide.
