---
id: OVE_SKUI012
title: "Pending review: scan findings, pending state and accept or reject of an imported version"
area: SKUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_BOARDUI002, OVE_DS024, OVE_DS036, OVE_DS069, OVE_DS072, OVE_DS082, OVE_SKILL011, OVE_SKUI003, OVE_SKUI006, OVE_SKUI011]
soft_depends_on: []
provides: ["lib:skill-review-flow"]
needs: ["api:skills.review", "lib:api-client-skills", "ui:ProposalBanner", "ui:Dialog", "ui:DataTable", "ui:CheckboxRow", "ui:MarkdownPreview", "ui:SafeLink", "lib:use-gateway-mutation", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/regions/review-strip.region.tsx", "apps/desktop/src/features/skills/components/ReviewSkillDialog.tsx", "apps/desktop/src/features/skills/state/use-skill-review.ts", "apps/desktop/src/locales/en/skills-review.json", "apps/desktop/src/locales/pl/skills-review.json"]
reads: []
design: design.png
design_source: "Skille#skills/chief-proposal (crop 88,232,996,104 CSS px; the review dialog is not drawn in the mock) (crop 88,232,996,104 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [12]
---

# OVE_SKUI012: Pending review: scan findings, pending state and accept or reject of an imported version

## 1. Summary

The pending state and review of imported Skills: a strip listing Skills waiting for review and a review dialog with the untrusted text, the scan results, per-finding confirmation for `high` findings and Accept or Reject.

## 2. Context

SKILL007/008: an import is stored as version 1 `pending_review`, private, with `scan {severity, findings[]}`. `GET /v1/skills/reviews` lists pending items (summaries without text); the text comes from `GET /v1/skills/{id}` flagged `untrusted`. Decision: `POST /v1/skills/{id}/versions/{v}/decision { decision:'accept'|'reject', visibility?, confirmFindings?: string[] (every high finding as rule:line), note? }`; accept recomputes the hash and rescans (`skill.hash_mismatch`, `skill.scan_blocking`); making public at accept needs the same confirmation as OVE_SKUI010. Reject keeps the text for audit and hides the Skill from the library.

## 3. Scope (in)

- `review-strip.region.tsx` (slot `strip`) listing pending items with `ProposalBanner`-style rows.
- `ReviewSkillDialog` with preview, findings and the decision.
- `useSkillReview`.

## 4. Out of scope

- Chief proposals (OVE_SKUI013).

## 5. Detailed requirements

1. Strip: one row per pending version `Czeka na przegląd: {name} · {source} · skan: {severity}` with buttons `Przejrzyj` (opens the dialog); hidden when none; the strip also covers Chief-proposed versions of EXISTING Skills (pending version `n`), while NEW Chief proposals are handled by OVE_SKUI013.
2. Dialog sections: (1) banner `Treść niezaufana: nic z tego nie jest używane, dopóki nie zaakceptujesz`; (2) metadata (`źródło: import · host`, hash first 8 chars, `fetchedAt`); (3) read-only `MarkdownPreview` of the full text (scroll); (4) scan findings table (severity word, rule, line, excerpt, message) with `high` rows marked by word and icon, not colour alone; (5) a `CheckboxRow` per `high` finding `Rozumiem to ryzyko: {rule}:{line}`; (6) name and description shown read-only (renaming is a later edit).
3. Accept button `Akceptuj jako prywatny` is disabled until EVERY `high` finding is individually ticked; body `{ decision:'accept', confirmFindings:[...rule:line] }` (default stays private; making it public is a later explicit action, OVE_SKUI010).
4. Reject button `Odrzuć` with optional note; confirm not needed (reversible by re-import); body `{ decision:'reject', note? }`.
5. Errors: `skill.scan_blocking` (a finding appeared on rescan: list refreshes and ticks reset), `skill.hash_mismatch` (message `Treść zmieniła się po imporcie. Zaimportuj ponownie`, audited server-side), `skill.not_pending_review`.
6. `derivedFromExternal` or `source.kind=chief` provenance flag, when present, is shown as a word line (`Chief oparł treść na zewnętrznych dokumentach`).
7. Decision happens only from the desktop; no Telegram path exists in this UI.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:ProposalBanner`, `ui:Dialog`, `ui:MarkdownPreview`, `ui:DataTable`, `ui:CheckboxRow`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/review-strip.region.tsx`, `components/ReviewSkillDialog.tsx`, `state/use-skill-review.ts`.

## 9. Security and safety

Skill text is instructions that will later steer an Agent, so it is the most sensitive untrusted text in the product (ADR 0012: Skills from the internet come only from the Owner and are untrusted until accepted). The UI shows it only as plain text (no Markdown-to-HTML, no links made clickable inside the text), never includes it in any prompt or request other than the explicit Owner action, and a Skill chip or `requiredTools` list is metadata, never a permission. Acceptance of findings is per finding and never a single `accept all` checkbox, so a malicious `high` finding cannot be approved by habit. The decision body carries only enum values and finding keys, never text. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Item decided in another window: row disappears, dialog shows `Już rozstrzygnięte`.
- Scan has zero findings: accept is immediately enabled.
- Very large finding list (50): table scrolls, ticks keep state.
- Rescan returns a new `high` finding at accept: the dialog reloads findings and requires the new tick.

## 11. Acceptance criteria

- [ ] Given two `high` findings, Then accept is enabled only after both are ticked and the body lists both keys.
- [ ] Given a reject, Then the Skill leaves the review strip and the library shows no entry for the rejected new Skill.
- [ ] Given `hash_mismatch`, Then the message appears and accept is impossible.
- [ ] Given an HTML payload in the text, Then it is displayed as text.
- [ ] Given a pending import, Then it appears in the strip with the word `oczekuje`, not as an ordinary card.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `ReviewSkillDialog.test.tsx` (per-finding gating, errors), `review-strip.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: name/description are not editable in the review step in MVP; SKILL007 says the Owner confirms name and description in the review step: if so, two read-only-by-default fields can be added here (reported to SKILL).
- GAP: DS has no `ReviewStrip`/pending Skill card; rows reuse `ui:ProposalBanner` (DS082).
