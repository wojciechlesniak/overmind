---
id: OVE_SETUP022
title: "Task linter: front matter, sections, capabilities, ownership, cycles"
area: SETUP
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP013]
soft_depends_on: [OVE_SETUP006]
provides: ["lib:task-linter"]
needs: []
owns:
  - tools/tasks/lint.ts
  - tools/tasks/rules/**
  - tools/tasks/ownership-map.ts
reads: ["tasks/CONVENTIONS.md", "tasks/PLAN.md", "tasks/*/TASK.md", "docs/adr"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [16, 17]
---

# OVE_SETUP022: Task linter: front matter, sections, capabilities, ownership, cycles

## 1. Summary

A deterministic linter that enforces CONVENTIONS and PLAN on every `tasks/*/TASK.md`: front matter keys and enums, the 14 body sections in order, capability naming and resolution, `owns` rules (placement and overlap), dependency validity and cycles, design image rules, and language. It is the executable form of "the backlog is valid", run locally, in the pre-commit hook and in CI.

## 2. Context

A prototype validator exists in the authoring environment (front matter keys, sections, design files, cycles). This task turns it into a maintained TypeScript tool on the shared model from OVE_SETUP013 and adds the cross-task checks that the final linker pass needs (capability resolution, ownership overlap). Rules come from CONVENTIONS sections 2-4 and PLAN sections 2-6.

## 3. Scope (in)

- `tools/tasks/lint.ts` CLI and `tools/tasks/rules/*.ts` (one rule per file, each returns diagnostics).
- `tools/tasks/ownership-map.ts`: path pattern to owning area table derived from PLAN section 6.
- Output formats: table (default), `--json`, `--github` (workflow annotations).
- Flags: `--area <A>[,<B>]`, `--staged`, `--changed-since <ref>`, `--allow-unresolved` (authoring phase, downgrades capability resolution errors to warnings), `--strict-language`.

## 4. Out of scope

- Writing `blocks:` or INDEX/DEPENDENCIES: OVE_SETUP023.
- Checking the diff of a PR against `owns`: OVE_SETUP020.
- Linting source code: OVE_SETUP003.

## 5. Detailed requirements

