---
id: OVE_SETUP020
title: "CI check that a task branch changes only files it owns (pnpm check:owns)"
area: SETUP
kind: security
size: S
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_SETUP013]
soft_depends_on: [OVE_SETUP006, OVE_SETUP022]
provides: ["lib:owns-check"]
needs: []
owns:
  - tools/tasks/check-owns.ts
  - tools/tasks/owns-shared-files.json
reads: ["tasks/*/TASK.md", ".github/workflows/ci.yml"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [16, 25]
---

# OVE_SETUP020: CI check that a task branch changes only files it owns (`pnpm check:owns`)

## 1. Summary

Give CONVENTIONS section 5 rule 2 teeth: for branches named `task/<ID>`, compare the changed files against the task's `owns` globs and a short list of explicitly shared files, and fail when anything else is touched. Also verifies branch naming, that the task is claimable, and that the `status` flip is limited to the task's own file.

## 2. Context

Parallel agents must not edit files owned by other tasks (CONVENTIONS 5.2). Agents can make mistakes or, in the worst case, be manipulated by prompt injection to widen scope or touch security-sensitive files (workflows, hooks, lint config). A mechanical check in CI, which agents cannot bypass locally, limits the blast radius. It is a guardrail for process discipline and for supply-chain safety; it does not replace human review.

## 3. Scope (in)

- `tools/tasks/check-owns.ts` CLI: `pnpm check:owns [--base origin/main] [--head HEAD] [--task <ID>] [--json]`.
- `tools/tasks/owns-shared-files.json`: the explicit shared-file allow-list with per-file rules.

## 4. Out of scope

- The workflow wiring in `ci.yml` (OVE_SETUP006 calls the script on `task/*` branches).
- Declaring `owns` (task authors) and linting them (OVE_SETUP022).
- Human review and CODEOWNERS (OVE_OSS003).

## 5. Detailed requirements

1. **Task detection.** The task ID comes from `--task`, else from the branch name `task/<ID>` (`GITHUB_HEAD_REF` in PRs, `git rev-parse --abbrev-ref HEAD` locally). If the branch does not match `^task/OVE_[A-Z]{2,6}\d{3}$` the check passes with "not a task branch" (maintainer chores are reviewed by humans).
2. **Changed files:** `git diff --name-status --no-renames` (renames are treated as delete + add, both paths checked) between merge-base(base, head) and head. Submodule changes and mode changes are included. Symlinks added anywhere are flagged unless owned.
3. **Allowed set**: a changed path is allowed when it matches any of: (a) the task's `owns` globs; (b) `tasks/<ID>/**`; (c) tests, stories, snapshots and fixtures that live inside a directory covered by (a): patterns `**/*.test.*`, `**/*.stories.*`, `**/__snapshots__/**`, `**/fixtures/**`, `**/test/**` located under an `owns` prefix; (d) `tasks/_proposals/<ID>-*.md`; (e) shared files from `owns-shared-files.json` under their rules.
4. **Shared files (rules).** `pnpm-lock.yaml`: allowed only when some `package.json` or `pnpm-workspace.yaml` also changed; `docs/dependencies.md`: allowed only if hunks add lines (no deletions) except inside the sections the task's front matter owns; `pnpm-workspace.yaml`: only added lines inside the `catalog:` block; root `tsconfig.json`: only added `references` entries; `eslint.config.d/*.mjs`: only if the file is in `owns`; `docs/adr/*.md` new files allowed for tasks whose kind is `decision` or `spike`. Any other root file (`package.json` scripts block, `lefthook.yml`, `.github/**`, `renovate.json`, `deny.toml`, `.gitleaks.toml`) is allowed only when listed in `owns`.
5. **Security-sensitive set.** Paths `.github/**`, `lefthook*.yml`, `commitlint.config.*`, `eslint.config*`, `tools/pinned-bin/**`, `tools/check-*/**`, `apps/desktop/src-tauri/capabilities/**`, `apps/desktop/src-tauri/tauri.conf.json`, `deny.toml`, `.gitleaks.toml`, `renovate.json`, `AGENTS.md`, `CLAUDE.md`, `vendor/herdr/**`, `tools/runner/**`, `build/entitlements/**` are "sensitive": changing them requires that they are explicitly in `owns` AND the PR has the label `config-change` (read from `GITHUB_EVENT_PATH` JSON, or `--label config-change` locally). The check prints "sensitive file touched" prominently.
6. **Task file edits.** A task branch may edit only `tasks/<ID>/TASK.md` among task files, and the only allowed front matter changes are `status` (any forward move todo -> in_progress -> in_review -> done), plus content changes to its own body when the PR is the task's own amendment. Edits to another task's folder are violations (use a proposal).
7. **Status rule.** If the branch's final tree has `status: done` for its task, there must be a commit after which `status` is set; pre-merge `in_progress` must not appear in the final diff against base other than via the `done` flip (the net diff of `status` is `todo -> done`, or unchanged while still in review).
8. **Output:** table of violations (`path | reason | rule`), `--json` structure, exit 1 on violations, 0 otherwise. Messages tell the agent what to do ("write tasks/_proposals/<ID>-<name>.md and stop that part").
9. **Fork PRs.** Branches from forks are not task branches; the check is skipped but CODEOWNERS and the PR gate (OVE_OSS003) apply. Outside contributors work from accepted issues, not tasks (ADR 0025).
10. **Performance:** runs in under 3 s for 500 changed files.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ownsOverlap` and glob utilities and the task model from OVE_SETUP013; the sensitive-path list is shared as data with OVE_SETUP022's ownership-map (one JSON `tools/tasks/sensitive-paths.json` owned by this task and imported by the linter via a proposal if it lands first).

## 8. Architecture and code placement

`tools/tasks/check-owns.ts` plus pure function `checkOwns(input: { taskId, owns, changed: Change[], labels }): Violation[]` with I/O at the edge, for tests.

## 9. Security and safety

- The check runs in CI with a read-only token on the PR's merge commit, using the BASE branch version of `tools/tasks/check-owns.ts` and `owns-shared-files.json` (the workflow checks out base scripts into a separate directory) so a PR cannot weaken its own check. OVE_SETUP006's `ci.yml` is responsible for that checkout detail; this task documents it and the script supports `--scripts-from <dir>`.
- Changes to workflows, hooks, lint, signing and Tauri capabilities are the highest-impact; they need explicit ownership plus a maintainer label, creating two independent human decisions.
- Glob matching uses a well-defined implementation with `dot: true` so hidden files are not skipped; path normalisation rejects `..` segments and absolute paths.
- Output never prints file contents.

## 10. Errors and edge cases

- Task ID not found on base: violation "unknown task".
- Task `status` is `cancelled`: any change fails.
- Rebase moved merge-base: the script recomputes merge-base each run.
- Generated files (lockfile) changed alone: allowed only with manifest change; otherwise violation.
- Rename from an owned path to an unowned path: violation on the destination.
- Binary files and large diffs: path-based only, no content inspection except the shared-file hunk rules.
- Squash-merge branches with `[bot]` authors (Renovate): branch names `renovate/*` are not task branches.

## 11. Acceptance criteria

- [ ] A branch `task/OVE_X001` editing only owned files passes.
- [ ] Editing `packages/domain/src/perm/x.ts` while owning `packages/domain/src/data/**` fails naming the file and rule.
- [ ] Editing `.github/workflows/ci.yml` without ownership fails; with ownership but without label `config-change` fails; with both passes.
- [ ] `pnpm-lock.yaml` alone fails; with a manifest change passes.
- [ ] A `pnpm-workspace.yaml` hunk outside `catalog:` fails.
- [ ] Editing another task's `TASK.md` fails with the proposal advice.
- [ ] A non-task branch passes with the message "not a task branch".
- [ ] `--json` output matches its schema.

## 12. Test plan

Unit tests with in-memory change sets (table-driven per rule); integration test using a temporary git repo with base and head commits for hunk-based rules (workspace catalog, dependencies.md). Commands: `pnpm test -- tools/tasks/check-owns`, `pnpm check:owns -- --base origin/main`.

## 13. Parallelization notes

Parallel with OVE_SETUP022 and 023. Hotspot: `owns-shared-files.json` (owned here; additions via proposals).

## 14. Open questions and assumptions

- ASSUMPTION: the label `config-change` is applied only by maintainers (repository setting: only triage+ can label).
- ASSUMPTION: tests/stories/fixtures beside owned code are implicitly owned (CONVENTIONS 5.2 "plus its own tests and stories").
