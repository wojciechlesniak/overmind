# OVE_OSS004: fixes after independent reviews of eecfea6

Status: implemented; final heavy gates, new independent reviews and CI pending.
The existing gates and allowlists remain unchanged. Heavy checks wait for the
integrator's CPU reservation; scoped regressions use unique temporary fixtures.

| Finding | Real RED evidence | Implemented correction |
| --- | --- | --- |
| BOM draft front matter | Full pure publication check returned no diagnostics | Recognize BOM and both YAML end markers; reject incomplete metadata |
| Precheck/open/read race | A real grown file was read before denial; raced FIFO requested a blocking open | Nonblocking no-follow open, descriptor validation before content, bounded positional reads, identity/change checks |
| Character references | Numeric/named headings became empty anchors; encoded destinations lost characters before policy checks | Decode recognized references through the approved public entities API as inert data |
| Inventory used as existence proof | Real deleted tracked assets/LICENSE and escaping asset/LICENSE symlinks returned exit 0 | Keep trusted inventory separate from actual canonical same-device regular-file targets |
| GitHub anchor variants | Connector punctuation/math vanished and valid top links failed | Retain Unicode Word categories and math text; accept the reserved top fragment for Markdown targets |
| Runner ownership | SETUP021 owns self-hosted-runner.md; SETUP022 owns task linting | Correct only the engineering index owner |

Additional real descriptor regressions prove that an inode replaced at open is
rejected before reads, and a file grown during reading consumes at most one MiB
plus the overflow-detection byte. FIFO fixtures interpose only at the OS open
boundary and use actual filesystem nodes/descriptors; an unsafe blocking open is
stopped inside the fixture to avoid hanging the test process.

The installed official MD051 was also queried directly: the variation selector
following the coffee symbol survives the Unicode Mark filter. The earlier emoji
expectation was incorrect; the implementation and regression now match that
actual rule instead of deleting combining marks.

## Preserved upstream limitation

An actual direct call to markdownlint 0.41.1 reports MD051 for a same-document
numeric-reference heading followed by its correct decoded fragment. The core's
own rule currently omits character references; our cross-document resolver is
corrected. MD051 remains enabled and its diagnostics are not filtered or waived.
No existing repository document relies on that upstream edge case. This is a
disclosed upstream false positive, not a claim that every core variant passed.

The narrowly approved direct entities 7.0.1 adoption is recorded separately in
[its dependency proposal](OVE_OSS004-entities-adoption.md). The generated lockfile
changes only catalog/importer links, with zero package-version/transitive changes.
No private primary worktree file was edited.
