---
id: OVE_WSPACE027
title: "Isolation toggle: turning on freely, turning off with Local Approval and warning"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DATA011, OVE_DS023, OVE_DS036, OVE_DS040, OVE_DS078, OVE_WSPACE014, OVE_WSPACE015, OVE_WSPACE017, OVE_WSPACE018]
soft_depends_on: []
provides: ["lib:isolation-rows-context"]
needs: ["ui:SettingsSection", "ui:SettingRow", "ui:Switch", "ui:ConfirmDialog", "ui:InfoNote", "lib:use-local-approval", "api:workspaces.set_isolation"]
owns: ["apps/desktop/src/features/workspace-settings/components/sections/Isolation.section.tsx", "apps/desktop/src/features/workspace-settings/components/IsolationSwitch.tsx", "apps/desktop/src/features/workspace-settings/components/isolation-rows/context.ts"]
reads: []
design: design.png
design_source: "Workspace#ws/isolation-section top (crop 328,1480,1004,148 CSS px, tall render)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 16.10"]
adr_refs: [28, 3, 6]
---

# OVE_WSPACE027: Isolation toggle: turning on freely, turning off with Local Approval and warning

## 1. Summary

Implements the 'Workspace izolowany' switch in 'Izolacja i budżet': enabling isolation applies immediately (it narrows exposure), disabling it requires Local Approval and a clear warning about what becomes visible to Chief and other Workspaces.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock region `ws/isolation-section`: row 'Workspace izolowany' with help 'Decyzje i Pamięć nie wychodzą poza ten Workspace, a wszystko, co tu powstanie, jest prywatne.' and a switch (off). SPEC 10: an isolated Workspace shares nothing outside and everything in it is private; ADR 0028: in an isolated Workspace everything is private and cannot be changed, public items from other Workspaces can still be used. DATA011: `POST /v1/workspaces/{id}/isolation {isolated, expectedVersion}`; OFF calls `LocalApprovalGate.require({action:'workspace.make_shared', target:id})` (operation `workspace.make_shared`).

## 3. Scope (in)

- `components/sections/Isolation.section.tsx` (id `isolation`, order 60) containing the isolation row; the private-items row (OVE_WSPACE028) and budget row (OVE_WSPACE029) plug in via `components/isolation-rows/*.row.tsx` (glob).
- `components/IsolationSwitch.tsx` with ON and OFF flows.
- Impact summary before turning ON (what will become private).

## 4. Out of scope

- Private items list (OVE_WSPACE028), budget (OVE_WSPACE029), delete (OVE_WSPACE030).

## 5. Detailed requirements

1. Row: `ui:ToggleRow`-style `ui:SettingRow` label 'Workspace izolowany', help (mock copy), `ui:Switch role='switch' aria-checked`. State from `workspace.isolated`. While a request is pending the switch is disabled and shows a spinner.
2. Turn ON: confirmation `ui:ConfirmDialog` (not Local Approval; it narrows) 'Isolate this Workspace? Chief will no longer see its Decisions and Memory. All Agents, Skills and Workflows created here become private. You can turn this off only at this computer.' + impact counts from `visibility.impact`-style summary (ASSUMPTION: the number of currently PUBLIC items of this Workspace that will become private: agents/skills/workflows with `ownerWorkspaceId` null cannot be affected; items OWNED by the Workspace that are public become private: count from OVE_WSPACE028 data). Confirm -> `setIsolation({id, isolated:true, expectedVersion})`.
3. Turn OFF: first a danger `ConfirmDialog` explaining consequences ('Decisions and Memory of this Workspace become searchable by Chief and other Workspaces. Items you make public later become visible everywhere. Existing private items stay private until you change them.'), then Local Approval with operation `workspace.make_shared` (`args:{ workspaceId }`), then `setIsolation({isolated:false, expectedVersion, localProof})`. Two steps on purpose: the first is the informed warning, the second the presence factor. Cancelling either leaves the switch ON.
4. Optimistic UI is NOT used for OFF; for ON the switch flips after the response (also push `workspace.updated`).
5. After the change the page shows a toast and the private-items row recomputes; the dashboard card (other feature instance) updates through push.
6. Disabled with reason when a Run is active? The engine decides; the UI shows its error `data.workspace_has_active_runs` if returned (ASSUMPTION: not blocked).

## 6. Design notes

`design.png`: the card top with title 'Izolacja i budżet', description, and the bordered list whose first row is the isolation switch (off: grey track + knob). Not in the mock: ON state, the two dialogs, pending, error.

## 7. Reuse

- `ui:SettingsSection`, `ui:SettingRow`, `ui:Switch`, `ui:ConfirmDialog`, `ui:InfoNote`, `useLocalApproval`, `setIsolation` mutation (OVE_WSPACE018 `api/`).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific (critical, ADR 0028, spec 10): relaxing isolation EXPOSES private knowledge; it is a widening action: Local Approval REQUIRED, never from Telegram or Chief, bound to `{workspaceId}` and audited by the engine. Enabling isolation must not be a way to hide history from the Owner: it only changes what other Workspaces and Chief can see. The UI never offers to isolate on behalf of Chief.

## 10. Errors and edge cases

- Version conflict: refetch and re-open the dialog.
- Network failure after Local Approval: the proof is consumed by the engine even if the response is lost: UI refetches the Workspace to learn the real state before offering a new attempt.
- Switch toggled via keyboard repeatedly: second activation ignored while pending.
- Workspace paused or Global Pause: allowed.
- Isolated Workspace that has public items from elsewhere in use: unaffected.

## 11. Acceptance criteria

- [ ] Given isolation off, When ON is confirmed, Then one request with `isolated:true` and no proof is sent.
- [ ] Given isolation on, When OFF is chosen, Then warning dialog, then Local Approval, then one request with `localProof`, in this order.
- [ ] Given Cancel at either step, Then the switch stays ON and nothing is sent.
- [ ] Given a lost response, Then the UI refetches before any retry.
- [ ] The switch exposes `role=switch` and `aria-checked`; focus returns to it after dialogs.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `IsolationSwitch.test.tsx` (flows, cancel, conflict, lost response), Playwright `isolation.e2e.ts` incl. negative test: engine refuses OFF without proof. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/isolation, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/sections/Isolation.section.tsx`, `apps/desktop/src/features/workspace-settings/components/IsolationSwitch.tsx`, `apps/desktop/src/features/workspace-settings/components/isolation-rows/context.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: no blocking on active Runs for toggling isolation (engine decides).
- OPEN: the exact impact numbers before ON.
