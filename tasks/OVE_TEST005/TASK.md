---
id: OVE_TEST005
title: Build the visual regression harness with design-crop layout reconciliation
area: TEST
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS004, OVE_TEST001, OVE_TEST004]
soft_depends_on: [OVE_ARCH011]
provides: ["lib:visual-regression", "lib:design-crop-compare", "lib:vr-review-report", "lib:visual-test-harness"]
needs: ["lib:ui-fonts", "lib:storybook"]
owns: ["tools/visual/**", "apps/desktop/e2e/visual/helpers/**", "apps/desktop/e2e/visual/playwright.visual.config.ts", "apps/desktop/e2e/visual/selftest/**", "packages/ui-kit/visual/**", "docs/testing/visual-regression.md"]
reads: ["tasks/_design/VIEWS.md", "tasks/_design/views/", "tasks/_design/COMPONENT-INVENTORY.md", "docs/design/styl-wizualny.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 19"]
adr_refs: [17, 18]
---

# OVE_TEST005: Build the visual regression harness with design-crop layout reconciliation

## 1. Summary

Give every UI and design-system task one call that proves "this looks like the design and keeps looking like it": `expectMatchesDesign()` compares the rendered region against the task's `design.png` crop (layout conformance with text masked) and against a committed baseline captured with real fonts (pixel regression). It includes dynamic-region masking, a pinned rendering environment, a review report and an explicit baseline update workflow.

## 2. Context

Each UI task has a `design.png`, a crop of the 2x export (2880x1800) of a 1440x900 view (`tasks/_design/VIEWS.md`, CONVENTIONS section 9). The mock exports were rendered with fallback fonts because Bricolage Grotesque and JetBrains Mono could not be fetched in the export environment, so glyph shapes, text widths and line breaks in the crops differ from what the real fonts produce. The implementation ships with the real fonts bundled locally (OFL, no network). Therefore the design crop is a LAYOUT reference (boxes, spacing, colours, borders, icons) and not a pixel golden for text; pixel goldens ("baselines") must be captured from the implementation with the real fonts, in a pinned environment, and reviewed against the design before being committed. DoD item 4: "visual comparison against `design.png` within tolerance (`OVE_TEST005`)". Storybook stories (DS tasks) and app pages (UI tasks) both use the harness.

## 3. Scope (in)

- Library `tools/visual/` (image loading, masking, blur, alignment, metrics, report generation, front matter reading).
- Playwright helpers `expectMatchesDesign`, `expectBaseline`, `vr.mask()`, `vr.regionBox()`.
- Pinned rendering environment (Playwright container image by digest, Chromium flags, bundled fonts check).
- Baseline storage convention, update workflow (`pnpm vr:review`, `pnpm vr:update`), CI behaviour.
- Storybook screenshot target support for `ui-kit`.
- Documentation and self-tests (known-good and known-bad fixtures).

## 4. Out of scope

- The fonts themselves and tokens: DS (`lib:ui-fonts`). Writing visual tests for specific regions: each UI task. Cross-browser or native macOS WebKit rendering (Tauri uses WKWebView; Chromium is the test engine, a known gap listed in section 14). Accessibility: `OVE_TEST010`.

## 5. Detailed requirements

1. **API (Playwright):**
   ```ts
   expectMatchesDesign(target: Page | Locator, opts: {
     task: string;                    // e.g. 'OVE_BOARDUI012'; resolves tasks/<task>/design.png (or design-<name>.png via `design`) and design_source
     name?: string;                   // state name, default 'default'; baseline file key
     design?: string;                 // 'design' | 'design-<suffix>'
     clip?: 'design-box' | 'locator'; // design-box: page coordinates from design_source (view-level tests at 1440x900); locator: element box +pad (stories, isolated components)
     pad?: number;                    // CSS px around locator, default equals design margin
     mask?: (string | Locator)[];     // additional dynamic regions
     textMask?: 'auto' | 'off';       // default 'auto'
     tolerance?: Partial<Tolerance>;  // overrides need a justification string in `why`
     why?: string;
   }): Promise<void>
   expectBaseline(target, { task, name, mask?, tolerance? }): Promise<void>   // baseline only, for states with no design crop (hover, focus, error, empty, loading)
   ```
