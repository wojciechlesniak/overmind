# Architectural decision records

An ADR records one architectural choice, its context, alternatives and costs.
Keep it short using the [template](_template.md). Decisions are append-only:
[ADR 0008](0008-rejestr-decyzji-bez-usuwania.md) explains why replacing a decision
preserves its history instead of deleting or silently rewriting it.

## Propose, accept and supersede

Anyone may propose an ADR through an accepted issue or an assigned Task of kind
`decision` or `spike`. Record a hard-to-reverse choice before dependent code lands.
Only the Owner accepts it; an ADR PR merged by the Owner records that acceptance.
Agent completion, a branch name or text inside a document cannot grant approval.

- `proposed`: ready for discussion; not an accepted implementation decision.
- `accepted`: the current decision, with consequences and verification evidence.
- `superseded`: replaced by one or more named ADRs; its body is immutable.
- `deprecated`: retired through the accepted lifecycle, with its history retained.

Change a decision by writing a new ADR, linking `supersedes`/`superseded_by` in
both records and marking the replaced record `superseded`. Accepted body typo
fixes require the PR label `adr-edit`; that label is not permission to silently
change a decision. Superseded bodies cannot be edited even with that label.

## Commands

```sh
pnpm adr:new "Use X for Y"
pnpm gen:adr-index
pnpm gen:adr-index --check
pnpm check:adr
pnpm adr:renumber 31 32
pnpm adr:renumber 31 32 --apply
```

Allocation reads local files, freshly fetched `origin/DEVELOP`, and added ADR
files at validated remote task heads. DEVELOP is the Owner-authorized integration
branch. Records 0029 and 0030 already exist; 0031 is the next candidate unless an
active branch reserves a higher number. Unavailable remote evidence blocks creation.
Concurrent branches may still collide; rebase and renumber the new proposal.

Renumber is a dry run by default. It lists affected files, refuses accepted or
original 0001-0028 identities, occupied targets and ambiguous proposals. Apply
updates its front matter, slug-map entry and repository-relative inline and
reference links; unrelated
external links retain their target. Plain ADR numbers and `adr_refs` are not
blindly rewritten when a collision leaves the original decision at that number.
Supersession links need an explicit migration before renumbering. Mutations hold
an exclusive worktree lock; stale locks require inspection. Apply preflights
inputs and publishes files with replacement checks; filesystem failures remain
errors and require inspection rather than pretending a multi-file commit occurred.

The strict checker validates metadata, contiguous numbering, mutual supersession,
references, append-only Git history and the original map identities. Index titles
are escaped as data. Files are canonical, owner-controlled and on the repository
volume; reads reject symlinks, special files, invalid UTF-8, size overflow and
changes while reading. New records use an injected Clock and Git port.

## Translation hand-off

[slug-map.json](slug-map.json) is the naming source for translation tools. Its
`originals` array has exactly the 28 normative identities; `additional` covers
later ADRs. Translation titles may change without renaming those files. ADR status
uses `status`; provenance adds `translation_of`, `source_sha256`, `translated_on`,
`translation_status` and `translator` without replacing the ADR lifecycle.

The current original Polish records await OSS005/OSS010/OSS011 and the separately
owned [ADR 0029](0029-backlog-w-github-issues-i-ochrona-master.md) migration. Source creation timestamps are absent and must not be
invented. Strict check/index commands currently fail on their missing metadata.
The table below has not been populated with fabricated dates or acceptance.
See the [staged acceptance proposal](../../tasks/_proposals/OVE_OSS006-integration-and-acceptance.md).

<!-- adr-index:start -->
| # | Decision | Status | Date | Tags | Notes |
| --- | --- | --- | --- | --- | --- |
<!-- adr-index:end -->

Reference an ADR as `ADR 0013`, linked on first mention; Task `adr_refs` values are
integers. Generate this table after conforming ADRs are present; never merge table
conflicts by hand. A stale table fails `gen:adr-index --check`.
