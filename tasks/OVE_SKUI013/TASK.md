---
id: OVE_SKUI013
title: "Chief proposal banner: Chief proposes a new Skill, view its text, accept or reject"
area: SKUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_CHIEF014, OVE_CHIEF019, OVE_DS036, OVE_DS057, OVE_DS072, OVE_SKILL011, OVE_SKUI003, OVE_SKUI006]
soft_depends_on: []
provides: ["lib:skill-proposal-banner"]
needs: ["api:proposals.list", "api:proposals.decide", "api:skills.get", "ui:ChiefProposalCard", "ui:Dialog", "ui:MarkdownPreview", "lib:api-client-chief", "lib:use-gateway-resource", "lib:use-gateway-mutation", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/regions/proposal.region.tsx", "apps/desktop/src/features/skills/components/ProposalViewDialog.tsx", "apps/desktop/src/features/skills/state/use-skill-proposals.ts", "apps/desktop/src/locales/en/skills-proposal.json", "apps/desktop/src/locales/pl/skills-proposal.json"]
reads: []
design: design.png
design_source: "Skille#skills/chief-proposal (crop 88,232,996,104 CSS px) (crop 88,232,996,104 CSS px)"
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 10"]
adr_refs: [12, 15]
---

# OVE_SKUI013: Chief proposal banner: Chief proposes a new Skill, view its text, accept or reject

## 1. Summary

The dashed magenta banner `Chief proponuje nowy Skill: release-checklist` with the rationale, `Zobacz treść`, `Akceptuj` and `Odrzuć`; accepting adds the Skill as PRIVATE after the Owner's decision.

## 2. Context

Mock `skills/chief-proposal`: `Ten sam proces wydania powtórzył się w 4 udanych Runach w 2 Workspace'ach. Trafi do biblioteki jako prywatny, dopiero po Twojej akceptacji.` SKILL009 creates the Skill (source `chief`, private, version 1 `pending_review`) and a Proposal; CHIEF014 `DecideProposal` (Owner desktop only) runs `AcceptSkillProposal` or `RejectSkillProposal`; a rejected `(kind, subject)` cannot be re-proposed for 14 days. Chief never chooses `public`.

## 3. Scope (in)

- `proposal.region.tsx` (slot `strip`, above the review rows).
- `useSkillProposals` from `GET /v1/proposals?kind=skill&status=pending`.
- `ProposalViewDialog` (read-only text and scan).

## 4. Out of scope

- Proposal inbox in Chief chat (CHIEF/CHATUI).

## 5. Detailed requirements

1. One `ChiefProposalCard variant='skill'` per pending Skill proposal (stacked, max 3 shown + `+N więcej propozycji`), title `Chief proponuje nowy Skill: {name}`, rationale = the Overmind-built summary (<=300 chars, plain text), buttons `Zobacz treść`, `Akceptuj`, `Odrzuć`.
2. `Zobacz treść` opens `ProposalViewDialog`: read-only `MarkdownPreview` of the pending version (`GET /v1/skills/{id}` flagged untrusted), scan findings (same table as OVE_SKUI012) and the provenance line when `derivedFromExternal`.
3. `Akceptuj` -> `POST /v1/proposals/{id}/decision { decision:'accept' }`; the Skill appears in the library as PRYWATNY; for a proposal whose scan has `high` findings (should not exist, SKILL009 rejects) the button is disabled with the reason.
4. `Odrzuć` -> `{ decision:'reject', note? }`; the card disappears; a toast says `Chief nie zaproponuje tego ponownie przez 14 dni`.
5. Card `state`: `pending|busy|accepted|rejected` (ui-kit) with the resolved labels; failed executor leaves the proposal pending with the error (CHIEF014: no partial state).
6. Telegram cannot decide Skill proposals (CHIEF014); this UI has no Telegram affordance.
7. Proposals are refetched on `chief.proposal.created`/`...decided` events and `skill.*` events.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:ChiefProposalCard` (OVE_DS057), `ui:Dialog`, `ui:MarkdownPreview`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/proposal.region.tsx`, `components/ProposalViewDialog.tsx`, `state/use-skill-proposals.ts`.

## 9. Security and safety

Skill text is instructions that will later steer an Agent, so it is the most sensitive untrusted text in the product (ADR 0012: Skills from the internet come only from the Owner and are untrusted until accepted). The UI shows it only as plain text (no Markdown-to-HTML, no links made clickable inside the text), never includes it in any prompt or request other than the explicit Owner action, and a Skill chip or `requiredTools` list is metadata, never a permission. The rationale text comes from Overmind templates and facts (not model text) per SKILL009; even so it is rendered as plain text. Accepting does not change visibility: public needs the separate explicit flow (OVE_SKUI010). All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Proposal expired (30 days): card hidden, no error.
- Proposal decided from Chief chat meanwhile: refetch, info toast.
- No pending proposals: region renders nothing (no empty box).

## 11. Acceptance criteria

- [ ] Given one pending proposal, Then the banner matches `design.png` within tolerance.
- [ ] Given `Zobacz treść`, Then the pending text and scan are shown read-only.
- [ ] Given `Akceptuj`, Then one decision request is sent and the Skill appears as PRYWATNY.
- [ ] Given `Odrzuć`, Then the card is removed and the cool-down toast appears.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `proposal.region.test.tsx`, `ProposalViewDialog.test.tsx`, `use-skill-proposals.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to CHIEF/SKILL): SKILL009 names the proposal kind `skill` while CHIEF014 lists `skill_publish` and `skill_make_public`; this task filters `kind in (skill, skill_publish)` until reconciled.
- GAP (reported to CHIEF): `DecideProposal` has no field to choose visibility on accept; the Skill is always private first (consistent with ADR 0012/0028).
