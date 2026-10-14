---
id: OVE_DS035
title: "Tabs (tablist and nav modes)"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS022, OVE_DS025, OVE_DS019]
soft_depends_on: []
provides: [ui:Tabs, ui:TabPanel]
needs: []
owns: [packages/ui-kit/src/navigation/Tabs/**]
reads: []
design: design.png
design_source: "Main#shell/tab-bar (box 72,117,1368,45: 'Canvas | Runy i Activity'); design-profile Agenci#agents/profile-tabs"
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS035: Tabs (tablist and nav modes)

## 1. Summary

Implement one `Tabs` component with two modes: `tabs` (ARIA tablist controlling panels, used for the Agent profile) and `nav` (a `<nav>` of links with `aria-current="page"`, used for the section tab bar under the top bar). One look: 42px high, violet underline (E5).

## 2. Context

Inventory B9 and E5. Mock: `SubTabs` items are links, min-h 42, padding 0 14, 14/600, bottom border 2px; active text `#EFE9F7` with a MAGENTA underline `#F25FC4`, inactive `#A79BBF`; container gap 4, padding 0 20, border-bottom 1px `#241B36`, fill `#0D0915`. `ProfileTabs` are buttons, min-h 40, same type, VIOLET underline `#9B7BFF`. Normalisation E5: one component, violet underline (violet = selection, magenta is reserved for "working"), height 42. The section crop therefore deviates in the underline colour on purpose; the visual test masks the 2px underline row and checks it by computed style.

## 3. Scope (in)

- `Tabs` (mode `tabs` and `nav`), `TabPanel`, stories (both modes, with counts, with disabled item), tests, visual check.
- Optional `trailing` slot per item (e.g. `CountBadge`).

## 4. Out of scope

- Section bar composition with route state (`SubTabs` composite, route matching): DS part 2 (UI-22). Page header: DS part 2.
- Vertical tabs and overflow menus: not in MVP.

## 5. Detailed requirements

**5.1 API**
```ts
interface TabItem { id: string; label: ReactNode; href?: string; disabled?: boolean; trailing?: ReactNode; panelId?: string }
type TabsProps =
 | { mode: 'tabs'; items: TabItem[]; value: string; onValueChange: (id: string) => void; label: string; activation?: 'auto' | 'manual' }
 | { mode: 'nav'; items: (TabItem & { href: string })[]; value: string; label: string; as?: ElementType /* router link */ };
interface TabPanelProps { tabId: string; children: ReactNode; keepMounted?: boolean }
```
**5.2 Visual (exact, both modes)**
- Container: `display: flex; gap: 4px; padding: 0 20px; border-bottom: 1px solid line-subtle #241B36; background: bg-panel #0D0915` (`surface="transparent"` removes fill and horizontal padding for profile pages), `overflow-x: auto` with hidden scrollbar and `scroll-snap`, `min-height: 42px`.
- Item: `min-height: 42px; padding: 0 14px; display: inline-flex; align-items: center; gap: 8px; border: 0; border-bottom: 2px solid transparent; background: none; font: 14px/1 Bricolage 600; color: text-secondary #A79BBF; white-space: nowrap; margin-bottom: -1px` (underline overlaps the container border).
- Active: colour `text-primary` `#EFE9F7`, `border-bottom-color: violet-500` `#9B7BFF` (E5). Hover (inactive): colour `text-primary` at 80%, no underline change. Focus-visible: `--om-ring-focus-inset`. Active press: none. Disabled: opacity .55, `aria-disabled`, skipped by arrows.
- Underline slide animation (indicator) is NOT used; the border changes instantly (no motion to disable).
**5.3 Mode `tabs`**: `role="tablist"` with `aria-label`; items `role="tab"`, `aria-selected`, `aria-controls={panelId}`, `id`, roving tabindex (selected 0, others -1); Left/Right (wrap), Home/End; `activation="auto"` selects on focus (default), `manual` selects on Enter/Space. `TabPanel`: `role="tabpanel"`, `aria-labelledby`, `tabIndex=0` when it has no focusable content, hidden via `hidden` unless active (`keepMounted` keeps DOM).
**5.4 Mode `nav`**: `<nav aria-label>` containing a `<ul role="list">` of `<li><a aria-current="page">` (items are links with `href` through `safeHref`; `as` for router links); all links are in the tab order (standard link semantics, no roving); the active item has `aria-current="page"`. No `role="tab"` anywhere in this mode (avoid incorrect semantics).
**5.5 Contrast**: `#A79BBF` on `#0D0915` 7.0:1, active `#EFE9F7` 15:1, underline violet vs panel 6.2:1 (non-text 3:1).
**5.6 Counts**: `trailing` slot renders after the label (gap 8); `CountBadge` (OVE_DS019) is the intended content.

## 6. Design notes

`design.png`: the section bar "Canvas | Runy i Activity" with the active tab text bright and a MAGENTA underline (mock) - implementation draws violet (E5). `design-profile.png`: the Agent profile tab row (violet underline, 40px high in the mock; 42 here). Not drawn: hover/focus/disabled, counts.

## 7. Reuse

`useRovingTabindex` (OVE_DS025), `safeHref` (OVE_DS022), `CountBadge` (OVE_DS019) in stories, focus-ring tokens (OVE_DS007).

## 8. Architecture and code placement

`packages/ui-kit/src/navigation/Tabs/{Tabs.tsx,TabPanel.tsx,Tabs.module.css,index.ts}`. A discriminated union of props selects semantics; both modes share the same CSS (DRY) but different roles (LSP-safe: no tab roles on links).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). `href` values are validated with `safeHref`; `nav` mode never executes navigation itself (the router link does), so a malicious label/href cannot trigger script.

## 10. Errors and edge cases

- `value` not among items: nothing active; first item focusable.
- All items disabled: tablist `aria-disabled`.
- Many items overflow: horizontal scroll; the active item is scrolled into view on change.
- Router link component missing `href` support: documented requirement.

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Tabs` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Items min-height 42, padding 0/14, 14/600, underline 2px; active violet `#9B7BFF`, inactive `#A79BBF`; container border `#241B36`, fill `#0D0915`.
- [ ] `tabs` mode: tablist/tab/tabpanel roles, roving tabindex, arrows/Home/End, auto and manual activation.
- [ ] `nav` mode: `<nav>` + links + `aria-current=page`, no tab roles; unsafe hrefs render inert text.
- [ ] No underline animation; focus ring inset visible.

## 12. Test plan

- Vitest + Testing Library + user-event in `navigation/Tabs.test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test Tabs` and `pnpm --filter @overmind/ui-kit test:visual Tabs`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task.

## 14. Open questions and assumptions

- ASSUMPTION (E5): violet underline and 42px for every Tabs usage; magenta stays for working states.
- ASSUMPTION: manual activation is available but default is automatic.
- Open: page-level section bar background `#0D0915` is applied by the composite in part 2 when `surface="transparent"` is used.
