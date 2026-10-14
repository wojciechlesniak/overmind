---
id: OVE_DECUI012
title: "Review date: needs-review indicator and setting a review date"
area: DECUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DEC011, OVE_DECUI007, OVE_DS026, OVE_DS028, OVE_DS040]
soft_depends_on: []
provides: ["lib:decision-review-date"]
needs: ["api:decision.review_date", "ui:Popover", "ui:TextField", "ui:CalloutAmber", "lib:api-client-decision", "lib:use-gateway-mutation"]
owns: ["apps/desktop/src/features/decisions/regions/review-date.region.tsx", "apps/desktop/src/features/decisions/state/use-review-date.ts", "apps/desktop/src/locales/en/decisions-review.json", "apps/desktop/src/locales/pl/decisions-review.json"]
reads: []
design: design.png
design_source: "Decyzje#decis/outcome-card (review date part) (crop 492,597,928,70 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI012: Review date: needs-review indicator and setting a review date

## 1. Summary

Shows the review date next to Chief's outcome proposal and lets the Owner set or move it; when the date passes the Decision becomes `do przeglądu` and the detail explains it.

## 2. Context

The outcome card shows `· przegląd 2026-11-10`. The engine marks Decisions `needs_review` when the date arrives (DEC010, event `decision.review_due`) and the Owner can set a review date (`POST /decisions/:id/review-date { reviewDate, reason }`, owner). The route name `api:decision.review_date` is not listed in DEC011's capability list (it lists status, verdict, supersede); reported as a naming gap.

## 3. Scope (in)

- Review-date chip with edit popover (date input + optional reason).
- Amber note for `needs_review`: `Termin przeglądu minął. Sprawdź, czy Decyzja nadal obowiązuje.` with the actions of OVE_DECUI008.

## 4. Out of scope

- Scheduling reminders (engine/NOTIF).

## 5. Detailed requirements

1. Show the date from `view.reviewDate` formatted with `formatDate` (OS time zone, `pl-PL`); no date -> `Dodaj datę przeglądu` link.
2. Popover with a native date input (min = today, max = +5 years), reason textarea (<= 300), buttons `Zapisz`/`Anuluj`; request `{ reviewDate: 'YYYY-MM-DD', reason? }` with idempotency key; success refetch + toast.
3. Past dates are rejected client-side (`decisions-review:errors.past`) and by the server.
4. `needs_review` note rendered with `CalloutAmber` in `bannerSlot` order after the superseded banner (mutually exclusive).
5. Not available for superseded Decisions.
6. The chip text contains the date as words: `przegląd 10 listopada 2026` with the ISO date in `title`.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:Popover`, `ui:TextField`, `ui:CalloutAmber`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-review-date.ts`, `regions/review-date.region.tsx`.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Server rejects the date (before today): field error.
- Timezone: date-only string, no time conversion.
- Two windows: last write wins, history shows both.

## 11. Acceptance criteria

- [ ] Given a date set, Then the chip shows it and the request body is date-only.
- [ ] Given a past date, Then submit is blocked.
- [ ] Given `needs_review`, Then the amber note shows.
- [ ] Given a superseded Decision, Then the control is absent.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-review-date.test.tsx`, `review-date.region.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported): capability name for the review-date route is missing in OVE_DEC011; assumed `api:decision.review_date`.
