---
id: OVE_DECUI006
title: "Decision detail region: problem, alternatives, rationale, participants, Skills, risks"
area: DECUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI003, OVE_DECUI003, OVE_DECUI005, OVE_DS016, OVE_DS018, OVE_DS022, OVE_DS032, OVE_DS040, OVE_DS065]
soft_depends_on: []
provides: ["lib:decision-detail-region"]
needs: ["ui:DecisionDetail", "ui:AlternativeCard", "ui:SectionLabel", "ui:AvatarStack", "ui:SkillUsedChip", "ui:LinkRow", "ui:EmptyState", "ui:Skeleton", "lib:feature-regions", "lib:use-decision-detail"]
owns: ["apps/desktop/src/features/decisions/regions/detail.region.tsx", "apps/desktop/src/features/decisions/components/DecisionDetailPanel.tsx", "apps/desktop/src/locales/en/decisions-detail.json", "apps/desktop/src/locales/pl/decisions-detail.json"]
reads: []
design: design.png
design_source: "Decyzje#decis/detail (crop 472,117,968,783 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8, 14]
---

# OVE_DECUI006: Decision detail region: problem, alternatives, rationale, participants, Skills, risks

## 1. Summary

Renders the selected Decision in the main column with `ui:DecisionDetail`: header meta, title, the PROBLEM, ALTERNATYWY (chosen one marked), UZASADNIENIE, participants, Skills with versions, confidence, assumptions, risks and the supersede link row.

## 2. Context

Mock region `decis/detail` (968px column, scrolls): meta row `D-14 · Aplikacja rezerwacji · Run #11`, status pill, `Zastąp nową Decyzją`, title 26/700, sections with `SectionLabel`s, three `AlternativeCard`s (`date-fns` chosen with `wybrana`), participants avatar, `TypeScript v4` Skill chip, `średnia · 0,7`, assumptions and risks, outcome card (separate task OVE_DECUI007) and `Zastępuje: D-03 · Biblioteka dat: moment (Strona fundacji)`. Skills used with their versions are mandatory for tracing bad Decisions to instructions (ADR 0008).

## 3. Scope (in)

- `detail.region.tsx` (slot `main`, order 10) and `DecisionDetailPanel` that maps `useDecisionDetail` to `DecisionDetailProps` (without outcome/verdict/supersede actions, which later tasks inject through optional props).
- Run link, Workspace name, links to superseded/superseding Decisions.
- Empty selection and not-found states (loading skeleton included).

## 4. Out of scope

- Outcome card and verdict (OVE_DECUI007), accept/reject (OVE_DECUI008), supersede (OVE_DECUI009/010), banner and history (OVE_DECUI011), review date (OVE_DECUI012).

## 5. Detailed requirements

1. Map with `decisionViewToDetail`; all section strings from `decisions:section.*`; `run` = `RunLink` to `routes.run(runId)` when `runId` exists, with prefix `Run`; Workspace name plain text.
2. The panel composes optional extension props `actionsSlot`, `outcomeSlot`, `bannerSlot`, `historySlot` (ReactNodes) filled by the later tasks through the dialogs-context store `useDecisionSlots()` defined here in `components/slots.ts` (regions register nodes; this keeps files separate). If a slot is empty nothing renders.
3. Sections hide when empty (assumptions, risks); `thin` shows the note.
4. `supersedes` link: `LinkRow` label `Zastępuje:`; content `D-03 · Biblioteka dat: moment` plus `(Strona fundacji)` when the Workspace name is visible; click selects that Decision. Same for `supersededBy`.
5. Participants and Skills are plain chips; clicking a Skill chip navigates to the Skill library with the Skill selected (`routes.skill(skillId)`), clicking a participant Agent goes to `routes.agent(agentId)` if the Agent still exists in the active Workspace (private Agents of other Workspaces are not linked).
6. Scrolling: only the main column scrolls; the sticky header row (ui-kit) shows id/status/actions.
7. Title is the page `h1`; document title updated.
8. Selection change moves focus to the detail heading only when the change was caused by keyboard Enter in the list (otherwise focus stays), and announces the title via the live region.
9. There is no edit, delete or `Przywróć` control anywhere in this region (ADR 0008); invariant test shared with OVE_DECUI004.

## 6. Design notes

`design.png` is the whole detail column for D-14 (accepted). Component styles are in OVE_DS065. Not in the mock: loading skeleton, no selection (`Wybierz Decyzję z listy`), not found, thin-Decision note, hover/focus on links.

## 7. Reuse

`ui:DecisionDetail`, `ui:AlternativeCard`, `ui:LinkRow`, `ui:SkillUsedChip`, `ui:RunLink`; mappers; hooks.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/DecisionDetailPanel.tsx`, `components/slots.ts` (slot store for later tasks), `regions/detail.region.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Participant Agent archived: chip without link.
- Skill later archived: chip shows name and version, link disabled.
- Alternatives all with the same title: shown as is.
- `supersedes` target in an isolated Workspace not visible: shown as `D-03` without title/Workspace (ref has nulls).

## 11. Acceptance criteria

- [ ] Given the D-14 fixture, Then the column matches `design.png` within tolerance and strings equal the mock.
- [ ] Given a superseded Decision, Then `supersededBy` link is present (banner in OVE_DECUI011).
- [ ] Given an empty selection, Then the empty state shows.
- [ ] Given axe, Then zero violations; headings order h1 > section labels.
- [ ] Given the invariant test, Then no delete/edit control exists.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `DecisionDetailPanel.test.tsx`, `detail.region.test.tsx`, visual test against `design.png`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. The slot store `components/slots.ts` is the extension point used by OVE_DECUI007-012.

## 14. Open questions and assumptions

- ASSUMPTION: Skill chips link to the Skill library; if the Skill is private to another Workspace it is not linked.
