---
id: OVE_ARCH002
title: Enforce package boundaries in lint with proving fixtures
area: ARCH
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH001, OVE_SETUP003, OVE_ARCH053]
soft_depends_on: [OVE_SETUP006]
provides: ["lib:boundary-lint", "ci:boundaries"]
needs: ["ci:boundary-tools-activated"]
owns: ["tools/boundaries/ACCEPTANCE.md"]
reads: ["docs/architecture/boundaries.json", "docs/architecture/ARCHITECTURE.md", "tools/boundaries/**", "eslint-rules/boundaries/**", "tools/boundaries-fixtures/**", "tasks/OVE_ARCH053/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 19"]
adr_refs: [9]
---

# OVE_ARCH002: Enforce package boundaries in lint with proving fixtures

## 1. Summary

Validate the completed integrated architecture-boundary tools after all registered prerequisites, ending at OVE_ARCH053, are merged and done. Record exact-head evidence for every original detailed requirement and all nine original acceptance criteria in tools/boundaries/ACCEPTANCE.md. No helper-task PASS substitutes for this final independent proof. A rule nobody has proven to fail is not a rule.

## 2. Context

`OVE_ARCH001` defines the dependency matrix and forbidden built-ins/globals per package. CONVENTIONS section 8 makes "the architecture-boundary check passes in CI" part of every Definition of Done, and rule 7 forbids weakening it. This task is the mechanism. ESLint flat config comes from `OVE_SETUP003`; CI wiring from `OVE_SETUP006` (this task provides the job definition fragment, SETUP006 includes it).

## 3. Scope (in)

- Run the actual completed ESLint plugin, standalone public commands and independent full proving oracle against one exact integrated head.
- Verify all required bad/good/manifest/suppression/meta-rule/matrix cases below, without changing their original contracts.
- Measure actual real-repository runtime and record command/head/result and limitations.
- Create a separate real forbidden-import scratch PR, verify hosted architecture AND ci-success rejection, record specific diagnostic/run, then close unmerged.
- Own only tools/boundaries/ACCEPTANCE.md and this task's normal status/evidence. Implementation and relocations belong to the registered prerequisite owners; any repair requires their exact reviewed integration, not broad directory ownership.

## 4. Out of scope

- Writing the matrix: `OVE_ARCH001`. CI job wiring: `OVE_SETUP006`.
- Task ownership lint (`owns` paths): `OVE_ARCH009`.
- i18n literal-string lint: `OVE_ARCH011`.

## 5. Detailed requirements

1. Rules read `docs/architecture/boundaries.json` once per process (cached by mtime) and resolve the importing file's package by longest-prefix path match. Files outside any package (root configs) are ignored; `tools/` files may import anything but must not be imported by packages.
2. `allowed-imports`: report `BOUNDARY_FORBIDDEN_IMPORT` when package A imports package B and B is not in A's `allowedImports`. Resolve both `@overmind/*` specifiers and relative paths that escape the package (`../../other-package/src/x`). Type-only imports (`import type`) are subject to the same matrix except where `boundaries.json` marks `typesOnly`.
3. `no-deep-imports`: importing `@overmind/<pkg>/src/...` or any path not listed in that package's `exports` is an error `BOUNDARY_DEEP_IMPORT`. Subpath `@overmind/application/ports` is allowed only for packages whose entry has `allowedSubpaths`.
4. `no-forbidden-builtins`: for packages with `forbiddenBuiltins`, flag `import`/`require` of `node:fs`, `fs`, `fs/promises`, `node:child_process`, `net`, `http`, `https`, `dgram`, `os`, `worker_threads`, `node:crypto` (randomness) and the same names without `node:` prefix. `no-forbidden-globals`: flag `Date.now()`, `new Date()` with zero args, `Math.random()`, `process.env`, `fetch`, `console.*`, `setTimeout`/`setInterval` in domain/application (time goes through `Clock`), `eval`, `new Function`.
5. `apps/desktop` and `ui-kit`: forbid `node:*`, and forbid `@tauri-apps/*` anywhere except `apps/desktop/src/shared/platform/tauri/**`.
6. **Proving fixtures.** `tools/boundaries-fixtures/` is a self-contained pnpm-less mini repo (plain folders, its own `boundaries.json` copy generated from the real one at test time plus a tiny hand-written one) containing one throwaway package per layer. Each "bad" file has a header comment `// EXPECT: <ruleId> <line>` and the Vitest suite runs ESLint (`ESLint` class API, flat config) and `check.ts` over the folder and asserts that the reported set equals the EXPECT set exactly (no missing, no extra). Required bad cases (each in its own file):
   - domain imports application; domain imports `node:fs`; domain calls `Date.now()`; domain uses `process.env`.
   - application imports gateway; application imports an adapter; application imports `@overmind/application/src/x` (deep import).
   - adapters/sqlite imports adapters/herdr (cross-adapter); adapters/herdr imports `workflow-runtime`.
   - gateway imports domain directly; gateway imports an adapter.
   - api-client imports application; desktop imports domain; desktop imports `adapters/*`; desktop imports `node:fs`; desktop imports `@tauri-apps/api` outside the `platform/tauri` folder; desktop feature A imports feature B (`BOUNDARY_FEATURE_CROSS_IMPORT`).
   - ui-kit imports contracts; contracts imports domain.
   - production file imports `@overmind/testing`.
   - relative-path escape: `../../domain/src/x` from application.
   Required good cases: each package importing its permitted dependencies, `import type`, `application/ports` subpath from an adapter, `@tauri-apps/api` inside `platform/tauri`, a test file importing `@overmind/testing`, `tools/` importing anything.
