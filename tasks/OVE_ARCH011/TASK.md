---
id: OVE_ARCH011
title: Set up UI i18n infrastructure with EN default, PL, pseudo-locale and key lint
area: ARCH
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_SETUP009]
soft_depends_on: [OVE_ARCH003]
provides: ["lib:i18n-ui", "lib:i18n-lint", "contract:LocaleCode", "contract:MessageRef"]
needs: []
owns: ["apps/desktop/src/shared/i18n/**", "apps/desktop/src/locales/en/common.json", "apps/desktop/src/locales/en/errors.json", "apps/desktop/src/locales/pl/common.json", "apps/desktop/src/locales/pl/errors.json", "packages/contracts/src/i18n/**", "tools/i18n/**", "docs/architecture/i18n.md"]
reads: ["docs/design/styl-wizualny.md", "tasks/_design/VIEWS.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 1", "SPECIFICATION 13"]
adr_refs: [17]
---

# OVE_ARCH011: Set up UI i18n infrastructure with EN default, PL, pseudo-locale and key lint

## 1. Summary

Provide the i18n foundation for the desktop UI: library choice with justification, one JSON namespace per feature, typed message keys, English as the default locale, Polish as the first translation (with correct plural forms), a generated pseudo-locale for layout testing, and lint that fails on missing keys and hard-coded UI strings.

## 2. Context

ADR 0017: code and default UI in English, Polish is the first translation. The design mocks contain Polish copy that is the source for the PL files; feature tasks write their own `locales/<lang>/<feature>.json`. The design uses count words (`3 decyzje`, `2 skille`, `3 czekają`), so Polish plural rules (four forms) are mandatory. Engine-generated strings (Telegram, notifications) use the same format via `OVE_ARCH015`. Errors reach the UI as `MessageRef { key, params }` (ARCH003).

## 3. Scope (in)

- Library decision and setup in `apps/desktop/src/shared/i18n/`.
- Namespace loading from the files generated per ARCH009.
- Type-safe `t` via keys generated from the EN JSON.
- Polish plural handling and formatting helpers (numbers, dates, relative time, lists) via `Intl`.
- Pseudo-locale generator `en-XA`.
- Lint tool `pnpm i18n:check` and ESLint rule configuration for hard-coded strings.
- Shared `LocaleCode` and `MessageRef` contracts.
- Seed namespaces `common` and `errors` (EN + PL).
- Locale switching (Owner setting `locale` from AppConfig), persisted via the config API (ENGINE/SETUI) and applied without reload.

## 4. Out of scope

- Engine/Telegram/notification translator: `OVE_ARCH015`. Feature namespaces: each feature task. Settings UI to pick the language: SETUI. Translation of project documentation: `OVE_OSS005`.
- RTL layouts: later / not planned.

## 5. Detailed requirements

1. **Library:** `i18next` + `react-i18next`. Justification (to go into `docs/dependencies.md`): (a) namespaces map 1:1 to feature folders, which is how parallel work is split; (b) the core is framework-agnostic so the engine (`OVE_ARCH015`) reuses the same JSON format, plural handling and interpolation for Telegram messages; (c) CLDR plural categories via `Intl.PluralRules` (no custom plural code); (d) MIT, widely maintained, strong TypeScript support. Alternatives considered: `react-intl`/formatjs (ICU MessageFormat is powerful but heavier and ties strings to React; weaker fit for the engine), `lingui` (compile step), `typesafe-i18n` (smaller community). Do not add i18next plugins beyond: none (no language detector, no http backend; loading is explicit and local).
2. **Files:** `apps/desktop/src/locales/<lang>/<namespace>.json`, `<lang>` in `en` (source of truth), `pl`, `en-XA` (generated, git-ignored). Namespace = feature id (kebab-case) or `common`/`errors`/`a11y`. Nested objects allowed to depth 3; flat dotted keys discouraged.
3. **Key naming:** `<namespace>:<area>.<element>[.<variant>]`, lower camelCase segments, no sentences as keys. Examples: `board:lane.empty.title`, `common:action.cancel`, `errors:perm.path_outside_allowed`, `a11y:rail.label`. Keys describe purpose, not wording. Interpolation `{{name}}` with named params only (no positional); no string concatenation to build sentences; no HTML in strings (use `<Trans>` with named components when markup is needed, components limited to `strong`, `em`, `code`, `link`).
4. **Plurals:** i18next v4 JSON format with suffixes `_zero`(not used), `_one`, `_few`, `_many`, `_other`. English needs `_one`, `_other`. Polish needs `_one`, `_few`, `_many`, `_other` (CLDR: one = 1; few = integers ending 2-4 except 12-14; many = other integers; other = fractions). Example to ship in `common.json`:
   - `common:count.decisions_one` "{{count}} decision" / pl "{{count}} decyzja"
   - `_few` pl "{{count}} decyzje" (2, 3, 4, 22, 23), `_many` pl "{{count}} decyzji" (0, 5-21, 25...), `_other` pl "{{count}} decyzji" (1.5).
   - `common:count.skills` pl: skill / skille / skilli; `common:count.waiting` ("3 czekają"): pl `_one` "{{count}} czeka", `_few`/`_many`/`_other` "{{count}} czekają".
   The lint checks that every PL plural key has all four forms and every EN plural key has `_one` and `_other`. Unit test table for counts 0,1,2,3,4,5,12,13,14,21,22,25,100,102,1.5 in PL.