2. **Rendering environment:** viewport 1440x900, `deviceScaleFactor: 2`, locale `en` (design copy is Polish: tests run the `pl` locale for design comparisons so text lengths resemble the mock; baselines are captured per locale used: design comparisons in `pl`, additional layout stress baselines in `en-XA`), `colorScheme: 'dark'` (the design is dark), `reducedMotion: 'reduce'`, animations disabled, caret hidden, `timezoneId: 'UTC'`, `page.clock` fixed (TEST004). Chromium launched with `--force-color-profile=srgb --font-render-hinting=none --disable-lcd-text --disable-font-subpixel-positioning --disable-gpu`. Runs only inside the pinned Playwright Docker image (digest in `tools/visual/environment.json`, recorded in `pins.json` of SEC006); `pnpm vr:docker` runs the visual project in that image locally (macOS developers). Outside the image the baseline comparison is skipped with a loud warning and design-reference mode runs in advisory (non-failing) mode; `--update-snapshots` outside the image is refused.
3. **Fonts:** before any screenshot `app.ready()` awaits `document.fonts.ready` and the harness asserts that `Bricolage Grotesque` and `JetBrains Mono` are loaded from bundled files (via `document.fonts.check`) and that no fallback font is used for text elements carrying the font tokens (computed font-family + a probe element comparison); otherwise the test fails with "fonts not loaded". Network requests to Google Fonts are blocked (TEST004) and a request attempt fails the test.
4. **Design-reference comparison algorithm** (`tools/visual/compare-design.ts`):
   1. Load `design.png` (2x). Determine the crop box from `design_source` (`View#slug (crop x,y,w,h)`); verify the PNG size equals `2*w x 2*h` (+/- 2 px) else error `VR_DESIGN_SIZE_MISMATCH`.
   2. Capture the implementation at the same box (`clip: 'design-box'`) or the locator box padded (`clip: 'locator'`). In locator mode, search an alignment offset in [-8, +8] CSS px (2x pixels) maximising edge correlation on the masked, downscaled images; report the chosen offset; fail if |offset| > `tolerance.maxOffsetPx` (default 4).
   3. **Text masking (`textMask: 'auto'`)**: collect bounding rects of all text nodes (and `<input>` values, placeholders, `<svg><text>`) from the implementation DOM through `Range.getClientRects()`, inflate by 2 CSS px, plus explicitly masked selectors; paint those rectangles with one flat colour on BOTH images (implementation and design), so glyph shape and exact line breaks do not count; multi-line text blocks are masked as the union of the implementation's line rects, and a **text-block extent check** compares the implementation's text bounding box with the design's detected text bounding box (non-background pixel bounds inside the same masked area) allowing tolerance of 12% in width and 8% in height (font metrics differ), failing for gross differences (text missing, wrongly aligned left/right/centre, clipped).
   4. Convert to a common colour space, apply Gaussian blur (sigma 1.0 CSS px) to ignore anti-aliasing and sub-pixel differences, downscale by 2, compare with `pixelmatch` (threshold 0.12 in YIQ delta) ignoring masks; compute `mismatchRatio` over unmasked pixels and `worstTile` (32x32 CSS px tiles, max local ratio).
   5. Pass criteria (defaults `Tolerance`): `mismatchRatio <= 0.04`, `worstTile <= 0.35`, `maxOffsetPx <= 4`, size difference <= 2 CSS px. Overrides require `why` and are capped (`mismatchRatio <= 0.08`); more than that must be handled by splitting the region or fixing the design/implementation discrepancy.
   6. Colour check: sample the dominant background and border colours at 8 fixed probe points defined by simple k-means of the design crop outside masks; compare to implementation in OKLab delta E <= 3.0 (catches wrong tokens that blur hides).
   7. Artifacts on failure/always in report mode: `design.png` (masked), `impl.png` (masked), `diff.png`, `overlay.png` (50% blend), JSON metrics, the list of masks.
