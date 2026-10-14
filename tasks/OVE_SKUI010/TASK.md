---
id: OVE_SKUI010
title: "Skill visibility change: PUBLICZNY <-> PRYWATNY with usage check and explicit confirmation"
area: SKUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DS036, OVE_SKILL011, OVE_SKUI003, OVE_SKUI006, OVE_VIS008]
soft_depends_on: []
provides: ["lib:skill-visibility-flow"]
needs: ["api:skills.visibility", "api:visibility.impact", "lib:api-client-skills", "lib:api-client-visibility", "ui:Dialog", "ui:ConfirmDialog", "lib:use-gateway-mutation", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/components/SkillVisibilityDialog.tsx", "apps/desktop/src/features/skills/state/use-skill-visibility.ts", "apps/desktop/src/locales/en/skills-visibility.json", "apps/desktop/src/locales/pl/skills-visibility.json"]
reads: []
design: design.png
design_source: "Skille#skills/inspector-tags (crop 1121,218,299,62 CSS px; the dialog is not drawn in the mock) (crop 1121,218,299,62 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [28]
---

# OVE_SKUI010: Skill visibility change: PUBLICZNY <-> PRYWATNY with usage check and explicit confirmation

## 1. Summary

Changing the visibility of a Skill from the inspector tags: a dry-run impact check, a blocker list when private is not possible, and an explicit confirm (`confirmPublic`) before a Skill becomes public.

## 2. Context

SKILL005 `ChangeSkillVisibility { skillId, to, ownerWorkspaceId?, confirmPublic? }`: private -> public requires `confirmPublic: true` and re-runs the scanner; public -> private requires `ownerWorkspaceId` and is refused with `skill.visibility_in_use` plus the blocking Agents when any Agent outside that Workspace has the Skill. Builtin Skills cannot change. VIS008 `GET /v1/visibility/skill/{id}/impact?to=private&ownerWorkspaceId=` is the read-only dry run.

## 3. Scope (in)

- Inspector tag action (`Zmień widoczność`) and `SkillVisibilityDialog`, `useSkillVisibility`.

## 4. Out of scope

- Chief visibility proposals (CHIEF).

## 5. Detailed requirements

1. Entry point: a text button next to the visibility tag in the inspector (`Zmień`) contributed to the inspector slot; absent for the system Skill.
2. To private: impact call with `ownerWorkspaceId = current Workspace`; `allowed:false` lists blockers (Agent names and Workspace names, max 5 + `+N więcej`, plain text) with no confirm button and the text `Najpierw odłącz Skill od tych Agentów`; allowed -> confirm `Ustaw jako prywatny`.
3. To public: dialog text `Skill będzie widoczny i dostępny we wszystkich Workspace'ach. Jego treść zostanie ponownie przeskanowana.`, a mandatory checkbox, confirm `Ustaw jako publiczny` (not auto-focused); body `{ to:'public', confirmPublic:true }` is sent only after the checkbox and the button press.
4. Impact failure blocks the change (fail closed).
5. Result: tag word updates after the engine answered (no optimistic update); a scan result with findings from the re-scan is shown in a notice.
6. Errors: `skill.visibility_in_use`, `skill.builtin_immutable`, `skill.private_requires_workspace`, `skill.scan_blocking`, `perm.owner_required`.
7. Desktop Owner only; no code path builds this from Chief text.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:Dialog`, `ui:ConfirmDialog`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/SkillVisibilityDialog.tsx`, `state/use-skill-visibility.ts`.

## 9. Security and safety

Making a Skill public is a widening (it enters every Workspace). Therefore it needs the explicit checkbox and button, sends `confirmPublic:true` only from this dialog and never from a default or batched path. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Skill already in the chosen visibility: ignored.
- Scan finds `high` on re-scan: refused with the findings shown.
- Concurrent change: conflict message and refetch.

## 11. Acceptance criteria

- [ ] Given a public Skill in use by an Agent in another Workspace, When choosing private, Then blockers are listed and there is no confirm.
- [ ] Given private -> public, Then the checkbox is required and `confirmPublic:true` is sent once.
- [ ] Given impact failure, Then no change is possible.
- [ ] Given the system Skill, Then no change entry point exists.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `SkillVisibilityDialog.test.tsx`, `use-skill-visibility.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: no local proof for Skill visibility; if PERM adds one, `useLocalApproval` is added in this task only.
