---
id: OVE_PROV024
title: Build the PROV fakes, builders and shared contract suites for providers and terminals
area: PROV
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_PROV001, OVE_PROV002, OVE_PROV005, OVE_PROV009, OVE_PROV019, OVE_PROV020, OVE_PROV034, OVE_TEST002, OVE_TEST003, OVE_TEST006, OVE_TEST009]
soft_depends_on: [OVE_TEST003, OVE_TEST006, OVE_TEST009]
provides: ["lib:prov-fakes", "lib:prov-builders", "lib:prov-contract-suites"]
needs: ["lib:contract-test-harness", "lib:fake-clock", "lib:fake-herdr", "lib:fake-cli-scenarios", "port:ModelProvider", "port:TerminalLayer", "port:AgentSessionGateway", "port:ConnectionRepository", "port:ConcurrencyLimiter"]
owns:
  - packages/testing/src/prov/**
  - packages/application/src/prov/testing/**
  - docs/providers/testing.md
reads: ["packages/testing/", "tools/fake-cli/", "tools/fake-herdr/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 16", "SPECIFICATION 19"]
adr_refs: [22, 26]
---

# OVE_PROV024: Build the PROV fakes, builders and shared contract suites for providers and terminals

## 1. Summary

One place for everything that other tasks (and other areas) need to test provider behaviour without real CLIs: in-memory fakes of the PROV ports, builders for common objects, and parameterised contract suites that every implementation of a port must pass (`ModelProvider`, `TerminalLayer`, `AgentSessionGateway`, `ConnectionRepository`, `ConcurrencyLimiter`, `HerdrClient`). Real adapters and fakes run the same suites, so fakes cannot drift.

## 2. Context

TEST003 provides the contract-suite harness, TEST006 the fake CLI simulators (`fake-claude`, `fake-codex` with scenarios such as `login_expired`, `choice_dialog`, `rate_limit`, `starts_in_root`, `done_without_command`), TEST009 the fake herdr server and its fault switches (`eventDrop`, `restartLoss`, `crashServer`, `socketPermsWrong`, `versionMismatch`) and the `HerdrClientContract` expectation list. PROV tasks reference `ModelProvider.contract`, `TerminalLayer.contract` and similar; AGENT, CHAT, DISC and WFRT adapters need `FakeAgentSessionGateway` and `FakeModelProvider`.

## 3. Scope (in)

- Fakes: `FakeModelProvider`, `FakeTerminalLayer`, `FakeAgentSessionGateway`, `FakeConnectionRepository` (re-export of the in-memory repo of PROV020 behind the testing barrel), `FakeConcurrencyLimiter`, `FakeFallbackRepository`, `FakeDeliveryJournal`, `FakeEffectProbe`.
- Builders: `aConnection`, `aModelRef`, `aTerminalObservation`, `aSessionSnapshot`, `aDeliveryReceipt`, `aProviderEvent`, `aCliProfile`.
- Contract suites listed above, each a function `runXContract(factory)`.
- A scripting DSL for deterministic scenarios.
- Documentation `docs/providers/testing.md`.

## 4. Out of scope

- The fake CLI binaries and fake herdr server (TEST006/TEST009), the real adapters (their own tasks), end-to-end security scenarios (PROV033), UI mocks (TEST004).

## 5. Detailed requirements

1. **Fakes behave like the real contracts:** same error codes, same ordering rules (stream starts with `started`, ends with `done`/`error`), same idempotency semantics (`FakeAgentSessionGateway.sendPrompt` honours idempotency keys and `prov.agent_blocked` for non-deliverable states). Time comes only from `FakeClock`; no `setTimeout`/`Date.now` inside fakes.
2. **Scripting DSL (`FakeModelProvider` and `FakeAgentSessionGateway`):** `script.on(agentId).state('working').reply('...').then.state('idle')`, `script.fail('provider.needs_login')`, `script.limit({ resetsAtText })`, `script.delay(ms)`, `script.deliveryUnknown()`, `script.dialog({ options, diff })`, `script.login_expired()`. Calls are recorded: `fake.sends()`, `fake.interrupts()`, `fake.keys()` for assertions such as "zero sends".
3. **`ModelProvider.contract(factory)`:** capabilities are sync and pure; `invoke` and `stream` produce the same final status for the same scripted run; stream order `started ... done|error`, no throw; `cancel` makes the pending invocation end with `provider.cancelled`; `checkRequirements` failures return `provider.capability_missing` without side effects; non-idempotent requests are never replayed; output events are redacted and size-capped (8 KiB); unknown extra event types are ignored by the consumer helper; usage is labelled with a `source`.
4. **`TerminalLayer.contract`:** start with name and `/work` cwd, name collision error, `sendKey` accepts only the closed key union, `sendText` rejects control characters and the paste-end marker, screens normalised (ANSI, CR redraw), observer debounce (2 samples to `working`/`idle`, immediate dangerous states), `stopped` on pane loss.
5. **`AgentSessionGateway.contract`:** `snapshot` with and without session, `sendPrompt` refusal in each non-deliverable state, idempotent replay, `delivery_unknown` never replayed, ordered replies with cursors, `interrupt` only when working, `stop` idempotent.
6. **`ConnectionRepository.contract`:** invariants (cli has no secretRef, telegram requires one, loopback endpoint), optimistic locking, unique `(type, providerId)`, corrupt row handling; runs against memory and SQLite (SQLite run lives in PROV020 using this suite).
7. **`ConcurrencyLimiter.contract`:** `active <= limit` invariant under random sequences, FIFO and priority, idempotent acquire and release, Pause behaviour.
8. **`HerdrClientContract`:** implements the expectation list contributed by TEST009 (start named agent, prompt gate, blocked handling, state mapping, reconnect and cursor resume, version pin, socket permission refusal) against `HerdrClient` + `FakeHerdr`; suites are executed in the PROV004 and PROV005 test folders by import.
9. **Packaging:** exported as `@overmind/testing/prov` (generated barrel, ARCH009); production code cannot import it (boundary lint: `testing` is dev-only).
10. **Fixtures:** screens for suites come from `tools/fake-cli/screens/**` (TEST006); no screen text is copied into this package.
11. **Self-tests:** each fake passes its own contract suite; each suite fails against a deliberately broken implementation (mutation fixtures such as "sends into an approval dialog", "retries on timeout", "does not redact output").

## 6. Design notes

N/A, functionality only.

## 7. Reuse

TEST002 `FakeClock` and builders base, TEST003 contract harness, TEST006/TEST009 simulators, in-memory repository from PROV020, `expectNoSecrets` (SEC003).

## 8. Architecture and code placement

`packages/testing/src/prov/{fakes/*.ts,builders/*.ts,contracts/*.contract.ts,dsl/script.ts}`; `packages/application/src/prov/testing/` holds only type-level helpers that must live next to application code (for example `assertEventOrder`). Test-only package; no production dependency on it. One file per fake and per suite to avoid conflicts.

## 9. Security and safety

Negative tests are part of the suites: delivery into waiting states, retries after unknown delivery, unredacted output, key injection, control characters. Fakes must not weaken the real rules (a fake that accepts what the real component refuses is a defect found by the mutation self-tests). Test fixtures contain no real tokens or credentials; token-like strings are generated and flagged for the secret scanner allowlist.

## 10. Errors and edge cases

- A new port method is added (additive): the suite for that port gets a new case; fakes implement it or the suite fails.
- Flaky timing: forbidden by design (fake clock, no real timers).
- Real adapters that cannot run in CI (real CLI): suites run against fakes in CI and against the real adapter under the opt-in tag.

## 11. Acceptance criteria

- [ ] Every fake passes its contract suite, and every suite has at least one mutation fixture that fails it.
- [ ] `FakeAgentSessionGateway` records zero sends when a dialog is scripted and `sendPrompt` is called.
- [ ] `FakeModelProvider` scripted `limit` produces `provider.limit_reached` with bounded `resetsAtText`.
- [ ] Suites run against both `FakeConnectionRepository` and the SQLite repository (PROV020 wires it).
- [ ] Boundary lint prevents production packages from importing `@overmind/testing/prov`.
- [ ] `docs/providers/testing.md` lists fakes, DSL examples and how to run the opt-in real-CLI tests.

## 12. Test plan

Self-tests for fakes and suites (including mutation fixtures); type tests for builders. Commands: `pnpm vitest run packages/testing/src/prov packages/application/src/prov/testing`.

## 13. Parallelization notes

Depends only on ports and contracts, so it can start as soon as PROV005's port file and PROV009 land. Adapters (PROV004/005/010/011/016/029) wire the suites in their own test folders when this lands. One file per fake/suite.

## 14. Open questions and assumptions

- ASSUMPTION: TEST003's harness exposes a `runContract(name, factory, cases)` helper; if its shape differs the suites adapt in one adapter file.
- Open: whether the SQLite repository suite run belongs to DATA's harness (TEST003) or to PROV020; default: PROV020 imports the suite.
