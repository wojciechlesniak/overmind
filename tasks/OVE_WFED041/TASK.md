---
id: OVE_WFED041
title: "Implement the pure Skill drop rules: who may receive which Skill and why a drop is refused"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_VIS005, OVE_WFED002, OVE_WFED014, OVE_WFED023, OVE_WFED040]
soft_depends_on: []
provides: ["lib:editor-skill-rules"]
needs: ["lib:skill-assignment-rule", "lib:editor-agent-info", "lib:editor-skills-data", "lib:editor-node-descriptor", "lib:editor-document-model", "lib:result"]
owns: ["apps/desktop/src/features/workflow-editor/skills/rules/evaluate-skill-drop.ts", "apps/desktop/src/features/workflow-editor/skills/rules/reasons.ts", "apps/desktop/src/features/workflow-editor/skills/rules/skill-drop-matrix.test.ts", "apps/desktop/src/features/workflow-editor/skills/rules/evaluate-skill-drop.test.ts", "apps/desktop/src/locales/en/wfc-skillrules.json", "apps/desktop/src/locales/pl/wfc-skillrules.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED041: Implement the pure Skill drop rules: who may receive which Skill and why a drop is refused

## 1. Summary

One pure function that answers "may this Skill be assigned to the Agent behind this node, and if not, why". It applies the visibility rule of ADR 0028 through the shared `assignmentScope`, plus the practical rules (duplicate, limit of 32, archived, system Skill, node without Agent) and returns a reason with a short and a long Polish text. Drop feedback, the keyboard menu and the final write all use it.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. ADR 0028 and VIS005 (`assignmentScope(skill, agent)`): both public -> works everywhere; one public and one private of Workspace W -> works in W; both private in different Workspaces -> cannot be assigned. A private Skill assigned to a PUBLIC Agent is therefore allowed but only works in the Skill Workspace (the Skill silently drops out of other Workspaces at run time); DS096 text says a private Skill cannot go to a public Agent, which contradicts ADR 0028 and the VIS rule: this task follows the ADR and VIS005 and flags the difference in section 14. An Agent holds at most 32 Skills (`AgentConfig.skills`, AGENT001). Assignment always targets the Agent, never the node (ADR 0012, SPEC 8).

## 3. Scope (in)

- `evaluateSkillDrop(input): DropVerdict` and the reason catalogue.
- Short and long Polish copy per reason (`wfc-skillrules`).
- Exhaustive test matrix of visibility combinations.

## 4. Out of scope

- Reading data from the directory or the Skills list (callers pass it in).
- Showing feedback (WFED042) and writing (WFED043).
- Server-side enforcement (VIS and AGENT areas; the engine re-checks and wins).

## 5. Detailed requirements

1. ```ts
interface DropInput {
  skill: SkillSummary | undefined;               // from lib:editor-skills-data; undefined = not in the visible list
  node: { key: NodeKey; type: string; agentRef?: string } | undefined;
  agent: AgentLookup | "loading" | undefined;    // lib:editor-agent-info
  skillsStatus: "loading" | "ready" | "error";
  activeWorkspaceId: string;
  pendingSkillIds?: ReadonlySet<string>;          // assignments in flight for this Agent (WFED043)
}
type DropReason = "skills_loading" | "skill_unknown" | "skill_archived" | "skill_system" | "node_unknown" | "node_without_agent" | "node_not_agent_backed" | "agent_loading" | "agent_missing" | "agent_archived" | "already_assigned" | "limit_reached" | "no_common_workspace";
type DropVerdict =
  | { ok: true; scope: "all" | { workspaceId: string }; notes: readonly ("workspace_only")[] }
  | { ok: false; reason: DropReason; retryable: boolean };
function evaluateSkillDrop(i: DropInput): DropVerdict
function reasonText(r: DropReason, params?: { agentName?: string; skillName?: string; limit?: number }): { short: string; long: string }   // via i18n keys
```
2. Evaluation order (first failing rule wins, so the reason is deterministic): (1) `skillsStatus !== "ready"` -> `skills_loading` (retryable); (2) skill undefined -> `skill_unknown`; archived -> `skill_archived`; `builtin` -> `skill_system` (the `overmind` Skill is attached by the engine); (3) node undefined -> `node_unknown`; node type that is not Agent-backed (`start`, `join`, `if`, `loop`, `parallel`, `save_decisions`, `discussion`, `quality_gate`, `end`) -> `node_not_agent_backed`; no `agentRef` -> `node_without_agent` (long text points to choosing an Agent in the Inspector); (4) agent `"loading"` -> `agent_loading` (retryable); `undefined` or `{ found: false }` -> `agent_missing` (never says why: deleted or private elsewhere, ADR 0028); `archived` -> `agent_archived`; (5) skill id already in `agent.skillIds` or in `pendingSkillIds` -> `already_assigned`; `skillIds.length + pending >= 32` -> `limit_reached`; (6) `assignmentScope(skill, agent)` of `lib:skill-assignment-rule`: `none` -> `no_common_workspace`; `workspace` -> `ok` with `scope: { workspaceId }` and, when the Agent is public and the Skill private, `notes: ["workspace_only"]`; `all` -> `ok`.
3. The function imports the VIS rule instead of copying it (DRY, single source of truth). The input types are structural so the module has no dependency on React, the gateway or the kit and runs in the pure core test environment. It never reads the clock, storage or the network.
4. Reason copy (`wfc-skillrules`, EN default, PL): each reason has `short` (<= 40 chars, used in the palette note and the tile tooltip) and `long` (one or two sentences, used in the toast and the live region), examples: `no_common_workspace` short `Różne Workspace’y` long `Skill „{skillName}” jest prywatny w innym Workspace niż Agent „{agentName}”. Nie można ich połączyć.`; `already_assigned` `Już przypisany`; `limit_reached` `Limit 32 Skilli` long `Agent „{agentName}” ma już {limit} Skille. Usuń któryś w profilu Agenta.`; `node_without_agent` `Wybierz Agenta` long `Ten Węzeł nie ma Agenta. Wybierz Agenta w Inspektorze, potem przypisz Skill.`; `skill_system` `Skill systemowy` long `Skill „overmind” jest dołączany automatycznie.`; `agent_missing` `Agent niedostępny`; `workspace_only` note: `Skill prywatny zadziała tylko w Workspace „{workspace}”.` Parameters are interpolated as text, never as markup.
5. The note `workspace_only` is informational: the drop is accepted and the toast after assignment repeats it (WFED043). It is never an error and never blocks.
6. Export the reason list as a const tuple so UI tables can be exhaustive-checked by the compiler (`satisfies Record<DropReason, ...>` in the i18n test).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `assignmentScope` and `canAssignSkill` of `lib:skill-assignment-rule` (VIS005); `AgentLookup` (WFED014); `SkillSummary` (WFED040).

## 8. Architecture and code placement

Layer: pure `skills/rules/` (no React, no gateway). Consumed by WFED042 (canAccept and menu), WFED043 (re-check before writing) and, read-only, by PART 2 (Inspector Skills section may reuse the verdict).

## 9. Security and safety

The rule is a UX guard and a first fence: the engine enforces ADR 0028 on `PATCH /agents/{id}` and wins. The function must fail closed: any unknown input shape or missing data yields a refusal, never `ok`. Reason texts must not reveal why an Agent is unavailable (deleted vs private elsewhere) and must not name Workspaces the active Workspace cannot see (the `workspace_only` note names only the Skill own Workspace, which is the active one by construction).

## 10. Errors and edge cases

- Skill and Agent both private in the SAME Workspace: ok with scope workspace.
- Public Agent plus private Skill: ok with `workspace_only` note.
- Private Agent plus public Skill: ok, scope all.
- Directory has no `skillIds` yet (still loading): `agent_loading`.
- Pending assignment of the same Skill in flight: `already_assigned`.
- 31 Skills plus one pending: `limit_reached`.
- Skill list failed to load: `skills_loading` with `retryable: true`, copy says to try again.

## 11. Acceptance criteria

- [ ] Given every combination of {public, private same W, private other W} for Skill and Agent, Then the verdicts equal the VIS005 table (matrix test generated from `assignmentScope`).
- [ ] Given a public Agent and a private Skill of the active Workspace, Then `ok` with the `workspace_only` note.
- [ ] Given an Agent with 32 Skills, Then `limit_reached`.
- [ ] Given a Discussion node, Then `node_not_agent_backed`.
- [ ] Given the system Skill, Then `skill_system` before any Agent check.
- [ ] Given an unknown Agent id, Then `agent_missing` and the copy does not mention deletion or other Workspaces.
- [ ] Given all reasons, Then each has an EN and a PL `short` and `long` text (i18n completeness test).

## 12. Test plan

Table-driven unit tests for the ordering of rules (one test per reason and one for precedence pairs), the VIS matrix, i18n completeness. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/skills/rules`.

## 13. Parallelization notes

Parallel with WFED042 once the types of WFED040 exist; small enough to merge first.

## 14. Open questions and assumptions

- GAP: `lib:skill-assignment-rule` lives in the VIS area on the engine side; the desktop may import only `ui-kit`, `api-client` and `contracts`, so it must be re-exported through `contracts` (or a shared pure package). Linker: create that re-export.
- DISCREPANCY: DS096 and the DS097 text say a PRYWATNY Skill cannot go to a PUBLICZNY Agent; ADR 0028 and VIS005 allow it with workspace-only effect. This task follows the ADR. Owner to confirm; the single place to change is step (6).
