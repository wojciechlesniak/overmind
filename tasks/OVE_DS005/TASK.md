---
id: OVE_DS005
title: "Text component and text-style classes"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS004, OVE_DS002]
soft_depends_on: []
provides: [ui:Text]
needs: [ui:tokens-typography]
owns: [packages/ui-kit/src/typography/Text/**]
reads: []
design: design.png
design_source: "Pulpit#dash/page-header + dash/chief-summary (crop 92,85,1010,190)"
spec_refs: [SPECIFICATION 13]
adr_refs: [17]
---

# OVE_DS005: Text component and text-style classes

## 1. Summary

Build `Text`, the single component that applies the named text styles from OVE_DS004 to any element (`span`, `p`, `h1`-`h6`, `label`, `code`), with colour tone override, single-line truncation and multi-line clamp. Every other component and every feature view uses `Text` (or a component that uses it), so typography never gets re-implemented.

## 2. Context

The mocks set font size, weight and tracking inline on 600+ nodes. The inventory reduces them to ~60 named styles (A.2) and normalises inconsistent headings (E7). Rule: uppercase labels are produced by CSS transform (A.2 note), links are the only underlined text, numbers carry word units (design rules). The Pulpit crop shows the mono date line, the 32/700 page title and the Chief summary strip with eyebrow, 15px body and link.

## 3. Scope (in)

- `Text` component with props in 5.1, CSS module with one rule per text style, `index.ts`.
- Story per style group and a `Matrix` specimen of all styles; unit tests; consistency test between `textStyles.ts` and the CSS module.
- `TextTone` palette: the allowed colour overrides.

## 4. Out of scope

- Tokens and fonts: OVE_DS004. Link component with `safeHref`: OVE_DS022 (`TextLink`, uses style `link`).
- Avatar initials: OVE_DS016. Section label (a `Text` preset with margin conventions): OVE_DS022.
- Rich text, Markdown rendering: later (not planned in MVP ui-kit).

## 5. Detailed requirements

**5.1 API**
```ts
type TextTone = 'default' | 'bright' | 'soft' | 'secondary' | 'muted' | 'lavender' | 'lavender-strong' | 'link'
  | 'magenta' | 'violet' | 'mint' | 'amber' | 'blue' | 'error' | 'ink' | 'inherit';
interface TextOwnProps {
  variant: TextStyleName;            // required, no default: forces a conscious choice
  tone?: TextTone;                   // default = the style's own default colour, else text-primary
  as?: ElementType;                  // default 'span'; use h1..h6, p, label, code, dd, dt, strong, em
  truncate?: boolean;                // white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0
  lines?: 2 | 3 | 4;                 // -webkit-line-clamp
  align?: 'start' | 'center' | 'end';
  tabular?: boolean;                 // force tabular-nums on sans styles (counts); default true on mono styles
}
```
1. Root attributes: `data-om="Text"`, `data-variant`, `data-tone`; margin always 0 (headings get no UA margins).
2. CSS module has exactly one selector per style: `[data-variant='title-page'] { font: var(--om-text-title-page-font); letter-spacing: var(--om-text-title-page-ls); text-transform: var(--om-text-title-page-transform, none); color: var(--om-text-title-page-color, var(--om-color-text-primary)); }`. Link styles add `text-decoration: underline; text-underline-offset: 2px`.
3. Tone mapping (`[data-tone]` selectors): default -> unset (style colour), bright -> `--om-color-text-bright`, soft -> `-text-body-soft`, secondary -> `-text-secondary`, muted -> `-text-muted`, lavender -> `-text-lavender`, lavender-strong -> `-text-lavender-strong`, link -> `-text-link`, magenta -> `--om-color-magenta-300`, violet -> `--om-color-violet-300`, mint -> `--om-color-mint-500`, amber -> `--om-color-amber-300`, blue -> `--om-color-blue-500`, error -> `--om-color-error-500`, ink -> `--om-color-ink`, inherit -> `inherit`. Hex literals are forbidden (guard). Muted on `line` fill `#2A2040` is forbidden (4.17:1, OVE_DS002), documented in the story.
4. `truncate` and `lines` are mutually exclusive (dev warning); `title` attribute is NOT added automatically (caller passes it when text is cut, a11y: tooltips are OVE_DS028).
5. Heading semantics are the caller's choice through `as`; the style never implies the element (a `title-page` style on a `div` is allowed). Story and README rule: each view has exactly one `h1`.
6. `uppercase` styles keep the source string in the DOM (screen readers read it unchanged).
7. Consistency test: parse `Text.module.css`, assert a rule exists for every `TextStyleName` and that it references the variables of the same name (no copy-pasted wrong style).

## 6. Design notes

`design.png` (Pulpit header + Chief summary strip) shows: mono date line (`mono` 12/400 muted-ish), page title (`display-sm` 32/700/-0.02em), the eyebrow `CHIEF · PODSUMOWANIE` (`mono-eyebrow`, magenta-300, uppercase), the summary paragraph (`body-lg` 15/22.5 `text-body-soft`), the link "Otwórz czat" (`link`, underlined). States not applicable (static text). Truncation and clamp are not in the mock; they follow the inventory's ellipsis rule (E1 for paths).

## 7. Reuse

`TextStyleName`, `textStyles` and tokens from OVE_DS004; colour tokens OVE_DS002/003; `cx` from OVE_DS001.

## 8. Architecture and code placement

`packages/ui-kit/src/typography/Text/` (group `typography`). Presentational, polymorphic through the shared `PolymorphicProps` helper (OVE_DS001). One responsibility: map a style name to tokens.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). `as` is typed to intrinsic tags and components only; the component never reads `dangerouslySetInnerHTML` from props (rest props are filtered through a deny-list for that key).

## 10. Errors and edge cases

- Unknown `variant` at runtime (JS caller): renders without style and warns in development; TypeScript prevents it.
- `truncate` inside a flex row needs `min-width: 0`: the component sets it.
- Very long unbroken strings (paths, hashes): `truncate` handles one line; for wrapping paths add `overflow-wrap: anywhere` via `lines`; documented in the story.
- Empty children render nothing visible but keep the element (callers decide).

## 11. Acceptance criteria

- [ ] All 55+ styles of OVE_DS004 render with the exact font shorthand, letter-spacing and transform (computed-style test per style in a real browser story test or Playwright; unit test checks the data attributes).
- [ ] `tone` overrides map to the listed tokens; no hex in the module (guard).
- [ ] `truncate` produces ellipsis within a 120px container; `lines={2}` clamps to two lines (Playwright measurement).
- [ ] `as="h1"` renders an `h1` with zero margin; `variant` has no default and TS rejects omission.
- [ ] Consistency test links `textStyles` keys and CSS rules both ways.
- [ ] Story: one story per style group (Titles, Body, Mono labels, Badges, Code) plus `Matrix`; axe clean.
- [ ] Visual test: the composed story `PulpitHeader` matches the crop within the structural tolerance defined by OVE_DS012 (fonts differ; geometry and colours must match).

## 12. Test plan

Vitest + Testing Library: `Text.test.tsx` (data attributes, tone mapping, `as`, rest props, forwards ref, dev warnings), `Text.styles.test.ts` (CSS consistency). Playwright via OVE_DS012: computed style assertions for 6 representative styles; visual test `Text/PulpitHeader` against `design.png`. Commands: `pnpm --filter @overmind/ui-kit test Text`, `pnpm --filter @overmind/ui-kit test:visual Text`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task.

## 14. Open questions and assumptions

- ASSUMPTION: `variant` is mandatory (no default style) so a missing choice is a type error, not a silent 14px.
- Open: whether `Text` should also provide `Heading` shortcuts. Default: no, one component only (KISS).
