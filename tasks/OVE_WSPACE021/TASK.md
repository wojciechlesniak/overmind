---
id: OVE_WSPACE021
title: "Edit rights and remove folders: narrowing without proof, widening with Local Approval"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS036, OVE_DS037, OVE_DS040, OVE_DS081, OVE_PERM026, OVE_WSPACE014, OVE_WSPACE015, OVE_WSPACE018, OVE_WSPACE019]
soft_depends_on: []
provides: []
needs: ["lib:use-local-approval", "ui:ConfirmDialog", "ui:InfoNote", "ui:useToast", "ui:PermissionMatrix", "api:perm.policies"]
owns: ["apps/desktop/src/features/workspace-settings/components/directories-actions/rights.actions.ts", "apps/desktop/src/features/workspace-settings/components/directories-actions/remove.actions.ts", "apps/desktop/src/features/workspace-settings/model/rights-change.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.10"]
adr_refs: [3]
---

# OVE_WSPACE021: Edit rights and remove folders: narrowing without proof, widening with Local Approval

## 1. Summary

Wires the checkbox matrix and the remove action: lowering a right or removing a folder applies immediately (narrowing), raising a right needs Local Approval (widening), and removing a folder warns when Runs are active.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). PERM026: `PATCH /v1/permissions/policies/{id}/directories/{dirId}` body `{rights?, primary?, label?, expectedVersion, localProof?}` (proof only if widening) and `DELETE .../directories/{dirId}?expectedVersion=&acknowledgeActiveRuns=` (narrowing, no proof). The route contract classifies; the UI must classify the same way BEFORE calling to decide whether to open the approval dialog (`policy-diff` semantics of PERM011).

## 3. Scope (in)

- `components/directories-actions/rights.actions.ts` and `remove.actions.ts`.
- `model/rights-change.ts`: `classifyRightsChange(prev,next): 'narrow'|'widen'|'none'`.
- Remove confirmation dialog (`ui:ConfirmDialog`) with active-Runs acknowledgement.
- Execute+write warning.

## 4. Out of scope

- Adding folders (OVE_WSPACE020).

## 5. Detailed requirements

1. Toggle semantics: unchecking a right: if `read` is unchecked while write/execute are checked the UI unchecks them too (valid sets only: `[read]`, `[read,write]`, `[read,execute]`, `[read,write,execute]`, PERM001); unchecking everything is not possible (the matrix keeps read; the remove button is the way). Checking `write` or `execute` is WIDENING.
2. `classifyRightsChange`: widen iff `next` contains a right not in `prev`; narrow iff `next` is a proper subset; the UI never combines widen and narrow in one call (rights change per click).
3. Narrowing: send `PATCH` immediately with `expectedVersion` (optimistic UI: checkbox flips, rolled back on error with a toast and the engine message).
4. Widening: `run({operation:'policy.widen', args:{policyId, dirId, rights:nextRights}, call:(proof,args)=>patchDirectory({...args, expectedVersion, localProof:proof})})`; the checkbox shows a pending state until the outcome; cancel leaves it unchecked.
5. Execute on a directory with write: before the approval dialog show `ui:InfoNote` 'Write + execute lets Agents run programs they wrote. Only do this for folders you trust.'
6. Remove: the `close` icon button (appears on row hover/focus; always in DOM) opens `ConfirmDialog` 'Remove folder {{path}}? Agents will lose access to it on their next step. Files stay on disk.'; if Runs of this Workspace are active (`api:runs.list` or the 409 `perm.active_runs` response) the dialog lists the count and requires ticking 'Stop access for running Agents' which sends `acknowledgeActiveRuns=true`. The primary directory cannot be removed (button absent, lock icon).
7. Removing the LAST folder is allowed (empty list = no access, intended) with the extra line 'Agents will have no access to any files.'
8. Telegram run-grant rows are read-only: no toggles, no remove (the grant ends with the Run).
9. Narrowing actions are audited by the engine; the UI shows the toast text only.
10. Concurrency: all changes for one policy are queued; each uses the `version` returned by the previous (OVE_WSPACE018 mutation helper).

## 6. Design notes

Uses the matrix and confirmation dialogs of the kit; the removal `IconButton close` per DS081. Not in the mock: pending checkbox state (spinner replaces check), confirmation dialog, error toast.

## 7. Reuse

- `useLocalApproval`, `useVersionedMutation` (OVE_WSPACE018), `ui:ConfirmDialog`, `ui:InfoNote`, `ui:useToast`, `ui:PermissionMatrix` callbacks.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: classification is done client-side only to choose the UX path; the ENGINE re-classifies and enforces (a lying UI cannot widen without proof: test with the mock gateway sending a widening PATCH without proof -> 403). Never send two rights changes in one request that mix widen and narrow. Removal does not delete files.

## 10. Errors and edge cases

- Right toggled twice quickly: queued; final state equals last click.
- Stale version: refetch + 'changed elsewhere' note (OVE_WSPACE031).
- Remove during an active Run without acknowledgement: engine 409 `perm.active_runs`; dialog shows the checkbox and retries with ack.
- Policy `maxRights` ceiling: engine may reject a widening with `perm.exceeds_ceiling`; message shown, checkbox reverts.
- Network error mid-change: revert + toast.

## 11. Acceptance criteria

- [ ] Given uncheck Write, Then a PATCH without `localProof` is sent immediately and the box stays unchecked.
- [ ] Given check Execute, Then the approval dialog opens first and only after confirmation a PATCH with `localProof` is sent.
- [ ] Given Cancel in the approval, Then the checkbox reverts and no request is sent.
- [ ] Given unchecking Read with Write on, Then both are lowered in one narrowing request.
- [ ] Given removal with active Runs, Then the acknowledgement checkbox is required.
- [ ] Given the primary folder, Then no remove control exists.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `rights-change.test.ts` (table of all 16 transitions), `rights.actions.test.ts` (proof only for widen), `remove.actions.test.ts` (ack flow, last folder, primary), Playwright `edit-rights.e2e.ts` incl. engine-side widening-without-proof 403 negative test. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/rights, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/directories-actions/rights.actions.ts`, `apps/desktop/src/features/workspace-settings/components/directories-actions/remove.actions.ts`, `apps/desktop/src/features/workspace-settings/model/rights-change.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: `perm.active_runs` is the 409 code for removing a directory used by active Runs (PERM011 acknowledges it).
- OPEN: allow narrowing `read` of the primary directory? Default: primary is locked.
