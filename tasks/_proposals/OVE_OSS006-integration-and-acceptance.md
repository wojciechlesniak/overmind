# OVE_OSS006 integration and staged acceptance proposal

Status: shared integration approved by the integrator; staged acceptance is still
unapproved. No acceptance or security gate is waived by this document.

## Observed dependency cycle and current evidence

At DEVELOP `90aad1c4df336f81790bcd63966cce93993166f2`, the repository has
30 ADR files. ADR 0001 has only a historical Polish superseded-status field;
0002-0029 lack the normative ADR metadata. The first 29 use Polish names/content;
only 0030 already has English normative metadata. `docs/pl/adr/` and the
`projectCreatedAt` source manifest do not exist. We cannot invent creation dates.

OSS010/011 require OSS006 and OSS005 before translating ADRs 0001-0028. OSS005
consumes the slug map (soft dependency); OSS006 acceptance expects those later
translations and source imports. Requiring the strict repository check now would
block the tooling needed to prepare its own conforming input. ADR 0029 is outside
the original 28 translation tasks and needs an explicitly owned migration.

## Concrete sequence proposed for Owner acceptance

1. Deliver the exact 28-original English slug map, short template, process/index
   tooling, strict lifecycle checks and real positive/negative filesystem/Git
   fixtures. The map separates the immutable original 28 from later additions.
2. Keep `check:adr` strict: its actual nonzero legacy-input findings remain
   visible. Do not add a legacy pass flag, fabricate metadata/dates, rewrite old
   decisions, or call a fixture pass a repository migration result.
3. OSS005 imports its original 33 documents with source timestamps/notices.
   A separately approved migration follow-up supplies ADR 0029 provenance and
   a narrowly reviewed historical-metadata bridge; translating current files
   alone cannot make the current historical checker pass. OSS010/011 translate
   0001-0028 using the map/template and preserve all source decisions.
4. The migration follow-up coordinates the final collection, generated index
   and strict historical validation, then adds unconditional production CI
   enforcement only after the actual migrated set passes. Security protection
   for map/tools is added now; no translation/publication acceptance is granted.

This sequence requires an explicit Owner decision before treating OSS006 as
accepted. The previous SETUP006 staged acceptance does not authorize this one.

## Proposed acceptance split for an explicit Owner decision

Status: proposed, not approved. This section makes the requested sequence
reviewable; it does not change TASK section 11, check any remaining criterion,
authorize a merge or turn a failed command into a successful gate. Source
checkpoint `db53c0083188722dc1cacc498684c40fcd230f2c` includes the independently
requested self-link and JSON-privacy repairs. Their focused results are recorded
below; complete exact-head verification and reviews are still required.

### Exact proposed replacement for TASK section 11

`task:finish --done` compares the PR's checked criteria with the current task;
dependency readiness requires that task to be `done`. Leaving the current
production-migration boxes unchecked cannot unblock the dependent tasks. The
requested scope decision therefore includes replacing section 11 with the
following tooling-stage criteria, only after explicit Owner approval. These are
proposed text, not present acceptance evidence or edits to TASK:

- [ ] `slug-map.json` contains the exact 28 original identities, their canonical English slugs and preserved Polish names, separately from later ADRs; schema and duplicate/identity-denial fixtures pass.
- [ ] The template is shorter than 60 lines, contains the documented ADR and translation metadata, and the process README explains lifecycle, publication limits and the actual incomplete migration.
- [ ] The real public allocation CLI creates a valid next-free proposal in an isolated conforming Git repository, accounts for local, DEVELOP and remote task reservations, and refuses collisions or unavailable remote state without modifying existing ADRs.
- [ ] The strict checker passes a conforming fixture collection and rejects malformed metadata/JSON, missing or duplicate numbers, invalid names/references, deletion, unpreserved rename, invalid lifecycle transitions and unauthorized accepted/superseded body changes, including real Git history and filesystem boundary regressions.
- [ ] Real public index generation followed by `--check` succeeds on a conforming repository and rejects a changed generated table; real renumber dry-run preserves every input byte, apply preserves protected examples/archives and rewrites all affected links, and the strict checker passes the conforming result.
- [ ] The actual unmigrated repository's ADR/index checks are recorded as failures, with the exact deferred criteria and assigned migration owner below; no legacy-pass mode, invented dates, fixture index or false migration/publication success is introduced.
- [ ] All applicable exact-head tests, type/lint/build/security checks and independent Standards/Spec reviews pass, required hosted checks pass, and normal task/commit/merge protections remain in force.

Criteria for public allocation and conforming renumber/index validation are
deliverable now and are not deferred to production translation. Existing
function-level or real-Git fixtures do not substitute for any still-missing
public-command end-to-end evidence. That evidence must be produced before these
proposed boxes can be checked. After approval, the integrator would update the
TASK and PR criteria to this exact scope, discharge them with actual evidence,
then use normal `task:finish --done`. No task-tool readiness bypass is requested.

