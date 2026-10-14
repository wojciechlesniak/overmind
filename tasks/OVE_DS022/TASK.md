---
id: OVE_DS022
title: "Divider, SectionLabel, Kbd, TextLink, PathText and VisuallyHidden helpers"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS005, OVE_DS008, OVE_DS012]
soft_depends_on: []
provides: [ui:Divider, ui:SectionLabel, ui:Kbd, ui:TextLink, ui:PathText, ui:VisuallyHidden]
needs: []
owns: [packages/ui-kit/src/typography/Divider/**, packages/ui-kit/src/typography/SectionLabel/**, packages/ui-kit/src/typography/Kbd/**, packages/ui-kit/src/typography/TextLink/**, packages/ui-kit/src/typography/PathText/**, packages/ui-kit/src/typography/VisuallyHidden/**, packages/ui-kit/src/internal/safeHref.ts, packages/ui-kit/src/internal/__tests__/safeHref.test.ts]
reads: []
design: design.png
design_source: "Tray#tray/menu (dividers, shortcut '⌘O', section groups); mono labels"
spec_refs: [SPECIFICATION 13]
adr_refs: []
---

# OVE_DS022: Divider, SectionLabel, Kbd, TextLink, PathText and VisuallyHidden helpers

## 1. Summary

Small text and separator helpers used on every screen: `Divider` (4 variants), `SectionLabel` (the 10px mono caps label, 69 uses), `Kbd` (shortcut), `TextLink` (underlined link with a safe `href`), `PathText` (mono path with ellipsis and full-value tooltip fallback) and `VisuallyHidden`. Also the shared `safeHref()` utility.

## 2. Context

Inventory B19 to B21, B24. The mocks hide input labels with a 1x1 clipped element (pattern: labels exist but hidden); this becomes `VisuallyHidden`. Links inside agent or document content must never run `javascript:` URLs; `TextLink` validates href. Tray crop shows 1px dividers (`#241B36`) between groups and the shortcut `⌘O` in mono. `SectionLabel` margin `14px 8px 4px` is only used inside lists; the component has no outer margin by default and offers `inset` for that case.

## 3. Scope (in)

- Six components and `safeHref` (pure function in `src/internal/`, also used by DS part 2 Markdown preview).
- Stories and tests.

## 4. Out of scope

- Rendering of Markdown links in documents: DS part 2 (UI-47). Router links (`as` prop accepts a component; no router dependency here).

## 5. Detailed requirements

**5.1 `Divider`**
```ts
interface DividerProps extends HTMLAttributes<HTMLElement> { orientation?: 'horizontal' | 'vertical'; variant?: 'solid' | 'rail' | 'dashed'; decorative?: boolean /* default true */ }
```
1px, colour `line-subtle` `#241B36`. `horizontal` = `height: 1px; width: 100%`, `vertical` = `width: 1px; align-self: stretch`. `rail`: 28px wide, centred, 1px (App rail separator). `dashed`: `border-top: 1px dashed line-subtle`, no background. `decorative` -> `role="presentation"`, else `role="separator"` with `aria-orientation`.
**5.2 `SectionLabel`**
```ts
interface SectionLabelProps extends HTMLAttributes<HTMLElement> { as?: 'div' | 'h2' | 'h3' | 'span'; tone?: 'muted' | 'amber' | 'magenta'; count?: ReactNode; meta?: ReactNode; inset?: boolean }
```
Mono 10/500 (Text style `mono-label`), `letter-spacing: 0.08em`, `text-transform: uppercase`, colour `text-muted` `#8C80A6`; `amber` `#FFCF85` (Approvals), `magenta` `#FFB3E6` (Chief). `count` renders after a middle dot ("STALI . 7"), `meta` is right-aligned (`margin-left: auto`). `inset` adds `margin: 14px 8px 4px`. Default element `div`; use `h2/h3` when it names a region (a11y story explains).
**5.3 `Kbd`**: `children` string (e.g. "⌘O"). Default (`appearance="plain"`): mono 11/400 `text-muted`, as in Tray. `appearance="chip"`: padding 1px 6px, radius 6px, `border: 1px solid line`, fill transparent. Rendered as `<kbd>`. Platform glyphs are the caller's concern.
**5.4 `TextLink`**
```ts
interface TextLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> { href: string; external?: boolean; as?: ElementType }
```
Colour `text-link` `#E9D8FF`, `text-decoration: underline`, `text-underline-offset: 3px`; hover colour `text-bright` `#F6EFFF`; focus-visible ring; `external` adds `target="_blank" rel="noopener noreferrer"` and a visually hidden "(opens in new tab)" from UiLabels (`externalLink`, add to OVE_DS038 keys via proposal if missing). `href` goes through `safeHref()`: allowed schemes `http`, `https`, `mailto`, `tel`, relative (`/`, `./`, `#`); everything else (`javascript:`, `data:`, `vbscript:`, `file:`, with any case/whitespace/control-char obfuscation) renders a `<span>` with the text and no `href`.
**5.5 `PathText`**: `{ children: string; truncate?: 'end' | 'middle' }` mono 12/400 `text-secondary`; `truncate="end"` ellipsis (`min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`); `middle` splits the string into head/tail spans (tail 12 characters, `direction` trick) so the file name stays visible. `title={children}` always set (full path on hover). Top bar uses `max-width: 220px` (E1) set by the parent.
**5.6 `VisuallyHidden`**: polymorphic span with the 1x1 clip pattern (`position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; padding: 0`). Optional `focusable` variant (skip link) that becomes visible on focus.
**5.7 States**: Divider/SectionLabel/Kbd/PathText static. TextLink: hover, focus-visible (ring), active, visited same colour (no `:visited` change).

