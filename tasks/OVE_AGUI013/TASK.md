---
id: OVE_AGUI013
title: "New Agent dialog: name, role, instructions, model, visibility and permission profile"
area: AGUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_AGUI003, OVE_AGUI005, OVE_AGUI007, OVE_BOARDUI001, OVE_DS025, OVE_DS026, OVE_DS030, OVE_DS036, OVE_PERM026]
soft_depends_on: []
provides: ["lib:agent-create-dialog"]
needs: ["api:agents.create", "api:perm.profiles", "lib:api-client-agents", "lib:api-client-perm", "ui:Dialog", "ui:TextField", "ui:Textarea", "ui:ModelPicker", "ui:RadioCardGroup", "ui:Select", "lib:use-gateway-mutation", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/components/CreateAgentDialog.tsx", "apps/desktop/src/features/agents/state/use-create-agent.ts", "apps/desktop/src/locales/en/agents-create.json", "apps/desktop/src/locales/pl/agents-create.json"]
reads: []
design: design.png
design_source: "Agenci#agents/list-header (crop 92,178,249,40 CSS px; the dialog itself is not drawn in the mock) (crop 92,178,249,40 CSS px)"
spec_refs: ["SPECIFICATION 9"]
adr_refs: [7, 3, 28]
---

# OVE_AGUI013: New Agent dialog: name, role, instructions, model, visibility and permission profile

## 1. Summary

`Nowy` opens a dialog to create a persistent Agent: name, role, instructions, model, visibility (default PRYWATNY in this Workspace) and the permission profile; created through `POST /v1/agents`.

## 2. Context

The `Nowy` button is in `agents/list-header`; the dialog is not drawn in the mock, so it is designed from the design-system rules. `CreateAgentInput` = `AgentConfig` fields (name 1..60 trimmed, role <=120, instructions <=20000, provider/model, `permissionProfileId`, visibility with `ownerWorkspaceId` iff private, budget/timeout/retry defaults). `permissionProfileId` is required (PERM profiles `Development`, `Read Only`, custom); effective access is still the intersection (ADR 0003).

## 3. Scope (in)

- `CreateAgentDialog` and `useCreateAgent`.
- Default values and validation.

## 4. Out of scope

- Skill assignment at creation (assign after creation in the profile), tools metadata.

## 5. Detailed requirements

1. Fields: Name (required), Role (optional), Instructions (optional, textarea), Model (`ui:ModelPicker`, required, from OVE_AGUI007 `useModelOptions`), Permission profile (`ui:Select` from `GET /v1/permissions/profiles`, default: the least-privileged built-in `Read Only` unless the Owner chooses otherwise: ASSUMPTION), Visibility (`RadioCardGroup`, default PRYWATNY with the current Workspace name; PUBLICZNY disabled in isolated Workspaces).
2. The profile description is shown under the select (`Development: ...`, plain text) and a line `Uprawnienia Workspace'u i tak ograniczają profil` (ADR 0003 intersection).
3. Submit builds the input with defaults taken from engine defaults (timeout 45 min = 2700 s, 2 retries, `retryNonIdempotent:false` is not sent) and `ownerWorkspaceId = current Workspace` when private; header `Idempotency-Key` ULID generated once per dialog open so a double click cannot create two Agents.
4. Name uniqueness: `agent.name_taken` shown under the Name field; names are trimmed, control characters are rejected client-side.
5. Success closes the dialog, selects the new Agent and focuses its profile heading; the new row appears via the list refetch/event.
6. Cancel with a non-empty form asks `Odrzucić nowego Agenta?` (small confirm); Esc behaves the same.
7. Telegram/Chief cannot use this UI; Chief creating Dynamic Agents is a separate engine path.
8. The dialog never offers `PUBLICZNY` combined with a Workspace-private Skill (no Skills here).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:Dialog`, `ui:TextField`, `ui:Textarea`, `ui:ModelPicker`, `ui:Select`, `ui:RadioCardGroup`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/CreateAgentDialog.tsx`, `state/use-create-agent.ts`; registered in the dialogs slot.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- No connected CLI: dialog explains and links to Connections; submit disabled.
- Profiles call fails: submit disabled (fail closed; never default to a broad profile).
- Name with leading/trailing spaces: trimmed.
- Double submit: same idempotency key, one Agent.

## 11. Acceptance criteria

- [ ] Given valid input, Then one POST creates a private Agent in the current Workspace and it becomes selected.
- [ ] Given an existing name, Then the Name field shows the taken error.
- [ ] Given an isolated Workspace, Then PUBLICZNY is disabled.
- [ ] Given a profile load failure, Then submit is disabled.
- [ ] Given a double click on submit, Then only one request is effective.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `CreateAgentDialog.test.tsx` (defaults, validation, idempotency, errors), `use-create-agent.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: default profile `Read Only`; the Owner may prefer `Development`. Needs the Owner's answer.
- ASSUMPTION: `Idempotency-Key` is supported by AGENT005 (if the engine ignores it, double-submit is prevented by disabling the button while pending).
