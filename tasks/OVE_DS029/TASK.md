---
id: OVE_DS029
title: "Menu: MenuItem, TrayItem look, groups, shortcuts"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS009, OVE_DS022, OVE_DS028]
soft_depends_on: []
provides: [ui:Menu, ui:MenuItem, ui:MenuSeparator, ui:MenuLabel, ui:MenuHeader]
needs: [ui:icons]
owns: [packages/ui-kit/src/overlays/Menu/**]
reads: []
design: design.png
design_source: "Tray#tray/popover (full menu); design-tray-items.png the action rows (Napisz do Chiefa, Wstrzymaj, Wznow, Otworz Overmind with shortcut)"
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS029: Menu: MenuItem, TrayItem look, groups, shortcuts

## 1. Summary

Implement the action `Menu` (button-triggered list of commands) with `MenuItem` (the `TrayItem` look), `MenuSeparator`, `MenuLabel`, `MenuHeader` and optional shortcuts, with full roving keyboard navigation and typeahead. It is the base for the Tray window, row "more" menus, the Workspace switcher and (via OVE_DS030) Select dropdowns.

## 2. Context

Inventory B13 `TrayItem` (min-h 40, padding 0 10, r10, gap 10) and B18 (items with a leading 16px icon `#A79BBF`, trailing shortcut mono 11 `#8C80A6`, header block with logo tile 28 r8 + "Overmind" + status line, Divider between groups, primary action row Global Pause). The Tray crop shows: header (logo tile, "Overmind", mono magenta status "pracuje . 3 z 3 Agentow"), Agent rows (composites, DS part 2 UI-53), an Approvals row with an amber square marker and "Zgody", action rows with icons, Global Pause full-width button (magenta pause style) and plain rows "Otworz Overmind" with shortcut. The pause button is the `Button variant="pause"` (OVE_DS014) placed in the menu with `MenuCustomItem`.

## 3. Scope (in)

- Menu primitives with keyboard model, stories, tests, visual check of the Tray action rows.
- Checkable items (`MenuCheckboxItem`, `MenuRadioItem`) for filters (small, same file group).

## 4. Out of scope

- Tray composite (Agent rows, Approvals row, window chrome, 560px max-height scrolling): DS part 2 (UI-53).
- Select/combobox semantics: OVE_DS030. Context menus on canvas: DS part 2.

## 5. Detailed requirements

**5.1 API**
```ts
interface MenuProps { trigger: ReactElement; children: ReactNode; placement?: Placement; width?: 'auto' | 'trigger' | 'tray'; label: string; open?: boolean; onOpenChange?: (o: boolean) => void }
interface MenuItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon?: IconName; children: ReactNode; shortcut?: string; tone?: 'default' | 'danger'; selected?: boolean; onSelect?: () => void; disabled?: boolean; disabledReason?: string; as?: ElementType; href?: string }
```
**5.2 Surface**: `Popover` surface from OVE_DS028 (padding 8, r16, 96% fill, `line` border, popover shadow); `width="tray"` = 380px.
**5.3 `MenuItem` (exact)**: `min-height: 40px; padding: 0 10px; border-radius: 10px; gap: 10px; display: flex; align-items: center; width: 100%`, font Bricolage 14/400 `text-primary` (the mock rows are regular weight), leading `Icon` 16px colour `text-secondary` `#A79BBF`, trailing `shortcut` as `Kbd plain` (mono 11 `#8C80A6`) pushed right with `margin-left: auto`. `tone="danger"`: text and icon `error-500` `#FF8FA3`. `selected` (for single-select menus) shows a 14px `check` icon right, `aria-checked` when radio/checkbox item.
**5.4 States**: hover/`data-active` (keyboard active): fill `hover-from-transparent` (`color-mix(violet-500 10%, transparent)`) and text unchanged; focus-visible: `--om-ring-focus-inset` (inset ring so the item is not clipped by the surface); active: fill 16%; disabled: opacity .55, `aria-disabled`, not skipped by screen reader virtual cursor but skipped by arrow keys; `disabledReason` shows as a second line 12px `text-muted` (E33). Item containing a link (`href`) renders `<a role="menuitem">` using `safeHref` (OVE_DS022).
**5.5 Other parts**: `MenuSeparator` = `Divider` solid with margin 4px 0 (the Tray shows full-width hairlines between groups); `MenuLabel` = `SectionLabel` with inset (`role="presentation"`/group label); `MenuHeader { leading, title, subtitle }` header block: padding 8px 10px, title Bricolage 15/700 `text-primary`, subtitle mono 12 colour per caller (`StatusText`), bottom divider; `MenuGroup` = `role="group"` with `aria-labelledby`.
**5.6 Keyboard and roles**: trigger `aria-haspopup="menu"`, `aria-expanded`; container `role="menu"` with `aria-label`; items `role="menuitem" | "menuitemcheckbox" | "menuitemradio"`; ArrowDown/Up (wrap), Home/End, typeahead on the visible label, Enter/Space activate, Escape closes and returns focus, ArrowRight/Left open/close submenus (single level in MVP; nested menu not implemented), Tab closes the menu. Activation fires `onSelect` and closes the menu unless `closeOnSelect={false}`. Uses `useListNavigation` + `useTypeahead` from floating-ui through `_shared`.
**5.7 Coarse pointer**: item min-height 44px (`--om-hit-min`).

## 6. Design notes

`design.png`: whole Tray popover (header, Agent rows, Approvals row, Chief row, pause/resume rows, Global Pause button, open/close rows, dividers). This task implements the generic parts (surface, items, dividers, shortcut). `design-tray-items.png`: the action rows with 16px icons (`chat`, `pause`, `activity`) in `#A79BBF` and the "Otworz Overmind ⌘O" row. Mock inconsistency noted: Tray content is 613px for a 560px popover (E3), solved by part 2 (scroll groups, pinned header and actions).

## 7. Reuse

Popover surface and floating hooks (OVE_DS028), `Divider`/`SectionLabel`/`Kbd`/`safeHref` (OVE_DS022), `Icon` (OVE_DS009), floating-ui list navigation (no dependency on the roving hook).

## 8. Architecture and code placement

`packages/ui-kit/src/overlays/Menu/{Menu,MenuItem,MenuParts}.tsx` + CSS module; Select (OVE_DS030) imports `MenuItem` styles through the exported `menuItemClassName` helper (single look for list options).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Menu items may trigger destructive commands (pause, stop Agent): `tone="danger"` is visual only; confirmation is the caller's Dialog (OVE_DS036). `onSelect` is not called for disabled items even via keyboard/typeahead; link items go through `safeHref`.

## 10. Errors and edge cases

- Empty menu: renders nothing, dev warning.
- Trigger removed while open: menu closes.
- Very long labels: ellipsis, shortcut never shrinks.
- Typeahead with IME: ignored during composition.
- Item `onSelect` throws: menu still closes, error not swallowed (re-thrown to the error boundary of the app).

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Menu` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] MenuItem min-height 40, padding 0 10, radius 10, icon 16 `#A79BBF`, shortcut mono 11 `#8C80A6`.
- [ ] Full keyboard model of 5.6 (arrows wrap, Home/End, typeahead, Escape returns focus, Tab closes).
- [ ] `role=menu/menuitem` wiring; disabled item not activatable; `disabledReason` shown.
- [ ] `width="tray"` is 380px; separators are 1px `#241B36`.

## 12. Test plan

- Vitest + Testing Library + user-event in `overlays/Menu.test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test Menu` and `pnpm --filter @overmind/ui-kit test:visual Menu`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. Depends on OVE_DS028 (floating layer). OVE_DS030 imports `menuItemClassName` from here: export it from `overlays/Menu/index.ts` as the only cross-folder style export.

## 14. Open questions and assumptions

- ASSUMPTION: Tray rows are regular weight 14px (mock) and not 14/600.
- ASSUMPTION: submenus are post-MVP.
- Open (E33): Global Pause active state of the Tray button is designed later; the menu just hosts the button.
