# OVE_SETUP019: shared integration

The task owns AGENTS.md, its CLAUDE.md symlink and tools/agents-md only.
The integration owner applies these pure additions before final acceptance:

1. Root package.json scripts: `"check:agents-md": "tsx tools/agents-md/check.ts"`.
2. tools/ci/architecture.ts tool registry:
   `["check:agents-md", "tools/agents-md/check.ts", "OVE_SETUP019"]`.
3. Preserve the existing CODEOWNERS foundation file and its established Owner.
   Add `/AGENTS.md`, `/CLAUDE.md`, `/tools/agents-md/` and `/.github/CODEOWNERS`
   with that same Owner. The integrator approved these exact additions; they do
   not claim to complete OVE_OSS003's broader CODEOWNERS and PR gate requirements.
4. Add exactly `AGENTS.md` and `CLAUDE.md` to the existing sensitive-config path
   matcher in tools/ci/config-integrity.ts. Add a real negative gate fixture that
   fails without config-change and succeeds with it. TASK020's target list is not
   evidence that this protection already exists in the current implementation.
5. Lefthook's pre-commit format job changes its existing exclude string to the
   supported array `["docs/pl/**", "CLAUDE.md"]`. Pinned Prettier exits 2 when
   explicitly given the mandated symlink, including when an ignore-path names it.
   Only the duplicate symlink path is omitted; AGENTS.md remains formatted and
   the dedicated checker verifies that CLAUDE.md cannot diverge.

These additions use existing dependencies and do not change product behavior.
The formatter still checks the canonical AGENTS.md and the new checker verifies
the duplicate path. The checker must pass after the script is installed. Entries
3-5 are integrator-approved changes implemented by this task; entries 1-2 were
applied by the integrator and the real root checker command passed. CODEOWNERS routes review requests;
enforcement depends on the branch ruleset managed by OVE_SETUP018, not this file
alone. Hook integration requires the existing hooks-change and config-change
labels; agent-rule edits require config-change.

OVE_OSS003 retains its default-owner rule and the remaining explicit sensitive
paths from section 5.4, including `.github/`, dependency catalog/lockfile,
entitlements, isolation and authentication adapters. Those broader additions are
left to its owner; no PR gate, trust list or issue template is fabricated here.

The Owner's explicit current session authorization selects DEVELOP and permits
agent merges after tests, security checks and independent reviews pass. The
summary preserves that authorization, with the main/human defaults for other
sessions. It does not require a new confirmation of already authorized work.

OVE_SETUP013 task commands and the OVE_ARCH002 boundary tool are reserved scripts
in the current base, with their implementations not merged. AGENTS.md states this
explicitly and links existing files only. Future owning tasks update availability
statements in the same PR. Personal Skills and provider-specific rules are not
installed by this task.
