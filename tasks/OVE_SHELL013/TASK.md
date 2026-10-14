---
id: OVE_SHELL013
title: "Wire the app rail: seven icons, active state, tooltips and remembered tab targets"
area: SHELL
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS009, OVE_DS010, OVE_DS028, OVE_DS041, OVE_SHELL007, OVE_SHELL009, OVE_SHELL010, OVE_SHELL012]
soft_depends_on: []
provides: ["ui:ShellRail", "lib:use-active-rail-id"]
needs: ["ui:AppRail", "ui:RailItem", "ui:LogoTile", "ui:Tooltip", "ui:Icon", "lib:i18n-provider"]
owns: ["apps/desktop/src/app/nav/rail-slot.tsx", "apps/desktop/src/app/nav/use-active-rail-id.ts", "apps/desktop/src/locales/en/shell.json", "apps/desktop/src/locales/pl/shell.json"]
reads: []
design: design.png
design_source: "Pulpit#shell/rail (crop 0,0,72,900); design-main-active.png = Main#shell/rail (crop 0,0,72,900), active item Workflow"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [28]
---

# OVE_SHELL013: Wire the app rail: seven icons, active state, tooltips and remembered tab targets

## 1. Summary

Registers the rail slot: renders `ui:AppRail` from the navigation model (five primary icons, Agents below the divider, Settings pinned to the bottom), marks the active item from the current route, links with the router and provides the rail i18n labels.

## 2. Context

DS041 `AppRail` takes `primary`, `secondary`, `footer` entries, `activeId`, `renderLink` and a `labels.navigation` string and never imports a router. The seven slots, icons, order and aria labels come from OVE_SHELL009. Mock copy (VIEWS shell): labels `Workspace'y`, `Chief, czaty i Dyskusje`, `Workflow i Runy`, `Tablica Zadań`, `Rejestr decyzji`, `Agenci i Skille`, `Ustawienia`, nav label `Główna nawigacja`. Active y positions per view (74, 124, 174, 224, 274, 343, 840). Zgody has no active rail item. The rail badge for waiting Approvals is NOT a product requirement: the counter lives in the top bar (styl-wizualny), so no badge is shown by default.

## 3. Scope (in)

- `RailSlotImpl` registered with `registerShellSlot('rail', ...)` (SHELL012).
- Active slot resolution `useActiveRailId()` from the route table (longest prefix, `meta.nav`).
- Link rendering through `renderLink` using router `Link` (no full page reload, `aria-current` handled by `RailItem`).
- Remembering the last visited tab per slot IN MEMORY (module-level map) so clicking Workflow returns to Runs if you were there.
- i18n namespace file `shell.json` (EN + PL) with the rail labels and generic shell strings used by SHELL009-014.

## 4. Out of scope

- Rail component itself (OVE_DS041).
- Keyboard shortcuts for navigation (OVE_SHELL024).
- Rail badge (not in the product spec; the prop exists in DS041 and stays unused).

## 5. Detailed requirements

