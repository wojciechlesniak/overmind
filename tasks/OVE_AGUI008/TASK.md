---
id: OVE_AGUI008
title: "Visibility selector and the explicit visibility change flow with usage check"
area: AGUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_AGENT006, OVE_AGUI003, OVE_AGUI005, OVE_AGUI007, OVE_BOARDUI001, OVE_DS025, OVE_DS036, OVE_VIS008]
soft_depends_on: []
provides: ["lib:agent-visibility-region"]
needs: ["api:agents.visibility", "api:visibility.impact", "lib:api-client-agents", "lib:api-client-visibility", "ui:RadioCardGroup", "ui:ConfirmDialog", "ui:Dialog", "lib:use-gateway-mutation", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/regions/visibility.region.tsx", "apps/desktop/src/features/agents/components/VisibilityDialog.tsx", "apps/desktop/src/features/agents/state/use-visibility-change.ts", "apps/desktop/src/locales/en/agents-visibility.json", "apps/desktop/src/locales/pl/agents-visibility.json"]
reads: []
design: design.png
design_source: "Agenci#agents/visibility-selector (crop 390,317,712,98 CSS px) (crop 390,317,712,98 CSS px)"
spec_refs: ["SPECIFICATION 9"]
adr_refs: [28, 14]
---

# OVE_AGUI008: Visibility selector and the explicit visibility change flow with usage check

## 1. Summary

The `WIDOCZNOŚĆ` selector (PUBLICZNY / PRYWATNY cards with helper text) and its explicit change flow: dry-run impact check, blocking when the Agent is used in other Workspaces, confirmation dialog, then `PATCH /v1/agents/{id}/visibility`. Visibility is NEVER changed by the generic save button.

## 2. Context

Mock `agents/visibility-selector`: two radio cards, `PUBLICZNY` `dostępny we wszystkich Workspace'ach` (blue ring) and `PRYWATNY` `tylko w Workspace „Aplikacja rezerwacji”` (violet), help line `Pamięć agenta i tak zostaje osobno w każdym Workspace...`. AGENT006: `to:'private'` requires `ownerWorkspaceId`; usage elsewhere returns `agent.visibility_in_use {workspaceCount, workspaceIds}`; `to:'public'` only for persistent Agents and not in isolated Workspaces; running Runs keep their pinned version (`runsKeepPinnedVersion`). VIS008: `GET /v1/visibility/agent/{id}/impact?to=private&ownerWorkspaceId=` is a read-only dry run. Widening visibility is the Owner's explicit action, on the desktop only.

## 3. Scope (in)

- Region rendering the selector card inside the Configuration tab with `visibilityGuard`.
- `useVisibilityChange(agentId)`: impact query + mutation.
- `VisibilityDialog` for both directions.

## 4. Out of scope

- Visibility of Skills (OVE_SKUI008), Chief visibility proposals (CHIEF).

## 5. Detailed requirements

1. Selecting the other card does NOT change the draft nor call the API: it opens `VisibilityDialog` (ui `Dialog`) showing what will happen in words.
2. To `private`: first call the impact route with `ownerWorkspaceId = current Workspace`; if `allowed` is false the dialog lists the blockers (Workspace names and referrer names, max 5 plus `+N więcej`, plain text) and the confirm button is absent: the Owner must detach the Agent there first. If allowed: text `Agent będzie widoczny tylko w Workspace „{name}”. Uruchomione Runy zachowują swoją wersję.` and a confirm button `Ustaw jako prywatny`.
3. To `public`: text `Agent będzie dostępny we wszystkich Workspace'ach. Pamięć agenta nadal zostaje osobno w każdym Workspace.`; for an isolated Workspace (`workspace.isolated`) the option is disabled with the visible reason `Workspace izolowany: Agent nie może być publiczny`; Dynamic Agents show `Najpierw zaakceptuj Agenta jako stałego`. Confirm button `Ustaw jako publiczny` is a normal button (not auto-focused), cancel is the initial focus.
4. The mutation body is `{ to, ownerWorkspaceId?, expectedVersion }` where `ownerWorkspaceId` is the CURRENT Workspace id taken from the app context, never from user input; the result updates the Agent (new version) and the draft is rebased; a dirty draft is preserved and its base version updated.
5. The result's `runsKeepPinnedVersion` and active-Run count (when present) render as a notice line in the dialog result toast: `Aktywne Runy ({n}) zostają przy swojej wersji`.
6. Errors: `agent.visibility_in_use` (blockers list), `agent.private_requires_workspace` (reason `isolated`), `agent.version_conflict` (reload), `perm.owner_required`/`perm.local_only` (message `Tylko przy komputerze` - the desktop channel is the only caller, so this means a stale session).
7. `visibilityGuard.privateBlockedReason` for the card is filled from a background impact call when the Agent is public and in use elsewhere (text `Używany w {n} innych Workspace'ach`), so the Owner sees it before clicking.
8. Both cards always show the visibility WORD (ADR 0028); the dialog repeats it in the title (`Zmiana widoczności: PUBLICZNY -> PRYWATNY`).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:RadioCardGroup` via `AgentConfigForm` (OVE_DS068, `visibilityGuard`), `ui:Dialog`, `ui:ConfirmDialog`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/visibility.region.tsx`, `components/VisibilityDialog.tsx`, `state/use-visibility-change.ts`. `visibility.region.tsx` renders into the slot `config-extensions` (OVE_AGUI007) and registers `onRequestChange` that opens the dialog; the visibility cards of the form stay controlled by the real visibility of the Agent.

## 9. Security and safety

Making an Agent public is a widening: it needs the Owner's explicit confirm and is accepted only from the desktop session (the gateway rejects Telegram, Chief and agents). This UI additionally never offers the change inside a generic form submit, never batches it with a configuration save and never sends it from an automatic path. Whether a local-proof is required for `public` is an open PERM/VIS question (see 14); if the engine answers `perm.local_approval_required` the flow switches to `useLocalApproval` (WSPACE) with operation `visibility.make_public` without UI changes elsewhere. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Impact call fails: the dialog says `Nie udało się sprawdzić użycia` and blocks the change (fail closed).
- Agent already has the chosen visibility: selection ignored.
- Concurrent edit (409 conflict): reload prompt, nothing changed.
- Workspace deleted meanwhile: error mapped, dialog closes.

## 11. Acceptance criteria

- [ ] Given a public Agent used in two other Workspaces, When choosing PRYWATNY, Then the dialog lists the blockers and offers no confirm button.
- [ ] Given an isolated Workspace, Then PUBLICZNY is disabled with the reason text.
- [ ] Given confirmation, Then exactly one PATCH to `/v1/agents/{id}/visibility` is sent with the current Workspace id.
- [ ] Given the generic save with a dirty form, Then no request touches visibility.
- [ ] Given the dialog open, Then cancel has focus and Esc closes without a request.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-visibility-change.test.tsx`, `VisibilityDialog.test.tsx` (blockers, isolated, confirm, errors). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Plugs into the config tab through `ConfigExtensions` (OVE_AGUI007); does not edit `ConfigTab.tsx`.

## 14. Open questions and assumptions

- ASSUMPTION: no local proof for `public`; if PERM requires one, `useLocalApproval` is added here only (reported to PERM: OwnerOperation list has `access.grant_permanent`, `override.lift`... but no `visibility.make_public`).
- ASSUMPTION: the DS `AgentConfigForm` calls `onChange` with the full value; ConfigTab detects a changed `visibility` and routes it to `onRequestChange`, then resets the displayed value to the real visibility until the engine confirms.
