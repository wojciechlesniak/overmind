---
id: OVE_AGUI012
title: "Dynamic Agent promotion: accept as permanent with visibility choice, or decline"
area: AGUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_AGENT007, OVE_AGUI003, OVE_AGUI004, OVE_AGUI005, OVE_BOARDUI001, OVE_DS025, OVE_DS036]
soft_depends_on: []
provides: ["lib:agent-dynamic-flow"]
needs: ["api:agents.dynamic", "lib:api-client-agents", "ui:Dialog", "ui:ConfirmDialog", "ui:RadioCardGroup", "lib:use-gateway-mutation", "lib:agents-route"]
owns: ["apps/desktop/src/features/agents/components/AcceptDynamicDialog.tsx", "apps/desktop/src/features/agents/components/DeclineDynamicDialog.tsx", "apps/desktop/src/features/agents/state/use-dynamic-agent.ts", "apps/desktop/src/locales/en/agents-dynamic.json", "apps/desktop/src/locales/pl/agents-dynamic.json"]
reads: []
design: design.png
design_source: "Agenci#agents/dynamic-agent-card (crop 84,760,280,140 CSS px; the card overflows the 900 px mock viewport) (crop 84,760,280,140 CSS px)"
spec_refs: ["SPECIFICATION 9"]
adr_refs: [28, 15, 14]
---

# OVE_AGUI012: Dynamic Agent promotion: accept as permanent with visibility choice, or decline

## 1. Summary

The Owner's two decisions on a dynamic Agent that Chief proposes to keep: `Zachowaj jako stałego` (dialog to pick PRYWATNY or PUBLICZNY, default private) and `Usuń` (confirm, with the note that its memory is deleted).

## 2. Context

AGENT007: Chief creates a Dynamic Agent PRIVATE to the Task's Workspace; when the Task ends it becomes `proposed_for_keep`. `POST /v1/agents/{id}/dynamic/accept { expectedVersion, visibility }` (desktop only; `public` rejected in isolated Workspaces; memory is retained for promotion) and `POST /v1/agents/{id}/dynamic/decline` (sets declined, archives, memory scheduled for deletion; versions stay for audit). The label in the UI is `Usuń` but nothing is hard-deleted from audit. The same decision exists as a Chief proposal (`agent_promotion`, CHIEF014) and results in the same use case.

## 3. Scope (in)

- `AcceptDynamicDialog`, `DeclineDynamicDialog`.
- `useDynamicAgent(agentId)` mutations and cache updates.

## 4. Out of scope

- The list rendering of cards (OVE_AGUI004), Chief proposal inbox (CHIEF).

## 5. Detailed requirements

1. Accept dialog: title `Zachowaj {name} jako stałego Agenta`; text explains `Pamięć tego Agenta zostaje przy nim w tym Workspace.`; `RadioCardGroup` visibility with default PRYWATNY (least exposure, ADR 0028), PUBLICZNY disabled with the reason when the Workspace is isolated; confirm `Zachowaj`; the chosen visibility word is repeated in the confirm label (`Zachowaj jako PRYWATNEGO`).
2. Body `{ expectedVersion, visibility }`; no `workspaceId` field from the UI. Success: the Agent moves from the dynamic section to `STALI`, selection moves to it, toast `Agent zapisany jako stały`.
3. Decline dialog (`ui:ConfirmDialog`, destructive): `Usunąć {name}?` + `Pamięć tego Agenta zostanie usunięta. Historia konfiguracji zostaje w dzienniku audytu.`; confirm `Usuń`, cancel is the initial focus; success removes the card.
4. Errors: `agent.not_dynamic`, `agent.lifecycle_transition_invalid` (already decided elsewhere, e.g. in a Chief proposal: message `Ta propozycja została już rozstrzygnięta` and refetch), `agent.version_conflict`, `agent.scope_violation`, `perm.owner_required`.
5. Both actions are disabled while pending (busy) and idempotent on the engine; the UI does not retry automatically.
6. Telegram cannot decide a promotion; this UI has no `send to Telegram` path.
7. After accept/decline the Chief conversation card (CHIEF) is updated through the engine event, not through this feature.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:Dialog`, `ui:ConfirmDialog`, `ui:RadioCardGroup`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/agents/` (feature `agents`, route `/agents`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only allowed cross-feature use is the public export named in `needs` (for example `useLocalApproval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/AcceptDynamicDialog.tsx`, `components/DeclineDynamicDialog.tsx`, `state/use-dynamic-agent.ts`; registered in the dialogs slot of OVE_AGUI003.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Accept after the Agent was already accepted via a Chief proposal: refetch, info toast.
- Decline of an Agent with a running Run: the engine refuses or defers; the error is shown.
- Dialog closed with Esc: no request.

## 11. Acceptance criteria

- [ ] Given `Zachowaj jako stałego`, Then the dialog defaults to PRYWATNY.
- [ ] Given an isolated Workspace, Then PUBLICZNY is disabled with a visible reason.
- [ ] Given confirm, Then one POST with `{expectedVersion, visibility}` is sent.
- [ ] Given `Usuń`, Then a destructive confirm with initial focus on Cancel appears and the Agent disappears only after success.
- [ ] Given a lifecycle error, Then the list is refetched.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `AcceptDynamicDialog.test.tsx`, `DeclineDynamicDialog.test.tsx`, `use-dynamic-agent.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test agents`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_AGUI017.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_AGUI016), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: no preview of the dynamic Agent's configuration before accept in MVP; a read-only profile of a dynamic Agent is a P1 follow-up.
