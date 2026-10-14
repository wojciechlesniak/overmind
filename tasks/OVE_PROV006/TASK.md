---
id: OVE_PROV006
title: Define TerminalState and the state classifier (herdr hint plus screen evidence)
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_PROV001, OVE_TEST006]
soft_depends_on: [OVE_TEST006]
provides: ["contract:TerminalState", "contract:TerminalObservation", "lib:agent-state-classifier"]
needs: ["lib:redaction", "lib:fake-cli-scenarios"]
owns:
  - packages/contracts/src/terminal-state/**
  - packages/domain/src/prov/terminal-state/**
reads: ["docs/research/prototyp-wnioski.md", "tools/fake-cli/screens/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15", "SPECIFICATION 16"]
adr_refs: [22, 26]
---

# OVE_PROV006: Define TerminalState and the state classifier (herdr hint plus screen evidence)

## 1. Summary

Define Overmind's own `TerminalState` vocabulary (pending, working, waiting for approval, idle, done unclaimed, needs login, selection prompt, rate limited, stopped, unknown) and a pure classifier that combines herdr's reported state with what is actually visible on the terminal screen, returning a state, evidence and an explicit "hint, not proof" marker. This fixes the prototype failures: herdr said `done` while Claude showed `401 OAuth access token has expired` and a choice dialog.

## 2. Context

Prototype section 5A: herdr's `blocked` appears reliably only for real permission dialogs showing a diff; it missed the login error (`401 ... please run /login`) and the "Set up auto mode for your environment?" dialog and reported `done` although no file was created; Codex went `done` without any command. herdr's states: idle, working, blocked, done (fifth state), unknown. Glossary addition: `done` = finished, result not yet collected. ADR 0026: Overmind adds its own rules for "needs login" and "CLI choice dialog". Screens come from `pane.read` and are untrusted text (a malicious file may make the CLI print anything).

## 3. Scope (in)

- Contract `TerminalState` and `TerminalObservation`.
- Pure classifier with pluggable detector rules (data-driven profiles per CLI).
- Evidence model with redacted excerpts.
- Fixtures from the prototype screens.

## 4. Out of scope

- Reading the pane (PROV005), herdr-side detection rule files (PROV007), turning states into actions (PROV008, PROV013, PROV014), completion verification (PROV015).

## 5. Detailed requirements

1. **Contract:** `TerminalState = 'pending'|'working'|'waiting_approval'|'idle'|'done_unclaimed'|'needs_login'|'selection_prompt'|'rate_limited'|'stopped'|'unknown'` (open enum). `TerminalObservation = { agentId, state, hint: true, confidence: 'high'|'medium'|'low', evidence: Evidence[], herdrState?: string, observedAt }`, `Evidence = { source: 'herdr'|'screen'|'title'|'report'|'process', rule?: string, excerpt?: string /* redacted, max 200 chars */, excerptHash: string }`. The literal `hint: true` is part of the type: no consumer may treat it as completion proof (ADR 0026; Quality Gates need real evidence).
2. **Classifier input:** `{ herdrState?: 'idle'|'working'|'blocked'|'done'|'unknown', screenTail: string[] /* last N=60 lines, ANSI stripped */, title?: string, profile: CliProfileId, lastOutputAt?, processAlive: boolean, now }`. Pure function `classify(input, rules): TerminalObservation`.
3. **Precedence (highest first):** `stopped` (process not alive) > `needs_login` (login-expired screen rule) > `rate_limited` (limit screen rule) > `selection_prompt` (numbered choice dialog without an action diff) > `waiting_approval` (permission dialog with action text and options, also when herdr says `blocked`) > `working` > `done_unclaimed` (herdr `done`) > `idle` > `pending` (started, no prompt yet) > `unknown`. Screen-derived `needs_login`/`selection_prompt`/`rate_limited` override a herdr `done` or `idle` (the prototype bug). A herdr `blocked` with no matching permission dialog on screen is classified `waiting_approval` with `confidence: 'low'` and evidence noting the mismatch (never silently `working`).
4. **Rule profiles:** data objects per CLI (`claude`, `codex`) listing regexes with ids, applied to the screen tail: e.g. `claude.login_expired` matches `/401.*OAuth.*(expired|invalid)|please run \/login|Invalid API key/i`; `claude.choice_dialog` matches a title line ending with `?` followed by 2+ lines starting with `^\s*[❯>]?\s*\d+[.)]\s`; `claude.permission_prompt` matches `Do you want to (make this edit|proceed|run)` plus options `1. Yes`/`3. No`; `codex.login_required` matches `Sign in with ChatGPT|Device Code|not logged in`; `rate_limit` matches `usage limit|hit your .* limit|Resets? (in|at)`. Rules live in `packages/domain/src/prov/terminal-state/profiles/*.profile.ts`, versioned with the CLI version they were captured from (comment header), and are extended by adding a profile (OCP). Regexes are bounded (no catastrophic backtracking: tested with a ReDoS fuzz).
5. **Stale screens:** the classifier considers only the last 60 lines and requires the matched dialog to be near the bottom (within the last 15 lines) so old scrollback text (for example a README that quotes `please run /login`) does not trigger. A rule can additionally require "no prompt line after the match".
6. **Prompt-injection stance:** matched text is evidence only. The classifier cannot trigger actions; a file whose contents print `1. Yes` cannot cause approval because answering dialogs is a separate, gated use case (PROV013). False positives result in a state of `waiting_approval`/`selection_prompt`, which is the safe direction (commands are withheld).
7. **Hysteresis:** the observer (PROV005) applies a 2-sample debounce for transitions into `working`/`idle`; the classifier itself is stateless.
8. **Evidence excerpts:** at most the matched line, redacted (SEC003 redactor) and truncated to 200 chars; `excerptHash` = sha256 of the unredacted matched line, so repeated identical screens deduplicate without storing text.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Redactor (ARCH004/SEC003), screen fixtures from TEST006 (`tools/fake-cli/screens/*`), CLI profile ids (PROV010). No duplicate regexes elsewhere: PROV014/PROV013 import these rule ids.

## 8. Architecture and code placement

Contracts `packages/contracts/src/terminal-state/terminal-state.schema.ts`; domain `packages/domain/src/prov/terminal-state/{classify.ts,precedence.ts,evidence.ts,profiles/claude.profile.ts,profiles/codex.profile.ts,profiles/common.profile.ts}`. Domain code has no I/O; AGENT maps the observation to its own `AgentSignal`/`AgentStateHint` (AGENT009); the user-facing `AgentState` is defined by AGENT001.

## 9. Security and safety

This classifier gates command delivery (never send into a waiting dialog) and login handling, so wrong "idle" is the dangerous error. Design is asymmetric: ambiguous screens classify towards `waiting_approval`/`selection_prompt`/`unknown`, which block delivery. Untrusted screen text cannot execute anything. ReDoS-safe regexes, size-capped inputs (screen tail bounded at 60 lines x 400 chars), redacted evidence. Hints are never stored as completion.

## 10. Errors and edge cases

- Wide characters, ANSI escapes, carriage-return redraws: input is normalised by PROV005 before; the classifier also strips residual ANSI.
- CLI language other than English: rules miss, state falls back to herdr state with `confidence: 'low'`; open item logged.
- CLI version upgrade changes wording: profile version mismatch is reported by PROV022 detection (warning), rules updated by PR with new fixtures.
- Multiple dialogs stacked: the bottom-most wins.
- Empty screen (just cleared): `pending` if process alive and no prompt yet, else `unknown`.

## 11. Acceptance criteria

- [ ] Prototype fixtures: login-expired screen with herdr `done` -> `needs_login`; auto-mode choice dialog with herdr `done` -> `selection_prompt`; permission dialog with diff and herdr `blocked` -> `waiting_approval`; rate-limit text -> `rate_limited`.
- [ ] A README quoting `please run /login` in old scrollback does not produce `needs_login` (position rule test).
- [ ] herdr `blocked` without a dialog yields `waiting_approval`, low confidence.
- [ ] All outputs have `hint: true`; excerpts are redacted and at most 200 chars.
- [ ] ReDoS fuzz test passes within time budget on 1 MiB adversarial input (tail-capped).
- [ ] Precedence table tests cover all pairwise overrides.

## 12. Test plan

Table-driven unit tests with fixtures copied from `tools/fake-cli/screens` and prototype texts; property test: classification is total (never throws) and deterministic; ReDoS fuzz. Commands: `pnpm vitest run packages/domain/src/prov/terminal-state packages/contracts/src/terminal-state`.

## 13. Parallelization notes

Parallel with PROV004. PROV005, 007, 008, 013, 014, 015 import it. Profiles are one file per CLI so edits do not conflict.

## 14. Open questions and assumptions

- ASSUMPTION: this contract describes the terminal only. The glossary "Agent state" (`contract:AgentState`) is owned by AGENT001; AGENT009 maps TerminalObservation into it as a hint.
- Open: Polish or other-language CLI UIs (not supported in MVP; prompts forced to English by `LANG=C.UTF-8` in the image).
