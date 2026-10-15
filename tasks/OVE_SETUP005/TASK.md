---
id: OVE_SETUP005
title: Git hooks and commit conventions
area: SETUP
kind: infra
size: S
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_SETUP001, OVE_SETUP003]
soft_depends_on: [OVE_SETUP004, OVE_SETUP008]
provides: ["lib:git-hooks", "lib:commit-conventions"]
needs: []
owns:
  - lefthook.yml
  - commitlint.config.mjs
  - tools/commitlint/**
  - tools/hooks/**
reads: ["package.json", "tasks/CONVENTIONS.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 19"]
adr_refs: [13, 25]
---

# OVE_SETUP005: Git hooks and commit conventions

## 1. Summary

Install fast local guard rails with Lefthook (pre-commit format and lint on staged files, commit-msg Conventional Commits check with a task reference, pre-push typecheck and tests) and define the commit convention in `commitlint.config.mjs`. Hooks are a convenience only; CI repeats every check, so bypassing a hook can never let bad code in.

## 2. Context

CONVENTIONS section 8 item 8 requires Conventional Commit messages and a PR description linking the task ID. herdr (the reference project) uses lowercase conventional commits without emoji. Versions (verified 2026-10-13): `lefthook@2.2.2` (distributed per platform through the npm package), `@commitlint/cli@21.2.3` and `@commitlint/config-conventional@21.2.3` (Node >=22.12). Branches are `task/<ID>`, one worktree per agent (CONVENTIONS section 5), so the hooks must work in `git worktree` checkouts.

## 3. Scope (in)

- `lefthook.yml` with `pre-commit`, `commit-msg`, `pre-push` hooks.
- `commitlint.config.mjs` and one local plugin `tools/commitlint/plugin.mjs` with two custom rules.
- `prepare` script `lefthook install` (name already in OVE_SETUP001).
- Documentation block inside `tools/README.md` section "Hooks" (appended; file created by OVE_SETUP001 is edited by append only, allowed here and noted in the PR).

## 4. Out of scope

- CI re-checks of commits and PR title: OVE_SETUP006.
- Secret scanning hook: OVE_SETUP007 adds the `gitleaks` pre-commit entry as a separate `lefthook.d`-style file named `lefthook-secrets.yml` included through `extends` (extension point).
- Contribution text in CONTRIBUTING: OVE_OSS002.

## 5. Detailed requirements

1. **Commit message format.** `type(scope)?: subject` with header max 100 characters. Types: `feat, fix, docs, test, refactor, perf, build, ci, chore, revert, security`. Subject lower-case start, imperative, no trailing period, no emoji (regex over Unicode emoji ranges). Scope is optional and must be one of the lower-case area codes from `tasks/PLAN.md` (`setup, oss, arch, sec, test, ds, data, engine, perm, vis, box, prov, wfrt, chief, agent, chat, skill, board, disc, dec, mem, tg, notif, pause, backup, shell, tray, onb, wspace, chatui, discui, wfed, runui, boardui, decui, agui, skui, apprui, connui, setui`) or `deps`, `release`. The scope list is read from `tasks/PLAN.md` area table by `plugin.mjs` at lint time (single source).
2. **Rule `task-reference` (custom).** Every commit on a branch named `task/OVE_XXXNNN` MUST contain a footer line `Refs: OVE_XXXNNN` matching the branch ID (the branch name is read with `git rev-parse --abbrev-ref HEAD`). On other branches (maintainer chores) the footer is optional (level warning). Merge-commit and `revert` messages are exempt.
3. **Rule `no-ai-attribution-by-default` is NOT added**: commit trailers such as `Co-Authored-By` are allowed (the project's agents are first-class contributors); the Owner decides policy (open question).
4. **Body.** Body lines max 100 characters; body is required for `feat`, `fix`, `security` (at least one line explaining why).
5. **pre-commit** (parallel jobs, only staged files, `stage_fixed: true`): (a) `prettier --write {staged_files}` for `*.{ts,tsx,js,mjs,json,md,yml,yaml,css,html}` excluding `docs/pl/**`; (b) `eslint --fix --max-warnings 0 {staged_files}` for `*.{ts,tsx,mjs}`; (c) `node tools/hooks/no-large-files.mjs {staged_files}` (reject files > 1 MiB except `*.png` under `tasks/` and `docs/`); (d) `node tools/hooks/no-forbidden-files.mjs {staged_files}` rejecting `.env*`, `*.p12`, `*.p8`, `*.pem`, `*.key`, `id_rsa*`, `*.keychain*`; (e) `pnpm check:tasks --staged` when any `tasks/**` file is staged (after OVE_SETUP013 exists; guarded by `[ -f tools/tasks/lint.ts ]`).
6. **commit-msg:** `pnpm exec commitlint --edit {1}`.
7. **pre-push** (sequential, abort on first failure): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check:boundaries` (the last one guarded by file existence until OVE_ARCH002). Skippable only through the documented `LEFTHOOK_EXCLUDE=...` for one run; never `--no-verify` in docs.
8. **Worktrees.** `lefthook install` writes hooks into the common git dir; hooks use `core.hooksPath` resolution that works in worktrees (verified in test). `prepare` is idempotent and does nothing when `CI=true` (CI must not install hooks).
9. **Self-protection.** `lefthook.yml` begins with a comment "hooks are advisory; CI is the gate". A job `hooks-integrity` in OVE_SETUP006 verifies that `lefthook.yml` and `commitlint.config.mjs` are unchanged unless the PR has the label `hooks-change`.
10. `tools/hooks/*.mjs` are dependency-free Node scripts (only `node:` imports), each with a unit test.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Reuses Prettier/ESLint configs from OVE_SETUP003 and scripts from OVE_SETUP001; area codes come from `tasks/PLAN.md` (no second list). The same commitlint config is reused by CI (OVE_SETUP006) and by the PR gate title check (OVE_OSS003).

## 8. Architecture and code placement

Tooling at the repo root: `lefthook.yml`, `commitlint.config.mjs`; helper code in `tools/hooks/` and `tools/commitlint/`. No product package imports these.

## 9. Security and safety

- Hook bypass: `git commit --no-verify` and `git push --no-verify` are always possible. Therefore hooks are never a security control; CI (OVE_SETUP006) re-runs commitlint on all commits of a PR, format check, lint, secret scan.
- Hook scripts are repo code run on every contributor machine: a malicious PR could add `lefthook.yml` commands. Mitigation: CODEOWNERS entry for `lefthook.yml`, `tools/hooks/**`, `commitlint.config.mjs`; hooks run only after `pnpm install` by the user; hook scripts contain no network access (test greps for `fetch`, `http`, `child_process` with shell).
- `no-forbidden-files` hook blocks accidental commits of key material; OVE_SETUP007 adds content scanning.
- Lefthook is installed from the npm lockfile only (no `curl | sh`).

## 10. Errors and edge cases

- Merge commits and rebase fixups: commitlint ignores `Merge ...`, `fixup!`, `squash!`; the squash-merge message is validated by the PR title check.
- Detached HEAD in CI: branch-dependent rule is skipped (warning only) when `git rev-parse --abbrev-ref HEAD` returns `HEAD`.
- Staged files with spaces or non-ASCII names: scripts receive them via lefthook `{staged_files}` quoted; test includes a file named `ünï code.md`.
- `lefthook` binary missing (`pnpm install --ignore-scripts`): `prepare` fails loudly; documented fix `pnpm exec lefthook install`.
- Emoji detection false positives for symbols like `→`: the regex covers only emoji presentation ranges and `\p{Extended_Pictographic}` minus basic arrows; covered by tests.

## 11. Acceptance criteria

- [ ] Given a clean checkout, `pnpm install` installs the hooks; `git commit` with an unformatted file results in a formatted commit.
- [ ] `fix: Handle null` (capital) is rejected; `feat(perm): add policy intersection` with body and `Refs: OVE_PERM001` on branch `task/OVE_PERM001` is accepted.
- [ ] Given branch `task/OVE_PERM001`, a commit with `Refs: OVE_PERM002` is rejected.
- [ ] A header containing an emoji is rejected.
- [ ] Staging `.env.local` or `key.p12` blocks the commit with a clear message.
- [ ] Hooks run correctly inside a worktree created by `git worktree add ../wt/OVE_X`.
- [ ] With `CI=true`, `pnpm install` does not modify `.git/hooks`.
- [ ] `pre-push` runs typecheck, lint and tests in that order and stops at the first failure.

## 12. Test plan

Unit tests for `plugin.mjs` rules and the two hook scripts (table-driven messages, file lists). Integration test in `tools/hooks/hooks.int.test.ts` creating a temporary git repository (using `node:child_process` with `git init`, copying `lefthook.yml`) and running a commit/push simulation, including a worktree case. Commands: `pnpm test -- tools/hooks tools/commitlint`.

## 13. Parallelization notes

Parallel with SETUP004/008/009..013. Hotspot: `lefthook.yml` is owned here; OVE_SETUP007 contributes `lefthook-secrets.yml` through Lefthook's `extends`, so no shared edit. Branch-name rule depends on the `task/<ID>` convention from OVE_SETUP013.

## 14. Open questions and assumptions

- ASSUMPTION: `Co-Authored-By` trailers are permitted; the Owner may forbid them (herdr forbids AI co-author lines). A change would be one extra commitlint rule.
- ASSUMPTION: no `commit-msg` signing requirement locally; signed commits are a repository ruleset decision (OVE_SETUP018).
- ASSUMPTION: `security` is an allowed type in addition to the Conventional set so security fixes are searchable.

### Implementation notes (2026-10-15)

- Lefthook 2.2.2 was published on 2026-10-13 and fails the unchanged 72-hour release-age gate. The previous mature patch 2.2.1 is pinned, following the Owner's preference to update later. Its implicit postinstall is explicitly denied; the packaged platform binary is used by our CI-aware prepare, so no dependency build script is enabled.
- Pre-commit runs independent checks in parallel, with formatting and ESLint fixes in a sequential nested group to avoid writes racing on shared staged files. Both retain stage_fixed. The optional secrets extension is wired before OVE_SETUP007 supplies its file.
- The original skeleton's supply-chain test now asserts every declared build permission is false, including Lefthook. This preserves its security invariant as the deny list grows. Root dependencies/scripts and CODEOWNERS receive the necessary tooling additions; tools/README.md is append-only.
- Syntax, scopes, limits, emoji, body and task references are machine checked. Imperative wording and explanatory quality remain review responsibilities, documented alongside accepted examples. Co-author attribution is permitted.
- Review correction: the large-file guard measures Git index blobs with shell-free Git plumbing, never working-tree bytes. Integration tests cover an oversized staged blob with a small unstaged edit and the inverse.
