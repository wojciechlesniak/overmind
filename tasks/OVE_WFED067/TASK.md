---
id: OVE_WFED067
title: "Show assigned Skills with versions in the Inspector and support removal"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_DS018, OVE_DS036, OVE_DS067, OVE_SKILL010, OVE_SKILL011, OVE_WFED063]
soft_depends_on: []
provides: ["feature:wfed-inspector-skills"]
needs: ["ui:SkillChip", "ui:SkillDropZone", "api:skills.list", "usecase:ListSkillsForAgent", "api:agents.update", "lib:api-client-skills", "ui:ConfirmDialog", "feature:editor-skill-dnd"]
owns: ["apps/desktop/src/features/workflow-editor/inspector/sections/skills.section.tsx", "apps/desktop/src/features/workflow-editor/inspector/sections/skills-model.ts"]
reads: []
design: design.png
design_source: "Main#canvas/inspector-skills (crop 1160,588,270,90)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED067: Show assigned Skills with versions in the Inspector and support removal

## 1. Summary

The 'SKILLE · 2' section: chips with name, version and visibility word for the Agent's Skills (Agent-level, permanent) plus Node-level additions/removals, a dashed drop zone for dragging a Skill from the library, and removal with confirmation. Assignment by drag and drop is implemented in part 1; this section reflects and edits the list.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). SPEC 8 and ADR 0028: dragging a Skill onto the Skill tab of a Node assigns it to the Agent permanently, in every Workflow and Workspace where both are visible; a private Skill on a public Agent works only in its own Workspace. A Skill gives no tool access (ADR 0003, 0012). Nodes can additionally `overrides.skills { add, remove }` (WFRT019) but only from the allow-list. Mock: 'TypeScript v4 PUBLICZNY', 'tdd v2 PUBLICZNY'.

## 3. Scope (in)

- `SkillsSection` listing effective Skills (Agent Skills + Node adds - Node removes) with origin tags ('Agenta' / 'tylko ten Węzeł').
- Removal: Agent-level removal creates a new Agent config Version after confirm; Node-level add/remove edits the Draft.
- Drop zone linked to part 1 DnD capability (`feature:editor-skill-dnd`) for the Inspector target.
- Version display and 'nowsza wersja dostępna' hint.

## 4. Out of scope

- Drag and drop mechanics and the Skill tab drop target on tiles (part 1, DS067/DS089).
- Skill library (SKUI).

## 5. Detailed requirements

1. Chip text `name vN` mono 13 plus outline `VisibilityBadge` (PUBLICZNY/PRYWATNY); header 'SKILLE · 2' with a word unit ('2 skille' in the tab, count in the label); empty: 'Brak Skilli. Przeciągnij Skill z biblioteki.'.
2. Removal chip button `Usuń Skill TypeScript`; Delete key on a focused chip too. Agent-level removal: `ConfirmDialog` 'Usunąć Skill z Agenta? Dotyczy wszystkich Workflow i Workspace'ów, w których Agent jest widoczny.' then `api:agents.update` with the new skills list and `expectedVersion`. Node-level removal of an Agent Skill = `overrides.skills.remove` via editor command, no dialog (reversible with undo).
3. A Skill whose version is pinned for the Run shows the pinned version only in Run views; here it shows the Agent's configured version.
4. Private Skill on a public Agent: chip shows PRYWATNY and a tooltip 'Działa tylko w Workspace, w którym powstał'.
5. Updated version available (SkillVersion newer than assigned): small 'v5 dostępna' link opens the Skill in the library (assignment follows Skill policy; no silent upgrade).
6. Drop zone visible in edit mode only; accepts the Skill payload from part 1 DnD (`lib:skillDragPayload`) and calls the same command used by the tile's Skill tab so rules are in one place; a refused drop shows the reason (for example `vis.skill_not_visible`).
7. `view` mode: chips read-only without remove buttons.

## 6. Design notes

`design.png`: label 'SKILLE · 2' mono 11, chips `TypeScript v4 [PUBLICZNY]` and `tdd v2 [PUBLICZNY]` mono 13 with outline badges, wrapping. Dashed drop zone, removal states and empty state are not in the mock; derive from `ui:SkillDropZone` and `ui:SkillChip` (removable).

## 7. Reuse

- `ui:SkillChip`, `ui:SkillDropZone`, `lib:skillDragPayload`, `ui:ConfirmDialog`, part 1 `feature:editor-skill-dnd`.

## 8. Architecture and code placement

`skills-model.ts` (pure: merge Agent + Node override into effective list with origins), section component.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Assigning a Skill never grants Tools; removing is narrowing. Skills from the internet appear only after the Owner accepted them (SKILL008); chips never render Skill instructions. A Skill that is not visible in this Workspace cannot be assigned (server enforces `lib:skill-assignment-rule`).

## 10. Errors and edge cases

- Skill archived: chip shown struck with 'zarchiwizowany'.
- Same Skill added at Agent and Node level: shown once.
- Agent update conflict: refetch and keep the dialog closed with a toast.
- Removing the last Skill: allowed (Skills are optional).

## 11. Acceptance criteria

- [ ] Given the mock Agent, then the section equals `design.png`.
- [ ] Given Agent-level removal confirmed, then one `agents.update` call with `expectedVersion` is made.
- [ ] Given a Node-level removal, then only the Draft changes and Undo restores it.
- [ ] Given a refused drop, then the reason is displayed.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`skills-model.test.ts`, component tests, stories, axe, visual crop.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: Node-level Skill removal is expressed as `overrides.skills.remove` and allowed by the allow-list rule (narrowing).
