---
id: OVE_NOTIF001
title: "Define the Notification entity, kind catalogue, events and NotificationRepository port"
area: NOTIF
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: ["OVE_ARCH003", "OVE_ARCH007", "OVE_ARCH010", "OVE_ARCH011"]
soft_depends_on: ["OVE_ARCH008"]
provides: ["contract:Notification", "contract:NotificationKind", "contract:NotificationView", "contract:NotificationDelivery", "event:notification.created", "event:notification.changed", "port:NotificationRepository", "lib:notif-errors"]
needs: ["contract:EntityId", "contract:MessageRef"]
owns: ["packages/contracts/src/notification/**", "packages/contracts/src/errors/notif.errors.ts", "packages/contracts/src/events/notification.created.event.ts", "packages/contracts/src/events/notification.changed.event.ts", "packages/application/src/ports/NotificationRepository.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 5"]
adr_refs: [6, 17]
---

# OVE_NOTIF001: Define the Notification entity, kind catalogue, events and NotificationRepository port

## 1. Summary

Defines the `Notification` entity, the closed catalogue of notification kinds (icon, tone, severity, routing metadata), the read model `NotificationView` shown in the Pulpit notification center, the `notification.*` events and the `NotificationRepository` port.

## 2. Context

SPEC 12 lists what notifies the Owner: completion, error, Access Request, Approval, Escalation, Discussion started by Chief. The Pulpit mock shows five in the right panel (amber shield 'Zgoda: git push', magenta folder-plus 'Prośba o dostęp: ~/Projects/shared-ui', lavender chat 'Chief zaczął Dyskusję o płatnościach', mint check 'Run #13 ukończony', red pulse 'Eskalacja: limit pętli', each with a source line and an age). The system must also tell the Owner about backup failures, a lost channel and a model fallback (SPEC 9, criteria 12 and 15). All of NOTIF builds on these contracts.

## 3. Scope (in)

- `Notification`, `NotificationKind`, `NotificationSeverity`, `NotificationSubject`, `DeliveryRecord`, `NotificationView` zod schemas.
- The kind catalogue as data (`NOTIFICATION_KINDS`).
- Events `notification.created` and `notification.changed`.
- Error codes `notif.*` and the `NotificationRepository` port.

## 4. Out of scope

- Persistence: OVE_NOTIF003. Rules and dedupe: OVE_NOTIF002. Use cases and read model assembly: OVE_NOTIF004. Preferences: OVE_NOTIF006. Strings: OVE_NOTIF013.

## 5. Detailed requirements

1. **Entity** (zod strict):
   ```ts
   Notification = {
     id: EntityId<'ntf'>, kind: NotificationKind, severity: 'info'|'attention'|'critical',
     titleRef: MessageRef, bodyRef?: MessageRef,        // key + params; params are primitives, strings capped at 200 chars
     source: { workspaceId?: EntityId<'ws'>, agentId?: EntityId<'agent'>, runId?: EntityId<'run'> },
     subject: { type: 'approval_request'|'access_request'|'discussion'|'run'|'escalation'|'backup'|'channel'|'provider'|'system', id?: string },
     dedupeKey: string,                                   // <= 120 chars
     requiresAction: boolean, count: int >= 1,
     createdAt, updatedAt: IsoDateTime, readAt: IsoDateTime|null, resolvedAt: IsoDateTime|null,
     resolution: 'approved'|'denied'|'expired'|'decided_elsewhere'|'closed'|null,
     deliveries: DeliveryRecord[]
   }
   DeliveryRecord = { channel: 'in_app'|'macos'|'telegram', status: 'sent'|'skipped'|'failed', reason?: 'preference'|'dnd'|'unpaired'|'unavailable'|'error', at: IsoDateTime }
   ```
2. **Kind catalogue** (`NOTIFICATION_KINDS`; columns: iconKey, tone, severity, requiresAction, prefGroup, telegram mode, coalesce):
   | kind | icon | tone | severity | action | prefGroup | telegram | coalesce |
   |---|---|---|---|---|---|---|---|
   | approval_requested | shield-check | amber | critical | yes | approval | bubble | never |
   | access_requested | folder-plus | magenta | critical | yes | access_request | bubble | never |
   | escalation_raised | pulse | red | critical | yes | escalation_and_error | text | never |
   | discussion_started | message-square | lavender | attention | yes | discussion_started | text | never |
   | run_completed | check-circle | mint | info | no | run_completed | text | by_key |
   | run_failed | alert-octagon | red | attention | no | escalation_and_error | text | by_key |
   | provider_fallback | switch | amber | attention | no | escalation_and_error | text | by_key |
   | channel_attention | plug-zap | amber | attention | no | escalation_and_error | none | by_key |
   | backup_failed | database-alert | amber | attention | no | escalation_and_error | text | by_key |
   | system_attention | alert-triangle | amber | attention | no | escalation_and_error | text | by_key |
   Adding a kind is one row plus strings (OCP). A registry test asserts EN and PL strings exist (OVE_NOTIF013).
