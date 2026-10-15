---
id: OVE_SETUP003
title: ESLint flat config and Prettier
area: SETUP
kind: infra
size: M
priority: P0
mvp: true
status: done
depends_on: [OVE_SETUP001, OVE_SETUP002]
soft_depends_on: [OVE_SETUP008]
provides: ["lib:eslint-config", "lib:eslint-config-extension-dir", "lib:prettier-config"]
needs: []
owns:
  - eslint.config.mjs
  - eslint.config.d/base.mjs
  - eslint.config.d/typescript.mjs
  - eslint.config.d/react.mjs
  - eslint.config.d/tests.mjs
  - eslint.config.d/README.md
  - prettier.config.mjs
  - .prettierignore
  - tools/eslint/**
reads: ["tsconfig.base.json", "package.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [17, 18]
---

# OVE_SETUP003: ESLint flat config and Prettier

## 1. Summary

Create the repository-wide lint and format setup: ESLint 10 flat config with type-aware typescript-eslint rules, React Hooks rules for UI packages, a strict test-file profile, and Prettier. The config composes itself from files in `eslint.config.d/` so that other tasks (boundaries, i18n keys, ui-kit rules) add rules by dropping a file, not by editing a shared one.

## 2. Context

`pnpm lint` is a Definition-of-Done gate (CONVENTIONS section 8). Versions (verified 2026-10-13, see OVE_SETUP008): `eslint@10.12.0` (Node `^20.19 || ^22.13 || >=24`), `@eslint/js@10.0.1`, `typescript-eslint@8.71.2` (peers: `eslint ^8.57||^9||^10`, `typescript >=4.8.4 <6.1.0`), `eslint-plugin-react-hooks@7.1.1`, `eslint-plugin-react-refresh@0.5.7`, `eslint-config-prettier@10.1.8`, `globals@17.13.0`, `prettier@3.9.10`. `eslint-plugin-jsx-a11y@6.10.2` only declares ESLint up to 9 and is therefore NOT adopted; accessibility is covered by `axe` in Storybook and Playwright (DoD item 4). Extension points are mandated by CONVENTIONS section 5.

## 3. Scope (in)

- `eslint.config.mjs` (loader), base/typescript/react/tests config modules in `eslint.config.d/`.
- `prettier.config.mjs`, `.prettierignore`.
- Custom tiny local rules in `tools/eslint/` (only those listed below).
- Devdependencies via `catalog:`.

## 4. Out of scope

- Boundary and import-direction rules: OVE_ARCH002 (adds `eslint.config.d/boundaries.mjs`).
- i18n hard-coded string rule: OVE_ARCH011 (adds `eslint.config.d/i18n.mjs`).
- ui-kit specific rules (no raw buttons in features): OVE_DS tasks.
- Markdown lint (OVE_OSS004), YAML/Workflow lint (OVE_SETUP006).
- Git hooks calling lint: OVE_SETUP005.

## 5. Detailed requirements

1. **Loader.** `eslint.config.mjs` default-exports an array built as: global ignores, then `import()` of every `eslint.config.d/*.mjs` in lexicographic order (using `node:fs` `readdirSync` + dynamic import with `pathToFileURL`), each module default-exporting an array of flat-config objects. A module that throws on import makes ESLint fail (fail closed). Files are loaded in sorted order so output is deterministic.
2. **Ignores.** `**/node_modules/**`, `**/.tsbuild/**`, `**/dist/**`, `**/coverage/**`, `**/storybook-static/**`, `apps/desktop/src-tauri/target/**`, `apps/desktop/src-tauri/binaries/**`, `pnpm-lock.yaml`, `tasks/**`, `docs/**` (Markdown is linted by OVE_OSS004, not ESLint), generated barrels `**/*.generated.ts` (OVE_ARCH008/009).
3. **base.mjs.** `@eslint/js` recommended; rules: `no-eval: error`, `no-new-func: error`, `no-implied-eval: error` (CONVENTIONS section 7: no dynamic code on data), `no-console: ["error", { allow: [] }]` except in `tools/**` and test files (logging goes through the logger port, OVE_ARCH004), `eqeqeq: ["error","always"]`, `no-throw-literal`, `prefer-const`, `no-var`, `no-restricted-globals` for `event`, `no-restricted-syntax` banning `with`, `curly: ["error","all"]`.
4. **typescript.mjs.** `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`, parser option `projectService: true` with `tsconfigRootDir: import.meta.dirname` (uses the references from OVE_SETUP002). Extra rules: `@typescript-eslint/no-explicit-any: error`, `no-floating-promises: error`, `no-misused-promises: error`, `consistent-type-imports: ["error", {fixStyle: "inline-type-imports"}]` aligned with `verbatimModuleSyntax`, `no-non-null-assertion: error`, `ban-ts-comment: ["error", {"ts-ignore": true, "ts-expect-error": "allow-with-description", minimumDescriptionLength: 10}]`, `switch-exhaustiveness-check: error` (supports OCP: adding a union member breaks unhandled switches), `no-unnecessary-condition: error`, `only-throw-error: error`. Rule bans with messages: `JSON.parse` result must be validated by zod: restricted syntax `CallExpression[callee.object.name='JSON'][callee.property.name='parse']` allowed only in files matching `**/*.parse-boundary.ts` (message: "Parse untrusted JSON through a zod schema").
5. **react.mjs.** Applies to `apps/desktop/**` and `packages/ui-kit/**` `*.tsx`: `eslint-plugin-react-hooks` recommended (`rules-of-hooks: error`, `exhaustive-deps: error`), `eslint-plugin-react-refresh` `only-export-components: warn` (warnings are errors because of `--max-warnings 0`, so set `error` and allow `allowConstantExport: true`). Globals: `globals.browser`. Other packages get `globals.node` only where `types: ["node"]` is declared.
6. **tests.mjs.** For `**/*.test.ts(x)`, `**/test/**`: relax `no-non-null-assertion`, `no-explicit-any` stays on, `@typescript-eslint/no-unsafe-*` off for fixtures only in `**/fixtures/**`; forbid `.only` and `.skip` without a task ID comment through the custom local rule `overmind/no-focused-tests` (in `tools/eslint/no-focused-tests.mjs`; `describe.only`, `it.only`, `test.only` always error; `.skip` requires a `// skip: OVE_XXX000` comment on the previous line).
7. **Custom rule `overmind/license-header-present`** is NOT implemented here (OVE_OSS001 owns the header policy and its check script).
8. **Prettier.** `prettier.config.mjs`: `printWidth: 100`, `singleQuote: false`, `semi: true`, `trailingComma: "all"`, `arrowParens: "always"`, `endOfLine: "lf"`, `proseWrap: "preserve"`; overrides: `*.md` -> `proseWrap: "preserve"`. `.prettierignore`: same ignores as ESLint plus `pnpm-lock.yaml`, `tasks/**/design*.png`, `docs/pl/**` (Polish originals are never reformatted, OVE_OSS005). `eslint-config-prettier` is the last config object to switch off formatting rules; ESLint never runs Prettier as a rule (KISS, speed).
9. **Scripts** (already named in OVE_SETUP001): `lint` = `eslint . --max-warnings 0`, `lint:fix` = `eslint . --fix`, `format` = `prettier --write .`, `format:check` = `prettier --check .`.
10. `eslint.config.d/README.md` documents the extension rule: "to add rules, add `eslint.config.d/<area>.mjs`; never edit another task's module; modules load in sorted order, so use the numeric prefix only when order matters".
11. Lint performance: `pnpm lint` on the skeleton MUST take < 60 s; the implementer records the time in the PR.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses the `lib:tsconfig-base` project references (OVE_SETUP002) through `projectService`. Versions only from the catalog. The `overmind/no-focused-tests` rule is reused by TEST tasks; they must not write their own.

## 8. Architecture and code placement

Layer: tooling. `eslint.config.mjs` (loader, tiny, stable) + `eslint.config.d/*.mjs` (one module per concern/owner) + `tools/eslint/*.mjs` (local rule implementations, each with a unit test). OCP: new concerns are new files. No package imports the lint config.

## 9. Security and safety

- Dynamic-code bans (`no-eval`, `no-new-func`, `no-implied-eval`) implement CONVENTIONS section 7.
- The loader executes only files inside the repository's `eslint.config.d/`; it MUST NOT follow symlinks outside the repository (`realpath` check) and MUST NOT accept config from environment variables.
- Lint config changes are security-relevant (rules can be weakened): `eslint.config.*`, `eslint.config.d/**` are in CODEOWNERS (OVE_OSS003) and CI fails if a PR modifies a rule from `error` to `off` without the label `lint-config-change` (check by OVE_SETUP006 using a diff script; here only the CODEOWNERS entry is required).
- No `// eslint-disable` without `-- reason`: enforced with `reportUnusedDisableDirectives: "error"` and `linterOptions.noInlineConfig: false` plus the rule `@eslint-community/eslint-comments` is NOT added (dependency avoided); use the built-in `linterOptions.reportUnusedDisableDirectives` and a CI grep (`tools/eslint/check-disable-reasons.mjs`, requirement 12).
- Never weaken rules to make a task pass (CONVENTIONS section 5.7).

## 10. Errors and edge cases

- A config module throws: ESLint exits non-zero with the module name in the error.
- Two modules define the same rule with different severity: later (sorted) wins; the README tells authors to prefix numbers; a unit test warns about duplicates across modules.
- Generated files (`*.generated.ts`) are ignored but still type-checked.
- `projectService` cannot find a `tsconfig` for a file (for example under `tools/`): `tools/tsconfig.json` exists (OVE_SETUP002); files outside any project cause an error, which is the desired behaviour.
- Prettier and ESLint disagree: Prettier wins; fix the ESLint rule via `eslint-config-prettier`, never disable Prettier.

## 11. Acceptance criteria

- [x] `pnpm lint` and `pnpm format:check` pass on the skeleton with zero warnings.
- [x] Given a fixture with `eval("1")`, `any`, an unawaited promise, `JSON.parse` in a non-boundary file, `// @ts-ignore`, `it.only`, each is reported by lint (one fixture per rule).
- [x] Given a new file `eslint.config.d/zzz.mjs` exporting `[]`, lint still passes; given one that throws, lint fails.
- [x] `pnpm ls eslint typescript-eslint typescript` shows eslint 10.12.0, typescript-eslint 8.71.2, typescript 6.0.3 with no peer warnings.
- [x] `eslint-plugin-jsx-a11y` is absent and OVE_SETUP008 documents why.
- [x] A `.tsx` fixture with a missing hook dependency fails lint in `packages/ui-kit` and passes in `packages/domain` (rule not applied there).
- [x] Time of `pnpm lint` on the skeleton recorded and below 60 s.

## 12. Test plan

Unit tests for local rules with `eslint`'s `RuleTester` in `tools/eslint/*.test.ts`. Fixture-based tests: `tools/eslint/fixtures/bad/*.ts` linted programmatically via the `ESLint` class in `tools/eslint/config.test.ts`, asserting rule IDs per file. Requirement 12 helper `check-disable-reasons.mjs` scans for `eslint-disable` lines without `--` and is invoked by `pnpm lint` through an npm script chain (`lint` = `eslint ... && node tools/eslint/check-disable-reasons.mjs`) — this changes the `lint` script text; do it as a pure addition and keep the script name. Commands: `pnpm lint`, `pnpm test -- tools/eslint`.

## 13. Parallelization notes

Parallel with SETUP004/005/008..012. Hotspots: `eslint.config.mjs` (stable after this task; nobody else edits it), `eslint.config.d/` (append-only by other tasks, each adds its own file). Expect ARCH002, ARCH011, DS and TEST tasks to add modules.

## 14. Open questions and assumptions

- ASSUMPTION: no `eslint-plugin-import-x` (boundaries are ARCH002's; import order not enforced; Prettier plus consistent-type-imports suffice). Reconsider if import sorting causes review churn.
- ASSUMPTION: accessibility lint is not available for ESLint 10; if `eslint-plugin-jsx-a11y` adds ESLint 10 support, adopt it through OVE_SETUP008's upgrade process.
- ASSUMPTION: `strictTypeChecked` from day one; if noise is excessive, relax individual rules with a reason, not the preset.

### Implementation notes (2026-10-15)

- The existing typescript-eslint 8.71.1 pin follows the Owner decision to update later. Zod 4.6.6 is likewise the preceding compatible release admitted by the unchanged 72-hour release-age policy. No age exceptions are introduced.
- ESLint 10 rejects `no-console: [error, {allow: []}]`; the equivalent valid `no-console: error` forbids every console method. Prettier is last, retaining `curly: all`, which its generic preset disables even though that setting is compatible.
- Node and JSX fixture tests now explicitly await Node test promises. JSON/YAML configuration input is parsed and validated once in `tools/test-support/json.parse-boundary.ts`; `yaml` (ISC) and `zod` (MIT) are catalog-pinned development dependencies. This replaces unchecked JSON and brittle YAML text matching. OVE-008 owns the complete dependency register.
- Existing TypeScript configurations receive formatting-only updates so the new repository-wide format gate passes. Existing Polish documentation and task material remain with their documentation owners. Minimal CODEOWNERS entries cover the lint policy as required here; OVE_OSS003 extends that file later.
- Global ESLint ignores occupy their own config object, so emitted `.tsbuild` declarations are excluded even after compilation. A regression test verifies that composition does not disable critical rules.

- Final independent Standards and Spec re-reviews have zero remaining findings. Two suppression bypasses were fixed with parsed-comment handling and regression tests before merge. The final clean-checkout suite passes 20 tests, typecheck, lint, format check and dependency audit. Lint completes well below 60 seconds.
