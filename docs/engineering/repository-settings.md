# Repository settings and operator audit

This is the target configuration, not a claim that it is deployed. The Owner
applies settings through GitHub's UI; this task supplies no admin credential and
never applies rulesets or settings. Run `pnpm settings:audit` locally after setup
and monthly, using your existing `gh auth` session. Exit 0 means every observable
control matched; exit 1 means drift or an unknown control. `--allow-unknown` only
acknowledges unreadable/manual controls for this run; it never ignores known drift.
The audit refuses CI execution, accepts only GET, paginates metadata, suppresses
raw API errors and never reads secret values. `--repo owner/name` selects another
GitHub.com repository. A 403/404, rate limit, malformed reply or pagination limit
is unknown and cannot silently pass.

## Branches, reviews and releases

`master` is the actual default (ADR 0029). The logical production ruleset is
called `main` and targets `~DEFAULT_BRANCH`, so protection follows a deliberate
future rename. `expected.json` still expects `master`; this task does not rename
it. `DEVELOP` is the integration branch explicitly requested by the Owner. Every
task starts from the latest DEVELOP and merges back through a reviewed PR. Neither
branch is automatically deployed or promoted to production by merging a task.

The table's API paths are relative to `repos/OWNER/REPO`. Verify each with
`gh api --method GET <path>`; list rulesets with `/rulesets`, then inspect
`/rulesets/ID`. Settings > Rules > Rulesets is the UI for all rules below.

| Setting / exact target | Why and consequence if wrong | Verification |
| --- | --- | --- |
| `main`: branch target `~DEFAULT_BRANCH`, active, excludes empty, bypass actors empty | Administrators also pass the gates; a bypass permits compromised credentials to skip review. Emergency changes must visibly edit the ruleset and be reverted. | `/rulesets/ID`: target, conditions, enforcement, bypass_actors |
| `DEVELOP`: branch target `refs/heads/DEVELOP`, same gates and empty bypass | Integration must not become an unprotected route to production. | `/rulesets/ID` |
| PR required, conversations resolved, stale approvals dismissed, squash only | Direct pushes and stale review otherwise defeat review. | pull_request parameters |
| Normal phase: 1 approval, code-owner review, latest push approved by another person | An independent maintainer must approve the actual current code. | pull_request parameters |
| Single-maintainer exception: 0 approvals, no mandatory code-owner/latest-push approval | GitHub cannot let an author approve their own PR. ADR 0029 allows this temporary exception; the Owner requires independent code/spec reviews before an authorized merge. Add a second maintainer, then change all three values in expected.json and rulesets together. | same parameters; audit checks the explicit current profile |
| Checks `ci-success`, `secrets`, `dependency-review`, `pr-gate`; strict up-to-date true | Missing/renamed checks must block merge. `pr-gate` is future OSS003 and audit reports its absence now. | required_status_checks; local workflow cross-check |
| Linear history, deletion blocked, non-fast-forward blocked, signatures required | Preserve reviewable history and GitHub-verified squash commits; no force-push to destinations. | required_linear_history, deletion, non_fast_forward, required_signatures rules |
| `task/*`: no automatic deletion; no deletion by other writers, rebase only by creator where supported | Claims must survive. Native creator-specific rules are unavailable: retain branches (deletion blocked for everyone), limit write access and permit writer rebase only with an exact force-with-lease. No creation restriction so writers can claim. | task ruleset; repo delete_branch_on_merge false; operator review of rebase actor |
| `v*-creation`: tag creation restricted, admin repository-role bypass only | A writer must not publish a release tag. The bypass applies only to creation. | separate tag creation ruleset |
| `v*-immutable`: updates and deletion blocked, no bypass | Even admin creation rights must not rewrite published releases. | separate immutable tag ruleset |
| Only maintainers merge; auto-merge off; squash on, merge/rebase off, squash commit title `PR_TITLE` | Repository permissions and PR review process restrict merge authority. Native write access also grants merge capability: a PAT cannot be restricted to task refs by scope alone. | Settings > Collaborators / General > Pull Requests; `/collaborators?affiliation=all`, repo merge fields |

