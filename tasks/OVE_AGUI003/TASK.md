---
id: OVE_AGUI003
title: "Agents route frame: list, profile and memory columns with region slots"
area: AGUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGUI002, OVE_BOARDUI003, OVE_DS044, OVE_SHELL012]
soft_depends_on: []
provides: ["lib:agents-route"]
needs: ["ui:PageLayout", "ui:SidePanel", "lib:shell-page", "lib:feature-regions", "lib:use-agent-list"]
owns: ["apps/desktop/src/features/agents/routes/AgentsRoute.tsx", "apps/desktop/src/features/agents/regions/index.ts", "apps/desktop/src/features/agents/routes/dialogs-context.ts"]
reads: []
design: design.png
design_source: "Agenci#agents/list + agents/profile + agents/memory-panel (page frame) (crop 72,117,1368,783 CSS px)"
spec_refs: ["SPECIFICATION 9"]
adr_refs: [28]
---

# OVE_AGUI003: Agents route frame: list, profile and memory columns with region slots

## 1. Summary

Builds the lazy `AgentsRoute`: the three-column frame (list 290, profile scrolling, Agent Memory panel 310) with region slots, the dialogs context and the shared `selected Agent` provider.

## 2. Context

The mock shows `Agenci` under the shell tab bar: left `agents/list` (72,162,290x738), centre `agents/profile` (362,162,768x738, scrolls) and right `agents/memory-panel` (1130,162,310x738). Regions are separate files so many agents can implement them in parallel (OVE_BOARDUI003 `defineRegion`).

## 3. Scope (in)

- `AgentsRoute` (default export, lazy) composing `ShellPage` with `RegionSlot`s `list`, `profile`, `memory`.
- `AgentsProvider`: list hook + selected id + a `useAgentDialogs()` context (`openCreate()`, `openAccept(id)`, `openDecline(id)`, `openVisibility(id, to)`).
- `regions/index.ts` with `import.meta.glob('./*.region.tsx', { eager: true })` plus `../live/*.region.tsx`.

## 4. Out of scope

- Region content (OVE_AGUI004..014), manifest (OVE_AGUI016).

## 5. Detailed requirements

1. Frame geometry from the mock: list 290 wide with padding 20/21, profile `min-width: 0` flexible with internal scroll (page itself never scrolls, styl-wizualny), memory 310; below 1100 px width the memory panel collapses under the profile as a tab (key `agents:tab.memory` already exists in the profile tabs).
2. Slots: `list`, `profile`, `memory`, `dialogs` (renders null region-defined dialogs), `live` (announcer). Unknown region names are ignored; a region that throws renders the `ErrorBoundary` fallback of the shell for that column only.
3. `AgentsProvider` exposes `{ agents, selectedId, select, selected, tab, setTab }` and the dialogs context; it does not fetch the profile (OVE_AGUI005 does).
4. Unsaved-changes guard: the provider registers a `beforeSelectionChange` check; the profile region (OVE_AGUI005) sets `dirty`; selecting another Agent while dirty opens the confirm dialog `Masz niezapisane zmiany` (ui `ConfirmDialog`, keys `agents:guard.*`) with `Zostań`/`Odrzuć zmiany`; route leave uses the shell route-guard slot.
5. Page title via `usePageTitle(t('agents:title'))`.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:PageLayout`, `ui:SidePanel`, `ShellPage`; regions helper OVE_BOARDUI003.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `routes/AgentsRoute.tsx`, `routes/dialogs-context.ts`, `regions/index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- No Agent selected: profile shows `EmptyState` `Wybierz Agenta` (region AGUI005 renders it).
- Window narrower than 1000 px: columns stack with list on top; keyboard order unchanged (list, profile, memory).
- Region file missing: the column renders its empty state, no crash.

## 11. Acceptance criteria

- [ ] Given the route, Then three columns render with the mock widths.
- [ ] Given a dirty profile, When another row is chosen, Then the discard dialog appears and the selection changes only after `Odrzuć zmiany`.
- [ ] Given a new `regions/x.region.tsx`, Then it appears without editing this task's files.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `AgentsRoute.test.tsx` (layout, guard), `dialogs-context.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Hotspot file `regions/index.ts` is a glob and is never edited by other tasks.

## 14. Open questions and assumptions

- ASSUMPTION: below 1100 px the memory panel becomes a profile tab.
