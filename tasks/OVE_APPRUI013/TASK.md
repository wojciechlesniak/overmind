---
id: OVE_APPRUI013
title: "Approvals states and live updates: empty inbox, offline, pause note, announcements"
area: APPRUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI002, OVE_APPRUI003, OVE_APPRUI004, OVE_APPRUI005, OVE_DS032, OVE_DS040, OVE_DS109]
soft_depends_on: []
provides: ["lib:approvals-states-live"]
needs: ["ui:EmptyState", "ui:ErrorState", "ui:LiveRegion", "ui:CalloutAmber", "lib:use-approval-inbox", "lib:approvals-route"]
owns: ["apps/desktop/src/features/approvals/live/approvals-live.region.tsx", "apps/desktop/src/features/approvals/components/ApprovalStates.tsx", "apps/desktop/src/locales/en/approvals-states.json", "apps/desktop/src/locales/pl/approvals-states.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [15, 5]
---

# OVE_APPRUI013: Approvals states and live updates: empty inbox, offline, pause note, announcements

## 1. Summary

Cross-cutting states: empty inbox (`Agent czeka, reszta pracuje dalej.` has an empty-state sibling), nothing selected, engine offline, Global Pause banner, and polite announcements of new and resolved items.

## 2. Context

The mock shows the subtitle but not an empty inbox, offline or pause state. PERM029: during Global Pause requests are recorded without sound and marked paused; the desktop Owner can still decide; execution resumes after unpause. Notification sound is NOTIF's, not this view's.

## 3. Scope (in)

- `ApprovalStates` components and `approvals-live.region.tsx`.

## 4. Out of scope

- Sounds and system notifications (NOTIF).

## 5. Detailed requirements

1. Empty inbox: `Nic nie czeka na Twoją decyzję.` with the line `Gdy Agent będzie potrzebował zgody, pojawi się tutaj i w liczniku u góry.`
2. No selection but items exist: `Wybierz pozycję z listy.`
3. Offline: banner `Brak połączenia z silnikiem. Decyzje są wyłączone.`; decision controls are not rendered (fail closed), the list shows stale data with the word `nieaktualne`.
4. Global Pause: amber `CalloutAmber` `Pauza: zgody zapisujesz teraz, ale Agenci ruszą dopiero po wznowieniu` and `wstrzymane` on affected rows.
5. Announcements (`aria-live=polite`, one per 2 s, bursts summarised `+N nowych`): `Nowa zgoda: git push, Developer`, `Nowa prośba o dostęp`, `Nowa eskalacja`, `Zgoda rozstrzygnięta w Telegramie` (own decisions are not re-announced).
6. Texts inside announcements are engine-built (kind + agent name) and plain; names truncated to 60 chars.
7. Focus is never moved by incoming items.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:EmptyState`, `ui:ErrorState`, `ui:CalloutAmber`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `live/approvals-live.region.tsx`, `components/ApprovalStates.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Burst of 20 requests: one summary announcement.
- Pause state unreadable: treated as paused (fail closed, PERM029 8) with the banner.
- Locale change re-renders announcements.

## 11. Acceptance criteria

- [ ] Given an empty inbox, Then the empty state shows and the subtitle remains.
- [ ] Given the engine offline, Then no decision control is in the DOM.
- [ ] Given Global Pause, Then the banner is shown and decisions remain possible.
- [ ] Given 20 events in a second, Then one summary announcement is made.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `ApprovalStates.test.tsx`, `approvals-live.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- Duplicated batching with BOARDUI013/DECUI013/AGUI015/SKUI014 (reported: candidate for one shared helper).