### Original criteria deferred to the migration owner

| TASK section 11 criterion | Current limitation | Required follow-up evidence |
| --- | --- | --- |
| 1. Original 28 mappings and every Polish original | The map supplies the 28 fixed original identities, but `docs/pl/adr/` and the source manifest do not yet exist. This is not a completed source-to-translation correspondence check. | OVE_OSS005 imports exact Owner sources and their verified hashes; OVE_OSS010/011 use those mapped names. Check one-to-one correspondence against the actual imported files. |
| 3. Strict check passes on translated originals | The actual command exits 1 at ADR 0001. Current files lack canonical metadata, and `history.ts` also parses their pre-migration Git versions. Current-file translation alone cannot fix this. Denied-case fixture coverage remains a current tooling criterion. | OVE_OSS005 supplies the original source provenance; OVE_OSS010/011 translate 0001-0028. The proposed migration owner supplies ADR 0029 and the separately reviewed exact historical bridge, then proves strict validation of the complete actual collection. |
| 4. Generated production index, including the 0001/0023 relationship | Pure rendering/staleness fixtures exist, but the live index cannot be generated from invalid legacy records. Its strict public check currently exits 1. | Generate the real index after migration, verify the reciprocal 0001/0023 metadata and notes, commit the generated result and prove `--check` succeeds. |
| 5. Validation of the final migrated production set after a renumber | Real conforming-repository renumber/check evidence is required in the current tooling stage; only the final migrated production-set proof is deferred. | The proposed migration owner proves strict final collection validation, retaining all link, archive and denied regressions. |

Original criterion 2 remains in the replacement's immediate public-CLI proof;
its historical 0029/0030 examples mean next-free allocation, not permission to
overwrite the existing records. Original criterion 6 remains in the immediate
README criterion. The replacement does not represent either as deferred.

### Bounded follow-up proposed for coordinator assignment

Proposed task title: **Legacy ADR provenance, historical validation and migration
closure**. The coordinator must allocate its ID, record a concrete implementer
and obtain the affected owners' scope approval before this split is accepted.
This proposal creates no task or claim. Hard prerequisites are OSS005's source
import and OSS006's accepted tooling stage; OSS010/011 are coordinated migration
inputs, not a new hard dependency that prevents historical preparation before
their translations can be validated. The follow-up prepares historical proof
first and closes only after the actual translations are integrated/validated.

Its proposed bounded ownership is:

- ADR 0029 only: obtain the exact Owner source/export and a verifiable source
  creation date, archive its bytes at
  `docs/pl/adr/0029-backlog-w-github-issues-i-ochrona-master.md`, register its hash,
  source date and English mapping through the OSS005 manifest/importer contract,
  and produce its faithful canonical English ADR with full provenance. OSS005's
  current 33-document requirement ends at ADR 0028; it is not silently expanded.
  If date/source evidence is unavailable, this portion remains blocked for an
  explicit Owner source decision; Git commit time is not substituted silently.
- The exact historical-metadata proof and its narrowly scoped reader in
  `tools/adr/history.ts`, plus real positive/negative historical regressions.
  New proof data would have an explicitly owned path under `docs/adr/`, protected
  by the existing Owner configuration policy; its schema/path require design
  and security review before implementation.
- Final collection closure: coordinate the OSS010/011 outputs, regenerate
  `docs/adr/README.md` from real validated records, prove strict ADR/index checks
  against the complete current set, and make those commands mandatory in the
  existing architecture CI registry with protected negative workflow tests.
  Shared CI edits belong to the integrator; no duplicate permissive checker is
  introduced. Publication remains blocked until its separate translation review
  and Owner approval requirements pass.

OSS010/011 retain ownership of translations 0001-0028; their requirements,
statuses and scope are not edited here. The coordinator must record how their
existing validation criteria are discharged on the combined migrated candidate,
rather than inventing a pass on a partially translated set. OSS013 retains
translation review. The follow-up's exact scope/criteria and owner assignments
must be accepted with this split; a vague promise of a later fix is insufficient.

### Historical metadata is a separate migration boundary

The current `history.ts` enumerates same-number revisions and calls `parseAdr`
on every historical blob before lifecycle checks. Old Polish blobs lack that
metadata. Neither an English HEAD nor an archived copy changes those Git blobs.
The current implementation therefore remains correctly nonzero after a mere
current-file translation, and its final passing result cannot be promised
without additional reviewed migration work. Git history must not be rewritten.

The follow-up must propose a finite, Owner-reviewed mapping of exact historical
commit/path/blob hashes to evidenced metadata and source lineage. It must retain
the actual legacy body bytes and validate meaningful lifecycle/body invariants
between those historical versions, rather than skipping an arbitrary prefix of
history. Unknown hashes, omitted revisions, duplicate identity, missing archive,
unproved status/date or changed proof must fail closed. Creation dates and
historical status changes require source evidence or an explicit Owner decision.

