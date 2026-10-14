---
id: OVE_DECUI003
title: "Decisions route frame: list column, main column and region slots"
area: DECUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI003, OVE_DECUI002, OVE_DS044, OVE_SHELL012]
soft_depends_on: []
provides: ["lib:decisions-route"]
needs: ["ui:PageLayout", "ui:SidePanel", "lib:shell-page", "lib:feature-regions", "lib:use-decision-list"]
owns: ["apps/desktop/src/features/decisions/routes/DecisionsRoute.tsx", "apps/desktop/src/features/decisions/regions/index.ts", "apps/desktop/src/features/decisions/routes/dialogs-context.ts"]
reads: []
design: design.png
design_source: "Decyzje#decis/list + decis/detail (page frame) (crop 72,117,1368,783 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI003: Decisions route frame: list column, main column and region slots

## 1. Summary

Creates the lazy `DecisionsRoute`: a shell page with the 400px list column and the main column for the Decision detail, composed from auto-discovered regions.

## 2. Context

Mock `Decyzje`: list column 400px (`decis/list`) and detail main 968px (`decis/detail`) with no right panel; the rail item `Rejestr decyzji` is active (y=274). The frame follows the same region approach as the Board (OVE_BOARDUI003).

## 3. Scope (in)

- `DecisionsRoute` with `ShellPage` (`listWidth=400`, no detail panel, `mainPadding` per DS), `RegionSlot list|main|overlay`.
- Dialog signals context (`useDecisionDialogs`: `open('supersede')`, `open('reject')`, `announce`).
- Selection from URL provided to regions through props.

## 4. Out of scope

- Content of the regions (later tasks), manifest (OVE_DECUI014).

## 5. Detailed requirements

1. `DecisionsRoute` default export renders `<ShellPage layout={{ listWidth: 400, mainPadding: 'page' }} list={<RegionSlot name="list" .../>}>`; main shows `RegionSlot main`; `overlay` outside. Props passed to regions: none (they read hooks from `state/index.ts`).
2. `regions/index.ts`: `import.meta.glob('./*.region.tsx', { eager: true })` plus `'../live/*.region.tsx'` for the live/states task.
3. `useDecisionDialogs` context offers `open(kind, payload)`, `close()`, `current`, `announce(text)` and a hidden `aria-live="polite"` region rendered by the route.
4. The page `h1` is the main column Decision title (set by the detail region); the list heading is an `h2` (`Rejestr decyzji`) inside the list column to respect the single-`h1` rule: ASSUMPTION, matches DS064 where the list title is 24/700.
5. Document title: `Rejestr decyzji` or `D-14 · <title>` when selected (via shell `usePageTitle`).
6. Keyboard: skip link target `main`; focus order list -> detail.
7. Below 1100px width the list column collapses to a drawer is NOT built (OPEN question 7: only 1440 is designed); the layout uses the DS horizontal scroll rule.

## 6. Design notes

`design.png` shows the full page body: list 400px on the left with title, subtitle, search, chips and rows; main column with the selected Decision. This task only builds the frame; each column's content is another task. No new styles.

## 7. Reuse

`ui:PageLayout`, `ui:SidePanel` through `ShellPage`; `RegionSlot` (OVE_BOARDUI003).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `routes/DecisionsRoute.tsx`, `routes/dialogs-context.ts`, `regions/index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- No selection and empty list: main shows the states region content.
- Region crash: boundary with retry.
- Route opened with `?id=` of a missing Decision: detail region shows not found.

## 11. Acceptance criteria

- [ ] Given the route, Then two columns render at 400px and the remaining width.
- [ ] Given a region file, Then it is picked up without editing the route.
- [ ] Given `?id=`, Then regions receive the selection through hooks.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `DecisionsRoute.test.tsx` (slots, dialogs context, live region). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Hotspot: the route file is owned here only.

## 14. Open questions and assumptions

- OPEN question 7 (window width below 1280) not designed; default as DS044.
