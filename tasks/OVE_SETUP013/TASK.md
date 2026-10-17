---
id: OVE_SETUP013
title: "Parallel-agent tooling: worktree and claim scripts, task library, status and next"
area: SETUP
kind: infra
size: M
priority: P0
mvp: true
status: in_review
depends_on: [OVE_SETUP001, OVE_SETUP002]
soft_depends_on: [OVE_SETUP004, OVE_SETUP005]
provides: ["lib:task-tools", "lib:task-model", "lib:worktree-tools"]
needs: []
owns:
  - tools/tasks/lib/**
  - tools/tasks/claim.ts
  - tools/tasks/release.ts
  - tools/tasks/finish.ts
  - tools/tasks/cleanup.ts
  - tools/tasks/status.ts
  - tools/tasks/next.ts
  - tools/tasks/README.md
  - docs/engineering/parallel-agents.md
reads: ["tasks/CONVENTIONS.md", "tasks/PLAN.md", "tasks/*/TASK.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [16, 25]
---

# OVE_SETUP013: Parallel-agent tooling: worktree and claim scripts, task library, status and next

## 1. Summary

Implement the scripts that make CONVENTIONS section 5 mechanical: `pnpm task:claim <ID>` creates the worktree `../wt/<ID>` and claims the task by atomically pushing branch `task/<ID>`; `task:next`, `task:status`, `task:release`, `task:finish` and `task:cleanup` cover the rest of the life cycle. A shared library (`tools/tasks/lib`) parses task files and computes readiness, ownership overlap and dependency state; the linter (OVE_SETUP022) and index generator (OVE_SETUP023) reuse it.

## 2. Context

Many agents and humans work at the same time, one agent per task, one worktree per agent, branch `task/<ID>`, and "claiming a task = pushing its branch; if the branch already exists, pick another task" (CONVENTIONS section 5.1). A task may start only when every `depends_on` task is merged. Merged tasks are marked `status: done` in `main` (see requirement 3). Humans merge (ADR 0025). Nothing may be deleted automatically that could hold someone's work (herdr rule: branches are never auto-deleted). Scripts run on macOS and Linux with Node 22, git >= 2.40, optionally the `gh` CLI.

## 3. Scope (in)

- Library `tools/tasks/lib/` (front matter parsing with `yaml`, zod schema of the front matter, task loading from a git ref or the working tree, glob-overlap utility, dependency graph utilities, git helpers using `execFile`).
- Scripts `claim`, `release`, `finish`, `cleanup`, `status`, `next` and root script entries (names already in OVE_SETUP001: `task:claim|finish|status|next`; this task adds `task:release` and `task:cleanup` as pure additions).
- `docs/engineering/parallel-agents.md` describing the flow for agents and humans.

## 4. Out of scope

- The task linter: OVE_SETUP022. The INDEX.md/DEPENDENCIES.md generator: OVE_SETUP023. The "changed files within owns" CI check: OVE_SETUP020.
- Repository rules (branch protection, required reviews): OVE_SETUP018.
- Agent instructions text (`AGENTS.md`): OVE_SETUP019.

## 5. Detailed requirements

