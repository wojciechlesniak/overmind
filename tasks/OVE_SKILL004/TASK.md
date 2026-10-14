---
id: OVE_SKILL004
title: Implement the create, edit-as-new-version, archive and read Skill use cases
area: SKILL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DATA010, OVE_PERM020, OVE_SKILL001, OVE_SKILL002, OVE_SKILL003, OVE_SKILL006]
soft_depends_on: []
provides: ["usecase:CreateSkill", "usecase:AddSkillVersion", "usecase:ArchiveSkill", "usecase:GetSkill", "usecase:ListSkillLibrary", "usecase:ListSkillVersions"]
needs: ["port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "usecase:AppendAudit", "port:SkillRepository", "lib:skill-rules", "usecase:ScanSkillText", "port:WorkspaceRepository"]
owns: ["packages/application/src/skill/library/**"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 14"]
adr_refs: [12, 28, 16]
---

# OVE_SKILL004: Implement the create, edit-as-new-version, archive and read Skill use cases

## 1. Summary

The Owner-driven operations of the Skill library: create a Skill, add a new version (editing never mutates), archive, read one, list the library and list versions.

## 2. Context

The Skills view (mock) shows cards with source tags (Owner, Chief, import), PUBLICZNY/PRYWATNY badges, and an inspector with the instruction text and history. Every edit produces a new immutable version so Runs can pin a version and verify its hash (AGENT008). Skills are instructions only: `requiredTools` is metadata, never a permission (ADR 0003).

## 3. Scope (in)

- Use cases with Owner actor checks, optimistic `expectedVersion`, scan on every new text, audit and events.
- `ListSkillLibrary(workspaceId, filter)` with agent and use counts.
- Name uniqueness by `name_key` per scope.

## 4. Out of scope

- Import and review: SKILL007/008. Visibility change: SKILL005. Chief proposals: SKILL009. Routes: SKILL011.

## 5. Detailed requirements

1. `CreateSkill` accepts only an Owner actor (desktop session or Telegram `owner_remote` is NOT accepted for Skill authoring; ASSUMPTION flagged). Computes `contentHash` (sha256 of normalised instructions), runs `ScanSkillText`; findings of severity `high` block creation (`skill.scan_blocking`), `medium` and below are stored with the version and shown to the Owner. Version 1 is `accepted` because the Owner wrote it.
2. `AddSkillVersion { skillId, expectedVersion, instructions, requiredTools?, changeNote? }` appends version `latest+1` with status `accepted` (Owner) and moves `currentVersion`. A stale `expectedVersion` returns `skill.version_conflict`. Builtin Skills reject with `skill.builtin_immutable`. Existing Agent versions keep their pinned or latest-resolution setting; Runs already started keep their pinned version.
3. `ArchiveSkill`: soft archive; allowed when assigned (resolution skips archived Skills); builtin cannot be archived. The result lists the Agents that still reference the Skill so the UI can warn.
4. `GetSkill`, `ListSkillVersions`, `ListSkillLibrary`: scoped by Workspace (public plus private of that Workspace). Private Skills of other Workspaces behave as not found (`skill.not_found`), never 403.
5. Instruction limits from SKILL001 (1..20000 chars). Normalise line endings, strip NUL and bidi override controls, reject invalid UTF-8. `requiredTools` ids validated; documented as metadata.
6. Every mutation is one transaction with `skill.created` or `skill.version_added` through the outbox rule and an audit record `{actor, skillId, version, hash}` (no instruction text in audit).
7. Name rules: slug, unique per scope; `overmind` is reserved for the builtin.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Result`, `defineErrors`, `AppendAudit`, `lib:skill-rules`, pagination helpers.

## 8. Architecture and code placement

`packages/application/src/skill/library/{create-skill.ts,add-skill-version.ts,archive-skill.ts,queries.ts,index.ts}`. Imports only ports and contracts.

## 9. Security and safety

Only the Owner edits instructions. Instruction text is later injected into Agent prompts, so it is treated as Owner-trusted but still passes through the scanner and is only ever placed in prompts by `PromptAssembler`. Private Skills are invisible across Workspaces. Audit stores hash and ids, not text.

## 10. Errors and edge cases

- Duplicate name in scope: `skill.name_taken`.
- Concurrent edits: one wins, other gets `skill.version_conflict`.
- Instruction with hidden bidi controls: stripped and reported as a scan finding.
- Archive of the builtin: `skill.builtin_immutable`.
- Scanner unavailable: creation fails closed with `skill.scan_unavailable` (ASSUMPTION: add to SKILL001 errors if missing).

## 11. Acceptance criteria

- [ ] Create/edit/archive work with fakes and produce events and audit.
- [ ] Stale `expectedVersion` rejected.
- [ ] High-severity scan blocks creation and new versions.
- [ ] Cross-Workspace read of a private Skill returns not found.
- [ ] Builtin Skill cannot be edited or archived.
- [ ] Telegram actor refused for authoring.

## 12. Test plan

Unit tests with in-memory repositories and fake scanner; concurrency test; type tests. Command: `pnpm vitest run packages/application/src/skill/library`.

## 13. Parallelization notes

Depends on SKILL003 and SKILL006 for the scanner port (`ScanSkillText` may be stubbed with a fake until SKILL006 lands). Blocks SKILL005, SKILL008, SKILL011.

## 14. Open questions and assumptions

- ASSUMPTION: Owner authoring only from the desktop session.
- ASSUMPTION: `skill.scan_unavailable` must be added to SKILL001 (cross-task item).
