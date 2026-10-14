---
id: OVE_WSPACE025
title: "Default-consent exceptions: lift an Approval requirement locally and restore it"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS017, OVE_DS024, OVE_DS036, OVE_DS082, OVE_PERM026, OVE_WSPACE014, OVE_WSPACE015, OVE_WSPACE018, OVE_WSPACE023]
soft_depends_on: []
provides: []
needs: ["ui:ConsentExceptionChips", "ui:Pill", "ui:ConfirmDialog", "ui:CheckboxRow", "ui:Button", "lib:use-local-approval", "api:perm.overrides"]
owns: ["apps/desktop/src/features/workspace-settings/components/ConsentExceptions.tsx", "apps/desktop/src/features/workspace-settings/components/LiftRequirementDialog.tsx", "apps/desktop/src/features/workspace-settings/model/consent.ts", "apps/desktop/src/features/workspace-settings/components/rules-areas/consent.area.tsx"]
reads: []
design: design.png
design_source: "Workspace#ws/consent-exceptions (crop 328,1231,1004,72 CSS px, tall render)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.10"]
adr_refs: [21, 3, 6]
---

# OVE_WSPACE025: Default-consent exceptions: lift an Approval requirement locally and restore it

## 1. Summary

Implements 'Wyjątki od domyślnej listy zgód · tylko lokalnie': the chips of actions that currently need the Owner's Approval, the flow to lift a requirement (Local Approval only) and to restore it, so the Owner can allow e.g. git push without Approval but never from Telegram.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). ADR 0021: default Approval list = delete files, git push and any publish, send messages/mails externally, payments, new domain, exceeding the Budget; the Owner may lift a requirement for an action in the Rules, only locally (never from Telegram, criterion 10). Mock region `ws/consent-exceptions`: mono label 'WYJĄTKI OD DOMYŚLNEJ LISTY ZGÓD · TYLKO LOKALNIE', amber chips 'git push: wymaga Zgody', 'usuwanie plików: wymaga Zgody', 'nowa domena: wymaga Zgody' and a dashed '+ zdejmij wymóg'. PERM012/026: `GET /v1/permissions/approval-overrides?workspaceId=`, `PUT .../approval-overrides/{actionClass}` body `{workspaceId, ownerRuleId?, localProof}` (lift), `DELETE .../approval-overrides/{id}` (restore, narrowing, no proof). `ActionClass` / liftable list: PERM006; `ConsentAction` enum: DATA013.

## 3. Scope (in)

- `components/ConsentExceptions.tsx` plugged in via `components/rules-areas/consent.area.tsx`.
- `model/consent.ts`: default list, overrides, `requiresApproval[]`, labels.
- `LiftRequirementDialog.tsx`: choose action(s) with consequences text.
- Restore flow and the 'lifted' list.

## 4. Out of scope

- Owner Rule `consentOverrides` editing via rules (not exposed; see section 14).
- Enforcement (PERM014).

## 5. Detailed requirements