5. **Typed keys:** `tools/i18n/gen-types.ts` generates `apps/desktop/src/shared/i18n/keys.generated.d.ts` (git-ignored) from EN JSON so `t('board:lane.empty.title')` is checked by TypeScript and params are typed from `{{placeholders}}`. Helper `useT(ns)` wraps `useTranslation`. Plain-function `t` outside React: `i18n.t`.
6. **Runtime setup:** `initI18n({ locale, loadNamespace })` registers lazy loaders (dynamic import per namespace/lang); the feature manifest (`namespaces: [...]`, ARCH009) triggers loading before the route renders (suspense boundary supplied by the shell). Fallback chain: `pl -> en`, `en-XA -> en`. Missing key at runtime: in dev render `⟦missing:<key>⟧` and `console.warn` once (dev only, allowed in UI), in production render the EN string; never render the raw key in production.
7. **Formatting helpers** (`formatNumber`, `formatDate`, `formatTime`, `formatRelative`, `formatList`, `formatBytes`, `formatDuration`) built on `Intl` with the active locale; the design shows durations like `18 min`, `reset 3 h` — durations render with unit words from translations (`common:unit.minute_one`...). Dates stored as UTC ISO from the engine; displayed in the OS time zone. Numbers always carry word units (design rule).
8. **Pseudo-locale `en-XA`:** `pnpm i18n:pseudo` generates JSON from EN: ASCII letters mapped to accented look-alikes (a->å, e->é, ...), padded by ~35% with `~`, wrapped in `[` `]`, placeholders `{{x}}` and plural suffix keys untouched. Selectable in dev via URL `?locale=en-XA` or env `VITE_LOCALE`. Purpose: spot truncated layouts and hard-coded strings in Playwright runs (TEST004/005 use it).
9. **Lint (`pnpm i18n:check`)** fails (exit 1) on:
   - key used in code (`t('ns:key')`, `<Trans i18nKey>`, `useT`, `labelKey`/`titleKey` properties of manifests) but absent from EN;
   - EN key missing from PL (completeness enforced for MVP: ASSUMPTION);
   - PL/EN key present but unused (warning, `--strict-unused` makes it an error);
   - placeholder mismatch between EN and PL; missing plural forms; JSON syntax errors; duplicate keys;
   - dynamic keys (`t(variable)`) outside an allowlisted helper `tKey(...)` that declares the finite key set (`i18n.dynamicKeys.ts` per feature);
   - a namespace file without a feature owner (no matching `features/<ns>` or shared namespace);
   - strings containing raw `{` `}` that are not placeholders, or leading/trailing spaces.
   Output lists file, key, rule id. Extraction uses the TypeScript AST.
10. **Hard-coded string lint:** configure `eslint-plugin-i18next` rule `no-literal-string` (mode `jsx-text-only` plus attribute allowlist: `aria-label`, `title`, `placeholder`, `alt` are checked) for `apps/desktop/src/**` and for `packages/ui-kit` stories excluded; allowlist for punctuation, numbers, `data-*`, class names, and the glyph set of the design (`✓ ✗ ● ○ ◆ → ·`). `ui-kit` components take strings by props (no i18n inside ui-kit).
11. **Error messages:** `renderMessage(ref: MessageRef)` converts `{ key, params }` coming from the engine into text using the `errors`/`notifications` namespaces; unknown key renders `errors:generic.unknown` (with `retryable` hint).
12. **`LocaleCode`** (`'en' | 'pl'`) and `MessageRef` (`{ key: string; params?: Record<string, string|number> }`) live in `packages/contracts/src/i18n/` for sharing with the engine.
13. **Docs** `docs/architecture/i18n.md`: how to add a string, a namespace, a language; plural cheat-sheet for Polish; copy style rules (sentence case, no trailing period in labels, units as words); where Polish copy from the design mocks is taken.

