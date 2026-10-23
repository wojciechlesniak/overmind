---
id: OVE_SETUP018
title: GitHub repository settings, rulesets, labels and a read-only settings audit
area: SETUP
kind: security
size: S
priority: P0
mvp: true
status: in_review
depends_on: [OVE_SETUP006]
soft_depends_on: [OVE_OSS003, OVE_SETUP007, OVE_SETUP014]
provides: ["lib:repo-settings", "lib:repo-labels", "lib:branch-protection-spec"]
needs: []
owns:
  - tools/repo-settings/**
  - docs/engineering/repository-settings.md
reads: [".github/workflows", ".github/CODEOWNERS"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 17", "SPECIFICATION 19"]
adr_refs: [13, 25]
---

# OVE_SETUP018: GitHub repository settings, rulesets, labels and a read-only settings audit

## Implementation claim

Claimed-By: Codex ove016_settings
Claimed-At: 2026-10-16T19:13:30Z

## 1. Summary

Specify, as a checkable document plus a read-only audit script, every GitHub setting that the CI, the PR gate, the release and the contribution model rely on: branch and tag rulesets, required status checks, Actions permissions and fork policies, security features, environments, and the label set. Settings are applied once by the Owner; the audit detects drift without ever needing an admin token in CI.

## 2. Context

ADR 0025: every PR passes CI and automatic review and a human merges; PRs are accepted only for accepted issues or trusted contributors. Many protections live in repository settings, not in files, so they cannot be reviewed in a PR. This task makes them explicit. The required check names are defined by OVE_SETUP006 (`ci-success`), OVE_SETUP007 (`secrets`, `dependency-review`), OVE_OSS003 (`pr-gate`). Releases are gated by environment `release` (OVE_SETUP014).

## 3. Scope (in)

- `docs/engineering/repository-settings.md`: the normative settings list with the reason for each, and the click-path/`gh api` equivalent.
- `tools/repo-settings/expected.json`: machine-readable expected state.
- `tools/repo-settings/audit.ts` (`pnpm settings:audit`): read-only comparison using `gh api` with the caller's credentials.
- `tools/repo-settings/labels.json` and `tools/repo-settings/sync-labels.ts` (`pnpm settings:labels`, dry-run by default, `--apply` explicit).

## 4. Out of scope

- Applying branch protection automatically from CI (it would need an admin secret; forbidden).
- CODEOWNERS file and PR/issue templates: OVE_OSS003.
- Workflow files: OVE_SETUP006, 007, 014.

## 5. Detailed requirements

1. **Branch ruleset `main`:** require pull request; required approvals 1 with review by a code owner; dismiss stale approvals on new pushes; require approval of the most recent push by someone other than the pusher (when more than one maintainer exists; documented exception for the single-maintainer phase); require conversation resolution; required status checks `ci-success`, `secrets`, `dependency-review`, `pr-gate` with "require branches to be up to date"; require linear history; block force pushes; block deletions; restrict who can merge to maintainers (merge is human, ADR 0025); auto-merge disabled; allowed merge method only **squash** (PR title becomes the Conventional Commit header, validated by commitlint); merge commits and rebase merges disabled; commit signing required is OPEN (14.2); bypass list empty (even admins follow the rules; the Owner's emergency path is temporarily editing the ruleset, which leaves an audit log entry).
2. **Branch ruleset `task/*`:** branches may be created by anyone with write access (the claim mechanism of OVE_SETUP013); deletion by anyone except the creator is blocked; repository setting "automatically delete head branches" is OFF (branches are never auto-deleted, herdr rule); force-push is allowed only for the branch creator (rebase flow) if the plan supports it, otherwise allowed for write access with `--force-with-lease` convention.
3. **Tag ruleset `v*`:** only repository admins may create; update and deletion blocked (immutable releases).
4. **Actions settings:** default `GITHUB_TOKEN` permissions read-only; "Allow GitHub Actions to create and approve pull requests" OFF; allowed actions limited to GitHub-owned plus an explicit allow-list from the workflows (the audit derives the list from `uses:` in `.github/workflows` and `.github/actions` and compares); policy "require actions to be pinned to a full-length commit SHA" ON where available; fork pull request workflows: require approval for ALL outside collaborators; "Send write tokens to workflows from fork pull requests" OFF; "Send secrets and variables to workflows from fork pull requests" OFF; workflow retention for artifacts 30 days, logs 90 days.
5. **Security features:** secret scanning ON; push protection ON; Dependabot alerts and security updates ON (version updates are Renovate's job); dependency graph ON; private vulnerability reporting ON (referenced by SECURITY.md, OVE_OSS002); code scanning default setup optional (OPEN, 14.3).
6. **Environments:** `release` with required reviewers (the Owner), deployment restricted to tags `v*`, no wait timer, secrets listed in OVE_SETUP014; no other environment holds secrets. Repository-level secrets must be empty (audit fails if any exist beyond an allow-list, initially empty).
7. **Repository features:** Issues ON (open to all, ADR 0025), Discussions ON (ideas, Q&A), Wiki OFF, Projects OFF, Sponsorships per Owner. Default branch `main`. Forking allowed. Base permission for organization members `read`; maintainers get `maintain`; two-factor authentication required for everyone with write.
8. **Labels (`labels.json`):** `accepted` (maintainer approved issue, green), `needs-triage`, `bug`, `enhancement`, `security` (never used publicly for undisclosed issues), `task` (backlog tasks), `good first issue`, `help wanted`, `config-change` (red, permits changes to sensitive files, OVE_SETUP020), `hooks-change`, `run-isolation` (permits the self-hosted escape job, OVE_SETUP006), `gate:closed` (PR closed by the gate, OVE_OSS003), `trusted` (informational), `dependencies`, `dependencies-major`, `docs`, `translation`, `blocked`, `wontfix`, `duplicate`. Each with color and description. `sync-labels.ts` creates/updates missing labels; it never deletes labels (reports extras).
9. **Audit script.** `pnpm settings:audit [--repo owner/name]`: calls `gh api` endpoints (repository, rulesets, actions permissions, environments, secrets list names only, security_and_analysis, labels) and compares with `expected.json`; prints a table `setting | expected | actual | status`; exit 1 on drift; read-only (HTTP GET only, enforced by a wrapper that rejects other methods); needs `gh auth` with a token the user already has; never prints tokens; never runs in CI (documented; a scheduled issue reminder "run settings audit monthly" may be created by the Owner). Endpoints that need admin and return 403 are reported as `unknown` (not silently passing) and counted as drift unless `--allow-unknown`.
10. **Document structure:** each setting has: where (UI path), exact value, why (risk addressed), how to verify (`gh api` command), and consequences if wrong. Includes a first-time setup checklist ordered so the pipeline can be bootstrapped (create repo, push, enable rulesets after first green CI to avoid deadlock, create environment, add secrets last).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

The set of required check names is read from the workflow files by the audit (job ids/names), not hard-coded twice: `expected.json` lists names, a test verifies that each exists in the workflows. Labels are used by OVE_SETUP006 (`config-change`, `run-isolation`), OVE_SETUP020, OVE_OSS003.

## 8. Architecture and code placement

`tools/repo-settings/` (TypeScript) with pure comparison logic (`compare(expected, actual)`) and a thin `gh` wrapper behind an interface for tests. Documentation under `docs/engineering/`.

## 9. Security and safety

- Settings are the last line of defence for: fork PR secrets, workflow tampering, unreviewed merges, tag spoofing, and release approvals. The document therefore explains each in terms of the attack it prevents (for example malicious `pull_request_target`, poisoned cache, leaked signing key, direct push by a compromised agent token).
- The audit is read-only and uses the operator's own session; the repository holds no admin credentials.
- Agents and bots must have the minimum permission: a dedicated GitHub App or fine-grained token with `contents: write` limited to `task/*` branches and `pull_requests: write` for agents; no admin; no tag creation; documented in the settings doc (fine-grained token scopes list).
- No branch bypass for admins ensures that even a compromised maintainer token has to alter rulesets visibly.
- Secrets are never listed with values (names only).

## 10. Errors and edge cases

- Free-plan limitations (some rulesets, required reviewers, merge queue): the doc marks each setting as `available on: all | team | enterprise`; where unavailable, the compensating control is stated (for example a CI check or process).
- Rulesets enabled before the first workflows exist deadlock merging: setup order in requirement 10.
- A required check is renamed in a workflow: the audit's cross-check fails.
- Single-maintainer phase: "approval from someone other than the pusher" cannot be satisfied; the doc records the temporary exception and the plan to add a second maintainer.
- API rate limits: audit batches calls and reports partial failures.
- Labels already existing with different colors: `sync-labels` updates metadata only.

## 11. Acceptance criteria

- [ ] A real PR from a separate outside-contributor fork runs hosted CI with a read-only token and no secrets and cannot start a self-hosted isolation job; record actual workflow evidence.

- [x] `docs/engineering/repository-settings.md` lists every setting in requirements 1-8 with value, rationale and verification command.
- [ ] `pnpm settings:audit` against a correctly configured repository exits 0; flipping one setting (for example allowing merge commits) makes it exit 1 naming the setting.
- [x] The audit sends only GET requests (unit test on the wrapper) and prints no token.
- [ ] `expected.json` required checks all exist as jobs in `.github/workflows` (test).
- [ ] `pnpm settings:labels` dry run lists labels to create; `--apply` creates them.
- [x] The doc includes the bootstrap order and the single-maintainer exceptions.

## 12. Test plan

Unit tests for `compare`, label diff, HTTP-method guard, and workflow-job cross-check (fixture workflows). A recorded-response test suite (JSON fixtures of GitHub API replies) for the audit. Manual: the Owner runs the audit after applying settings and records the result in the PR. Commands: `pnpm test -- tools/repo-settings`, `pnpm settings:audit`.

## 13. Parallelization notes

Parallel with OVE_OSS003. Hotspot: `expected.json` changes whenever a new workflow adds a required check; those tasks add their check name by proposal or by editing the file as an additive line (owned here; additive edits allowed with a note).

## 14. Open questions and assumptions

1. ASSUMPTION: single maintainer (the Owner) at start; the process allows self-review exception until a second maintainer exists.
2. Open question: require signed commits? Agents commit through git with their own identities; SSH-signing for agents is possible but adds key management. Default: not required on `task/*`, required on `main` through GitHub's squash-merge verified signature.
3. Open question: enable GitHub code scanning (CodeQL default setup) and Copilot-like automatic review; decision in OVE_OSS007.
4. ASSUMPTION: the repository lives under a personal account or an organization with rulesets available; otherwise compensating controls apply.


### Owner-approved acceptance sequencing (2026-10-15)

The Owner-approved SETUP006 sequence transfers real outside-contributor fork verification here, after a separate writable fork/account is available. Static workflow checks and mocked gate/API tests are foundation evidence only. Verify the deployed CI/security workflows, actual token permissions and denied self-hosted execution without exposing token or secret values.

Source: tasks/_proposals/OVE_SETUP006-acceptance-sequence.md.


### Implementation and operational acceptance (2026-10-16)

The implementation is ready for independent review; this task is not done.
`tools/repo-settings/` supplies the exact expected state, labels, paginated GET-only
operator audit, pure comparison/label planning, explicit-only label writes, and
recorded-response/negative tests. No dependencies or live settings were changed.
Root script additions are coordinated in
`tasks/_proposals/OVE_SETUP018-shared-integration.md`.

Actual local audit exited 1 on repository drift; label dry run exited 0 and planned
18 creates/metadata updates, retaining all extras. No `--apply` was run. GitHub
GET inspection found no forks and no external-fork PRs in any state. A real fork
run, Owner-applied settings and reviewed live audit remain required. `pr-gate`
is not yet delivered by OSS003, and the inventory reports that missing required
job as drift. A fully configured personal repository still needs explicit Owner
verification of manual 2FA/permissions and dependency graph controls; strict API
mode cannot fabricate those observations. `--allow-unknown` cannot waive known
setting drift, missing labels or malformed returned metadata.

### Integration refresh and regression evidence (2026-10-23)

The existing implementation was rebased on DEVELOP without changing its scope.
The package-script conflict preserves the current Tauri/ADR/agent commands and
adds only the two settings commands. The original three commits remain available
on the local recovery branch `codex/backup-setup018-20261023`.

Independent Standards and Spec reviews found that malformed paginated security
metadata could become waivable unknowns, while unavailable ruleset details were
misreported as known drift. Five new public-audit regression cases first failed;
the correction preserves malformed replies as non-waivable drift and ordinary
permission failures as unknown. All 19 settings tests subsequently passed.

Typecheck, lint and owned-source formatting passed. The verified tree secret
scanner reported zero findings and one existing Keychain warning. Two ordinary
full-suite attempts retained process-fixture failures, including the existing
30-second configuration-gate timeout; their unchanged scoped recheck passed.
The complete suite then passed all 1559 tests in 127 files with one worker,
unchanged timeouts, assertions, inventory and retry-zero policy. Ordinary push
hooks and fresh exact-head reviews remain required at publication.

The real GET-only audit still exited 1: 72 passes, 37 known drifts and 9 unknowns,
including the absent `pr-gate`. No live settings, labels or permissions were
changed. Outside-contributor fork evidence, Owner-applied settings, reviewed
manual controls and actual label application remain open; this task stays
in_review and its PR stays draft.
