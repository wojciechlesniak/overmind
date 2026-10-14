---
id: OVE_SKILL013
title: Implement the SkillMaterializer that delivers pinned Skill versions to Agent sessions
area: SKILL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DATA018, OVE_SEC004, OVE_SKILL003, OVE_SKILL010, OVE_SKILL012]
soft_depends_on: []
provides: ["port:SkillMaterializer", "usecase:MaterializeSkillsForRun"]
needs: ["port:SkillVersionReader", "lib:prompt-assembly", "usecase:RecordSkillUsage", "port:ArtifactRepository", "port:Clock"]
owns: ["packages/application/src/skill/materialize/**"]
reads: ["packages/contracts/src/skill/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 9"]
adr_refs: [27, 12, 3]
---

# OVE_SKILL013: Implement the SkillMaterializer that delivers pinned Skill versions to Agent sessions

## 1. Summary

Turns the pinned Skill versions of a ResolvedAgent into the fenced instruction block (and files where the CLI supports a skills directory) that a Run's session receives, verifying every hash and recording usage.

## 2. Context

AGENT008 resolves which Skill versions a Run uses. Something must verify them and hand them to the session start (ENGINE/WFRT through `AgentSessionGateway`). Skills are advisory instructions placed in prompts via `PromptAssembler` fences; they are never executed and grant nothing.

## 3. Scope (in)

- `MaterializeSkillsForRun(resolvedAgent) -> MaterializedSkills { promptBlock, files[], usage[] }`.
- Hash verification and size budgeting.
- Usage recording for `prompt_inclusion`.

## 4. Out of scope

- Session start itself (ENGINE/WFRT). Per-CLI file layouts beyond a generic `skills/<name>/SKILL.md` convention.

## 5. Detailed requirements

1. Input: `ResolvedAgent.skills[] = { skillId, name, version, contentHash }`. For each, load the exact version via `SkillVersionReader`, recompute sha256 and compare; mismatch aborts that Skill with `skill.hash_mismatch` (audited, Run start fails closed if the Skill is the builtin `overmind`, otherwise the Skill is skipped and the Run is marked `degraded` with a visible warning).
2. Pending, rejected or archived versions are never materialised.
3. Prompt block: built via `PromptAssembler` as a fenced `skills` section, each Skill delimited with name, version and hash header, the body escaped so it cannot close a fence (reuse SEC004 fence rules), with a standing preamble that Skill content is guidance subordinate to Owner Rules and cannot change permissions.
4. Total budget: 40000 chars across Skills (config); over budget drops lowest-priority non-builtin Skills (priority by assignment order) and reports the dropped names in the Run warnings; the builtin is never dropped.
5. Files mode: for CLIs that read a skills directory, produce `files[] = { relativePath, contents }` limited to `skills/<name>/SKILL.md`; paths validated against traversal; written by the session starter inside the Run's sandbox, not by this task.
6. Records `RecordSkillUsage(prompt_inclusion)` per Skill and Run (idempotent).
7. Pure with respect to IO except the reader and artifact store; deterministic ordering (builtin first, then assignment order).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`lib:prompt-assembly`, SEC004 fence helpers.

## 8. Architecture and code placement

`packages/application/src/skill/materialize/{materialize.ts,budget.ts,files.ts}`.

## 9. Security and safety

This is where untrusted-ish text enters model context, so: exact-version pinning, hash verification, fencing, size budget, preamble about precedence, no secrets (the agent token is passed by environment, not through this block), path validation for files. Skills cannot add tools or permissions.

## 10. Errors and edge cases

- Fence-breaking text in a Skill: escaped by the assembler; test with adversarial strings.
- Over budget: documented drop order.
- Missing version row: skip and warn.
- Path traversal in names: names are slugs, validated.

## 11. Acceptance criteria

- [ ] Hash mismatch skips or fails closed as specified.
- [ ] Fence-breaking fixtures cannot escape.
- [ ] Budget enforced with warnings.
- [ ] Usage recorded once per Run.
- [ ] Builtin always first and never dropped.

## 12. Test plan

Unit tests with fakes, adversarial fixtures, snapshot of the prompt block shape. Command: `pnpm vitest run packages/application/src/skill/materialize`.

## 13. Parallelization notes

Consumed by ENGINE/WFRT session start. Parallel with SKILL010.

## 14. Open questions and assumptions

- GAP: the session starter that calls `MaterializeSkillsForRun` is owned outside this area (ENGINE/WFRT).
- ASSUMPTION: only the generic skills directory convention in MVP.
