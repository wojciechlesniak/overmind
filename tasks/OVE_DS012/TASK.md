---
id: OVE_DS012
title: "Visual-regression harness: baselines, design-crop comparison, states, axe sweep"
area: DS
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS008, OVE_SETUP004, OVE_TEST005]
soft_depends_on: []
provides: [lib:ui-visual-test, lib:ui-a11y-test]
needs: []
owns: [packages/ui-kit/visual/**, packages/ui-kit/playwright.visual.config.ts, packages/ui-kit/src/testing/**, packages/ui-kit/scripts/visual/**]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 19.5]
adr_refs: [18]
---

# OVE_DS012: Visual-regression harness: baselines, design-crop comparison, states, axe sweep

## 1. Summary

Provide the ui-kit-specific visual test harness: a Playwright runner over the built Storybook that (1) takes deterministic screenshots of every story and every interaction state of the `Matrix` stories and compares them with committed baselines, (2) compares chosen stories with the `design.png` crops of the DS tasks using a perceptual, font-tolerant comparison, and (3) sweeps all stories with axe. It exposes the `matchDesignCrop` helper and story parameters that every primitive task uses.

## 2. Context

Definition of Done item 4 requires a visual comparison against `design.png` within tolerance (`OVE_TEST005` owns the generic compare engine and CI gate). Facts that shape the design: (a) the exported mock PNGs are 2x of 1440x900 CSS px and were rendered by Chromium with a FALLBACK font (the sandbox could not fetch Google Fonts, `VIEWS.md`), so glyph widths in the crops differ from the real fonts; geometry, colour, radius and spacing are authoritative; (b) the mocks show no hover/focus/pressed/disabled/loading states, so those are compared only with baselines, never with crops; (c) the product runs in WKWebView on macOS, so a WebKit run is useful but the crops came from Chromium. The inventory (D.2 UI-07) asks for a crop helper using `VIEWS.md` regions at 2x and a baseline update command.

## 3. Scope (in)

- Playwright config and runner spec over `storybook-static` (`playwright.visual.config.ts`, `visual/stories.spec.ts`).
- Story parameter types and helpers in `src/testing/`: `DesignCropParameter`, `DesignFrame`, `withMatrixStates` support, `expectBox()`.
- `matchDesignCrop()` adapter over OVE_TEST005's compare engine with the thresholds in 5.4.
- Baseline workflow: `test:visual`, `test:visual --update`, `test:visual:docker`, report script.
- `expectNoAxeViolations(page)` and the axe sweep `test:a11y`.
- README section "How to write the visual test for a component".

## 4. Out of scope

- The generic image-diff engine, pixel thresholds policy and CI job: OVE_TEST005 (consumed here).
- The page-level comparison of all 18 mock views: DS part 2 (UI-71).
- A11y checklist and keyboard maps: DS part 2 (UI-70); this task provides only the sweep tooling.

## 5. Detailed requirements

**5.1 Runner**
1. `pnpm --filter @overmind/ui-kit test:visual` builds Storybook (`build-storybook`, cached) and runs Playwright against `storybook-static` served by a local static server on a random free port (bound to `127.0.0.1` only). Projects: `chromium` (default, runs baselines and design crops; same engine that rendered the mocks) and `webkit` (opt-in `--project=webkit`, baselines only, nightly).
2. Fixed environment: viewport 1440x900, `deviceScaleFactor: 2` (matches the 2x mock PNGs), `colorScheme: 'dark'`, `reducedMotion: 'reduce'`, `locale: 'en-US'`, `timezoneId: 'UTC'`, animations disabled (`animations: 'disabled'`, caret hidden), network blocked (any request not to the static server fails the test: proves offline fonts). Before each capture: wait for `document.fonts.ready` and assert `document.fonts.check('14px "Bricolage Grotesque"')` and `document.fonts.check('12px "JetBrains Mono"')` (fail with a clear message if the self-hosted fonts did not load, OVE_DS004).
3. Story discovery from `storybook-static/index.json`: every story with tag `visual` (default for primitives; opt out with tag `!visual`). Capture the element `#storybook-root > *:first-child` (the story root), not the page.
4. State driving: stories that use the `Matrix` helper (OVE_DS001 5.5) wrap cells in `data-visual-state="default|hover|focus|active|disabled|loading"`; the runner drives the real element inside the cell: hover = `locator.hover()`; focus = press a modifier key (keyboard modality) then `locator.focus()` and assert `matches(':focus-visible')`; active = hover + `mouse.down()` (released after capture); `disabled`/`loading` are props. Cells are captured individually and named `<storyId>--<cellKey>--<state>.png`.
**5.2 Baselines**
5. Stored in `packages/ui-kit/visual/__baselines__/<project>/<storyId>[--cell].png`, committed (plain git; size budget in open question). Comparison mode `pixel`: pixelmatch threshold 0.1 (anti-aliasing tolerant), failing when differing pixels > 0.1% of the image or any single contiguous diff region > 24x24 device px.
6. Official baselines are generated ONLY inside the pinned Playwright Docker image (`pnpm test:visual:docker`, image tag pinned in `visual/docker.env`) so font rasterisation is identical in CI. Local runs on macOS compare with a relaxed 0.5% threshold and print a warning that official numbers come from Docker. CI never runs with `--update`.
7. `pnpm test:visual --update [pattern]` rewrites matching baselines and prints the list; a PR that changes baselines must list the changed story ids in its description (checked by the PR template, OVE_OSS003) and reviewers look at the diff images attached as CI artifacts (`visual/__diffs__/`, gitignored locally).
**5.3 Design-crop comparison**
8. Stories declare `parameters.designCrop`:
```ts
interface DesignCropParameter {
  task: string;                 // 'OVE_DS013'
  file: string;                 // 'design.png' | 'design-secondary-row.png'  (relative to tasks/<task>/)
  frame?: { width?: number; height?: number };   // CSS px; default = crop pixel size / 2
  tolerance?: Partial<StructuralThresholds>;     // per-story overrides with a written reason in the story
  masks?: { x: number; y: number; width: number; height: number }[]; // CSS px regions ignored (e.g. text the fallback font renders differently)
  reason?: string;              // mandatory when tolerance or masks are set
}
```
9. `DesignFrame` (React helper in `src/testing/DesignFrame.tsx`) renders its children inside a box of the crop's CSS size on `bg-app` with `overflow: hidden` and optional `inset` so authors can place the component where it sits in the crop (the crop starts at an arbitrary x/y inside the view; the story reproduces the surrounding context, such as the panel background colour, rather than the whole view).
10. `matchDesignCrop(frameLocator, task, file, opts)`: loads `tasks/<task>/<file>` (repo-root relative; path resolved from `git rev-parse --show-toplevel`, rejected if it leaves `tasks/`), screenshots the frame at 2x, and calls OVE_TEST005's `compareImages` in `structural` mode.
**5.4 Structural comparison (tolerates fallback-font text)**
11. Algorithm: convert both images to sRGB, Gaussian blur sigma 2 CSS px (4 device px), downscale to 1/4, convert to CIE Lab, compute per-pixel deltaE76. PASS when mean deltaE <= 3, p95 deltaE <= 12, and the share of pixels with deltaE > 20 is <= 4%. Sizes must match within 4 CSS px in each dimension (else fail with both sizes printed). Thresholds are the defaults of `StructuralThresholds`; overrides need a `reason`. On failure the harness writes `actual.png`, `expected.png` and a heat-map `diff.png` next to the test results.
12. A "self-test" suite proves the metric works: identical image passes; a 1px shifted border passes; a wrong fill colour (`#140F20` vs `#1C1330`), a missing 2px selection border, or a 4px radius error on a 40px control FAILS (fixtures in `visual/__selftest__/`).
**5.5 Geometry helpers (because text widths cannot be compared)**
13. `expectBox(locator, { width?, height?, minWidth?, radius? })` asserts `getBoundingClientRect` and computed `border-radius` within 0.5px; `expectComputed(locator, { 'font-size': '13px', ... })`; `expectToken(locator, 'background-color', '--om-color-bg-surface')` resolves the token value and compares computed colours. Every primitive task uses these for its exact numbers (heights 34/40/44/46 etc.).
**5.6 A11y sweep**
14. `pnpm test:a11y` runs axe (`@axe-core/playwright`, tags `wcag2a, wcag2aa, wcag21aa, wcag22aa`, including `color-contrast`) on every story; any violation fails. Stories can disable a rule only with `parameters.a11y.disable = [{ rule, reason }]` (the reason is printed in the report; empty reasons fail).
**5.7 Reports**: `scripts/visual/report.ts` writes `visual/report.md` with one row per story that has a design crop (task, story, metrics, pass) and a count of baselines; used by UI-71 and by reviewers.
**5.8 Dependencies**: Playwright (OVE_SETUP008 catalog) and `@axe-core/playwright` (dev only, MIT; justification entry in `docs/dependencies.md`). Image decode/diff libraries come from OVE_TEST005, no new image dependency here.

## 6. Design notes

N/A, functionality only. Reference artefacts the harness consumes are the `design*.png` files next to each DS TASK.md (crops of `_design/views/*.png`).

## 7. Reuse

`compareImages` and image utilities from OVE_TEST005; Matrix helper and conventions from OVE_DS001; fonts from OVE_DS004 (checked); base CSS from OVE_DS008.

## 8. Architecture and code placement

`packages/ui-kit/visual/` (runner, baselines, selftests), `packages/ui-kit/src/testing/` (browser-side helpers imported only by stories and tests, excluded from the public barrel by the group allowlist), `scripts/visual/` (node tooling). Test-only code; nothing from here enters `dist/`. SRP: runner, comparison adapter, helpers are separate modules; the comparison engine is injected so OVE_TEST005 can evolve it (DIP).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`).
Specific: (a) the static server binds to `127.0.0.1` and serves only `storybook-static/` (path-traversal test); (b) design crops are read only from `tasks/**` (resolved real path must stay inside the repo; symlinks resolved and checked, OVE_SEC002 spirit); (c) network is blocked during runs so stories cannot exfiltrate or load remote fonts; (d) baselines are binary files: PR review must view diffs, and CI refuses `--update`; (e) no secrets or real Owner data in stories (fixtures only).

## 10. Errors and edge cases

- Fonts not loaded: the run fails before capturing (never silently baselines fallback fonts).
- Story throws: counted as failure with the Storybook error text.
- Flaky pixel (animation, caret): animations disabled; if a story still flakes, it must set `!visual` with a reason, never widen the global threshold.
- Crop file missing: failure naming the task folder.
- Baseline missing in CI: failure ("run test:visual:docker --update and commit"); locally it is created with a warning.
- Image sizes differ: structural comparison fails with both sizes.
- Docker unavailable: local fallback with relaxed threshold and a warning; CI always uses Docker.

## 11. Acceptance criteria

- [ ] `test:visual` runs over a fixture story set and passes on a clean tree; passes twice in a row (determinism).
- [ ] Self-tests: identical image passes; 1px border shift passes; wrong fill colour, missing 2px selection border and radius 12 vs 8 on a 40px control fail.
- [ ] Network access during a run fails the test (fixture story that fetches `https://example.com`).
- [ ] Missing self-hosted font aborts the run with the font-check message.
- [ ] `matchDesignCrop` resolves `tasks/OVE_DS013/design.png` and rejects `../../etc/passwd` and symlink escapes.
- [ ] `expectBox`, `expectComputed`, `expectToken` exist with unit tests.
- [ ] `test:a11y` fails on a deliberately low-contrast fixture story and passes on a clean one; a disabled rule without reason fails.
- [ ] `--update` rewrites only matching baselines; CI environment variable `CI=true` makes `--update` exit non-zero.
- [ ] README explains writing a visual test, tolerance rules and the Docker baseline workflow.
- [ ] `report.md` generated listing stories with crops.

## 12. Test plan

Self-tests under `visual/__selftest__/` (Playwright, run in CI as the harness's own gate); Vitest for `StructuralThresholds` maths (`compareAdapter.test.ts` with synthetic images), path-guard tests (`cropPath.test.ts`), `expectToken` tests. Commands: `pnpm --filter @overmind/ui-kit test:visual`, `test:visual:docker`, `test:a11y`, `test visual-selftest`.

## 13. Parallelization notes

Starts after OVE_DS001 and OVE_DS008 and when OVE_TEST005 exposes `compareImages` (soft: a local stub with the same signature is acceptable). Every primitive task consumes `matchDesignCrop`, so merge this early; until then tasks write their visual tests against the documented API and mark them `test.fixme` with the task id (not skipped silently). Hotspots: `visual/__baselines__/` binary files (each task adds only its own story baselines), `playwright.visual.config.ts` (this task only).

## 14. Open questions and assumptions

- ASSUMPTION: OVE_TEST005 exports `compareImages(actual, expected, { mode: 'pixel' | 'structural', thresholds }) => { pass, metrics, diff }`. If its API differs, only `compareAdapter.ts` changes.
- ASSUMPTION: baselines are committed as plain PNG. Budget 25 MB; beyond that move to Git LFS (decision for OVE_SETUP008).
- ASSUMPTION: structural thresholds (mean 3, p95 12, 4% above 20) are starting values; tune with the first 5 primitives and record the final numbers in the README.
- Open: should the `webkit` project become a CI gate? Default: nightly only.
