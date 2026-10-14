---
id: OVE_ONB019
title: "Implement wizard step 3: first Workspace name and isolation choice"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA011, OVE_DS026, OVE_DS031, OVE_DS051, OVE_DS081, OVE_ONB009, OVE_ONB011, OVE_SHELL011]
soft_depends_on: []
provides: ["ui:WorkspaceStep"]
needs: ["api:workspaces.get", "api:workspaces.update", "api:onboarding.progress", "lib:use-wizard-step", "lib:use-set-current-workspace", "ui:ToggleRow", "ui:TextField", "ui:Card", "ui:KeyValueList"]
owns: ["apps/desktop/src/features/onboarding/steps/workspace/**", "apps/desktop/src/locales/en/onboarding-workspace.json", "apps/desktop/src/locales/pl/onboarding-workspace.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [10, 28]
---

# OVE_ONB019: Implement wizard step 3: first Workspace name and isolation choice

## 1. Summary

Implements step 3 'Pierwszy Workspace' (no mock): confirm or rename the Workspace that step 1 created from the folder, choose whether it is an isolated Workspace, see a read-only summary of its folder and rights, and mark the step confirmed. Composed from existing wizard-kit and form components.

## 2. Context

The wizard intro lists 'Pierwszy Workspace' as step 3, but only steps 1 and 2 were designed. Step 1 already created a provisional Workspace named after the folder (ONB005), because step 2's isolation test and login need an Environment. Step 3 lets the Owner give it a proper name and decide on isolation ('Workspace izolowany': Decisions and Memory stay inside; everything created is Private, glossary and the Workspace settings mock: 'Decyzje i Pamięć nie wychodzą poza ten Workspace, a wszystko, co tu powstanie, jest prywatne.'). Workspace operations belong to DATA011 (`workspaces.update/rename`); the wizard only calls them and records the step.

## 3. Scope (in)

- Step definition `steps/workspace/index.ts` (title 'Nazwij pierwszy Workspace', lead below) and `WorkspaceStep.tsx`.
- Form: name field (prefilled from the Workspace), isolation toggle (`ui:ToggleRow`), read-only summary card of the folder and rights (from onboarding state), validation and errors.
- Calls: `workspaces.update` / `workspaces.rename` (DATA011) and `onboarding.progress` through the host; marking step 3 done via the engine (a PUT on the Workspace followed by `SaveOnboardingProgress(4)` is not enough to set `steps.workspace.done`; see requirement 6).
- `locales/{en,pl}/onboarding-workspace.json`.
- Stories and tests.

## 4. Out of scope

- Folder and rights editing (back to step 1).
- Creating additional Workspaces (WSPACE dashboard).
- Agents, Workflows, Skills (not part of onboarding).

## 5. Detailed requirements

1. **Copy (PL, proposed; EN equivalents).** Title 'Nazwij pierwszy Workspace' (EN 'Name your first Workspace'). Lead 'Workspace to jednostka pracy z własnymi folderami, pamięcią i uprawnieniami. Możesz go później zmienić.' Field label 'Nazwa Workspace'u', placeholder 'np. Aplikacja rezerwacji'. Summary heading 'FOLDER I PRAWA', rows 'Folder' (display path) and 'Prawa' ('odczyt · zapis' / 'odczyt · zapis · wykonywanie' / 'odczyt'). Toggle label 'Workspace izolowany', description 'Decyzje i Pamięć nie wychodzą poza ten Workspace, a wszystko, co tu powstanie, jest prywatne.' Footnote 'Kolejne Workspace'y dodasz z Pulpitu.'
2. **Prefill and loading.** Data: `useWorkspace(state.steps.folder.workspaceId)` (DATA011 `workspaces.get`): `name`, `isolated`. Loading: DS skeletons; error: inline error with retry. If the Workspace is missing (deleted elsewhere): message 'Workspace nie istnieje. Wróć do kroku 1.' with a button that goes back to step 1.
3. **Validation.** Name required, trimmed, 1..80 characters, no control characters, Unicode allowed; uniqueness is checked by the engine (`data.conflict` -> inline 'Masz już Workspace o tej nazwie.'); validation messages appear on blur and on Next; the field uses `aria-invalid` and `aria-describedby`.
4. **Isolation toggle.** Default off (the mock Workspace settings show it as an option, not default). Turning it on shows a short note 'Chief nie będzie korzystał z Decyzji z innych Workspace'ów w tym projekcie.' (`isolated.note`). This is a Workspace setting changed at any time later in Workspace settings (not a one-way door); the toggle is not a permission widening, so no Local Approval is required.
5. **Next.** Sends `workspaces.update({ id, name, isolated })` only if changed (diff), then calls the engine to confirm the step: `PUT /v1/onboarding/progress { currentStep: 4 }` plus the step-result write. Because ONB003 gives `steps.workspace.done` only through its step writer, ONB009 exposes the confirm as part of progress (`PUT progress` with `confirm: 'workspace'` is NOT in ONB001); the clean solution is that `SaveOnboardingProgress` with `currentStep: 4` from step 3 performs the confirmation when the Workspace exists and its name is non-empty. This requirement is recorded as an amendment request to ONB003 (see section 14); until merged, the UI relies on that behaviour.
6. **Back.** 'Wstecz' returns to step 2 (progress saved), preserving typed values in memory only.
7. **Rename side effects.** Renaming emits `workspace.renamed` (DATA); the shell's Workspace switcher picks it up; no path or policy changes.
8. **Current Workspace.** After the step, `setCurrentWorkspace(workspaceId)` (SHELL011) so that the dashboard opens on it.
9. **Accessibility.** Heading focus on entry (host), the form is a single `<form>` with Enter on the name field moving to Next only when valid; toggle is a switch with description linked.
10. **Not in this step.** No visibility choice for Agents or Skills; no Budget; no Owner Rules (they are configured later; the Chief asks).
11. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

No mock exists for this part (design: none). It is composed only from existing ui-kit components and the wizard layout (`ui:WizardLayout` content area, `ui:Card`, `ui:Button`, `ui:InfoNote`, `ui:Dialog`) with product tokens; no new visual styles. DESIGN GAP recorded in section 14.

## 7. Reuse

- `ui:ToggleRow`, `ui:TextField`, `ui:Card`, `ui:KeyValueList` (DS081/051), `useWizardStep` (ONB011), `workspaces.get/update` (DATA011 api-client), `useSetCurrentWorkspace` (SHELL011), `useGatewayMutation`.

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/workspace/{index.ts,WorkspaceStep.tsx,use-workspace-step.ts,workspace-form.ts}` and `apps/desktop/src/locales/{en,pl}/onboarding-workspace.json`. UI layer.

## 9. Security and safety

- Name is plain text; engine validates length and characters; no markup is rendered.
- Isolation is a data-visibility setting; toggling it needs no Local Approval but is audited by DATA011 (`workspace.updated`).
- The UI cannot set `steps.workspace.done` directly; the engine does it while advancing (ONB003).
- No paths are displayed except the engine-provided display path.

## 10. Errors and edge cases

- Name unchanged: no `update` call; advance only.
- Name collision: engine conflict shown inline.
- Rename races with another change: version conflict -> reload and retry once.
- Workspace deleted between steps: 'Workspace nie istnieje' with back.
- Very long name pasted: truncated at 80 with counter message.
- Locale with different plural/format: no numbers here.

## 11. Acceptance criteria

- [ ] Given the provisional Workspace then the field is prefilled with the folder-derived name and the summary shows folder and rights.
- [ ] Given a new name and the isolation toggle on then `workspaces.update` is called once with both and the wizard advances to step 4.
- [ ] Given an empty name then Next is blocked with an inline message.
- [ ] Given a conflict then the inline error shows and the Owner stays.
- [ ] Given Back then step 2 shows and typed text is not persisted.

## 12. Test plan

- Vitest + Testing Library with fake client: prefill, validation, diff update, conflict, missing Workspace.
- Storybook stories; axe.
- Playwright: full wizard path includes this step (ONB023).
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/workspace`.

## 13. Parallelization notes

After ONB011 and ONB009 and DATA011. Parallel with ONB020. Amendment to ONB003 needed (below).

## 14. Open questions and assumptions

- DESIGN GAP: no mock; copy proposed; layout derived from step 1 (card + form).
- OPEN (amendment to ONB003): `SaveOnboardingProgress(4)` from step 3 must set `steps.workspace.done` after verifying the Workspace exists; alternatively ONB001/009 add `POST /v1/onboarding/workspace/confirm`. The linker should resolve this.
- OPEN: default of isolation (off) to be confirmed by the Owner.
