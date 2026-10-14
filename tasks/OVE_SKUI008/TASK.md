---
id: OVE_SKUI008
title: "Detach from Agents: usage list and per-Agent detach with confirmation"
area: SKUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_BOARDUI001, OVE_DS024, OVE_DS036, OVE_SKILL011, OVE_SKUI003, OVE_SKUI006]
soft_depends_on: []
provides: ["lib:skill-detach-flow"]
needs: ["api:agents.update", "api:agents.get", "lib:api-client-agents", "lib:api-client-skills", "ui:ConfirmDialog", "ui:Dialog", "ui:CheckboxRow", "lib:use-gateway-mutation", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/components/DetachSkillDialog.tsx", "apps/desktop/src/features/skills/state/use-skill-detach.ts", "apps/desktop/src/locales/en/skills-detach.json", "apps/desktop/src/locales/pl/skills-detach.json"]
reads: []
design: design.png
design_source: "Skille#skills/inspector-actions (crop 1121,830,299,60 CSS px; the dialog is not drawn in the mock) (crop 1121,830,299,60 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [7, 28]
---

# OVE_SKUI008: Detach from Agents: usage list and per-Agent detach with confirmation

## 1. Summary

`Odłącz od agentów`: a dialog listing the Agents that use the Skill (with visibility words) where the Owner picks which to detach; each detach is a new Agent configuration version.

## 2. Context

Assignments are part of Agent configuration versions (`AgentConfig.skills`), so detaching means a new version per Agent (`PATCH /v1/agents/{id}` with the Skill removed). There is no bulk-detach API (reported). `SkillAssignmentView[]` from the inspector lists assigned Agents with versions. Runs already started keep their pinned configuration.

## 3. Scope (in)

- `DetachSkillDialog` and `useSkillDetach`.

## 4. Out of scope

- Archiving a Skill (P1, `POST /skills/{id}/archive`).

## 5. Detailed requirements

1. The dialog lists assigned Agents (name, visibility word, `agentVersion`, `scopedToWorkspaceId` note) with checkboxes (all checked by default); text `Odłączenie tworzy nową wersję konfiguracji każdego wybranego Agenta. Uruchomione Runy zostają przy swojej wersji.`
2. Confirm button `Odłącz od {n} agentów` (count in the label); cancel is the initial focus; destructive tone.
3. Execution: for each selected Agent sequentially `GET /v1/agents/{id}` (current version and skills) then `PATCH /v1/agents/{id}` with `{ expectedVersion, patch: { skills: without this Skill } }`; sequential to keep version checks simple; per-row result chips `odłączono`/`błąd`; failures do not abort the rest and a final summary shows `Odłączono 2 z 3`.
4. Agents of other Workspaces that the Owner cannot see in this Workspace are listed by name only if the engine returned them to the Owner (Owner scope); the dialog never edits an Agent it could not read.
5. `agent.version_conflict` for one Agent: that row offers `Spróbuj ponownie` (re-reads the version).
6. A Skill with zero assigned Agents: the button is disabled with the title `Brak przypisań`.
7. No request carries visibility or any other Agent field (allow-list from OVE_AGUI005: only `skills`).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:ConfirmDialog`, `ui:CheckboxRow`; Agents api-client.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/DetachSkillDialog.tsx`, `state/use-skill-detach.ts`; contributes the button to the slot `inspector-actions`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Agent archived meanwhile: row error `zarchiwizowany`.
- Dialog closed during execution: the running sequence completes in the background, the summary toast appears.
- Skill pinned at a version: the patch removes the entry regardless of pin.

## 11. Acceptance criteria

- [ ] Given three Agents and all selected, Then three PATCHes remove only the `skills` entry for this Skill.
- [ ] Given one conflict, Then the others still complete and the row offers retry.
- [ ] Given no assignments, Then the button is disabled.
- [ ] Given Cancel focus, Then Esc closes without a request.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `DetachSkillDialog.test.tsx` (selection, partial failure, patch allow-list). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to SKILL/AGENT): no bulk detach endpoint (`POST /skills/{id}/detach`); this task uses per-Agent updates and is the first candidate to switch when one exists.
