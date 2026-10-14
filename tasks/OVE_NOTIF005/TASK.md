---
id: OVE_NOTIF005
title: "Map engine events to notifications with an extensible rule registry"
area: NOTIF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH010, OVE_BACKUP001, OVE_CHIEF015, OVE_CHIEF018, OVE_DISC001, OVE_NOTIF004, OVE_PERM013, OVE_PERM014, OVE_PERM015, OVE_TG005, OVE_WFRT007]
soft_depends_on: []
provides: ["lib:notification-rules-registry", "port:NotificationRule"]
needs: ["event:approval.requested", "event:approval.resolved", "event:access_request.created", "event:access_request.resolved", "event:discussion.started", "event:run.completed", "event:run.failed", "event:escalation.raised", "event:escalation.resolved", "event:provider.fallback_activated", "event:telegram.channel.status.changed", "event:backup.failed", "port:EventBus", "port:ApprovalRequestReader"]
owns: ["packages/application/src/notification-rules/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 9"]
adr_refs: [6, 15]
---

# OVE_NOTIF005: Map engine events to notifications with an extensible rule registry

## 1. Summary

Turns domain events into notifications. One small rule file per source event is registered through a multi-token, so a new notifying event never edits a shared switch. Also resolves notifications when their subject is decided and reconciles stale actionable notifications at boot.

## 2. Context

SPEC 12 names the notifying events; SPEC 9 and criterion 12 add the model fallback; criterion 15 and BACKUP add backup failures; TG adds channel problems. The producing areas (PERM, DISC, WFRT, PROV, BACKUP, TG) publish events and know nothing about notifications (dependency inversion).

## 3. Scope (in)

- `NotificationRule` port and `NotificationRulesToken` (multi-token).
- One rule per event (table below).
- Resolution rules for approval, access request and escalation events.
- Boot reconcile job.

## 4. Out of scope

- Creating and rendering: OVE_NOTIF004. Delivery: OVE_NOTIF007. Event definitions: their owning areas.

## 5. Detailed requirements

1. **Port:** `interface NotificationRule { id: string; on: EventType; toDraft(event: EventEnvelope, ctx): Result<NotificationDraft | null> }`; `null` means 'no notification'. `NotificationRulesToken = multiToken<NotificationRule>('port:NotificationRule')`. A runner subscribes once per distinct `on` type (subscriber name `notification-rules`), calls the rule, then `CreateNotification`. Rule errors are logged and never propagate to the bus.
2. **Rules** (title/body keys in the `notifications` namespace, OVE_NOTIF013):
   | event | kind | subject | notes |
   |---|---|---|---|
   | approval.requested | approval_requested | approval_request:<id> | title param `action` (catalogue label such as 'git push'); source agent and Workspace |
   | access_request.created | access_requested | access_request:<id> | param `path` is the `~`-shortened display path, at most 3 segments, else `…/last-two` |
   | discussion.started with `startedBy: chief` | discussion_started | discussion:<id> | body 'Czeka na Twój głos'; discussions started by a workflow node are NOT notified |
   | run.completed | run_completed | run:<id> | body from the event summary (counts only, for example '4 nowe Zadania') |
   | run.failed | run_failed | run:<id> | param `reasonKey` (an error code), never raw text |
   | escalation.raised | escalation_raised | escalation:<id> | title 'Eskalacja: <reason key>' |
   | provider.fallback_activated | provider_fallback | provider:<id> | param `from`, `to` model labels |
   | telegram.channel.status.changed to `error`, `disconnected` for more than 10 min, or `degraded` | channel_attention | channel:<status> | not sent to Telegram itself |
   | backup.failed | backup_failed | backup | param `reasonKey` only |
3. **Resolution:** `approval.resolved`, `access_request.resolved` and `escalation.resolved` call `ResolveNotificationsBySubject` with `approved|denied|expired|decided_elsewhere` (events carry the deciding channel; a decision from a channel other than the first viewer is `decided_elsewhere` only for the other channel's rows).
4. **Boot reconcile:** at start, for every unresolved actionable notification, ask `ApprovalRequestReader.status(subject)`; if no longer pending, resolve it (`expired` or `decided_elsewhere`). Missing reader or errors are logged and skipped.
5. **Privacy rule:** rules take only whitelisted fields from events; free text of events (agent messages, commit messages, command lines, diffs) is never copied into params.
6. Rules are pure functions of the event and a small context (clock, display-path formatter) and are unit tested one by one.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `multiToken`, `EventBus` (ARCH006/010), `CreateNotification`, `ResolveNotificationsBySubject` (OVE_NOTIF004), display-path helper from `lib:path-guard` (SEC002).

## 8. Architecture and code placement

`packages/application/src/notification-rules/{runner.ts,rules/<event>.rule.ts,reconcile.ts}`; registration in the notification module (OVE_NOTIF007 wires). A new event gets a new file, nothing else.

## 9. Security and safety

- Events are internal but their payloads can contain untrusted text: only whitelisted fields are mapped.
- Paths shortened with `~` and limited to 3 segments; no absolute paths.
- A rule can never approve or resolve a subject it does not report; only the matching `*.resolved` events resolve.

## 10. Errors and edge cases

- Event arrives twice: dedupe `ignore`.
- `access_request.resolved` before `created` (reordered): the resolve finds nothing; the late `created` is then checked against the reader and created already resolved.
- Discussion started by a node, not by Chief: no notification.
- Telegram flaps: coalesced by `channel_attention` windows.

## 11. Acceptance criteria

- [ ] Each row of the table has a unit test from event to draft.
- [ ] An approval resolved on Telegram resolves its notification with `decided_elsewhere` for the desktop row.
- [ ] Free text in an event never appears in params (test with a hostile payload).
- [ ] Boot reconcile resolves a notification whose approval expired while the engine was down.
- [ ] A new rule file is picked up without editing the runner.

## 12. Test plan

Unit: one test file per rule, `runner.test.ts`, `reconcile.test.ts`, `hostile-payload.test.ts`. Command: `pnpm vitest run packages/application/src/notification-rules`.

## 13. Parallelization notes

Parallel with NOTIF006 and NOTIF007. Each producing area may add its own rule file later through the multi-token.

## 14. Open questions and assumptions

- `telegram.channel.status.changed` is defined by OVE_TG005; `backup.failed` by OVE_BACKUP001; others by PERM, DISC, WFRT, PROV (names are capability proposals).
