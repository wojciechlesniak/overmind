# SETUP018 shared integration and outstanding operational acceptance

The implementation adds only these root scripts through the coordinating task:

```json
{
  "settings:audit": "tsx tools/repo-settings/audit.ts",
  "settings:labels": "tsx tools/repo-settings/sync-labels.ts"
}
```

No package, dependency, workflow, live repository setting, label or secret is changed
by this proposal. The Owner applies settings separately, after the relevant checks
exist and pass. The audit is a local, read-only operator tool and is never a CI job.

ADR 0029 records the actual default branch `master`. The expected production
ruleset is named `main` (the task's logical production branch), targeting
`~DEFAULT_BRANCH`; `expected.json` expects `master` as default until a separate
Owner-approved migration. `DEVELOP` is the Owner-requested integration branch with
its own equivalent ruleset. Task branches originate from and merge into DEVELOP.
The expected final check list includes `pr-gate` (OSS003), which does not exist yet;
the audit reports the missing workflow job as drift instead of claiming it passes.

The single-maintainer exception uses zero GitHub approval count and disables
approval of the most recent push. Mandatory code-owner review is restored when a
second maintainer is added; automated Standards/Spec reviews are still required by
the Owner's implementation process. This is the existing documented exception,
not a bypass actor or permission for an agent to change settings.

The task's actual external-contributor fork PR evidence remains mandatory under
the approved SETUP006 acceptance sequence. The read-only inspection on 2026-10-16
found no forks and no fork PRs. Fixtures cannot satisfy it. SETUP018 must remain
unfinished until the Owner provides a separate writable fork/account, the actual
hosted CI/security evidence is recorded, settings are applied and the live audit
passes (or unknown administrative controls are explicitly reviewed).

GitHub cannot express branch-creator-only deletion/rebase or branch-limited token
permissions with a fine-grained PAT alone. Retain task branches, restrict write
access, use exact force-with-lease, and enforce protected destination rulesets.
Separate tag-creation and immutable-tag rulesets allow admin creation without
allowing the creation bypass to modify or delete a published tag. No production or
DEVELOP bypass is permitted.
