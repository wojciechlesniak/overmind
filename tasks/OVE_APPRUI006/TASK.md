---
id: OVE_APPRUI006
title: "Detail shell region: kind label, Run link, heading, facts and result line"
area: APPRUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI001, OVE_APPRUI003, OVE_APPRUI005, OVE_DS032, OVE_DS040, OVE_DS051, OVE_DS058]
soft_depends_on: []
provides: ["lib:approval-detail-region"]
needs: ["ui:ApprovalDetail", "ui:KeyValueList", "ui:RunLink", "ui:OriginLine", "ui:EmptyState", "lib:use-approval-detail", "lib:approval-view-models", "lib:approvals-route"]
owns: ["apps/desktop/src/features/approvals/regions/detail.region.tsx", "apps/desktop/src/features/approvals/components/ApprovalDetailFrame.tsx", "apps/desktop/src/locales/en/approvals-detail.json", "apps/desktop/src/locales/pl/approvals-detail.json"]
reads: []
design: design.png
design_source: "Zgody#appr/detail-meta + appr/detail-heading + appr/detail-facts (crop 440,130,992,175 CSS px) (crop 440,130,992,175 CSS px)"
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3, 21]
---

# OVE_APPRUI006: Detail shell region: kind label, Run link, heading, facts and result line

## 1. Summary

The detail column frame: amber kind label with `DOMYŚLNA LISTA ZGÓD`, Run link (`Dostarczanie funkcji v7 · węzeł Developer`), Agent avatar and title, description, three fact tiles, and the slots for the preview and the decision panel; renders all five states.

## 2. Context

Mock regions `appr/detail-meta` (460,139,952x14), `appr/detail-heading` (Avatar 48 + title 24/700 + description with inline mono `origin`), `appr/detail-facts` (three KeyValue tiles Command / Changes / Evidence). Component: OVE_DS058 `ApprovalDetail` (shell with `preview` and `decision` props) and OVE_DS055 states. The previews (OVE_APPRUI007) and decision actions (OVE_APPRUI008..011) plug in through slots.

## 3. Scope (in)

- `detail.region.tsx` choosing the right composition for approval, access request or escalation.
- Slots `preview` and `decision` filled by other regions.
- The five states and the result line.

## 4. Out of scope

- Preview content, decision buttons.

## 5. Detailed requirements

1. `ApprovalDetail` props from `approvalToDetail`/`accessRequestToDetail`/`escalationToDetail`; `state` from `useApprovalDetail`.
2. The description sentence is composed from a template and engine facts (`{agent} chce wysłać {n} commity na {remote}, żeby ...`): the part after the comma is NOT free Agent text; any Agent-supplied reason appears only as a separate labelled fact `Powód (deklaracja Agenta)` in plain text.
3. `preview` renders `RegionSlot name='approval-preview'` keyed by kind/class; `decision` renders the decision slot for `pending`; for `submitting` the ui-kit disables actions; for `decided`/`decided-elsewhere`/`expired` the preview stays (audit) and the decision panel is replaced by the result line `Zezwolono na ten Run · 13:42 · z desktopu` / `Odmówiono · ...` / `Wygasła`; the actions are not in the DOM.
4. `shortHash` shown in the footer as `Skrót akcji: 3fa9c1d2` (mono, tooltip `Zgoda dotyczy dokładnie tej akcji`).
5. Run link: `ui:RunLink` to the Run view (`routeLinks.run`) and the Workflow name/version/node from the engine; Workspace name tag when the item belongs to a Workspace other than the current one.
6. Not found / error / loading states; empty selection state from OVE_APPRUI013.
7. Focus management: selecting an item moves focus to the heading (`tabindex=-1`), announcements are polite.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:ApprovalDetail`, `ui:KeyValueList`, `ui:RunLink`, `ui:OriginLine`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/detail.region.tsx`, `components/ApprovalDetailFrame.tsx`.

## 9. Security and safety

This view is the Owner's security gate (ADR 0003, ADR 0021). Rules enforced here and tested in OVE_APPRUI015: (1) an Approval decided here is bound to its `actionHash` and permits exactly ONE execution of exactly the displayed action (`scope: once`); the decision body has no scope field; (2) the UI never broadens an approval: a permanent effect (lifting an Approval requirement, a permanent directory grant, adding a host to the network allow-list) is a SEPARATE explicit action with its own confirmation and a Local Approval (`useLocalApproval`, bound to the exact arguments, single use, desktop only); no button combines `once` and `permanent`, and no default selects permanent; (3) Telegram can only approve for the current Run; this view therefore labels decisions that came from Telegram and never offers to upgrade them; (4) every text from an Agent (justification, commit subjects, message bodies, paths typed by the Agent) is untrusted and rendered only as plain text, labelled as the Agent's claim, never as HTML or a link made from it; (5) the displayed summary and preview are produced by the engine from structured data, so the UI shows `summary` and structured fields, not text that the Agent supplied; (6) fail closed: if the detail cannot be loaded or has expired, no decision control is rendered. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Agent name with HTML: plain text.
- Very long host or path: wraps (`overflow-wrap: anywhere`).
- Detail refetch changes `status` while the user reads: state updates and controls disappear (never stay enabled).

## 11. Acceptance criteria

- [ ] Given the git push fixture, Then meta, heading and facts match `design.png` within tolerance.
- [ ] Given a decided item, Then the preview remains and no action buttons are in the DOM.
- [ ] Given an expired item, Then the word `Wygasła` and no actions.
- [ ] Given a failed load, Then no decision controls are rendered.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `ApprovalDetailFrame.test.tsx` (five states, result line, no controls when not pending). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: the Workflow name/version/node line is available from the Run summary.
