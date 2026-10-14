---
id: OVE_PROV008
title: Implement the command delivery guard (never into a waiting agent, no blind retry)
area: PROV
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_BOX019, OVE_ENGINE016, OVE_PAUSE001, OVE_PROV005, OVE_PROV006, OVE_PROV009, OVE_PROV019]
soft_depends_on: [OVE_PROV028]
provides: ["lib:delivery-guard", "port:DeliveryJournal"]
needs: ["usecase:RequireIsolation", "port:PauseState", "port:AuditSink", "port:Clock", "port:IdGenerator", "lib:redaction", "port:TerminalLayer", "contract:ProvConfig"]
owns:
  - packages/application/src/prov/delivery/**
  - packages/application/src/ports/DeliveryJournal.ts
reads: ["docs/research/prototyp-wnioski.md", "docs/research/herdr-analiza.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [3, 4, 21, 26]
---

# OVE_PROV008: Implement the command delivery guard (never into a waiting agent, no blind retry)

## 1. Summary

Every text that goes into a CLI terminal passes one guard. It checks isolation, Global Pause and a fresh look at the terminal, refuses to type into an approval dialog, a choice dialog, a login screen or a limit screen, writes an intent record before sending, and never repeats a send whose outcome is unknown. This is the "gate always in Overmind's adapter" rule from the prototype.

## 2. Context

ADR 0026 and Spec 9: a command is not delivered to an Agent that waits for approval in the CLI and is not retried blindly after a timeout; that situation becomes an Approval or an Escalation. herdr's own gate covers only agents started through `agent.prompt` (prototype 3.2.1), and herdr's `--wait` returns `stalled` after 5 s without a start of work, after which the docs warn against re-sending. Sending text into a CLI is non-idempotent (Spec 12): a duplicated "run the migration" could repeat side effects.

## 3. Scope (in)

- `DeliveryGuard.deliver(request)` orchestration used by the gateway (PROV029).
- `DeliveryJournal` port (intent, outcome, replay by idempotency key) with an in-memory implementation for tests; persistence is PROV028.
- Start-of-work verification after a send.
- Audit events and text sanitation.

## 4. Out of scope

- The port and receipt types (PROV009), terminal I/O (PROV005), classification (PROV006), answering CLI dialogs (PROV013), what to do after `delivery_unknown` (callers: Chief or WFRT raise an Escalation, PROV015 checks effects), persistence (PROV028).

## 5. Detailed requirements

1. **Order of checks** (each failure returns immediately with a typed error and an audit event `provider.delivery_refused`):
   1. text validation: UTF-8, 1..200 KiB, no NUL, no control characters except `\n` and `\t`, no ESC; the bracketed-paste end marker is rejected (`prov.text_rejected`);
   2. idempotency: look up `(agentId, idempotencyKey)` in the journal; same key with the same `sha256(text)` returns the stored receipt without sending; different hash returns `prov.duplicate_delivery`;
   3. Global Pause (`PauseState`): paused returns `prov.paused` (the Run layer also stops, belt and braces);
   4. `RequireIsolation.execute({ purpose: 'send_command', agentId, workspaceId, envId })` returns an `IsolationTicket`; failure returns `box.isolation_unavailable` unchanged;
   5. **fresh state:** read screen and herdr state now through `TerminalLayer` (cache not older than 1 s), classify (PROV006). If `!isDeliverableState(state)` return `prov.agent_blocked` with `details.state`; `working` returns `provider.busy` unless `allowWhileWorking` and kind `followup`; `needs_login` and `rate_limited` additionally raise the corresponding events through PROV014 and PROV018 hooks (`onBlockedState`) but never type anything;
   6. **intent record:** `journal.begin({ deliveryId, agentId, runId, idempotencyKey, textHash, stateBefore, at })` is written BEFORE the send; if the journal write fails the send does not happen (fail closed).
2. **Send:** through `TerminalLayer.sendText` with `submit: true`; for named herdr-started agents `viaPrompt: true`. No second send attempt of any kind on any error.
3. **Verify start of work:** wait up to 5 s (config `prov.verifyStartMs`) for the observer to report `working`, or for the screen echo of the first 40 chars of the text near the bottom. Success records `verifiedWorkingAt` and outcome `sent`. No evidence records `sent_unverified` (the text may be queued by the CLI) and returns the receipt with that outcome; it is the caller's job to not resend.
4. **Unknown outcome:** a timeout, `stalled`, connection loss or herdr error after the intent record returns `Err(provider.delivery_unknown)`, marks the journal entry `unknown` and publishes `provider.delivery_unknown` (audit + event). Replaying the same idempotency key returns the same error until the Owner or Chief resolves it. `resolveUnknown(deliveryId, resolution: 'confirmed_delivered'|'confirmed_not_delivered', evidence)` exists for PROV015 and for an explicit Owner choice; only `confirmed_not_delivered` allows a send with a NEW key.
5. **Serialisation:** one delivery at a time per Agent (mutex with 30 s queue timeout, then `provider.busy`).
6. **Journal port:** `begin`, `complete(deliveryId, outcome)`, `markUnknown`, `findByKey`, `listUnresolved(agentId?)`. Entries store hashes and ids only, never the text (the text is already in the conversation store).
7. **Audit:** `provider.delivery_sent` (ids, state before, text hash prefix, size), `provider.delivery_refused` (reason), `provider.delivery_unknown`. No text is logged; length and `sha256` prefix only (aligned with PROV004 logging).
8. **No bypass:** no flag skips the state check or the isolation ticket in production builds; tests use the fake ports.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`isDeliverableState` and error codes (PROV009), `classify` (PROV006), `TerminalLayer` (PROV005), `RequireIsolation`/`IsolationTicket` (BOX019), `PauseState` (PERM010), `AuditSink`, `Clock`, `IdGenerator`, redactor.

## 8. Architecture and code placement

Application layer: `packages/application/src/prov/delivery/{delivery-guard.ts,text-validator.ts,verify-start.ts,unknown-resolution.ts,in-memory-journal.ts}`; port `packages/application/src/ports/DeliveryJournal.ts`. Depends only on ports; the herdr adapter is injected through `TerminalLayer`. SRP: validation, checks, send and verification are separate functions composed by `DeliveryGuard`.

## 9. Security and safety

Abuse cases: an Agent or a document makes Overmind type `1` or `Enter` into an approval dialog (blocked by step 5: waiting and selection states are never deliverable); a prompt-injected message contains escape sequences or Ctrl-C (rejected by text validation); a timeout is retried and a payment or push happens twice (no automatic retry; unknown outcome stays unresolved); Overmind crashes between intent and send (the journal shows an unresolved intent after restart, treated as unknown, never replayed); Pause arrives during the verification wait (the delivery already happened, but no new one starts; state surfaced as usual). Ambiguity always resolves toward refusal (PROV006 classifies uncertain screens as waiting).

## 10. Errors and edge cases

- State flips to `waiting_approval` between check and send: tolerated window below 100 ms and documented; the intent journal and the CLI's own dialog make a stray Enter low impact; the check is repeated immediately before send (`readState` twice).
- Same text sent twice with different keys on purpose: allowed (two deliveries), each with its own record.
- Journal full or unavailable: refuse (`provider.unavailable`).
- Receipt for a replay of a `sent_unverified` delivery: returned as is.
- Text exactly 200 KiB: accepted; 200 KiB + 1: `prov.text_rejected`.

## 11. Acceptance criteria

- [ ] For each non-deliverable fixture screen (approval dialog, choice dialog, login expired, rate limit, stopped) the guard returns `prov.agent_blocked` and `FakeTerminalLayer` records zero sends.
- [ ] With a forced herdr timeout after the intent record, the result is `provider.delivery_unknown`, exactly one send was attempted, and a replay with the same key does not send again.
- [ ] After `resolveUnknown(..., 'confirmed_not_delivered')` a new key sends once.
- [ ] Control characters and `ESC[201~` in text are rejected before any journal write.
- [ ] Without an `IsolationTicket` or during Global Pause nothing is sent.
- [ ] Journal write failure prevents the send.
- [ ] Logs contain no prompt text (`expectNoSecrets` plus length-only assertion).

## 12. Test plan

Table-driven unit tests over states x pause x isolation; fault-injection tests using `FakeTerminalLayer` scripts (`timeout`, `connection_lost`, `late_working`); property test: for any sequence of calls, number of sends per idempotency key is at most 1. Commands: `pnpm vitest run packages/application/src/prov/delivery`.

## 13. Parallelization notes

Needs PROV009 types and PROV005's port; can start against fakes. PROV029 composes it; PROV015 and PROV013 call `resolveUnknown` and the `onBlockedState` hook (extension point: an array of `BlockedStateHandler`, no edits to this file).

## 14. Open questions and assumptions

- ASSUMPTION: `verifyStartMs` default 5000 (herdr's own start detection window).
- ASSUMPTION: the isolation ticket is requested per delivery (60 s validity) and not cached.
- Open: queueing deliveries while the CLI works is done by callers (CHAT008 queue), not here.