7. Dependencies check: a fixture `package.json` declaring a forbidden dependency fails `check.ts` with `BOUNDARY_FORBIDDEN_DEPENDENCY`.
8. Output format for both tools: `path:line:col ruleId message` plus a JSON mode (`--json`) for CI annotations. Exit code 1 on any violation. Runtime budget: whole repo in under 20 s.
9. Meta-tests: deleting a rule from the plugin makes the fixture suite fail (the suite asserts that every rule id appears in at least one EXPECT line).
10. Escape hatches: none. `eslint-disable` comments for `boundaries/*` rules are themselves reported by a rule `boundaries/no-disable` (message: file a proposal and ADR). The only configuration is `boundaries.json`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses `boundaries.json` from `OVE_ARCH001` as the single source of truth (DRY: no second copy of the matrix in ESLint config). Uses the root ESLint flat config from `OVE_SETUP003`.

## 8. Architecture and code placement

Final evidence lives in tools/boundaries/ACCEPTANCE.md. Existing plugin/scanner/fixture paths described by the detailed requirements are read-only inputs owned by their registered prerequisite tasks. This task adds no product/runtime code and grants no Tools import or policy escape. Keep separate independent Standards and Spec review for the exact final head.

## 9. Security and safety

Architecture boundaries are a security control: they keep I/O and platform code out of the domain and keep the UI from reaching the filesystem or CLIs. Fail closed: a missing or invalid `boundaries.json`, an unresolvable package, or an unparsable file is an error, never a skip. The lint run must not execute project code (static analysis only).

## 10. Errors and edge cases

- Dynamic `import(variable)` or `require(variable)` in a governed package: `BOUNDARY_DYNAMIC_IMPORT` error (cannot be verified).
- Re-exports `export * from '@overmind/x'` count as imports. `import x = require()`, `import()` types (`typeof import('...')`) count.
- Path aliases and `tsconfig` `paths`: resolved through the TypeScript module resolver so aliases cannot hide an import.
- Generated files (`*.generated.ts`) are checked too.
- Windows-style separators are normalised (future-proofing, ADR 0009).
- Package not listed in `boundaries.json` but present in the workspace: error `BOUNDARY_UNKNOWN_PACKAGE` (forces the architecture document to be updated).

## 11. Acceptance criteria

- [ ] A separate scratch PR with a real boundary violation fails the hosted architecture job and ci-success; record the PR/run/diagnostic, then close without merging.

- [ ] `pnpm boundaries` and `pnpm lint` both report every EXPECT line in the fixture workspace and nothing else.
- [ ] Every required bad case in requirement 6 exists and fails with the stated rule id.
- [ ] Every required good case passes.
- [ ] Removing or weakening any rule makes the fixture suite fail (meta-test).
- [ ] Matrix in `ARCHITECTURE.md` equals `boundaries.json` (consistency test).
- [ ] `eslint-disable` of a boundaries rule is reported.
- [ ] A package with a forbidden `package.json` dependency fails.
- [ ] Run time on the real repo is under 20 s.

## 12. Test plan

- `tools/boundaries-fixtures/boundaries.fixtures.test.ts`: table-driven over files, asserts exact violation sets for ESLint and for `check.ts` (both must agree).
- `eslint-rules/boundaries/*.test.ts`: RuleTester unit tests per rule (valid/invalid snippets).
- `tools/boundaries/consistency.test.ts`: Markdown matrix vs JSON.
- Commands: `pnpm vitest run --project tools`, `pnpm boundaries`, `pnpm lint`.

## 13. Parallelization notes

Start final acceptance only after OVE_ARCH001, OVE_SETUP003 and OVE_ARCH053 are merged and done, including the latter's complete prerequisite DAG. Do not start from a draft matrix or declare independence from the new implementation prerequisites. Rebase the preserved claim through the normal approved lifecycle onto latest DEVELOP; reconcile history/status without reset, release, discard or replay of the entire bulk patch. The integration TASK stays todo until a normal claim/finish transition changes it; this registration does not rewrite the old implementation branch's in_progress history. Shared repairs are exact affected-owner proposals. A scratch violation is closed unmerged after actual hosted evidence; final integration requires fresh normal checks/reviews for its own exact head.

## 14. Open questions and assumptions

- ASSUMPTION: implementation uses the TypeScript compiler API directly (already a dependency) rather than `dependency-cruiser`; justification: one fewer dependency and full control of subpath/forbidden-global rules. If maintainers prefer dependency-cruiser for the graph report, it can be added as a second opinion later.
- ASSUMPTION: Rust code under `src-tauri` is out of scope for this check (Cargo workspace rules, `OVE_SETUP010`).


### Owner-approved acceptance sequencing (2026-10-15)

The Owner-approved SETUP006 sequence transfers actual boundary-violation scratch evidence here. The existing foundation guard only proves missing-tool orchestration. Integrate the root check:boundaries entry (tools/check-boundaries/run.ts) with tools/boundaries/check.ts, or explicitly coordinate the caller path, so the real checker runs in hosted CI. Record actual failing diagnostics and aggregate rejection.

Source: tasks/_proposals/OVE_SETUP006-acceptance-sequence.md.


### Registration and chronological evidence (2026-10-18)

This proposed integration metadata is derived from DEVELOP 6bbfcb06c41520e8a0ba5eabeb4c9548cade827b with status todo. Earlier in_progress checkpoints and their failed or limited scoped runs remain chronological evidence in the preserved implementation worktree/proposal; they are not copied here as current status or acceptance. The Owner approved smaller tasks, not a size, security, history, test or review exception.
