---
id: OVE_BOARDUI010
title: "Task detail actions: chat with the assignee, defer with reason, unblock"
area: BOARDUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD013, OVE_BOARDUI001, OVE_BOARDUI009, OVE_DS013, OVE_DS026, OVE_DS036, OVE_DS037, OVE_DS063, OVE_SHELL027]
soft_depends_on: []
provides: ["lib:board-task-actions"]
needs: ["ui:TaskDetail", "ui:Button", "ui:Dialog", "ui:ConfirmDialog", "ui:Textarea", "ui:Toast", "api:board.task.defer", "api:board.task.unblock", "lib:api-client-board", "lib:use-gateway-mutation", "lib:route-links"]
owns: ["apps/desktop/src/features/board/state/use-task-actions.tsx", "apps/desktop/src/features/board/dialogs/DeferTaskDialog.tsx", "apps/desktop/src/features/board/regions/task-actions.region.tsx", "apps/desktop/src/locales/en/board-actions.json", "apps/desktop/src/locales/pl/board-actions.json"]
reads: []
design: design.png
design_source: "Tablica#board/task-inspector-actions (crop 1130,826,300,62 CSS px)"
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 5"]
adr_refs: [23, 11]
---

# OVE_BOARDUI010: Task detail actions: chat with the assignee, defer with reason, unblock

## 1. Summary

Wires the two buttons at the bottom of the Task panel: `Czat z <Agent>` (opens the direct chat with the assignee) and `Odłóż` (parks the Task with an optional reason), plus `Przywróć` for deferred or blocked Tasks. Provides the `useTaskActions` context the detail panel reads.

## 2. Context

In the mock the panel bottom holds `Czat z QA` (outlined violet) and `Odłóż` (secondary). Direct chats with every Agent are a core feature (ADR 0023); the chat target comes from `TaskDetail.chatTarget`. Deferring (`POST /tasks/:id/defer`) postpones a Task: it moves into the `Odłożone` counter and out of the lanes; `unblock` returns a blocked/deferred Task to the queue (BOARD009). `canDefer` is computed by the domain (state machine), so the UI never guesses.

## 3. Scope (in)

- `useTaskActions(task)` hook returning `actions` for ui:TaskDetail: `chat`, `park`, `restore`.
- `DeferTaskDialog` (reason textarea, <= 300 chars, optional `until` date picker is NOT included).
- Success/error toasts, event-driven refresh.
- Region `task-actions.region.tsx` registering the context provider around the detail region (slot `overlay`).

## 4. Out of scope

- Owner-initiated move between Lanes (not planned), assigning an Agent from the Owner side (post-MVP; `api:board.task.assign` exists but the mock has no control), editing Task text (Tasks are not edited by the Owner here; corrections go through Chief or Documentation).

## 5. Detailed requirements

1. Chat action: shown when `detail.chatTarget` is set; label `board:actions.chat` with the Agent's name (`Czat z QA`); click navigates to `routes.agentChat(agentId)` (SHELL). For a private Agent that is not visible in the active Workspace the engine returns no `chatTarget`, so the button is omitted.
2. Defer action: shown when `detail.canDefer`; label `Odłóż`; click opens `DeferTaskDialog` (`ui:Dialog` form variant): title `board:actions.deferTitle` (`Odłożyć Zadanie T-31?`), body explains `Zadanie zniknie z Torów i trafi do Odłożonych. Możesz je przywrócić.`, optional reason textarea (label `Powód`, max 300, counter in the last 50), buttons `Odłóż` (secondary) and `Anuluj`. Submit calls `POST /tasks/:id/defer { reason?, expectedVersion }` with `Idempotency-Key`.
3. Restore action: for status `deferred` or `blocked` the secondary button is `Przywróć` (`POST /tasks/:id/unblock { expectedVersion }`) and `Odłóż` is hidden; blocked Tasks also show the stored `statusReason` as read-only text above the actions (plain text).
4. Both mutations use `useGatewayMutation`; while pending the buttons are disabled and `aria-busy`; no optimistic move: the card leaves the lane only after the push event or refetch.
5. `expectedVersion` is `detail.card.version`; on `board.version_conflict` the dialog closes, the detail refetches and a toast `board:errors.version_conflict` (`Zadanie zmieniło się. Sprawdź i spróbuj ponownie.`) appears; the Owner's reason text is kept in the dialog state if reopened within the same session.
6. `board.invalid_transition` (for example Task finished meanwhile): toast with `board:errors.invalid_transition`, refetch.
7. When Global Pause is active actions stay enabled (they start no work); `useGlobalPause` is not consumed (ASSUMPTION).
8. Focus management: opening the dialog moves focus into the textarea; closing returns focus to the `Odłóż` button; after a successful defer the selection is cleared and focus moves to the lanes region heading.
9. Success toast `Odłożono T-31` with an `Cofnij` action that calls `unblock` once (undo window 8 s, uses a fresh idempotency key).
10. All strings in namespace `board-actions` (EN + PL).

## 6. Design notes

`design.png` shows the two actions pinned at the bottom of the inspector: `Czat z QA` (secondary with violet outline, `chat` icon) and `Odłóż` (secondary). They are rendered by `ui:TaskDetail` from the `actions` prop (OVE_DS063). This task provides handlers, labels and the dialog. Dialog, toast and disabled states are not in the mock and follow the ui-kit Dialog (form), Toast and Button rules; the destructive tone is NOT used (parking is reversible).

## 7. Reuse

`ui:Dialog` (form), `ui:Toast`/`useToast`, `ui:Button`, `useGatewayMutation` (OVE_BOARDUI001), ULID helper for idempotency keys (OVE_ARCH007), `routes.agentChat` (SHELL).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-task-actions.tsx` (context + hook), `dialogs/DeferTaskDialog.tsx`, `regions/task-actions.region.tsx`.

## 9. Security and safety

Parking and unblocking change Task state only: they do not grant anything. The UI sends `expectedVersion` and no actor. The reason text is untrusted input going out and is shown later as plain text everywhere. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- `canDefer` false (Task already done): button absent.
- Defer pressed twice: single flight.
- Engine returns `board.move_not_permitted` (caller lacks authority): toast with the mapped message, no state change.
- Task assigned Agent archived: chat button hidden.
- Undo after the Task already moved by Chief: unblock fails with invalid_transition, toast.
- Reason with only whitespace: treated as empty.

## 11. Acceptance criteria

- [ ] Given T-31 with chat target QA, Then the button reads `Czat z QA` and navigates to the QA chat.
- [ ] Given the Owner defers with a reason, Then `POST /tasks/:id/defer` carries `expectedVersion` and an idempotency key, the card leaves the lane after the event and the `Odłożone` count increases.
- [ ] Given a version conflict, Then no error is thrown, the detail refetches and a toast explains.
- [ ] Given a deferred Task, Then `Przywróć` is shown instead of `Odłóż`.
- [ ] Axe clean; the dialog traps and restores focus.

## 12. Test plan

Vitest + Testing Library with a fake api-client from `lib:test-utils`: `use-task-actions.test.tsx`, `DeferTaskDialog.test.tsx` (validation, conflict, undo), a story for the dialog and a visual test of the actions row against `design.png`. Storybook stories only where this task adds a component of its own. Axe on every rendered state (`lib:a11y-harness`). Commands: `pnpm --filter @overmind/desktop test board`, `pnpm --filter @overmind/desktop storybook:test`. Playwright and visual tests for the whole view are in OVE_BOARDUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: 8 s undo for defer.
- OPEN: `until` (defer until a date) is not in the contract; not offered.
