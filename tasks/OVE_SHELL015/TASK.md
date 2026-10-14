---
id: OVE_SHELL015
title: "Provide the top-bar data hooks: limits, slots, Telegram status and approvals counter"
area: SHELL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS042, OVE_SHELL001, OVE_SHELL002, OVE_SHELL005, OVE_SHELL006, OVE_SHELL007, OVE_SHELL011]
soft_depends_on: []
provides: ["lib:use-top-bar-summary", "lib:top-bar-view-model"]
needs: ["ui:LimitMeter", "ui:SlotsPill", "ui:ChannelPill", "ui:ApprovalsButton", "lib:i18n-provider", "contract:TopBarSummary"]
owns: ["apps/desktop/src/app/topbar/model/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [18, 23]
---

# OVE_SHELL015: Provide the top-bar data hooks: limits, slots, Telegram status and approvals counter

## 1. Summary

Implements `useTopBarSummary(workspaceId)` and the pure view-model mappers that turn the `shell.top-bar` response into the exact props of the ui-kit top-bar controls: limit entries 'per CLI', the 'Agenci N z M naraz' label, the Telegram pill and the 'N czekają' approvals button. No JSX; the visual composition is OVE_SHELL016.

## 2. Context

The top bar shows live facts: `Claude Max 62% · reset 3 h · wg CLI`, `Agenci 3 z 3 naraz`, `Telegram połączony`, `3 czekają` (VIEWS 'Shared shell'). The engine aggregates them in one route (OVE_SHELL002, contract OVE_SHELL001). The ui-kit controls (DS042) take preformatted strings as props (rule G3); something must own the data, the invalidation and the translation of engine values into those props. If each view or each control fetched its own data the bar would flicker and double-count. The hook sits in the SHELL data layer (SHELL005 query hooks, SHELL006 event hub).

## 3. Scope (in)

- `apps/desktop/src/app/topbar/model/use-top-bar-summary.ts`: query `shell.top-bar` with `{ workspaceId? }`, `staleTime` 30 s, invalidated by `TOP_BAR_INVALIDATING_EVENTS` (SHELL001) through `useInvalidateOnEvents`.
- Pure mappers in `.../model/`: `toLimitMeterEntries`, `toSlotsViewModel`, `toChannelPillViewModel`, `toApprovalsViewModel`, `toTopBarViewModel` (single entry point returning every control's props plus `status: 'loading'|'ready'|'stale'|'error'`).
- Plural and wording keys in the `topbar` namespace used by the mappers (keys are created by OVE_SHELL016, see its catalogue); the mappers receive `t` and `locale`, they do not import i18n globally.
- Fake summary builders for tests and stories (`buildTopBarSummary(overrides)`) exported from `app/topbar/model/testing.ts`.
- Stale handling: data older than 90 s while the event hub is disconnected is flagged `stale` so the bar can dim it.

## 4. Out of scope

- The visual bar (OVE_SHELL016), pause controls (OVE_SHELL017, PAUSE010/011), switcher menu (OVE_SHELL017).
- The engine route and use case (OVE_SHELL002) and the contract (OVE_SHELL001).
- Notification centre counters (NOTIF area).

## 5. Detailed requirements

1. **Hook.** `useTopBarSummary(workspaceId: string | null): { data?: TopBarSummary; vm: TopBarViewModel; status; error?: UiError; refetch(): void }`. Query key from `queryKeys.shell.topBar(workspaceId)`. The Workspace id comes from `useCurrentWorkspaceId()` (SHELL011) and is `undefined` on routes with `topBar: 'plain'` (Workspaces dashboard, Settings: no switcher), in which case `pause.workspace` is not requested.
2. **Invalidation.** The hook registers `useInvalidateOnEvents(TOP_BAR_INVALIDATING_EVENTS, queryKeys.shell.topBar())` with a 250 ms trailing debounce so a burst of `approval.requested` events triggers one refetch. On event hub `resync` (SHELL006) it refetches immediately. No polling while the hub is connected; while it is disconnected poll every 15 s (the engine-down gate, SHELL020, takes over when the engine is unreachable).
3. **Limits mapper.** `toLimitMeterEntries(limits)` returns `{ id, cli, percent, resetLabel }[]` for `ui:LimitMeter`. `cli` = `cliLabel` verbatim (plain text). `percent` = `percentUsed` (integer) or `null`. `resetLabel` = `resetsInText` verbatim, else a relative text built from `resetsAt` with `formatRelative` ('reset za 3 h' / 'reset in 3 h'), else undefined. Entries with `state: 'needs_login'` show `resetLabel = t('limits.needsLogin')` ('wymaga logowania'); `state: 'limit_reached'` forces `percent = 100`; `state: 'unavailable'` is dropped from the meter and counted in `hiddenCount`. Sort: connections in the Owner's fallback order (engine order), never alphabetical.
4. **Percent rule (product rule 'wg CLI').** The UI never calculates a percentage. When `percentUsed` is null and `source === 'per_cli'` the entry is passed with `percent: null` and `resetLabel = limitText` (verbatim, truncated to 40 chars with ellipsis in the DS) so the Owner still sees what the CLI said; Ollama (`source: 'ollama_local'`) renders as 'bez limitu'. The suffix 'wg CLI' is added by the DS component and cannot be removed here.
5. **Slots mapper.** `toSlotsViewModel(slots)` returns `{ active, max, label, compactLabel, queuedText? }`; `label` = `t('slots.label', { active, max })` -> 'Agenci 3 z 3 naraz' (EN 'Agents 3 of 3 at once'); `compactLabel` = '3/3'; when `queued > 0` the label stays the same and `queuedText` ('2 w kolejce') goes to the tooltip. Numbers always carry a word unit (styl-wizualny).
6. **Telegram mapper.** `toChannelPillViewModel(telegram)` maps the 8 engine statuses to the 4 DS statuses and a label: `connected` -> connected 'Telegram połączony'; `connecting` -> connecting 'Telegram łączy się…'; `not_configured` -> disconnected 'Telegram nie skonfigurowany'; `unpaired` -> disconnected 'Telegram niesparowany'; `disconnected` -> disconnected 'Telegram rozłączony'; `degraded` -> disconnected 'Telegram: problemy z połączeniem'; `error` and `locked` -> error 'Telegram: błąd' / 'Telegram zablokowany'. The word is always in the label (state never by colour alone). `botUsername` is added to the tooltip only (`@name`), never to the pill text.
7. **Approvals mapper.** `toApprovalsViewModel(pending)` returns `{ count: pending.total, label, ariaLabel, href: '/approvals' }`. PL plural forms: one '{{count}} czeka', few '{{count}} czekają', many '{{count}} czeka', other '{{count}} czeka' (mock shows '3 czekają'); EN one '{{count}} waiting', other '{{count}} waiting'; zero -> 'Brak oczekujących' / 'Nothing waiting'. Above 99 the label shows '99+'. `ariaLabel` = 'Zgody i Prośby: 3 czekają' (mock). The breakdown (approvals / access requests / escalations) goes to a tooltip text 'Zgody 1 · Prośby o dostęp 2 · Eskalacje 0'.
8. **Pause flags.** The mapper exposes `pause: { global, workspace }` unchanged; the authoritative pause state used by the controls comes from PAUSE's `usePause` (PAUSE010). The summary value is only a cache hint for first paint (avoid a flash of the non-paused bar).
9. **Errors.** On query error the view model is `{ status: 'error', limits: [], ... }` with `error` mapped by `toUiError`; the bar renders the error state of OVE_SHELL018. A single failing sub-source on the engine side arrives as `limits: []` or `telegram.status: 'error'` inside a successful response (SHELL002 isolates failures), so partial data is normal.
10. **Redaction.** `cliLabel`, `limitText`, `resetsInText` and `botUsername` are CLI/Telegram-originated text: rendered as plain text only (never HTML, never into a `title` without escaping by React), truncated by the DS.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `useGatewayQuery`, `useInvalidateOnEvents`, `queryKeys` (SHELL005/006), `useCurrentWorkspaceId` (SHELL011), `useFormat` (SHELL007), `toUiError` (SHELL004).
- `TopBarSummary`, `TOP_BAR_INVALIDATING_EVENTS` from `@overmind/contracts` (SHELL001); client function `shell.topBar()` from `@overmind/api-client` (SHELL002).
- DS prop types from `@overmind/ui-kit` (`LimitEntry`, `ChannelPillProps`...) are imported, not redeclared.

## 8. Architecture and code placement

`apps/desktop/src/app/topbar/model/{use-top-bar-summary.ts,map-limits.ts,map-slots.ts,map-telegram.ts,map-approvals.ts,to-top-bar-view-model.ts,testing.ts}`. UI application layer: pure mappers (unit-testable without React), one hook. Does not import any component.

## 9. Security and safety

- Text from CLIs and Telegram is untrusted data: the mappers never interpret it, never build links from it and never put it in `dangerouslySetInnerHTML` (DS renders text nodes).
- No secrets cross this hook: the contract carries no token, no path, no message content.
- The UI does not compute or infer limits; it displays the CLI's own words (SPEC 9: limits 'per CLI'), so it can never claim capacity the CLI did not report.
- Counts come from the engine for the Owner principal only; the hook cannot be used to enumerate other Workspaces' items (it shows numbers only).

## 10. Errors and edge cases

- Response arrives with `limits` longer than 8: contract caps at 8; extra are ignored defensively.
- Negative or > 100 percent from a corrupt response: zod parse at the api-client boundary rejects it (not clamped silently); the bar shows the error state.
- Two Workspaces switch quickly: the query key changes, previous data is not shown for the new Workspace (`placeholderData` off for `workspaceId` change).
- Clock skew: `resetsAt` in the past renders 'reset teraz' no negative text.
- Locale switch re-maps without a refetch.
- Event burst: one debounced refetch; a refetch in flight is not duplicated.

## 11. Acceptance criteria

- [ ] Given a summary with Claude 62% reset 3 h then the limit entry equals `{cli:'Claude Max', percent:62, resetLabel:'reset 3 h'}`.
- [ ] Given `percentUsed: null` and `limitText` then percent is null and the text is passed through unchanged.
- [ ] Given pending.total 3 then label is '3 czekają' in PL and '3 waiting' in EN, and ariaLabel is 'Zgody i Prośby: 3 czekają'.
- [ ] Given each of the 8 Telegram statuses then the mapping table above holds (parameterised test).
- [ ] Given an `approval.requested` event then exactly one refetch happens within 400 ms.
- [ ] Given the hub disconnects then polling starts at 15 s and stops on reconnect.

## 12. Test plan

- Vitest on mappers with table tests (no React); hook tests with `renderWithProviders`, fake api-client and `FakeEventSource`.
- Contract guard: a test imports `TOP_BAR_INVALIDATING_EVENTS` and asserts the hook subscribes to the same list.
- Commands: `pnpm --filter @overmind/desktop test topbar/model`.

## 13. Parallelization notes

Starts after OVE_SHELL001 (contract) and SHELL005/006. Parallel with SHELL016 (the component task only needs the view-model type, defined here in `to-top-bar-view-model.ts` first). OVE_SHELL017/018 consume this hook.

## 14. Open questions and assumptions

- ASSUMPTION: PL plural 'many' form for 5+ is 'czeka' (grammatically correct: '5 czeka'); the mock only shows 3. Translator to confirm.
- OPEN (DS gap): `ui:LimitMeter` has no 'percent unknown but text available' variant; this task passes `percent: null` plus the verbatim text in `resetLabel`, which the DS renders as 'bez limitu'-style. Propose a DS variant 'unknown'.
- OPEN: queue text '2 w kolejce' is not in the mock (DESIGN GAP, derived from SPEC 9 queue behaviour).