## 6. Design notes

N/A, functionality only. The exact Polish copy of each view is recorded in `tasks/_design/VIEWS.md` and is entered into `pl/<feature>.json` by the owner of that feature's UI task; English strings are authored by the same task (the mocks have no English).

## 7. Reuse

ARCH009 generates the namespace loader index and validates manifests' `namespaces`. `MessageRef` is also used by ARCH003 (`userMessage`) and ARCH015. `ui-kit` receives translated strings as props. Playwright tests (TEST004/TEST005) use the pseudo-locale.

## 8. Architecture and code placement

- `apps/desktop/src/shared/i18n/{init.ts,useT.ts,format.ts,render-message.ts,keys.generated.d.ts(ignored)}`.
- `tools/i18n/{check.ts,gen-types.ts,pseudo.ts,extract.ts}` (dev tooling).
- `packages/contracts/src/i18n/{locale.ts,message-ref.ts}`.
- Layer: UI infrastructure; depends on `contracts` only (allowed for desktop). No other package imports i18next except `adapters/i18n` (ARCH015).

## 9. Security and safety

Translations are data: strings are rendered as text (React escapes); `<Trans>` components limited to a fixed whitelist, `dangerouslySetInnerHTML` is forbidden by lint. Interpolated values from agents/engine are escaped (`escapeValue: true` in React mode) so content from repositories or Telegram cannot inject markup. `MessageRef.params` accepts only strings and numbers with length cap 500. Error messages never include paths or secrets (ARCH003 guarantees; this layer does not append raw engine text). A locale file cannot trigger network loads (no http backend).

## 10. Errors and edge cases

- Namespace file missing for a language: fallback to EN, lint error in CI.
- Locale unsupported in config: fall back to `en` and log.
- Fractional counts and zero in Polish handled by CLDR (tests).
- Very long translated strings: the pseudo-locale and Playwright visual tests catch truncation; components use `min-width: 0` and ellipsis rules from DS.
- Interpolation value containing `{{x}}`: not re-interpolated (`skipOnVariables: true`).
- Switching language at runtime re-renders without losing state.

## 11. Acceptance criteria

- [ ] `t` is type-checked: unknown key or missing param fails `pnpm typecheck` (type test).
- [ ] Polish counts 1/2/5/12/22/25 produce the correct plural form for `decisions`, `skills`, `waiting`.
- [ ] `pnpm i18n:check` fails for each lint rule in fixtures (missing EN key, missing PL key, placeholder mismatch, missing plural form, dynamic key, unused key under `--strict-unused`).
- [ ] `en-XA` generation preserves placeholders and plural suffixes; app renders with `?locale=en-XA` in dev.
- [ ] A hard-coded `<button>Save</button>` in `apps/desktop/src` fails `pnpm lint`.
- [ ] `renderMessage` renders known keys, falls back for unknown ones, and never shows a raw key in production mode.
- [ ] i18next dependency justification recorded; no other i18n libraries added.
- [ ] `docs/architecture/i18n.md` exists with the Polish plural cheat-sheet.

## 12. Test plan

- Unit: `format.test.ts`, `render-message.test.ts`, `plural.pl.test.ts` (table), `pseudo.test.ts`, `extract.test.ts`, `check.test.ts` with fixture trees.
- Component test (Vitest + Testing Library): `useT` with namespace loading and language switch.
- Lint tests: ESLint `RuleTester` config for the literal-string rule on sample TSX.
- Commands: `pnpm vitest run apps/desktop/src/shared/i18n tools/i18n`, `pnpm i18n:check`, `pnpm i18n:pseudo`.

## 13. Parallelization notes

Initialise before any UI feature task starts writing strings; DS (ui-kit) is independent. Feature tasks own their namespace files (`locales/<lang>/<feature>.json`), so no shared JSON edits; `common.json` is owned here, additions by proposal (or feature-specific keys in the feature namespace). The generated loader index is git-ignored.

## 14. Open questions and assumptions

- ASSUMPTION: PL translation completeness is enforced in CI from the start; if this slows feature work, relax to a warning with a `--allow-missing pl` flag until the first release candidate (Owner decision).
- ASSUMPTION: the default locale on first run is `en`, switched to `pl` if the macOS preferred language is Polish (the onboarding wizard can change it).
- Open: number/date format locale follows the app language, not the OS region; default yes.
