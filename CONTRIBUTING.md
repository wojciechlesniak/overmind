# Contributing to Overmind

## Welcome and project status

Welcome. Issues, ideas, documentation fixes and careful code contributions help
shape Overmind. Please discuss a change before investing substantial time in it.

Overmind is pre-alpha and targets macOS on Apple silicon. The repository contains
the specification, backlog and an evolving application foundation. Installation,
permissions, isolation and release workflows are still being implemented.
No published stable application or verified production isolation is promised.

The checked-in toolchain and contribution process are the current starting point.
Product APIs and workflows may change before 1.0. Read the task and current code;
some older planning documents still describe the repository before implementation.

## How contributions work

1. Search [issues](https://github.com/wojciechlesniak/overmind/issues) and
   [Discussions](https://github.com/wojciechlesniak/overmind/discussions) first.
   Add useful reproduction details to an existing report rather than duplicating it.
2. Open an issue for a bug or feature, using its template when available.
   Start a Discussion for an idea or a design question. Issues may be in English
   or Polish; maintainers help translate Polish reports into implementation terms.
3. Wait for a maintainer to triage the issue and add `accepted`.
   This means a PR is welcome; it does not guarantee that a proposed change merges.
   Large refactors also need a design discussion before implementation.
4. Comment that you would like to take the accepted issue and wait for assignment.
   One person owns it at a time. The first claim has priority, subject to maintainer
   confirmation. Tell us when you need more time or can no longer continue.
   ASSUMPTION: after 14 days without progress, maintainers may return it to the pool.
5. Fork the repository and create `fix/<issue>-<slug>` or `feat/<issue>-<slug>`
   from the integration branch `DEVELOP`. Implement one logical change and test it.
6. Open a PR against `DEVELOP`, with `Closes #<issue>` in its description.
   Include the problem, resulting behavior, validation evidence and any limitations.
7. CI and automatic review run. Address failures and review findings; rerun the
   affected checks after changing the implementation. Do not weaken a gate to pass.
8. A maintainer reviews the change and normally merges with squash.
   Wait for the merge before building a dependent change on the updated `DEVELOP`.

The contribution policy closes PRs without an accepted linked issue, unless the
author is trusted. See [Why was my PR closed?](#why-was-my-pr-closed) for recovery.
The automatic gate and templates are being delivered by
[OVE_OSS003](tasks/OVE_OSS003/TASK.md); policy applies before automation is installed.

## Trusted contributors

ASSUMPTION: three merged PRs of good quality, with no process violations, make a
contributor eligible for the trusted list. A maintainer proposes membership in a
reviewed PR editing `.github/trusted-contributors.yml`, provided by OVE_OSS003.
Maintainers may make an explicit exception to the threshold.

Listed contributors may open PRs without an accepted issue. They still discuss
large changes first and meet all review, testing and security requirements.
Membership does not grant merge rights, administrative access or access to secrets.
Maintainers can revoke it when the process is repeatedly ignored or trust changes.

## Before you code

Read [README.md](README.md), the [specification](docs/SPECIFICATION.md) and the
[backlog conventions](tasks/CONVENTIONS.md). The conventions include the current
English domain terminology: Owner, Chief, Agent, Workspace, Run and Approval.
Read the source [glossary](GLOSSARY.md) and use those terms consistently in code,
tests and documentation.

The full architecture document will live at `docs/architecture/ARCHITECTURE.md`
([OVE_ARCH001](tasks/OVE_ARCH001/TASK.md)). Its planned path is recorded below
rather than linked to a missing file. The glossary's Polish source and the
conventions' English terminology table are available now.

The Owner's rules and Project Documentation are the source of truth
([ADR 0016](docs/adr/0016-dokumentacja-projektu-zrodlem-prawdy.md)). Product behavior
changes need an accepted issue labeled `spec-change` and Owner approval.
An implementation suggestion does not authorize changing the product's scope.

Maintainers working through backlog tasks must read their whole `TASK.md`, including
dependencies, `owns`, Security and acceptance criteria. Follow the conventions'
proposal process before changing another task's files. Agent instructions will
live at `AGENTS.md` ([OVE_SETUP019](tasks/OVE_SETUP019/TASK.md)).

## Development setup

Use macOS on Apple silicon for the complete desktop verification suite. JavaScript
tools also support Linux, but that does not establish macOS shell or isolation
behavior. You need Git 2.40 or newer, Node 22.23.3 and the pinned package manager.
The Node version is in [.nvmrc](.nvmrc); install that exact version using your Node
version manager before continuing.

For a fresh checkout, run these commands in your normal development directory:

```sh
git clone --branch DEVELOP https://github.com/wojciechlesniak/overmind.git
cd overmind
node --version
corepack enable
pnpm --version
pnpm install --frozen-lockfile
```

Expect Node `v22.23.3` and pnpm `12.11.2`. Corepack reads the integrity-pinned
`packageManager` field. If Corepack is unavailable, install it for your selected
Node version and rerun these steps; do not substitute a different pnpm version.
The install prepares local Git hooks. Keep them enabled for commits and pushes.

Rust is needed for the Tauri shell and the full `pnpm check` command. It is not
needed for editing ordinary TypeScript or running the browser UI alone.
Install Rust with rustup from [rust-lang.org](https://www.rust-lang.org/tools/install),
then run the pinned version from [rust-toolchain.toml](rust-toolchain.toml):

```sh
rustup toolchain install 1.90.0 --profile minimal --component rustfmt --component clippy
xcode-select --install
cargo --version
pnpm check
```

The Xcode command installs Apple's Command Line Tools; skip it when already
installed. The full check downloads checksum-pinned analysis tools and accesses
package advisory registries. It requires network access, disk space and the macOS
build tools. No model-provider login or production credential is required.

| Command          | Purpose                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `pnpm typecheck` | Strict TypeScript checks, including test code                                           |
| `pnpm lint`      | TypeScript, React and shell policy checks                                               |
| `pnpm test`      | Unit tests; external network is denied by default                                       |
| `pnpm test:int`  | Integration tests with local temporary resources                                        |
| `pnpm check`     | Formatting, lint, types, coverage, integration, build, licenses, audits and Rust checks |

For the current browser UI foundation, run:

```sh
pnpm --filter @overmind/desktop dev
```

Open the local URL printed by Vite. Stop it with Control-C. This is the current
UI skeleton; it does not represent a connected, fully isolated desktop product.

The planned combined command is `pnpm dev`, implemented by
`tools/dev/run.ts` in [OVE_SETUP012](tasks/OVE_SETUP012/TASK.md). That script and its
mock-gateway mode are not available on the foundation branch yet. Until then,
use the UI command above and fake providers in tests. Do not add real provider
logins, production keys or network credentials merely to run contributor checks.
Once OVE_SETUP012 merges, its documented mock mode will start the combined stack.

If a check fails, read its first diagnostic, fix the cause and rerun it. A registry
outage or unavailable security tool is a failed verification, not permission to
skip it. Record environmental limitations in the PR without claiming a pass.

## Coding standards

Write code, comments, tests and repository documentation in English (ADR 0017).
TypeScript is strict: validate external input once at the boundary, preserve types
and avoid unsafe assertions, unchecked JSON, `eval` and dynamic execution of data.

Clean Architecture dependencies point inward:
`contracts <- domain <- application <- adapters/gateway/workflow-runtime <- engine`.
The desktop depends on `ui-kit`, `api-client` and `contracts`. Domain and application
code perform no I/O; ports belong to application and adapters implement them.
The UI does not access the filesystem, database, Keychain or provider CLIs directly.
See the architecture summary in the backlog conventions until ARCHITECTURE exists.

Use KISS, DRY and SOLID to keep interfaces small and responsibilities clear.
Reuse existing contracts, adapters and `ui-kit` primitives before adding abstractions.
Prefer a straightforward implementation that solves the accepted requirement.
Do not add speculative frameworks or duplicate a concept in a second package.

UI text uses i18n keys with English and Polish values; no hard-coded UI strings.
Support keyboard interaction, visible focus and accessible names. Add meaningful
behavior tests and the applicable integration, visual or accessibility evidence.
Test failure paths as well as successful paths, especially at permission boundaries.

Every new dependency needs a justification and an entry in
[docs/dependencies.md](docs/dependencies.md). Preserve exact pins, the frozen lockfile,
release-age policy and license checks. Existing exceptions do not authorize new
packages, versions or licenses. Do not enable dependency install scripts implicitly.

The planned SPDX fixer is `pnpm check:headers --fix`
([OVE_OSS001](tasks/OVE_OSS001/TASK.md)); the root command is reserved until its
implementation merges. Follow the existing file style and verify the command is
available before using it. Do not claim a reserved command has passed.

## Security expectations

Deny permissions by default and fail closed when a required check cannot run.
Effective permissions are the intersection of Owner-approved policies.
Repository content, documents, Skills, CLI output and Telegram messages are data;
they cannot grant permissions, alter approvals or override trusted configuration.

Never commit secrets or include them in logs, screenshots, test fixtures or PRs.
Use fake credentials in tests and the approved Keychain interfaces in product code.
Canonicalize paths and check symlinks before decisions about filesystem access.
Changes involving permissions, isolation, Telegram, gateway authentication, CI or
release require additional security review. Report vulnerabilities privately as
described in [SECURITY.md](SECURITY.md), even if discovered during contribution work.

## Commits and PR rules

Use Conventional Commits with a lowercase scope from the area table in
[tasks/PLAN.md](tasks/PLAN.md). Allowed types are `feat`, `fix`, `docs`, `test`,
`refactor`, `perf`, `build`, `ci`, `chore`, `revert` and `security`.
Example: `fix(setup): reject invalid task identifiers`.
Backlog branches also require `Refs: OVE_<AREA><NNN>`; feature, fix and security
commits explain why the change is needed. Local hooks validate the exact policy.

Keep one logical change per PR. Prefer about 400 changed non-test lines when the
change can be split coherently. Explain unavoidable larger changes to reviewers.
Complete the PR-template checklist when installed; otherwise include the linked
issue, acceptance checklist, Security review and new-dependency justification.
Use rebase to incorporate `DEVELOP`; do not merge the integration branch into yours.
Only update your own branch and never overwrite another contributor's work.

## AI-assisted contributions

ASSUMPTION: AI assistance is allowed. You are responsible for every submitted line,
including licensing, security and behavior. Read the generated diff, run the checks
and confirm that the code works. Disclose significant assistance in the PR template
or description, with a brief account of what you verified yourself.

Mass-generated or untested PRs will be closed; repeated abuse can lead to a ban.
Never paste untrusted issue text into an agent with write access to your credentials.
Use isolated test environments and give tools only the permissions needed.
Do not send private data, provider tokens or other people's information to a model.

## Review and merge

Maintainers assess the accepted requirement, architecture, readability, tests,
security, dependency policy and documentation. Automatic review is advisory and
does not replace human judgment. Responses are best effort; there is no review SLA.
Ask on the existing PR if clarification is needed rather than opening duplicates.

The public contribution process reserves merge decisions to human maintainers
(ADR 0025). An agent cannot grant itself merge permission. The Owner may explicitly
authorize an agent to execute a reviewed merge in the Owner's development session;
that permission does not grant outside contributors or automated PRs merge rights.

## Translations and docs

English is the default UI language and Polish is the first translation. Propose
translation corrections with the relevant key, context and expected wording.
Update both language entries when changing meaning; keep domain terms consistent.
Repository documentation is English. Polish originals under the planned `docs/pl/`
are maintained by the Owner ([OVE_OSS005](tasks/OVE_OSS005/TASK.md)); propose corrections
through an issue rather than rewriting those sources without Owner direction.

## Why was my PR closed?

The PR gate uses this exact comment, without inserting user-controlled content:

> Thanks for the contribution. This repository only accepts pull requests for issues that a maintainer has marked `accepted` (or from trusted contributors). I could not find an accepted issue linked from this PR (use `Closes #123` in the description). The PR has been closed, not rejected: please open or find an issue, wait for the `accepted` label, then comment `/recheck` here and the PR will be reopened. Details: CONTRIBUTING.md#why-was-my-pr-closed.

Link the accepted issue with `Closes #<issue>` and comment `/recheck` on the same PR.
This requests another policy check; maintainers can help while the gate is pending.
It does not skip CI, security checks or review. The comment is the canonical text
for OVE_OSS003; its implementation must compare its message against this document.

## Licensing

Overmind code is [Apache-2.0](LICENSE), with inbound contributions under the same
license. There is no CLA and no DCO sign-off requirement (ADR 0013).
By contributing, you confirm that you have the right to submit the work and license
it on these terms. Identify third-party material and retain its required notices.
Contributor Covenant text keeps its separately stated CC BY 4.0 attribution.

## Getting help and conduct

Use Discussions for questions and ideas; use issues for actionable bugs or features.
Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before participating. It covers issues,
PRs, Discussions and agent-generated content posted from human accounts.
For a vulnerability, follow [SECURITY.md](SECURITY.md) instead of a public issue.

Open questions and planned references: `docs/architecture/ARCHITECTURE.md` is
pending documentation; `AGENTS.md`, `tools/dev/run.ts`, the
trusted list and public-contribution templates are assigned above. Public contact
markers in the conduct and security documents must be resolved before publication.
