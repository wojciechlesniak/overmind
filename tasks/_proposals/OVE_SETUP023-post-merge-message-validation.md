# OVE_SETUP023: verify complete squash messages before integration

## Observed failure

[PR #955](https://github.com/wojciechlesniak/overmind/pull/955) merged reviewed
head `7822f3114955cc6164c2a810147de6c560b7e4b7` into DEVELOP as squash commit
`5d0c9c9a03636fd83bd709433d412741386cb709`. Their Git trees are identical.
All final pull-request checks and both independent reviews had passed.

The integrator supplied a new squash message to GitHub without first checking
its complete body with the existing repository commitlint configuration. One
body line exceeded 100 characters. The subsequent
[DEVELOP CI run 39157020228](https://github.com/wojciechlesniak/overmind/actions/runs/39157020228)
therefore failed `commits` and its dependent `ci-success` job. Formatting, lint,
typecheck, all three test shards, test-merge, build, architecture, licenses,
audit, configuration integrity and workflow validation succeeded. The separate
[Security run 39157020236](https://github.com/wojciechlesniak/overmind/actions/runs/39157020236)
succeeded. This is a real historical CI failure, not a passing run.

## Correction and integration preflight

Preserve the published DEVELOP history and the failed run. Do not force-push,
change the commit policy, waive its checks or relabel the failed run as passed.
This documentation-only follow-up records the incident and makes the existing
validation part of the integrator's next merge operation:

1. Prepare the exact English Conventional Commit subject and body in local files.
2. Construct the complete message from that subject, a blank line and the exact
   body file that will be passed to GitHub. Retain a task reference and wrap body
   and footer lines at the existing 100-character limit.
3. Run the real `pnpm exec commitlint --edit <complete-message-file>` from the
   installed isolated checkout, using its unchanged repository configuration.
   Retain the actual exit code and SHA-256 hashes of all three files. A failure
   blocks that merge; a shell length check alone is not sufficient evidence.
4. After successful exact-head tests, security checks, independent reviews and
   hosted checks, pass those exact subject/body bytes to `gh pr merge` with
   `--match-head-commit`. Verify their hashes again immediately before the call.
5. Verify the resulting DEVELOP commit message and hosted post-merge checks.
   Preserve and investigate any failure before further integration.

This changes no production code, tests, dependency, hook, workflow or policy.
The existing tool is the validator; no new parser or merge framework is added.
The malformed historical commit message cannot be edited by a later source
commit. Its nonconformance and failed run remain visible. Fresh pull-request and
post-merge checks must validate this follow-up's own exact message and head;
they do not retroactively make the historical run successful.

## Scope of the remaining task

This follow-up does not accept any unfinished ADR, ownership, composition or
architecture task. The default task-finish PR-title issue remains separately
recorded in `OVE_SETUP023-pr-title-policy.md` for its owning task.