## 6. Design notes

`design.png` (Tray menu): 1px dividers between Agent rows, the Approvals row, Chief row and actions; shortcut `⌘O` right-aligned in mono muted; mono labels. Only the divider and Kbd are visible there; SectionLabel appears all over other views (e.g. "AGENCI W TYM WORKSPACE" in Chief). For the visual test the stories reproduce these snippets.

## 7. Reuse

Text styles via CSS variables from OVE_DS004/005; colours from OVE_DS002/003.

## 8. Architecture and code placement

`packages/ui-kit/src/typography/<Name>/` for text helpers (group `typography`), `src/internal/safeHref.ts` is internal (not exported from the barrel). `TextLink` accepts `as` so apps pass their router link (DIP: no router import in ui-kit).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). `safeHref` is a security control (links come from Agents, Skills and imported docs): unit tests include `JavaScript:alert(1)`, ` java\tscript:`, `&#106;avascript:`, `data:text/html`, protocol-relative `//evil`, and mixed-case schemes; `//host` is allowed only when `allowProtocolRelative` is true (default false). External links always get `rel="noopener noreferrer"`.

## 10. Errors and edge cases

- `href` empty or unsafe -> span fallback, dev warning.
- `PathText` with very short container: ellipsis only, never wraps.
- `SectionLabel` with `count` of 0 renders the number (0 is meaningful).
- Kbd with empty children renders nothing.
- RTL: not supported (documented).

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`Divider/SectionLabel/Kbd/TextLink/PathText/VisuallyHidden` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] `safeHref` passes the full abuse table (>= 20 cases) and is the only place URLs are validated.
- [ ] `SectionLabel` computed style: 10px mono 500, ls 0.08em, uppercase, `#8C80A6`.
- [ ] `Divider` variants measure 1px and use `#241B36`.
- [ ] `PathText middle` keeps the last 12 characters visible when truncated.
- [ ] `VisuallyHidden` content is available to the accessibility tree but has a 1x1 box.

## 12. Test plan

- Vitest + Testing Library + user-event in `typography/(Divider|SectionLabel|Kbd|TextLink|PathText|VisuallyHidden).test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test typography` and `pnpm --filter @overmind/ui-kit test:visual typography`.
- `safeHref.test.ts` as a table test.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. `safeHref` is consumed later by DS part 2; keep its signature stable: `safeHref(input: string, opts?: { allowProtocolRelative?: boolean }): string | null`.

## 14. Open questions and assumptions

- ASSUMPTION: `Kbd` plain is the mock's look; the chip appearance is the inventory recommendation for hints.
- Open: `externalLink` label key is added to UiLabels (OVE_DS038) through a proposal if it is not in the key list yet.
