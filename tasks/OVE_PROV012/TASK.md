---
id: OVE_PROV012
title: Install the "overmind" Skill and pinned Agent Skills into each CLI session
area: PROV
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH012, OVE_BOX010, OVE_BOX020, OVE_ENGINE016, OVE_PROV034, OVE_SKILL013]
soft_depends_on: [OVE_PROV010, OVE_PROV011, OVE_SKILL012]
provides: ["usecase:InstallSessionSkills", "lib:skill-install-targets"]
needs: ["port:SkillMaterializer", "usecase:MaterializeSkillsForRun", "port:Sandbox", "lib:sandbox-exec", "port:AuditSink", "lib:redaction", "port:Clock"]
owns:
  - packages/application/src/prov/session/skills/**
  - docs/providers/skill-install.md
reads: ["skills/overmind/", "docs/adr/0027-skill-overmind-dla-agentow.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 9"]
adr_refs: [3, 12, 27]
---

# OVE_PROV012: Install the "overmind" Skill and pinned Agent Skills into each CLI session

## 1. Summary

Every CLI that Overmind starts gets the Skill "overmind" (how to report progress, file an Access Request, message other Agents, record Decisions through the local API) plus the Agent's other pinned Skills. This task writes the materialised Skill files into the Environment at the location each CLI reads, verifies them by hash, and fails the session start when the builtin Skill cannot be installed.

## 2. Context

ADR 0027: the Skill works only inside Overmind (it checks `OVERMIND_API_TOKEN`/`OVERMIND_API_SOCKET`), its API cannot widen permissions (ADR 0003), and a report is a declaration, not proof. SKILL013 produces `MaterializedSkills { promptBlock, files[], usage[] }` where `files[]` are `skills/<name>/SKILL.md` entries "written by the session starter inside the Run's sandbox". The Skill directory also exists read-only at `/opt/overmind/skill` (BOX020), but pinned versions come from the materialiser so that the Run uses the exact pinned, hash-checked content (Spec 8: usage records name and version). Skills from the internet are provided only by the Owner (ADR 0012) and are data, never code that gets run by Overmind.

## 3. Scope (in)

- `InstallSessionSkills(envId, agent, runId)` writing `files[]` to the CLI-specific skills directory.
- A per-CLI target table (`lib:skill-install-targets`) that CLI profiles extend.
- Post-write hash verification and a marker file; cleanup of stale Skills of previous Runs.
- Documentation including the fallback (prompt block only).

## 4. Out of scope

- Materialising and hashing (SKILL013), the Skill content (SKILL012), the prompt assembly that embeds `promptBlock` (callers via SEC004), the agent API routes (AGENT015), session start order (PROV027).

## 5. Detailed requirements

1. **Input:** `MaterializedSkills` from `MaterializeSkillsForRun(resolvedAgent)`; the builtin `overmind` is always first and never dropped (SKILL013 requirement 4).
2. **Target table:** `SkillInstallTarget { cli: 'claude'|'codex'; baseDir: string /* absolute in-container */; layout: 'skill-dir' }`. ASSUMPTION (verified by the CLI profile spike in PROV010/PROV011): `claude` reads `<CLAUDE_CONFIG_DIR>/skills/<name>/SKILL.md`, i.e. `/creds/claude/skills/<name>/SKILL.md`; `codex` reads `<CODEX_HOME>/skills/<name>/SKILL.md`, i.e. `/creds/codex/skills/<name>/SKILL.md`. The project directory `/work` is NEVER used (it belongs to the Owner and is in the repository).
3. **Write procedure:** through `Sandbox.exec` as user `agent`: create the directory, write each file from stdin (content never in argv), mode 0644. Paths come only from `files[].relativePath` after the validation below; names are `^[a-z0-9][a-z0-9-]{0,62}$`, no `..`, no absolute paths, no symlinks created (the writer uses `set -C` style exclusive create then rename, and refuses if the target directory contains a symlink: `test ! -L`).
4. **Credential volume caution:** the target lives in the persistent CLI configuration volume because that is where the CLI looks. The installer writes only under `skills/` and never lists, reads or touches any other path of that volume (BOX009: Overmind never reads credentials; a unit test asserts argv and stdin never reference other paths).
5. **Verification:** after writing, exec `sha256sum` over the written files (paths fixed by the installer) and compare with `contentHash` from the materialiser; mismatch means delete the written Skill directory and return `skill.hash_mismatch`-style error `prov.skill_install_failed` (fatal for the builtin `overmind`, non-fatal for others: the Skill is skipped and the session gets the degraded flag `skill_skipped:<name>`).
6. **Stale content:** before writing, remove directories under `skills/` that carry the marker file `.overmind-managed` and are not part of this Run's set (Skills the Owner removed or a previous version). Directories without the marker are left untouched (the Owner's own CLI skills stay).
7. **Marker:** each installed directory gets `.overmind-managed` containing `{ skillId, version, contentHash, runId }` (no secrets).
8. **Fallback:** if the CLI profile marks `skillsDir: false`, only the `promptBlock` path applies (callers embed it) and the builtin Skill content is included in every first prompt; the degraded flag `skills_as_prompt` is set.
9. **Idempotency:** running twice with the same pinned versions rewrites nothing when hashes match (compare via `sha256sum` first).
10. **Audit:** `provider.skills_installed { agentId, envId, skills: [{ name, version }] }`; names and versions only, no content.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`MaterializeSkillsForRun`/`SkillMaterializer` (SKILL013), `Sandbox.exec` (BOX010), builtin Skill (SKILL012), redactor, audit sink. Path validation reuses the Skill name rules of the SKILL area (do not re-define the regex; import it).

## 8. Architecture and code placement

`packages/application/src/prov/session/skills/{install-session-skills.ts,targets.ts,verify.ts,stale.ts}`. Application layer over the `Sandbox` port; CLI profiles (PROV034 `skills` field; concrete values in PROV010/011) contribute their `SkillInstallTarget` through the profile registry, not through conditionals here (OCP).

## 9. Security and safety

Skill text is guidance subordinate to Owner Rules and cannot change permissions or approvals (ADR 0003/0012); it is delivered as files and prompt text, never executed by Overmind. Content comes only from the materialiser (hash-verified, pinned versions; pending, rejected or archived versions are never installed). File names are validated against traversal and symlink tricks inside the Environment. Writing into the credentials volume is limited to the `skills/` subtree and never reads it back except the hash check of the files just written. A Skill that contains prompt-injection text is still just guidance text and is fenced when embedded (SKILL013).

## 10. Errors and edge cases

- Builtin Skill missing in the materialised set: fatal `prov.skill_install_failed`, session start aborted (ADR 0027 depends on it).
- Directory not writable (volume read-only): fatal for builtin, warning for others.
- Skill name collides with an Owner-owned CLI skill without marker: skipped with a warning (never overwritten).
- Very large Skill (over the budget): dropped by the materialiser, reported in warnings.
- Environment destroyed after install: next start reinstalls (idempotent).

## 11. Acceptance criteria

- [ ] With `FakeSandbox`, files land in the Claude and Codex target dirs with the marker, content via stdin only.
- [ ] A hash mismatch removes the directory; for builtin it fails the call.
- [ ] A traversal name (`../x`, `a/b`, absolute path) is rejected before any exec.
- [ ] Stale managed Skills are removed; unmarked directories survive.
- [ ] No path outside `skills/` appears in any exec argv or stdin (assertion test).
- [ ] Second run with identical hashes performs no writes.

## 12. Test plan

Unit tests with a fake `Sandbox` recording exec calls; adversarial names; hash-mismatch fixture; idempotency test. Opt-in integration in a real Environment (tag `real-sandbox`) checking that the CLI lists the Skill. Command: `pnpm vitest run packages/application/src/prov/session/skills`.

## 13. Parallelization notes

Independent of the herdr tasks. PROV027 calls it at step 9. Targets table is extended by PROV010/011 profiles through the registry (no edits here).

## 14. Open questions and assumptions

- ASSUMPTION: both CLIs discover skills under their config directory (Claude `skills/`, Codex `skills/`); if a CLI has no such feature the prompt-block fallback applies. To be confirmed in the CLI profile spikes.
- Open: whether writing under the credentials volume is acceptable to the Owner or a separate `ovm-skills` volume mounted read-only should be used (needs a BOX proposal; default: credentials volume `skills/` subtree).
