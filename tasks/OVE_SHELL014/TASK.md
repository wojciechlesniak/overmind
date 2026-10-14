---
id: OVE_SHELL014
title: "Wire the sub-tabs bar for Workflow, Agents and Settings sections"
area: SHELL
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS035, OVE_DS045, OVE_SHELL007, OVE_SHELL009, OVE_SHELL010, OVE_SHELL012, OVE_SHELL013]
soft_depends_on: []
provides: ["ui:ShellSubTabs"]
needs: ["ui:SubTabs", "ui:Tabs", "lib:i18n-provider"]
owns: ["apps/desktop/src/app/nav/tabs-slot.tsx", "apps/desktop/src/app/nav/last-tab.ts"]
reads: []
design: design.png
design_source: "Main#shell/tab-bar (crop 72,117,1368,45); design-settings.png = Ustawienia#shell/tab-bar (crop 72,67,1368,45)"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [28]
---

# OVE_SHELL014: Wire the sub-tabs bar for Workflow, Agents and Settings sections

## 1. Summary

Registers the tabs slot: renders `ui:SubTabs` below the top bar for the slots that have sub-tabs (Workflow: Canvas | Runy i Activity; Agenci: Agenci | Skille; Ustawienia: Ten Workspace | Połączenia i modele | Aplikacja), with route links and the correct active tab.

## 2. Context

VIEWS shell: the tab bar (`nav[aria-label="Sekcje"]`, 1368x45 at x=72) sits at y=117 in the 117px layout and y=67 in the one-row layout (E1 makes the top bar always 67px, so the tab bar is always at y=67). DS045 `SubTabs` is a navigation (links, `aria-current="page"`), not an ARIA tablist, because each tab is a route; the underline is violet (E5: violet = selection, magenta reserved for 'working'). Tab sets come from OVE_SHELL009 (`TAB_SETS`, manifests). Settings tabs: 'Ten Workspace' (`/settings/workspace`), 'Połączenia i modele' (`/settings/connections`), 'Aplikacja' (`/settings/app`).

## 3. Scope (in)

- `TabsSlotImpl` registered with `registerShellSlot('tabs', ...)`.
- Active tab resolution from the route table and links via `renderLink`.
- Hiding the bar when the active slot has no tabs or only one available tab.
- Tab labels: the feature manifests provide `labelKey` per tab; this task provides the nav landmark label and fallbacks for tabs whose feature is not installed (hidden).
- i18n keys in `shell.json` group `tabs.*` (append-only edit of the file created by OVE_SHELL013).

## 4. Out of scope

- The `SubTabs` component (OVE_DS045).
- Tab content/pages (feature tasks).
- Closable or reorderable tabs (not in the product).

## 5. Detailed requirements

1. Rendering: `<SubTabs items={tabs.map(t => ({ id: t.id, label: t(t.labelKey), href: t.to }))} activeId={activeTabId} renderLink={routerLink} aria-label={t('a11y:tabs.label')} />`; `a11y:tabs.label` 'Sections' / 'Sekcje' (the mock's aria label).
2. Tab labels (owned by the feature manifests, listed so the PL copy matches the mocks): Canvas / 'Canvas'; Runs and Activity / 'Runy i Activity'; Agents / 'Agenci'; Skills / 'Skille'; This Workspace / 'Ten Workspace'; Connections and models / 'Połączenia i modele'; App / 'Aplikacja'.
3. Active tab: the tab whose route has the longest path prefix match with the location (`/workflow/runs/14` -> `runs`).
4. Bar visibility: shown when `TAB_SETS` has the active slot AND at least 2 tabs are available; a slot with a single available tab hides the bar (so a half-built product does not show a lone tab).
5. Memory of last tab per slot is written to the in-memory map used by the rail (SHELL013) via `rememberTab(slotId, tabId)` exported from `app/nav/last-tab.ts` (owned by SHELL013? it is created here: this task owns `last-tab.ts`, SHELL013 imports it; if SHELL013 merges first it creates a local stub and this task replaces it).
6. Keyboard: tabs are links in DOM order; Left/Right arrows are NOT added (they would suggest an ARIA tablist; DS045 note); Tab and Enter work; focus ring per DS.
7. Layout: DS045 sets height 45 (44px item + 1px border), padding 0 20, `bg-panel`, border-bottom `line-subtle`; this task only passes data. When the bar is visible the content area height is reduced by 45px (handled by PageLayout).
8. Test hooks: `data-testid="shell-subtabs"` on the nav (stable for Playwright).
9. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` = the tab bar of the Workflow view (Canvas active, 'Runy i Activity' inactive) at 1368x45; `design-settings.png` = the three-tab bar of the Settings area (App settings). Active tab: text `text-primary` with a violet 2px underline (E5 overrides the magenta underline drawn in the mocks); inactive `text-secondary`. States not in the mock: hover (text brightens, underline `line-strong`), focus-visible ring, pressed, tab whose feature is not installed (hidden), long labels (ellipsis with title).

## 7. Reuse

- `ui:SubTabs`/`ui:Tabs` (DS045/035), nav model (SHELL009), router link, slots (SHELL012), `last-tab.ts` shared with the rail.
- Never hard-code labels in this file: labels come from `t(labelKey)` of each manifest.

## 8. Architecture and code placement

`apps/desktop/src/app/nav/tabs-slot.tsx`, `apps/desktop/src/app/nav/last-tab.ts`, append-only keys to `shell.json` (`tabs.*`). UI layer.

## 9. Security and safety

- Navigation only; no data. Labels are static.
- Route targets restricted to the route table.

## 10. Errors and edge cases

- Settings tab for an uninstalled feature: hidden.
- Deep link directly to `/settings/connections`: the right tab is active.
- Window narrower than all tabs: horizontal overflow hidden with ellipsis (DS045 flex), no wrapping.
- Unknown tab route: no active tab (nothing underlined).

## 11. Acceptance criteria

- [ ] Given `/workflow` then 'Canvas' is underlined and has `aria-current="page"`.
- [ ] Given `/settings/app` then the bar shows three tabs with 'Aplikacja' active.
- [ ] Given `/board` then no tab bar is rendered.
- [ ] Given only one tab available then the bar is hidden.
- [ ] Tab order and Enter activation work; focus ring visible.
- [ ] Bar region matches the crop within tolerance (underline colour per E5).

## 12. Test plan

- Vitest: active-tab table, visibility rules, last-tab memory.
- Storybook: `Shell/SubTabs` for the three sets; play test: keyboard.
- Visual: `design.png`, `design-settings.png`. Commands: `pnpm --filter @overmind/desktop test nav`.

## 13. Parallelization notes

Parallel with SHELL013 (shared `last-tab.ts` hand-off documented above) and SHELL016. Depends on the frame slots.

## 14. Open questions and assumptions

- OPEN: shared `last-tab.ts` ownership between SHELL013 and SHELL014; default this task owns it.
- DESIGN: E5 overrides the mock's magenta underline with violet (inventory section E wins).
