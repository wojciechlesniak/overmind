---
id: OVE_DS002
title: "Colour tokens I: surfaces, lines, text, scrim and interaction fills"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS039]
soft_depends_on: []
provides: [ui:tokens-color-core]
needs: []
owns: [packages/ui-kit/src/tokens/colors-core.tokens.ts, packages/ui-kit/src/tokens/__tests__/colors-core.test.ts, packages/ui-kit/src/tokens/stories/ColorsCore.stories.tsx]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 13]
adr_refs: [18]
---

# OVE_DS002: Colour tokens I: surfaces, lines, text, scrim and interaction fills

## 1. Summary

Define the neutral half of the colour system of the dark violet theme as CSS custom properties plus a typed TS mirror: page and panel surfaces, line (border) colours, the text colour ladder, ink colours for text on bright fills, scrim and the interaction fill steps (hover, selected, raised). Values are exact copies of `COMPONENT-INVENTORY.md` A.1.1 and A.1.2 with the normalisations of section E (E11, E12, E18) applied.

## 2. Context

Style 1 "dark violet with neon" was chosen on 2026-10-13 (`docs/design/styl-wizualny.md`). The mocks are dark only; tokens are semantic first (role) so a light theme could be added later (inventory open question 4). The accent families (magenta, violet, mint, amber, blue, cyan, error), tints, state/visibility maps and Agent hues are in OVE_DS003. This task is the base every component CSS reads, so a wrong value here repeats in 18 views.

## 3. Scope (in)

- File `colors-core.tokens.ts` created through `defineTokens('colors-core', {...})` (OVE_DS039) with every token of the tables below.
- Typed access: `tokens.colorBgApp` etc. (generated).
- A swatch story `Foundation/Colours/Core` listing token name, hex, role and contrast ratio against its usual background.
- A unit test `colors-core.test.ts` that (a) checks each value against the table, (b) computes WCAG contrast ratios for the declared pairs and asserts the thresholds in 5.5.

## 4. Out of scope

- Accent families, rgba tints, state and Visibility maps, Agent hues: OVE_DS003.
- Typography colours of named text styles (they just reference these tokens): OVE_DS004.
- Glow and ring shadows: OVE_DS007. Focus ring colour is `--om-color-violet-500` (OVE_DS003) used by OVE_DS007.
- Applying tokens to components: each component task.

## 5. Detailed requirements

**5.1 Naming.** `--om-color-<role>`; role names are the inventory names (`bg-app` -> `--om-color-bg-app`). No component may use a hex literal; it uses these variables.

**5.2 Surfaces (exact)**
| CSS variable | Value | Role |
|---|---|---|
| `--om-color-bg-app` | `#0A0710` | page background, canvas port fill, node ports, Start/Join fill base |
| `--om-color-bg-panel` | `#0D0915` | AppRail, TopBar, SubTabs, right asides, onboarding sidebar base |
| `--om-color-bg-panel-alt` | `#0C0814` | left list panels, Lanes, canvas stage, Settings select/field fill, Workspace sections |
| `--om-color-bg-surface` | `#140F20` | default card, pill, secondary button, textarea |
| `--om-color-bg-surface-sel` | `#1A1422` | selected or hovered list row, selected conversation, selected Decision (always with border `line-strong`) |
| `--om-color-bg-raised` | `#1C1330` | active rail item, active filter chip, select hover, tooltip and toast fill base |
| `--om-color-bg-composer` | `#120D1C` | Composer, Chief message panel, Telegram input area |
| `--om-color-bg-code` | `#06040A` | terminal, diff, Skill markdown preview |
| `--om-color-bg-node-start` | `#160F24` | Start / "save Decisions" pill, palette item |
| `--om-color-bg-node-model` | `#17111F` | model pill on a Node tile |
| `--om-color-bg-badge-version` | `#191226` | VersionBadge |
| `--om-color-bg-bubble-owner` | `#2A1F40` | Owner message bubble (desktop) |
| `--om-color-bg-logo-tile-from` / `-to` | `#1E1330` / `#0A0710` | logo tile gradient (160deg) |
| `--om-color-ink` | `#12091F` | text and icons on bright fills (primary buttons, avatars), Switch knob (on) |
| `--om-color-ink-amber` | `#1A1005` | text on amber fills |
| `--om-color-on-badge` | `#0A0710` | text on filled Visibility badges and Node tabs |

**5.3 Lines (exact)**
| CSS variable | Value | Role |
|---|---|---|
| `--om-color-line-subtle` | `#241B36` | panel dividers, rail/top bar borders, list separators, nested card border |
| `--om-color-line` | `#2A2040` | control and card borders, progress track |
| `--om-color-line-strong` | `#5B3E8F` | selected row border, active rail border, dashed "add" buttons, step ring |
| `--om-color-line-canvas` | `#5B4596` | canvas edges, Start/Save pill border, palette/minimap lines |
| `--om-color-line-owner` | `#3A2A5C` | Composer border, Owner bubble (Telegram) |
| `--om-color-line-neutral-outline` | `#3A2E44` | Deny button (neutral outline) |
| `--om-color-line-control` | `#6E5AA6` | NEW (inventory E18): border of inputs, selects, checkboxes, radios and the Switch off-state outline; 3.29:1 on `bg-surface`, 3.5:1 on `bg-app` |

