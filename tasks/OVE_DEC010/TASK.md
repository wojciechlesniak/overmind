---
id: OVE_DEC010
title: "Schedule Decision review-date reminders and mark Decisions needs_review"
area: DEC
kind: feature
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DEC005, OVE_ENGINE029, OVE_NOTIF004, OVE_PAUSE005, OVE_PERM008, OVE_PERM020]
soft_depends_on: ["OVE_DEC006"]
provides: ["usecase:decision.review-scan", "event:decision.review_due"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "port:JobScheduler", "port:NotificationPublisher", "port:PauseGate"]
owns: ["packages/application/src/decision/review/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 12]
---

# OVE_DEC010: Schedule Decision review-date reminders and mark Decisions needs_review

## 1. Summary

Run a daily job (and a catch-up at startup and after wake) that finds accepted Decisions whose review date has arrived, marks them `needs_review` through an append-only event, notifies the Owner and signals Chief to gather evidence, exactly once per review date.

## 2. Context

SPEC 10: Chief continuously collects evidence and proposes the Outcome; the Decision has a `reviewDate` and the status `needs_review`. SPEC 12: the engine runs in the background independent of the window; the computer may sleep, so scheduled work must catch up. Mock: `przegląd 2026-11-10`; status `do przeglądu` (D-07).

## 3. Scope (in)

- Scan job, idempotent marking, notifications, Chief signal event, catch-up logic, review date postponement helper.

## 4. Out of scope

- Chief's evidence work after the signal: CHIEF (consumes `event:decision.review_due`). UI: DECUI.

## 5. Detailed requirements

1. **Job** `decision-review-scan` on `JobScheduler`: daily at 09:00 local time (ASSUMPTION), at engine startup, and on system wake; it is safe to run any number of times.
2. **Selection:** Decisions whose current status is `accepted` and `effectiveReviewDate <= today` (SQL view `decision_current` + latest `review_date_set`), limited to 200 per run; processed per Workspace so one failure does not block others.
3. **Marking:** per Decision, one transaction: append `status_changed accepted -> needs_review` (actor `system`, reason `review_date_reached`) with `dedupeKey = reviewDate` and `review_due` event with the same dedupe key; the unique `(decision_id, kind, dedupe_key)` index makes a repeated scan a no-op.
4. **Notification:** `NotificationPublisher.publish({ kind: 'decision_review_due', decisionId, title (truncated 120), workspaceId })`, once per dedupe key; a daily digest instead of one notification per Decision when more than 3 are due (`n Decisions need review`).
5. **Chief signal:** the `decision.review_due` event (persisted) is the trigger for Chief's evidence collection (CHIEF consumer); while Global Pause is active the marking still happens (data only) but no Chief work starts (CHIEF respects Pause).
6. **Postponement:** `postponeReview(decisionId, newDate, reason, actor)` owner or chief: appends `review_date_set`; if the Decision is `needs_review` and the new date is in the future the status returns to `accepted` through `status_changed` (reason `review_postponed`) so reminders resume at the new date.
7. **Isolated Workspaces:** scanned like others (their own Owner-facing notifications); signal events are Workspace-scoped.
8. **No time travel:** `today` is computed from `Clock` in the Owner's configured time zone (ARCH005 config); a clock moving backwards never un-marks a Decision.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DEC005 `changeStatus` internals (shared helper `appendStatusChange`), `JobScheduler`, NOTIF, DEC007 current view query.

## 8. Architecture and code placement

`packages/application/src/decision/review/{review-scan.ts,postpone-review.ts,job.ts}`; job registered via the composition extension point.

## 9. Security and safety

The job is system-only (no route triggers it with parameters); it can only append the defined events; dedupe keys prevent notification spam and loops; marking `needs_review` does not alter the Outcome or the content (ADR 0008). A manipulated clock could mass-mark Decisions: bounded per run and reversible only by Owner/Chief postponement; all marks are audited via the event log.

## 10. Errors and edge cases

- Computer asleep for 3 days: next wake marks everything due once.
- Review date in the past at acceptance: DEC005 rejects creation with a past date; the scan would mark immediately otherwise.
- Many Workspaces: per-Workspace transactions.
- Decision superseded between selection and marking: transaction re-checks status.

## 11. Acceptance criteria

- [ ] A Decision due today becomes `needs_review` once, even if the scan runs five times.
- [ ] Owner notified once per Decision (digest above 3).
- [ ] Catch-up after sleep marks overdue Decisions.
- [ ] Postponing returns the Decision to `accepted` and re-arms the reminder.
- [ ] Superseded or rejected Decisions are never marked.
- [ ] Pause does not prevent marking but the Chief signal respects Pause (event still stored).

## 12. Test plan

- `review-scan.test.ts` with `FakeClock`, repeated runs, time zones; `postpone-review.test.ts`; `job.test.ts`. Commands: `pnpm vitest run packages/application/src/decision/review`.

## 13. Parallelization notes

Independent of DEC008/009/011.

## 14. Open questions and assumptions

- ASSUMPTION: scan at 09:00 local; digest above 3.
