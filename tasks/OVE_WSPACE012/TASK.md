---
id: OVE_WSPACE012
title: New Workspace first-folder step with Local Approval
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_DATA011, OVE_DS013, OVE_DS036, OVE_DS040, OVE_DS074, OVE_PERM026, OVE_WSPACE011, OVE_WSPACE014]
soft_depends_on: ["OVE_WSPACE015"]
provides: []
needs: ["ui:Dialog", "ui:FolderPicker", "ui:PermissionChecklist", "ui:CheckRow", "ui:Button", "ui:InfoNote", "lib:desktop-platform", "api:perm.policies", "api:workspaces.get"]
owns: ["apps/desktop/src/features/workspaces/components/FirstFolderStep.tsx"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [3, 6, 20]
---

# OVE_WSPACE012: New Workspace first-folder step with Local Approval

## 1. Summary

After a Workspace is created, guides the Owner through choosing its first Allowed Directory with the native folder dialog and granting it through Local Approval, because a new Workspace has no access until the Owner explicitly adds a folder.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). ADR 0003: empty Allowed Directory list = no access; permanent grants need Local Approval (PERM008: `policy.widen` / add directory with `localProof`). Route `POST /v1/permissions/policies/{id}/directories` body `{ rawPath, rights, primary?, label?, expectedVersion, localProof:{confirmationId} }` (PERM026); the engine canonicalises and validates the path (SEC002), the UI never trusts its own path handling. `FileDialog.pickDirectory` comes from the desktop platform layer (ARCH012). The onboarding wizard has its own first-run folder step (ONB); this step is for additional Workspaces.

## 3. Scope (in)

- `components/FirstFolderStep.tsx` (a `ui:Dialog size='lg'` step shown after creation).
- Use of `lib:desktop-platform` `FileDialog.pickDirectory`, `ui:FolderPicker` presentation (optional tree), rights checklist (read/write; execute off).
- Grant call through `lib:use-local-approval` (OVE_WSPACE014).
- 'Skip for now' path leaving the Workspace without access.

## 4. Out of scope

- Adding folders later (OVE_WSPACE020).
- Wizard step of first run (ONB).

## 5. Detailed requirements

1. Content: title `firstFolder.title` ('Give {{name}} a folder'), explanatory text from the mock wording: 'Only these folders are mounted in the Agents\' container. An empty list means no access.' Buttons: `Choose folder…` (`secondary`, opens the native dialog) and, after choosing, a summary row with the display path (mono) and a rights checklist (`ui:PermissionChecklist`/`ui:CheckRow` look from DS074): Read (on, locked on), Write (on by default), Execute (off, with the warning text `firstFolder.executeWarning` 'Allows running programs from this folder.').
2. Flow: (1) pick path via `FileDialog.pickDirectory({ title })` -> `Result<string|null>`; null = cancelled, nothing happens; (2) show the path as chosen and ask the engine to validate WITHOUT widening: `GET /v1/permissions/effective?...` is not suitable; instead the add call's dry validation error codes are used: the UI sends the add call only after Local Approval; to give early feedback it calls `lib:allowed-directory-normalizer` through `POST /v1/permissions/policies/{id}/directories/validate` ONLY IF provided (ASSUMPTION: not provided, section 14); otherwise validation errors appear after confirmation; (3) press 'Add folder': `useLocalApproval().run({ operation:'policy.widen', args:{ policyId, rawPath, rights, primary:true, label }, call:(proof)=> addDirectory({...args, expectedVersion, localProof:proof}) })`.
3. The Workspace's policy id: from `GET /v1/workspaces/{id}` -> `policyId`; when null (PERM creates the policy lazily) the UI calls the policy-ensure route if provided; ASSUMPTION: DATA011's CreateWorkspace + PERM subscriber creates the policy on `workspace.created`; the step polls `GET workspace` up to 3 s before showing an error 'Workspace is not ready yet'.
4. Primary: first folder becomes `primary: true` (the Workspace root; CLI cwd is always `/work`, prototype finding). Label default = folder name.
5. Success: toast `firstFolder.added`, dialog closes, Workspace card refreshes (path appears). The UI explains the container mount: 'Agents will see this folder as /work.'
6. Errors from the engine are shown with their code: `path.not_found`, `path.not_directory`, `perm.protected_location` ('This location cannot be shared: system or credential folder'), `perm.invalid_policy`, `perm.local_approval_required`, `perm.policy_conflict` (reload policy version and retry once with a NEW confirmation), `path.symlink_outside` etc. (keys under `errors:path.*`, ARCH011).
7. Skip: closes the step; the card shows 'no folder yet' and the Workspace settings page offers the same flow (OVE_WSPACE020). A Chief chat in an access-less Workspace works but Agents cannot read files.
8. Write+execute together shows the kit warning (`PermissionMatrix` rule, DS081) before the Local Approval dialog.