The legacy-to-English transition additionally needs exact preserved source
hashes and reviewed translation provenance. An accepted-body translation must
remain an explicit reviewed edit; an already superseded legacy decision needs
a specifically reviewed translation boundary that preserves the immutable raw
source and establishes the exact reviewed English body. Subsequent changes must
still obey the normal immutable-body/lifecycle rules. No generic label, date
cutoff, unbounded hash exception, catch-and-continue or legacy-pass switch can
stand in for that proof. Tests must reject source/body tampering on either side
of the transition, missing history entries and unsupported new legacy inputs.
The precise proof schema and algorithm are intentionally not implemented here;
they require their own Spec/Standards/security approval before production use.

### Interim behavior and integration blockers

The proposed first stage delivers the map, template, process documentation and
strict tools so the dependent migration can proceed. Existing ADR files remain
unchanged; preserved Polish archives must stay byte-identical. Allocation denies
unavailable remote state. Parsing, immutable-history checks, configuration
approval protections and malformed-input privacy continue to fail closed.
Both live ADR/index commands must continue to report their actual legacy failure
until the inputs conform. The generated index must not be replaced with fixture
rows, guessed dates or a table falsely presented as validated production data.

Integration is blocked now by the absence of explicit staged acceptance, the
remaining complete exact-head test/security/hosted results and fresh independent
reviews. The recorded shared-unit deadline failures are unresolved evidence,
not waived checks. The separate safety-test classification section remains a
proposal; acceptance of staging alone would not authorize that workflow change,
extend any timeout or excuse a failing test. Rebase/shared integrations and normal
task/commit/PR protections still have to pass before any agent merge to DEVELOP.

Public release remains blocked by the untranslated/unreviewed originals and
their existing translation/publication requirements. Successful tooling-stage
integration would not imply a publishable ADR collection or change the Owner's
security decisions.

### What explicit approval would change

The requested decision would authorize the exact tooling-stage replacement
criteria above, creation/assignment of the bounded migration follow-up, and
integration of OSS006 only after the replacement criteria actually pass. Normal
`task:finish --done` could then establish dependency readiness without pretending
the original production-migration criteria were fulfilled. Those original
obligations move explicitly to the accepted follow-up and translation scopes;
they are not deleted or checked. Approval alone checks no tooling criterion.

The sequence is OSS006 tooling, OSS005 source import, reviewed historical proof
preparation, coordinated OSS010/011 and ADR 0029 migration, then actual final
index/check results and unconditional production enforcement. The final history
reader can change only through the separately reviewed bounded migration design
above; this decision is not approval of an unimplemented exception mechanism.

Approval would not waive security, tests, independent review, exact-head hosted
checks, source provenance, translation fidelity or final publication approval.
It would not authorize translations here, changes to normative decisions,
fabricated creation dates, a legacy-pass mode or unconditional enforcement while
the production command still fails. Until the Owner explicitly approves this
specific split, OVE_OSS006 remains unaccepted and no staged merge is authorized.

## Shared changes requested from the integrator

- Root scripts: `adr:new`: `tsx tools/adr/new.ts`; `gen:adr-index`:
  `tsx tools/adr/gen-index.ts`; `check:adr`: `tsx tools/adr/check.ts`;
  `adr:renumber`: `tsx tools/adr/renumber.ts`. No dependency additions.
- `.github/CODEOWNERS`: `/docs/adr/ @wojciechlesniak` and
  `/tools/adr/ @wojciechlesniak`.
- Existing configuration integrity gate: protect `tools/adr/` and
  `docs/adr/{slug-map.json,_template.md}` with actual negative regressions.
  Use the `config-change` PR label for those sensitive changes.
- CI: add strict ADR/index checks to the existing architecture registry once the
  explicit acceptance sequence and actual migration permit enforcement. Until
  then report the command's real legacy failure in acceptance evidence.

## Current integration branch and numbering

The Owner-authorized base is DEVELOP, overriding TASK's historical origin/main
example. Allocation must consider current files, freshly fetched origin/DEVELOP
and validated remote task heads. ADR 0029 and 0030 already exist; without a higher
reservation the next proposal is 0031. A remote lookup failure denies allocation.
No remote text or document content is executed or grants acceptance authority.

## Implemented safety details for review

The shared four scripts, exact CODEOWNERS paths and configuration-gate protection
were explicitly approved by the integrator and applied with real negative tests.
No unconditional ADR CI enforcement was added. Both actual production commands
will remain nonzero until the legacy records acquire valid metadata.