1. **Status life cycle.** `main` only ever sees `todo -> done` (and `cancelled`). `in_progress` exists only in the claim commit on the task branch; `in_review` in the branch after `task:finish`; the same PR's last commit sets `done` so that merging the PR marks the task done. A dependent task is claimable only when all `depends_on` tasks have `status: done` on `origin/main`.
2. **Library API (TypeScript, pure where possible):** `loadTasks(ref: "WORKTREE" | string): Promise<Map<string, Task>>`, `parseTask(path, text): Result<Task, ParseError>`, `readiness(task, tasks): { ready: boolean; blockedBy: string[]; reasons: string[] }`, `ownsOverlap(a: string[], b: string[]): string[]` (conservative: two glob patterns overlap when one's static prefix, up to the first wildcard segment, is a path-prefix of the other's), `topologicalLayers(tasks)`, and git wrappers `git(...args)` using `execFile` with argument arrays only (never a shell string). The zod front-matter schema exports `TaskFrontMatter` and is the single definition used by the linter and generator.
3. **`pnpm task:claim <ID> [--install=false] [--agent <name>]`** steps, each with its own error code:
   1. Validate `<ID>` against `^OVE_[A-Z]{2,6}\d{3}$` (no path characters) -> exit 4 on failure.
   2. Require a clean main worktree (or run from any worktree: find the main checkout with `git rev-parse --git-common-dir`). `git fetch origin --prune`.
   3. Load tasks from `origin/main` via `git show`/`git ls-tree` (not the working tree). Task must exist, `status: todo`, not `cancelled`, `depends_on` all `done` -> else exit 2 with the list of blockers.
   4. Refuse if `git ls-remote --exit-code --heads origin refs/heads/task/<ID>` finds the branch (exit 0 means exists) -> exit 2 "already claimed by <last committer>". Refuse if local branch `task/<ID>` or the directory `../wt/<ID>` exists -> exit 2 with advice.
   5. Warn (do not block) when `owns` overlaps with an open claimed branch's task (reads `origin/task/*` front matter via `git show`), and print the overlapping paths.
   6. `git worktree add -b task/<ID> ../wt/<ID> origin/main` (path relative to the main checkout parent).
   7. In the new worktree, set `status: in_progress` in `tasks/<ID>/TASK.md` (rewrite only that line), commit as `chore(<area-lowercase>): claim <ID>` with trailers `Refs: <ID>` and `Claimed-By: <agent name or git user>` and the ISO timestamp in the body (this makes every claim commit unique).
   8. **Atomic claim:** `git push --force-with-lease=refs/heads/task/<ID>: origin task/<ID>:refs/heads/task/<ID>` (an empty expected value means "the remote ref must not exist"). On rejection: remove the worktree and local branch (`git worktree remove --force` only for the directory just created and verified empty of user changes), print "lost the race", exit 3.
   9. Unless `--install=false`, run `pnpm install --frozen-lockfile` in the worktree (shared pnpm store). Print the worktree path, the task title, the `owns` list and "next: read the TASK.md fully, then implement".