GitHub Free supports branch/tag rulesets for public repositories; private rulesets
need Pro/Team/Enterprise. Evaluate mode and advanced organization policies require
Enterprise. This public personal repository does not have organization base-role
or organization 2FA enforcement. These remain manual/unknown, with compensating
controls: only the Owner is a writer, the Owner enables 2FA, no broad bot/admin
credentials, and all destination protections apply without bypass. If it moves to
an organization, require base `read`, maintainers `maintain`, and organization 2FA
for everyone with write; audit the organization settings and collaborator roles.

## Actions and security

UI: Settings > Actions > General, Settings > Advanced Security, and
Settings > General. These targets do not grant a fork permission to run on a
self-hosted machine: the trusted default-branch isolation workflow and restricted
runner provisioning remain separate mandatory boundaries (SETUP006/021).

| Exact target | Why / consequence if wrong | GET verification |
| --- | --- | --- |
| Actions enabled; selected actions only; GitHub-owned actions allowed; verified creators false; exact SHA entries derived from every `uses:` in workflows and composite actions | Prevent an unreviewed third-party action from receiving workflow authority. Local actions are checked but do not enter the remote allow-list. | `/actions/permissions`, `/actions/permissions/selected-actions`; local workflow inventory |
| Full-SHA pinning required where available | Mutable tags can change without review; source inventory always rejects unpinned remote actions even if plan lacks native enforcement. | sha_pinning_required in `/actions/permissions` |
| Default token `read`, Actions creating/approving PRs false | Compromised PR code cannot write or approve itself by default. Explicit workflow job elevation still needs review. | `/actions/permissions/workflow` |
| Outside contributor approval `all_external_contributors` | Every outside contributor needs maintainer admission. Approval is not proof of code safety. | `/actions/permissions/fork-pr-contributor-approval` |
| Fork write tokens false, secrets/variables false | Prevent fork code from exfiltrating credentials. Public repositories do not expose the private-repo policy endpoint: report unknown, verify public fork semantics plus actual workflow evidence. Never enable `pull_request_target` head execution. | `/actions/permissions/fork-pr-workflows-private-repos` (private repos only) |
| Logs 90 days; artifact uploads at most 30 days | Bound retained potentially sensitive build data. GitHub has one repository retention ceiling; use 90 there and <=30 per upload step. Existing 90-day SBOM upload is reported as drift and belongs to SETUP007, not silently changed here. | `/actions/permissions/artifact-and-log-retention`; local upload-artifact with.retention-days |
| Secret scanning and push protection enabled | Prevent published credentials; scanner findings still need incident response. | repository security_and_analysis fields |
| Dependabot alerts, security updates, dependency graph on | Vulnerabilities and dependency review otherwise disappear. Version updates remain Renovate's responsibility. Graph UI has no documented REST read flag; report unknown and verify UI plus a successful real dependency-review run. | `/vulnerability-alerts` (204); `/automated-security-fixes`; Settings > Advanced Security > Dependency graph |
| Private vulnerability reporting enabled | Give researchers a private disclosure path before public issues. | `/private-vulnerability-reporting` |
| CodeQL default setup optional; sponsorship Owner decision | No fabricated pass for an optional policy; OVE_OSS007 decides scanning. | Settings > Advanced Security / General |
| Issues and Discussions on; Wiki and Projects off; forks allowed; default master | Keep one reviewed source of truth for project documentation and public contribution. | repository has_issues, has_discussions, has_wiki, has_projects, allow_forking, default_branch |

## Release environment and secret boundaries

UI: Settings > Environments > release. Require the Owner
`wojciechlesniak` as reviewer, zero wait timer, admin bypass false, selected
**tag** policy `v*` only (no branch policy). Self-review prevention is false for the
existing single-maintainer phase: the Owner must be able to approve a release they
started. Restore true with a second release maintainer. Protected environments and
required reviewers are available for public repositories on Free; private plans
have different availability. Unavailable review protection blocks production
release; ad-hoc dry runs have no environment or secrets (SETUP014).

