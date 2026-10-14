---
id: OVE_DS011
title: "Missing icons (close, chevron-down, undo, ...) and SVG status glyphs"
area: DS
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS009]
soft_depends_on: []
provides: [ui:icons-extra]
needs: []
owns: [packages/ui-kit/src/icons/data/close.ts, packages/ui-kit/src/icons/data/chevron-down.ts, packages/ui-kit/src/icons/data/chevron-up.ts, packages/ui-kit/src/icons/data/chevron-left.ts, packages/ui-kit/src/icons/data/minus.ts, packages/ui-kit/src/icons/data/more.ts, packages/ui-kit/src/icons/data/play.ts, packages/ui-kit/src/icons/data/stop.ts, packages/ui-kit/src/icons/data/refresh.ts, packages/ui-kit/src/icons/data/external-link.ts, packages/ui-kit/src/icons/data/copy.ts, packages/ui-kit/src/icons/data/trash.ts, packages/ui-kit/src/icons/data/edit.ts, packages/ui-kit/src/icons/data/filter.ts, packages/ui-kit/src/icons/data/info.ts, packages/ui-kit/src/icons/data/warning.ts, packages/ui-kit/src/icons/data/user.ts, packages/ui-kit/src/icons/data/folder.ts, packages/ui-kit/src/icons/data/terminal.ts, packages/ui-kit/src/icons/data/clock.ts, packages/ui-kit/src/icons/data/fit.ts, packages/ui-kit/src/icons/data/undo.ts, packages/ui-kit/src/icons/data/redo.ts, packages/ui-kit/src/icons/data/expand.ts, packages/ui-kit/src/icons/data/arrow-right.ts, packages/ui-kit/src/icons/data/arrows-horizontal.ts, packages/ui-kit/src/icons/data/glyph-*.ts, packages/ui-kit/src/icons/stories/ExtraIcons.stories.tsx]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 13]
adr_refs: [17]
---

# OVE_DS011: Missing icons (close, chevron-down, undo, ...) and SVG status glyphs

## 1. Summary

Draw the icons that the UI needs but the mocks only show as text characters or not at all (close, chevron-down caret, more, play, stop, refresh, external-link, copy, trash, edit, filter, info, warning, user, folder, terminal, clock, fit, undo, redo, expand, minus, arrows) and replace the Unicode status glyphs `✓ ✗ ● ○ ◆ ▍` with SVG shapes (inventory E21), all on the same 24 grid, stroke 1.8, round caps.

## 2. Context

Inventory A.10 final paragraph and E21: status glyphs are plain text characters in the mocks and will render differently per OS font; the select caret in the mock wrongly uses `chevron-right` (E4). Icons are added as data files only (OVE_DS009 owns the generator and `Icon`). Proposed path data below is a starting point; a designer review of the story is part of the acceptance (inventory: "reviewed by design").

## 3. Scope (in)

- Data files for the 26 icons in 5.1 and 8 glyphs in 5.2; story `Icons/Extra` with a grid at all sizes and a "next to the original 23" comparison row to check optical weight; regenerate the registry.

## 4. Out of scope

- The Icon component, generator: OVE_DS009. `StatusText` composition: OVE_DS020. Caret rotation logic in Select: OVE_DS030. Undo/redo/zoom toolbar: DS part 2 (UI-65).

## 5. Detailed requirements

