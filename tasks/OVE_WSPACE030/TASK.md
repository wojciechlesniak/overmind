---
id: OVE_WSPACE030
title: "Delete Workspace flow: preview, typed name, Local Approval and aftermath"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA012, OVE_DS026, OVE_DS032, OVE_DS036, OVE_DS037, OVE_DS051, OVE_DS082, OVE_SHELL011, OVE_WSPACE014, OVE_WSPACE015, OVE_WSPACE018, OVE_WSPACE027]
soft_depends_on: []
provides: []
needs: ["ui:DangerRow", "ui:Dialog", "ui:KeyValueList", "ui:TextField", "ui:Skeleton", "ui:useToast", "lib:use-local-approval", "lib:current-workspace", "api:workspaces.delete_preview", "api:workspaces.delete"]
owns: ["apps/desktop/src/features/workspace-settings/components/DeleteWorkspaceRow.tsx", "apps/desktop/src/features/workspace-settings/components/DeleteWorkspaceDialog.tsx", "apps/desktop/src/features/workspace-settings/components/isolation-rows/delete.row.tsx", "apps/desktop/src/features/workspace-settings/model/deletion-preview.ts"]
reads: []
design: design.png
design_source: "Workspace#ws/delete-workspace-row (crop 328,1730,1004,115 CSS px, tall render)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 16.1"]
adr_refs: [8, 3, 6, 28]
---

# OVE_WSPACE030: Delete Workspace flow: preview, typed name, Local Approval and aftermath

## 1. Summary

Implements the destructive 'Usuń Workspace…' action: a deletion preview listing exactly what will be erased, a typed-name confirmation, Local Approval with the engine's warning, refusal while Runs are active and the navigation after deletion.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock region `ws/delete-workspace-row`: danger row 'Usuń Workspace' + 'Kasuje jego Decyzje, Tablicę i Pamięć agentów z tego Workspace\'u. Pliki projektu zostają na dysku.' and outline-danger button 'Usuń Workspace…'. Spec 10: deleting a Workspace erases its Decisions, Board, Agent memory from that Workspace and its private Agents, Skills and Workflows, after Local Approval with a warning. DATA012: `GET /v1/workspaces/{id}/deletion-preview` -> `{ workspaceId, name, counts:{decisions,tasks,agentMemories,privateAgents,privateSkills,privateWorkflows,runs,artifacts}, warnings:[i18nKeys] }`; `POST /v1/workspaces/{id}/delete {confirmName, expectedVersion}` (`idempotency: key-required`, Local Approval `workspace.delete`); refuses with `data.workspace_has_active_runs`; `workspace.deleted` remains the only trace (name, counts, time). ADR 0008: Decisions are never deleted in the Register EXCEPT through this explicit cascade (the dialog must say so).

## 3. Scope (in)

- `components/DeleteWorkspaceRow.tsx` registered as `components/isolation-rows/delete.row.tsx` (order 100) using `ui:DangerRow`.
- `components/DeleteWorkspaceDialog.tsx`: stepper (Review -> Type the name -> Approve).
- `model/deletion-preview.ts` (counts -> lines, plural keys).
- Post-delete navigation and cache purge.

## 4. Out of scope

- The cascade itself (DATA012 and participants), restoring a Workspace (not possible; backups only, BACKUP008).

## 5. Detailed requirements

