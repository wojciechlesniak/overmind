# Continuous integration

CI uses Node from `.nvmrc`, integrity-pinned Corepack/pnpm and a frozen lockfile.
Run `corepack enable` and `CI=true pnpm install --frozen-lockfile` first. Commands
below run from the repository root. `pnpm check` runs the local verification suite,
including integration tests, merged coverage, workflow lint, licenses and audits;
it stops at the first failure. Event-specific commit and label checks run when
`GITHUB_EVENT_PATH`, `CI_BASE` and `CI_HEAD` are supplied. Normal local commits use
the Git hooks instead. Real container escape tests require the dedicated runner.

## Jobs and local reproduction

Times are planning estimates, excluding install and queue time; they are not
measurements of hosted Actions. The target for a typical PR is 12 minutes.

| Job | Local command | Estimate | Artifacts |
| --- | --- | --- | --- |
| plan | `GITHUB_EVENT_PATH=event.json GITHUB_SHA=<sha> GITHUB_OUTPUT=outputs pnpm exec tsx tools/ci/plan.ts` | <1 min | validated base/head and conditional job outputs |
| format-lint | `pnpm format:check && pnpm lint` | 1–3 min | logs |
| typecheck | `pnpm typecheck` | 1–3 min | `.tsbuild` cache restored by lockfile/ref |
| test (1–3) | `pnpm test:coverage --config vitest.ci.config.ts --shard=1/3 --reporter=blob --reporter=junit --reporter=github-actions --outputFile.junit=test-results/junit-1.xml` (repeat for 2 and 3) | 1–4 min each | native `.vitest/blob`, coverage, JUnit; 7 days |
| test-merge | After collecting all shard blobs: `pnpm exec vitest run --coverage --merge-reports=.vitest/blob` | <1 min | merged coverage; 7 days |
| build | `pnpm build && pnpm --filter @overmind/ui-kit --if-present run build:storybook` | 1–4 min | logs; build output stays in job |
| architecture | `CI_BRANCH=task/OVE_SETUP006 CI_BASE=origin/DEVELOP pnpm exec tsx tools/ci/architecture.ts` | <2 min | skipped tool/owner list or diagnostics |
| licenses | `pnpm check:licenses`; with Cargo manifest: `"$(pnpm exec tsx tools/pinned-bin/install.ts cargo-deny)" --manifest-path apps/desktop/src-tauri/Cargo.toml check licenses bans sources` | <2 min | license decision table |
| audit | `pnpm audit --audit-level=high --prod && pnpm audit --audit-level=critical`; with Cargo lock: `"$(pnpm exec tsx tools/pinned-bin/install.ts cargo-audit)" audit --file apps/desktop/src-tauri/Cargo.lock` | 1–3 min | audit diagnostics |
| commits | `GITHUB_EVENT_PATH=event.json CI_BASE=<base-sha> CI_HEAD=<head-sha> pnpm exec tsx tools/ci/commits.ts` | <1 min | commit and title diagnostics |
| config-integrity | `GITHUB_EVENT_PATH=event.json pnpm exec tsx tools/ci/config-integrity.ts` | <1 min | protected paths missing maintainer labels |
| workflow-lint | `pnpm exec tsx tools/ci/workflow-lint.ts` | <2 min | actionlint and zizmor diagnostics |
| rust | `cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --check && cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings && cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | 2–8 min | logs |
| desktop-e2e | `pnpm test:e2e && pnpm test:visual` in the digest-pinned Playwright image | 2–6 min | harness-owned evidence |
| ci-success | `CI_NEEDS='<job-result JSON>' CI_FULL=true pnpm exec tsx tools/ci/success.ts`; add `CI_RUST=true` / `CI_DESKTOP=true` for planned conditional jobs | <1 min | aggregate result |
| isolation/gate | Trusted default-branch dispatch, described below | <1 min | approved SHA or denied admission |
| isolation/escape | Revalidate approval, assert macOS >=26/arm64, then `pnpm test:escape`; cleanup uses captured absolute executables and `node tools/ci/isolation-cleanup.mjs /absolute/path/to/container` | <=30 min | `escape-evidence`, 7 days, excludes `.env*` |
| nightly/audit | Same Node/Rust audit commands | 1–3 min | logs |
| nightly/report | On failure only: opens/updates `ci: audit failure` through `gh issue` | <1 min | issue with workflow-run link |

`event.json` follows GitHub's webhook payload, validated at the input boundary.
`CI_NEEDS` maps job names to `{ "result": "success|failure|cancelled|skipped" }`.
Only planned exclusions (Draft full jobs, absent Rust/E2E harnesses) may be skipped.
Missing, failed or cancelled required jobs make `ci-success` fail.

Shards collect partial coverage without enforcing per-shard thresholds. The merge
job uses the unchanged root package thresholds. A subprocess regression creates
untested domain code and verifies that collection passes but merged coverage fails.
Current product packages contain placeholder barrels; 0/0 coverage does not prove
product behavior. Unit tests deny network access by default.

The root runner limits concurrent test-file workers to two, including within each
CI shard. Tooling regressions launch real compilers/package managers; an automatic
CPU-sized worker pool caused competing subprocess timeouts on the local host.
The same full suite passed with two workers. Fork isolation, zero retries and all
assertions/coverage thresholds are unchanged; see
`tasks/_proposals/OVE_SETUP006-test-worker-budget.md` for the measured comparison.

## Permissions and configuration

Every workflow defaults to `contents: read`, pinned runner images, explicit
timeouts and `set -euo pipefail`. Checkout does not persist credentials. Only the
nightly issue reporter elevates `issues: write`; the isolation gate additionally
reads Actions and PR metadata. CI has no secrets and permits only the documented
`MACOS_RUNNER` and `CI_STRICT_TOOLS` variables. Forks get hosted checks with a
read-only token. Cache writes occur only on a push to the actual default branch.

The actual default branch is `master`. CI also watches `main` and `DEVELOP`, while
nightly selection, trusted definitions and cache saving use GitHub's default-branch
metadata. Draft PRs run planning, format/lint, typecheck and the aggregate only.
Rust runs only when its manifest exists and relevant paths change; E2E needs both
desktop harness scripts. Missing foundation tools are listed with their owner;
`CI_STRICT_TOOLS=true` makes every missing tool fail. There are no retry/ignore-error
paths for failed checks or unavailable audits.

`config-change` is required for protected workflow, hook, lint, test, license and
binary pin configuration changes; hook configuration also needs `hooks-change`.
ESLint configuration edits also require `lint-config-change`, preserving the
OVE_SETUP003 approval rule for severity downgrades without brittle diff parsing.
Maintainers must inspect the diff before labeling. This is a merge guard, not an
immutable trust boundary: a PR can edit its workflow. OVE_SETUP018 must configure
required checks and reviewer/maintainer controls. Its required check is
`ci-success`; security/OSS owner tasks add their own workflow checks later.

GitHub's self-repository action syntax `$/.github/actions/setup` binds the composite
action to the workflow source. Actionlint 1.7.12 predates this spelling, so the
wrapper translates only local `uses` lines in temporary input. Zizmor checks the
original files with no security rule disabled. The single self-hosted-runner
finding is explicitly acknowledged because real Apple container tests require it.

## Isolation admission and staged operational acceptance

Do not provision an unrestricted self-hosted runner for this public personal repo.
OVE_SETUP021 must enforce access restricted to the trusted workflow (for example
an organization runner group or a private coordinator) and ephemeral disposal.
The repository currently has no registered runners. Hosted fake-CLI tests do not
prove container isolation, and no physical escape result is claimed here.

PR/merge-queue events run a hosted gate that denies direct self-hosted admission.
A maintainer instead dispatches `isolation.yml` **from the default branch** with
the same-repository PR number after successful hosted CI. The current PR must have
both `run-isolation` and `isolate-<full head SHA>` labels, freshly applied by a
writer. The gate checks actor permissions, repository, open state, current SHA,
successful CI, label actors and timestamps. Forks and stale approvals fail closed.
Approval requires every full hosted job to succeed exactly once; the cheap Draft
aggregate is insufficient. Drafts and zero/invalid PR numbers are rejected.
The latest label event includes removals, the PR is refreshed after reading its
history, and the trusted gate runs again after runner queueing before head checkout.
An empty PR number tests the default-branch SHA. Default-branch policy must first
be promoted before this mechanism is usable. Root must stage the trusted-branch
cleanup at `/opt/overmind-ci/isolation-cleanup.mjs` (root-owned mode 0555, protected
parents). Preflight checks its hash against the trusted checkout; always-run
cleanup rechecks that hash. Job-writable staging is rejected to prevent replacement
between hashing and execution. Only `ovm-ci-*` resources
are removed, followed by `container system stop`. Node and the container executable
are captured before head execution and must resolve through root-owned paths with
no group/other write permission, including all parent directories. Effective write
access is also denied for each component, covering macOS ACL grants. SETUP021 must
provision them accordingly; a writable tool cache fails preflight. Cleanup resets
shell/Node options, uses absolute system hash tools in an empty environment and
launches the captured Node/container paths with only the captured HOME and a system
PATH. Test-controlled PATH, RUNNER_TEMP and language options cannot redirect it.
This in-job cleanup is defense in depth. Root-controlled teardown and ephemeral
disposal in SETUP021 remain the boundary against hostile background processes or
a compromised job account; a same-user cleanup script cannot provide that boundary.

The Owner accepted manual trusted admission in place of direct automatic PR/queue
execution on 2026-10-15. The security rationale is recorded in
`tasks/_proposals/OVE_SETUP006-trusted-isolation-trigger.md`. A `workflow_run`
alternative was rejected by zizmor's high-severity dangerous-trigger check.
Release OVE_SETUP014 must require successful isolation on the exact release SHA;
missing runners or harnesses must block it.

The Owner explicitly declined license additions and a temporary MPL exception.
The original allow-list and empty exceptions are preserved. The Owner subsequently
requested compatible dependency replacements; see
`tasks/_proposals/OVE_SETUP006-license-compatible-tooling.md`. The current license
check passes without exclusions or metadata rewriting. The accepted foundation sequence keeps actual
boundary/fork/hardware evidence mandatory in ARCH002, SETUP018 and SETUP021 +
TEST007 respectively; those later tasks remain unfinished until it exists. Negative hosted probes are linked in PR #934:
#935 (failed test), #936 (lint), #937 (explicit GPL denial), #938 (high production
advisories); all are closed without merge. Their corresponding gates and aggregate
failed. The baseline license failure was independently present. Boundary-check,
fork-run and physical-isolation evidence remain outstanding.

On 2026-10-15 the Owner confirmed no dedicated CI Mac is available. GitHub's
[hosted-runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
lists macOS 26 but explicitly excludes nested virtualization on arm64, so changing
the runner label does not establish Apple container support. The acceptance ordering
conflict and the Owner-approved staged resolution are recorded in
`tasks/_proposals/OVE_SETUP006-acceptance-sequence.md`; it authorizes foundation acceptance while
preserving later operational criteria. It does not replace real escape evidence
with fake tests.

React code checks run through `pnpm lint:react` (also included in `pnpm lint`
and the staged TSX hook). ESLint 10 retains the strict TypeScript and other checks;
Oxlint supplies 14 explicit hooks/compiler rules for the two UI packages. Its
config requires both configuration approval labels, and nested configs are disabled.
Both ESLint and Oxlint suppression directives need a reason. DOM tests use Happy
DOM with script evaluation, external script/style/image/iframe loads and filesystem
HTTP requests disabled. Real-browser testing remains owned by Playwright tasks.

## Adding a job

Keep behavior in a typed tool; workflows call it. Add the job with a timeout,
least privilege, SHA-pinned actions and a version-pinned runner. Add it to
`ci-success.needs` and `tools/ci/success.ts`, and update the planned-exclusion tests.
Document its local command, expected time and artifacts here. Pin new binaries in
`tools/pinned-bin/lock.json`, verify publisher checksums and record dependencies.
Changes to the CI-owned workflow from other tasks require an ownership proposal.
Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, workflow lint
and the relevant negative probes before opening a PR.
