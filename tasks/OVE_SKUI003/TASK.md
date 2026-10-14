---
id: OVE_SKUI003
title: "Skills route frame: main column, inspector and region slots"
area: SKUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI003, OVE_DS044, OVE_SHELL012, OVE_SKUI002]
soft_depends_on: []
provides: ["lib:skills-route"]
needs: ["ui:PageLayout", "ui:SidePanel", "lib:shell-page", "lib:feature-regions", "lib:use-skill-library"]
owns: ["apps/desktop/src/features/skills/routes/SkillsRoute.tsx", "apps/desktop/src/features/skills/regions/index.ts", "apps/desktop/src/features/skills/routes/dialogs-context.ts"]
reads: []
design: design.png
design_source: "Skille#skills/main + skills/inspector (page frame) (crop 72,117,1368,783 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [12, 28]
---

# OVE_SKUI003: Skills route frame: main column, inspector and region slots

## 1. Summary

Builds the lazy `SkillsRoute`: the main column (header, proposal strip, filters, grid) and the 340px inspector with region slots, plus the dialogs context.

## 2. Context

Mock regions `skills/main` (72,162,1028x738) and `skills/inspector` (1100,162,340x738). The main column scrolls inside; the inspector is a `SidePanel` right. Regions are separate files so several agents implement them in parallel.

## 3. Scope (in)

- `SkillsRoute` composing `ShellPage` with `RegionSlot`s `header`, `strip` (Chief proposal and review banners), `filters`, `grid`, `inspector`, `dialogs`, `live`.
- `SkillsProvider` and `useSkillDialogs()` (`openImport()`, `openCreate()`, `openEdit(id)`, `openVisibility(id,to)`, `openDetach(id)`, `openReview(skillId, version)`, `openProposal(proposalId)`).
- `regions/index.ts` glob (`./*.region.tsx` and `../live/*.region.tsx`).

## 4. Out of scope

- Region content (OVE_SKUI004..014).

## 5. Detailed requirements

1. Main column padding 24 and gap 16 (mock 96px left edge), scroll inside the panel, page never scrolls; inspector 340 wide fixed; below 1100 px the inspector opens as an overlay panel (`SidePanel` modal variant) when a card is selected.
2. `SkillsProvider` exposes `{ library, filters, selectedId, select }` and the dialogs context; it does not fetch the inspector (OVE_SKUI006 does).
3. Unknown regions are ignored; a throwing region shows the shell `ErrorBoundary` only for itself.
4. Page title through `usePageTitle(t('skills:title'))`.
5. Escape closes the overlay inspector (narrow widths) and returns focus to the selected card.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:PageLayout`, `ui:SidePanel`, `ShellPage`; regions helper OVE_BOARDUI003.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `routes/SkillsRoute.tsx`, `routes/dialogs-context.ts`, `regions/index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Nothing selected: inspector shows `EmptyState` `Wybierz Skill` (OVE_SKUI006).
- Resize across the 1100 px breakpoint while an overlay is open: switches to the docked layout without losing selection.

## 11. Acceptance criteria

- [ ] Given the route, Then main and inspector render with the mock widths.
- [ ] Given a new `regions/x.region.tsx`, Then it appears without editing this task's files.
- [ ] Given narrow width and a card click, Then the inspector opens as an overlay with focus inside.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `SkillsRoute.test.tsx` (layout, overlay), `dialogs-context.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Hotspot file `regions/index.ts` is a glob and never edited by other tasks.

## 14. Open questions and assumptions

- ASSUMPTION: the narrow-width overlay behaviour (not in the mock).
