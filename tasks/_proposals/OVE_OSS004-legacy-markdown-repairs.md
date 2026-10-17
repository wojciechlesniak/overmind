# OVE_OSS004: mechanical repairs required by the new documentation gate

Status: applied in the isolated task worktree after explicit integrator approval; review pending.
Evidence: actual tracked-source check on task/OVE_OSS004, 2026-10-17. The initial
Markdown engine run reported 147 diagnostics in nine existing files. The complete
checker additionally found publication-sensitive path examples in two research
files. Diagnostics below contain only repository paths and static rule messages.
No private path value, email, token or document payload is reproduced.

## Proposed narrow repairs

- Surround existing lists with blank lines (MD032), align existing table delimiter
  spacing (MD060), collapse redundant blank lines (MD012), and wrap real bare
  external URLs in Markdown autolinks (MD034). Preserve words, links and decisions.
- Treat the registry endpoint placeholder as inline code, preserving its literal
  placeholder text; it is an example, not a reachable URL or HTML tag (MD033/34).
- Escape the leading hash of the PR-number prose in docs/engineering/ci.md. Do not
  turn a PR reference into a heading or alter its evidence.
- Configure MD025's front_matter_title as empty so metadata's title does not count
  as a second rendered H1. Continue enforcing exactly one actual H1; regression
  tests must reject two H1s. The existing ADR 0030 has one H1 and valid metadata.
- Redact the two historical private-host path examples in the committed isolated
  copy of docs/research/prototyp-wnioski.md to a neutral workspace-root label.
  Remove the file-URL scheme from three synthetic stack frames in
  docs/research/engine-packaging-spike.md, retaining their relative source/line
  information. No measured result or security conclusion changes.

The affected paths are the nine Markdown-engine files listed below plus
research/engine-packaging-spike.md. This does not translate Polish, add ignores,
disable rules or change product scope. OSS005 depends on OSS004, so waiting for
translations before activating the gate would deadlock their acceptance.

## Owner's local research edit

The primary checkout contains an Owner modification of prototyp-wnioski.md. This
proposal concerns its committed copy in the isolated task worktree only. The
primary file must remain untouched, including on integration. Parent must retain
its SHA-256 and handle a future overlapping fast-forward explicitly; never reset,
stage or overwrite the Owner's local copy. A clean gate cannot be claimed until
these repairs and all checker regressions pass independent review.

## Exact pre-repair diagnostic locations

