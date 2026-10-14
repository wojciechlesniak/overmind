---
id: OVE_DS045
title: Build PageHeader and SubTabs composites (title row, badges, actions, section tabs)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS013, OVE_DS017, OVE_DS018, OVE_DS019, OVE_DS035, OVE_DS039, OVE_DS044]
soft_depends_on: []
provides: ["ui:PageHeader", "ui:SubTabs"]
needs: ["ui:tokens", "ui:Tabs", "ui:Text", "ui:Pill", "ui:VisibilityBadge", "ui:VersionBadge", "ui:Button", "ui:StatusPill"]
owns: ["packages/ui-kit/src/shell/PageHeader/**", "packages/ui-kit/src/shell/SubTabs/**"]
reads: []
design: design.png
design_source: "Main#shell/tab-bar + canvas/workflow-header (crop 330,117,802,151 CSS px); design-tabs.png = Main (crop 72,117,1368,45); design-eyebrow.png = Pulpit (crop 100,93,992,57)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [28]
---

# OVE_DS045: Build PageHeader and SubTabs composites (title row, badges, actions, section tabs)

## 1. Summary

Builds `SubTabs` (the section tab bar under the top bar with the three product tab sets) and `PageHeader` (title, eyebrow, meta chips, badges and right-aligned actions that wrap onto a second row on narrow widths).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C1.3 (SubTabs), C1.6 (PageHeader), B9 and E5/E7. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Tab sets in the product: Workflow = `Canvas | Runy i Activity`; Agents = `Agenci | Skille`; Settings = `Ten Workspace | Połączenia i modele | Aplikacja`. Inventory E5: ONE tabs look with the violet underline and 42px height (the mock's magenta SubTabs underline and the violet ProfileTabs are unified; magenta is reserved for 'working'). E7: page title 26/700/-0.52px (`title-page`).

## 3. Scope (in)

- `SubTabs` as a thin, routed wrapper over `ui:Tabs` (variant `page`) with the bar container styling.
- `PageHeader` with variants `plain`, `withEyebrow`, `withBadges`.
- Wrapping rules for the action group.

## 4. Out of scope

- The `Tabs` primitive (part 1, `ui:Tabs`, roving tabindex).
- Profile tabs inside Agent profile (OVE_DS068 uses `ui:Tabs` variant `profile`, also violet per E5).
- Feature-specific header content.

## 5. Detailed requirements

1. `SubTabs` props:
   ```ts
   interface SubTabItem { id: string; label: string; href?: string }
   interface SubTabsProps { items: SubTabItem[]; activeId: string; onChange?: (id: string) => void; renderLink?: (item: SubTabItem, content: ReactNode) => ReactNode; 'aria-label': string }
   ```
   Container = `<nav aria-label>` (mock label `Sekcje`), flex, gap 4, padding 0 20, background `bg-panel`, border-bottom 1px `line-subtle`, height 45 (44px tab + 1px border). It delegates the items to `ui:Tabs` (variant `page`): item min-height 42/44, padding 0 14, 14/600, bottom border 2px; active: text `text-primary` (#EFE9F7) + underline `#9B7BFF` (violet, E5 override of the mock's #F25FC4), inactive `text-secondary` transparent underline. Links use `renderLink`; keyboard: they are navigation links (Tab order, Enter), NOT an ARIA tablist, because each tab is a route; `aria-current="page"` on the active one. If `onChange` and no `href` are given it renders a real `role="tablist"` with roving tabindex via `ui:Tabs`.
2. `PageHeader` props:
   ```ts
   interface PageHeaderProps {
     title: ReactNode;               // h1, title-page 26/700/-0.52px
     eyebrow?: ReactNode;            // mono 12 text-muted, e.g. 'wtorek, 13 października' (formatted by caller)
     badges?: ReactNode;             // VisibilityBadge filled-sm, VersionBadge, StatusPill 'run'
     meta?: ReactNode;               // chips row under or next to title
     actions?: ReactNode;            // Buttons, right aligned
     level?: 1 | 2;                  // heading level, default 1
     size?: 'page' | 'display-sm' | 'section'; // 26 | 32 (Workspaces dashboard) | 24 (Decisions, Approvals)
   }
   ```
3. Layout: `display:flex; flex-wrap: wrap; align-items: center; gap: 12px 12px; row-gap: 10px`. Order: title, badges (gap 10, vertically centred on the title baseline), then a `flex: 1` spacer, then `actions` (flex gap 10, `margin-left: auto`). When the row is too narrow the `actions` group wraps below as one block, left-aligned and keeping gap 10 (as the Workflow header does in the mock: `Pauza runu`, `Edytuj jako v8` on row 2). The title never wraps unless longer than the container: then ellipsis with `title`.
4. Eyebrow variant (`withEyebrow`): eyebrow above the title with gap 4; used by Workspaces (date line + 32/700 `display-sm` title + `Nowy Workspace` action). Badges variant: for Workflow `[VisibilityBadge filled-sm PRYWATNY] [VersionBadge 'v7 · opublikowana'] [StatusPill run 'Run #14 · działa · 18 min']` (E16: two visibility shapes only; the filled-sm 10px/700 tab is correct here). All badge texts are supplied by the caller.
5. Title sizes (E7): `page` = 26/700/-0.52px (Workflow, Board, Skills, Agents, Connections, Settings), `display-sm` = 32/700/-0.64px (Workspaces), `section` = 24/700/-0.48px (Decisions, Approvals list titles). Detail titles (Decision, Agent name) use `page`, not 26/-0.26 (E7).
6. The `h1` is unique per view; `level=2` renders `h2` with the same visual size for panel headers. `PageHeader` has no background and no padding of its own (the page layout provides padding).
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` shows the Workflow header (title `Dostarczanie funkcji`, filled `PRYWATNY`, `v7 · opublikowana`, magenta Run pill, `Dry-run`, second row `Pauza runu` + violet `Edytuj jako v8`) and the following Chief strip is NOT part of it. `design-tabs.png` shows the tab bar (`Canvas` active, magenta underline in the mock; implement violet per E5). `design-eyebrow.png` shows the Workspaces header with the mono date eyebrow and 32px title. Not in the mock: tab hover/focus, overflow of many tabs (horizontal scroll with fade, `overflow-x:auto`), header with no actions, header skeleton.

## 7. Reuse

Consumes `ui:Tabs`, `ui:Text` (title styles), `ui:VisibilityBadge`, `ui:VersionBadge`, `ui:StatusPill` (E27, Run/Agent/Workspace shared pill; if part 1 names it `ui:Pill` variant `run`, the linker maps it), `ui:Button`. Provides `ui:SubTabs` consumed by every multi-tab view feature.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel).

## 10. Errors and edge cases

- `activeId` not in `items` -> no active tab, dev warning.
- 10+ tabs -> container scrolls horizontally, active tab scrolled into view.
- Very long title -> ellipsis; actions still wrap below instead of overlapping.
- Missing `renderLink` and `href` given -> plain `<a>` (full page navigation is the feature's problem; warn in dev).

## 11. Acceptance criteria

- [ ] Given the three product tab sets, Then each renders with the violet underline on the active item and `aria-current="page"`.
- [ ] Given a 600px container, Then actions wrap below the title and nothing overlaps (no horizontal scroll).
- [ ] Given `size="display-sm"`, Then the computed font size is 32px with -0.64px tracking.
- [ ] Given keyboard use, Then Tab reaches each tab link and the ring is visible.
- [ ] Visual match with `design.png` except the underline colour (documented E5 deviation, masked in the diff).

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Wrapping test at 3 widths; heading level test.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION (E5): violet underline everywhere; deviates from the magenta underline in `design.png`/`design-tabs.png`.
- ASSUMPTION: SubTabs are navigation links (route per tab) not an ARIA tablist unless `onChange` is used.
