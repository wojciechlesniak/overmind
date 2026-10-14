---
id: OVE_WSPACE024
title: "Chief rule proposals banner: accept as new rule or reject"
area: WSPACE
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA015, OVE_DS026, OVE_DS036, OVE_DS082, OVE_WSPACE014, OVE_WSPACE023]
soft_depends_on: []
provides: []
needs: ["ui:ProposalBanner", "ui:Dialog", "ui:Textarea", "lib:use-local-approval", "api:owner_rules.proposals.list", "api:owner_rules.proposals.resolve"]
owns: ["apps/desktop/src/features/workspace-settings/components/RuleProposals.tsx", "apps/desktop/src/features/workspace-settings/components/rules-areas/proposals.area.tsx"]
reads: []
design: design.png
design_source: "Workspace#ws/rule-proposal (crop 328,1140,1004,100 CSS px, tall render)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [16, 15]
---

# OVE_WSPACE024: Chief rule proposals banner: accept as new rule or reject

## 1. Summary

Shows Chief's pending Owner Rule proposals as a dashed banner inside the rules section ('Chief proponuje: ... Dodaj jako R4 / Odrzuć') and lets the Owner accept (creating the rule through Local Approval) or reject; Chief can never adopt a rule by itself.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock region `ws/rule-proposal`: avatar 'C', text 'Chief proponuje: „Testy wydajności tylko przed wydaniem”, bo pominąłeś je 2 razy.' with buttons 'Dodaj jako R4' (magenta in the mock, violet per DS082) and 'Odrzuć'. DATA015: `OwnerRuleProposal { title, text, rationale, proposedBy, targetRuleId?, status }` (no consentOverrides), `GET /v1/owner-rules/proposals?status=pending`, `POST /v1/owner-rules/proposals/{id}/resolve {decision, editedText?}` (owner). Spec 6: Chief can only propose a change.

## 3. Scope (in)

- `components/RuleProposals.tsx` plugged into the rules section via `components/rules-areas/proposals.area.tsx`.
- Accept (optionally edit text first) and reject flows.
- Proposal for editing an existing rule (`targetRuleId`) shown as 'Chief proposes changing R2'.

## 4. Out of scope

- Rule list/editor (OVE_WSPACE023).
- Chief generating proposals (CHIEF014).

## 5. Detailed requirements

1. One `ui:ProposalBanner` per pending proposal (max 3 shown, '+N more' link), eyebrow `CHIEF PROPONUJE REGUŁĘ R<n+1>` (the next positional label), text = proposal `text` quoted + `rationale` as plain text (clamp 3 lines, expandable).
2. Accept (`Dodaj jako R4`, violet per DS082; the mock's magenta is the old style: DS082 wins, note it): opens a small dialog with the proposed text in an editable `Textarea` ('You can edit before adding') and the Local Approval step: `run({operation:'owner_rule.edit', args:{ proposalId, workspaceId, title, text }, call:(proof,args)=> resolveProposal({id, decision:'accept', editedText: args.text, localProof: proof})})`. The engine creates the rule in the same transaction (DATA015 req 5).
3. Reject: `secondary sm` 'Odrzuć' calls `resolve {decision:'reject'}` immediately (rejecting changes nothing about protections: no proof). Toast 'Proposal rejected'.
4. Edited text may weaken what Chief proposed? Only the Owner edits; fine. The proposal can never contain consent overrides (contract); the banner shows no such option.
5. Proposals appear/disappear through push `owner_rule.proposed|proposal_resolved`; accepted proposals result in the new rule row appearing (list refetch).
6. Telegram: Chief may notify about a proposal but acceptance is desktop-only (this banner).

## 6. Design notes

`design.png`: dashed magenta-tinted banner r16 with 28px 'C' avatar (gradient), body 14/1.45 with the proposed title in magenta-light, buttons right. Not in the mock: several proposals, edit dialog, expanded rationale, busy, error.

## 7. Reuse

- `ui:ProposalBanner` (OVE_DS082) / `ui:ChiefProposalCard` look (DS057), `ui:Dialog`, `ui:Textarea`, `useRuleProposals`, `useLocalApproval`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: proposal text comes from Chief (a model that may have read untrusted content): it is plain text, can be edited by the Owner before adoption, and NEVER applied without the Owner's explicit Accept plus Local Approval. There is no 'accept all' control. The banner has no approve option reachable from Telegram.

## 10. Errors and edge cases

- Proposal resolved elsewhere: banner disappears, accept returns `not_pending`: toast.
- Edit emptied text: Accept disabled.
- Rationale containing a URL: shown as text.
- Proposal for a rule that no longer exists (`targetRuleId`): shown as new rule proposal with note 'target rule removed'.

## 11. Acceptance criteria

- [ ] Given a pending proposal, Then the banner matches `design.png` (with DS082 violet accept button).
- [ ] Given Accept, Then Local Approval precedes a single resolve call with `editedText`.
- [ ] Given Reject, Then a resolve call with `reject` is sent and no approval is requested.
- [ ] Given three proposals, Then three banners show and the fourth is summarised.
- [ ] Given a malicious rationale `<img onerror>`, Then it is inert text.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `RuleProposals.test.tsx` (accept with edit, reject, many, stale), `proposal-security.test.tsx` (inert text, no overrides field), stories, visual vs `design.png`. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/proposals, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/RuleProposals.tsx`, `apps/desktop/src/features/workspace-settings/components/rules-areas/proposals.area.tsx` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the label 'R4' = next positional index.
