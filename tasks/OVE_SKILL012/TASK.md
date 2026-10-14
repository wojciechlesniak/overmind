---
id: OVE_SKILL012
title: Add the builtin overmind Skill content and its seeding
area: SKILL
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ENGINE028, OVE_SKILL003, OVE_SKILL006]
soft_depends_on: []
provides: ["contract:OvermindSkillContent", "usecase:SeedBuiltinSkills"]
needs: ["port:SkillRepository", "usecase:ScanSkillText", "port:Clock", "port:IdGenerator", "lib:agent-token"]
owns: ["packages/application/src/skill/builtin/**", "packages/skills-builtin/overmind/**"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 9"]
adr_refs: [27, 3, 12]
---

# OVE_SKILL012: Add the builtin overmind Skill content and its seeding

## 1. Summary

The Skill every Agent CLI receives (ADR 0027): short instructions on how to report progress and completion, request access, message other Agents and record Decisions through the local Overmind API, plus idempotent seeding as a builtin, public, immutable Skill.

## 2. Context

ADR 0027: reports are structured declarations, not evidence; the Skill works only inside Overmind (environment variable set by Overmind) and the API cannot extend permissions. The content mirrors the agent-facing routes of AGENT015 and the report types of AGENT014. Overmind-supplied instructions are trusted product content, but they are still delivered through the same fenced mechanism as any Skill.

## 3. Scope (in)

- Authoring of the instruction text (English, per ADR 0017), versioned with the app; seeding use case; hash pinned in tests.
- A short helper description for reports using the environment variables (`OVERMIND_API_URL`, `OVERMIND_AGENT_TOKEN`, `OVERMIND_RUN_ID`).

## 4. Out of scope

- Installing the Skill into a CLI session (SKILL013). The routes themselves (AGENT015).

## 5. Detailed requirements

1. Content file `packages/skills-builtin/overmind/SKILL.md` (<= 6000 chars) covering: when to report (start, milestones, completion, blocker), exact payload shapes for `progress`, `completion`, `access_request`, `decision`, `message`; instructions to ask for access instead of attempting to bypass restrictions; to write a Decision only for real project decisions; to treat every report as a declaration that Overmind verifies; to never print the token; to stop if the environment variable is missing.
2. A statement that nothing in the Skill grants permissions and that refusal responses must be reported, not worked around.
3. `SeedBuiltinSkills` creates or upgrades the builtin Skill `overmind` (public, `builtin: true`, source `owner` marker `system`) on engine start; upgrade adds a new accepted version when the content hash differs from the stored latest, never editing an old version. Idempotent and safe on concurrent starts (unique name key).
4. Seeding registers itself as a startup task through the engine composition module; failure to seed is logged and degrades (Agents run without the Skill and the helper is reported missing) rather than blocking engine start; an audit event records the seeded hash.
5. The text passes the scanner at build time (test) with zero medium/high findings, and a snapshot test fixes the hash so changes are deliberate.
6. Content never contains tokens, URLs with credentials, or absolute paths; the API base comes from the environment variable at run time.
7. The builtin Skill is automatically included in every Agent's resolved Skill set by AGENT008 (not stored in config versions) (ASSUMPTION: AGENT008 adds it).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

SKILL003 repository, scanner.

## 8. Architecture and code placement

`packages/skills-builtin/overmind/SKILL.md`; `packages/application/src/skill/builtin/{seed-builtin-skills.ts,content.ts}`.

## 9. Security and safety

The Skill is the Agent's instruction channel to Overmind, so tampering is an attack surface: stored versions are immutable, hash pinned, builtin cannot be edited by anyone through the API. The text teaches reporting only; it cannot widen permissions. The token is supplied through the environment, never in the text.

## 10. Errors and edge cases

- Existing user Skill named `overmind`: seeding renames the user Skill with suffix and records an audit event.
- Hash drift between app and stored: new version appended.
- Seeding race: unique constraint, retry once.

## 11. Acceptance criteria

- [ ] Seeding is idempotent and upgrades by new version.
- [ ] Builtin cannot be edited or archived via API.
- [ ] Scanner clean; hash snapshot test.
- [ ] Content documents all payload shapes matching AGENT014/015 schemas (contract test).

## 12. Test plan

Unit tests with fakes; a contract test that parses every example payload in the Skill text against the AGENT014 schemas. Command: `pnpm vitest run packages/application/src/skill/builtin`.

## 13. Parallelization notes

Parallel with SKILL004. Content must be revised if AGENT014/015 payloads change.

## 14. Open questions and assumptions

- ASSUMPTION: content in English.
- ASSUMPTION: AGENT008 always appends builtin Skills.
- OPEN: whether CLI-specific variants (Claude Code vs other CLIs) are needed.
