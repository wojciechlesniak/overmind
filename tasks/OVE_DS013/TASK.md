---
id: OVE_DS013
title: "Button: base component, 4 sizes, states, loading and the core variants"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS008, OVE_DS009, OVE_DS022, OVE_DS038, OVE_DS012]
soft_depends_on: []
provides: [ui:Button, ui:Spinner]
needs: [ui:icons]
owns: [packages/ui-kit/src/actions/Button/**, packages/ui-kit/src/actions/Spinner/**]
reads: []
design: design.png
design_source: "Kreator-Folder#onb/footer-actions (crop 416,480,968,62); design-secondary-row.png Main#canvas/workflow-header"
spec_refs: [SPECIFICATION 13]
adr_refs: [18]
---

# OVE_DS013: Button: base component, 4 sizes, states, loading and the core variants

## 1. Summary

Implement `Button`, the one component behind every action button of the product: token-driven base (sizes, radii, fonts, icon slots, loading, disabled, focus, hover, pressed), polymorphic rendering (`button`, `a`, router link) and the four core variants `primary-violet`, `primary-magenta`, `secondary`, `ghost`. The remaining tone variants (approve, deny, pause, danger, dashed, palette) are styled by OVE_DS014 on the same component.

## 2. Context

The mocks contain 65 distinct button style strings, reduced by the inventory to 21 variants (B1) and normalised by E8 (three sizes + wizard size), E9 (13/600 secondary, `font: inherit`), E19 (focus ring) and E24 (Back is always a `button`). Violet = primary action, magenta = Chief/working and wizard CTA. State rules (hover, pressed, disabled, loading, focus) are not drawn anywhere and come from OVE_DS007 (std states). Mapping of all 21 inventory variants:

| Inventory variant (B1) | Implementation | Task |
|---|---|---|
| `primary-violet` | `Button variant="primary-violet"` | DS013 |
| `primary-magenta`, `primary-magenta-lg`, `cta-wizard` | `variant="primary-magenta"` with `size` md / lg / xl (xl adds `--om-glow-cta`) | DS013 |
| `secondary`, `secondary-wizard` | `variant="secondary"` size md / lg (Back = lg, E8) | DS013 |
| `ghost` | `variant="ghost"` (+ `selected` for filter segments) | DS013 |
| `approve-amber`, `approve-amber-outline`, `deny-outline`, `deny-telegram` | `approve`, `approve-outline`, `deny`, `deny-quiet` | DS014 |
| `pause`, `danger`, `dashed-add`, `dashed-more`, `palette` | same names | DS014 |
| `icon-square`, `icon-send`, `icon-send-flat` | `IconButton`, `SendButton` | DS015 |
| `link` | `TextLink` | DS022 |
| `select` | `SelectButton` | DS030 |
| `ghost-primary-text` (Tray item) | `MenuItem` | DS029 |

## 3. Scope (in)

- `Spinner` (14px CSS ring, shared by Button, IconButton, SendButton) in `actions/Spinner/`.
- `Button` with props in 5.1, CSS module `Button.module.css` (base, sizes, 4 core variants, states), a placeholder `ButtonTones.module.css` (banner only; OVE_DS014 takes it over) imported by `Button.tsx`.
- Stories: one per variant, `Sizes`, `WithIcons`, `Loading`, `Disabled`, `AsLink`, `Matrix`.
- Unit tests, geometry tests, visual tests.

## 4. Out of scope

- Tone variants and their CSS: OVE_DS014 (the `ButtonVariant` union is declared in full here; their styles arrive there).
- Icon-only buttons and send buttons: OVE_DS015. Inline text links: OVE_DS022. Menu items: OVE_DS029.
- Dropping/dragging behaviour of the palette variant: DS part 2 (UI-64).

## 5. Detailed requirements

**5.1 API**
```ts
type ButtonVariant = 'primary-violet' | 'primary-magenta' | 'secondary' | 'ghost'
  | 'approve' | 'approve-outline' | 'deny' | 'deny-quiet' | 'pause' | 'danger' | 'dashed-add' | 'dashed-more' | 'palette';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';
interface ButtonOwnProps {
  variant?: ButtonVariant;       // default 'secondary'
  size?: ButtonSize;             // default 'md'
  icon?: IconName;               // leading
  iconEnd?: IconName;            // trailing (e.g. chevron-right on "Next")
  fullWidth?: boolean;           // width: 100% (flex: 1 1 0 inside a flex row when parent is flex)
  loading?: boolean;
  selected?: boolean;            // toggle look + aria-pressed (filters)
  disabledReason?: string;       // see 5.5
  as?: ElementType;              // 'button' (default) | 'a' | router Link
}
// children: ReactNode (label, required for a11y); type defaults to 'button' (never 'submit' implicitly)
```
1. Root: `<button data-om="Button" data-variant data-size data-loading data-selected>`; `type="button"` unless given; forwards ref; rest props spread.
**5.2 Geometry and type (exact; inventory E8)**
| size | height | radius | padding inline | gap | icon px | label style |
|---|---|---|---|---|---|---|
| `sm` | 34px (`--om-control-h-sm`) | `--om-radius-10` | 12px | 6px | 14 | 12/600 (`button` at 12px) |
| `md` (default) | 40px | `--om-radius-12` | 14px | 8px | 16 | 13/600; filled variants 13/700 (`button` / `button-strong`) |
| `lg` | 44px | `--om-radius-14` | 18px | 8px | 16 | 14/600; filled 14/700 (`button-lg`) |
| `xl` | 46px | `--om-radius-14` | 22px | 8px | 16 (chevron stroke 2.4) | 15/700 (`button-xl`); secondary xl 15/600 |
Base: `display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; border: 1px solid transparent; box-sizing: border-box; font-family: var(--om-font-sans); text-decoration: none; user-select: none`. `fullWidth` -> `width: 100%`. Icons inside filled variants use `strokeWidth` 2 (2.4 for xl end icon), others 1.8. Label never wraps; long labels truncate with ellipsis (`min-width: 0`).
**5.3 Core variants (exact colours; tokens in brackets)**
| variant | fill | border | text / icon | hover | pressed |
|---|---|---|---|---|---|
| `primary-violet` | `violet-500` `#9B7BFF` | transparent | `ink` `#12091F` | brightness 1.06 + `0 0 18px violet-a25` | translateY(1px), brightness .94 |
| `primary-magenta` | `magenta-500` `#F25FC4` | transparent | `ink` | brightness 1.06 + `0 0 24px magenta-a35`; `xl` always has `--om-glow-cta` at rest | same |
| `secondary` | `bg-surface` `#140F20` | 1px `line` `#2A2040` | `text-primary` `#EFE9F7` | fill `bg-raised`, border `line-strong` | translateY(1px) |
| `ghost` | transparent | transparent | `text-secondary` `#A79BBF`, weight 400 (`caption` 12 at sm, `body-sm` 13 at md) | fill `bg-surface`, text `text-primary` | fill `bg-raised` |
`selected` (toggle): secondary/ghost get fill `--om-color-bg-raised` (`#1C1330`), border `line-strong` for secondary, text `text-primary`, weight 600 (the "Wszystkie" filter of the mock), and `aria-pressed="true"`; unselected toggles render `aria-pressed="false"` (only when `selected` is a boolean, not undefined).
**5.4 States**
2. focus-visible: `--om-ring-focus` (global from OVE_DS008); never removed. 3. hover/pressed per table, 120ms `--om-motion-fast`; hover applies only on `(hover: hover)` devices. 4. disabled: native `disabled`, opacity `.45`, no glow, `cursor: not-allowed`, no hover/pressed.
5. loading: `aria-busy="true"`, click and keyboard activation ignored, label stays, the leading icon is replaced (or a slot is added) by `<Spinner size={14} />`. `Spinner` is `<span data-om="Spinner" role="presentation" aria-hidden="true">` with `width/height: <size>px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: om-spin var(--om-anim-spin) linear infinite` (sizes 12, 14, 16, 20) (keeps rotating under reduced motion at slower 2s, OVE_DS007); button width must not jump (reserve the icon slot: spinner replaces icon of the same width, otherwise the spinner is absolutely positioned and the label gets `padding-left: 22px` only while loading is true: ASSUMPTION simple approach, fixed 14+8 px).
6. `disabledReason` (E33, Global Pause): when set together with `disabled`, the button renders `aria-disabled="true"` (NOT the native attribute), stays keyboard-focusable, ignores activation, and references the reason through `aria-describedby` pointing at a visually hidden `<span>` (uses `VisuallyHidden`, OVE_DS022). A Tooltip (OVE_DS028) may show the same text; the reason text is passed by the caller (already translated).
**5.5 Polymorphism and links**
7. `as="a"` renders an anchor: `href` passes through `safeHref()` (OVE_DS001); `target="_blank"` adds `rel="noopener noreferrer"`; disabled anchor drops `href` and sets `aria-disabled="true"`, `tabindex="-1"`. `as={RouterLink}` forwards `to` and everything else untouched. Keyboard: Enter activates links and buttons, Space activates buttons only.
8. Buttons inside a `<form>` default to `type="button"`; submit buttons set `type="submit"` explicitly.
**5.6 A11y**: native semantics; accessible name = label text (icon decorative); contrast: `ink` on violet 6.15, on magenta 6.65 (OVE_DS003 test); minimum hit area 34px; `aria-pressed` only for toggles; loading announced via `aria-busy` plus the caller's live region (the component never injects text).
**5.7 Unit-level geometry** (Playwright, OVE_DS012 `expectBox`): sm 34, md 40, lg 44, xl 46 px high; radii 10/12/14/14; secondary border colour `#2A2040`; primary-violet background `#9B7BFF`; disabled opacity 0.45.

## 6. Design notes

`design.png` shows onboarding footer: Back (secondary) and Next ("Dalej", `primary-magenta` xl with chevron-right end icon and magenta glow). The mock's Back is 40px (step 1) / 46px (step 2); the normalised Back is `secondary lg` 44px (E8), so the story composes `secondary lg` + `primary-magenta xl` and the 4px height difference is inside the structural tolerance. `design-secondary-row.png` (Workflow header) shows `secondary` md ("Dry-run", "Pauza runu") and `primary-violet` md ("Edytuj jako v8") at 40px/r12, 13/600 and 13/700. Not in the mock: hover, pressed, focus, disabled, loading, sm size (derived 5.2-5.4); all other variants arrive in OVE_DS014.

## 7. Reuse

`Icon` and `IconName` (OVE_DS009); `Text` styles (OVE_DS004/005) through tokens; `VisuallyHidden` (OVE_DS022); `safeHref`, `cx`, `mergeRefs`, polymorphic helper (OVE_DS001); labels for the spinner: none (visual only); `UiLabels` not needed here (OVE_DS038 is listed because other primitives share the provider; this one has no built-in text).

## 8. Architecture and code placement

`packages/ui-kit/src/actions/Button/` with `Button.tsx`, `Button.module.css`, `ButtonTones.module.css`, `Button.types.ts` (full union), `index.ts`. Presentational, no business logic. Open for extension through new variant selectors, closed for modification of the base (OCP). Variants are CSS-only keyed by `data-variant`; TS has no switch over variants.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Buttons trigger security-relevant actions elsewhere (approve, delete). This component guarantees: a loading or disabled button cannot be activated by mouse or keyboard (tests), the default `type` is `button` so a stray Enter cannot submit a form, and anchor URLs pass `safeHref` so an Agent-supplied `javascript:` link cannot execute. Destructive defaults are the caller's job (OVE_DS036 focuses Cancel first).

## 10. Errors and edge cases

- Double click while loading: ignored (first click sets the caller's state; component also ignores while `loading`).
- `disabled` plus `loading`: disabled wins visually, `aria-busy` still set.
- `children` empty: dev warning (missing accessible name) unless `aria-label` provided.
- Long label in a narrow flex cell: ellipsis, `title` is the caller's responsibility.
- `as="a"` without `href`: renders but dev warning.
- Right-to-left: not supported in MVP.

## 11. Acceptance criteria

- [ ] Sizes: heights 34/40/44/46, radii 10/12/14/14, paddings per 5.2 (Playwright boxes).
- [ ] Each core variant has the exact fill, border and text colour of 5.3 (`expectToken`).
- [ ] Hover (secondary): fill becomes `bg-raised`, border `line-strong`; pressed moves 1px; focus-visible shows the 2px+2px ring; no `outline: none`.
- [ ] Disabled: opacity .45, not focusable, click handler not called. `disabledReason`: focusable, `aria-disabled`, `aria-describedby` text present, click handler not called.
- [ ] Loading: `aria-busy="true"`, spinner visible, click and Enter/Space ignored, width stable within 2px.
- [ ] `selected` sets `aria-pressed` and the raised look; `as="a"` with `javascript:alert(1)` renders no href.
- [ ] `type` defaults to `button`; forwards ref; spreads `aria-*`/`data-*`.
- [ ] Stories: one per core variant, `Sizes`, `WithIcons`, `Loading`, `Disabled`, `DisabledWithReason`, `AsLink`, `Matrix` (variants x sizes x default/hover/focus/active/disabled/loading); axe clean.
- [ ] Visual: `Onboarding/FooterActions` story matches `design.png`; `WorkflowHeaderButtons` matches `design-secondary-row.png` (structural tolerance); Matrix baselines committed.

## 12. Test plan

Vitest + Testing Library: `Button.test.tsx` (render, data attributes, click, disabled, disabled-with-reason, loading ignores events, keyboard Enter/Space, `as="a"` safeHref table, ref, rest props, `aria-pressed`). Playwright (OVE_DS012): `Button.visual.spec.ts` with `expectBox`/`expectToken` and `matchDesignCrop` for both crops; states driven through the Matrix cells. a11y sweep covers the stories. Commands: `pnpm --filter @overmind/ui-kit test Button`, `test:visual Button`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. Conflict note: OVE_DS014 edits only `ButtonTones.module.css`; it must not touch `Button.tsx` or `Button.types.ts`. If a tone variant needs a TS change, propose it here.

## 14. Open questions and assumptions

- ASSUMPTION: `md` is the default size (E8). Secondary xl exists for symmetry but has no use in the mocks.
- ASSUMPTION: loading spinner is CSS (not an icon), 14px, 0.9s.
- ASSUMPTION: hover glow families: violet a25, magenta a35, amber a35 (inventory: "brighten 6% and add glow-cta in own hue").
- Open: `Back` hidden in wizard step 1 (E24) is a WizardLayout decision (DS part 2); the Button imposes nothing.