Archival proof preserves a path, never waives lifecycle or body checks. A mapped
rename needs complete translation provenance, the exact original preserved
byte-for-byte at its established archive path and a matching checksum. History
is checked through previous same-number paths: accepted body changes still need
`adr-edit`, invalid status transitions fail, and superseded bodies are immutable.
The original 28 identities and published additional number/slug/source identities
stay immutable against DEVELOP; titles may change without a file rename, and a
new unpublished proposal may be renumbered. Existing nonnormative legacy history
still needs an explicitly reviewed migration plan; these tools do not infer its
missing dates or grant a translation/body exception. Original source dates and
translation acceptance belong to the named translation owners.

Inline and reference-style repository-relative links are rewritten only when
they resolve to the exact renamed proposal; matching external URL basenames are
preserved. Archived Polish originals cannot be rewritten. Renumbering refuses
ambiguous proposals, occupied targets and supersession references that need a
separate reviewed identity migration. The default is always a dry run.


## Review repair: shared Markdown parser proposal (pending OSS004 integration)

The independent review demonstrated that regex-based heading checks accept a
second H1 indented by two spaces and a Consequences heading present only in an
HTML comment or indented fenced code. The renumber rewrite misses valid inline
link titles and angle-wrapped Markdown destinations. New denied/rewriting fixtures
record those cases; they must pass before final review and acceptance.

OSS004 owns the approved markdownlint/micromark parser in
`tools/docs-check/markdown.ts`. Once that task merges, reuse its public `headings`
function instead of ADR-local heading regexes. Request one small additional
I/O-free `linkDestinations` API that returns each explicit Markdown destination
once, decoded target plus raw UTF-16 start/end offsets excluding angle wrappers
and titles, and associated source label ranges for ADR display-number updates.
The API must use actual micromark resource/definition/reference tokens and preserve
reference labels/definitions, code, comments, CRLF, titles and escaped/entity
syntax. Consumers plan span edits against the original source and apply them in
descending offset order, rejecting overlaps or source changes. Its own tests must
cover inline and reference destinations, titles, angle wrappers, fences/comments,
Unicode columns and CRLF. No unmerged runtime import, copied parser, regex growth
or new dependency in OSS006 is authorized by this proposal.

The production Git port also needs a separate environment from fixture isolation.
The integrator approved removing inherited Git repository/config/trace selectors
while preserving normal HOME/XDG/system/global config discovery and only these
transport variables: GIT_SSH, GIT_SSH_COMMAND, GIT_SSH_VARIANT, GIT_ASKPASS,
GIT_SSL_CAINFO, GIT_SSL_CAPATH, GIT_PROXY_COMMAND. Interactive prompting stays
disabled; existing argv, timeout, output bound and ignored stdin stay intact.
Tests use fake HOME/XDG paths and a harmless credential-helper marker, never real
Owner config or credential values. Fixture Git still uses isolatedGitEnvironment.


Review-repair evidence: the genuine public CLI archival-rename attack returned
success before the repair on a valid 30-accepted-ADR Git baseline. It is now
denied. A fixed mapped translation retains prior history, accepted body changes
need `adr-edit`, and an accepted-to-proposed downgrade is denied even with that
label. All 4 focused real-Git tests across 3 files passed in 9.99 seconds; the
pure Git-environment test passed in 0.161 seconds. The Markdown regressions are
still deliberately failing pending the shared parser change. No full check,
final review or acceptance is claimed for this intermediate repair.

## Concrete shared parser API proposal after OSS004 merge

Status: proposed implementation shape for integrator review, not applied or tested.
OSS004 merged as `b2354d43a9730c25b521e5b14a7019d4f90962df`. OSS006 must
checkpoint and rebase onto the actual integration head before importing its code.
The following shared edits need the integrator's application or explicit approval;
this proposal does not itself change the ownership boundary.

### Public interface and responsibility

Add `tools/docs-check/markdown-destinations.ts` with this I/O-free interface:

```ts
export interface MarkdownSpan {
  readonly start: number;
  readonly end: number;
  readonly raw: string;
}
export interface MarkdownLinkLabel {
  readonly text: MarkdownSpan;
  readonly referenceSuffix?: MarkdownSpan;
}
export interface MarkdownDestination {
  readonly target: string;
  readonly destination: MarkdownSpan;
  readonly labels: readonly MarkdownLinkLabel[];
}
export function linkDestinations(md: string): readonly MarkdownDestination[];
```

Offsets are zero-based UTF-16 indices into the original, unmodified `md`; `end`
is exclusive. Every span guarantees `md.slice(start, end) === raw`. A destination
span excludes angle wrappers and the title. `target` is its Markdown-decoded
value, using the same entity/escape decoding as the existing link extractor.
An inline link or image has its visible label's inner source span. A reference
definition owns its destination once and associates the labels of actual uses;
the first matching definition resolves duplicate keys, as in the parser. Full,
collapsed and shortcut references retain their original definition keys.
`referenceSuffix` covers the explicit `[key]`, the collapsed `[]`, or a
zero-length insertion position immediately after a shortcut's closing bracket.
It is absent for inline links. This lets a consumer change display text while
expanding a collapsed/shortcut reference to its unchanged original key.

