---
id: OVE_SKILL002
title: Implement pure Skill domain rules (versions, visibility, assignment validity)
area: SKILL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SKILL001, OVE_VIS002]
soft_depends_on: []
provides: ["lib:skill-rules"]
needs: ["lib:visibility-rules"]
owns: ["packages/domain/src/skill/**"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 16.3"]
adr_refs: [12, 28, 3]
---

# OVE_SKILL002: Implement pure Skill domain rules (versions, visibility, assignment validity)

## 1. Summary

Pure functions for everything that decides what a Skill may do: version numbering and immutability, default visibility by source, import acceptance state machine, the "visible in both" rule for assignment and effective Skill resolution for an Agent in a Workspace.

## 2. Context

ADR 0028: Owner Skill public by default, Chief-proposed Skill private by default, new Workflow private; assignment works wherever both Skill and Agent are visible; a private Skill on a public Agent works only in its own Workspace; in an isolated Workspace everything is private; making something private is blocked while used elsewhere. ADR 0012: imports come only from the Owner; Chief-written Skills enter the library after Owner acceptance. Criterion 3.

## 3. Scope (in)

- `defaultVisibility(source, workspace)`, `nextSkillVersion`, `canTransitionVersion`.
- `isSkillVisibleIn(skill, workspaceId)`, `canAssign(skill, agent, workspaceId)`.
- `resolveSkillsForAgent(agent, skills, workspaceId)`: which assigned Skills apply in a Workspace, with `skippedSkills[]`.
- `usageBlocksPrivatisation(usageFacts)`.

## 4. Out of scope

- Storage and loading: SKILL003/004. Scanning rules: SKILL006. Resolution at Run start: AGENT008 calls `resolveSkillsForAgent`.

## 5. Detailed requirements

1. Defaults: source `owner` -> `public`; source `chief` -> `private` with the originating Workspace; source `import` -> `public` only after Owner acceptance and the Owner picks (the default offered in the UI is `private` in the importing Workspace, ASSUMPTION; the domain returns `private` unless told otherwise); in an isolated Workspace always `private`, and `public` requests return `skill.private_requires_workspace`-style error `isolated`.
2. Versions: monotonic integers; a new version never alters an old one; `currentVersion` = highest `accepted`; a Chief-written or imported version stays `pending_review` until `decide` by the Owner; Owner-authored versions are `accepted` immediately (after the same scan, warnings shown); transitions: `pending_review -> accepted|rejected` (Owner only), nothing else; `rejected` is final (a revised text is a new version).
3. `canTransitionVersion(v, decision, caller)` requires `caller.kind === 'owner'` on desktop; any other caller returns `skill.import_owner_only` or `chief_cannot_...` as applicable.
4. Builtin Skills (`overmind`): edit, archive, visibility change and unassign-from-all are refused with `skill.builtin_immutable`; the product updates the builtin only by shipping a new version (SKILL013).
5. Visibility: `isSkillVisibleIn(skill, ws)` = public, or private with `ownerWorkspaceId === ws`. `canAssign(skill, agent, ws)`: Skill visible in `ws` AND Agent visible in `ws`; assignment of a private Skill to a public Agent is allowed and tagged `scopedToWorkspaceId = skill.ownerWorkspaceId`; a Skill private to Workspace A cannot be assigned while working in B.
6. `resolveSkillsForAgent`: given the Agent's `skills[]` (with optional pin), return the applicable `{ skillId, version }` for the Workspace: pinned version if `accepted`, else the highest accepted; Skills not visible in the Workspace or archived are skipped with a reason (`not_visible`, `archived`, `no_accepted_version`).
7. Making a public Skill private: blocked when it is assigned to any Agent used in another Workspace (`usageFacts.otherWorkspaceAgents > 0`) -> `skill.visibility_in_use`; making private always needs `ownerWorkspaceId`.
8. Name normalisation and uniqueness keys (`nameKey = name`), shadowing rule from SKILL001 (a private name may not equal a public name; checked against supplied facts).
9. Content rules: instructions non-empty after trimming, no NUL, valid UTF-8, max 20 000 characters; leading front matter (`---`) with `requiredTools:` list is parsed into metadata by `parseSkillFrontMatter` (strict, only `name`, `description`, `requiredTools` keys honoured, everything else ignored and flagged); parsing never evaluates anything.
10. All functions pure and clock-free.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`lib:visibility-rules` for the base predicates; contracts of SKILL001; `slug` helper shared with CHAT003 only for mention slugs of Agents (not for Skills).

## 8. Architecture and code placement

`packages/domain/src/skill/{defaults.ts,versions.ts,visibility.ts,assignment.ts,resolve.ts,content.ts,front-matter.ts}`; domain imports only contracts.

## 9. Security and safety

`requiredTools` parsing is metadata-only; the front-matter parser rejects anchors, tags, merge keys and non-scalar values to avoid YAML tricks (a tiny restricted parser, no YAML library on untrusted input). Owner-only transitions fail closed for unknown callers. The builtin protection prevents an Agent-reachable path from editing the protocol Skill.

## 10. Errors and edge cases

- Skill with no accepted version (only pending): not resolvable, `no_accepted_version`.
- Pin to a rejected or pending version: skipped with reason.
- Agent public with a private Skill in Workspace B: skipped in B.
- Name differing only in case: normalised; rejected by SKILL001 pattern anyway.
- Front matter with unknown keys: flagged, ignored.

## 11. Acceptance criteria

- [ ] Default visibility table passes for all sources and isolation cases.
- [ ] `canAssign` table covers public/private combinations across two Workspaces (criterion 3).
- [ ] Privatisation blocked when used elsewhere, allowed otherwise.
- [ ] Builtin edits refused.
- [ ] Front-matter parser rejects YAML anchors/tags and non-scalar values.
- [ ] `resolveSkillsForAgent` skips non-visible Skills with reasons and respects pins.

## 12. Test plan

Table tests, property test (resolution result is independent of the order of `skills[]` apart from output order), parser fuzz test. Command: `pnpm vitest run packages/domain/src/skill`.

## 13. Parallelization notes

Parallel with SKILL003. Used by AGENT008, SKILL004-007, SKILL009. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: imported Skills default to private in the importing Workspace; the Owner can publish at acceptance time.
