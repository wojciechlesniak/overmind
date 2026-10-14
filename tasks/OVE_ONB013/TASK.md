---
id: OVE_ONB013
title: "Wire wizard step 1: suggestions, Finder picker, rights, local approval and provisioning"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_ONB009, OVE_ONB011, OVE_ONB012, OVE_PERM009, OVE_SHELL003, OVE_SHELL004]
soft_depends_on: []
provides: ["ui:FolderStep"]
needs: ["api:onboarding.folders.suggest", "api:onboarding.folders.validate", "api:onboarding.folder.provision", "api:perm.local-confirmation.create", "lib:use-wizard-step", "lib:use-gateway-mutation", "lib:use-platform", "lib:ui-error-mapper"]
owns: ["apps/desktop/src/features/onboarding/steps/folder/FolderStep.tsx", "apps/desktop/src/features/onboarding/steps/folder/use-folder-step.ts", "apps/desktop/src/features/onboarding/steps/folder/folder-reducer.ts", "apps/desktop/src/features/onboarding/steps/folder/map-reject-reason.ts"]
reads: []
design: design.png
design_source: "Kreator-Folder#onb1/folder-picker + onb1/permissions-panel (crop 416,210,968,340); behaviour of selected/unselected rows and checkbox states is visible in the mock"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [3, 10, 21]
---

# OVE_ONB013: Wire wizard step 1: suggestions, Finder picker, rights, local approval and provisioning

## 1. Summary

Connects step 1 to the engine: loads the suggested folders, lets the Owner pick in the tree or in Finder (untrusted path validated by the engine), holds the rights state with the mock's defaults (read and write on, execute off), requests the Local Approval proof, provisions the first folder and Workspace, and handles every rejection, loading and error state with clear copy.

## 2. Context

ONB004 suggests folders and validates picker results; ONB005 provisions with a Local Approval; ONB009 exposes both. The Next button is the local confirmation (ONB005 assumption). Step 1 is the security-critical wizard step: the Owner decides what Agents can touch (ADR 0003: nothing by default, SPEC 16.1: no folder, no access). The UI must never decide validity itself, never build paths, and must make the effect understandable (rights, folder).

## 3. Scope (in)

- `FolderStep.tsx` composing `FolderStepView` (ONB012) with hooks: `useSuggestedFolders()`, `useValidateFolder()`, `useProvisionFirstFolder()`.
- Selection, rights and warning state (reducer) and resume of a previously provisioned folder.
- Native picker through `usePlatform().fileDialog.pickDirectory()` (SHELL003) then `validateFolder`.
- Local Approval proof creation via `perm.local-confirmation.create` right before provisioning.
- Footer registration (Back hidden; Next label 'Dalej' with disabled reasons).
- Error/reject mapping to the copy catalogue (ONB012).

## 4. Out of scope

- Static view (ONB012).
- Backend (ONB004/005/009).
- Adding more folders later (Workspace settings).

## 5. Detailed requirements

