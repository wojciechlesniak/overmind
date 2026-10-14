---
id: OVE_ONB039
title: "Implement the step 4 state machine: derive skip, connected and paired states"
area: ONB
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_ONB011, OVE_ONB034, OVE_SHELL005, OVE_TG005, OVE_TG012]
soft_depends_on: ["OVE_ONB020", "OVE_ONB021"]
provides: ["lib:telegram-step-state", "lib:use-telegram-decision"]
needs: ["api:telegram.status", "api:onboarding.telegram-decision", "lib:api-client-telegram", "lib:use-gateway-query", "lib:use-gateway-mutation", "lib:use-wizard-step", "event:telegram.channel.status.changed"]
owns: ["apps/desktop/src/features/onboarding/steps/telegram/state/**"]
reads: ["apps/desktop/src/features/onboarding/steps/telegram/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16.1"]
adr_refs: [6]
---

# OVE_ONB039: Implement the step 4 state machine: derive skip, connected and paired states

## 1. Summary

A pure state derivation plus two hooks that decide what step 4 'Telegram (opcjonalnie)' shows and how the footer behaves: no bot, bot connected but not paired, paired, skipped, or locked out, on first entry, after an app restart, and after Back. ONB020 and ONB021 render from this single source of truth.

## 2. Context

ONB020 defines the states inline and ONB034 persists the Owner's decision. Without one shared function, token form, pairing panel and footer disagree after resume (for example the form reappearing after a bot was connected). Telegram is optional; the visual follows steps 1-2 and has no mock (review needed). Telegram never extends permissions; the step must say so in its footer note (copy lives in ONB020).

## 3. Scope (in)

- Pure `deriveTelegramStepState(inputs)`.
- Hooks `useTelegramStepState()` (combines `telegram.status`, onboarding state, events) and `useTelegramDecision()` (skip/undo through ONB034).
- Footer policy `telegramFooterPolicy(state)` returning next/back/hint descriptors for `useWizardStep`.

## 4. Out of scope

- Token form (ONB020), pairing panel (ONB021), completion (ONB022, ONB040), backend (ONB034, TG).

## 5. Detailed requirements

1. **States** (closed union): `loading`, `engine_error`, `not_configured`, `bot_connected` (token stored, not paired; includes `botUsername`), `code_active` is NOT a state here (pairing code lives in ONB021), `paired`, `skipped`, `locked` (`lockedUntil`). Inputs: `{ channel: TelegramChannelStatus | undefined; decision: 'pending'|'skipped'|'done'; queryStatus }`.
2. **Precedence:** `paired` > `locked` > `bot_connected` > `skipped` > `not_configured`. Rationale: reality beats the stored choice; a skipped Owner who later connected a bot sees the bot.
3. **Footer policy.** `not_configured`: Next disabled with hint 'Wklej token albo pomiń ten krok.'; secondary 'Pomiń na razie' in content (ONB020). `bot_connected`: Next enabled, label 'Dalej', hint 'Możesz sparować Telegrama później w Ustawieniach.'. `paired`: Next enabled, label 'Dalej' (to the summary, ONB040). `skipped`: Next enabled, with a secondary action 'Jednak połącz' that calls `undecided`. `locked`: like `bot_connected` plus lock hint. `loading`/`engine_error`: Next disabled with reason. Back is always enabled and goes to step 3.
4. **Skip.** `useTelegramDecision().skip()` calls `PUT /v1/onboarding/telegram-decision {decision:'skipped'}` (ONB034) then advances to the summary; `undo()` calls `undecided`.
5. **Resume.** On mount the hook reads `onboarding.state` and `telegram.status`; it never uses local storage. After restart: skipped -> `skipped` view; bot connected -> `bot_connected`; paired -> `paired`. A pairing code never survives resume (ONB021 clears it).
6. **Events.** `telegram.channel.status.changed` invalidates `telegram.status`; the derived state updates live; a `paired` transition while the step is visible announces 'Sparowano' via the polite live region.
7. The hook exposes `{ state, skip, undo, refetch }` only; the token is not reachable from it.
8. No `localStorage`/`sessionStorage` use (test asserts via spy).

## 6. Design notes

N/A, functionality only (state logic). Visual and copy follow steps 1-2 and ONB020; a design review is needed.

## 7. Reuse

`useGatewayQuery/Mutation`, `useWizardStep`, api-client modules of TG012 and ONB034, `useInvalidateOnEvents`. Do not re-derive pairing from raw fields in components.

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/telegram/state/{derive-telegram-step-state.ts, telegram-footer-policy.ts, use-telegram-step-state.ts, use-telegram-decision.ts, index.ts}`. The two pure files have no React imports.

## 9. Security and safety

- No token, code or chat id is read, stored or logged by this module; `TelegramChannelStatus` carries none (TG001).
- The UI cannot mark `done`; only the engine does (ONB034).
- Fail closed: unknown channel status -> `engine_error`/`loading`, never `paired`.
- Telegram principals are irrelevant here (desktop only).

## 10. Errors and edge cases

- Status query fails: `engine_error` with retry; Back still works.
- Paired and skipped both true: `paired`.
- Lockout expiry while visible: state returns to `bot_connected` when `lockedUntil` passes (timer based on server time).
- Status event storm: derived state is memoised and stable (no flicker).

## 11. Acceptance criteria

- [ ] Given the truth table of inputs then every row yields the specified state.
- [ ] Given restart after skip then the skipped view shows and 'Jednak połącz' returns to the form.
- [ ] Given a pairing confirmed in Telegram then the view moves to `paired` without a reload.
- [ ] Given the module then it never touches browser storage.
- [ ] Given each state then footer policy matches section 5.3.

## 12. Test plan

Table-driven unit tests (`derive-telegram-step-state.test.ts` with all combinations), hook tests with fake client and events, storage-spy test. Command: `pnpm --filter @overmind/desktop test features/onboarding/steps/telegram/state`.

## 13. Parallelization notes

Parallel with ONB037/ONB038. ONB020 and ONB021 SHOULD consume this (amendment, section 14). Hotspot: none.

## 14. Open questions and assumptions

- AMENDMENT REQUEST to ONB020: use `useTelegramStepState` instead of its inline state machine and `useTelegramDecision.skip` instead of the completion-body flag.
- OPEN (design): no mock for step 4.
- ASSUMPTION: 'Jednak połącz' is acceptable copy.