**5.4 Text (exact; inventory E11 duplicates collapsed)**
| CSS variable | Value | Role |
|---|---|---|
| `--om-color-text-primary` | `#EFE9F7` | body, titles, values; default `color` on root |
| `--om-color-text-bright` | `#F6EFFF` | canvas Node title, active rail icon (absorbs `#F6F1FF`) |
| `--om-color-text-body-soft` | `#E3DAF0` | card summary paragraphs (absorbs `#D9C7EA`, so Deny label becomes `#E3DAF0`) |
| `--om-color-text-secondary` | `#A79BBF` | secondary labels, inactive tabs, table values |
| `--om-color-text-muted` | `#8C80A6` | mono labels, section labels, timestamps, hints |
| `--om-color-text-lavender` | `#D6C9FF` | Skill chip text, doc references, icon stroke |
| `--om-color-text-lavender-strong` | `#C9B8FF` | Discussion kind, canvas pill text |
| `--om-color-text-link` | `#E9D8FF` | underlined links |
`#E9D2AE` (amber-card body) is defined in OVE_DS003 as `--om-color-amber-body`.

**5.5 Interaction fill steps and overlays (derived; every component's std states use these)**
| CSS variable | Value | Use |
|---|---|---|
| `--om-color-hover-from-transparent` | `var(--om-color-bg-surface)` | hover of a transparent control |
| `--om-color-hover-from-surface` | `var(--om-color-bg-raised)` | hover of a `bg-surface` control (secondary button, pill) |
| `--om-color-hover-from-selected` | `var(--om-color-bg-raised)` | hover of an already selected row |
| `--om-color-border-hover` | `var(--om-color-line-strong)` | hover border |
| `--om-color-scrim` | `color-mix(in srgb, var(--om-color-bg-app) 72%, transparent)` | Dialog scrim (`rgba(10,7,16,.72)`) |
| `--om-color-surface-a92` / `-a96` | `color-mix(in srgb, var(--om-color-bg-surface) 92% / 96%, transparent)` | canvas legend (`.92`), Tray and Menu surface (`.96`) |
| `--om-color-disabled-track` | `var(--om-color-bg-raised)` | disabled Switch track |

**5.6 Contrast contract (tested)**
Required ratios, computed with the WCAG 2.x relative-luminance formula: text-primary on `bg-surface` >= 15 (actual 15.79); text-secondary on `bg-surface` >= 7 (7.22); text-muted on `bg-surface` >= 5 (5.14), on `bg-app` >= 5.4 (5.48), on `bg-surface-sel` >= 4.9 (4.93), on `bg-raised` >= 4.8 (4.85); text-muted on `line` fill `#2A2040` is only 4.17 and MUST NOT be used for text (it is allowed for non-text knobs, 3:1); `line-control` on `bg-surface` >= 3.2, on `bg-raised` >= 3.1, on `bg-surface-sel` >= 3.1; `ink` on violet-500 >= 6.1 and on magenta-500 >= 6.6 (asserted in OVE_DS003); `line` on `bg-surface` is 1.23 and `line-strong` is 2.26: decorative only (cards, dividers), never the sole boundary of a form control (E18). The test file contains this matrix as data so a future palette change fails loudly.

## 6. Design notes

N/A for pixel comparison; reviewers use the swatch story. Reference render: any view shows the stack of surfaces (`Pulpit`: app `#0A0710`, rail/top bar `#0D0915`, cards `#140F20`).

## 7. Reuse

`defineTokens` and the generated pipeline (OVE_DS039). No components.

## 8. Architecture and code placement

`packages/ui-kit/src/tokens/` only. Pure data, no logic besides the contrast helper in the test (a tiny local `contrast(a, b)` function in `src/tokens/__tests__/contrast.ts`, reused by OVE_DS003).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`).
Specific: contrast values are an accessibility safety property: unreadable warning text next to an Approval button is a safety defect (Owner could approve blindly). The contrast test is therefore a CI gate.

## 10. Errors and edge cases

- A token referenced in a later task but missing here: the generator's unresolved-reference check fails the build (OVE_DS039).
- A near-duplicate hex added later (for example `#F6F1FF`): add to the alias table in the test (`forbidden-duplicates`) which fails when any component or token file contains it.
- Browser without `color-mix()`: not supported (macOS 26 WebKit supports it), no fallback is written; the visual harness runs on the same engine class.

## 11. Acceptance criteria

- [ ] Every token in 5.2-5.5 exists in generated `tokens.css` with the exact value.
- [ ] `tokens.colorBgApp === 'var(--om-color-bg-app)'` and `tokenValues['--om-color-bg-app'] === '#0A0710'` (typed).
- [ ] The contrast matrix test passes with the thresholds in 5.6.
- [ ] `#F6F1FF` and `#D9C7EA` do not appear anywhere in `packages/ui-kit/src` (forbidden-duplicates test).
- [ ] The swatch story renders each token with name, hex and role; axe has no violations on the story page.
- [ ] `no-raw-colours` guard (OVE_DS001) passes: hex literals exist only under `src/tokens/`.

## 12. Test plan

Vitest: `colors-core.test.ts` with (a) table-driven value test, (b) `contrast.test.ts` for the matrix, (c) forbidden-duplicates scan. Storybook story `Foundation/Colours/Core` (autodocs). No visual test against a crop (design: none); the story baseline is captured by OVE_DS012 once available.

## 13. Parallelization notes

Parallel with OVE_DS003, OVE_DS004, OVE_DS006, OVE_DS007 (separate token files, no shared file). OVE_DS003 reads these variables (`var(--om-color-bg-surface)` in alpha tints is not needed; it defines accent values itself). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: `line-control` `#6E5AA6` is adopted exactly as the inventory proposes (E18); designers may want a slightly less bright control border, which would be a one-line value change here.
- ASSUMPTION: dark only. The `[data-om-theme]` selector in the generator leaves room for a light theme.
- Open (inventory open question 4): add a light theme after MVP? Default: no.