3. **Read model** `NotificationView` (rendered in the Owner's locale by the engine Translator at read time; never stored rendered):
   ```ts
   NotificationView = { id, kind, iconKey, tone, severity, requiresAction, unread: boolean, count,
     title: string, body?: string, source: { label: string },   // 'Developer · Aplikacja rezerwacji'
     createdAt: IsoDateTime,                                      // UI formats relative time ('3 min', 'wczoraj')
     resolution, target: { route: string; params: Record<string,string> } | null }
   ```
4. **Events:** `notification.created` (not persisted, scope global, `visibleTo: ['owner']`, payload `{ view }`) and `notification.changed` (payload `{ ids, unread, resolution }`). They are not audit events; the decisions behind them are audited by their owners.
5. **Errors:** `notif.not_found` (404), `notif.invalid_preference` (400), `notif.delivery_failed` (502, retryable, internal), `notif.kind_unknown` (500).
6. **Port** `NotificationRepository`: `insert`, `findByDedupeKey(key, sinceIso)`, `update(id, patch, expectedUpdatedAt)`, `list({ limit, before?, unreadOnly?, requiresActionOnly? })`, `unreadCount()`, `markRead(ids, at)`, `markAllRead(at)`, `resolveBySubject(subject, resolution, at)`, `deleteByWorkspace(workspaceId)`, `prune(policy)`; all return `Result`.
7. **Param safety:** a zod refinement on notification `MessageRef.params` rejects non-primitives and strips control and bidi characters; names from agents or repositories are capped at 80 chars at this boundary.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `EntityId`, `Result`, `AppError`, `defineErrors` (ARCH003/007), `defineEvent` (ARCH010), `MessageRef` (ARCH011). Catalogue consumed by NOTIF002, 004, 007, 013 and DS060 (`iconKey`/`tone`).

## 8. Architecture and code placement

`packages/contracts/src/notification/{notification.ts,kinds.ts,view.ts,index.ts}`; events and errors in their own files; port in `packages/application/src/ports/`. Depends on the foundation only.

## 9. Security and safety

- Notifications are an exfiltration channel (lock screen, Telegram): only whitelisted primitive params, capped strings, no secrets, command lines, diffs or absolute paths beyond the `~`-shortened display form supplied by the producer.
- `titleRef`/`bodyRef` keys are validated against the catalogue so untrusted text can never pick a template.
- No free-text title field: injected agent text appears only as a capped parameter.

## 10. Errors and edge cases

- Unknown kind in an old database: view renders with `bell` and a generic title.
- `dedupeKey` over 120 chars: readable prefix plus 16 hex of SHA-256.
- `resolution` set while `requiresAction` is false: rejected.
- Source ids of a deleted Workspace: label falls back to the stored param.

## 11. Acceptance criteria

- [ ] Every kind in the table exists with the listed metadata (table test).
- [ ] `NotificationView` validates the five mock items (fixtures).
- [ ] Objects, arrays and control characters in params are rejected or stripped.
- [ ] Both events pass the event registry test.
- [ ] A stub and an in-memory fake of the port exist (fake delivered in OVE_NOTIF003).
- [ ] Additive-only contract check passes.

## 12. Test plan

Unit: `kinds.test.ts`, `notification-schema.test.ts`, `view-fixtures.test.ts`, `params-sanitiser.test.ts`. Command: `pnpm vitest run packages/contracts/src/notification`.

## 13. Parallelization notes

First task of the area; NOTIF002 and 003 start in parallel after it merges. New files only.

## 14. Open questions and assumptions

- ASSUMPTION: Approval and Access Request are `critical`; Discussion started is `attention` but `requiresAction`.
- OPEN: separate preference rows for `provider_fallback` and `channel_attention`? DEFAULT: they use the 'Eskalacja i błąd Runu' group (the mock has five selects).
- Icon keys are proposals; the DS maps unknown keys to a bell.
