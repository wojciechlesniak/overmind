---
id: OVE_DS010
title: "LogoMark and LogoTile (hex-cell brand mark)"
area: DS
kind: ui
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS002, OVE_DS003, OVE_DS007, OVE_DS009]
soft_depends_on: []
provides: [ui:LogoMark, ui:LogoTile]
needs: []
owns: [packages/ui-kit/src/icons/LogoMark/**, packages/ui-kit/src/icons/LogoTile/**]
reads: []
design: design.png
design_source: "Main#shell/rail-logo (crop 0,0,72,70) and Tray#tray/header (design-tray-header.png)"
spec_refs: [SPECIFICATION 13]
adr_refs: [28]
---

# OVE_DS010: LogoMark and LogoTile (hex-cell brand mark)

## 1. Summary

Implement the brand mark ("Plaster": four hexagonal cells, one filled for the Chief and three outlined for Agents) as `LogoMark`, and the rounded gradient tile that frames it as `LogoTile` in its three sizes (28, 40, 44).

## 2. Context

`docs/design/styl-wizualny.md` "Logo: Plaster" defines the geometry (viewBox 64x64, hexagons with a vertex on top, radius 10, filled cell centre (32, 16.5), outline centres (23.3, 31.5), (40.7, 31.5), (32, 46.5), stroke 3.2) and the gradient `#FF8AD8` to `#9B7BFF` on the diagonal. The tile is `linear-gradient(160deg, #1E1330, #0A0710)` with a 1px `#5B3E8F` border and `glow-logo`. Used in the rail (44px tile, 30px mark), wizard sidebar (44px tile), Telegram header (40px tile r12, 28px mark), Tray header (28px tile r8, 20px mark), app icon, Dock, favicon (not built here). The mark must not become an organic "brain blob" (style doc "Unikaj").

## 3. Scope (in)

- `LogoMark` (SVG, unique gradient id per instance) and `LogoTile` with sizes `xs` 28, `sm` 40, `md` 44.
- Stories, tests, visual test against both crops.

## 4. Out of scope

- Raster app icon, `.icns`, favicon, Dock: OVE_SETUP014 (packaging). Wordmark text "Overmind": `Text` style `wordmark` (OVE_DS005) in the composite WizardLayout (DS part 2).
- Rail layout around the tile: DS part 2 (UI-20).

## 5. Detailed requirements

**5.1 `LogoMark`**: `interface LogoMarkProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox'> { size?: number /* default 30 */; label?: string }`. Geometry exactly as the inventory snippet (A.10): four paths in viewBox `0 0 64 64`:
`M32.0 6.5 L40.7 11.5 L40.7 21.5 L32.0 26.5 L23.3 21.5 L23.3 11.5 Z` filled with the gradient; three outline paths (`M23.3 21.5 L32.0 26.5 L32.0 36.5 L23.3 41.5 L14.6 36.5 L14.6 26.5 Z`, `M40.7 21.5 L49.4 26.5 L49.4 36.5 L40.7 41.5 L32.0 36.5 L32.0 26.5 Z`, `M32.0 36.5 L40.7 41.5 L40.7 51.5 L32.0 56.5 L23.3 51.5 L23.3 41.5 Z`) with `fill="none" stroke="url(#id)" stroke-width="3.2" stroke-linejoin="round"`. Gradient `linearGradient` `x1=0 y1=0 x2=1 y2=1`, stops `--om-color-magenta-logo-start` (`#FF8AD8`) at 0 and `--om-color-violet-500` (`#9B7BFF`) at 1 via `stop-color: var(...)` in CSS. The gradient `id` comes from React `useId()` (unique per instance, the mock's `om-rail`/`om-tray`/`om-tg` collisions would break when two marks share an id).
1. Decorative by default (`aria-hidden`); with `label` it is `role="img" aria-label`.
2. The geometry lives in one constant (`LOGO_CELLS`) reused by the story that overlays the style-doc centres, and a unit test recomputes hexagon vertices from centre and radius 10 (flat-to-vertex with a vertex on top: points at angles -90, -30, 30, 90, 150, 210 deg) and asserts they equal the path coordinates within 0.05.
**5.2 `LogoTile`**: `interface LogoTileProps { size?: 'xs' | 'sm' | 'md'; label?: string }` (default `md`).
| size | tile | radius | mark | border | glow |
|---|---|---|---|---|---|
| `xs` | 28x28 | `--om-radius-8` | 20 | 1px `--om-color-line-strong` | `--om-glow-logo` |
| `sm` | 40x40 | `--om-radius-12` | 28 | same | same |
| `md` | 44x44 | `--om-radius-14` | 30 | same | same |
Background `linear-gradient(160deg, var(--om-color-bg-logo-tile-from), var(--om-color-bg-logo-tile-to))`; flex centred; `flex-shrink: 0`.
3. Neither component is interactive. When used as a link/button the parent provides the focusable element and its accessible name.

## 6. Design notes

`design.png`: rail logo tile (44px, mark 30px, border `#5B3E8F`, soft magenta glow). `design-tray-header.png`: the 28px tile r8 with 20px mark next to the "Overmind" title and status line (the title and status text belong to TrayMenu, DS part 2). Not drawn: hover/focus (non-interactive).

## 7. Reuse

`Icon` conventions (OVE_DS009: decorative-by-default a11y rule); colour and glow tokens (OVE_DS002, OVE_DS003, OVE_DS007); radius tokens (OVE_DS006).

## 8. Architecture and code placement

`packages/ui-kit/src/icons/LogoMark/` and `LogoTile/` (group `icons`). Pure SVG/CSS. No dependency on app code.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). The mark is a trademark-like asset: the geometry constant is the single source; apps must not redraw it.

## 10. Errors and edge cases

- Two marks on one page: unique ids (test renders 3 and checks distinct `id`/`url(#id)`).
- `size` very small (< 16): allowed but not a supported size (stroke 3.2 in 64 grid becomes thin); story warns.
- SSR/hydration: `useId` stable.

## 11. Acceptance criteria

- [ ] Rendered paths equal the inventory/style-doc geometry; vertex recomputation test passes (tolerance 0.05).
- [ ] Gradient id unique per instance; `url(#id)` references resolve.
- [ ] `LogoTile` sizes produce 28/40/44 px boxes with the radii and mark sizes in 5.2 (Playwright bounding boxes).
- [ ] Decorative by default; `label` gives `role="img"`.
- [ ] Visual: `LogoTile md` story matches the logo crop and `xs` matches the Tray header crop within tolerance.
- [ ] Story shows mark alone, three tile sizes, and the style-doc centre overlay; axe clean.

## 12. Test plan

Vitest: geometry test, unique-id test, a11y variants. Playwright (OVE_DS012): bounding boxes + `matchDesignCrop` for both crops. Story `Brand/LogoMark`, `Brand/LogoTile`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. The only other consumer-sensitive file is `icons/` group registry: this task adds no icon data.

## 14. Open questions and assumptions

- ASSUMPTION: gradient stop colours come from tokens, so a rebrand changes tokens only.
- Open: monochrome variant (for tray template image on macOS menu bar). Default: not in ui-kit; Tauri tray icon assets are handled by OVE_SETUP014/TRAY.