Verify `/environments/release`, `/environments/release/deployment-branch-policies`
and `/environments/release/secrets`. Required secret names from SETUP014 are:
`APPLE_DEVELOPER_ID_P12_BASE64`, `APPLE_DEVELOPER_ID_P12_PASSWORD`,
`APPLE_SIGNING_IDENTITY`, `APPLE_API_KEY_P8_BASE64`, `APPLE_API_KEY_ID`,
`APPLE_API_ISSUER`, `APPLE_TEAM_ID`. Inspect names only. No other environment may
hold secrets; repository `/actions/secrets` allow-list is empty. Missing release
secrets block production release; never add placeholders just to pass an audit.
Actual isolation on the release SHA and signing/notarization remain release gates.

## Labels and least privilege

`tools/repo-settings/labels.json` specifies every task-required name, color and
description plus the existing `lint-config-change` approval control. Run
`pnpm settings:labels` for a read-only plan. Only explicit `--apply` allows POST
(create) and PATCH (metadata update); DELETE is never implemented. Existing extra
labels, including backlog area/priority labels, are reported and retained. The
security label is for public tracking only after disclosure. This task does not
apply labels or settings; a write failure stops the label tool and a rerun safely
recomputes remaining operations.

The audit always reports organization/2FA and dependency-graph manual controls as
unknown because REST cannot prove the personal account security posture. A fully
configured personal repository therefore needs `--allow-unknown` plus documented
Owner verification; it cannot honestly return a strict green result from API
metadata alone. Known drift still fails. This is an observability limitation, not
an automatic waiver or an applied change.

An agent should use a dedicated GitHub App or fine-grained token limited to this
repository, Contents write and Pull requests write, Metadata read; no
Administration, Secrets, Environments or tag-bypass role. Add Issues write only
for an explicit issue-management job. Fine-grained PAT permissions do not restrict
Contents write to `task/*`; protected branch/tag rulesets supply that boundary.
The operator audit uses their existing session and may need Administration read,
Actions read, Environments read and Secrets read (names only) to observe controls.
Never store an admin token in CI, print `gh auth token`, or publish HTTP debug logs.

## First-time bootstrap

1. Create the public repository and confirm the intended default branch.
2. Push reviewed workflows and run hosted CI/security on the actual default;
   promote trusted isolation policy separately from DEVELOP when reviewed.
3. Add the labels after reviewing the dry run. Keep all existing extra labels.
4. Wait for all required jobs, including future OSS003 `pr-gate`, to exist and
   pass; enabling a nonexistent required check deadlocks merges. Never remove a
   target check merely to make the audit green.
5. The Owner applies production, DEVELOP, task and separate tag rulesets; verify
   the single-maintainer profile and no production/integration bypass actors.
6. Apply Actions/security/features policies and inspect the real audit output.
7. Create `release` with Owner reviewer and v* tag-only deployment restrictions.
8. Add Apple credentials last, only after protected environment and real isolation
   infrastructure are ready. Re-run audit and record output. Release stays blocked
   without credentials, exact-SHA escape evidence or successful signing.
9. Obtain a separate outside-contributor fork PR, run real hosted CI/security,
   record token permissions/no-secret behavior and denied self-hosted admission.
   SETUP018 cannot be marked done on fixture/static checks alone.

## Observed state and outstanding evidence

Read-only inspection on 2026-10-16: no rulesets; master has no legacy protection;
merge/rebase methods enabled; Discussions off; Wiki/Projects on; allowed actions
all; SHA policy off; fork approval only first-time contributors; no release
environment; repository secrets empty; security updates and private vulnerability
reporting off. Secret scanning/push protection and token-read defaults are enabled.
Fork list is empty and no external-fork PR was found (all states). No settings,
labels, accounts, runners or secrets were changed by this task. The actual audit exited 1; the label dry run exited 0 and planned 18 metadata
changes while retaining extras. The 14 focused tests, strict TypeScript and
ESLint checks passed. No real label apply was performed. OSS003 `pr-gate` and the actual external-fork run are still
missing; the implementation is ready for review, operational acceptance is open.

Primary references (verified 2026-10-16):
[Rulesets REST](https://docs.github.com/en/rest/repos/rules),
[Actions permissions REST](https://docs.github.com/en/rest/actions/permissions),
[Environments REST](https://docs.github.com/en/rest/deployments/environments),
[Ruleset availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets),
[Environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments),
and [Fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens).