File | Line | Level | Rule | Result
--- | --- | --- | --- | ---
docs/adr/0024-zakres-mvp.md | 4 | error | MD032 | Lists should be surrounded by blank lines
docs/adr/0027-skill-overmind-dla-agentow.md | 4 | error | MD032 | Lists should be surrounded by blank lines
docs/adr/0030-engine-packaging-and-sqlite-driver.md | 12 | error | MD025 | Multiple top-level headings in the same document
docs/dependencies.md | 76 | error | MD034 | Bare URL used
docs/dependencies.md | 77 | error | MD034 | Bare URL used
docs/dependencies.md | 78 | error | MD034 | Bare URL used
docs/dependencies.md | 79 | error | MD034 | Bare URL used
docs/dependencies.md | 80 | error | MD034 | Bare URL used
docs/dependencies.md | 81 | error | MD034 | Bare URL used
docs/dependencies.md | 82 | error | MD034 | Bare URL used
docs/dependencies.md | 83 | error | MD034 | Bare URL used
docs/dependencies.md | 104 | error | MD034 | Bare URL used
docs/dependencies.md | 105 | error | MD034 | Bare URL used
docs/dependencies.md | 106 | error | MD034 | Bare URL used
docs/dependencies.md | 107 | error | MD034 | Bare URL used
docs/dependencies.md | 109 | error | MD034 | Bare URL used
docs/dependencies.md | 193 | error | MD034 | Bare URL used
docs/dependencies.md | 206 | error | MD034 | Bare URL used
docs/dependencies.md | 219 | error | MD034 | Bare URL used
docs/dependencies.md | 232 | error | MD034 | Bare URL used
docs/dependencies.md | 245 | error | MD034 | Bare URL used
docs/dependencies.md | 258 | error | MD034 | Bare URL used
docs/dependencies.md | 271 | error | MD034 | Bare URL used
docs/dependencies.md | 284 | error | MD034 | Bare URL used
docs/dependencies.md | 297 | error | MD034 | Bare URL used
docs/dependencies.md | 310 | error | MD034 | Bare URL used
docs/dependencies.md | 323 | error | MD034 | Bare URL used
docs/dependencies.md | 336 | error | MD034 | Bare URL used
docs/dependencies.md | 349 | error | MD034 | Bare URL used
docs/dependencies.md | 362 | error | MD034 | Bare URL used
docs/dependencies.md | 375 | error | MD034 | Bare URL used
docs/dependencies.md | 388 | error | MD034 | Bare URL used
docs/dependencies.md | 401 | error | MD034 | Bare URL used
docs/dependencies.md | 414 | error | MD034 | Bare URL used
docs/dependencies.md | 427 | error | MD034 | Bare URL used
docs/dependencies.md | 440 | error | MD034 | Bare URL used
docs/dependencies.md | 453 | error | MD034 | Bare URL used
docs/dependencies.md | 466 | error | MD034 | Bare URL used
docs/dependencies.md | 479 | error | MD034 | Bare URL used
docs/dependencies.md | 492 | error | MD034 | Bare URL used
docs/dependencies.md | 505 | error | MD034 | Bare URL used
docs/dependencies.md | 518 | error | MD034 | Bare URL used
docs/dependencies.md | 531 | error | MD034 | Bare URL used
docs/dependencies.md | 544 | error | MD034 | Bare URL used
docs/dependencies.md | 557 | error | MD034 | Bare URL used
docs/dependencies.md | 570 | error | MD034 | Bare URL used
docs/dependencies.md | 583 | error | MD034 | Bare URL used
docs/dependencies.md | 596 | error | MD034 | Bare URL used
docs/dependencies.md | 609 | error | MD034 | Bare URL used
docs/dependencies.md | 622 | error | MD034 | Bare URL used
docs/dependencies.md | 635 | error | MD034 | Bare URL used
docs/dependencies.md | 648 | error | MD034 | Bare URL used
docs/dependencies.md | 661 | error | MD034 | Bare URL used
docs/dependencies.md | 674 | error | MD034 | Bare URL used
docs/dependencies.md | 687 | error | MD034 | Bare URL used
docs/dependencies.md | 700 | error | MD034 | Bare URL used
docs/dependencies.md | 713 | error | MD034 | Bare URL used
docs/dependencies.md | 726 | error | MD034 | Bare URL used
docs/dependencies.md | 739 | error | MD034 | Bare URL used
docs/dependencies.md | 753 | error | MD034 | Bare URL used
docs/dependencies.md | 766 | error | MD034 | Bare URL used
docs/dependencies.md | 779 | error | MD034 | Bare URL used
docs/dependencies.md | 792 | error | MD034 | Bare URL used
docs/dependencies.md | 805 | error | MD034 | Bare URL used
docs/dependencies.md | 818 | error | MD034 | Bare URL used
docs/dependencies.md | 831 | error | MD034 | Bare URL used
docs/dependencies.md | 844 | error | MD034 | Bare URL used
docs/dependencies.md | 857 | error | MD034 | Bare URL used
docs/dependencies.md | 870 | error | MD034 | Bare URL used
docs/dependencies.md | 883 | error | MD034 | Bare URL used
docs/dependencies.md | 896 | error | MD034 | Bare URL used
docs/dependencies.md | 909 | error | MD034 | Bare URL used
docs/dependencies.md | 922 | error | MD034 | Bare URL used
docs/dependencies.md | 935 | error | MD034 | Bare URL used
docs/dependencies.md | 948 | error | MD034 | Bare URL used
docs/dependencies.md | 961 | error | MD034 | Bare URL used
docs/dependencies.md | 975 | error | MD034 | Bare URL used
docs/dependencies.md | 989 | error | MD034 | Bare URL used
docs/dependencies.md | 1003 | error | MD034 | Bare URL used
docs/dependencies.md | 1017 | error | MD034 | Bare URL used
docs/dependencies.md | 1031 | error | MD034 | Bare URL used
docs/dependencies.md | 1045 | error | MD034 | Bare URL used
docs/dependencies.md | 1059 | error | MD034 | Bare URL used
docs/dependencies.md | 1073 | error | MD034 | Bare URL used
docs/dependencies.md | 1075 | error | MD012 | Multiple consecutive blank lines
docs/dependencies.md | 1090 | error | MD034 | Bare URL used
docs/dependencies.md | 1092 | error | MD033 | Inline HTML
docs/dependencies.md | 1092 | error | MD034 | Bare URL used
docs/dependencies.md | 1158 | error | MD034 | Bare URL used
docs/dependencies.md | 1171 | error | MD034 | Bare URL used
docs/dependencies.md | 1184 | error | MD034 | Bare URL used
docs/dependencies.md | 1197 | error | MD034 | Bare URL used
docs/dependencies.md | 1210 | error | MD034 | Bare URL used
docs/design/styl-wizualny.md | 24 | error | MD060 | Table column style
docs/design/styl-wizualny.md | 24 | error | MD060 | Table column style
docs/design/styl-wizualny.md | 24 | error | MD060 | Table column style
docs/design/styl-wizualny.md | 24 | error | MD060 | Table column style
docs/design/styl-wizualny.md | 41 | error | MD032 | Lists should be surrounded by blank lines
docs/design/styl-wizualny.md | 59 | error | MD032 | Lists should be surrounded by blank lines
docs/design/styl-wizualny.md | 64 | error | MD032 | Lists should be surrounded by blank lines
docs/design/styl-wizualny.md | 69 | error | MD032 | Lists should be surrounded by blank lines
docs/engineering/ci.md | 138 | error | MD018 | No space after hash on atx style heading
docs/research/engine-packaging-spike.md | 1 | error | private-content | Remove local paths and personal contact details before publication.
docs/research/herdr-analiza.md | 3 | error | MD034 | Bare URL used
docs/research/herdr-analiza.md | 10 | error | MD032 | Lists should be surrounded by blank lines
docs/research/herdr-analiza.md | 95 | error | MD060 | Table column style
docs/research/herdr-analiza.md | 95 | error | MD060 | Table column style
docs/research/herdr-analiza.md | 95 | error | MD060 | Table column style
docs/research/herdr-analiza.md | 95 | error | MD060 | Table column style
docs/research/herdr-analiza.md | 95 | error | MD060 | Table column style
docs/research/herdr-analiza.md | 95 | error | MD060 | Table column style
docs/research/prototyp-wnioski.md | 1 | error | private-content | Remove local paths and personal contact details before publication.
docs/research/prototyp-wnioski.md | 16 | error | MD060 | Table column style
docs/research/prototyp-wnioski.md | 16 | error | MD060 | Table column style
docs/research/prototyp-wnioski.md | 16 | error | MD060 | Table column style
docs/research/prototyp-wnioski.md | 16 | error | MD060 | Table column style
docs/research/prototyp-wnioski.md | 16 | error | MD060 | Table column style
docs/research/prototyp-wnioski.md | 16 | error | MD060 | Table column style
docs/research/prototyp-wnioski.md | 59 | error | MD032 | Lists should be surrounded by blank lines
docs/research/prototyp-wnioski.md | 67 | error | MD032 | Lists should be surrounded by blank lines
docs/research/prototyp-wnioski.md | 80 | error | MD032 | Lists should be surrounded by blank lines
docs/research/prototyp-wnioski.md | 90 | error | MD032 | Lists should be surrounded by blank lines
docs/research/prototyp-wnioski.md | 101 | error | MD032 | Lists should be surrounded by blank lines
docs/research/prototyp-wnioski.md | 105 | error | MD032 | Lists should be surrounded by blank lines
docs/research/prototyp-wnioski.md | 114 | error | MD032 | Lists should be surrounded by blank lines
docs/research/prototyp-wnioski.md | 129 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 57 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 84 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 93 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 104 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 142 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 146 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 152 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 160 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 170 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 189 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 217 | error | MD060 | Table column style
docs/SPECIFICATION.md | 217 | error | MD060 | Table column style
docs/SPECIFICATION.md | 217 | error | MD060 | Table column style
docs/SPECIFICATION.md | 217 | error | MD060 | Table column style
docs/SPECIFICATION.md | 252 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 256 | error | MD032 | Lists should be surrounded by blank lines
docs/SPECIFICATION.md | 310 | error | MD034 | Bare URL used
docs/SPECIFICATION.md | 311 | error | MD034 | Bare URL used
docs/SPECIFICATION.md | 312 | error | MD034 | Bare URL used
docs/SPECIFICATION.md | 313 | error | MD034 | Bare URL used
docs/SPECIFICATION.md | 314 | error | MD034 | Bare URL used
docs/SPECIFICATION.md | 315 | error | MD034 | Bare URL used
docs/SPECIFICATION.md | 316 | error | MD034 | Bare URL used

