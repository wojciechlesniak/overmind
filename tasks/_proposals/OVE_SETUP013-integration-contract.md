# SETUP013 repository integration contract

The Owner authorized sequential implementation, tests/review and merges through
DEVELOP. The task's generic main/origin/main references therefore mean the
integration branch DEVELOP here. Task tools will document and use that branch;
they will not derive their base from whichever task branch happens to be current.

Pre-agreed test seams are the public library API in TASK.md section 5.2 and the
claim/next/status/release/finish/cleanup commands in sections 5.3–10. Section 12
already specifies unit and real temporary-bare-repository integration tests for
these interfaces. The approved backlog test plan is the seam agreement for TDD;
no internal implementation methods or production credentials are test seams.

Necessary shared integration adds task:release/task:cleanup to root package.json
(explicit task scope). AGENTS.md links the implemented task tools guide and removes
its obsolete manual-claim availability statement, as its Maintenance rule requires.
The agent guard's fixture includes that new linked document, without policy or
assertion changes. No dependency or package is added. Existing git-fixture
environment isolation is reused for temporary repositories.

Real repository hooks require installed dependencies before the first claim
commit/push. Installation will therefore run before those hooks when enabled,
rather than after the atomic push; it remains frozen and never bypasses hooks.
--install=false still performs no installation, and any hook failure is reported.
An ISO time and random claim nonce make simultaneous claim commits distinct, so
the empty expected remote ref cannot become a misleading up-to-date push.

The existing backlog contains 16 BOARDUI task IDs although its documented CLI
grammar permits only 2–6 area characters. Read-only metadata loading must retain
these existing tasks; command input keeps the specified 2–6 grammar. No automatic
renaming or widening of mutating command input is introduced. The canonical-ID
inconsistency is recorded for the task linter/index owners (SETUP022/023).

No automatic cleanup may discard uncommitted/unpushed work or credentials.
Release's maintainer override changes who may release an otherwise empty claim;
it never authorizes deleting additional commits. Remote deletion uses the exact
reviewed ref value as a lease. Cleanup never deletes remote branches. --done
fails closed if exact-head CI and checked acceptance cannot be verified.

Stale locks use O_EXCL generations. A dead owner's record older than ten minutes
is left in place and the next numbered lock is attempted. Unlinking a stale path
would allow two reclaimers to delete a fresh owner's replacement between check
and unlink. A live PID always blocks takeover, even after ten minutes. Only the
current operation removes its own token-verified generation; malformed records
fail closed and 256 retained generations require manual inspection.

The next-command acceptance criterion explicitly includes unblocking power. Within
the detailed priority/layer ordering, direct unfinished dependent count therefore
breaks ties before size and ID. Conflict-risk candidates always sort last. This
resolves the task's two slightly different ordering descriptions explicitly.

Independent review found and reproduced two lifecycle defects at 28b7688. Release
now proves the claim parent's ancestry in fetched DEVELOP, so an implementation
commit before a status-only claim cannot be deleted, including by an override.
The real default-install two-clone race also covers root and nested node_modules.
A bounded in-memory receipt fingerprints only this invocation's installation
artifacts. Automatic loser cleanup requires unchanged HEAD, clean tracked/untracked
work and an identical receipt. Unknown/changed ignored files, hook-produced caches,
unavailable inventory or cleanup failure preserve local state and explicitly report
inspection with lost-race exit3. This follows the task's no-data-loss rule; evidence
does not claim unconditional cleanup with the repository's full hook output set.
There is no general node_modules, build-cache or ignored-file exemption.

The bounded regular-file reader also rejects FIFO inputs before opening them.
A real FIFO child-process regression first reached its timeout; the corrected
reader returns invalid-input exit4 without waiting for a writer. O_NONBLOCK plus
the post-open regular-file check preserves that property if the path is swapped.

The first full post-review run passed lint, types and 331 unit tests, but two
multi-step real-Git lifecycle scenarios exceeded Vitest's default five-second
test budget under concurrent builds. A retry exposed the same budget issue in
two real two-install races. Both lifecycle and installation-race suites now use
a bounded 30-second per-test fixture budget; assertions and production subprocess
limits are unchanged. Failed runs remain recorded and are not counted as passing
full checks. Installation inventory also opens files nonblocking and verifies
their regular-file type after open, preventing a file-to-FIFO swap from blocking.

The new real-Git/install scenarios exposed an unbounded integration-file worker
pool: concurrent engine subprocess fixtures also exceeded their unchanged budgets.
The integrator authorizes the single shared `vitest.int.config.ts` change to cap
file workers at two, matching the existing unit-suite resource limit. Test cases,
assertions, retries, subprocess limits, coverage and security gates are unchanged.
Heavy full-suite runs across task worktrees are coordinated serially as well.

The first pre-push after the passing full check exposed a pre-existing collector
race in `tools/skeleton.test.ts`: it recursively traversed ignored `.cache`
while the binary-installer fixtures created and removed temporary cache entries.
The integrator authorizes excluding exactly `.cache` from that collector. It is
not a workspace path in pnpm-workspace.yaml; all package-count, dependency,
placeholder and supply-chain assertions remain unchanged. The failed push did
not update the remote claim. The normal pre-push suite must pass on retry.
