---
id: OVE_APPRUI003
title: "Approvals route frame: list column, detail column and region slots"
area: APPRUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI002, OVE_BOARDUI003, OVE_DS044, OVE_SHELL012]
soft_depends_on: []
provides: ["lib:approvals-route"]
needs: ["ui:PageLayout", "ui:SidePanel", "lib:shell-page", "lib:feature-regions", "lib:use-approval-inbox"]
owns: ["apps/desktop/src/features/approvals/routes/ApprovalsRoute.tsx", "apps/desktop/src/features/approvals/regions/index.ts", "apps/desktop/src/features/approvals/routes/dialogs-context.ts"]
reads: []
design: design.png
design_source: "Zgody#appr/list + appr/detail (page frame) (crop 72,117,1368,783 CSS px)"
spec_refs: ["SPECIFICATION 11"]
adr_refs: [3]
---

# OVE_APPRUI003: Approvals route frame: list column, detail column and region slots

## 1. Summary

Builds the lazy `ApprovalsRoute` opened from the top-bar counter `3 czekają`: the 360px list column and the detail column with region slots and the dialogs context.

## 2. Context

Mock regions `appr/list` (72,117,360x783) and `appr/detail` (432,117,1008x783). The route is reached from the top-bar `ApprovalsButton` (SHELL) and from notification deep links (`/approvals?kind=&id=`). Unlike other views the page has no tab bar title row: the list column carries the title (`Zgody i Prośby`).

## 3. Scope (in)

- `ApprovalsRoute` composing `ShellPage` with `RegionSlot`s `list`, `detail`, `dialogs`, `live`.
- `ApprovalsProvider` and `useApprovalDialogs()` (`openDeny(id)`, `openPermanent(id)`, `openGrantPermanent(id)`, `openEscalationConfirm(id, option)`).
- `regions/index.ts` glob (`./*.region.tsx`, `../live/*.region.tsx`).

## 4. Out of scope

- Region content (OVE_APPRUI004..013).

## 5. Detailed requirements

1. Geometry: list 360 with padding 18, detail flexible `min-width: 0` with internal scroll (page never scrolls); below 1000 px the list becomes a top drawer and the detail the main area (selection opens it).
2. `ApprovalsProvider` exposes `{ inbox, selected, select }` and the dialogs context; it does not fetch detail (OVE_APPRUI005).
3. Deep link handling: `?kind=&id=` selects the item and moves focus to the detail heading once (announced).
4. A route-leave guard is NOT needed (no drafts survive navigation), except an open permanent-grant dialog which blocks navigation until cancelled.
5. Page title via `usePageTitle(t('approvals:title'))`; the rail item shows the pending count badge through the shell nav model (`aria-label` with the number in words).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:PageLayout`, `ui:SidePanel`, `ShellPage`; regions helper OVE_BOARDUI003.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `routes/ApprovalsRoute.tsx`, `routes/dialogs-context.ts`, `regions/index.ts`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Nothing selected and an empty inbox: detail shows the empty state (OVE_APPRUI013).
- Deep link to an item that is already resolved: it shows in resolved/detail as read-only.
- Deep link to an item of a Workspace the Owner cannot see: not found state.

## 11. Acceptance criteria

- [ ] Given the route, Then list and detail render with the mock geometry.
- [ ] Given `?kind=approval&id=...`, Then the item is selected and the heading focused.
- [ ] Given a new region file, Then it appears without editing this task's files.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `ApprovalsRoute.test.tsx` (layout, deep link), `dialogs-context.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Hotspot `regions/index.ts` is a glob and is never edited by other tasks.

## 14. Open questions and assumptions

- ASSUMPTION: rail item badge is rendered by SHELL from its own count; this feature only provides the route.
