# Security policy

Overmind isolates AI Agents and provider CLIs. Reports about permission boundaries,
approvals, local secrets and the release supply chain are especially valuable.
This repository is pre-alpha; implemented checks are not evidence that the complete
product or physical container isolation has been verified.

## Supported versions

Before 1.0, security support covers only the latest release and `main`.
Older releases are unsupported; reproduce on the latest supported version if safe.
There is currently no supported published release. The repository's actual default
branch is `master`; the planned `main` branch is not yet provisioned. `DEVELOP` is
the integration branch and carries no promise of a secure production release.
Repository configuration is tracked by [OVE_SETUP018](tasks/OVE_SETUP018/TASK.md).

## Report privately

The intended reporting route is **Security -> Report a vulnerability** on GitHub:
[private advisory form](https://github.com/wojciechlesniak/overmind/security/advisories/new).
It requires a GitHub account and private vulnerability reporting to be enabled.
As checked on 2026-10-16, that repository setting is disabled; OVE_SETUP018 tracks
its configuration. A sign-in page alone does not prove that reports can be received.

Fallback private contact: **TODO-OWNER: security contact**.
Until reporting is enabled or the Owner supplies this contact, there is no verified
private submission route. Do not put exploit details, secrets or affected people's
data in a public issue, Discussion or PR. Wait for a verified private channel.
The contact marker blocks publication through the future `check:docs --publish`
gate ([OVE_OSS004](tasks/OVE_OSS004/TASK.md)); it is not an address to send reports to.

Include the version or commit, operating system, relevant configuration, precise
reproduction steps, expected and actual behavior, impact and a minimal PoC.
Attach only necessary logs with credentials, personal data and private paths removed.
Describe the trust boundary crossed and whether the issue works with default policy.
Do not use third-party systems or private data to demonstrate impact.

If details are posted publicly by mistake, maintainers will restrict/remove exposed
content where possible, move follow-up to a verified private channel and contact
the reporter. Git history and notifications may retain copies; rotate exposed secrets.

## Response and disclosure

Once a verified private channel receives a report, we aim to acknowledge it within
5 business days and send status updates at least every 14 days while it is open.
Targets are a fix within 30 days for Critical findings and 60 days for High findings;
other findings are handled best effort. These are goals, not guaranteed service levels.
If maintainers are unavailable, updates may be delayed; no response proves no safety.

We seek coordinated disclosure after a fix is available or at 90 days from receipt,
whichever comes first. Agree on publication details privately and explain any missed
target. Never publish other people's data or live credentials as part of disclosure.

## Severity guide

- **Critical:** isolation escape allowing an Agent or CLI to read/write outside
  Allowed Directories, reach the host or gain network access beyond its allow-list;
  forged Approvals; signing/release pipeline compromise; remote code execution in
  the engine.
- **High:** Permission Policy bypass or widened Effective Permissions, including
  prompt injection through repository content, Skills, CLI output or Telegram;
  Telegram pairing/Approval bypass; secret exposure from Keychain or logs; gateway
  authentication bypass; UI-to-OS access beyond the capability list.
- **Medium/Low:** other reproducible security impact, classified using the actual
  prerequisites, reach and consequences. A label does not substitute for a PoC.

## Scope

In scope are this repository's code, release artifacts, CI/CD configuration and
supply chain, including dependencies, workflows and pinned binaries. A third-party
issue that makes Overmind's integration unsafe is useful evidence for mitigation.

Report vulnerabilities in third-party tools themselves upstream: herdr, Apple
`container`, Claude Code, Codex CLI and Ollama. Tell us privately when Overmind needs
to pin, replace or mitigate an affected component; upstream ownership does not
excuse an unsafe integration here.

Out of scope are findings that require a malicious Owner, social engineering,
physical access, automated scanner output without a reproducible PoC, and a user
denying service only to their own machine. Explain additional impact if applicable.

## Good-faith research and credit

Good-faith research on your own installation is welcome. Use test accounts, fake
secrets and data you own. Do not access other people's data or systems, persist
unauthorized access, disrupt shared services or extend testing beyond your permission.
This invitation cannot grant rights over third-party infrastructure or data.

We offer public credit with your consent when disclosing a validated finding.
Tell us your preferred name or whether you want to remain anonymous. There is no
promised bounty. No verified project PGP key is currently published; do not trust a
key supplied in an unverified issue or message as a project reporting key.

## How Overmind is designed to fail

Permissions are denied by default. Effective Permissions intersect the Owner's
policies; untrusted content cannot grant permissions or forge Approvals. Missing
isolation, unreadable policy, unavailable verification or an invalid capability
must stop the operation. Secrets belong in Keychain, not prompts, logs or artifacts.
These are required invariants: report a reproducible violation even if an Agent
claims the operation succeeded or a superficial test appears green.