**5.1 Icons (proposed geometry, viewBox 24, stroke 1.8, round, `fill: none`)**
| name | nodes | primary use |
|---|---|---|
| `close` | `path d="M6 6l12 12M18 6 6 18"` | dialog/toast/chip close |
| `chevron-down` | `path d="m6 9 6 6 6-6"` | select caret, menu trigger (replaces chevron-right misuse, E4) |
| `chevron-up` | `path d="m6 15 6-6 6 6"` | open caret |
| `chevron-left` | `path d="m15 6-6 6 6 6"` | back, pager |
| `minus` | `path d="M5 12h14"` | checkbox indeterminate, NumberStepper |
| `more` | three `circle r=1` at (5,12) (12,12) (19,12) | row "more" menu |
| `play` | `path d="M7 5v14l12-7z"` | resume Run |
| `stop` | `rect x=6 y=6 width=12 height=12 rx=2` | stop Agent/Run |
| `refresh` | `path d="M20 11a8 8 0 0 0-14.5-3.5M4 5v4h4M4 13a8 8 0 0 0 14.5 3.5M20 19v-4h-4"` | retry, redetect |
| `external-link` | `path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"` | open link in browser |
| `copy` | `rect x=9 y=9 width=11 height=11 rx=2`; `path d="M5 15V6a2 2 0 0 1 2-2h8"` | copy |
| `trash` | `path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"` | delete |
| `edit` | `path d="M4 20h4L19 9l-4-4L4 16z"`; `path d="m13.5 6.5 4 4"` | edit |
| `filter` | `path d="M4 5h16l-6 8v6l-4-2v-4z"` | filter |
| `info` | `circle cx=12 cy=12 r=9`; `path d="M12 11v5M12 8v.01"` | info toast |
| `warning` | `path d="M12 4 3 20h18z"`; `path d="M12 10v4M12 17v.01"` | warning toast |
| `user` | `circle cx=12 cy=8 r=3.5`; `path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"` | Owner |
| `folder` | `path d="M3 6h6l2 2h10v11H3z"` | plain folder |
| `terminal` | `rect x=3 y=5 width=18 height=14 rx=2`; `path d="m7 10 3 2-3 2M12 15h5"` | terminal |
| `clock` | `circle cx=12 cy=12 r=9`; `path d="M12 7v5l3 2"` | time |
| `fit` | `path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"` | zoom to fit |
| `undo` | `path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"` | undo |
| `redo` | `path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3"` | redo |
| `expand` | `path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"` | expand |
| `arrow-right` | `path d="M5 12h14M13 6l6 6-6 6"` | `→` in labels ("wróć do Developera") |
| `arrows-horizontal` | `path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"` | `↔` |
**5.2 Status glyphs (replace text characters; used by `StatusText`, OVE_DS020)**: `glyph-check` (same shape as `check`, stroke 2), `glyph-cross` (as `close`, stroke 2), `glyph-dot` (`circle cx=12 cy=12 r=5 fill=currentColor`), `glyph-ring` (`circle cx=12 cy=12 r=5`), `glyph-diamond` (`path d="M12 5l7 7-7 7-7-7z" fill=currentColor`), `glyph-caret` (`rect x=10 y=4 width=4 height=16 rx=1 fill=currentColor`, the terminal `▍`), `glyph-arrow` (same as `arrow-right`), `glyph-chevron-small` (`path d="m10 7 5 5-5 5"` for `›`). Glyphs are sized 12-14px in text rows; they inherit `currentColor`.
1. Optical rules: stroke 1.8 only (the `Icon` default), no filled shapes except the glyphs above and `more`/`grip` dots; every shape fits inside a 3px margin of the 24 grid except `fit` and `expand` (2px).
2. Each icon has a one-line `description` used as `aria-label` default in stories only; real labels come from callers.
3. Sizes shown in the story: 12, 14, 16, 18, 20, 22.

## 6. Design notes

N/A (these icons are not in the mocks, so there is no crop). Designer review of the grid story is an explicit step before merge.

## 7. Reuse

`IconData` format and generator (OVE_DS009). Optical comparison against the 23 original icons.

## 8. Architecture and code placement

Data files only in `src/icons/data/`. Registry regenerated by the OVE_DS009 generator (commit the regenerated file).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). All icons pass the OVE_DS009 whitelist generator; no external references.

## 10. Errors and edge cases

- Glyph legibility at 12px (`close`, `info`): story includes a 12px row; if unreadable the glyph is redrawn.
- Direction semantics: `chevron-down` for closed select, rotates to `chevron-up` via CSS or swaps to `chevron-up` when open (implementation choice in OVE_DS030).
- Name clash with a later icon task: the generator fails on duplicates.

## 11. Acceptance criteria

- [ ] All 26 icons and 8 glyphs exist, validate and appear in `IconName`.
- [ ] Story shows each at 12-22px next to `check`, `plus`, `search` for optical weight comparison; designer sign-off recorded in the PR.
- [ ] `glyph-*` shapes visually match the Unicode glyphs they replace (check, cross, dot, ring, diamond, block caret, arrow, chevron) at 12px (screenshot comparison in the PR).
- [ ] No data file uses any attribute outside the whitelist (generator green).
- [ ] Registry regenerated and `icons:check` green.

## 12. Test plan

Vitest `registry.test.ts` extended automatically (every registry entry renders); story `Icons/Extra`. Visual: story baseline (OVE_DS012).

## 13. Parallelization notes

Parallel with all primitives after OVE_DS009. Consumers: OVE_DS013 (loading spinner is NOT an icon: CSS), OVE_DS015, OVE_DS017 (chip close), OVE_DS020, OVE_DS024 (minus), OVE_DS030, OVE_DS036, OVE_DS037 need only `IconName` strings that exist after this task; until it merges they may use `close` from a local type assertion in tests.

## 14. Open questions and assumptions

- ASSUMPTION: geometry above is accepted after designer review; tweaks keep names stable.
- Open: spinner. Decision: the loading spinner is a CSS ring (OVE_DS013), not an icon (it must rotate smoothly and honour reduced motion).
