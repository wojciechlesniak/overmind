---
id: OVE_DATA015
title: OwnerRule use cases (owner-only edits, Chief proposals) and gateway routes
area: DATA
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH009, OVE_DATA002, OVE_DATA005, OVE_DATA011, OVE_DATA014, OVE_PERM031]
soft_depends_on: []
provides: ["usecase:CreateOwnerRule", "usecase:EditOwnerRule", "usecase:ListEffectiveOwnerRules", "usecase:ProposeOwnerRule", "usecase:ResolveOwnerRuleProposal", "api:owner_rules.list", "api:owner_rules.get", "api:owner_rules.create", "api:owner_rules.edit", "api:owner_rules.history", "api:owner_rules.propose", "api:owner_rules.proposals.list", "api:owner_rules.proposals.resolve", "usecase:ApplyOwnerRuleChange", "port:OwnerRuleChecker"]
needs: ["port:UnitOfWork", "port:EventStore", "port:LocalApprovalGate", "port:Clock", "port:IdGenerator", "lib:route-module"]
owns: ["packages/application/src/data/owner-rule/**", "packages/contracts/src/owner-rule/owner-rule.routes.ts", "packages/gateway/src/routes/data/owner-rules-*.route.ts", "apps/engine/src/composition/modules/data-owner-rule.module.ts", "packages/api-client/src/data/owner-rules.ts"]
reads: ["packages/application/src/ports/OwnerRuleRepository.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [3, 6, 16, 21]
---

# OVE_DATA015: OwnerRule use cases and routes

## 1. Summary

Create, edit, deactivate and list Owner Rules (Owner only), and let Chief or an Agent file a proposal that the Owner accepts or rejects. Lifting an Approval requirement needs Local Approval on the desktop.

## 2. Context

SPEC 6 and ADR 0016: only the Owner changes rules, Chief proposes. ADR 0021/0003 and SPEC 16 criterion 10: no Agent or Telegram widens permissions or removes an Approval requirement. Accepting a proposal creates or edits a rule with the Owner's text; the proposal never applies itself.

## 3. Scope (in)

- Use cases, route contracts and modules, wrappers, composition module.

## 4. Out of scope

- UI for rules (SETUI/CHIEF). Enforcement of overrides: PERM. Prompt injection of rules: CHIEF/SEC004.

## 5. Detailed requirements

1. `CreateOwnerRule` / `EditOwnerRule`: caller `owner` only. If the resulting `consentOverrides` is a superset of the previous (any override added), require `LocalApprovalGate.require({ action: 'owner_rule.lift_consent', target: ruleId, detailsHash })` and an Owner desktop session; the grant is single use. Removing overrides or editing text needs no approval. Telegram-originated requests fail the route scope.
2. Each change runs in one transaction: repository write (+version row) and event `owner_rule.changed` (`overridesChanged` flag).
3. `ListEffectiveOwnerRules { workspaceId }`: callable by `owner`, by the engine internally (CHIEF, WFRT through the use case token) and by `agent` scope for the agent's own Run Workspace only (read-only; agents must see the rules they are bound by). Returns title and text; never returns proposals.
4. `ProposeOwnerRule`: callers `owner`, `chief` (internal), `agent` (own Workspace). Validates the no-override schema, enforces the pending cap, writes the proposal and `owner_rule.proposed`. Sends a Notification through the NOTIF event (consumers subscribe).
5. `ResolveOwnerRuleProposal { id, decision: 'accept' | 'reject', editedText? }`: Owner only. Accept creates the rule (or edits `targetRuleId`) using the Owner's `editedText ?? proposal.text` in the same transaction as the proposal resolution.
6. Routes: `GET /v1/owner-rules?workspaceId=`, `GET /v1/owner-rules/{id}`, `GET /v1/owner-rules/{id}/history`, `POST /v1/owner-rules`, `PATCH /v1/owner-rules/{id}`, `POST /v1/owner-rules/proposals` (scopes owner, agent), `GET /v1/owner-rules/proposals?status=pending`, `POST /v1/owner-rules/proposals/{id}/resolve` (owner). Writes by Owner use `idempotency: key-required`.
7. `data-owner-rule.module.ts` provides use cases and the cascade participant from DATA014.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`UnitOfWork`, `EventStore`, `LocalApprovalGate` (PERM), repositories (DATA014), `ConsentAction` (this area's contract, consumed by PERM).

## 8. Architecture and code placement

`packages/application/src/data/owner-rule/*.usecase.ts`; routes in `packages/gateway/src/routes/data/`; module under `apps/engine/src/composition/modules/`.

## 9. Security and safety

Permission-expanding change (lifting a consent requirement) requires Local Approval bound to rule id and a hash of the new overrides (SR-25, SR-34). Agents can read rules and propose text only; cannot edit, cannot propose overrides. A proposal body is untrusted text: stored as data, rendered escaped, never auto-applied. Agent-scope calls are restricted to the Run's own Workspace (SR-31). All changes audited by events in the same transaction.

## 10. Errors and edge cases

- Proposal cap reached: `data.integrity_violation` mapped to a friendly key `data.too_many_pending_proposals`.
- Accept a stale proposal after the target rule changed: conflict with version info, Owner re-reviews.
- Approval denied: no change.
- Edit while an Agent is mid-Run: new rule version applies from the next Run start; running Runs keep their pinned rule snapshot (WFRT pins `ruleVersions`).

## 11. Acceptance criteria

- [ ] Agent and Telegram callers cannot call create/edit/resolve (403).
- [ ] Adding a consent override without a grant yields `perm.local_approval_required`.
- [ ] Accepting a proposal creates a rule and resolves the proposal atomically.
- [ ] Agent proposal containing `consentOverrides` is rejected by schema.
- [ ] Agent listing for another Workspace returns not found.

## 12. Test plan

Use-case tests with fakes; authorisation matrix via gateway test support; e2e proposal flow on SQLite. Commands: `pnpm vitest run packages/application/src/data/owner-rule`.

## 13. Parallelization notes

After DATA014. Route files are separate per capability.

## 14. Open questions and assumptions

- ASSUMPTION: running Runs keep the rule versions pinned at start.
- ASSUMPTION: agents may read their Workspace's effective rules.
