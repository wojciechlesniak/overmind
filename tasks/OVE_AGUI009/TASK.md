---
id: OVE_AGUI009
title: "Skills assignment on the profile: chips, keyboard menu and visibility rule"
area: AGUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_AGUI003, OVE_AGUI005, OVE_AGUI007, OVE_DS018, OVE_DS067, OVE_DS068, OVE_SKILL011, OVE_VIS005]
soft_depends_on: []
provides: ["lib:agent-skills-assignment"]
needs: ["ui:SkillAssignment", "ui:SkillDropZone", "ui:SkillChip", "api:skills.list", "api:agents.update", "lib:api-client-skills", "lib:use-agent-draft", "lib:skill-assignment-rule", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/regions/skills.region.tsx", "apps/desktop/src/features/agents/components/SkillsAssignment.tsx", "apps/desktop/src/features/agents/state/use-assignable-skills.ts", "apps/desktop/src/locales/en/agents-skills.json", "apps/desktop/src/locales/pl/agents-skills.json"]
reads: []
design: design.png
design_source: "Agenci#agents/skills-dropzone (crop 390,657,712,71 CSS px) (crop 390,657,712,71 CSS px)"
spec_refs: ["SPECIFICATION 9"]
adr_refs: [7, 12, 28]
---

# OVE_AGUI009: Skills assignment on the profile: chips, keyboard menu and visibility rule

## 1. Summary

Skill assignment inside the configuration form: assigned Skill chips with version and visibility word, `upuść tu Skill z biblioteki` drop zone, the keyboard `Przypisz Skill…` menu, and the client-side pre-check of the Skill assignment rule (a private Skill only on an Agent visible where the Skill is visible).

## 2. Context

Mock `agents/skills-dropzone`: `SKILLE · 2 · PRZYPISANE NA STAŁE`, chips `TypeScript v4`, `tdd v2`, dashed drop zone. Assignments are part of the Agent configuration (`AgentConfig.skills: {skillId, pinnedVersion?}[]`, max 32, unique) and are saved with `Zapisz jako vN`. The DS drop zone accepts the Skill drag payload (OVE_DS067); dragging from the Skill library happens only where both are on screen (workflow canvas, WFED) so on this page the keyboard menu is the main path and the drop zone accepts payloads from the system drag only. The assignment rule lives in `lib:skill-assignment-rule` (VIS005, domain); the engine re-validates on save (`agent.skill_not_visible`).

## 3. Scope (in)

- `skills.region.tsx` registering the Skill handlers into `ConfigExtensions` (OVE_AGUI007) and `SkillsAssignment` helper for chips data.
- `useAssignableSkills()` (library list filtered to what may be assigned).
- Pre-check messages.

## 4. Out of scope

- Skill library (SKUI), the drag handle to assign on the canvas (WFED).

## 5. Detailed requirements

1. Assigned chips come from `draft.skills` joined with the Skills lookup: `{name} v{pinnedVersion ?? currentVersion}` (pinned version marked with the word `przypięta` in the title), `visibility` word outline, remove `×` with `aria-label` `Odłącz {name}`.
2. `Przypisz Skill…` menu lists library Skills not yet assigned, grouped `Publiczne`/`Prywatne`, each with the visibility word and version; archived and `pending_review` Skills are NOT listed (only accepted versions can be assigned).
3. `canAcceptSkill(payload)` mirrors `skill-assignment-rule`: rejects a private Skill owned by another Workspace (`Skill prywatny w innym Workspace`), a Skill already assigned (`Już przypisany`), more than 32 (`Maksymalnie 32 Skille`); rejections are shown in the zone for 3 s and announced politely; `onAssignSkill` is not called.
4. A PRIVATE Skill on a PUBLIC Agent is allowed by the rule but scoped (`scopedToWorkspaceId`): the chip carries the extra word `tylko w „{Workspace}”` so the Owner sees that the Skill only works there.
5. Assignment only edits the draft (no request); the chip appears after the draft updates. Remove is symmetrical. Order of chips = assignment order.
6. Skill text is NEVER shown or injected here (only names, versions, visibility words); skill names are plain text.
7. A Skill whose latest version is not accepted yet is shown as `v{current}` and an `oczekuje wersja v{n}` hint when `latestVersion > currentVersion`.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:SkillAssignment`, `ui:SkillDropZone`, `ui:SkillChip` (OVE_DS067, DS068); `skill-assignment-rule` from VIS as a pure function exported through contracts.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/skills.region.tsx`, `components/SkillsAssignment.tsx`, `state/use-assignable-skills.ts`. If `skill-assignment-rule` is not exported to the UI, the pre-check is a small pure mirror in `model/` and the engine stays the authority.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Skill archived after assignment: chip `(archiwum)` with a warning, save still sends the id; engine decides.
- Pinned version no longer accepted: warning chip.
- Library call fails: menu shows `Nie udało się wczytać Skilli` and retry.
- Drop of a payload from another Workspace's private Skill: rejected with the reason.

## 11. Acceptance criteria

- [ ] Given the Developer fixture, Then chips `TypeScript v4`, `tdd v2` and the drop zone match `design.png` within tolerance.
- [ ] Given a keyboard-only user, Then a Skill can be assigned through the menu and removed with the chip button.
- [ ] Given an already-assigned Skill, Then it is rejected with `Już przypisany`.
- [ ] Given a private Skill of another Workspace, Then it is not in the menu and a forced drop is rejected.
- [ ] Given the draft with an assignment, Then the save button becomes `Zapisz jako vN`.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `SkillsAssignment.test.tsx` (menu, reject reasons, keyboard), `use-assignable-skills.test.ts`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to SKILL/VIS): there is no bulk `detach this Skill from all Agents` API; the Skill inspector `Odłącz od agentów` (OVE_SKUI006) uses per-Agent `agents.update` calls.
- ASSUMPTION: assignments are saved only through `Zapisz jako vN` (a Skill assignment is a new Agent version).
