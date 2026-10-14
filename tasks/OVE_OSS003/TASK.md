---
id: OVE_OSS003
title: Issue and PR templates, trusted-contributors file, PR gate workflow (ADR 0025)
area: OSS
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP001, OVE_SETUP006]
soft_depends_on: [OVE_OSS002, OVE_SETUP018, OVE_SETUP008]
provides: ["lib:pr-gate", "lib:trusted-contributors", "lib:issue-templates", "lib:codeowners"]
needs: ["lib:ci-setup-action"]
owns:
  - .github/ISSUE_TEMPLATE/**
  - .github/pull_request_template.md
  - .github/trusted-contributors.yml
  - .github/CODEOWNERS
  - .github/workflows/pr-gate.yml
  - tools/pr-gate/**
  - docs/engineering/pr-gate.md
reads: ["CONTRIBUTING.md", "tools/repo-settings/labels.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 18", "SPECIFICATION 19"]
adr_refs: [13, 25]
---

# OVE_OSS003: Issue and PR templates, trusted-contributors file, PR gate workflow (ADR 0025)

## 1. Summary

Implement the mechanics of the contribution model: issue forms, a PR template with a security and dependency checklist, `CODEOWNERS`, a machine-readable trusted-contributors file, and the `pr-gate` workflow that closes pull requests that are not linked to an accepted issue (unless the author is a maintainer, a trusted contributor, a known bot or a task branch from a collaborator). The gate is a small, dependency-free, unit-tested script run from a hardened `pull_request_target` workflow.

## 2. Context

ADR 0025: a PR can be opened only for an issue accepted by a maintainer; trusted contributors are exempt; automation closes the rest; CI and automatic review run on every PR; a human merges. The reference project (herdr) runs `pr-gate.yml` to close PRs from non-approved authors. A gate needs write permissions on pull requests, but a `pull_request` workflow from a fork has a read-only token, so the gate must use `pull_request_target`, the most dangerous trigger in GitHub Actions: it runs in the context of the base repository with a write token while the event data comes from the untrusted PR. Therefore the gate must never check out or execute PR code and must treat every PR field as hostile text. Internal work by the Owner's agents uses same-repository branches named `task/<ID>` (CONVENTIONS section 5) and must pass the gate without an issue.

## 3. Scope (in)

- Issue forms: `.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, `config.yml` (blank issues disabled; contact links to Discussions, Security advisories, CONTRIBUTING).
- `.github/pull_request_template.md`.
- `.github/trusted-contributors.yml` (schema, validator) and `.github/CODEOWNERS`.
- `.github/workflows/pr-gate.yml` and `tools/pr-gate/` (script, pure decision function, tests).
- `docs/engineering/pr-gate.md`.

## 4. Out of scope

- Automatic AI review: OVE_OSS007 (decision), configuration lands there.
- Labels, rulesets and "required check" settings: OVE_SETUP018 (this task defines the check name `pr-gate`).
- Content of CONTRIBUTING: OVE_OSS002 (the gate comment text is taken from there).
- Fork-PR CI hardening: OVE_SETUP006.

## 5. Detailed requirements

1. **Issue forms.** `bug_report.yml`: fields version (dropdown "main / release X"), macOS version, Mac model (Apple silicon yes/no), what happened, expected, steps to reproduce, logs (textarea with the warning "remove secrets, tokens and private paths"), checkbox "I searched existing issues", checkbox "this is not a security vulnerability (use the Security tab)". `feature_request.yml`: problem, proposed solution, alternatives, relation to the spec (free text referencing sections or ADRs), checkbox "I read CONTRIBUTING and understand PRs need an accepted issue". Both add label `needs-triage` automatically. `config.yml`: `blank_issues_enabled: false`; `contact_links` to Discussions (ideas/questions) and the security advisory URL.
2. **PR template.** Sections: *Linked issue* (`Closes #`) or *Task* (`OVE_XXX000` for maintainers' task branches); *What and why*; *Checklist*: tests added/updated; `pnpm check` passes; acceptance criteria ticked (for task PRs, copied by `task:finish`); SPDX headers (`pnpm check:headers`); docs updated; i18n keys EN+PL; accessibility checked (UI); *Security*: "I re-read the Security section of the task / the change touches permissions, isolation, Telegram, gateway auth, CI, release: yes/no", "no secrets in code, logs, tests or snapshots", "external content is treated as data"; *New dependencies* block (name, version, license, why, alternatives, link to the `docs/dependencies.md` entry) or "none"; *Lockfile review* confirmation when `pnpm-lock.yaml` changed (link to the checklist in OVE_SETUP008); *AI assistance disclosure* (none / minor / substantial, and "I ran and understand the code"); screenshots for UI. The template contains no scripts or hidden HTML.
3. **`trusted-contributors.yml`** schema (version 1): `maintainers: [ { login, id } ]` and `trusted: [ { login, id, since: YYYY-MM-DD, approved_by: <login>, merged_prs: [numbers], note? } ]` and `bots: [ { login, id } ]` (initially `renovate[bot]`, `github-actions[bot]` as applicable; the numeric ids are filled when the apps are installed). Identity is matched on the **numeric GitHub user id**, with the login for readability, so a renamed or recycled login cannot inherit trust. A validator `tools/pr-gate/validate-trusted.ts` (also run in CI) checks schema, unique ids, ISO dates, that `approved_by` is a maintainer, and that the file is sorted by login (stable diffs). Adding someone is a normal PR by a maintainer.
4. **`CODEOWNERS`:** default owner is the maintainers team/handle (placeholder `@TODO-OWNER-GITHUB` blocks `check:docs --publish`); explicit entries for security-sensitive paths so changes need an owner review: `.github/`, `lefthook.yml`, `commitlint.config.mjs`, `eslint.config.mjs`, `eslint.config.d/`, `renovate.json`, `deny.toml`, `.gitleaks.toml`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `docs/dependencies.md`, `tools/pinned-bin/`, `tools/pr-gate/`, `tools/runner/`, `build/entitlements/`, `vendor/herdr/` (two approvals configured in rulesets), `apps/desktop/src-tauri/capabilities/`, `apps/desktop/src-tauri/tauri.conf.json`, `packages/adapters/sandbox-macos/`, `packages/adapters/keychain-macos/`, `packages/adapters/telegram/`, `packages/gateway/src/auth/`, `AGENTS.md`, `CLAUDE.md`, `SECURITY.md`, `LICENSE`, `NOTICE`.
5. **Gate decision (pure function `decideGate(input): GateDecision`).** Input: `{ prNumber, authorLogin, authorId, authorAssociation, isDraft, baseRepo, headRepo, headRef, labels, linkedIssues: [{ number, state, labels, authorId }], openPrCountByAuthor, config: { maintainers, trusted, bots } }`. Output: `{ action: "allow" | "close" | "skip", reason: Reason, comment?: string, labelsToAdd: string[], labelsToRemove: string[] }`. Rules in order: (1) author is a listed bot (id match) -> allow (`bot`); (2) author id in `maintainers` -> allow (`maintainer`); (3) headRepo equals baseRepo AND headRef matches `^task/OVE_[A-Z]{2,6}\d{3}$` AND association in `OWNER, MEMBER, COLLABORATOR` -> allow (`task-branch`); (4) author id in `trusted` -> allow (`trusted`), but a trusted contributor with more than 3 open PRs is closed for `too-many-open-prs`; (5) at least one linked issue (from GitHub's `closingIssuesReferences`, not a regex over the body) that is open (or closed as completed by this PR is impossible so open only), carries label `accepted`, and (if the issue has assignees) lists the author as an assignee -> allow (`accepted-issue`), non-trusted authors may have at most 2 open PRs; (6) otherwise close (`no-accepted-issue`) with the comment text from CONTRIBUTING section "Why was my PR closed?" plus label `gate:closed`. Draft PRs are evaluated too. PRs already carrying a human maintainer's `approved` override label `gate:override` (applied only by maintainers) -> allow (`override`).
6. **Workflow `pr-gate.yml`:** triggers `pull_request_target` types `opened, reopened, edited, ready_for_review, labeled`, and `issue_comment` type `created` (for `/recheck`, only when the comment body is exactly `/recheck`, the comment is on a PR, and the commenter is the PR author or a maintainer) and `issues` type `labeled` (when `accepted` is added, re-evaluate open and gate-closed PRs that link the issue: the workflow only comments "this issue is now accepted, comment `/recheck`" because reopening on behalf of others is deliberately left to the author). Single job `pr-gate` (the required status name), `runs-on: ubuntu-24.04`, `permissions: { contents: read, pull-requests: write, issues: write }`, `timeout-minutes: 5`, concurrency per PR. Steps: (a) `actions/checkout` of the **base repository default branch** with `sparse-checkout: tools/pr-gate .github/trusted-contributors.yml`, `persist-credentials: false` — NEVER the PR head or merge ref; (b) `actions/setup-node` using the version file; (c) `node tools/pr-gate/run.mjs` with env `GITHUB_TOKEN`, `GITHUB_EVENT_PATH`, `GITHUB_REPOSITORY` only. No `pnpm install`, no dependencies, no `run:` step interpolates any `github.event.*` field.
7. **`tools/pr-gate/run.mjs`:** dependency-free Node ESM (imports `node:fs`, `node:https`/global `fetch`); reads the event JSON from `GITHUB_EVENT_PATH`; fetches via GraphQL `closingIssuesReferences(first: 10)` with labels and assignees, open PR count of the author, and the author's numeric id; calls `decideGate`; performs actions with the REST API: for `close` -> add comment (once: skip if the last bot comment is identical), add label `gate:closed`, set state `closed`; for `allow` -> remove `gate:closed` if present and, when the PR was closed by the gate and the event is `/recheck` or `edited` and the decision is allow, reopen it; for `skip` do nothing. Idempotent. Logs only IDs, numbers and reasons, never PR titles or bodies. All API errors fail the job (fail closed = the required check is red, the PR cannot merge). Rate limiting: one decision per PR per event.
8. **Input hygiene.** The script never evaluates, templates or shells out any PR-controlled string; the comment body is a fixed constant; labels and reasons are from enumerations; numeric ids are validated as integers; the event payload size is capped (1 MiB).
9. **Maintainer override and emergency stop.** Repository variable `PR_GATE_ENABLED` (default `true`); when `false` the workflow exits success without acting (documented as an emergency switch, set only by an admin). A maintainer can allow a one-off PR with label `gate:override`.
10. **Docs.** `docs/engineering/pr-gate.md`: decision table, why `pull_request_target`, the security rules (never checkout head), how to add a trusted contributor, how to test locally (`node tools/pr-gate/run.mjs --dry-run --event fixtures/event.json`), how to recover from false positives.
11. **Dry-run mode** prints the decision and intended actions without calling write endpoints; used in tests and for the Owner.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses the `setup` action's Node version rule (OVE_SETUP006) but not its install step; label names from `tools/repo-settings/labels.json` (OVE_SETUP018); the closure comment constant from CONTRIBUTING (OVE_OSS002, compared by a test); commit type/scope tooling not needed here.

## 8. Architecture and code placement

`tools/pr-gate/decide.mjs` (pure), `tools/pr-gate/github.mjs` (thin API client behind an interface for tests), `tools/pr-gate/run.mjs` (composition), `tools/pr-gate/validate-trusted.ts`. Files are plain `.mjs` so they run without install or build in the privileged workflow; their unit tests (Vitest, TypeScript) import them.

## 9. Security and safety

- **`pull_request_target` hardening checklist (all enforced by `tools/check-workflows.test.ts` from OVE_SETUP006 and by review):** no checkout of PR head/merge ref; no execution of PR files; no dependency installation; no secrets other than the automatic `GITHUB_TOKEN`; minimal permissions; actions pinned by SHA; PR-controlled strings never reach a shell, `GITHUB_ENV`, `GITHUB_OUTPUT` or `eval`; the script is read from the base branch so a PR cannot modify its own gate.
- **Trust data lives on the base branch:** `trusted-contributors.yml` is read from the default branch checkout, so a PR cannot add its author to the list; changes to it need a maintainer (CODEOWNERS).
- **Identity by numeric id** prevents login-takeover and typosquatted accounts.
- **Prompt-injection / spam resistance:** issue and PR text is never interpreted; accepted-state is a label that only triage+ users can set; the assignee check prevents someone else's accepted issue from being used as a free pass in bulk.
- **Abuse limits:** max 2 open PRs for non-trusted authors; closing is cheap and recoverable; no auto-ban.
- **Availability:** if GitHub API calls fail, the required check fails (no merge) rather than silently allowing.
- **Audit:** every decision is a job log line `pr=<n> author_id=<id> decision=<allow|close|skip> reason=<enum>`; the run history is the audit trail.
- **Least privilege for the comment text:** fixed string, no mentions, no links to user-controlled URLs.

## 10. Errors and edge cases

- PR from a fork with a branch named `task/OVE_X001`: rule 3 requires head repo = base repo, so it is not trusted.
- Co-authored or bot-created PRs on behalf of a human: the PR author account is evaluated.
- Linked issue is in another repository: ignored (only same-repo issues count).
- Issue closed after acceptance but before the PR: rule 5 requires open; PR is closed with the standard comment; a maintainer can use `gate:override`.
- Author deleted account: `authorId` missing -> close with `unknown-author` and let a maintainer decide.
- Edited PR body adds `Closes #N` after being gate-closed: `edited` event re-evaluates; allow -> label removed; reopen happens if the PR was closed by the gate (label `gate:closed` present) and the actor is the author.
- Re-open storm: the script posts the closing comment at most once per PR/state change.
- `issue_comment` on an issue (not PR): ignored.
- Maintainers' own non-task PRs (docs fixes): allowed by rule 2.
- Draft PRs from fork without issue: closed too (prevents drafts used as spam).

## 11. Acceptance criteria

- [ ] Table-driven tests of `decideGate` cover every rule, rule ordering, boundaries (2 and 3 open PRs), missing numeric id, fork with `task/` branch, closed linked issue, issue without `accepted`, assignee mismatch.
- [ ] On a throw-away test repository: a PR from a fork without a linked issue is closed with the comment and label `gate:closed`; after a maintainer adds `accepted` to the linked issue and the author comments `/recheck`, the PR is reopened and the check turns green.
- [ ] A PR from a trusted contributor without an issue stays open.
- [ ] A same-repo branch `task/OVE_OSS003` by a collaborator stays open.
- [ ] The workflow file passes the workflow tests (SHA pins, no head checkout, minimal permissions, no interpolation of event fields in `run`).
- [ ] Editing the PR body of a closed PR to add `Closes #N` of an accepted issue re-evaluates it.
- [ ] `trusted-contributors.yml` validator rejects duplicate ids, unsorted logins, `approved_by` not a maintainer.
- [ ] Issue forms render on GitHub (YAML valid per the schema) and blank issues are disabled.
- [ ] `PR_GATE_ENABLED=false` makes the workflow a no-op.
- [ ] `CODEOWNERS` has no syntax errors (GitHub shows no warnings) and includes the sensitive paths listed.

## 12. Test plan

Unit tests for `decideGate` and the API client (fake HTTP transport); fixture event payloads for each event type in `tools/pr-gate/fixtures/`; validator tests; workflow static tests shared with OVE_SETUP006; a scripted end-to-end procedure on a private scratch repository documented in `docs/engineering/pr-gate.md` and executed once before merge (results pasted into the PR). Commands: `pnpm test -- tools/pr-gate`, `node tools/pr-gate/run.mjs --dry-run --event tools/pr-gate/fixtures/fork-no-issue.json`.

## 13. Parallelization notes

Parallel with OVE_OSS002, 004, 007 and OVE_SETUP018. Hotspots: `.github/CODEOWNERS` (owned here, additions by proposal when new sensitive paths appear), `.github/trusted-contributors.yml` (edited by maintainers only).

## 14. Open questions and assumptions

- ASSUMPTION: GraphQL `closingIssuesReferences` is the linkage source (robust against formatting tricks).
- ASSUMPTION: the maintainer GitHub handle is supplied by the Owner (`TODO-OWNER-GITHUB` placeholder blocks publication).
- ASSUMPTION: limits of 2 open PRs (untrusted) and 3 (trusted).
- Open question: auto-reopen after `/recheck` is enabled for the PR author only; maintainers can always reopen manually.
- Open question: whether to auto-label first-time contributors `first-pr` for friendlier triage; default no.
