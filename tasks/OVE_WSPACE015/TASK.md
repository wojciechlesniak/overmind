---
id: OVE_WSPACE015
title: Local Approval dialog UI with operation summary and expiry feedback
area: WSPACE
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS009, OVE_DS013, OVE_DS036, OVE_DS051, OVE_WSPACE014]
soft_depends_on: []
provides: ["ui:LocalApprovalDialog"]
needs: ["ui:ConfirmDialog", "ui:Dialog", "ui:Button", "ui:Icon", "ui:KeyValueList", "ui:Spinner"]
owns: ["apps/desktop/src/features/local-approval/components/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3, 6]
---

# OVE_WSPACE015: Local Approval dialog UI with operation summary and expiry feedback

## 1. Summary

Builds the confirmation dialog of the Local Approval flow: a destructive-style dialog that restates the exact action (what, where, rights), explains that it applies only at this computer, and confirms or cancels, with clear progress and error states.

## 2. Context

Local Approval (Zgoda lokalna, glossary) is an approval given only at the computer with Overmind, never remotely (ADR 0003, 0006, 0021; spec 11; acceptance criteria 9 and 10). Actions that WIDEN access or weaken protection need it: permanent folder grant, deleting a Workspace, lifting a consent requirement, relaxing isolation, changing the backup folder. Backend (PERM009): the Owner desktop session calls `POST /v1/local-confirmations` with `{ operation, args, ttlSeconds }` (route scope owner, `local:true`, desktop principal only, rate limit 10/min) and receives `{ confirmationId, expiresAt, actionHash }`; the widening call then carries `localProof: { confirmationId }` in its BODY; the engine recomputes `sha256(canonicalJson({operation,args,installationId}))` from the ACTUAL call arguments, so a proof is bound to exactly those arguments, expires after at most 60 s on the engine's monotonic clock and is single use. Operations registered by area: `access.grant_permanent`, `policy.widen`, `override.lift` (PERM), `workspace.delete`, `workspace.make_shared` (DATA), `owner_rule.lift_consent` (DATA), `backup.folder.change` (BACKUP). Telegram, Agents and Chief can never obtain a proof (PERM008): the UI cannot make it possible either, because the UI contains no way to mint or forward a proof for another channel. The dialog is the 'presence factor' of the MVP (PERM009 requirement 8: the UI must show the operation summary derived from `args` before the mint call).

## 3. Scope (in)

- `components/LocalApprovalDialog.tsx` (rendered by `LocalApprovalProvider`).
- `components/OperationSummary.tsx` (rows from the describer).
- States: confirming, working (minting/calling), failed (with reason), success handled by the caller (dialog closes).

## 4. Out of scope

- State machine and describers (OVE_WSPACE014).
- Domain-specific forms (each feature).

## 5. Detailed requirements

1. Structure on `ui:ConfirmDialog` (DS036, `role='alertdialog'` when severity is `danger`): title from describer (`MessageRef`), a lock-shield icon, summary `dl` rows (label left muted 13, value right: mono 13 for paths), a fixed explanatory line `localApproval.localOnly` ('This approval is only possible at this computer. It cannot be given from Telegram.'), a second line `localApproval.oneUse` ('It applies to exactly this action and expires in 60 seconds.').
2. Buttons: `Cancel` (`secondary lg`, initial focus when `danger`) and the confirm label from the describer (`primary-violet lg`; for `danger` severity `danger` tone). The confirm label is verb-specific ('Add folder', 'Delete Workspace', 'Turn off isolation', 'Remove requirement') never just 'OK'.
3. Working: confirm button shows the spinner and `aria-busy`, both buttons disabled, text `localApproval.working` ('Confirming at this computer…'); no countdown is needed because minting+call take milliseconds; if the call exceeds 5 s show 'Still working…'.
4. Failed: inline alert with the mapped message; for `expired`/`used`/`mismatch` the primary button becomes 'Ask again' which restarts the machine from `confirming` (new summary, new mint on confirm); for `channel_not_permitted`/`owner_required` only 'Close'.
5. Not dismissible by Escape or backdrop while `working`; Escape cancels while `confirming`. Focus returns to the invoking control (kit).
6. Screen reader: dialog name = title; summary rows are a description list; failures use `role='alert'`.
7. i18n keys under `localApproval.*` (EN/PL). PL: 'Zgoda lokalna', 'To potwierdzenie działa tylko przy tym komputerze. Nie można go udzielić z Telegrama.'

## 6. Design notes

Derived from `ui:ConfirmDialog` destructive variant (error-tinted title icon, `--om-error` border at 40%). Sizes: width 480, padding 24, rows gap 8. Not in the mock: all states.

## 7. Reuse

- `ui:ConfirmDialog`, `ui:Dialog`, `ui:Button`, `ui:Icon`, `ui:KeyValueList`, `ui:Spinner`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/local-approval/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: the dialog MUST render the exact fields that are bound in the proof; a describer may not hide an argument that changes the effect (test: every key of `args` appears in a row or is listed in the describer's `hiddenKeys` with a reason). Values are text only. The dialog cannot be skipped by a prop (`autoConfirm` does not exist), so no caller can obtain a proof without a human click.

## 10. Errors and edge cases

- Very long path: ellipsis in the middle with title and a 'Show full' expander.
- Describer throws: fail closed, dialog shows generic error, no mint.
- Screen locked/app in background: the dialog stays; idle timeout of 120 s cancels (OVE_WSPACE014).
- High contrast mode: border and icon remain visible (tokens).

## 11. Acceptance criteria

- [ ] Given `workspace.delete` args, Then the dialog lists Workspace name and counts and uses danger styling with Cancel focused.
- [ ] Given confirm, Then buttons disable and spinner shows until the outcome.
- [ ] Given `expired`, Then 'Ask again' restarts the flow.
- [ ] Given Escape while confirming, Then the run is cancelled and no call is sent.
- [ ] Test proves every args key is displayed or whitelisted.
- [ ] axe clean; focus trap and return verified.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `LocalApprovalDialog.test.tsx` (states, focus, escape rules), `args-coverage.test.ts` (all describers display all args keys), stories per state/operation, visual smoke (no design.png: derived). Commands: `pnpm --filter @overmind/desktop test features/local-approval/components`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/local-approval/components/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- OPEN: whether Touch ID should replace the click (see OVE_WSPACE014).
