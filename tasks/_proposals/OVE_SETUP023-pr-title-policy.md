# Follow-up: generate PR titles that satisfy the existing commit policy

The public OVE_SETUP013 `task:finish` tool created PR #955 with a title copied
from the capitalized task title. The actual `commits` job in
[run 39154443139](https://github.com/wojciechlesniak/overmind/actions/runs/39154443139)
rejected that generated title because the subject must begin with a lower-case
imperative. The PR title was corrected to `feat(setup): generate deterministic task indexes`.
The subsequent complete
[CI run 39154513247](https://github.com/wojciechlesniak/overmind/actions/runs/39154513247)
passed at the same source head.

The owning task/integrator should repair only the default title construction in
`tools/tasks/lib/finish.ts` and its own public lifecycle tests. Generate an English
imperative accepted by the existing real commitlint title configuration while
retaining sanitized task text, the valid area scope and the 100-character bound.
Verify both an uppercase imperative task title and a noun-led task title against
actual commitlint; preserve the task's canonical title and issue identity. No new
dependency or commit-policy exception is needed.

This generator task does not edit the differently owned finish implementation or
weaken verification. Earlier failed/cancelled check receipts remain historical
evidence. Its normal completion evidence commit receives a fresh complete hosted
check suite before `task:finish --done`, followed by fresh checks and independent
review of the resulting done head.
