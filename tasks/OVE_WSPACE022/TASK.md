---
id: OVE_WSPACE022
title: "Permissions section: terminal, network allow-list, Git and MCP toggles"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS017, OVE_DS026, OVE_DS028, OVE_DS036, OVE_DS040, OVE_DS078, OVE_DS081, OVE_PERM026, OVE_WSPACE014, OVE_WSPACE015, OVE_WSPACE017, OVE_WSPACE018]
soft_depends_on: []
provides: []
needs: ["ui:SettingsSection", "ui:ToggleRow", "ui:Dialog", "ui:Chip", "ui:TextField", "ui:InfoNote", "ui:Popover", "lib:use-local-approval", "api:perm.policies", "api:perm.effective"]
owns: ["apps/desktop/src/features/workspace-settings/components/sections/Permissions.section.tsx", "apps/desktop/src/features/workspace-settings/model/capability-rows.ts", "apps/desktop/src/features/workspace-settings/components/HostAllowlistDialog.tsx"]
reads: []
design: design.png
design_source: "Workspace#ws/perms-section (crop 328,506,1004,328 CSS px)"
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3, 21]
---

# OVE_WSPACE022: Permissions section: terminal, network allow-list, Git and MCP toggles

## 1. Summary

Implements the 'Uprawnienia' section: four toggle rows (Terminal w kontenerze, Sieć with host allow-list, Git, Serwery MCP) bound to the Workspace capability set, with the note that effective permissions are an intersection, the allow-list editor and Local Approval for every widening.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock regions `ws/perms-section` (340,517,980x304) with rows `ws/perms-row-on` ('Terminal w kontenerze · dozwolony', 'Sieć · tylko: github.com, npmjs.org', 'Git · commit tak · push za Zgodą') and `ws/perms-row-off` ('Serwery MCP · brak'). `PUT /v1/permissions/policies/{id}/capabilities` (PERM026, widening needs `localProof`). `CapabilitySet` (PERM001): `terminal 'allow'|'deny'|'inherit'`, `network {mode:'deny'}|{mode:'allowlist',hosts[]}`, `git {local, remote}`, `mcp {servers[]}`, `tools {toolIds[]}`. Effective permissions explanation: `GET /v1/permissions/effective?workspaceId=` (PERM026).

## 3. Scope (in)

- `components/sections/Permissions.section.tsx` (id `permissions`, order 20).
- `model/capability-rows.ts`: policy capabilities -> `ToggleRowProps[]` and widening classification.
- `components/HostAllowlistDialog.tsx`: add/remove hosts, validation.
- Effective-permissions explainer (`ui:InfoNote` + 'Show effective' popover).

## 4. Out of scope

- Per-Agent/Workflow/Tool policies (AGUI, WFED).
- Chrome/simulator rows (post-MVP, reserved).

## 5. Detailed requirements

1. Rows via `ui:ToggleRow` (label 14/600, mono value 12, `ui:Switch role='switch'`): (1) Terminal in container: `terminal==='allow'` ON, value `allowed`/`denied`; (2) Network: ON when `mode==='allowlist'` (value `only: github.com, npmjs.org`, first 3 hosts + `+N`), OFF = `deny` (value `blocked`); the row has an `Edit hosts…` ghost button; (3) Git: ON when `local==='allow'`; value `commit yes · push needs Approval` (push ALWAYS needs Approval unless an override lifts it, shown as text from the overrides data: 'push without Approval (your rule)' with amber tone if lifted); `remote` allow/deny second switch inside the row dialog; (4) MCP servers: ON when `servers.length>0`, value `none` or `N servers`; enabling opens a chooser from known server ids (ASSUMPTION: MCP management is post-MVP: the row is shown but the switch is disabled with 'not available in this version' when the engine reports no MCP servers).
2. Classification: turning a capability from deny to allow, adding a host, or enabling remote git is WIDENING (needs Local Approval, operation `policy.widen`); turning off, removing hosts, `allow->deny` is narrowing (immediate). Per PERM004 `inherit` means no narrowing at this layer: display `inherit` as ON with value 'inherited' and a tooltip (rare for Workspace scope).
3. Network allow-list editor (`ui:Dialog`): list of hosts as removable chips, add field with validation (lowercase DNS name or `*.example.com`, max 253 chars, no IP literal, port, scheme, spaces; max 200 hosts: same refinement as `HostPattern`, imported from contracts, not retyped), live error text; Save sends the whole set via `PUT capabilities`; adding hosts triggers Local Approval with a summary of ADDED hosts; removing only = immediate. Provider hosts of model CLIs are pre-approved by the engine (BOX023) and shown as a read-only line 'Always allowed: model providers (Anthropic, OpenAI)' (informational, from the engine response if provided, else static key).
4. Intro text: 'Efektywne uprawnienia to przecięcie Twoich, Workspace\'u, Agenta, Workflow i Narzędzia.' with a text button 'Show effective permissions' opening a popover listing, for the default Agent profile, the effective directories/capabilities and the reason codes (from `perm.effective.preview`, read-only; no editing).
5. Disabled state while a mutation is in flight; optimistic UI only for narrowing.
6. Global Pause does not block settings edits.

## 6. Design notes

`design.png`: section card with description, a `#140F20` r16 list of four rows (51px each), switches violet on / grey off, mono values coloured (mint 'dozwolony', amber for network hosts, muted for git/MCP). Not in the mock: hosts dialog, pending state, disabled MCP row, effective popover.

## 7. Reuse

- `ui:SettingsSection`, `ui:ToggleRow` (OVE_DS081), `ui:Dialog`, `ui:Chip`, `ui:TextField`, `ui:InfoNote`, `ui:Popover`.
- `useLocalApproval`, `usePolicy`, `useVersionedMutation`, `HostPattern` zod from contracts.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: network allow-list widening is a data-exfiltration risk (ADR 0021: new domain needs Approval): adding a host needs Local Approval and is blocked from Telegram. The UI validates host syntax but the engine is authoritative. Wildcards are shown literally; a pasted URL is rejected (not silently trimmed). The always-allowed provider hosts line is informational and not editable.

## 10. Errors and edge cases

- Empty host list while network ON: engine rejects an empty allowlist (or treats as deny); UI prevents saving an empty list (turn the switch off instead).
- Duplicate hosts: de-duplicated client-side before send, warned.
- IDN/unicode host: rejected with explanation (punycode only).
- Policy version conflict: refetch and ask again.
- Git remote allowed but network denied: show a warning line 'Git over the network needs Network'.

## 11. Acceptance criteria

- [ ] Given the mock capability set, Then the four rows match `design.png`.
- [ ] Given Terminal turned on, Then Local Approval is requested before the PUT; turned off, Then the PUT is sent immediately.
- [ ] Given adding `example.com`, Then approval summary lists it; given an invalid host, Then an inline error and no request.
- [ ] Given removing a host only, Then no approval is requested.
- [ ] Given MCP not available, Then the switch is disabled with the explanation.
- [ ] Effective popover shows engine-provided reasons only.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `capability-rows.test.ts` (mapping and widening classification truth table), `HostAllowlistDialog.test.tsx` (validation cases), `Permissions.section.test.tsx`, Playwright `permissions.e2e.ts`. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/permissions, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/sections/Permissions.section.tsx`, `apps/desktop/src/features/workspace-settings/model/capability-rows.ts`, `apps/desktop/src/features/workspace-settings/components/HostAllowlistDialog.tsx` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: MCP row disabled in MVP unless engine lists servers.
- OPEN: where Chrome/simulator rows will appear (post-MVP).
