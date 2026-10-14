---
id: OVE_ONB034
title: "Implement the Telegram step decision: persist skip, derive done from pairing, resume"
area: ONB
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ENGINE016, OVE_ONB003, OVE_ONB031, OVE_TG003, OVE_TG005]
soft_depends_on: ["OVE_ONB007"]
provides: ["usecase:RecordTelegramDecision", "usecase:ResolveTelegramStepStatus", "api:onboarding.telegram-decision", "lib:api-client-onboarding-telegram-decision"]
needs: ["port:OnboardingStepWriter", "port:ChannelStatusReader", "usecase:GetPairingState", "event:telegram.channel.status.changed", "lib:route-module", "port:AuditSink"]
owns: ["packages/application/src/onboarding/telegram-decision/**", "packages/gateway/src/routes/onboarding/telegram-decision.route.ts", "packages/api-client/src/onboarding/telegram-decision.ts"]
reads: ["packages/application/src/onboarding/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 16.1"]
adr_refs: [6]
---

# OVE_ONB034: Telegram step decision

## 1. Summary

Persists the Owner's choice on step 4 so that 'Pomiń na razie' survives an app restart, and derives `steps.telegram.status` ('pending' | 'skipped' | 'done') from the real Telegram pairing instead of trusting the UI. Telegram stays optional and never blocks completion.

## 2. Context

ONB007 (`CompleteOnboarding`) requires a Telegram decision: `pending` is acceptable only if resolved at completion (ONB007 requirement 1 item 4). ONB020 proposes that skip is sent in the completion body; that loses the choice on restart and makes resume ambiguous. This task adds a small write path. 'done' means: a bot token is stored in the Keychain AND a Pairing is confirmed (TG003/TG005); having only a bot configured is `pending`. Telegram never extends permissions (ADR 0006); this decision grants nothing.

## 3. Scope (in)

- Use case `RecordTelegramDecision` (`skipped` | `undecided`) via `OnboardingStepWriter`.
- Use case `ResolveTelegramStepStatus`: pure derivation used by `GetOnboardingState` read-through and by completion.
- Route `PUT /v1/onboarding/telegram-decision` and the api-client function.
- Subscriber: on `telegram.channel.status.changed` to paired while onboarding is in progress, write `steps.telegram.status = 'done'`.

## 4. Out of scope

- Token storage, pairing codes, unpair (TG003, TG012).
- UI (ONB020, ONB021, ONB039).
- Completion itself (ONB007, which should accept the derived value).

## 5. Detailed requirements

1. **Derivation rule** `resolveTelegramStatus({ stored, channel })`: `channel.paired === true` -> `'done'`; else `stored === 'skipped'` -> `'skipped'`; else `'pending'`. Unpairing later does not change a completed onboarding (state frozen at completion; after completion this task is inert).
2. `RecordTelegramDecision({ decision })`: allowed while `status !== 'completed'`, and only if `currentStep >= 4` (else `onboarding.step_not_active`). `skipped` when already `done` is a no-op returning `done`. `undecided` returns `pending` (Owner changed their mind).
3. The route accepts only the desktop Owner principal; the body never contains a token or code (contract ONB031).
4. Skipping does NOT delete a connected bot or revoke a pairing (those are explicit actions in Settings). If a bot is connected but unpaired and the Owner skips, status is `skipped` and the bot remains configured (UI explains: 'Możesz sparować Telegrama później w Ustawieniach').
5. The subscriber is idempotent, ignores events when onboarding is completed, and ignores events that do not carry `paired` status.
6. Audit `onboarding.telegram_decision` with `{ decision, derived }` only.
7. Emits `onboarding.state_changed` after each effective change.
8. `GetOnboardingState` (ONB003) SHOULD call `resolveTelegramStatus`; if ONB003 is not amended, the subscriber keeps the stored value in sync and the route returns the derived value (record in 14).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`OnboardingStepWriter` (ONB003), `ChannelStatusReader` (TG005), `GetPairingState` (TG003), event bus (ARCH010), route-module and api-client conventions, `AuditSink`.

## 8. Architecture and code placement

`packages/application/src/onboarding/telegram-decision/{record-telegram-decision.ts, resolve-telegram-status.ts, paired-subscriber.ts}`; route and api-client modules as in `owns`. The derivation is a pure function with a truth-table test; the subscriber is wired in the composition root through the existing module hook (ARCH006), not by editing shared files.

## 9. Security and safety

- 'done' cannot be written by clients: only derived from a real pairing (no UI spoofing of a paired channel).
- No secret in request, response, audit or event; the token lives only in the Keychain (TG012).
- Telegram principals cannot call the route (403): the Owner decides from the desktop.
- Fail closed: if channel status cannot be read, the derivation returns `pending` (never `done`).

## 10. Errors and edge cases

- Pairing confirmed while the Owner just pressed Skip: `done` wins (paired is true).
- Engine restarted between skip and completion: stored `skipped` survives.
- Route called on step 2: `step_not_active`.
- Duplicate events: no duplicate writes or audit rows.

## 11. Acceptance criteria

- [ ] Given skip then restart then state shows `skipped` and step 4 opens in the skipped state.
- [ ] Given a pairing confirmed then status becomes `done` without a client call.
- [ ] Given bot connected, unpaired, skip then status `skipped` and the bot remains configured.
- [ ] Given a client sends `done` then validation error.
- [ ] Given channel status unreadable then derived status is `pending`.
- [ ] Given a Telegram principal then 403.

## 12. Test plan

Truth-table unit test for `resolveTelegramStatus`; use-case tests with fakes (`record-telegram-decision.test.ts`); subscriber test with a fake bus; route and principal tests. Command: `pnpm --filter @overmind/application test onboarding/telegram-decision`.

## 13. Parallelization notes

Parallel with ONB032, ONB033, ONB035, ONB036. Needs TG contracts only by capability. Conflict hotspot: `GetOnboardingState` (ONB003) is read-only for this task; any change is a proposal.

## 14. Open questions and assumptions

- AMENDMENT REQUEST to ONB020/ONB022: skip uses `api:onboarding.telegram-decision` rather than a body flag; `complete` then carries no Telegram field (or ignores it).
- ASSUMPTION: unpairing before completion in Settings is impossible (wizard still open), so no extra rule.