1. **Front matter.** Exactly these keys: `id, title, area, kind, size, priority, mvp, status, depends_on, soft_depends_on, provides, needs, owns, reads, design, design_source, spec_refs, adr_refs`; optional `blocks` (generated; if present it MUST equal the computed reverse of `depends_on`, else error "stale blocks, run pnpm gen:task-index --write-blocks"). Unknown keys are errors. Types: lists are arrays of strings (ints for `adr_refs`), `mvp` boolean, enums as in CONVENTIONS (`kind`: feature, ui, infra, contract, security, test, docs, spike, decision; `size`: XS, S, M; `priority`: P0, P1, P2; `status`: todo, in_progress, in_review, done, cancelled). `id` equals the folder name and matches `^OVE_[A-Z]{2,6}\d{3}$`; `area` is in the PLAN area table and is the id prefix; `title` <= 90 characters, starts with an uppercase letter or a verb, no trailing period.
2. **Body.** Heading `# <ID>: <title-ish>` then sections `## 1. Summary` ... `## 14. Open questions and assumptions` with exactly the titles from CONVENTIONS, in order, none missing, none empty (at least one non-blank content line, or the literal "N/A, functionality only" for Design notes of non-UI tasks). Section 11 contains at least one `- [ ]` item. Section 9 contains at least 40 characters. Body length: warning below 60 or above 300 lines (target 80-250). Section 5 must contain the words MUST or SHOULD at least once (requirements are testable). Section 14 must exist even if the answer is "none".
3. **Design.** `design: none` -> no `design*.png` in the folder is an error only if `kind: ui`... precisely: `design: none` with `design.png` present is a warning; `design: design.png` requires the file to exist, be a valid PNG (IHDR readable), width >= 400 px, and `design_source` to match `^[A-Za-z0-9_-]+#[a-z0-9/_-]+ \(crop \d+,\d+,\d+,\d+\)$`; `kind: ui` tasks must have a design unless `design: none` is justified in Section 6 text containing "no visual specification".
4. **References.** Every ID in `depends_on` and `soft_depends_on` exists, is not self, is not `cancelled`; `depends_on` has no cycles (report the cycle path); `soft_depends_on` may form no cycle with `depends_on` edges. `spec_refs` entries match `^SPECIFICATION \d+(\.\d+)*$`; `adr_refs` are integers for which `docs/adr/<NNNN>-*.md` exists. IDs mentioned in the body text (`OVE_XXX000`) must exist (warning).
5. **Capabilities.** Names match `^(api|port|contract|ui|usecase|event|table|lib|decision):[A-Za-z0-9._:-]+$`. Each `provides` name is globally unique (duplicates are errors naming both tasks). Each `needs` name must be provided by exactly one task (zero or many = error; downgraded by `--allow-unresolved`). When a need is resolved, the provider ID must be in the consumer's `depends_on` (error "linker pending: add OVE_X to depends_on" unless `--allow-unresolved`). A task never both provides and needs the same capability.
6. **Ownership.** `owns` is required for kinds feature, ui, infra, contract, security, test (warning for docs, spike, decision). Entries are repository-relative POSIX globs: no leading `/`, no `..`, no `~`, no backslashes, not `**` alone and not a top-level wildcard (`*`), no overlap with `tasks/**` unless the task is in `SETUP`/`OSS` and the path is `tasks/_proposals/**`. Placement check: using `ownership-map.ts` (regex table from PLAN section 6, for example `packages/domain/src/<x>/` must belong to the area whose lowercase code is `<x>`, `packages/gateway/src/routes/<x>/`, `packages/adapters/sqlite/migrations/V*__<TASKID>__*.sql` must contain the task's own ID, `apps/desktop/src/features/<f>/` must be owned by a UI area, `packages/ui-kit/src/<group>/<C>/` by DS); violations are errors. Overlap: for every pair of non-cancelled tasks, `ownsOverlap` (OVE_SETUP013) must be empty; if overlapping paths exist but one task transitively `depends_on` the other, report a warning "sequential edit", otherwise an error naming both tasks and the overlapping prefix. Files named in `reads` must not also be in the same task's `owns`.
7. **Language and hygiene.** Warn when Polish diacritics occur outside backtick/quote spans (ADR 0017), in `--strict-language` an error. Error on secrets-like strings (reuse regexes from `.gitleaks.toml` custom rules if present). Error on tab characters in front matter, Windows line endings, and BOM. Relative Markdown links must resolve.
8. **Size sanity.** Warn when `size: XS` has more than 8 acceptance criteria, or `size: M` has fewer than 4; warn when `owns` lists more than 15 distinct top-level paths (CONVENTIONS 4: split).
9. **Output.** Each diagnostic: `{ id, level: "error"|"warning", rule, message, file, line? }`. Table sorted by task ID then line; summary "N tasks checked, E errors, W warnings"; exit code 1 on any error, 0 otherwise. `--github` prints `::error file=...,line=...::message`. Deterministic ordering, no timestamps.
10. **Performance.** 1000 tasks in under 5 s (single pass, glob prefix comparison via sorted prefixes, not O(n^2) on globs: sort by static prefix and compare neighbours first).
11. **Rule plug-in structure.** Each rule file exports `{ name, run(ctx): Diagnostic[] }`; `lint.ts` loads all files in `rules/` in sorted order (OCP: new rule = new file).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses `TaskFrontMatter`, `loadTasks`, `ownsOverlap` from OVE_SETUP013 and the area table parser shared with commitlint (OVE_SETUP005). The `design_source` regex and the section titles live in one constants file `tools/tasks/lib/conventions.ts` (owned by OVE_SETUP013; this task proposes additions, does not fork constants).

## 8. Architecture and code placement

`tools/tasks/lint.ts` (CLI), `tools/tasks/rules/<rule>.ts` (pure functions over the loaded model), `tools/tasks/ownership-map.ts` (data). No I/O inside rules except reading image headers through an injected reader.

## 9. Security and safety

- Task files are untrusted text from contributors: parsed with a size limit and a safe YAML loader; no evaluation, no network, no shell.
- The linter protects the ownership model, which is a safety boundary for parallel agents (a task owning `.github/workflows/**` or `lefthook.yml` without the right area is flagged by the ownership map; paths of security-critical files (`.github/**`, `lefthook.yml`, `eslint.config*`, `deny.toml`, `tools/pinned-bin/**`) may only be owned by SETUP, OSS or SEC area tasks).
- Secrets-like strings in task text are errors (tasks are public).
- Fail closed: a rule that throws is reported as an error for that file, never silently skipped.

## 10. Errors and edge cases

- Malformed YAML: one error with the YAML line number; other rules for that file are skipped.
- A task with `status: cancelled` keeps its folder; it is excluded from overlap and provides/needs resolution but still validated for format.
- Duplicate `provides` between a cancelled and an active task: ignored for the cancelled one.
- `--staged` with renames: uses the new path; deleted task folders are errors (IDs are never removed, only cancelled).
- Capability names with uppercase/lowercase differences (`ui:Button` vs `ui:button`) are distinct but a warning "case-insensitive duplicate" is emitted.
- Very long lines or giant files: size limit 256 KiB per task.

## 11. Acceptance criteria

- [ ] Running on a fixture set with one violation per rule reports exactly that rule for that fixture (table-driven test).
- [ ] The real `tasks/` folder lints with 0 errors when authors have run the linker; with `--allow-unresolved` unresolved capabilities are warnings.
- [ ] A cycle A -> B -> A reports the cycle path.
- [ ] Two tasks owning `packages/domain/src/perm/**` and `packages/domain/src/perm/policy/**` are reported as overlapping; sequential dependency downgrades to a warning.
- [ ] A task in area DATA owning `packages/domain/src/perm/` is reported by the placement rule.
- [ ] `--json` output validates against a published schema in `tools/tasks/lint.schema.json`.
- [ ] 1000 synthetic tasks lint in under 5 seconds (benchmark test with generous threshold).
- [ ] Exit codes: 0 without errors, 1 with errors.

## 12. Test plan

Vitest unit tests per rule with in-memory task sets (builders); fixture folder tests for the CLI; snapshot-free assertions on diagnostics. A regression test lints the real `tasks/` folder (marked `*.int.test.ts`, runs only when `tasks/` exists). Commands: `pnpm test -- tools/tasks`, `pnpm check:tasks`.

## 13. Parallelization notes

Parallel with OVE_SETUP020 and 023 after OVE_SETUP013. Hotspot: `ownership-map.ts` changes when PLAN section 6 changes; keep one entry per line to keep merges simple. New rules are new files.

## 14. Open questions and assumptions

- ASSUMPTION: linter is strict (errors) from the first merge of the final backlog; the authoring phase uses `--allow-unresolved`.
- ASSUMPTION: Polish text inside task bodies is allowed only in UI copy quotes (the design mocks are Polish).
