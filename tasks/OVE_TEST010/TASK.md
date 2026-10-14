---
id: OVE_TEST010
title: Provide accessibility test helpers with axe, keyboard and focus checks
area: TEST
kind: test
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_TEST004]
soft_depends_on: [OVE_ARCH011]
provides: ["lib:a11y-harness", "lib:keyboard-test-helpers"]
needs: ["lib:storybook"]
owns: ["apps/desktop/e2e/a11y/**", "packages/ui-kit/a11y/**", "docs/testing/accessibility.md"]
reads: ["tasks/_design/VIEWS.md", "docs/design/styl-wizualny.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [28]
---

# OVE_TEST010: Provide accessibility test helpers with axe, keyboard and focus checks

## 1. Summary

The Definition of Done requires keyboard operability, visible focus and a clean axe check for UI tasks. This task delivers the helpers and conventions: `expectNoA11yViolations` for pages and Storybook stories, keyboard-walk utilities (tab order, roving focus, escape/enter handling), a visible-focus assertion matching the design rule (2 px violet ring with 2 px offset), reduced-motion and colour-not-alone checks, and an ARIA snapshot helper.

## 2. Context

The design system states: state is always icon plus text (never colour alone), visibility is always a word, every interactive element has a keyboard focus ring (violet, 2 px, offset 2 px), reduced motion is respected. The mocks omit hover/focus/disabled states, so a11y tests are the only place those rules are verified. Playwright (TEST004) and Storybook (DS) are the two hosts.

## 3. Scope (in)

- `expectNoA11yViolations(page | locator, opts)` using `@axe-core/playwright` with Overmind rule configuration.
- Keyboard helpers: `tabThrough(page, expectedLabels)`, `expectFocusVisible(locator)`, `expectRovingTabindex(group)`, `expectEscapeCloses(dialog)`, `expectFocusTrap(dialog)`, `expectReturnFocus(trigger)`.
- Checks: `expectStateNotByColorAlone(locator)` (an element conveying state exposes text/icon with accessible name), `expectVisibilityWord(locator)`, `expectReducedMotion(page)`, `expectContrast(locator)` for tokens (via axe color-contrast on rendered page, large areas excluded).
- ARIA snapshot helper `expectAriaTree(locator, expectedYaml)`.
- Storybook integration: story-level a11y project in `packages/ui-kit/a11y/`.
- Documentation with per-component-pattern checklists (dialog, tabs, menu, switch, radio group, table, canvas node).

## 4. Out of scope

- Fixing violations (feature/DS tasks). Screen reader manual testing procedure (documented as manual release checklist only). Colour token definition (DS).

## 5. Detailed requirements

1. **axe configuration:** WCAG 2.1 A and AA tags plus best-practice; disabled rules require an entry in `a11y-exceptions.json` (rule id, selector scope, reason, task id, expiry date); exceptions beyond expiry fail. `color-contrast` is enabled (the dark palette must pass AA for text; decorative glows excluded by `data-a11y-ignore="decorative"`); canvas nodes (React Flow) are tested for accessible names and keyboard operability separately because axe cannot see canvas semantics.
2. **API:** `await expectNoA11yViolations(page, { include?: string, exclude?: string[], tags?: string[], story?: string })`; failures print rule id, impact, help URL, nodes (selector, html truncated to 200 chars, no user data) and group by rule. Returns the axe results for custom assertions.
3. **Focus visibility:** `expectFocusVisible(locator)` focuses via keyboard (`Tab` from a known origin so `:focus-visible` applies), reads computed outline/box-shadow and asserts a 2 px ring of the focus colour token with offset 2 px (values read from the design token CSS variables) and that the ring is not clipped by `overflow: hidden` ancestors (compares element and ring rect with ancestors' clip rects).
4. **Keyboard walks:** `tabThrough` asserts the order of accessible names for a region and that no focus trap exists unless intended; `expectNoKeyboardTraps(page)` tabs up to N times and ensures focus eventually leaves the region; shortcuts documented in feature manifests are exercised; `Esc` behaviour on dialogs/menus/popovers; arrow-key behaviour for tabs, menus, radio groups, lists (roving tabindex); `Enter`/`Space` activation parity; drag-and-drop alternatives (Skill dropping onto a Node tile must have a keyboard alternative: helper `expectDragAlternative(locator)` checks a documented action exists).
5. **Not-by-colour checks:** `expectStateNotByColorAlone(locator)`: the element contains a visible text node or icon with `aria-label`/`title` conveying the state; the helper also renders the element with a grayscale filter via CSS injection and checks that the state label is still readable via text (text content present). `expectVisibilityWord(locator)`: contains literally the localized word PUBLICZNY/PRYWATNY (or EN equivalent via i18n) per ADR 0028. Numbers with word units: `expectCountHasUnit(locator)` heuristic on text matching `^\d+$` for count badges.
6. **Reduced motion:** with `reducedMotion: 'reduce'` no CSS animation or transition longer than 0.01 s is running on the page (checked via `document.getAnimations()`), except explicitly marked essential indicators.
7. **ARIA snapshots:** wrapper for Playwright `toMatchAriaSnapshot` with i18n-aware text (expected snapshot written with `ui.text()` keys), supporting regions for dialogs, tab lists, tables.
8. **Page-level a11y smoke:** `a11yCrawl(app, routes[], scenarios[])` visits every route registered by feature manifests (ARCH009) in each default scenario and runs axe; part of the CI job `a11y`. New routes are included automatically.
9. **Storybook project:** in `packages/ui-kit/a11y/` a Playwright project iterates all stories (index.json from `storybook-static`), runs axe for each, plus per-story `play`-like keyboard checks declared via story parameters (`parameters.a11y.keyboard = [...]`). Findings per story are reported; stories may not disable axe without an exception entry.
10. **Docs:** `docs/testing/accessibility.md` includes pattern checklists, the exception process, the manual checks that automation cannot do (screen reader labels, zoom 200%, high contrast), and how language (`pl`, `en-XA`) interacts (long strings must not break layout; `aria-label`s translated).
11. **Self-tests:** fixture pages with known violations (missing label, low contrast, keyboard trap, focus ring clipped, colour-only state) proving each helper fails; clean fixtures passing.

## 6. Design notes

N/A, functionality only. The design rules enforced here are in `docs/design/styl-wizualny.md` and `tasks/_design/VIEWS.md` (default states checklist); focus ring 2 px violet with 2 px offset.

## 7. Reuse

TEST004 fixtures (`app`, `gatewayControl`, locale, `consoleGuard`), i18n `ui.text()`, feature manifests collection (ARCH009), tokens from DS for ring colour. No bespoke axe wrappers in feature tasks.

## 8. Architecture and code placement

`apps/desktop/e2e/a11y/{helpers.ts,focus.ts,keyboard.ts,state-checks.ts,crawl.spec.ts,selftest/}`; `packages/ui-kit/a11y/{playwright.a11y.config.ts,stories.spec.ts}`; exceptions file `a11y-exceptions.json` (owned here, additive by proposal); docs. Dependency: `@axe-core/playwright` (MPL-2.0, dev-only; license note in SETUP008 docs/dependencies) - allowed as unmodified dev dependency per SEC006 S6.

## 9. Security and safety

Tests render hostile content (Markdown with scripts) only in dedicated cases and do not execute it; the a11y output truncates HTML to avoid dumping data. The exceptions file has expiry dates so accessibility debt cannot become permanent silently. No network.

## 10. Errors and edge cases

- Dynamic content that appears after the check: helpers wait for `app.settled()` before scanning.
- Canvas-rendered elements: separate DOM overlay checks (nodes expose `role="button"`/`group` with names).
- Third-party components with known axe issues: exception entries with expiry.
- Focus restored to `body` after unmount: `expectReturnFocus` fails with a clear message.
- Pseudo-locale increases text length: crawl also runs once in `en-XA` to detect truncation issues surfaced by axe `target-size`/overflow heuristics.

## 11. Acceptance criteria

- [ ] `expectNoA11yViolations` works for pages and stories and fails on each self-test violation.
- [ ] Focus ring helper verifies 2 px / 2 px offset from tokens and detects clipping.
- [ ] Keyboard helpers cover tab order, roving tabindex, escape-close, focus trap and focus return.
- [ ] Not-by-colour and visibility-word checks fail on fixtures that violate them.
- [ ] Reduced-motion check detects a running animation.
- [ ] Crawl visits routes from manifests automatically and runs in CI job `a11y` (fragment provided).
- [ ] Exceptions have expiry; expired entries fail.
- [ ] Docs include pattern checklists and manual-check list.

## 12. Test plan

Self-test specs with fixture pages (`apps/desktop/e2e/a11y/selftest/*.spec.ts`), Storybook project smoke run on a sample story set. Commands: `pnpm e2e --project=a11y`, `pnpm --filter ui-kit test:a11y`.

## 13. Parallelization notes

Depends only on TEST004 harness; DS and UI tasks use the helpers as soon as they land. `a11y-exceptions.json` is the shared file: additive entries by proposal/PR to this folder owner.

## 14. Open questions and assumptions

- ASSUMPTION: `@axe-core/playwright` (MPL-2.0) accepted as a dev-only tool under SEC006 S6.
- ASSUMPTION: contrast requirements are AA; the design palette (violet/magenta on near-black) is expected to pass for text, with large decorative glows excluded.
- Open: adding a WebKit project for a11y tree differences (later).