1. Display: label (mono 10 `mono-label`) 'EXCEPTIONS TO THE DEFAULT APPROVAL LIST · LOCAL ONLY' then `ui:ConsentExceptionChips` where each chip is an action that STILL requires Approval (`label` = `{{action}}: requires Approval`, amber meta tone) and its `close` button is 'Lift requirement: {{action}}' (the mock chips + DS082 removal semantics). Trailing dashed button '+ zdejmij wymóg' / EN '+ lift a requirement' opens the dialog with checkboxes for the same actions.
2. Below, only if overrides exist, a second row 'Requirement lifted for this Workspace:' with chips for each override in a distinct style: `Pill` amber outline with the word 'lifted' (word + tone, not colour only), each with a ghost 'Restore requirement' button (narrowing: `DELETE override`, no proof, immediate, toast 'Requirement restored: git push').
3. Default list (labels): `delete_files` 'deleting files', `git_push` 'git push and any publication', `send_external_message` 'sending messages or e-mail outside', `payment` 'payments', `new_domain` 'new domain', `exceed_budget` 'exceeding the Budget'. The set of LIFTABLE classes comes from the engine (`liftable` flags, PERM006); non-liftable classes (ASSUMPTION: payment, exceed_budget) have chips without the remove button and a tooltip 'This requirement cannot be lifted'.
4. Lift dialog: title 'Lift the Approval requirement?', for each chosen action the plain consequence text from i18n (`consent.consequence.git_push`: 'Agents of this Workspace will be able to push to remote repositories without asking you.'), scope fixed to THIS Workspace (global lifting is not offered here), danger styling; confirm -> `useLocalApproval().run({operation:'override.lift', args:{ actionClass, workspaceId }, call:(proof,args)=> liftOverride({...args, localProof: proof})})` ONE action per call/proof (the proof is bound to one actionClass; multiple selected actions are lifted sequentially with one approval each, stopping at the first failure).
5. After success the chip moves from 'requires' to 'lifted' (push `override.changed`); the Permissions row for Git updates ('push without Approval (your rule)').
6. Empty (all lifted or none liftable) states: if there are no chips the label shows 'No default requirements remain.'.
7. Isolated Workspaces behave the same (ADR 0028 changes nothing).
8. Telegram: this surface does not exist there; the engine refuses lifting from any other channel (`perm.channel_not_permitted`).

## 6. Design notes

`design.png`: mono label + three amber meta chips (`#FFD69A`-ish text on amber tint, mono 12) and the dashed violet-outline '+ zdejmij wymóg' button. Not in the mock: lifted row, restore, dialog, disabled/non-liftable chip, empty.

## 7. Reuse

- `ui:ConsentExceptionChips` (OVE_DS082), `ui:Pill`, `ui:Dialog`/`ui:ConfirmDialog`, `ui:CheckboxRow`, `ui:Button`, `useApprovalOverrides`, `useLocalApproval`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific (critical, SPEC 16.10): lifting a requirement EXPANDS permissions, so it needs Local Approval bound to `{actionClass, workspaceId}`, is desktop-only and one class per proof. Restoring tightens and is immediate. The UI offers no 'lift for all Workspaces' and never lifts from a chat message, notification or Chief proposal (proposals have no overrides field). Overrides are shown with a visible word 'lifted' so they are never invisible.

## 10. Errors and edge cases

- Class not liftable: no remove button; engine would answer `perm.override_not_allowed`.
- Override limits (7 per Workspace): engine error shown.
- Lift succeeds for the first action and fails for the second: first stays lifted, the dialog reports exactly which failed.
- Override created by a rule elsewhere (`ownerRuleId`): shows 'from rule R2' text in the lifted row.
- Restore while an Approval request relied on it: engine re-evaluates (PERM014); UI just reports success.

## 11. Acceptance criteria

- [ ] Given default state, Then chips match `design.png` and none shows lifted items.
- [ ] Given 'git push' selected and confirmed locally, Then exactly one PUT with `localProof` is sent and the chip becomes 'lifted'.
- [ ] Given Cancel, Then nothing is sent.
- [ ] Given Restore, Then a DELETE without proof is sent.
- [ ] Given a non-liftable class, Then it has no remove button.
- [ ] Given Telegram simulation, Then the engine refusal is surfaced and no state changes.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `consent.test.ts` (default list, overrides, liftable), `LiftRequirementDialog.test.tsx` (sequential lifts, partial failure), `ConsentExceptions.test.tsx`, Playwright `consent.e2e.ts` (proof binding negative test). Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/consent, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/ConsentExceptions.tsx`, `apps/desktop/src/features/workspace-settings/components/LiftRequirementDialog.tsx`, `apps/desktop/src/features/workspace-settings/model/consent.ts`, `apps/desktop/src/features/workspace-settings/components/rules-areas/consent.area.tsx` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: mock chips = actions that still require Approval (the label says exceptions); confirm with the Owner/designer (final report).
- ASSUMPTION: UI uses the PERM override route, not Rule `consentOverrides` (DATA015) to avoid two writers; DATA/PERM must reconcile.
- ASSUMPTION: payment and exceed_budget are not liftable.
