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
| isolation/escape | `container --version`, macOS >=26/arm64, `pnpm test:escape`; always `node tools/ci/isolation-cleanup.mjs` | <=30 min | `escape-evidence`, 7 days, excludes `.env*` |
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
Maintainers must inspect the diff before labeling. This is a merge guard, not an
immutable trust boundary: a PR can edit its workflow. OVE_SETUP018 must configure
required checks and reviewer/maintainer controls. Its required check is
`ci-success`; security/OSS owner tasks add their own workflow checks later.

GitHub's self-repository action syntax `$/.github/actions/setup` binds the composite
action to the workflow source. Actionlint 1.7.12 predates this spelling, so the
wrapper translates only local `uses` lines in temporary input. Zizmor checks the
original files with no security rule disabled. The single self-hosted-runner
finding is explicitly acknowledged because real Apple container tests require it.

## Isolation admission and outstanding acceptance

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
An empty PR number tests the default-branch SHA. Default-branch policy must first
be promoted before this mechanism is usable. Cleanup is copied from that trusted
branch and checksum-checked before always-run cleanup; only `ovm-ci-*` resources
are removed, followed by `container system stop`.

This manual admission differs from the requested automatic labeled-PR/queue run.
The security rationale and unresolved acceptance are recorded in
`tasks/_proposals/OVE_SETUP006-trusted-isolation-trigger.md`. A `workflow_run`
alternative was rejected by zizmor's high-severity dangerous-trigger check.
Release OVE_SETUP014 must require successful isolation on the exact release SHA;
missing runners or harnesses must block it.

The Owner explicitly declined license additions and a temporary MPL exception.
The original allow-list and empty exceptions are preserved. Actual development
dependencies violate it, so `licenses` and `ci-success` must remain red and this
task must not merge. See the declined proposal and `pnpm check:licenses` for the
exact package/version decisions. No scratch PR or hardware result is claimed
until its actual run is linked in the implementation PR.

## Adding a job

Keep behavior in a typed tool; workflows call it. Add the job with a timeout,
least privilege, SHA-pinned actions and a version-pinned runner. Add it to
`ci-success.needs` and `tools/ci/success.ts`, and update the planned-exclusion tests.
Document its local command, expected time and artifacts here. Pin new binaries in
`tools/pinned-bin/lock.json`, verify publisher checksums and record dependencies.
Changes to the CI-owned workflow from other tasks require an ownership proposal.
Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, workflow lint
and the relevant negative probes before opening a PR.
