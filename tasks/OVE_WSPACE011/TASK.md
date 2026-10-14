---
id: OVE_WSPACE011
title: "New Workspace dialog: form, validation and creation"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA011, OVE_DS013, OVE_DS023, OVE_DS026, OVE_DS036, OVE_DS037, OVE_DS078, OVE_ENGINE019, OVE_WSPACE003]
soft_depends_on: []
provides: ["ui:NewWorkspaceDialog"]
needs: ["ui:Button", "ui:Dialog", "ui:Field", "ui:TextField", "ui:Textarea", "ui:Switch", "ui:SettingRow", "ui:useToast", "api:workspaces.create", "lib:api-client"]
owns: ["apps/desktop/src/features/workspaces/components/slots/HeaderAction.slot.tsx", "apps/desktop/src/features/workspaces/components/NewWorkspaceDialog.tsx", "apps/desktop/src/features/workspaces/model/new-workspace-form.ts"]
reads: []
design: design.png
design_source: "Pulpit#dash/new-workspace-button (crop 904,96,208,68 CSS px); dialog derived"
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 11"]
adr_refs: [3, 28, 10]
---

# OVE_WSPACE011: New Workspace dialog: form, validation and creation

## 1. Summary

Adds the 'Nowy Workspace' primary button and a form dialog (name, optional description, isolation switch) that creates a Workspace through the gateway, handles name conflicts and hands off to the first-folder step.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). Mock region `dash/new-workspace-button` (violet primary 40px, 164x40 at 928,110). The dialog is not in the mock: derive it from `ui:Dialog` form variant. DATA009/011: `CreateWorkspaceInput { name 1..80, description? <=500, isolated? default false, budget? }`, route `POST /v1/workspaces` (`idempotency: key-required`), errors `data.workspace_name_taken` (409), `validation.invalid_input`. No folder or policy is part of creation: roots are added through PERM routes with Local Approval (DATA009 req. 3). Until a folder is added the Workspace has no access (deny by default, ADR 0003).

## 3. Scope (in)

- `components/slots/HeaderAction.slot.tsx` (slot id `headerAction`): primary button with `plus` icon.
- `components/NewWorkspaceDialog.tsx` + `model/new-workspace-form.ts` (zod schema reuse + client rules).
- Create call with idempotency key, success handling, error mapping.
- Exported `openNewWorkspace()` for the empty state (OVE_WSPACE010).

## 4. Out of scope

- Adding the first folder (OVE_WSPACE012).
- Budget editing (OVE_WSPACE029).
- Importing documentation (Chief or Project Docs flow).

## 5. Detailed requirements

1. Button: `ui:Button variant='primary-violet' size='md'` with `plus`, label `newWorkspace.button` ('New Workspace' / 'Nowy Workspace'); keyboard shortcut none in MVP.
2. Dialog (`ui:Dialog size='md'`, title `newWorkspace.title`, description `newWorkspace.description` 'A Workspace has its own folders, Task Board, Decisions and Agent memory.'): fields `ui:Field` + `ui:TextField` Name (required, `maxLength` 80, autofocus), `ui:Textarea` Description (optional, 500, counter), `ui:SettingRow`-style `ui:Switch` 'Isolated Workspace' with help text from the mock ('Decisions and Memory do not leave this Workspace, and everything created here is private.') and a note under it: 'Isolation cannot be relaxed without Local Approval at this computer.' Default off (SPEC 10).
3. Client validation (mirrors zod `CreateWorkspaceInput` imported from contracts; never re-declared): trim, 1..80, no control characters, no leading/trailing dots; inline error on blur and submit; the submit button is disabled only while `busy` (not for invalid form, so the error can be shown).
4. Submit: `createWorkspace({ name, description, isolated }, { idempotencyKey })` with a fresh ULID key per dialog open (double submit safe). On success: close, toast `newWorkspace.created` ('Workspace "{{name}}" created'), invalidate the dashboard list, and open the first-folder step (OVE_WSPACE012) with the returned Workspace id.
5. Errors: `data.workspace_name_taken` -> field error `newWorkspace.error.nameTaken` ('A Workspace with this name already exists.'), focus the name field; `validation.invalid_input` -> map `issues[].path` to fields; network/5xx -> dialog-level alert with Retry; `perm.owner_required` -> generic denied message.
6. Isolation flag is sent only as `isolated: true`; the dialog never sends policy, roots or budget.
7. The dialog is dismissible with Escape/Cancel unless busy; unsaved text asks nothing (short form) but is kept if the dialog is reopened within 30 s (in-memory only).
8. While Global Pause is active creation is allowed (it creates no work).

## 6. Design notes

Button per `design.png` (violet 40px, plus icon, label 14/600). Dialog derived: title 20/700, fields 40px, switch row like `ui:SettingRow`, footer with `secondary` Cancel and `primary-violet` 'Create Workspace'. States not in the mock: dialog all states, button hover/focus/disabled.

## 7. Reuse

- `ui:Button`, `ui:Dialog`, `ui:Field`, `ui:TextField`, `ui:Textarea`, `ui:Switch`, `ui:SettingRow`, `ui:useToast`.
- `CreateWorkspaceInput` zod schema from `@overmind/contracts` (DATA009), `lib:api-client` workspaces client.
- ULID helper from contracts/ARCH007 (no custom id code).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: name and description are untrusted input only in the sense of length/characters: validated by the shared zod schema and again by the engine. Creating an isolated Workspace is a narrowing choice (allowed without proof); turning isolation OFF later needs Local Approval (OVE_WSPACE027). No folder is mounted by creation: the new Workspace has an empty Allowed Directory list (deny by default).

## 10. Errors and edge cases

- Name with only spaces: client error before any request.
- Same name differing by case/NFC form: server says taken; shown as taken.
- Double click on Create: one request (idempotency key + busy state).
- Request succeeds but response lost: retry with the same key returns the original Workspace.
- Engine paused/not ready: dialog alert with Retry.
- Very long description pasted: truncated by `maxLength`, counter at limit.

## 11. Acceptance criteria

- [ ] Given a valid name, When Create is pressed, Then `POST /v1/workspaces` is sent once with an Idempotency-Key and the dashboard shows the new card after the push event.
- [ ] Given a taken name, Then the field error shows and focus returns to the field.
- [ ] Given the isolation switch on, Then `isolated:true` is sent.
- [ ] Given 81 characters, Then the field blocks input at 80.
- [ ] The first-folder step opens after success.
- [ ] Keyboard only: open, fill, submit, cancel; focus returns to the button.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `new-workspace-form.test.ts` (rules table incl. NFC, control chars), `NewWorkspaceDialog.test.tsx` (submit, conflict, validation mapping, busy, idempotency key reuse on retry), Playwright `create-workspace.e2e.ts`, stories `Dialog/Empty|Invalid|Busy|Conflict|Isolated`. Commands: `pnpm --filter @overmind/desktop test components/NewWorkspaceDialog`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/components/slots/HeaderAction.slot.tsx`, `apps/desktop/src/features/workspaces/components/NewWorkspaceDialog.tsx`, `apps/desktop/src/features/workspaces/model/new-workspace-form.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: no template or import options in MVP (Chief proposes structure after creation).
- OPEN: whether to offer 'start with Chief chat' after creating; default opens the folder step.
