# Task tools

These Node22 tools implement the task lifecycle on the Owner-authorized integration
branch **DEVELOP**. They do not select a base from the current checkout or GitHub's
default branch. Install the pinned pnpm dependencies before using the commands.

## Commands

| Command           | Options                           | Behavior                                                             |
| ----------------- | --------------------------------- | -------------------------------------------------------------------- |
| `task:next`       | `--area AREA`, `--limit N`        | Ready, unclaimed tasks; conflict-risk candidates last                |
| `task:status`     | `--mine`, `--stale-days N`        | Integration counts, active claims, age and blockers                  |
| `task:claim ID`   | `--install=false`, `--agent NAME` | Isolated worktree and atomic remote claim                            |
| `task:release ID` | `--force-owner`                   | Release an otherwise empty claim owned by your identity              |
| `task:finish ID`  | `--done`                          | Review commit and PR body; final done commit only after verification |
| `task:cleanup`    | `ID` or `--merged`                | Remove merged clean managed worktrees, retain remote branches        |

All commands accept `--json` and `--help`. IDs for mutations must match
`^OVE_[A-Z]{2,6}\d{3}$`. Existing BOARDUI metadata remains readable; its seven-letter
area is an acknowledged backlog grammar inconsistency, not a widened mutation API.
Numbers must be positive integers; unknown flags and extra arguments are errors.

## Claim and concurrency

Claim reads task status and hard dependencies from fetched `origin/DEVELOP`.
Only merged `done` dependencies count. Soft dependencies do not block work.
The primary checkout may contain local changes: claim creates a separate worktree
from the integration commit and does not stage or reset the primary checkout.

The target is `<primary-checkout-parent>/wt/<ID>`, even when invoked from another
worktree. Existing branches, target paths and symlinked managed parents are refused.
The new task branch is always `task/<ID>`.

The tool installs with the frozen lockfile before committing when installation is
enabled, because real repository hooks require those dependencies. `--install=false`
does not install or bypass hooks; prepare dependencies yourself if hooks need them.
The claim commit changes only the status line and records identity, ISO time and
a random nonce. The nonce prevents two simultaneous claims having an identical SHA.

An empty expected lease creates the remote branch only if it does not exist.
Two independent clones may reach the push together; one wins and the clean loser
removes only its newly created worktree/branch and exits3. A failed or uncertain
operation preserves any state that cannot be proved safe to remove and reports it.
Never retry with an unconditional force push.

Every operation holds a common Git-directory advisory lock. A live owner blocks
other calls even after ten minutes. Dead stale records advance to an O_EXCL-created
numbered generation without unlinking a possibly replaced live lock. Malformed
locks fail closed; inspect them manually. At256 generations automatic recovery stops.

## Selection and status

Next orders by conflict risk, priority, topological layer, descending direct
unfinished dependent count, size and ID. It shows provided capabilities and overlap
paths. Static glob prefixes are compared conservatively; a warning is coordination
advice, not permission to edit another task's files.

Status shows counts from integration separately from branch status. A claimed
task is not merged merely because its branch says done. Retained branches of tasks
already done on integration are ignored as active claims. Stale means no commit
for the configured number of days; it is informational and never triggers deletion.
`--mine` matches the current Git email to the latest commit author email.

## Release and cleanup

Release accepts only the single claim commit, with its expected message and sole
status-line change. Your Git name/email must match its author. Maintainer override
requires `gh` admin/maintain permission or explicitly trusted local configuration
`git config overmind.maintainer true`; it changes identity eligibility only.
It never permits removal of implementation commits.

Remote deletion uses a lease on the inspected exact SHA. Local data is checked
before removal; worktrees outside the managed directory are not touched. Dirty,
unpushed, differently attached or unknown ignored content is preserved.
Consequently installed dependencies/build caches can require manual inspection
and removal before destructive cleanup; a Git-ignore rule is not proof of ownership.

Cleanup checks ancestry into fetched DEVELOP. Squash detection needs a merged PR
whose head exactly equals the local head, targets DEVELOP and whose merge commit
is an ancestor of integration. A different or later local commit does not qualify.
`--merged` reports refused candidates separately. It never deletes remote branches.

## Finish and merge

Run finish from the managed task worktree on its matching task branch. Tracked and
untracked changes must be committed first. When implemented, task lint and owns
checks run; missing future tools are not represented as passing checks.
Normal finish commits in_review, pushes and prepares a private temporary PR-body
file. The body contains the task checklist, security reminder, dependency prompt
and files grouped by ownership. Mentions are made inert before publication.
If `gh` is unavailable, the body path is printed for manual PR creation.
An existing PR is reused without overwriting its human-edited description.

Before `--done`, check the PR's acceptance criteria. The checklist must match the
task, with every item checked. The PR must target DEVELOP at the exact current
in_review SHA. The tool requires successful ci-success, gate, secrets, secrets-sarif,
tools, sbom and dependency-review checks and rejects unsuccessful additional checks.
Only documented conditional Rust, desktop-E2E, escape, full-secret and report skips
are accepted. Unavailable GitHub evidence denies done.

Done creates and pushes the final status-only commit; **that new SHA needs fresh
CI, security checks and independent review before merge**. These tools never merge
a PR or grant an agent authority. Owner-authorized merge execution remains separate.

## Library and output contract

Import public APIs from `tools/tasks/lib/index.ts`: parseTask, loadTasks, readiness,
ownsOverlap, topologicalLayers and the shared TaskFrontMatter Zod schema/types.
The future linter and index generator must reuse them rather than parsing YAML again.
Git uses execFile argument arrays only. Files and external processes have narrow
ports; repository text and API JSON are validated as data and never executed.

All JSON results have schemaVersion1 and a command discriminant, validated by
outputSchema. Errors have ok:false, exitCode and a sanitized error string, validated
by errorSchema. Neither contract contains environment variables or subprocess stderr.
Exit codes:0 success;2 not allowed;3 lost race;4 invalid input/environment;5 unexpected.
Help returns schemaVersion1, command, help:true and usage without accessing Git.

Run the public-seam tests with `pnpm test -- tools/tasks` and
`pnpm test:int -- tools/tasks`. Integration fixtures use real temporary bare remotes,
independent clones and real Git operations; no production credentials are needed.