## Applied scope and content-preservation proof

The integrator explicitly approved this exact proposal on 2026-10-17. Applied
only in isolated wt025, preserving the primary Owner file unchanged. The official
markdownlint core's applyFixes applied only MD032/MD060/MD012/MD034 repairs; the
endpoint example, PR hash and five neutral redactions were handled explicitly.
No measured result, decision or prose wording changed.

The proof compares each file to its staged pre-repair baseline (including the
already approved dependency adoption), removes whitespace, autolink wrappers and
inline code delimiters, and reverses the escaped PR hash. Two known historical
path examples are replaced by HOST_WORKSPACE_ROOT and three synthetic stack
frame prefixes become source/ before comparison. Every resulting character is
identical. This proves preserved words and values after the declared redactions;
independent review must also verify Markdown rendering and semantic context.

File | Normalized content
--- | ---
| `docs/SPECIFICATION.md` | PASS |
| `docs/adr/0024-zakres-mvp.md` | PASS |
| `docs/adr/0027-skill-overmind-dla-agentow.md` | PASS |
| `docs/adr/0030-engine-packaging-and-sqlite-driver.md` | PASS |
| `docs/dependencies.md` | PASS |
| `docs/design/styl-wizualny.md` | PASS |
| `docs/engineering/ci.md` | PASS |
| `docs/research/herdr-analiza.md` | PASS |
| `docs/research/prototyp-wnioski.md` | PASS |
| `docs/research/engine-packaging-spike.md` | PASS |