4. **`pnpm task:next [--area X] [--limit N] [--json]`:** lists tasks that are `todo`, ready, unclaimed (no remote `task/<ID>`), sorted by priority (P0 first), then by the topological layer, then size (XS first), then ID; marks tasks whose `owns` overlap with a currently claimed task as `conflict-risk` and sorts them last; shows `provides` that unblock the most tasks (count of dependents) so agents pick unblocking work first.
5. **`pnpm task:status [--mine] [--json]`:** table of counts per area and per status derived from `origin/main` plus open `task/*` branches (claimed, with last commit age and author); highlights stale claims (no commit for 3 days, configurable `--stale-days`), tasks `ready` but unclaimed, and claimed tasks whose dependencies are not done (should not happen). Read-only.
6. **`pnpm task:release <ID>`:** abandon a claim you own. Allowed only if the remote branch contains nothing but the claim commit and the current git identity equals the claimer, or with `--force-owner` run by a maintainer (checks `gh api` permission or `git config overmind.maintainer true`); deletes the remote branch, then local worktree/branch. Otherwise refuses with a message pointing to opening a PR or asking a maintainer. Never deletes a branch holding other commits.
7. **`pnpm task:finish <ID>`** (run in the task worktree): checks clean tree; runs `pnpm check:tasks --area <area>` and `pnpm check:owns` if their files exist; sets `status: in_review`, then prepares the PR body from `.github/pull_request_template.md` (OVE_OSS003) filled with: task ID and title, the acceptance criteria list copied from section 11 as a checklist, the Security section reminder, a "new dependencies" block prompt, and the list of changed files grouped by owns/not-owns; pushes the branch; if `gh` is available runs `gh pr create --draft=false --title "<conventional title>" --body-file <tmp>` else prints the body path. After CI is green and the author has ticked criteria, `task:finish --done` creates the final commit `chore(<area>): mark <ID> done` setting `status: done` (must be the last commit, enforced by the CI check in OVE_SETUP020 which verifies the PR changes `status` to `done` only in the task's own file).
8. **`pnpm task:cleanup [<ID>|--merged]`:** for each worktree under `../wt/` whose branch is merged into `origin/main` (ancestor check or squash detection via `gh pr list --state merged --head task/<ID>`), remove the worktree when clean and fully pushed; delete the local branch; never delete remote branches (message explains). Prunes with `git worktree prune`. Refuses when there are uncommitted or unpushed changes.
9. **Concurrency safety:** every script holds an advisory lock file `.git/overmind-task.lock` (created with `O_EXCL`, stale lock ignored after 10 minutes) to avoid two local invocations racing; remote atomicity is provided by requirement 3.8.
10. **Output contract:** human-readable by default; `--json` prints a stable JSON schema (`schemaVersion: 1`) for agent consumption; exit codes: 0 ok, 2 not allowed (reason in output), 3 lost race, 4 invalid input/environment, 5 unexpected error.
11. **Docs.** `docs/engineering/parallel-agents.md` walks through: choosing a task (`task:next`), claiming, working in the worktree, extension points and proposals (CONVENTIONS 5.2-5.3), rebasing (`git pull --rebase origin main`, never merge main), finishing, review, cleanup, handling lost races and stale claims.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

One task model (`TaskFrontMatter` zod schema, `loadTasks`) for all task tools; OVE_SETUP022 and OVE_SETUP023 import it and must not re-parse YAML by hand. Git access only through `tools/tasks/lib/git.ts`. Area codes are read from `tasks/PLAN.md` (shared with commitlint, OVE_SETUP005).

## 8. Architecture and code placement

`tools/tasks/lib/*.ts` (model, git, graph, glob), thin CLI entry files `tools/tasks/<command>.ts` (argument parsing, call library, print). Library functions are pure and take `Git` and `FileSystem` interfaces as parameters so tests inject fakes (DIP). No product package depends on `tools/`.

## 9. Security and safety

- **Command injection:** IDs are validated against a strict regex; all subprocesses use `execFile` with arrays; no string-built shell commands; branch and path names are derived only from the validated ID.
- **Atomic claim and no silent overwrite:** `--force-with-lease` with an empty expected value can only create the ref; scripts never force-push existing branches; `task:release` and `task:cleanup` never delete work.
- **Untrusted content:** TASK.md files and PR text are data; scripts parse front matter with a safe YAML loader (`yaml` with default schema, no custom tags, size limit 256 KiB) and never evaluate content. Task text is never passed to a shell.
- **Credentials:** scripts use the developer's git credentials/`gh` session; they never read, print or store tokens. `--json` output contains no environment variables.
- **Worktree path safety:** target is always `<main-checkout-parent>/wt/<ID>`; refuse if it exists or if resolving it yields a path outside that parent (symlink check with `realpath`).
- **Hook bypass and tampering:** the claim is repeated by server-side checks: OVE_SETUP020 verifies in CI that a PR's branch name matches its task ID and that its changes stay within `owns`. A local script can be bypassed; CI cannot.
- **Prompt injection:** `task:finish` PR bodies embed the task's own acceptance criteria text; it is written as plain text in a code block-free checklist to prevent mention spam (`@user` is escaped as `@​user`).

## 10. Errors and edge cases

- `origin` missing or offline: exit 4 with the git error; no partial worktree is left (cleanup in a `finally`).
- Two agents claim at the same instant: exactly one push succeeds (the other gets exit 3 and a clean state).
- Claim of a task whose dependency is `in_review` but not merged: refused with the dependency listed (use `soft_depends_on` for stubs).
- Task folder missing on `origin/main` (task added by an unmerged PR): exit 2 "not on main".
- Dirty main checkout: `claim` still works because it only uses `git worktree add` from `origin/main`; it warns if the current branch is not main.
- Windows paths: unsupported (ADR 0009); scripts fail early on `win32`.
- Very large number of branches: `ls-remote --heads origin 'refs/heads/task/*'` is used, not a full fetch.
- A task gets renumbered or cancelled while claimed: `status` reports "claimed but cancelled on main"; humans resolve.
- Clock skew: stale-claim logic uses commit dates only for display.

## 11. Acceptance criteria

- [x] Given a ready task, `pnpm task:claim OVE_X001` creates `../wt/OVE_X001`, commits `status: in_progress`, pushes `task/OVE_X001` and installs dependencies; the branch exists on the remote with exactly one new commit.
- [x] Given two simultaneous claims of the same task (integration test with two clones and a bare remote), exactly one exits 0 and the other exits 3 with a clean filesystem.
- [x] Given a task with an undone dependency, claim exits 2 and lists it.
- [x] Given an ID like `OVE_X001; rm -rf /` or `../x`, claim exits 4 before running git.
- [x] `task:next` orders ready tasks by priority, unblocking power and conflict risk, and `--json` validates against its schema.
- [x] `task:release` refuses to delete a branch with more than the claim commit.
- [x] `task:cleanup --merged` removes a merged clean worktree and refuses a dirty one; remote branches are never touched.
- [x] `task:finish` produces the PR body with the criteria checklist and sets the right statuses; `--done` makes `status: done` the last commit.
- [x] `parseTask` rejects front matter missing keys or with wrong types, files over 256 KiB, and YAML with custom tags.

## 12. Test plan

Unit tests (Vitest, `tools/tasks/**/*.test.ts`): front matter parsing (good, missing key, bad enum), readiness, glob overlap table, topological layers, argument validation, status transitions. Integration tests (`*.int.test.ts`) using a temporary bare git repository and two clones: successful claim, lost race, release, cleanup, finish (without `gh`: stub binary on PATH). Fixtures: `tools/tasks/fixtures/tasks/OVE_FIX00*/TASK.md`. Commands: `pnpm test -- tools/tasks`, `pnpm test:int`.

## 13. Parallelization notes

Parallel with OVE_SETUP010..012 after OVE_SETUP002. OVE_SETUP022, 023, 020 depend on the library from this task. Hotspots: `tools/tasks/lib/` is the shared model; changes to the front-matter schema must go through a proposal because the linter, generator and CI all read it.

## 14. Open questions and assumptions

- ASSUMPTION: `status: done` is committed in the PR that implements the task (so main shows `done` exactly when the work is merged). Alternative (a bot or the merging human edits status) is rejected to keep human merges simple.
- ASSUMPTION: stale-claim threshold is 3 days and informational only; maintainers decide releases.
- ASSUMPTION: the `gh` CLI is optional.
- Open question: whether agents may claim several tasks sequentially in one worktree. Default no: one task, one worktree, one branch.

## Implementation evidence (2026-10-17)

Implementation `80d4eb2a37441282b487238b3c88c125c9d6e93d`, based on DEVELOP
`7815088b2756ef180a7fec49838fd32a4f199006`, passed independent Standards and Spec
reviews with zero findings after the original release/install-race findings were
reproduced and corrected. The complete local `pnpm check` passed: 331 unit tests,
54 integration tests, four architecture-tool integration tests and 29 Rust tests,
with format, lint, types, build, coverage, license/dependency controls, audits,
secret scans and SBOM. Two pre-existing allowed Rust warnings and one Keychain
reference warning remain explicit; secret findings were zero. Earlier timed-out
runs are not counted as passing evidence. Fixture concurrency and safe retention
are documented in the integration proposal.

The real `task:next --limit 5 --json` also completed against fetched DEVELOP and
the current remote claims. Mutation tests use real isolated bare remotes, frozen
offline workspace installs and independent clones. GitHub finish evidence uses
validated API fixtures; it is not fabricated hosted CI. Hosted CI/security and
the final status-only head review remain required before merge into DEVELOP.

The first pre-push exposed an ignored-cache traversal race in the existing
skeleton test collector. Its exact `.cache` exclusion preserves every workspace
and supply-chain assertion; the proposal records the failure and narrow fix.