## 6. Design notes

Derived from `ui:Dialog` + DS074 `FolderPicker` / `PermissionChecklist` looks (wizard step `Kreator-Folder`, region `onb1/folder-picker`). Not in the mock: this dialog. Mono path 13px, checkboxes 20px custom, buttons `md`.

## 7. Reuse

- `ui:Dialog`, `ui:FolderPicker`/`ui:PermissionChecklist`/`ui:CheckRow`, `ui:Button`, `ui:InfoNote`.
- `lib:use-local-approval`, `lib:desktop-platform` (FileDialog), `api:perm.policies` client, `api:workspaces.get`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific (critical): (1) the path is sent as the raw string the Owner chose; the engine alone canonicalises, checks symlinks/mounts and protected locations (SEC002), the UI shows the engine's canonical display result afterwards; (2) the grant is a permanent widening, so it MUST pass Local Approval and the proof is bound to the exact args (`rawPath`, `rights`) so changing the path after confirmation fails; (3) from Telegram this flow does not exist (desktop UI only) and the engine would refuse; (4) execute right is off by default and write+execute warns; (5) the UI never offers the home directory or `/` silently: if the engine returns `perm.protected_location` or the path is `/`, `~`, `~/Library`, the engine message is shown and nothing is added.

## 10. Errors and edge cases

- Dialog cancelled in the OS picker: no change.
- Path chosen then dialog closed before confirm: nothing sent.
- Proof expired between confirmation and call (60 s): `perm.local_approval_required{reason:'expired'}`: the UI asks again (new confirmation), never reuses the old id.
- Path no longer exists after picking: engine error shown.
- Folder already granted: `perm.policy_conflict` or an 'already added' code: info toast, no duplicate.
- Engine not ready: dialog alert.

## 11. Acceptance criteria

- [ ] Given a chosen folder, When the Owner confirms Local Approval, Then exactly one add-directory request is sent with `localProof` and the same args that were confirmed.
- [ ] Given the Owner cancels Local Approval, Then no add request is sent.
- [ ] Given a protected location error, Then the message shows and the list stays empty.
- [ ] Given Skip, Then the Workspace has no folder and the card says so.
- [ ] Given the proof expires, Then a new approval is requested.
- [ ] Given Execute toggled on with Write on, Then the warning shows before approval.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `FirstFolderStep.test.tsx` with fake FileDialog and fake local-approval (call order, args identity, expiry retry), `args-binding.test.ts` (confirmed args === sent args), Playwright `first-folder.e2e.ts` (mock engine checks hash binding). Commands: `pnpm --filter @overmind/desktop test components/FirstFolderStep`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/components/FirstFolderStep.tsx` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: engine creates the Workspace policy on `workspace.created` (PERM). If not, the add route needs a policy-ensure call; raise in the final report.
- ASSUMPTION: no validate-only route exists; validation errors come from the real call after approval.
