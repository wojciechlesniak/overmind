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
3. OSS005 imports source timestamps/notices, OSS010/011 translate 0001-0028 using
   this map/template, and an explicitly assigned task migrates ADR 0029. Those
   owners update the index and demonstrate strict repository validation.
4. Activate unconditional production CI enforcement only after that migration
   passes the same strict command. Security protection for map/tools is added
   with this task. No translation/publication acceptance is granted here.

This sequence requires an explicit Owner decision before treating OSS006 as
accepted. The previous SETUP006 staged acceptance does not authorize this one.

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