Only actual resource, definition and resolved reference tokens participate.
Fenced/indented code, comments, escaped pseudo-links, undefined references and
HTML source are not rewrite destinations. Autolinks cannot point at a relative
ADR file and need no rewrite API. No HTML parser, filesystem access, execution,
dependency addition or independent Markdown grammar is introduced.

### Minimal module split

- Move the existing `parseMarkdown`, `flatten` and `stringValue` implementations
  unchanged from `markdown.ts` into `markdown-parser.ts`. Their shared return and
  token types remain internal to the tools. This is the single existing parser
  invocation and decoding implementation, reused by both consumer modules.
- Keep the existing public `slug`, `headings`, `extractLinks`, `markdownLines`
  and `markdownFrontMatter` exports in `markdown.ts`, importing those helpers.
  Add no facade or re-export of the new destination API there.
- Implement only token association and source-span mapping in
  `markdown-destinations.ts`; ADR code imports that module directly. The import
  direction is both public modules to `markdown-parser.ts`, with no reverse
  imports, cycles, caches, builders or injected parser abstractions.

### Verified installed-source position semantics

These observations come from reading the installed sources, not runtime probes:
`markdownlint/lib/markdownlint.mjs:lintContent` strips one initial BOM, removes
recognized front matter and parses the remaining content before clearing HTML
comment text. `micromark-parse.mjs:getText` slices the parser input using event
offsets, but the public token exposes only line/column/text, not those offsets.
`parseInternal` also reparses non-comment HTML-flow children with normalized LF;
the destination API must exclude those synthetic HTML descendants.

In pinned `micromark@4.0.2/lib/preprocess.js`, a tab becomes a tab marker plus
virtual padding to four-column stops. However, `create-tokenizer.js:consume`
does not increment column or offset for virtual-space code `-1`. A physical tab
therefore advances the exposed position by one UTF-16 unit, not four visual
columns. String chunks are consumed with `charCodeAt`, so a surrogate pair
occupies two units. CRLF advances the line once and the offset by two; bare CR
and LF advance by one.

Build raw line-start indices from the original string, retaining CRLF, bare CR,
LF and the initial BOM. Resolve token lines after the parser's front-matter line
offset; account for the removed BOM only when the parsed line is also the first
raw source line (front matter may already consume that line). Resolve
columns in raw UTF-16 units without expanding tabs. Validate integer bounds,
line membership and complete token-text slice equality before returning a span.
An unrepresentable or mismatching token fails closed rather than searching for
similar text elsewhere or guessing an edit. Tests must lock down this pinned
position behavior before the shared change is accepted.

### ADR consumer and actual RED-to-GREEN plan

First rerun the existing failing heading and titled/angle-link regressions on the
rebased, otherwise unchanged source. Record their actual failure before edits.
Then use `headings(body)` for exactly one visible level-one title and the required
visible level-two Consequences section. Add a raw-HTML-block case because the
installed parser's HTML child reparsing must not turn hidden examples into ADR
headings; make a shared correction only if that actual regression demonstrates it.

For renumbering, select only destinations resolving to the exact old ADR path.
Preserve external matches, unrelated same-number ADRs, titles, angle wrappers,
reference keys, fragments and untouched escape/entity source. Plan destination
and display-number edits against the original spans. A changed collapsed or
shortcut label gets its original reference key explicitly appended; the key and
definition label are never renumbered. Validate that every edit still matches
its original slice, reject overlapping edits, then apply edits in descending
offset order. Existing filesystem replacement checks and Polish-archive refusal
remain mandatory. Ambiguous source serialization fails closed.

Focused shared tests must cover inline links/images and definitions/uses before
and after the definition; full, collapsed and shortcut references; duplicate
definition resolution; titles and angle wrappers; escaped/entity destinations;
fake links in code/comments/HTML; Unicode including a surrogate pair; tabs before
tokens; BOM/front matter; and mixed CRLF/LF/bare-CR source slices. ADR regressions
must prove second-H1 and hidden-Consequences denial, preserved visible heading
examples, real titled/angle/reference link rewrites, unchanged external/archive
targets, dry-run byte identity and unchanged non-target syntax. Run those scoped
tests only after the integrator releases CPU. Full checks and independent reviews
follow the focused GREEN; actual legacy metadata failures remain failures.

### Actual pre-implementation Markdown reproduction

