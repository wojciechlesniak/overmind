---
id: OVE_DATA013
title: Define the OwnerRule and OwnerRuleProposal contracts, events and consent override schema
area: DATA
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH008, OVE_ARCH010]
soft_depends_on: []
provides: ["contract:OwnerRule", "contract:OwnerRuleProposal", "contract:ConsentAction", "contract:ConsentOverride", "event:owner_rule.changed", "event:owner_rule.proposed", "event:owner_rule.proposal_resolved"]
needs: ["lib:define-event", "lib:contract-pipeline"]
owns: ["packages/contracts/src/owner-rule/**", "packages/contracts/src/events/owner-rule.changed.event.ts", "packages/contracts/src/events/owner-rule.proposed.event.ts", "packages/contracts/src/events/owner-rule.proposal-resolved.event.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 2", "SPECIFICATION 6", "SPECIFICATION 11", "SPECIFICATION 14"]
adr_refs: [3, 16, 21]
---

# OVE_DATA013: OwnerRule and OwnerRuleProposal contracts

## 1. Summary

Define Owner Rules (text rules that bind everyone, plus optional removal of default Approval requirements) and the proposals Chief may file. Only the Owner changes rules; Chief can only propose.

## 2. Context

ADR 0016: precedence is Owner Rules, then Project Documentation, then Chief Decisions, then Agent Memory; nothing weakens a rule. SPEC 6: only the Owner changes them. ADR 0021: the Owner may lift the Approval requirement for a default-list action, only locally (never via Telegram). SPEC 14: `OwnerRule(id, workspaceId?, text, consentOverrides, version)`.

## 3. Scope (in)

- Zod schemas `OwnerRule`, `OwnerRuleVersion`, `OwnerRuleProposal`, `ConsentAction`, `ConsentOverride`, inputs for create/edit/deactivate/propose/resolve.
- Three events.

## 4. Out of scope

- Repository: DATA014. Use cases and routes: DATA015. How rules are injected into prompts and enforced: CHIEF, SEC004, PERM (uses `consentOverrides`). The default consent list itself: PERM (`default-approvals`).

## 5. Detailed requirements

1. `ConsentAction` closed enum (open: false, additions are a security review): `delete_files`, `git_push`, `publish`, `send_external_message`, `payment`, `new_domain`, `exceed_budget` (ADR 0021 list).
2. `ConsentOverride`: `{ action: ConsentAction, scope: 'workspace' | 'global' }` meaning "no Approval needed for this action". 
3. `OwnerRule` (strict): `id: EntityId<'rul'>`, `workspaceId: EntityId<'ws'> | null` (null = global), `title: string (1..120)`, `text: string (1..4000)`, `consentOverrides: ConsentOverride[] (max 7)`, `active: boolean`, `version: int >= 1`, `createdAt`, `updatedAt`. A global rule applies to all Workspaces; a Workspace rule only there; isolated Workspaces still receive global rules.
4. `OwnerRuleVersion` (history, append-only): `ruleId`, `version`, `title`, `text`, `consentOverrides`, `active`, `changedAt`, `changedBy: 'owner'`.
5. Inputs (strict, requests): `CreateOwnerRuleInput { workspaceId?, title, text, consentOverrides? }`, `EditOwnerRuleInput { id, title?, text?, consentOverrides?, active?, expectedVersion }`.
6. `OwnerRuleProposal`: `id: 'rup'` prefix registered here? Use prefix `rup` registered in `kernel/id-prefixes/data.ts`? That file is owned by OVE_DATA009, so this task uses a proposal file to add `rup`; until merged the schema uses `entityId('rul')`-compatible string with prefix check deferred (ASSUMPTION flagged below). Fields: `workspaceId | null`, `title`, `text (<=4000)`, `rationale (<=1000)`, `proposedBy: { kind: 'chief' | 'agent', id }`, `targetRuleId?` (edit proposal), `status: 'pending' | 'accepted' | 'rejected' | 'withdrawn'`, `createdAt`, `resolvedAt?`, `resolvedRuleId?`. A proposal has NO `consentOverrides` field: only the Owner can lift Approval requirements.
7. Events (persisted, `visibleTo: ['owner']`; `owner_rule.changed` has `audit: true`): `owner_rule.changed { ruleId, version, change: 'created'|'edited'|'activated'|'deactivated', overridesChanged: boolean }`, `owner_rule.proposed { proposalId, workspaceId }`, `owner_rule.proposal_resolved { proposalId, status, ruleId? }`. Payloads carry ids and flags, not rule text.
8. All strings bounded, objects strict, text is untrusted display data to Agents and UI.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`entityId`, `defineEntity`, `defineEvent`, error constructors. `ConsentAction` is imported by PERM; it MUST NOT define a second list.

## 8. Architecture and code placement

`packages/contracts/src/owner-rule/{owner-rule.schema.ts,owner-rule-proposal.schema.ts,consent.schema.ts,owner-rule.routes.ts}` (routes file is added by DATA015) and event files under `events/`.

## 9. Security and safety

Rules are the highest-precedence input and a target for tampering: the schema gives proposals no consent override field, so Chief or an Agent cannot propose lifting an Approval requirement even by accident. Closed `ConsentAction` enum prevents adding an action by data. Text is stored and shown as data; it never carries executable meaning for the engine.

## 10. Errors and edge cases

- `consentOverrides` with duplicate actions: rejected (unique by action+scope).
- Text of only whitespace: rejected.
- Forward compatibility: a newer engine adding a consent action is a closed-enum change and requires a major bump (intended).

## 11. Acceptance criteria

- [ ] Proposal schema has no `consentOverrides`; a payload containing it is rejected (strict).
- [ ] Duplicate overrides rejected; 4001-character text rejected.
- [ ] Event definitions carry the right flags; snapshots committed.

## 12. Test plan

Table-driven schema tests, snapshot via `contracts:snapshot`. Commands: `pnpm vitest run packages/contracts/src/owner-rule`.

## 13. Parallelization notes

Parallel with DATA009. PERM needs `contract:ConsentAction`.

## 14. Open questions and assumptions

- ASSUMPTION: id prefix `rup` for proposals, added through `tasks/_proposals/OVE_DATA013-id-prefix.md` to the owner of `id-prefixes/data.ts` (OVE_DATA009).
- ASSUMPTION: rules have a title (short label for lists) in addition to text.