Primary Owner file SHA-256 remains
`3541ad5be1f54235df1a4a5ce0dfcd56fe272ba018f19a290b23ad47939cc920`.
Parent will hold primary fast-forward on overlap; no stash/reset is authorized.

## Integration after DEVELOP d88ec66

The integrator approved one additional mechanical Source autolink on 2026-10-17:
`postject` 1.0.0-alpha.6 in `docs/dependencies.md`. Preflight after rebase reported
MD034 at line 1125. Only angle brackets are added around that exact existing URL;
the version, license, rationale, date and all other metadata remain unchanged.
README credits are regenerated from the actual dependency headings to include
postject. The engineering index adds the real engine-packaging guide and replaces
the parallel-agent placeholder with its existing guide; their owners remain
OVE_SETUP017 and OVE_SETUP013. No other legacy repair is added.

The rebase had two actual conflicts: pnpm generated the combined lockfile, and
the configuration guard retained both the merged engine-packaging path protection
and this task's exact Markdown configuration protection. The generated package
and snapshot maps are exactly the union of both approved inputs (419 entries
each), with zero additional, missing or altered entries. The final frozen install
passed the unchanged supply-chain checks (404 entries). Rust, packager and SBOM
source files match DEVELOP byte-for-byte. Final offline documentation preflight
passed with 0 errors and 40 existing warnings; renewed full checks and independent
reviews remain required for the resulting head.