5. **Geometry check (complements pixels):** if elements in the region have `data-region="<slug>"` (convention from TEST004), `expectRegionGeometry(page, 'tasks/_design/VIEWS.md')` compares bounding boxes against the measured table in `VIEWS.md` for the slugs inside the crop: x, y, width, height within `max(4 px, 2%)` (text-driven widths within 8%), because the table was measured with fallback fonts. The helper is invoked automatically by `expectMatchesDesign` for slugs present in both places and reports deviations in a table.
6. **Baseline comparison** (`expectBaseline`, also run after design comparison in `expectMatchesDesign`): Playwright `toHaveScreenshot` with `maxDiffPixelRatio: 0.001`, `threshold: 0.15`, `animations: 'disabled'`, `scale: 'device'`, files at `apps/desktop/e2e/visual/__baselines__/<TASKID>/<name>.<locale>.png` (or `packages/ui-kit/visual/__baselines__/...` for stories); a custom `snapshotPathTemplate` removes platform suffixes because only the pinned image is allowed. Baseline images are cropped regions (not full pages), max 400 KB each; repository budget 60 MB, checked by `pnpm vr:budget` (warning at 80%, error at 100%; Git LFS adoption is an open question).
7. **Dynamic regions:** elements that change between runs (timestamps, relative times, counters from live data, random avatars, spinners, progress animations, caret) MUST carry `data-vr-mask` in the implementation or be listed in `mask`. The harness also applies a deterministic freeze: `page.clock`, `Math.random` seed, CSS `animation: none !important; transition: none !important`, `video`/canvas pause. A checker (`vr:lint`) fails if a mask covers more than 20% of the crop area (`VR_MASK_TOO_LARGE`) unless `why` is given.
8. **Update and review workflow:**
   - `pnpm vr:review <TASKID>` runs the task's visual specs in the pinned image and builds `visual-report/<TASKID>/index.html` showing, per name: design crop, masked design, implementation, masked implementation, diff, overlay slider, metrics, geometry table, fonts check result.
   - `pnpm vr:update <TASKID> [--name x]` (pinned image only) writes/overwrites baselines for that task only (ownership check: only files under `__baselines__/<TASKID>/`), requires a clean working tree for those paths and prints the git diff stat.
   - New or changed baselines in a PR require (a) the PR to link the report artifact (CI uploads it as `visual-report`), (b) label `visual-baseline`, (c) a human reviewer approval (CODEOWNERS for `__baselines__/`). CI fails when baseline images changed but no corresponding spec/source change exists in the same task, and fails on any orphan baseline (`vr:lint`).
   - When the implementation intentionally deviates from the design (for example inventory section E normalisations win over the image, CONVENTIONS section 9), the task MUST state it in its TASK.md and the spec passes `why` plus an `expectedDeviation` region list (excluded like masks, visible in the report).
9. **First capture procedure** (documented): implement -> run `vr:review` -> inspect that layout matches the design crop (overlay) and that differences are only text rendering -> run `vr:update` -> commit baselines. The review report is the evidence that the baseline was compared to the design (SPEC 19.5).
10. **States without a design crop:** hover, focus, pressed, disabled, empty, loading, error are derived from design-system rules (VIEWS.md default checklist). They use `expectBaseline` only; a task lists them in its test plan.
11. **Storybook target:** `packages/ui-kit/visual/` contains a Playwright project that serves `storybook-static` and opens `iframe.html?id=<story>&viewMode=story` with the same environment rules; helper `storyPage(page, 'ui-button--primary')`; `data-region` not required; `clip: 'locator'` with alignment search is the normal mode for components because the crop in `design.png` contains the component with margin inside a bigger view.
12. **Self-tests (`apps/desktop/e2e/visual/selftest/`)**: fixture HTML pages and fixture "design" PNGs (generated deterministically by rendering a reference page with different fonts) proving: (a) same layout with different fonts passes; (b) shifted element by 6 px fails; (c) wrong colour (token mistake) fails via the colour check; (d) missing icon fails; (e) text block missing fails the text-extent check; (f) changed padding fails; (g) mask-too-large lint triggers; (h) baseline drift of 3 px detected; (i) size mismatch of design crop produces `VR_DESIGN_SIZE_MISMATCH`.
13. **Performance and flake control:** each comparison under 1.5 s; screenshot retried once only when the page reported ongoing font/image loading; no retry masks genuine diffs; results deterministic across 20 repeated runs in the pinned image (CI job `vr-stability` nightly).
14. **Design reconciliation record:** the library writes `visual-report/summary.json` listing for each task the metrics, tolerance overrides and expected deviations so the review pass can list all deviations from design in one place.

## 6. Design notes

N/A, functionality only. (This task consumes `design.png` files; it has none.)

## 7. Reuse

Region slugs and measured boxes from `tasks/_design/VIEWS.md`; Playwright fixtures and `data-region` convention (TEST004); the pseudo-locale (ARCH011); fonts and tokens (DS); task front matter parser (ARCH009/SETUP013); SEC006 pins for the container image digest. Libraries: `pixelmatch` (ISC) and `pngjs` (MIT) with justification in `docs/dependencies.md` (alternatives: Playwright built-in comparator alone cannot mask a foreign image; `looks-same` heavier).

## 8. Architecture and code placement