1. **Load.** On mount `onboarding.folders.suggest` (staleTime 0; refetch on window focus). Loading shows the DS skeleton; error shows the inline error with retry; an empty root shows `rootHint.empty`.
2. **Select.** Clicking a node sets `selectedId`; the rights card heading shows its display path. Nodes with `disabledReason` are inert and show the reason text (DS074 renders the muted reason).
3. **Finder.** 'Wybierz w Finderze…' calls `pickDirectory({ title: t('picker.title') })`; cancel returns null and nothing changes; a path string goes to `onboarding.folders.validate` (untrusted text, 1..1024 chars, never logged by the UI); success appends the returned candidate as a depth-0 node (its own row, `folder` icon) and selects it; `folder_rejected` shows the inline reject text for the reason (`reject.*`) in the picker error area, keeps the previous selection.
4. **Rights state.** Defaults `{ read: true, write: true, execute: false }` (mock). `read` is locked. `write && execute` shows the DS warning line. Changing the folder keeps the rights the Owner already set. Rights are sent exactly as shown.
5. **Next.** Enabled when a node is selected (and the rights state is valid). On click: (1) `perm.local-confirmation.create({ action: 'onboarding.provision_first_folder', target: { kind: 'path', id: folderId }, args: { read: true, write, execute } })` -> proof; (2) `onboarding.folders.provision({ folderId, rights, proof })` with an idempotency key stored per selection; (3) on success the host advances to step 2 (`host.advance()`). The proof is held in memory only for the duration of the call and never stored or logged.
6. **Loading and double click.** Next shows `loading` and ignores further clicks; the idempotency key makes a retry safe.
7. **Resume.** When `state.steps.folder.done` with `displayPath` and `rights`, the step shows that folder as the selected node (labelled with the saved display path; its engine `id` is unknown, so a `saved` pseudo-node with `id: 'saved'` is rendered) and the saved rights. Next without changes skips provisioning and just advances; if the Owner changes folder or rights, the normal provisioning (replacement, ONB005) runs. A hint line 'Ten folder jest już zapisany.' (`resume.saved`) appears.
8. **Errors.** `onboarding.folder_rejected` -> inline reason; `perm.local_approval_required` (proof rejected) -> inline 'Nie udało się potwierdzić zgody. Spróbuj ponownie.' and the key regenerates; `onboarding.folder_already_provisioned` -> info and advance; network/engine errors -> `toUiError` text with 'Spróbuj ponownie'; `data.*` conflicts -> reload suggestions.
9. **macOS consent.** When the engine reports `unreadable` the message points to System Settings > Privacy (text only; no deep link in MVP).
10. **Back.** Hidden on this step (`setBack(null)`).
11. **Announcements.** Selection changes announce 'Wybrano {{name}}' (polite); errors use `role="alert"` inside the picker (DS).
12. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- `useGatewayQuery/useGatewayMutation` (SHELL005), `usePlatform().fileDialog` (SHELL003), `useWizardStep` (ONB011), `FolderStepView` (ONB012), `api-client-onboarding` and `api-client-perm` (`localConfirmation.create`, PERM009/026), `toUiError` (SHELL004).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/folder/{FolderStep.tsx,use-folder-step.ts,folder-reducer.ts,map-reject-reason.ts}`; the registry file `steps/folder/index.ts` (ONB012) imports `FolderStep` via the file name agreed here (`FolderStep.tsx` default export). Application/UI layer; no engine logic.

## 9. Security and safety

- The UI never composes or expands paths; only opaque ids and display strings are used; the Finder path is passed once to the engine and not stored in state beyond the call.
- Local Approval proof: created immediately before provisioning, single use, bound to folder and rights by the engine; not persisted in storage or logs; cleared from memory after the call.
- The wizard cannot grant more than the Owner sees: rights displayed equal rights sent.
- Telegram or other clients cannot invoke provisioning (engine matrix).
- No silent defaults of execute: off unless the Owner toggles.

## 10. Errors and edge cases

- Owner picks a folder, goes back from step 2 and picks another: replacement semantics (engine); the UI shows the new selection and re-provisions.
- Suggested folder removed on disk meanwhile: engine rejects at provisioning (`not_a_directory`); the list is refetched.
- Engine restart between validation and provisioning: id expired -> 'Wybierz folder ponownie.' and the picker reloads.
- Finder returns a path under `/Volumes` or `~/.ssh`: rejected with the specific reason.
- Proof creation fails (desktop session not recognised): error with retry; nothing created.
- Two windows: not applicable (single wizard window).

## 11. Acceptance criteria

- [ ] Given suggestions then the tree shows the parent and children and selecting a child enables Next.
- [ ] Given Finder returns `~/.ssh` then the sensitive reject text shows and the selection does not change.
- [ ] Given Next then proof creation precedes provisioning and the provisioned Workspace advances to step 2.
- [ ] Given a saved folder on resume then it is selected and Next advances without re-provisioning.
- [ ] Given write and execute both on then the warning shows and provisioning sends both rights.
- [ ] Given the second click during loading then no second request is sent.

## 12. Test plan

- Vitest + Testing Library with fake api-client, fake platform file dialog and `FakeEventSource`: every flow above; sentinel-path test asserting the path is absent from logs.
- Playwright (TEST004): wizard step 1 happy path and a rejection path against the mock gateway.
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/folder`.

## 13. Parallelization notes

After ONB011/012/009. Parallel with ONB015. Backend must be merged (or the fake gateway scenario `onboarding-step1`) for e2e.

## 14. Open questions and assumptions

- ASSUMPTION: the click on Next is accepted by PERM009 as the local confirmation; otherwise add a confirmation dialog here.
- OPEN: whether to show an explicit summary dialog before provisioning ('Agenci będą mogli czytać i zapisywać w …'); not in the mock; not added (the rights card already states it).
