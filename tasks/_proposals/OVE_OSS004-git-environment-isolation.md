# OVE_OSS004: isolate Git subprocess environments

Status: implemented after real scoped RED-to-GREEN regressions. Full checks,
independent reviews and publication must be renewed for the corrected head.

## Observed failure and scope

The integrator found that an earlier successful pre-push left the worktree index
containing fixture entries and staged deletions of other tracked paths. Physical
files were unchanged; the integrator verified their contents and modes against
the committed head and restored only the index before this follow-up. Passing
tests had not proved preservation of the hook caller's index.

This correction touches only this task's Git commands, tests, documentation and
evidence. It changes no hook, allowlist, dependency, security policy or external
task. The Owner's primary worktree and local research edits remain untouched.

## Tight reproducer and diagnosis

Command: `pnpm exec vitest run tools/docs-check/git-environment.test.ts`.
All inherited Git selectors in this test point exclusively to unique disposable
sentinel repositories; the real worktree index is never passed to a child.

The first real RED run changed the sentinel index SHA256 after invoking the
unchanged `run.test.ts` and `targets.test.ts` in a child Vitest process with only
an inherited `GIT_INDEX_FILE`. A repeated run reproduced that failure. A separate
full-selection case redirected those fixture tests to the sentinel repository.
The actual CLI, invoked in another repository with inherited repository, index,
object and config variables, reported the sentinel's missing document instead of
the requested fixture's broken README link. All three regression cases were RED.

The competing explanations were inherited index selection during fixture writes,
inherited repository selection during inventory reads, and concurrent index
contention. The deterministic disposable reproducer identified the first two;
removing only that environment inheritance made the same probes pass without
changing concurrency or weakening their content assertions.

## Correction and proof

All four fixture Git commands and the production `git ls-files` call now reuse
`isolatedGitEnvironment` from the repository's existing helper. It removes every
inherited `GIT_*` variable, then sets the existing noninteractive/system-global
config isolation values. No second deny list is introduced. PATH, HOME and other
non-Git toolchain settings remain available.

The real fixture tests pass in both index-only and full-selection child contexts.
The sentinel index hash, configuration bytes and tracked inventory stay unchanged.
The actual CLI produces exactly the clean-environment baseline diagnostics and
its own fixture inventory remains correct. All three probes are GREEN; temporary
nodes are removed in `finally` blocks and no debug instrumentation was added.

Scoped verification: 47 tests in 14 files passed, including the unchanged shared
helper's environment-denial test; the 150-document fixture took 892 ms. Both tools
and tests TypeScript checks, scoped ESLint and the actual documentation checker
passed (0 errors, 40 existing warnings). These checks do not replace renewed full
verification, independent review or pre-push for this changed head.

The reusable subprocess boundary, rather than global environment mutation, keeps
the protection local to every Git call and prevents the same hook inheritance
from escaping a future fixture or silently selecting a different inventory.
