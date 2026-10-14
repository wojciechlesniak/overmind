---
id: OVE_DS006
title: "Spacing, radius, border width, z-index and layout constant tokens"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS039]
soft_depends_on: []
provides: [ui:tokens-layout]
needs: []
owns: [packages/ui-kit/src/tokens/layout.tokens.ts, packages/ui-kit/src/tokens/breakpoints.ts, packages/ui-kit/src/tokens/__tests__/layout.test.ts, packages/ui-kit/src/tokens/stories/Layout.stories.tsx]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 13]
adr_refs: [18]
---

# OVE_DS006: Spacing, radius, border width, z-index and layout constant tokens

## 1. Summary

Define the non-colour geometry tokens: the spacing scale, the radius scale (with semantic aliases for controls and cards), border widths, control heights, z-index layers and the layout constants of the app shell and panels, with the normalisations of inventory E1, E6, E8 and E20.

## 2. Context

Inventory A.3-A.5, A.7, A.9. Observed paddings are 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 36, 40, 48, 56 with +/-2px noise; page padding 22/24/26/28 is normalised to 24 (E6). Button heights 34-46 with arbitrary radii are normalised to three sizes plus the wizard size (E8). Fields are 40px (E20: global `box-sizing: border-box`, set in OVE_DS008).

## 3. Scope (in)

- `layout.tokens.ts` with the groups below, `breakpoints.ts` (TS constants, since CSS variables cannot be used in media queries), a story that renders each scale as visual swatches, and tests asserting exact values.

## 4. Out of scope

- Colours: OVE_DS002/003. Shadows, rings, motion: OVE_DS007. Applying layout constants in `AppRail`, `TopBar`, `PageLayout`: DS part 2 (UI-20..UI-22).
- Canvas internals beyond the constants listed (node tile size etc. are only exposed as tokens here): DS part 2 (UI-60+).

## 5. Detailed requirements

**5.1 Spacing** `--om-space-<n>` for n in 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 36, 40, 48, 56 (value `<n>px`). `--om-page-pad: 24px` (E6), `--om-page-pad-dense: 20px` (Task Board, canvas strip), `--om-panel-pad: 20px` (side panels 16-22 collapse to 20), `--om-gap-section: 16px`.

**5.2 Radius (exact)** `--om-radius-<n>` for n in 3, 5, 6, 7, 8, 10, 12, 13, 14, 16, 18, 20, 22, 24, 28 (px); `--om-radius-pill: 999px`; `--om-radius-round: 50%`; `--om-radius-blob: 42% 58% 55% 45% / 48% 42% 58% 52%` (Agent avatar); `--om-radius-bubble-owner: 20px 20px 6px 20px`; `--om-radius-bubble-owner-tg: 16px 16px 4px 16px`; `--om-radius-bubble-other-tg: 16px 16px 16px 4px`. Semantic aliases (components use these, not the raw numbers): `--om-radius-control-sm: var(--om-radius-10)` (button sm, small icon button, segmented items, select), `-control-md: var(--om-radius-12)` (default button, fields), `-control-lg: var(--om-radius-14)` (large button, textarea, list rows, rail items), `-card-sm: 14`, `-card-md: 16`, `-card-lg: 18`, `-card-xl: 20`, `-card-2xl: 22`.

**5.3 Border widths** `--om-border-hairline: 1px` (default), `--om-border-selected: 1.5px` (selected cards), `--om-border-thick: 2px` (node tiles, tab underline, step ring), `--om-border-port: 2.5px`, `--om-border-dashed-width: 1px`; dashed-2px edges are canvas-specific (DS part 2).

**5.4 Control heights (E8, E20)** `--om-control-h-sm: 34px`, `-md: 40px` (default; also fields, selects, search), `-lg: 44px` (approve/deny, send, dashed add), `-xl: 46px` (wizard CTA), `--om-control-h-topbar-pill: 28px`, `--om-hit-min: 34px`. The mock's 38px select and 42px search/ModelPicker become 40px (documented deviation, `appset/setting-row-select`, `decis/search`).

**5.5 Z-layers (A.7)** `--om-z-base: 0`, `-sticky: 10` (top bar, tab bar), `-canvas-overlay: 20`, `-drag: 30`, `-popover: 40` (menus, selects), `-dialog: 50` (scrim and dialog), `-toast: 60`, `-tooltip: 70`.

**5.6 Layout constants (A.9; E1 applied)** `--om-layout-rail-w: 72px`; `--om-layout-topbar-h: 67px` (ALWAYS, E1; items 28-42px, no wrapping); `--om-layout-topbar-path-max: 220px`; `--om-layout-subtabs-h: 45px` (44px button + 1px border; the active tab is 42px+2px underline per E5 inside it); panel presets `--om-layout-list-270, -290, -340, -360, -400` and `--om-layout-detail-290, -300, -320, -340, -400`; `--om-layout-chat-max: 780px`, `--om-layout-discussion-max: 820px`, `--om-layout-settings-max: 980px`, `--om-layout-wizard-sidebar: 360px`, `--om-layout-wizard-content: 620px` (640 step 2), `--om-layout-tray-w: 380px`, `--om-layout-tray-max-h: 560px` (E3), `--om-layout-canvas-grid: 22px`, `--om-layout-node-w: 224px`, `--om-layout-node-h: 112px`, `--om-layout-port: 14px`.

**5.7 Breakpoints (`breakpoints.ts`)** `compact: 1280` (E1: below this the limit pill collapses to "62%" with a meter below; the mocks are 1440 only, open question 7). Exported as typed constants plus a `useMediaQuery` hook is NOT included (OVE_DS008 / shell tasks).

## 6. Design notes

N/A, tokens only. Reviewers compare numbers in the story.

## 7. Reuse

`defineTokens` (OVE_DS039).

## 8. Architecture and code placement

`packages/ui-kit/src/tokens/` data only; no logic. Semantic aliases (`-control-md`) exist so a radius change for a role touches one line (DRY, OCP).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). No security-specific content: pure constants.

## 10. Errors and edge cases

- A component needing a spacing value not in the scale (for example 9px): use the nearest token and add a note; do not add one-off values. A new value requires a proposal against this task.
- Values below the 34px hit target (`--om-hit-min`): only allowed for decorative elements.
- A mock value that disagrees with a normalisation (select 38px): the token wins and the visual-test tolerance of the affected task covers the 2px difference.

## 11. Acceptance criteria

- [ ] All variables in 5.1-5.6 exist with exactly the listed values (table-driven test).
- [ ] `--om-layout-topbar-h` is 67px and no 117px value exists anywhere in tokens.
- [ ] Semantic radius aliases resolve to the listed raw radii.
- [ ] `breakpoints.compact === 1280`.
- [ ] Story shows spacing bars, radius swatches, z-layer list; axe clean.

## 12. Test plan

Vitest `layout.test.ts` (expected table), story `Foundation/Layout`. Command: `pnpm --filter @overmind/ui-kit test tokens`.

## 13. Parallelization notes

Parallel with OVE_DS002/003/004/007. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: panel padding normalised to 20px (mocks: 16-22).
- Open (inventory open question 7): behaviour below 1280px. Default: only the top-bar limit pill collapses; no responsive layouts for panels.
