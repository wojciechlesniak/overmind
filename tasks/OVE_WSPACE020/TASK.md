---
id: OVE_WSPACE020
title: "Add Allowed Directory flow: native picker, rights and Local Approval"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_DS013, OVE_DS024, OVE_DS025, OVE_DS036, OVE_DS040, OVE_PERM026, OVE_WSPACE014, OVE_WSPACE015, OVE_WSPACE018, OVE_WSPACE019]
soft_depends_on: []
provides: []
needs: ["lib:use-local-approval", "lib:desktop-platform", "ui:Dialog", "ui:SegmentedControl", "ui:CheckboxRow", "ui:InfoNote", "ui:Button", "api:perm.policies"]
owns: ["apps/desktop/src/features/workspace-settings/components/directories-actions/add.actions.ts", "apps/desktop/src/features/workspace-settings/components/AddDirectoryDialog.tsx"]
reads: []
design: design.png
design_source: "Workspace#ws/dirs-add-button (crop 340,410,980,92 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.9"]
adr_refs: [3, 6, 20]
---

# OVE_WSPACE020: Add Allowed Directory flow: native picker, rights and Local Approval

## 1. Summary

Implements the 'Dodaj katalog' action: choose a folder with the native dialog, choose rights, review, approve locally and add it to the Workspace policy; the permanent widening is impossible without Local Approval.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock region `ws/dirs-add-button` (secondary button with plus, 140x40). The add flow is not drawn. PERM026: `POST /v1/permissions/policies/{id}/directories` body `{ rawPath, rights, primary?, label?, expectedVersion, localProof }` is a widening route (declares `localProof`); the engine canonicalises (SEC002), rejects protected locations (`perm.protected_location`), symlinks outside, nested overlap rules (PERM002) and limits (64 entries).

## 3. Scope (in)

- `components/directories-actions/add.actions.ts` + `components/AddDirectoryDialog.tsx`.
- Native dialog through `FileDialog.pickDirectory` and `pickFile` (for single files like `brief.pdf`: choose 'file' or 'folder' in a small `ui:SegmentedControl`).
- Rights chooser (read always; write; execute with warning), optional label.
- Run through `useLocalApproval` with operation `policy.widen` (add directory).

## 4. Out of scope

- Table rendering (OVE_WSPACE019), rights edits and removal (OVE_WSPACE021), first-folder dialog for a new Workspace (OVE_WSPACE012, shares the call helper `addDirectory` from `api/` of 018: both call the same mutation, DRY).

## 5. Detailed requirements

1. Button `Dodaj katalog` (`secondary md`, plus icon) opens `AddDirectoryDialog` (`ui:Dialog size='md'`): Step content: kind selector (Folder | File), `Choose…` button, chosen display path (mono), rights (`ui:CheckboxRow` Read [locked on], Write, Execute) with help text, label field (optional, 80), notice `InfoNote`: 'This folder will be mounted in the Agents\' container as read-only/read-write. Adding it permanently needs your approval at this computer.'
2. Default rights: read only; write unchecked (principle of least privilege: this differs from the first-folder step where the Workspace root defaults to write: here the default is read). Write+execute together shows the warning text before the approval dialog.
3. Submit: `useLocalApproval().run({ operation:'policy.widen', args:{ policyId, rawPath, rights:['read',...], primary:false, label }, call:(proof,args)=> addDirectory({...args, expectedVersion: policy.version, localProof: proof}) })`. The summary shown in the approval dialog comes from the `policy.widen` describer (Workspace, Folder, Rights).
4. Result handling: success -> dialog closes, table updates from the response/push, toast 'Folder added: ~/Projects/shared-ui', focus returns to the add button; errors by code: `perm.protected_location`, `path.not_found`, `path.not_directory`, `perm.nested_conflict` ('contains or is inside an existing folder: {{path}}'), `perm.limit_reached` (64), `perm.policy_conflict` (reload then ask again), `perm.local_approval_required` (see 014).
5. Duplicates: if the picked path equals an existing display path the UI warns before approval ('Already in the list'), the engine remains authoritative.
6. The raw path string comes ONLY from the native dialog result or, when the OS dialog is unavailable (dev/mock mode), from a text field behind a `?dev` flag; it is never read from the clipboard/URL.
7. Telegram cannot reach this flow: desktop UI only; additionally the engine refuses `policy.widen` from any other principal.
8. After success, if the Workspace is not isolated and the added folder is the first, offer nothing else (no auto-registering docs).

## 6. Design notes

Derived: dialog layout as OVE_WSPACE012; button per `design.png` (crop of the add button and the table's bottom edge). Not in the mock: dialog states.

## 7. Reuse

- `useLocalApproval` (OVE_WSPACE014), `addDirectory` mutation of OVE_WSPACE018, `lib:desktop-platform` FileDialog, `ui:Dialog`, `ui:SegmentedControl`, `ui:CheckboxRow`, `ui:InfoNote`, `ui:Button`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific (critical, SPEC 16.9): permanent grant = widening: Local Approval REQUIRED and bound to `{policyId, rawPath, rights, primary}`. Defence in depth: the UI does not canonicalise, does not follow symlinks, and does not pre-approve `~` or `/`; the engine's `perm.protected_location` is final. A path changed after the dialog (e.g. picker reopened) must restart the approval. No Agent-supplied path ever reaches this flow (Agent requests are decided in Approvals).

## 10. Errors and edge cases

- Picker cancelled: nothing.
- Chosen path is a symlink to outside: engine refuses `path.symlink_outside`; shown.
- Folder on removable volume disappears before confirmation: `path.not_found`.
- Policy changed elsewhere meanwhile: `policy_conflict` -> refetch, ask again.
- Proof expired: ask again (never silent retry).
- User picks the home folder: engine refuses; message includes why.

## 11. Acceptance criteria

- [ ] Given a folder and read-only rights, When approved locally, Then one add request with `localProof` is sent and the row appears read-only.
- [ ] Given write+execute, Then the warning shows before the approval.
- [ ] Given Cancel in the approval dialog, Then nothing is sent.
- [ ] Given `perm.protected_location`, Then the folder is not added and the message is shown.
- [ ] Given the path changed after confirmation, Then the old approval is not reused.
- [ ] No request is sent without a dialog confirmation (test).

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `AddDirectoryDialog.test.tsx` (defaults, warnings, errors), `add.actions.test.ts` (approval order/args identity), Playwright `add-directory.e2e.ts`. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/add, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/directories-actions/add.actions.ts`, `apps/desktop/src/features/workspace-settings/components/AddDirectoryDialog.tsx` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: `FileDialog.pickDirectory/pickFile` are available through `lib:desktop-platform`.
- OPEN: whether execute is offered at all in MVP; default offered but off.
