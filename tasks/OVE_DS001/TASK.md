---
id: OVE_DS001
title: "Scaffold packages/ui-kit: Vite lib, CSS Modules + variables, Storybook, Vitest"
area: DS
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP001, OVE_SETUP002, OVE_SETUP003, OVE_SETUP004, OVE_SETUP008, OVE_DS110]
soft_depends_on: [OVE_ARCH002]
provides: [lib:ui-kit-scaffold, lib:storybook]
needs: []
owns: [packages/ui-kit/package.json, packages/ui-kit/tsconfig.json, packages/ui-kit/tsconfig.build.json, packages/ui-kit/vite.config.ts, packages/ui-kit/vitest.config.ts, packages/ui-kit/eslint.config.js, packages/ui-kit/.storybook/**, packages/ui-kit/README.md, packages/ui-kit/src/styles.css, packages/ui-kit/src/internal/storyMatrix.tsx, packages/ui-kit/src/types/**, packages/ui-kit/src/__guards__/**, packages/ui-kit/test/**]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 13, SPECIFICATION 19.7]
adr_refs: [17, 18]
---

# OVE_DS001: Scaffold packages/ui-kit: Vite lib, CSS Modules + variables, Storybook, Vitest

## 1. Summary

Create the empty, buildable `packages/ui-kit` package (`@overmind/ui-kit`) that every other DS task fills: Vite library build, strict TypeScript, CSS Modules plus CSS custom properties as the styling approach, Storybook, Vitest with Testing Library and axe, and the package-level lint rules that keep the design system pure (no internal dependencies, no raw colours, no HTML injection). This task decides and documents the styling and file conventions so that 40+ later tasks can run in parallel without ever editing shared files.

## 2. Context

`packages/ui-kit` is the design system extracted from the 18 mocks (`_design/COMPONENT-INVENTORY.md`, task list D.2 item UI-01). Layering rule (CONVENTIONS section 6): `ui-kit` depends on nothing internal; `apps/desktop` imports it. The desktop is a Tauri webview (WebKit on macOS 26, ADR 0009, 0018), so modern CSS (`@layer`, `color-mix()`, container queries, `:has()`) is allowed; no IE or Chromium-only workarounds. Product copy is Polish first, code and docs English (ADR 0017): ui-kit therefore contains no product copy; all text comes in through props or the labels provider (OVE_DS038).

Terms: Owner, Agent, Chief, Workspace, Run, Node, Visibility (public/private), Approval, Access Request (glossary). They appear in prop names and stories only as English identifiers.

## 3. Scope (in)

- `packages/ui-kit` package skeleton, `package.json` (name, `exports`, `peerDependencies`, scripts), TypeScript project config extending the root base (OVE_SETUP002) and composite build.
- Vite library-mode build to `dist/` (ESM + `.d.ts`) with ONE extracted stylesheet `dist/styles.css`.
- The styling approach (CSS Modules + CSS variables + `data-*` variant attributes + CSS cascade layers), documented in `packages/ui-kit/README.md` with the justification (section 5.2).
- Folder layout and naming conventions (section 5.3) including the group names used by all DS tasks.
- Storybook 9 (React + Vite) with the a11y addon, a global decorator that imports `src/styles.css` and sets `document.documentElement.dataset.omTheme = 'dark'` (no dependency on `ThemeRoot`, which is for apps, OVE_DS008), a dark-only background, and story-sorting by group.
- Vitest + Testing Library + `user-event` + axe setup (`test/setup.ts`, `test/axe.ts` exporting `expectNoA11yViolations(container)`).
- Internal utilities in `src/internal/`: `cx()` (class joiner), `mergeRefs()`, `useControllableState()`, `useId()` re-export, `safeHref()` (section 5.6), `useReducedMotion()`.
- Package-level guards: (a) no `@overmind/*` dependency or import, (b) `react/no-danger` and `no-console` errors, (c) a Vitest guard test that fails on raw colour literals outside `src/tokens/`.
- Package scripts listed in section 5.7.

## 4. Out of scope

- Token files, colour values, fonts: OVE_DS002, OVE_DS003, OVE_DS004, OVE_DS006, OVE_DS007.
- The token CSS emitter, barrel generator and `new:component` script: OVE_DS039 (this task only reserves their script names and output paths).
- `ThemeRoot`, global reset and focus-ring CSS: OVE_DS008.
- Visual-regression harness: OVE_DS012 (generic compare engine: OVE_TEST005).
- Any component. Root-level CI wiring of the new scripts: OVE_SETUP006.

## 5. Detailed requirements

**5.1 Package manifest**
1. Name `@overmind/ui-kit`, `"private": true` (not published at MVP, ASSUMPTION), `"type": "module"`, `"sideEffects": ["**/*.css"]`, license header per OVE_OSS001.
2. `exports`: `"."` -> `dist/index.js` + `dist/index.d.ts`; `"./styles.css"` -> `dist/styles.css`; `"./tokens"` -> `dist/tokens/index.js` (typed token objects for canvas/JS use). Nothing else is importable (deep imports are blocked by `exports`).
3. `peerDependencies`: `react` and `react-dom` `^18.3.0 || ^19.0.0`. Dev versions come from the workspace catalog (OVE_SETUP008) so they equal the versions in `apps/desktop`.
4. `dependencies`: none at scaffold time. Later tasks add exactly one runtime dependency, `@floating-ui/react` (OVE_DS028, justified there). No `@overmind/*` package may ever appear in `dependencies`, `devDependencies` or imports.

**5.2 Styling approach (decision, justification required in README)**
5. Decision: **CSS Modules (`*.module.css`) + CSS custom properties (`--om-*`) as the only token carrier + variant selection through `data-*` attributes**, e.g. `<button data-om="Button" data-variant="primary-violet" data-size="md">` styled by `[data-variant="primary-violet"]` selectors inside `Button.module.css`.
6. Justification: (a) zero runtime cost and no style-injection ordering problems in a Tauri webview; (b) tokens stay plain CSS variables, so the canvas (React Flow custom nodes), the Tray window and Storybook all read the same values; (c) the typed TS prop API stays the single public contract while CSS stays readable by designers; (d) Vite and Storybook support CSS Modules natively, so no build plugin is added (KISS, SPEC 19.7); (e) variant matrices map 1:1 to attribute selectors, which keeps visual tests and unit tests simple (`toHaveAttribute('data-variant', ...)`).
7. Rejected alternatives (write them in README): Tailwind (second token source, long class strings, utility drift from the inventory), vanilla-extract (build plugin + extra dependency), styled-components/emotion (runtime cost, SSR-style injection order issues), inline styles (no pseudo-classes, no media queries).
8. Cascade layers: `src/styles.css` declares `@layer om.reset, om.tokens, om.base, om.components;` and then `@import './theme/foundation.generated.css';`. That imported file is generated by OVE_DS039 (`tokens:build`): it imports `../tokens/generated/tokens.css` first, then every `src/<group>/<NN>-<name>.foundation.css` file sorted by file name (`10-fonts` OVE_DS004, `20-motion` OVE_DS007, `30-base` OVE_DS008). Foundation CSS files are the extension point for global CSS; no task edits `styles.css` after this one. This task commits an empty placeholder `foundation.generated.css` (banner only) so the build works from the start; ownership of that file passes to OVE_DS039, which depends on this task and is not listed here in `owns`.
9. Class names: `generateScopedName: 'om_[name]__[local]__[hash:base64:5]'`. Every root element also carries `data-om="<ComponentName>"` (stable hook for tests, Playwright and the visual harness; never styled by apps).
10. All sizes that appear in the inventory are written as plain px numbers in CSS or as `var(--om-space-*)` / `var(--om-radius-*)` tokens (OVE_DS006); no `rem` (the app is a fixed-density desktop UI; the 14px root of the mocks is set by OVE_DS008).
11. Prohibited in component CSS: raw `#hex`, `rgb()`, `rgba()`, `hsl()` literals and `color-mix()` with hex arguments (inventory E12). Components use `var(--om-color-*)`. Enforced by `src/__guards__/no-raw-colours.test.ts` (scans `src/**/*.{css,tsx,ts}` except `src/tokens/**` and `*.stories.tsx` swatch stories flagged with `/* swatch */`).

**5.3 Folder layout and groups (binding for all DS tasks, also part 2)**
```
packages/ui-kit/
  .storybook/{main.ts,preview.tsx,manager.ts}
  src/
    index.ts                      GENERATED barrel (OVE_DS039) - never edit by hand
    styles.css                    layer declaration + @imports of generated/foundation css
    tokens/                       <group>.tokens.ts  +  generated/tokens.css
    theme/        typography/     icons/        labels/      testing/ (OVE_DS012)
    actions/      badges/         indicators/   avatars/     forms/
    surfaces/     lists/          navigation/   overlays/
    shell/ chat/ data/ canvas/ wizard/   (composite groups, DS part 2)
    internal/                     cx, mergeRefs, safeHref, hooks (not exported)
    types/css-modules.d.ts
    __guards__/                   repo-hygiene tests
  <group>/<Component>/{index.ts, <Component>.tsx, <Component>.module.css, <Component>.stories.tsx, <Component>.test.tsx}
```
12. A component folder exports ONLY through its `index.ts` using named exports (`export { Button } from './Button'; export type { ButtonProps } from './Button';`). No default exports. Files are PascalCase, one exported component per file, hooks `useXxx.ts`.
13. A component may import from `../../internal/*` and from other groups only through their folder `index.ts` (`../../icons/Icon`), never from another component's private file. Dependency direction between groups: `tokens` <- `theme`,`typography`,`icons` <- `indicators`,`avatars`,`actions`,`badges` <- `forms`,`surfaces`,`lists`,`navigation`,`overlays` <- composite groups. A guard test fails on upward imports.

**5.4 TypeScript conventions**
14. `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `jsx: react-jsx`, `verbatimModuleSyntax`.
15. Component props: `interface XxxProps extends Omit<ComponentPropsWithoutRef<'element'>, 'prop-that-clash'>`; every component uses `forwardRef` (or React 19 `ref` prop when the catalog is React 19; pick one via the catalog and apply to all) and spreads rest props onto the root so apps can add `aria-*`, `data-*`, `id`. `className` is accepted but documented as escape hatch for layout only (margin, flex placement), never for colours.
16. Polymorphism: only where the inventory says `as` (Button, ListRow, Pill, Tabs items, TextLink). Typed as `as?: ElementType` with props of that element inferred (helper type `PolymorphicProps<E, P>` in `src/internal/polymorphic.ts`). Router links are passed as `as={Link}` by the app; ui-kit never imports a router.
17. Controlled/uncontrolled inputs use `useControllableState`; handlers are named `onValueChange(next)` (value-based, not event-based) except native-like inputs which keep `onChange(event)`.

**5.5 Storybook conventions**
18. Story file per component: CSF3, `title: '<Group>/<Component>'`, `tags: ['autodocs']`, `parameters.layout: 'centered'` for primitives. One story per variant (name = variant value in PascalCase) plus `Matrix` (all variants x sizes x states in a CSS grid, see below) plus `States` where interaction states need forcing.
19. Interaction states are never faked with extra attributes or duplicated CSS. The `Matrix` helper (item 21) wraps each cell in `<div data-visual-state="default|hover|focus|active|disabled|loading">`; the Playwright harness (OVE_DS012) drives the real element inside that cell (`.hover()`, `.focus()` via keyboard Tab, mouse-down for active) before capturing. Disabled and loading are real props. Component CSS therefore contains only real pseudo-classes.
20. `.storybook/preview.tsx`: global decorator imports `../src/styles.css`, sets `data-om-theme="dark"` on the document element, sets `parameters.backgrounds` to the single dark app background `#0A0710` (read from `--om-color-bg-app` once tokens exist), `parameters.a11y.test = 'error'`, viewport 1440x900 default.
21. A `Matrix` helper `src/internal/storyMatrix.tsx` renders `rows x columns` of the same component with captions in `mono-label` style; every primitive uses it.

**5.6 Internal utilities (with unit tests)**
22. `cx(...parts: (string | false | null | undefined)[]): string`.
23. `mergeRefs`, `useControllableState<T>({value, defaultValue, onChange})` (warns in dev when switching controlled/uncontrolled), `useReducedMotion()` (matchMedia `(prefers-reduced-motion: reduce)`, SSR-safe default false, subscribes to changes).
24. `safeHref(href: string | undefined): string | undefined` returns the input only when its scheme is one of `http:`, `https:`, `mailto:`, `tel:` or the string is a relative reference (`/`, `./`, `../`, `#`, `?`); otherwise `undefined` (dropped) so `javascript:`, `data:`, `vbscript:` URLs never reach the DOM. Case-insensitive scheme check after trimming control characters and whitespace (`"  JaVa\nScript:alert(1)"` must be rejected). `rel="noopener noreferrer"` is added when `target="_blank"`. Used by every ui-kit component that renders an `<a>` (Button `as="a"`, TextLink).

**5.7 Scripts (in `packages/ui-kit/package.json`)**
`dev` (vite build --watch), `build` (tokens:build, barrel:build, vite build, tsc declarations), `typecheck`, `lint`, `test` (vitest run), `test:watch`, `storybook` (port 6006), `build-storybook`, `test:visual` (defined by OVE_DS012), `tokens:build`, `tokens:check`, `barrel:build`, `barrel:check`, `new:component` (defined by OVE_DS039). The last five are stubs that exit 0 with a message until OVE_DS039/OVE_DS012 replace them.

**5.8 Guards (Vitest tests in `src/__guards__/`)**
25. `no-internal-deps.test.ts`: reads `package.json` and every `.ts/.tsx` import specifier; fails if any starts with `@overmind/` or `apps/` or `packages/`.
26. `no-raw-colours.test.ts` as in item 11 (regex for `#[0-9a-fA-F]{3,8}\b`, `rgba?\(`, `hsla?\(`; allowlist file `src/__guards__/colour-allowlist.json`, empty at start).
27. `no-default-exports.test.ts` for component folders; `group-direction.test.ts` for the import direction in item 13.
28. `no-hardcoded-strings.test.ts` (heuristic): in `*.tsx` non-story, non-test files, flags JSX text nodes that contain letters (children must be props/slots). Allowlist for glyph-only text. Rationale: DoD item 4 (no hard-coded strings).

## 6. Design notes

N/A, functionality only (infrastructure). The Storybook shell must look like the product: dark background `#0A0710`, text `#EFE9F7`, so reviewers judge components in context.

## 7. Reuse

- Root TypeScript base, ESLint flat config, Prettier, Vitest workspace config from OVE_SETUP002, OVE_SETUP003, OVE_SETUP004.
- Dependency policy and catalog from OVE_SETUP008: every dev dependency added here (vite, @vitejs/plugin-react, storybook + addons, vitest, @testing-library/react, @testing-library/user-event, jsdom, axe-core + `vitest-axe` or equivalent) needs an entry in `docs/dependencies.md` with value, maintenance cost, licence (all MIT/Apache/BSD), alternatives.
- Nothing from other DS tasks.

## 8. Architecture and code placement

Package `packages/ui-kit` only (plus a one-line workspace registration performed by OVE_SETUP001's glob `packages/*`). Layer: UI foundation, depends on nothing internal (CONVENTIONS section 6). Boundary lint rule for `@overmind/*` imports is configured here and verified by OVE_ARCH002 fixtures. SOLID/DRY: one `cx`, one `safeHref`, one polymorphic type, one story matrix helper, so primitives never re-implement them (DRY). KISS: no CSS-in-JS, no code generation beyond OVE_DS039.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`).
Specific to this task: `safeHref` is the single choke point for URLs rendered by ui-kit (Agent messages and Skill content can contain attacker-controlled links, ADR 0012 and CONVENTIONS section 7 "content is data"). The unit test table below is the abuse-case list. `react/no-danger` is an error so nobody can add `dangerouslySetInnerHTML` later. Supply chain: no postinstall scripts in new dev dependencies; versions pinned per OVE_SETUP008; `pnpm audit` is part of CI (OVE_SETUP006).

## 10. Errors and edge cases

- Importing an `@overmind/*` package in ui-kit: lint error and guard test fail.
- A story throws during render: Storybook shows the error overlay; `build-storybook` fails (CI).
- `safeHref(undefined)`, `safeHref('')` return `undefined`; `safeHref('//evil.example')` (protocol-relative) returns `undefined` (treated as external, not relative).
- `useReducedMotion` in a non-DOM environment returns `false` without throwing.
- Two components exporting the same name: barrel generator (OVE_DS039) fails; the guard here only checks per-folder default exports.
- A guard false positive (colour in a comment): allowlist entry with a reason string is required; empty reasons fail the test.

## 11. Acceptance criteria

- [ ] `pnpm --filter @overmind/ui-kit build` produces `dist/index.js`, `dist/index.d.ts`, `dist/styles.css` and exits 0 on an empty library (a placeholder export `uiKitVersion` is allowed).
- [ ] `pnpm --filter @overmind/ui-kit storybook` starts on port 6006 and shows a placeholder story rendered on the dark background; `build-storybook` succeeds.
- [ ] `pnpm --filter @overmind/ui-kit test` runs the guard tests and utility tests, all green; `typecheck` and `lint` green.
- [ ] Importing `@overmind/anything` from a ui-kit file fails lint and `no-internal-deps.test.ts` (proven by a fixture file in the test).
- [ ] A raw `#fff` in a `.module.css` outside `src/tokens/` fails `no-raw-colours.test.ts` (fixture).
- [ ] `safeHref` rejects `javascript:`, `JaVaScRiPt:`, tab/newline-obfuscated schemes, `data:text/html,...`, `//host`, and accepts `https://a.b`, `/x`, `#y`, `mailto:a@b.c`.
- [ ] `README.md` documents the styling decision with the justification and rejected alternatives, the layout in 5.3, how to add a component (via `new:component` once OVE_DS039 lands), and the story/test/visual conventions.
- [ ] `docs/dependencies.md` entries exist for every added dev dependency.

## 12. Test plan

Unit (Vitest, jsdom): `cx.test.ts`, `mergeRefs.test.ts`, `useControllableState.test.ts` (controlled, uncontrolled, switching warning), `useReducedMotion.test.ts` (mock `matchMedia`, change event), `safeHref.test.ts` (table of 25+ inputs including the obfuscated forms above). Guard tests in `src/__guards__/` with fixture-based self-tests (a temp file that must trigger each guard). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit build`, `pnpm --filter @overmind/ui-kit build-storybook`. No visual test in this task.

## 13. Parallelization notes

Start right after OVE_SETUP001-004 and OVE_SETUP008. This task blocks every other DS task, so keep it small and merge fast. It runs in parallel with OVE_DS039 only if the script names in 5.7 are agreed (they are fixed here). Files owned here are the conflict hotspots for the whole area (package.json, vite.config.ts, eslint config): later DS tasks MUST NOT edit them; they file a proposal if a config change is needed (the one planned exception, adding `@floating-ui/react`, is owned by OVE_DS028 as a single-line `package.json` change declared in its `owns`).

## 14. Open questions and assumptions

- ASSUMPTION: React 18.3/19 peer range; the real version is whatever the root catalog pins (OVE_SETUP008).
- ASSUMPTION: Storybook 9 with the Vite builder. If OVE_SETUP008 pins another major, the story conventions stay the same.
- ASSUMPTION: the package is private (consumed through the workspace), so no semver publishing, changelog or API-extractor report at MVP.
- Open: CSS size budget for `dist/styles.css` (suggest 120 kB uncompressed warning threshold); default: warn only, set by OVE_DS012 later.
