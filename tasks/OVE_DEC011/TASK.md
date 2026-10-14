---
id: OVE_DEC011
title: "Expose Decision Register routes, push events and api-client"
area: DEC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_DEC005, OVE_DEC006, OVE_DEC007, OVE_ENGINE011, OVE_ENGINE013, OVE_ENGINE019, OVE_MEM002, OVE_SHELL006]
soft_depends_on: ["OVE_DEC009"]
provides: ["api:decision.list", "api:decision.get", "api:decision.history", "api:decision.supersede", "api:decision.verdict", "api:decision.status", "api:decision.facets", "lib:api-client-decision", "api:decision.review_date"]
needs: ["lib:gateway-routes", "lib:caller-context", "lib:event-hub", "lib:api-client-core", "lib:error-catalogue", "lib:memory-scope-policy"]
owns: ["packages/gateway/src/routes/decision/**", "packages/api-client/src/decision/**"]
reads: ["packages/contracts/src/decision/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 10, 16]
---

# OVE_DEC011: Expose Decision Register routes, push events and api-client

## 1. Summary

Expose the Register through the authenticated gateway for the Owner UI (and Telegram summaries): search and filter, detail and history, accept or reject proposals, supersede with a new Decision, issue the verdict, plus the typed api-client and the event visibility mapping.

## 2. Context

Mock `Decyzje.png` is Owner-facing: search, three filters, list, detail, `Zastąp nową Decyzją`, verdict buttons. The Owner sees all Workspaces (including isolated); Chief and Agents do not call these routes (they use use cases). Same gateway rules as BOARD013/DISC014.

## 3. Scope (in)

- Route modules and schemas, owner-context authorised set, event visibility, api-client, contract tests.

## 4. Out of scope

- UI: DECUI. Agents recording Decisions via the overmind Skill: SKILL/AGENT call `usecase:decision.record` through their own agent route (not here).

## 5. Detailed requirements

1. **Routes** (`/api/v1`): `GET /decisions?q=&workspaceId=&status=&outcome=&tag=&cursor=&limit=` (Owner: all Workspaces; the `Wszystkie Workspace'y` chip = no `workspaceId`); `GET /decisions/facets?...`; `GET /decisions/:id` (view); `GET /decisions/:id/history`; `POST /decisions/:id/status` `{ to: 'accepted'|'rejected'|'needs_review', reason }` (owner); `POST /decisions/:id/supersede` `{ proposal: DecisionProposal (without supersedesId) }` (owner; the UI `Zastąp nową Decyzją` opens a form; the server sets `supersedesId = :id`); `POST /decisions/:id/verdict` `{ outcome, note?, evidenceRefs? }` (owner, desktop only); `POST /decisions/:id/review-date` `{ reviewDate, reason }` (owner). No create or edit route for Owner except supersede (a brand-new Owner Decision is allowed through `POST /workspaces/:wid/decisions` with `origin: owner` ASSUMPTION: Owner may record their own Decision).
2. **Callers:** owner (all); channel Telegram: `GET` list/detail summaries only (no rationale text beyond title and status, ASSUMPTION); chief/agents: none.
3. **Scope:** the route builds the Owner's `AuthorisedWorkspaceSet` (all Workspaces) via `lib:memory-scope-policy`; for Telegram the same set but summary shapes.
4. **Validation:** strict schemas; bodies cannot contain `workspaceId` (derived), `seq`, `createdBy`, `origin` (set server-side), `status`; evidence refs verified by use cases; `Idempotency-Key` supported on supersede and verdict.
5. **Responses:** `DecisionView` (with `confidenceLabel`, refs with `workspaceName` possibly null); errors via `toErrorResponse` (`409 dec.already_superseded` includes the successor ref; `403 dec.verdict_forbidden` for non-owner).
6. **Events:** `decision.*` visible to owner and channel (ids/titles only).
7. **api-client:** `packages/api-client/src/decision/{decisions.client.ts,verdict.client.ts,supersede.client.ts}` + `subscribeDecisions(handlers)`.
8. **Rate limits:** list 60/min, writes 30/min.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

ENGINE gateway kit; DEC005-007 use cases; scope policy. No logic in routes.

## 8. Architecture and code placement

`packages/gateway/src/routes/decision/*.route.ts`, `packages/api-client/src/decision/**`.

## 9. Security and safety

Owner-only mutation routes with server-derived identity and scope; mass assignment rejected (`origin`, `status`, `workspaceId`); verdict desktop-owner only; Telegram read-only summaries; no route exposes the cross-Workspace Chief search or the similar finder (agent-facing capabilities stay internal); the Owner's all-Workspaces view is the only place isolated Decisions appear; errors never include paths or SQL; idempotency keys avoid duplicate supersedes.

## 10. Errors and edge cases

- Supersede of an already superseded Decision: 409 with successor.
- Detail of a Decision whose supersede target Workspace was deleted: ref with `workspaceName: null`.
- Telegram requests verdict: 403.
- Large `q`: 422.

## 11. Acceptance criteria

- [ ] All routes have schemas, caller rules and contract tests.
- [ ] Mass assignment rejected; verdict/supersede/status are owner-only.
- [ ] Owner list includes isolated Workspaces' Decisions; the scope is derived server-side.
- [ ] Idempotent verdict and supersede.
- [ ] Telegram receives summaries only.
- [ ] api-client tested against the gateway harness.

## 12. Test plan

- `*.route.test.ts` with gateway harness; caller matrix; api-client tests. Commands: `pnpm vitest run packages/gateway/src/routes/decision packages/api-client/src/decision`.

## 13. Parallelization notes

DECUI depends on the api-client types.

## 14. Open questions and assumptions

- ASSUMPTION: the Owner may record their own Decision (`origin: owner`); confirm with the DECUI author.
