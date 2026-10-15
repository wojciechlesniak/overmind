---
id: OVE_SETUP006
title: CI pipeline on GitHub Actions (lint, typecheck, test, build, boundaries, license, audit)
area: SETUP
kind: infra
size: M
priority: P0
mvp: true
status: done
depends_on: [OVE_SETUP001, OVE_SETUP002, OVE_SETUP003, OVE_SETUP004, OVE_SETUP005]
soft_depends_on: [OVE_SETUP008, OVE_SETUP013, OVE_SETUP021]
provides: ["lib:ci-pipeline", "lib:ci-setup-action", "lib:license-check", "lib:ci-required-check", "lib:pinned-bin"]
needs: []
owns:
  - .github/actionlint.yaml
  - .github/workflows/ci.yml
  - .github/workflows/isolation.yml
  - .github/workflows/nightly.yml
  - .github/actions/setup/action.yml
  - tools/check-licenses/**
  - tools/pinned-bin/**
  - tools/check-workflows.test.ts
  - deny.toml
  - docs/engineering/ci.md
  - tools/ci/**
  - vitest.ci.config.ts
  - .oxlintrc.json
  - tools/react-lint.test.ts
reads: ["package.json", "pnpm-workspace.yaml", ".nvmrc", "lefthook.yml"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 19"]
adr_refs: [13, 20, 25]
---

# OVE_SETUP006: CI pipeline on GitHub Actions (lint, typecheck, test, build, boundaries, license, audit)

## 1. Summary

Define the GitHub Actions workflows that gate every pull request: format/lint, typecheck, tests with coverage, build, architecture and contract checks, license policy, dependency audit, commit conventions and config-integrity checks on hosted Ubuntu and macOS runners, plus a separate isolation (escape-test) workflow that can only run on a self-hosted macOS 26 Apple-silicon runner. One aggregate job `ci-success` is the single required status check. All workflows are least-privilege and safe for pull requests from forks.

## 2. Context

ADR 0025: every PR passes CI and an automatic review; a human merges. SPEC 16 criterion 8 and ADR 0020: isolation escape tests are part of CI. Apple's `container` tool needs macOS 26 on Apple silicon (prototype: container 1.5.0). GitHub-hosted macOS runners are VMs; as of this writing there is no guarantee that a hosted image offers macOS 26 together with nested virtualization, which the `container` tool needs to start its lightweight Linux VMs. Therefore the isolation job is specified for a self-hosted ephemeral macOS runner (provisioning: OVE_SETUP021) and the rest of the pipeline must not depend on it. The repository is public and open to outside contributors (ADR 0025), so fork pull requests are a normal case and must never reach secrets or the self-hosted machine.

The Owner approved staged acceptance on 2026-10-15; tasks/_proposals/OVE_SETUP006-acceptance-sequence.md is authoritative. This foundation task proves hosted gates and fail-closed isolation wiring. Real physical isolation evidence belongs to SETUP021 + TEST007, boundary-violation evidence to ARCH002, and an actual outside-contributor fork run to SETUP018. Release still requires real isolation on the exact release commit.

## 3. Scope (in)

- Composite action `.github/actions/setup`.
- `ci.yml`, `nightly.yml`, `isolation.yml` as specified below.
- `tools/check-licenses/run.ts` + allow-list + tests; `deny.toml` for Rust crates.
- `tools/pinned-bin/` generic downloader for third-party binaries (`install(name)` reads `tools/pinned-bin/lock.json` entries `{name, version, assets:{platform:{url,sha256}}}`, downloads over HTTPS, verifies SHA-256, refuses on mismatch, caches in `.cache/tools/`); first users are `actionlint`, `zizmor`, `cargo-deny`, `cargo-audit`; OVE_SETUP007 adds `gitleaks` and `syft` entries to its own lock file `tools/secret-scan/gitleaks.lock.json` read through the same code.
- `docs/engineering/ci.md`: job table, how to reproduce each job locally, how to add a job.

## 4. Out of scope

- Secret scanning and SBOM jobs: OVE_SETUP007 (adds `security.yml`; its job names are part of the required set listed here).
- PR gate (closing PRs without accepted issues): OVE_OSS003 (`pr-gate.yml`).
- Release, signing, notarization: OVE_SETUP014 (`release.yml`).
- Branch protection and repository settings: OVE_SETUP018 (this task lists the required check names).
- Runner provisioning and hardening: OVE_SETUP021.
- Content of the test harnesses (Playwright, escape tests): OVE_TEST004, OVE_TEST005, OVE_TEST007; this task only calls their scripts.

## 5. Detailed requirements

1. **Global rules for every workflow.** Top level `permissions: { contents: read }`; jobs elevate only when needed and say why in a comment. `concurrency: { group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}, cancel-in-progress: true }` except on `main`. Every job has `timeout-minutes`. `defaults.run.shell: bash` with `set -euo pipefail`. Runner images are pinned versions, never `-latest`: `ubuntu-24.04` and `macos-15` (arm64) for the hosted macOS job; when a hosted macOS 26 label becomes available, change the label in one place (`env.MACOS_RUNNER` via a repository variable). All third-party actions are pinned to a full 40-character commit SHA with a trailing comment `# vX.Y.Z`; first-party `actions/*` follow the same rule. A test (`tools/check-workflows.test.ts`) fails when a `uses:` ref is not a SHA (local `./.github/actions/*` excluded) or when `pull_request_target` appears outside `pr-gate.yml`.
2. **Triggers of `ci.yml`.** `pull_request` (types opened, synchronize, reopened, ready_for_review, labeled), `push` to `main`, `merge_group`, `workflow_dispatch`. NOT `pull_request_target`. Draft PRs run the cheap jobs only (`format-lint`, `typecheck`).
3. **Composite action `setup`.** Inputs: none. Steps: `actions/checkout` is done by the job (with `persist-credentials: false`, `fetch-depth: 0` only where needed); the action runs `actions/setup-node` with `node-version-file: .nvmrc`, `corepack enable`, `pnpm install --frozen-lockfile` (fails if the lockfile would change), restores the pnpm store cache with key `pnpm-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}` using `actions/cache/restore`; saving the cache happens only on `push` to `main` (so a fork PR can never write a cache that main restores). Install scripts run only for the allow-listed packages (OVE_SETUP001); `lefthook` install is skipped by `CI=true`.
4. **Jobs in `ci.yml`** (runner, command):
   - `format-lint` (ubuntu): `pnpm format:check`, `pnpm lint`.
   - `typecheck` (ubuntu): `pnpm typecheck`, cache `.tsbuild` per lockfile+ref.
   - `test` (ubuntu, matrix shard 1..3): `pnpm test:coverage -- --shard=${{matrix.shard}}/3 --reporter=junit --reporter=github-actions`; merge coverage in a follow-up step; uploads `coverage` and junit as artifacts (retention 7 days). Coverage thresholds from OVE_SETUP004 must pass.
   - `build` (ubuntu): `pnpm build`, `pnpm build:storybook` (when the script exists).
   - `architecture` (ubuntu): `pnpm check:boundaries`, `pnpm check:contracts`, `pnpm check:deps`, `pnpm check:headers`, `pnpm check:docs`, `pnpm check:tasks`, and on `task/*` branches `pnpm check:owns -- --base origin/main`. Each step runs only if its tool file exists (`test -f`), so the pipeline is green while owner tasks are still unmerged; a final step fails the job when `CI_STRICT_TOOLS=true` (a repository variable set by the Owner when the foundation wave is complete) and any tool was skipped.
   - `licenses` (ubuntu): `pnpm check:licenses`; and `cargo deny check licenses bans sources` when `apps/desktop/src-tauri/Cargo.toml` exists.
   - `audit` (ubuntu): `pnpm audit --audit-level=high --prod` (fails on high or critical in production dependencies), `pnpm audit --audit-level=critical` for dev dependencies, `cargo audit` when `Cargo.lock` exists. Advisory databases change without commits, so the same job also runs from `nightly.yml` (cron `17 3 * * *` UTC, on `main`) and opens/updates one issue `ci: audit failure` through `gh issue` with `issues: write` permission scoped to that job only.
   - `commits` (ubuntu): `pnpm exec commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }}` and the PR title through `commitlint` (squash-merge uses the title).
   - `config-integrity` (ubuntu): fails when a PR changes `lefthook.yml`, `commitlint.config.mjs`, `eslint.config*`, `vitest.shared.ts`, `.github/workflows/**` or `deny.toml` and the PR lacks the label `config-change` (labels are set only by maintainers). Uses the file list from `git diff --name-only`, not the PR body.
   - `workflow-lint` (ubuntu): `actionlint` and `zizmor` (static analysis for workflow injection) at versions pinned in `docs/dependencies.md`, run from a downloaded, checksum-verified binary (checksum stored in repo).
   - `rust` (`${{ vars.MACOS_RUNNER || 'macos-15' }}`, path-filtered to `apps/desktop/src-tauri/**`, `Cargo.lock`): `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`, using `rust-toolchain.toml` (OVE_SETUP010).
   - `desktop-e2e` (ubuntu, container image `mcr.microsoft.com/playwright:v1.64.0-noble` pinned by digest): `pnpm test:e2e` and `pnpm test:visual` against the mock gateway; runs when scripts exist.
   - `ci-success` (ubuntu, `needs` = all jobs above, `if: always()`): fails if any needed job result is `failure`, `cancelled`, or `skipped` while it was expected to run. This is the only check name added to branch protection (OVE_SETUP018).
5. **No secrets in `ci.yml`.** A test greps the file for `secrets.` and `vars.` (only `vars.MACOS_RUNNER`, `vars.CI_STRICT_TOOLS` allowed). Fork PRs therefore behave exactly like same-repo PRs: read-only token, no secrets, no deploy.
6. **Isolation workflow `isolation.yml` (Owner-approved staged adaptation).** PR and merge-group events run a hosted gate and never directly admit self-hosted execution. A writer dispatches the trusted default-branch workflow with a same-repository PR number after all full hosted checks pass; the PR needs fresh writer-applied `run-isolation` and `isolate-<full SHA>` labels. Forks, Drafts, stale/revoked approvals, unavailable/malformed API data and incomplete CI are denied. Default-branch pushes or an empty-number trusted dispatch test that branch's exact SHA. The gated job uses `[self-hosted, macOS, ARM64, overmind-macos26]`, no secrets and read-only contents/Actions/PR metadata. It refreshes approval after queueing before checking out the approved head, asserts macOS >=26 and arm64, calls `pnpm test:escape`, uploads `escape-evidence/`, and always performs verified cleanup of `ovm-ci-*` resources plus `container system stop`. Cleanup uses an absolute shell, sanitized environments and protected root-provisioned code/tools; missing or writable tools fail preflight. SETUP021 must restrict runner access outside PR-controlled YAML and provide ephemeral/root-controlled disposal before registration. Trusted default-branch deployment and actual execution/evidence are later operational acceptance, not a claimed result of this foundation task.
7. **What the hosted pipeline proves and what it does not.** Unit and contract tests of the sandbox adapter run against a fake `container` CLI on hosted Linux (OVE_TEST002/TEST006). Real VM escape attempts exist only in `isolation.yml`. The release workflow (OVE_SETUP014) requires the latest successful `isolation.yml` run on the release commit (checked via `gh run list`); if the self-hosted runner is unavailable, the release is blocked (fail closed), never skipped.
8. **License policy `check:licenses`.** `tools/check-licenses/run.ts` reads `pnpm licenses list --json` (production and dev separately). Allow-list (SPDX): `Apache-2.0, MIT, ISC, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0, Python-2.0, Unlicense`; `MPL-2.0` allowed only with an entry in `tools/check-licenses/exceptions.json` stating the package, justification and expiry date; denied: any `GPL`, `AGPL`, `LGPL`, `SSPL`, `BUSL`, `CC-BY-NC*`, `UNLICENSED`, packages with no license, and `OR` expressions are accepted when at least one alternative is allowed. Output a table; exit 1 on violation. `deny.toml` mirrors the allow-list for crates (`Apache-2.0`, `MIT`, `ISC`, `BSD-*`, `Unicode-3.0`, `Zlib`, `MPL-2.0` with exception) and sets `[advisories] yanked = "deny"`, `[sources] unknown-registry = "deny"`, `unknown-git = "deny"`.
9. **Reproducibility.** `docs/engineering/ci.md` lists for each job the exact local command, expected runtime, and artifacts. `pnpm run check` (OVE_SETUP001) is the local superset of the hosted checks.
10. **Cost and speed.** Target: `ci-success` within 12 minutes for a typical PR; hosted macOS minutes only for the `rust` job when Rust files change.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Reuses the root scripts from OVE_SETUP001, one composite `setup` action for every job (DRY), the commitlint config from OVE_SETUP005, the coverage thresholds from OVE_SETUP004. OVE_SETUP007 and OVE_OSS003 reuse the `setup` action and the pinning test.

## 8. Architecture and code placement

CI configuration only: `.github/workflows/`, `.github/actions/setup/`. The checks themselves are scripts in `tools/`, so they run identically locally and in CI (the workflow is a thin caller). No product code depends on CI files.

## 9. Security and safety

- **Fork PRs:** `pull_request` token is read-only and has no secrets; workflows never use `pull_request_target` except the audited `pr-gate.yml` (OVE_OSS003) which never checks out or executes PR code. Outside contributors' workflow runs require maintainer approval (repository setting documented in OVE_SETUP018: "Require approval for all outside collaborators").
- **Self-hosted runner:** operational access is restricted by SETUP021, outside PR-controlled YAML. The accepted default-branch dispatch gate requires current writer approval bound to the exact same-repository head and all full hosted checks; approval is rechecked before queued execution. Cleanup code/tools are root-provisioned and immutable to the job user, verified against trusted source, with absolute commands and sanitized child environments. Root-controlled teardown remains required; in-job cleanup does not substitute for it. No unrestricted public runner is registered by SETUP006.
- **Supply chain:** actions pinned by SHA; `--frozen-lockfile`; `minimumReleaseAge` from OVE_SETUP001; tool binaries (`actionlint`, `zizmor`, `cargo-deny`, `cargo-audit`) downloaded with checksum verification and versions listed in `docs/dependencies.md`; caches written only from `main`.
- **Expression injection:** no untrusted `github.event.*` text (PR title, branch name, commit message) is interpolated into `run:` blocks; they are passed through `env:` and quoted. `zizmor` enforces this.
- **Token scope:** `GITHUB_TOKEN` default read; the nightly issue-opening job elevates `issues: write` only in that job.
- **Logs:** CI logs may be public; tests must not print secrets (OVE_SEC003). Artifacts exclude `.env*`.
- **Fail closed:** a skipped required job counts as failure in `ci-success`; unavailable self-hosted runner blocks releases.

## 10. Errors and edge cases

- Tool file missing while `CI_STRICT_TOOLS` is set: job fails with the name of the owner task.
- Merge queue: `merge_group` event runs the same jobs against the queued commit; `commits` uses `github.event.merge_group.base_sha/head_sha`.
- Forked PR modifies `.github/workflows/ci.yml`: GitHub runs the base-branch workflow for `pull_request_target` only; for `pull_request` the PR's version runs but with a read-only token and no secrets; `config-integrity` additionally blocks merge without the maintainer label.
- Flaky shard: no automatic retries; rerun is manual. A test that is flaky is a defect for its owner task.
- Hosted macOS runner image removed: variable `MACOS_RUNNER` allows the switch without a code change.
- `pnpm audit` registry outage: job fails with an explicit "audit unavailable" message; maintainers may re-run, never skip (no `continue-on-error`).
- Dependabot/Renovate PRs: same pipeline; they have no secrets either (Renovate uses its own app token outside Actions).

## 11. Acceptance criteria

The Owner-approved sequence in tasks/_proposals/OVE_SETUP006-acceptance-sequence.md applies; deferred operational evidence is explicitly retained in its owner tasks.

- [x] A same-repository PR runs all planned hosted gates and `ci-success` passes when they pass (PR934, full run38793804338).
- [x] Workflow/static checks establish read-only/no-secret hosted execution and the actual gate/API regression denies fork admission. A real outside-contributor fork run remains acceptance in SETUP018.
- [x] Separate throw-away PRs prove failed-test, lint, GPL and high-advisory rejection, including the aggregate (#935–938). Strict missing-tool behavior is tested; actual boundary-violation scratch evidence belongs to ARCH002.
- [x] Action tag references fail workflow validation.
- [x] `pull_request_target` in `ci.yml` fails validation.
- [x] Real Git fixture changes to `lefthook.yml` without the approval labels fail config-integrity.
- [x] Actual isolation gate/API and cleanup-shell regressions prove fail-closed admission, revoked/stale approval rejection, full-CI requirements, queue revalidation and protected cleanup. Actual macOS execution and escape artifacts belong to SETUP021 + TEST007; missing approval leaves hosted CI independent.
- [x] `docs/engineering/ci.md` lists every job and its local reproduction command.
- [x] Actual installed-tree license checks pass; GPL fixtures are denied without changing the allow-list or exceptions.

## 12. Test plan

Unit tests (Vitest, `tools/check-licenses/*.test.ts`) with fixtures of `pnpm licenses` JSON. Workflow tests in `tools/check-workflows.test.ts` parse YAML (`yaml` package) and assert SHA pinning, forbidden triggers, absence of secrets, presence of `timeout-minutes` and of `permissions` at top level, and that every job in the `ci-success` `needs` list exists. Dry runs of workflows with `act` are not relied on; verification is by scratch PRs. Commands: `pnpm test -- tools/check-licenses tools/check-workflows`.

## 13. Parallelization notes

After SETUP001..005. Parallel with SETUP007, 008, 009..013. Hotspot: `ci.yml` (owned here). Other tasks that need a new CI job (for example TEST004) add a separate workflow file or propose a job through `tasks/_proposals/`; they do not edit `ci.yml`. The `ci-success` aggregate lists workflow-level jobs only from this file; other workflows (security, pr-gate) are added to branch protection by name in OVE_SETUP018.

## 14. Open questions and assumptions

- ASSUMPTION: no hosted macOS 26 with nested virtualization; the isolation job runs on a self-hosted ephemeral Mac mini (Apple silicon, macOS 26). If GitHub offers a suitable hosted label, switch `runs-on` and drop OVE_SETUP021's runbook.
- Approved adaptation: merge-group/PR events remain hosted-only; trusted maintainer dispatch and default-branch runs provide operational isolation after SETUP021 + TEST007. Release requires exact-commit real evidence.
- Question for the Owner: whether to use `step-security/harden-runner` (egress allow-list) on hosted jobs; default is no extra third-party action.
- The Owner has no dedicated CI Mac. SETUP021 requires a separately supplied/restricted execution environment; no purchase or machine registration is authorized by staged acceptance.

### Implementation notes (2026-10-15)

- A fresh whole-branch security review found approval-revocation and cleanup-environment defects. Admission now requires full hosted jobs (a Draft aggregate is insufficient), observes label removals, refreshes PR state and revalidates before queued head execution. Cleanup captures root-owned absolute tool paths, resets language/shell options and sanitizes child environments; external root-controlled ephemeral disposal remains required. Regression tests exercise the actual gate/API boundary and cleanup shell, including revoked approvals, changed heads, API failures, hostile PATH/options and altered cleanup bytes.
- The Owner accepted staged foundation delivery on 2026-10-15; physical isolation, actual fork execution and boundary-violation evidence remain mandatory in the named later tasks. See tasks/_proposals/OVE_SETUP006-acceptance-sequence.md.

- The repository default branch is master. CI includes master, main and DEVELOP pushes; trusted cache saving and nightly selection follow the actual default-branch context rather than silently targeting a nonexistent main branch.
- Shards use vitest.ci.config.ts to collect partial coverage; test-merge uses the unchanged root thresholds on merged native blobs. A real subprocess regression proves untested domain code fails only the final merged gate. Subprocess reports are isolated from parent coverage. pnpm 12 script arguments are passed directly, avoiding a literal extra --.
- GitHub's July 2026 self-repository syntax ($/.github/actions/setup) avoids loading an action from mutable checkout state. Zizmor enforces the original files. A narrow actionlint compatibility adapter translates only this local uses spelling in temporary input because actionlint 1.7.12 predates the syntax; no lint rules are disabled.
- CI helpers live in tools/ci and the shard config is a separate root file; these additive ownership paths are recorded above. PR title validation reuses commit rules with a title-only body exemption; actual commit policy is unchanged.
- PR-controlled workflow YAML cannot secure its own self-hosted admission. Automatic PR/queue isolation is replaced under the approved adaptation by explicit maintainer workflow_dispatch from the trusted default branch with a PR number, after successful hosted CI. A workflow_run design was rejected by zizmor's high-severity dangerous-trigger rule and removed rather than suppressed. The gate checks write permissions and fresh labels, including isolate-<head SHA> to prevent reusing an approval with a backdated or same-second push. Forks and obsolete heads are denied. Default-branch definitions must be promoted before this handler can operate. The Owner accepted this behavioral difference; it is not represented as a completed automatic-PR execution result. OVE_SETUP021 must enforce runner access to the trusted workflow, or use a private coordinator; an unrestricted public personal-repository runner is not provisioned here.
- The Owner declined developer license additions and the proposed MPL exception, then explicitly requested replacement of incompatible dependencies. The original allow-list and empty exceptions remain unchanged. Vite 7.3.7, Happy DOM 21.0.1 and Oxlint 1.87.0 remove the denied CSS/browser-data dependencies; ESLint 10, TypeScript and Vitest 5 remain. The accepted replacement proposal records the changes across the earlier setup tasks and their limits. The license check now passes; operational isolation and later-owned evidence remain tracked under the accepted sequence.
- The SPDX parser with CC-BY exception data is replaced by a bounded, fail-closed expression evaluator using CC0-licensed spdx-license-ids 3.0.24. Unknown license IDs, malformed operands and excessive input/nesting are denied. WITH/plus terms never grant permission; a separate allowed OR alternative still passes. Exception identifier syntax is parsed without an exception-name database because no WITH term is approved. Every operand is parsed before deciding its boolean result. OVE_SETUP008 owns the complete dependency register.
- Hosted CI exposed two existing fixture assumptions: ESLint's project service retained file/type snapshots, and the offline postinstall-denial fixture attempted a second pnpm self-download. Each lint probe now runs a fresh CLI process and its JSON diagnostics are schema-validated; only that temporary offline install fixture uses pm-on-fail=ignore because Corepack already selects its integrity-pinned manager. Production install/build policy is unchanged. The specific lint-config-change approval from OVE_SETUP003 is preserved for every ESLint configuration edit.
- Implementation PR: https://github.com/wojciechlesniak/overmind/pull/934. Actual negative scratch PRs, closed without merge: #935 failed test (expected true to be false), #936 lint (no-eval), #937 GPL-3.0-only fixture explicitly denied by licenses, #938 production lodash 4.17.20 denied by audit for two high advisories. Each aggregate failed. Baseline license failures were also present and are not confused with the specific probe diagnostics. Boundary, fork and physical-isolation evidence remain outstanding in their assigned owner tasks under the accepted sequence. Final foundation review and CI gate the merge.