1. Entries: map `NavModel.rail.primary|secondary|footer` to `RailEntry { id, icon, label: t(labelKey) }`. Labels (EN / PL): `rail.workspaces` 'Workspaces' / 'Workspace\'y'; `rail.chief` 'Chief, chats and Discussions' / 'Chief, czaty i Dyskusje'; `rail.workflow` 'Workflow and Runs' / 'Workflow i Runy'; `rail.board` 'Task Board' / 'Tablica Zadań'; `rail.decisions` 'Decision Register' / 'Rejestr decyzji'; `rail.agents` 'Agents and Skills' / 'Agenci i Skille'; `rail.settings` 'Settings' / 'Ustawienia'; `a11y:rail.label` 'Main navigation' / 'Główna nawigacja'.
2. Active id: `useActiveRailId()` returns the slot id of the deepest matching route (`/chief/abc` -> `chief`; `/approvals` -> `undefined`; `/workflow/runs` -> `workflow`).
3. Link target: `entry.to` from the model; when the slot has tabs and a last-visited tab is stored in memory for this session the link goes there. Clicking the already-active item navigates to the slot's default route (acts as 'home' of the section).
4. Unavailable slots (`available: false`) still render and navigate (placeholder route); they carry `aria-describedby` text 'Not installed yet' only in development builds.
5. Visual spec reproduced by `ui:AppRail`: width 72, padding 16/12, items 44x44 r14, pitch 50 (y = 74, 124, 174, 224, 274), divider before Agents (y = 343), Settings at y = 840, logo tile 44 at the top (not focusable). This task passes no styling.
6. Tooltips: `RailItem` shows `ui:Tooltip` (right, 400 ms, also on keyboard focus); this task supplies only `label`.
7. Focus: after route change the focus moves to the page `main` heading by SHELL025, not back to the rail; the rail retains its roving Tab order.
8. Performance: the rail re-renders only when the active id changes (memoised entries).
9. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` = the full 72px rail from the Workspaces view (logo tile, Workspaces active with magenta-violet border and glow, then four inactive icons, divider, Agents, and Settings at the bottom). `design-main-active.png` = the same rail from the Workflow view (third icon active). Tokens: item inactive `text-secondary`, active `text-bright` on `bg-raised` with `line-strong` and `glow-rail-active`. States not in the mock: hover (fill `bg-surface`, border `line-strong`), focus ring (2px violet outside the 44px box), tooltip, pressed, disabled none, badge none.

## 7. Reuse

- `ui:AppRail`, `ui:RailItem`, `ui:LogoTile`, `ui:Tooltip` (DS041/028), nav model (SHELL009), router `Link`/`useMatches` (SHELL010), slots (SHELL012).
- Do not restyle rail items.

## 8. Architecture and code placement

`apps/desktop/src/app/nav/rail-slot.tsx` (in `app/nav` next to the model but owned by this task's own file names), `apps/desktop/src/app/nav/use-active-rail-id.ts`, `apps/desktop/src/locales/{en,pl}/shell.json` (this task creates the file with rail keys; SHELL014/019/025 add keys under their own top-level groups, one group per task, by append-only edits coordinated in section 14). UI layer.

## 9. Security and safety

- Rail labels are static i18n text; no user data.
- Navigation targets come from the route table only.
- Nothing here triggers actions with side effects (pure navigation).

## 10. Errors and edge cases

- Window width < 1100: rail unchanged (72px fixed).
- Slot disabled/unavailable: navigates to placeholder.
- Route `/settings/app`: Settings active (prefix rule).
- Fast double click: single navigation.
- RTL locales are out of scope (MVP en/pl).

## 11. Acceptance criteria

- [ ] Given `/` then the first item has `aria-current="page"` and the others do not.
- [ ] Given `/approvals` then no item has `aria-current`.
- [ ] Given `/workflow/runs` then Workflow is active and clicking it again goes to `/workflow` (Canvas).
- [ ] Given keyboard Tab then focus visits the seven items in visual order, Enter activates.
- [ ] Visible labels/tooltips use i18n (EN and PL) and pass the i18n lint.
- [ ] Rail region matches `design.png` within tolerance at 1440x900.

## 12. Test plan

- Vitest: `use-active-rail-id` table (paths -> id), remembered tab logic.
- Storybook: `Shell/Rail` with each active state; play test: keyboard traversal.
- Visual: crops `design.png` and `design-main-active.png` (TEST005). axe.
- Commands: `pnpm --filter @overmind/desktop test nav`.

## 13. Parallelization notes

Parallel with SHELL014 and SHELL016 after SHELL012. `shell.json` conflict risk: this task creates it; SHELL014/SHELL019/SHELL025 append their own keyed groups (`tabs.*`, `crash.*`, `route.*`) - merge conflicts are trivial JSON merges; the linker may prefer separate namespaces (`shell-tabs`) if the Owner chooses.

## 14. Open questions and assumptions

- ASSUMPTION: no rail badge in the MVP (the spec puts the pending counter in the top bar).
- OPEN: show the remembered tab or always the first tab; default remembered (matches how people navigate Workflow/Runs).