The security checkpoint `112eb9f` passed the normal hooks, including zero secret
findings, after scoped strict test typing and required style fixes. Rebase onto
the exact OSS004 integration head completed as `cb8aa69`; the three shared-file
conflicts retained both the existing protections and the additive ADR entries.
The generated lockfile, catalog and dependency register stayed byte-identical to
DEVELOP. Normal frozen install reused all 45 missing entries, downloaded none,
and ran prepare. Primary Owner-file, index and common-configuration hashes stayed
unchanged across these operations.

Before any Markdown implementation, the exact existing records/renumber tests
selected by name returned five failures and four skipped tests in 556 ms. They
reproduced accepted indented second H1, comment-only and indented-fence-only
Consequences; rejected valid fenced/commented H1 examples; and missed real titled
and angle-wrapped renumber destinations. The local capture is named
`ove026-markdown-red-cb8aa69.log` outside the tracked tree. The shared implementation
and additional regressions are now being prepared as source only while another
task holds the timed verification slot. No GREEN or final review is claimed yet.

### Focused shared Markdown verification

The new raw-HTML-heading regression first failed on the unchanged heading
behavior: one failed test, eight skipped, 450 ms. The parser reported both hidden
HTML-block headings as visible. The authorized narrow ancestor check now excludes
only those synthetic HTML descendants; link extraction and the existing heading
rules are otherwise unchanged. The failed capture remains available as
`ove026-rawhtml-red-cb8aa69.log` outside the tracked tree.

The first focused batch passed 19 tests and failed one valid-example fixture.
Its indented fence continued the preceding list, while an unindented example H1
ended that list/fence and therefore rendered as another heading. A normal
`Examples:` paragraph now ends the list before the same two-space fence,
unindented H1 and comment example; the expected assertion is unchanged. Reference
fixtures also separate definitions from paragraphs so they exercise actual
CommonMark reference links, rather than a regex-only imitation.

The unchanged named batch then passed 20 tests across five files in 1.33 seconds,
with 12 unrelated tests explicitly skipped: nine original-source span cases,
five pure consumer cases, three denied heading cases, the valid fenced/commented
example, the real dry-run/apply/archive renumber fixture and the HTML-heading
regression. It proves the scoped real RED-to-GREEN, not complete docs/ADR checks.
Both the failed first batch and successful capture are retained outside the
tracked tree as `ove026-markdown-first-batch.log` and
`ove026-markdown-focused-green.log`. Full shared regression, typing, lint,
security, independent reviews and the explicit Owner acceptance decision remain
pending. No new package, policy exception or fabricated legacy pass was added.

### Complete applicable batch: real failures remain blocking

Two additional label regressions first failed because a raw label match could
change an ADR number inside inline code or an HTML comment. The minimal guard
now refuses the entire ambiguous operation before any write, without attempting
another markup parser. The actual pair changed from two failures in 2.20 seconds
to two passes in 0.97 seconds. Original outputs remain in the local captures
`ove026-label-red.log` and `ove026-label-green.log`.

Full `pnpm typecheck`, full `pnpm lint` including React/Tauri checks, and all
changed-source format checks then passed before the complete applicable suites.
The shared docs/ADR unit batch passed 75 tests and failed two ordinary 5000 ms
deadlines in 15.90 seconds: inherited documentation Git index isolation at
8047 ms, and the real ADR CLI/FIFO/symlink safety test at 5152 ms. Neither failure
was an integrity assertion, and neither was retried or assigned a larger budget.
The inherited OSS004 classification repair belongs to the integrator's separate
ARCH003 integration, not a duplicate edit here. All new span/consumer/heading
cases and the actual dry-run/apply/archive assertions passed in this full batch.

The actual ADR integrations passed five tests across four files in 25.22 seconds.
Both public strict production commands returned exit 1 for the first legacy
ADR's missing metadata, as intended; neither is called a migration pass. The
first sandboxed invocation was prevented by tsx's local IPC boundary, so those
failure logs were retained separately before the authorized normal execution
confirmed the actual metadata finding. Primary Owner-file, index and shared Git
configuration hashes remained unchanged. Complete captures are retained as
`ove026-shared-unit-batch.log`, `ove026-adr-int-batch.log`,
`ove026-legacy-check.log` and `ove026-legacy-index.log` outside the tracked tree.
There is no complete-suite PASS, final acceptance or merge approval.

### Proposed classification of the actual CLI safety integration

Status: proposed only; no source move, workflow edit or budget change is applied.
The complete-batch failure above is the reproduction. This test launches real
Node CLI children and exercises real POSIX FIFO/symlink/filesystem boundaries;
it belongs to integration discovery, as do the task's existing real Git tests.

Request approval for an exact byte-preserving rename from
`tools/adr/safety.test.ts` to `tools/adr/safety.int.test.ts`. Preserve every
assertion, platform condition, unique fixture, 5000 ms outer deadline and 3000 ms
child bound. Do not add retries, worker/coverage changes or a timing exception.
After the separately owned ARCH003 CI repair is integrated, add one required
shard-1 step after covered units in the existing matrix with exactly:

