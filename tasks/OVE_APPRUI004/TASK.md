---
id: OVE_APPRUI004
title: "List region: title, OCZEKUJĄ rows, escalations and ROZSTRZYGNIĘTE DZIŚ"
area: APPRUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI001, OVE_APPRUI002, OVE_APPRUI003, OVE_DS032, OVE_DS056]
soft_depends_on: []
provides: ["lib:approval-list-region"]
needs: ["ui:ApprovalList", "ui:ApprovalListItem", "ui:EmptyState", "lib:use-approval-inbox", "lib:approval-view-models", "lib:approvals-route"]
owns: ["apps/desktop/src/features/approvals/regions/list.region.tsx", "apps/desktop/src/features/approvals/components/ApprovalListPanel.tsx", "apps/desktop/src/locales/en/approvals-list.json", "apps/desktop/src/locales/pl/approvals-list.json"]
reads: []
design: design.png
design_source: "Zgody#appr/list (crop 72,117,360,783 CSS px) (crop 72,117,360,783 CSS px)"
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3]
---

# OVE_APPRUI004: List region: title, OCZEKUJĄ rows, escalations and ROZSTRZYGNIĘTE DZIŚ

## 1. Summary

Renders the left column with `ui:ApprovalList`: title `Zgody i Prośby`, `Agent czeka, reszta pracuje dalej.`, `OCZEKUJĄ · 3` rows (Approval, Approval, Access Request), `ESKALACJE` and `ROZSTRZYGNIĘTE DZIŚ`.

## 2. Context

Mock regions `appr/list-title`, `appr/list-label-pending`, `appr/list-item-approval-selected` (amber square), `appr/list-item-access-request` (magenta square), `appr/list-item-escalation` (red square, 113 px) and `appr/list-resolved`. Component: OVE_DS056; this task only maps and wires.

## 3. Scope (in)

- Region rendering `ApprovalList` from the inbox hook and mappers.
- Loading, empty and error states.

## 4. Out of scope

- Detail panes.

## 5. Detailed requirements

1. Props only from mappers (OVE_APPRUI001); no copy or styling here; labels via `useT('approvals-list')`.
2. `onSelect(id)` selects through the provider; keyboard roving focus is provided by the ui-kit list (Up/Down, Enter); selection is reflected in the URL.
3. Section labels `OCZEKUJĄ · {n}`, `ESKALACJE`, `ROZSTRZYGNIĘTE DZIŚ`; the escalations section is hidden when empty; resolved rows are informational and not focusable unless selecting history is enabled (P1).
4. Items marked `paused` carry the word `wstrzymane` in their age line.
5. Loading skeleton; empty inbox shows the subtitle and the empty text from OVE_APPRUI013; error shows `Nie udało się wczytać zgód` with retry (no stale decision controls remain, the detail goes to its own error).
6. Titles, agent names and paths are untrusted text rendered by ui-kit as text nodes.
7. `aria-live=polite` announces `Nowa zgoda: {kind}` through the live region (OVE_APPRUI013), not from this component.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:ApprovalList` (OVE_DS056).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/list.region.tsx`, `components/ApprovalListPanel.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- 30 pending items: scroll inside the list.
- Very long title: two-line clamp with title attribute.
- Item disappears while focused: focus moves to the next row.

## 11. Acceptance criteria

- [ ] Given the mock fixture, Then the list matches `design.png` within tolerance.
- [ ] Given a click on the access request row, Then the URL holds `kind=access&id=...` and the detail loads.
- [ ] Given an escalation, Then the red-square row and the word `ESKALACJA` are present.
- [ ] Given an empty escalations list, Then the section label is absent.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `ApprovalListPanel.test.tsx` (sections, selection, keyboard, states). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: resolved rows are not selectable in MVP (the mock shows them as plain lines).