1. Row: `ui:DangerRow` title 'Delete Workspace', description (mock text, which MUST state that Decisions are deleted with it) and `Delete Workspace…` danger button. `disabledReason` when the preview/engine reports active Runs: 'A Run is active. Stop or wait for it first.' (button disabled with visible text).
2. Step 1 (Review): fetch the preview; show a `ui:KeyValueList` of counts with word units ('412 Decisions · 87 Tasks · 3 Agent memories · 1 private Agent · 2 private Skills · 3 private Workflows · 14 Runs · 230 Artifacts'), the engine warning keys translated (`workspace.delete.warning`: 'The Workspace is removed with its Decisions, Task Board and Agent memory. Only a short record that it existed remains. Project files stay on disk.'), and a bold statement 'This cannot be undone. Backups are the only way back.'. Loading skeleton while fetching; preview error blocks the flow.
3. Step 2 (Type the name): `ui:TextField` 'Type the Workspace name to confirm' with the exact name shown in mono; the Continue button enables only when the input EQUALS the name exactly (case-sensitive, NFC-normalised comparison as the engine does; no trimming of internal whitespace). Paste is allowed.
4. Step 3 (Approve): `useLocalApproval().run({operation:'workspace.delete', args:{ workspaceId, confirmName, expectedVersion }, call:(proof,args)=> deleteWorkspace({...args, localProof: proof}, { idempotencyKey })})`; the approval describer lists the Workspace name and counts and uses the danger styling with Cancel focused. Idempotency key (ULID) created when the dialog opens and reused for retries of the SAME confirmation attempt only.
5. Success: close dialog, purge feature caches for that id (dashboard list, settings hooks) without writing names to storage, navigate to the dashboard (`/workspaces`) and switch the current Workspace to another (or none) via `lib:current-workspace`, toast 'Workspace deleted'. The deleted Workspace's name appears only in that toast.
6. Failures: `data.workspace_has_active_runs` (list Run ids returned by the engine as 'Run #14, #15') -> back to the row with the disabled reason; `data.version_conflict` -> reload preview and restart; `perm.local_approval_required` -> ask again; `data.not_found` -> already deleted: treat as success; 5xx -> stay in dialog with Retry (the idempotent key makes a retry safe; the Local Approval is asked again because the proof is single-use).
7. Global Pause or a paused Workspace do not block deletion.
8. While the request runs (up to 60 s, DATA012 timeout) the dialog shows progress text 'Deleting…' and cannot be closed.

## 6. Design notes

`design.png`: the danger row: r14 error-tinted border (`rgba(255,143,163,.4)`), title 14/600 error-light, description 12/1.4, outline-danger 'Usuń Workspace…' button right. Dialog steps derived from `ui:ConfirmDialog`/`Dialog` destructive variant. Not in the mock: all dialog steps, disabled state, error.

## 7. Reuse

- `ui:DangerRow` (OVE_DS082), `ui:Dialog`, `ui:KeyValueList`, `ui:TextField`, `ui:Skeleton`, `useLocalApproval`, `lib:current-workspace`, `useToast`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific (critical): destructive and irreversible -> three independent guards: typed exact name (UI + engine), Local Approval bound to `{workspaceId, confirmName, expectedVersion}`, and engine refusal while Runs are active. Not available from Telegram/Chief/Agents (desktop UI only; engine enforces). The preview comes from the engine; the UI never computes counts itself. After deletion no Workspace data is left in UI memory/storage. Backups still contain the data until retention expires: the dialog states that (honest scope).

## 10. Errors and edge cases

- Name contains emoji/RTL/combining marks: compared after NFC on both sides.
- Copy-paste with trailing space: does not match (stated in hint).
- Engine restarts mid-delete: the transaction is atomic (all-or-nothing): UI refetches the Workspace before showing the result.
- Deleted from another window: push `workspace.deleted` closes the dialog and redirects.
- The Workspace has 0 counts: the same flow (no shortcut).

## 11. Acceptance criteria

- [ ] Given the row, Then it matches `design.png` and the description mentions Decisions.
- [ ] Given active Runs, Then the button is disabled with the visible reason.
- [ ] Given the typed name differs by case, Then Continue stays disabled.
- [ ] Given all steps confirmed, Then one delete request with `confirmName`, `expectedVersion`, `localProof` and an Idempotency-Key is sent.
- [ ] Given success, Then the UI navigates to the dashboard, the Workspace is gone from the list and the current Workspace changes.
- [ ] Given Cancel at any step, Then no delete request is sent.
- [ ] Given a retry after a 500, Then a new Local Approval is requested and the same idempotency key is used.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `deletion-preview.test.ts`, `DeleteWorkspaceDialog.test.tsx` (steps, name rules incl. NFC, active runs, retry, cancel), `delete.security.test.ts` (no request without approval), Playwright `delete-workspace.e2e.ts` against a mock engine with cascade stub, visual of the row. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/delete, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/DeleteWorkspaceRow.tsx`, `apps/desktop/src/features/workspace-settings/components/DeleteWorkspaceDialog.tsx`, `apps/desktop/src/features/workspace-settings/components/isolation-rows/delete.row.tsx`, `apps/desktop/src/features/workspace-settings/model/deletion-preview.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the delete route reads `localProof` from the body like PERM routes (DATA012 contract does not declare it yet): gap in the final report.
- OPEN: offering 'Create a backup first' button (BACKUP009 run now); default: a text hint only.
