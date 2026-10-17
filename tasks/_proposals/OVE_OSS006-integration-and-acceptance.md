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

Initial translation is a representation migration, not deletion of a decision:
the strict deletion guard accepts a mapped rename only when the new English ADR
has complete translation provenance, its exact Polish original is preserved
byte-for-byte at the mapped archive path and the source checksum agrees. Other
ADR deletions fail. Original map identities stay immutable against DEVELOP;
working titles may be corrected without renaming files. Original source dates
and translation acceptance still belong to the named translation owners.

Inline and reference-style repository-relative links are rewritten only when
they resolve to the exact renamed proposal; matching external URL basenames are
preserved. Archived Polish originals cannot be rewritten. Renumbering refuses
ambiguous proposals, occupied targets and supersession references that need a
separate reviewed identity migration. The default is always a dry run.