`tools/visual/{compare-design.ts,mask-text.ts,align.ts,metrics.ts,colors.ts,report.ts,front-matter.ts,environment.json,cli.ts}`; Playwright glue in `apps/desktop/e2e/visual/helpers/{expectMatchesDesign.ts,expectBaseline.ts,fonts.ts,region-geometry.ts}`; config `playwright.visual.config.ts`; self-tests; docs. Pure image functions are unit-tested without a browser (SRP); the Playwright layer is thin.

## 9. Security and safety

Visual tests read only repository files and render only local pages; no network (blocked). Screenshots of fixtures must not contain real data (mock data only, `/Users/test`), and because PNG files are not scanned for secrets by the snapshot scanner (SEC003), the rule is that scenario data is fake by construction (reviewers check the report for real names or paths). A visual-test failure must never be "fixed" by loosening tolerances without `why` (CONVENTIONS rule 7: do not weaken tests): the override mechanism is explicit, capped and listed in `summary.json` for review. The pinned image digest is verified (SEC006 pins). Untrusted content rendering cases (hostile Markdown) use baselines too, proving sanitisation visually.

## 10. Errors and edge cases

- Design crop includes areas outside the implemented region (adjacent regions visible in the margin): margin pixels are excluded by cropping the comparison window to the box inset by `designMargin` recorded in a `design-margin` field of the task or default 4 CSS px; mismatches in the margin are ignored.
- Scrollable containers where the mock shows clipped content ("overflows viewport"): the test scrolls to top and clips to the visible viewport as in the mock.
- Text whose wrapping changes because of real fonts: handled by text masks and the extent check; if the line count differs and changes the height beyond 8% the test fails and the task must adjust.
- Gradients, glows and blurs (magenta radial glow): blur and tolerance absorb small differences; large differences fail the colour/worst tile checks.
- Retina scaling: everything is computed at 2x and scaled consistently.
- Fonts flash (FOIT): fonts check fails the test rather than snapshotting fallback text.
- Dark/light theme: only dark exists in the design; light is not supported in MVP.

## 11. Acceptance criteria

- [ ] `expectMatchesDesign` and `expectBaseline` work for a page region (design-box mode) and a Storybook story (locator mode) in the pinned image.
- [ ] Self-test (a) passes and (b)-(i) fail with the stated error codes.
- [ ] Text masking and text-extent check are implemented and covered by unit tests with synthetic images.
- [ ] Fonts check fails when fonts are not loaded (self-test using a page that overrides the font-family).
- [ ] `vr:review`, `vr:update`, `vr:lint`, `vr:budget`, `vr:docker` commands exist and are documented; `vr:update` refuses to run outside the image and writes only the task's baseline folder.
- [ ] Report HTML shows design, impl, diff, overlay, metrics and geometry table.
- [ ] Tolerance overrides without `why` are rejected; overrides above the cap are rejected.
- [ ] Rendering is stable: 20 consecutive runs in the pinned image give identical results for the self-test fixtures.
- [ ] `docs/testing/visual-regression.md` covers the font situation and the reconciliation procedure (design crop = layout reference, baselines = real-font goldens).

## 12. Test plan

Unit: `compare-design.test.ts`, `mask-text.test.ts`, `align.test.ts`, `colors.test.ts` with synthetic PNGs generated in the tests; Playwright self-tests (`selftest/*.visual.spec.ts`) in the pinned image; stability job (20 repeats). Commands: `pnpm vitest run tools/visual`, `pnpm vr:docker -- selftest`, `pnpm vr:lint`.

## 13. Parallelization notes

Can start once TEST004's config exists. The pure image library (`tools/visual`) is independent and can be built first. DS tasks begin using the harness through Storybook as soon as the helper API and the Storybook project are merged; until then they capture baselines manually following the procedure. Hotspot: `playwright.visual.config.ts` (owned here).

## 14. Open questions and assumptions

- ASSUMPTION: tests run in Chromium; Tauri on macOS renders with WKWebView (WebKit) so small differences exist. Mitigation: layout is CSS-token driven and avoids engine-specific features; a periodic manual visual check on macOS is listed in the release checklist (later: Playwright WebKit project as a non-gating job).
- ASSUMPTION: design comparisons run in the `pl` locale, since the mock copy is Polish.
- ASSUMPTION: baselines are committed as normal git files within the 60 MB budget; Git LFS if exceeded (Owner/maintainer decision).
- Open: whether to re-export the design views with real fonts (then `textMask` could be turned off for those crops); default: keep masking.
