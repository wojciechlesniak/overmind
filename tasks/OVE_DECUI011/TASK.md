---
id: OVE_DECUI011
title: "Superseded banner, supersede chain navigation and Decision history timeline"
area: DECUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI003, OVE_DEC011, OVE_DECUI005, OVE_DECUI006, OVE_DS040, OVE_DS063]
soft_depends_on: []
provides: ["lib:decision-history-ui"]
needs: ["ui:Timeline", "ui:CalloutAmber", "ui:LinkRow", "api:decision.history", "lib:use-decision-detail", "lib:feature-regions"]
owns: ["apps/desktop/src/features/decisions/regions/history.region.tsx", "apps/desktop/src/features/decisions/components/SupersededBanner.tsx", "apps/desktop/src/locales/en/decisions-history.json", "apps/desktop/src/locales/pl/decisions-history.json"]
reads: []
design: design.png
design_source: "Decyzje#decis/supersedes-link (crop 492,786,928,36 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI011: Superseded banner, supersede chain navigation and Decision history timeline

## 1. Summary

Adds the read-only banner for superseded Decisions, the chain links (`Zastępuje:` / `Zastąpiona przez`) and a collapsible `Historia` section showing every status change, outcome proposal, verdict and review date as an immutable timeline.

## 2. Context

Superseded Decision detail (read-only banner) is listed as not drawn in VIEWS.md. DS065 provides `supersededBy` (banner, all controls disabled except links). The history is the append-only event list of the Decision; it is the audit of the Owner's own verdict changes (ADR 0008). The mock bottom row shows `Zastępuje: D-03 · Biblioteka dat: moment (Strona fundacji)`.

## 3. Scope (in)

- `SupersededBanner` and slot registration for `bannerSlot`.
- `Historia` section (`ui:Timeline`) for `historySlot` with lazy load.
- Chain navigation helper that can walk up to 10 steps (`D-14 -> D-03 -> ...`) by repeated `select`.

## 4. Out of scope

- Editing history (impossible by design), exporting history (backup area).

## 5. Detailed requirements

1. Banner (`CalloutAmber`, `role=note`): `Ta Decyzja została zastąpiona przez D-17` with a link to the successor; shown when `view.supersededBy` exists; text key `decisions-history:superseded`. All mutation controls elsewhere are disabled by their own tasks using `status === 'superseded'`.
2. `Historia` section collapsed by default (`<details>`-like disclosure with `aria-expanded`), label `HISTORIA`; expanding loads history (hook `withHistory`).
3. Timeline entries via `historyToTimeline`: tone mint for accepted/positive, amber for needs_review/mixed, error for rejected/negative, neutral otherwise; each entry shows time (OS zone), actor (`Ty`, `Chief`, agent name), short text; `outcome_verdict` entries show previous -> new outcome (`mieszany` -> `pozytywny`); `evidence_added` shows evidence label only.
4. Chain: below the timeline `LinkRow`s `Zastępuje:` and `Zastąpiona przez:` (from refs); if a ref has a null Workspace name only `D-xx` and the title are shown.
5. Entries are read-only; there is no `Cofnij` and no delete; a test asserts the absence of interactive controls inside the timeline.
6. History pagination: first 50 events; `Pokaż starsze` if more (cursor).

## 6. Design notes

`design.png` shows the bottom row `Zastępuje: D-03 · Biblioteka dat: moment (Strona fundacji)` as a link row (12px label + lavender link). The banner and timeline are derived: banner = `ui:CalloutAmber` full width at the top of the detail; timeline = `ui:Timeline` (8px dots, mono 11 time, 13px text).

## 7. Reuse

`ui:Timeline`, `ui:CalloutAmber`, `ui:LinkRow`, `useDecisionDetail` (history).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/SupersededBanner.tsx`, `regions/history.region.tsx` (registers banner and history into the slot store from OVE_DECUI006).

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- History empty (defensive): section hidden.
- Successor in an isolated Workspace not visible: link text `D-17` only (null Workspace), still navigable if the Owner can see it (Owner always can).
- Chain cycle (should not exist): walker stops after 10 steps.

## 11. Acceptance criteria

- [ ] Given a superseded Decision, Then the banner with a working successor link shows.
- [ ] Given expanding `Historia`, Then events appear chronologically with actors and tones.
- [ ] Given the timeline, Then there are no interactive controls except the optional `Pokaż starsze`.
- [ ] Visual match of the link row with `design.png`.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `SupersededBanner.test.tsx`, `history.region.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: history collapsed by default to keep the detail short.