```sh
pnpm exec vitest run --config vitest.int.config.ts tools/adr/safety.int.test.ts
```

Extend that repair's existing protected integration-gate table with this exact
name/command. Reuse its one schema/validator and genuine workflow mutations for
removal, unrelated command, absent shard, wrong ordering, allowed failure and
missing aggregate dependency. Keep the existing catalogue and documentation Git
steps, all configuration approval protections and CODEOWNERS. Normal local
integration discovery must include the renamed file. The focused actual public
command, unchanged complete integration workload, remaining units and all exact
head gates must pass before claiming this classification fixed the problem.
If its unchanged budget still fails, retain the failure and stop that claim.

### Independent review repair: proposal self-links

Specification review of `e089c99` found that traversal skipped the proposal being
renumbered and later rendered its original body. A valid link to its own old
filename therefore broke when that file was removed. The existing real
dry-run/apply regression now includes a self-link to a real Confirmation section,
with a title and fragment, plus an inline-code example that must remain exact.
Dry-run additionally compares the complete original proposal and slug-map bytes.

Before implementation, the exact named regression failed at its full-body
comparison: the actual self-link still used 0030 instead of the expected 0031.
The local capture `ove026-self-link-red.log` retains that real failure (one failed,
one skipped; 901 ms). The minimal correction applies the existing original-span
rewriter to the proposal body before rendering its new metadata; there is no new
parser, public API or link regex. Both complete affected test files then passed
nine tests in 1.07 seconds, including the preserved code example and prior denied
cases; capture: `ove026-self-link-green.log`. Full verification, independent
review of the corrected head, the two recorded timing failures and explicit
Owner staged acceptance remain unresolved by this focused result.

### Independent review repair: private JSON diagnostics

Standards review of `e089c99` identified that native JSON parse diagnostics could
repeat file contents through the CLI's error message. Two real public CLI
regressions use short runtime-generated markers in malformed slug-map and event
JSON. Each captures bounded child output and uses boolean assertions so neither
the input nor marker is exposed by a failed test report. Both cases genuinely
failed because the captured output contained the marker; the original capture
is `ove026-json-privacy-red.log` (two failed, one skipped; 1.06 seconds).

The minimal correction catches parser/schema failure directly at each affected
JSON boundary, emitting only `Invalid ADR slug-map JSON` or
`Invalid GitHub event JSON`. It adds no redaction pattern, framework, dependency
or permissive fallback. The same two CLI cases passed with one worker in 987 ms;
the existing 3000 ms child and default 5000 ms per-test limits are unchanged.
Capture: `ove026-json-privacy-green.log`. Scoped strict test TypeScript, ESLint
and changed-source formatting passed. This narrow result does not claim a full
suite, resolve the recorded deadlines/legacy migration or grant staged acceptance.
Fresh independent review and all applicable exact-head gates remain required.

### Actual complete-gate attempt and pending-link integration repair

The serial gate attempt at `6960b09` ran the actual `tools/ci/check.ts` list in
order through an external guarded runner. Only coverage and integration worker
counts were set to one; assertions, deadlines, thresholds and retry count were
unchanged. The runner imported the original manifest-schema reader for desktop
conditional selection and preserved all original security/Rust/SBOM gates.

Covered tests passed 539 across 99 files in 86.75 seconds; integrations passed
70 across 20 files in 172.84 seconds; build passed. Architecture's dependency
policy and four real CLI integrations also passed. The run then failed closed
at `check:docs`: `pending-links.json` still marked this task's newly created
`docs/adr/README.md` as absent. It reported one stale-entry error and 38 warnings.
Workflow lint, license/audit, Rust and secret/SBOM gates were not reached; there
is no full-list PASS. Captures remain `ove026-full-gates-6960b09.log` and
`ove026-full-gates-6960b09.receipts.jsonl` outside the tracked tree.

The integrator explicitly approved deleting only that stale pending entry.
The three other pending entries and the strict stale-entry rule remain intact;
the actual complete-gate failure is the regression evidence for this data fix.
Fresh delta reviews and a complete exact-head gate attempt remain required.
This approval grants no staged acceptance or normative criteria change.
After this correction, actual `pnpm check:docs` returned zero errors and
38 warnings; capture: `ove026-pending-link-green.log`. Scoped JSON formatting
also passed. Neither result substitutes for the remaining complete gate list.

### Exact gate evidence before the public-CLI history optimization

At `00ff7c4`, the real gate list with only one coverage/integration worker passed
539 covered tests across 99 files (98.95 seconds), 70 integrations across 20
files (191.24 seconds), build, architecture including four public dependency CLI
tests, workflow lint, npm licenses/audits and Rust deny/fmt/Clippy/33 tests. The
original attempt then failed at the original `install("cargo-audit")` download
with `UND_ERR_SOCKET`. That failure and its receipts remain preserved; there is
no original complete-wrapper PASS.

