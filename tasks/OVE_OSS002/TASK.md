---
id: OVE_OSS002
title: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
area: OSS
kind: docs
size: M
priority: P0
mvp: true
status: in_progress
depends_on: [OVE_SETUP001]
soft_depends_on: [OVE_OSS001, OVE_OSS003, OVE_SETUP018, OVE_SETUP019]
provides: ["lib:contributing-docs", "lib:security-policy"]
needs: []
owns:
  - CONTRIBUTING.md
  - CODE_OF_CONDUCT.md
  - SECURITY.md
reads: ["tasks/CONVENTIONS.md", "docs/dependencies.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 17", "SPECIFICATION 18", "SPECIFICATION 19"]
adr_refs: [13, 16, 17, 25]
---

# OVE_OSS002: CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md

## 1. Summary

Write the three community files that explain how to take part and how to report vulnerabilities: a `CONTRIBUTING.md` that implements the contribution model of ADR 0025 in plain steps, a `CODE_OF_CONDUCT.md` based on Contributor Covenant 2.1, and a `SECURITY.md` with a threat-aware scope for a product that isolates AI agents.

## 2. Context

ADR 0025: issues and discussions are open to everyone; a pull request may be opened only for an issue accepted by a maintainer; people with several good PRs go to the trusted list and may open PRs without that requirement; automation closes other PRs; every PR passes CI and automatic review; a human merges. ADR 0013 requires `CONTRIBUTING.md` from the start and says no CLA. ADR 0017: English everywhere. SPEC 18 lists "details of CONTRIBUTING.md and code of conduct" as an open decision: the model is fixed, the details are written here (marked ASSUMPTION where chosen). The reference project (herdr) is closed to outside PRs because of floods of agent-generated PRs; Overmind chooses the middle road and must say so kindly, because the automation will close PRs from people who did not read the rules.

## 3. Scope (in)

- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` in English.
- The text of the bot comment used by the PR gate is defined in `CONTRIBUTING.md` section "Why was my PR closed?" and reused (copied by reference) by OVE_OSS003.

## 4. Out of scope

- Templates and workflow: OVE_OSS003. README: OVE_OSS004. Repository settings such as enabling private vulnerability reporting: OVE_SETUP018.
- Internal task process for agents: `tasks/CONVENTIONS.md` and `AGENTS.md` (OVE_SETUP019); CONTRIBUTING links to them for maintainers.

## 5. Detailed requirements

1. **`CONTRIBUTING.md` sections (in order, each with concrete content):**
   1. *Welcome and project status* (pre-alpha, macOS only, Apple silicon, what is stable and what is not).
   2. *How contributions work* (a numbered flow): (1) search existing issues and Discussions; (2) open an issue using the template (bug, feature) or start a Discussion for ideas; (3) a maintainer triages and may add the label `accepted` (this means "a PR is welcome", not "will be merged"); (4) comment that you want to take it (one assignee at a time; unclaimed for 14 days it returns to the pool); (5) fork, branch `fix/<issue>-<slug>` or `feat/<issue>-<slug>`, implement; (6) open a PR that contains `Closes #<issue>` in the description; (7) CI and automatic review run; address findings; (8) a maintainer reviews and merges with squash. PRs for non-accepted issues are closed automatically with a friendly comment.
   3. *Trusted contributors:* how one joins (ASSUMPTION: after three merged PRs of good quality and no process violations, proposed by a maintainer by a PR that edits `.github/trusted-contributors.yml`; the listed person can then open PRs without an accepted issue but should still discuss large changes first); what the list means and that it can be revoked.
   4. *Before you code:* read `README.md`, `docs/architecture/ARCHITECTURE.md` (when available), the specification and glossary (ADR 0016: the Owner's documentation is the source of truth; changes to product behaviour need an accepted issue with label `spec-change` and Owner approval); terminology (use the glossary terms in code and docs).
   5. *Development setup:* Node 22.23.3 (`.nvmrc`), `corepack enable`, `pnpm install`, `pnpm dev`, the root scripts table (`typecheck`, `lint`, `test`, `check`), how to run with the mock gateway, Rust only for the Tauri shell, no real provider logins needed (fake providers).
   6. *Coding standards:* English only (ADR 0017), TypeScript strict, Clean Architecture layers and boundaries (link to ARCHITECTURE), DRY/KISS/SOLID, reuse `ui-kit`, i18n keys (EN + PL) and no hard-coded UI strings, accessibility, tests required, no new dependency without justification in `docs/dependencies.md`, SPDX header via `pnpm check:headers --fix`.
   7. *Security expectations:* deny by default, no secrets in code/logs, content from the outside is data; PRs touching permissions, isolation, Telegram, gateway auth, CI, or release get extra review.
   8. *Commits and PR rules:* Conventional Commits (types and scopes listed or linked), one logical change per PR, PR template checklist, small PRs preferred (about 400 changed lines), rebase instead of merge.
   9. *AI-assisted contributions (ASSUMPTION):* allowed; you are responsible for every line; you must run the checks and the code must work; disclose significant AI assistance in the PR template; do not submit mass-generated or untested PRs (they will be closed and repeated cases lead to a ban); never paste untrusted issue text into an agent with write access to your credentials; do not include secrets or private data.
   10. *Review and merge:* what the maintainers look at, typical response time (best effort, no SLA), automatic review is advisory, only humans merge.
   11. *Translations and docs:* UI translations (Polish is first); docs are English (ADR 0017); how to propose translation changes; the Polish originals under `docs/pl/` are maintained by the Owner (see OVE_OSS005).
   12. *Why was my PR closed?* exact text of the gate comment (below) and how to get it reopened (`/recheck`).
   13. *Licensing:* Apache-2.0, inbound = outbound, no CLA (ADR 0013), you confirm you have the right to contribute the code.
   14. *Getting help and conduct:* Discussions for questions; link to CODE_OF_CONDUCT and SECURITY.
2. **Gate comment text (final, used verbatim by the PR gate):** "Thanks for the contribution. This repository only accepts pull requests for issues that a maintainer has marked `accepted` (or from trusted contributors). I could not find an accepted issue linked from this PR (use `Closes #123` in the description). The PR has been closed, not rejected: please open or find an issue, wait for the `accepted` label, then comment `/recheck` here and the PR will be reopened. Details: CONTRIBUTING.md#why-was-my-pr-closed." The text contains no user-controlled content.
3. **`CODE_OF_CONDUCT.md`:** Contributor Covenant version 2.1 (verbatim from contributor-covenant.org, CC BY 4.0, keep attribution paragraph) with the enforcement contact set to the value chosen by the Owner. Until the Owner supplies a public contact, the file contains the marker `TODO-OWNER: enforcement contact` and `pnpm check:docs --publish` (OVE_OSS004) fails while the marker exists. The doc names who enforces (the maintainers) and states that it applies in issues, PRs, Discussions, and in agent-generated content posted by a human account.
4. **`SECURITY.md`:** (a) supported versions: only the latest release and `main` (pre-1.0); (b) how to report: GitHub private vulnerability reporting ("Report a vulnerability" in the Security tab; enabled by OVE_SETUP018), fallback contact marker `TODO-OWNER: security contact` (publish check fails while present), never public issues; (c) what to include (version, steps, impact, PoC, logs without secrets); (d) response expectations: acknowledge within 5 business days, status updates every 14 days, fix timeline by severity (critical 30 days, high 60, others best effort) and coordinated disclosure after a fix or at 90 days, whichever first; (e) severity guide specific to Overmind: **Critical** = escape from the isolation (agent or CLI reads or writes outside Allowed Directories, reaches the host, or gains network beyond the allow-list), forged approvals, signing/release pipeline compromise, remote code execution in the engine; **High** = permission-policy bypass or effective-permission widening (including by prompt injection through repository content, Skills, CLI output or Telegram), Telegram pairing or approval bypass, secret exposure from Keychain/logs, gateway authentication bypass, UI-to-OS access outside the capability list; **Medium/Low** = other; (f) in scope: this repository's code, release artifacts, CI/CD configuration and supply chain (dependencies, workflows, pinned binaries); (g) out of scope: vulnerabilities in third-party tools themselves (herdr, Apple `container`, Claude Code, Codex CLI, Ollama): report upstream (and tell us so we can pin or mitigate), findings requiring a malicious Owner, social engineering, physical access, automated scanner output without a PoC, DoS by the user of their own machine; (h) safe harbour: good-faith research on your own installation is welcome; do not access other people's data or systems; (i) credit policy and optional PGP key (marker); (j) a short "how Overmind is designed to fail" paragraph (deny by default, fail closed) so reporters understand the invariants.
5. **Tone and length:** friendly, concrete; CONTRIBUTING 200-350 lines; SECURITY 60-120 lines; no emojis.
6. **Link checks:** all relative links resolve (checked by OVE_OSS004 `check:docs`); references to files that are created later (ARCHITECTURE) are written with the exact planned path and tracked in Open questions.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Content principles come from `tasks/CONVENTIONS.md` (summarised, linked, not copied); commit types from OVE_SETUP005; scripts from OVE_SETUP001; gate behaviour from OVE_OSS003; the gate comment text is defined once here.

## 8. Architecture and code placement

Three root Markdown files. No code.

## 9. Security and safety

- SECURITY.md is the public safety valve: it must route reports privately and state the invariants honestly; wrong instructions here lead to public zero-days.
- The AI-contribution policy and the warning about untrusted issue text protect contributors and maintainers from prompt-injection attacks via issues and PRs.
- No personal contact data is included unless the Owner decides so; placeholders block publication rather than leaking by accident.
- The gate comment contains no user content, so it cannot be used for mention spam or injection.

## 10. Errors and edge cases

- Contributor opens a PR first: the document explains the closure is automatic and recoverable.
- Several people claim one issue: first comment wins, maintainers may reassign after 14 days of silence.
- Security issue reported publicly: maintainers convert/delete it and contact the reporter (documented).
- Maintainer unavailable: SLAs are best effort; stated honestly.
- Contributors who cannot read English: they may open issues in Polish or English; maintainers translate (ASSUMPTION).
- Large refactors from contributors: need an accepted issue plus design discussion.

## 11. Acceptance criteria

- [ ] `CONTRIBUTING.md` contains all 14 sections with concrete steps and the exact gate comment text.
- [ ] `CODE_OF_CONDUCT.md` is Contributor Covenant 2.1 with attribution and the contact placeholder marker.
- [ ] `SECURITY.md` has supported versions, private reporting path, SLA, the Critical/High definitions for isolation, in/out of scope, and safe harbour.
- [ ] Markers `TODO-OWNER:` exist for the unknown contacts and are the only unresolved items.
- [ ] A new contributor can follow `CONTRIBUTING.md` from clone to a green `pnpm check` without other documents (reviewer dry run).
- [ ] No emojis; English only; links resolve.

## 12. Test plan

Docs lint (`markdownlint-cli2`, link check) via `pnpm check:docs` once OVE_OSS004 exists; reviewer dry run by someone who did not write it (recorded in the PR). A unit test in `tools/docs-check` (OVE_OSS004) verifies the gate comment text in CONTRIBUTING equals the constant used by `tools/pr-gate` (OVE_OSS003).

## 13. Parallelization notes

Parallel with OVE_OSS001, 003, 004, 006. The gate comment constant is shared with OVE_OSS003 (this task is the source; OVE_OSS003 imports it via a test, or copies it with a test that compares them).

## 14. Open questions and assumptions

- ASSUMPTION: "trusted" threshold of three merged quality PRs; maintainers may override.
- ASSUMPTION: 14-day claim expiry on accepted issues.
- Owner must supply: public security contact and code-of-conduct enforcement contact (placeholders `TODO-OWNER`).
- Open question: whether to require DCO sign-off (ADR 0013 says no CLA; DCO is lighter). Default: no.
