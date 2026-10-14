---
id: OVE_SKUI005
title: "Library grid region: filter chips, Skill cards and states"
area: SKUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS032, OVE_DS071, OVE_SKUI001, OVE_SKUI002, OVE_SKUI003]
soft_depends_on: []
provides: ["lib:skills-grid-region"]
needs: ["ui:SkillFilterBar", "ui:SkillGrid", "ui:SkillCard", "ui:EmptyState", "lib:use-skill-library", "lib:skill-view-models", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/regions/grid.region.tsx", "apps/desktop/src/features/skills/regions/filters.region.tsx", "apps/desktop/src/features/skills/components/SkillLibraryPanel.tsx", "apps/desktop/src/locales/en/skills-grid.json", "apps/desktop/src/locales/pl/skills-grid.json"]
reads: []
design: design.png
design_source: "Skille#skills/filter-chips + skills/grid (crop 88,334,996,480 CSS px) (crop 88,334,996,480 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [28, 12]
---

# OVE_SKUI005: Library grid region: filter chips, Skill cards and states

## 1. Summary

Renders the filter bar (`Wszystkie`, `Publiczne · 6`, `Prywatne · 2`, `Właściciel · 4`, `Chief · 2`, `import · 2`) and the responsive card grid with visibility word, version, source tag, description and the Agent stack with usage.

## 2. Context

Mock regions `skills/filter-chips`, `skills/grid`, `skills/card` (source tag `import` amber), `skills/card-selected` (violet 1.5px ring, tag `Właściciel`), `skills/card-private-chief` (PRYWATNY, Chief magenta tag). Component logic: OVE_DS071. The `skills/card-agent-stack` note in VIEWS says the stack collapses in the mock: the real card shows up to 4 avatars plus `+N`.

## 3. Scope (in)

- `filters.region.tsx` (slot `filters`) and `grid.region.tsx` (slot `grid`) using the library and filter hooks.
- Loading, empty, no-results states.

## 4. Out of scope

- Inspector (OVE_SKUI006).

## 5. Detailed requirements

1. The filter bar value/onChange bind to `useSkillFilters`; counts from `skillFilterCounts`; the visibility group behaves as a radio set, origins as multi-toggle (ui-kit).
2. Cards from `skillToCard`; click selects (URL), Enter/Space activate; `aria-current` on the selected one; roving focus across the grid with arrow keys (2D grid navigation: Left/Right by 1, Up/Down by the number of columns computed from the grid width).
3. The builtin `overmind` Skill is a `system` card with the lock tag `systemowy`; because ADR 0028 requires the visibility word everywhere, the card keeps the word `PUBLICZNY` (see Open questions) and is selectable (read-only inspector).
4. Loading: 6 card skeletons; empty library: `Brak Skilli. Zaimportuj lub poproś Chiefa o propozycję.` plus the Import button; no results after filtering: `Brak Skilli dla tych filtrów` and `Wyczyść filtry`.
5. Skill descriptions and names are untrusted text rendered by ui-kit as text nodes.
6. Pending versions: a Skill with `latestVersion > currentVersion` shows the word `nowa wersja czeka` in the card footer (mapper) so the Owner finds the review (OVE_SKUI012).
7. No drag source here: the drag handle for the workflow canvas belongs to WFED; assignment to Agents is done on the Agent profile (OVE_AGUI009).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:SkillFilterBar`, `ui:SkillGrid`, `ui:SkillCard` (OVE_DS071).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/filters.region.tsx`, `regions/grid.region.tsx`, `components/SkillLibraryPanel.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Two cards with the same name in public/private scope (not allowed by SKILL001 uniqueness per scope): both shown, the visibility word disambiguates.
- Hundreds of Skills: the grid scrolls; no virtualisation in MVP (library is small).
- Resize: columns follow `auto-fill minmax(250px,1fr)`.

## 11. Acceptance criteria

- [ ] Given the eight fixture Skills, Then grid and chips match `design.png` within tolerance.
- [ ] Given `Prywatne` chip, Then only PRYWATNY cards remain and the chip is `aria-pressed`.
- [ ] Given keyboard Down on a card, Then focus moves to the card below.
- [ ] Given no results, Then `Wyczyść filtry` resets the filters.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `SkillLibraryPanel.test.tsx` (filters, selection, grid keyboard, empty states). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to DS071): `SkillGrid` is a plain `<ul>`; 2D arrow navigation is implemented here with column count measured from the DOM, a ui-kit grid helper would be better.
- ASSUMPTION: auto-select of the first card on wide windows (mock shows one selected).