The integrator approved repairing only this network prerequisite from an existing
regular unlinked archive with no symlink components. An exclusive byte-identical
copy was checked against the unchanged locked SHA before the original installer
repeated checksum/member/extraction validation. Only the failed/unreached suffix
then ran, in its original order: cargo-audit, the actual original manifest-schema
reader/conditional, secret scans and SBOM. Cargo audit passed with its existing
five allowed warnings; secret scans each found zero secrets and one Keychain
warning; SBOM contained 886 components. No paired desktop scripts or GitHub event
were present, so only their original conditional paths were unselected. Actual
production ADR/index commands separately exited 1 on legacy ADR 0001 metadata.

The truthful result is the failed initial attempt plus a passing complementary
continuation at the same unchanged source/head. Captures are
`ove026-full-gates-00ff7c4.log`, `ove026-remaining-gates-00ff7c4.log`, their receipts,
`ove026-gates-and-legacy-00ff7c4.final-result.json`, and the separate
`ove026-production-adr-00ff7c4.log`/`ove026-production-index-00ff7c4.log`.
Primary Owner-file/index/configuration and actual primary HEAD guards remained
unchanged. No security check was waived or counted before execution.

### Actual public CLI proof and bounded immutable history reads

The new public CLI integration uses a unique real bare origin/local repository,
isolated Git environment and fresh HOME/XDG, with cleanup on setup failure and
after each case. The first case proves actual public allocation from local,
DEVELOP and remote-task reservations and no writes when the origin is unavailable.
The second retains all 31 published structured ADRs: actual check, new proposal,
duplicate denial, renumber dry-run/full byte snapshot, apply/link/self-link and
protected-example assertions, check, index generation/check, stale-table denial
and final check. The public CLIs run real Node/tsx subprocesses; direct function
calls do not replace these success assertions.

The initial attempt passed allocation but timed out on the second case's first
check child at its existing 3000 ms bound; no functional denial was claimed.
A single external in-process diagnostic, with unchanged limits and no content/
environment logging, completed 97 Git calls before that bound. It measured 24
identical tree reads at 577.453 ms total, including 523.913 ms beyond the first.
Neither the real published history nor its assertions were reduced.

The minimal correction caches only successful validated tree-path reads under
canonical immutable SHA keys inside one `checkHistory` invocation. Admission is
bounded to 32 entries and 4 MiB retained UTF-16 text accounting, not a claim of
exact total heap storage. A full budget skips admission, never validation;
errors, mutable refs, filesystem state and other Git reads are not cached.
The existing per-record history/path/output bounds, transition checks and
approval-label behavior remain unchanged.

The normal observer-free public CLI pair then passed in 11.22 seconds with its
original 3000 ms child and 15000 ms case limits and one worker. Full workspace
typecheck and full lint passed. The formatter corrected only new test layout;
all changed sources then passed formatting and remain below 200 lines. Complete
ADR integrations passed seven tests across five files in 22.45 seconds; shared
ADR/docs units passed 76 across 20 files in 6.68 seconds. Original failed and
diagnostic captures remain separate from GREEN captures; there was no unchanged
retry, timeout increase or history reduction. New-source full gates and fresh
independent reviews are still required before any integration/acceptance claim.

The separate OSS014/015 and replacement-staging drafts remain outside this
worktree for review. No task, dependency, criterion or approval is created by
those drafts; the tracked normative TASK and current acceptance blockers remain
unchanged pending an explicit Owner decision.

### Independent public allocation-source verification

Spec review of `088f2bd` found a coverage gap: a remote task number above both
the local and DEVELOP numbers could hide an implementation omitting either
lower source. The original reservation/unavailable-origin and full published
history renumber/index cases remain unchanged. Two separate actual CLI cases
now exercise each other source as the deciding maximum.

The local case keeps published numbers at 30, adds local reservation 37 and
requires the public CLI to create 38 while preserving that reservation and HEAD.
The DEVELOP case uses a real second clone to commit/push reservation 44 after
the tested checkout exists. It first verifies that checkout's remote-tracking
ref is stale, then requires the public CLI to fetch and allocate 45, advance the
tracking ref to the actual published commit, and preserve the local HEAD/branch
without checking out the remote file. Every fixture Git call stays isolated
with fresh HOME/XDG; all fixtures clean up normally. No production change was
necessary.

The one ordinary baseline passed all four public CLI cases in 17.51 seconds,
with unchanged 3000 ms child/15000 ms case deadlines, one worker and no observer
or retries. Capture: `ove026-public-cli-independent-sources-baseline-088f2bd.log`.
Configured formatting, full workspace typecheck and scoped lint then passed;
no tests were repeated after layout-only formatting. Current criteria/status,
unapproved staged scope and all exact-new-head gate/review obligations remain.
