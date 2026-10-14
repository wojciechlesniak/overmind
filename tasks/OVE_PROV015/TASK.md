---
id: OVE_PROV015
title: Detect false completion and expired login by verifying every turn (VerifyTurnOutcome)
area: PROV
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT014, OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_ENGINE016, OVE_PROV006, OVE_PROV009, OVE_PROV019]
soft_depends_on: [OVE_PROV008, OVE_BOX010]
provides: ["usecase:VerifyTurnOutcome", "lib:completion-tracker", "port:EffectProbe"]
needs: ["event:agent.report.received", "port:Sandbox", "port:Clock", "port:EventBus", "port:AuditSink", "lib:redaction", "port:AgentSessionGateway", "contract:ProvConfig"]
owns:
  - packages/application/src/prov/verify/**
  - packages/application/src/ports/EffectProbe.ts
  - packages/adapters/sandbox-macos/src/effect-probe/**
  - tasks/_proposals/OVE_PROV015-invoke-expects.md
reads: ["docs/research/prototyp-wnioski.md", "packages/domain/src/prov/terminal-state/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15", "SPECIFICATION 7"]
adr_refs: [22, 26, 27]
---

# OVE_PROV015: Detect false completion and expired login by verifying every turn (VerifyTurnOutcome)

## 1. Summary

herdr said `done` while the file was never created because the login had expired and a choice dialog blocked Claude. This task builds the completion tracker and the verifier that decide whether a turn really finished: the CLI state is only a hint, so a turn is complete only after a Skill report or a checked effect, and any login, dialog, limit or "nothing happened" evidence overrides `done`.

## 2. Context

Prototype 5A: `agent prompt --wait` returned `done`; screens showed `401 OAuth access token has expired, please run /login` and the "Set up auto mode" dialog. Codex went `done` without any command. Spec 9 and ADR 0026: a Task moves on only after verifying the effect or a report from the Skill "overmind"; the report is a declaration, not proof (ADR 0027), and Quality Gates need real evidence (Spec 7). `agent.report.received` events come from AGENT014. The terminal observations come from PROV005/PROV006.

## 3. Scope (in)

- `CompletionTracker`: per invocation state machine combining observations, reports and replies.
- `VerifyTurnOutcome` use case with a fixed list of checks and typed verdicts.
- `EffectProbe` port plus a safe, read-only sandbox implementation (existence of paths, `git status` summary).
- Events and audit for contradicted completions.

## 4. Out of scope

- Quality Gate evaluation and test evidence (WFRT), Run status changes (WFRT), login handling (PROV014), dialog handling (PROV013), limit switching (PROV018), unknown delivery resolution policy (callers; this task only supplies the evidence check `checkDeliveryEffect`).

## 5. Detailed requirements

1. **Tracker input:** `{ invocationId, agentId, runId?, sentAt, expects: { kind: 'reply'|'effects'|'json'; probes?: EffectProbeSpec[]; schemaId?: string } }` plus streams: observations, `agent.report.received` events for the Agent and Run, reply chunks. Output stream: `TurnPhase = 'sent'|'working'|'finishing'|'finished'|'blocked'|'failed'`.
2. **Work evidence:** a turn is considered to have started only after an observation `working` (two samples) or a Skill report `started/progress` after `sentAt`. Without it, a later `done`/`idle` is `no_work_observed` (the Codex "done without any command" case) and the verdict is `not_finished` until a configurable timeout (`prov.noWorkTimeoutMs`, default 20 s) after which it is `failed(no_effect)`.
3. **Finish evidence (any of):** (a) a `done` report for this invocation or Task; (b) observation `idle` or `done_unclaimed` after `working` with a stable screen for 2 samples (hint only); both still go through step 4.
4. **Contradiction scan (always, before any verdict `finished`):** read the screen tail once more (through `AgentSessionGateway.snapshot` evidence, not a new terminal call) and classify with PROV006. `needs_login` -> `contradicted('needs_login')`; `selection_prompt` -> `contradicted('selection_prompt')`; `rate_limited` -> `contradicted('limit_reached')`; `waiting_approval` -> `blocked('approval')`. A report `done` does not override these: login expiry after the report means the CLI cannot continue but the declared result stays recorded as a declaration.
5. **Effect checks (`expects.kind === 'effects'`):** each `EffectProbeSpec` is one of `path_exists { relPath }`, `path_changed_since { relPath, sinceIso }` (mtime), `git_dirty { }` (worktree has uncommitted changes), `git_new_commits { sinceSha }`, `file_hash { relPath, sha256 }`. Probes run through `EffectProbe`, which executes fixed argv in the Environment (`test -e`, `stat`, `git -C /work ...` with the hardened git options, `sha256sum`) with paths validated to be relative, without `..`, inside `/work` (lexical check, and the in-container `realpath` must still start with `/work/`). No probe reads file contents except `sha256sum`; outputs are bounded to 4 KiB. All probes passing gives `verified`; some failing gives `failed(no_effect)` with the failing probe names (not contents).
6. **Reply and JSON expectations:** `reply`: non-empty redacted reply text after the send, otherwise `failed(no_reply)`; `json`: the final reply contains one JSON object that validates against `schemaId`; extraction takes the last fenced or balanced object, size cap 256 KiB; invalid JSON is `failed(output_invalid)` (the repair loop is a WFRT concern, WFRT019).
7. **Verdicts:** `VerifyTurnOutcome.execute(input): Result<Verdict>` with `Verdict = { status: 'verified'|'unverified'|'not_finished'|'blocked'|'contradicted'|'failed'; reason?: 'needs_login'|'selection_prompt'|'limit_reached'|'approval'|'no_work_observed'|'no_effect'|'no_reply'|'output_invalid'; evidence: Evidence[] (<=5, PROV006 type); declaredByReport: boolean }`. `unverified` means finished by hint or report with `expects.kind==='reply'` and non-empty reply (acceptable for answers) but nothing else; for `effects` expectations `unverified` is not allowed and becomes `failed(no_effect)`.
8. **Events:** `provider.turn_verified`, `provider.turn_contradicted { reason }` (persisted, ids and reason only), consumed by AGENT010 (state signals) and PROV014/PROV018 through the gateway's `BlockedStateHandler` hook.
9. **checkDeliveryEffect(deliveryId, probes):** helper used to resolve `delivery_unknown` (PROV008): probes plus a screen check for the echoed prompt; returns `confirmed_delivered|confirmed_not_delivered|inconclusive`. Inconclusive means "do not resend" and an Escalation by the caller.
10. **No side effects on the terminal:** verification never types into the CLI.
11. **Budget:** at most 3 probe execs per second per Environment, each timeout 5 s; probe failure (exec error) is `unverified`, never `verified`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`classify`, `TerminalObservation`, `Evidence` (PROV006), `AgentSessionGateway` (PROV009), `agent.report.received` (AGENT014), `Sandbox.exec` (BOX010) through `EffectProbe`, hardened git options of BOX014 (import the constant, do not copy), redactor.

## 8. Architecture and code placement

Application: `packages/application/src/prov/verify/{completion-tracker.ts,verify-turn-outcome.ts,verdict.ts,json-extract.ts,delivery-effect.ts}`; port `packages/application/src/ports/EffectProbe.ts`; adapter `packages/adapters/sandbox-macos/src/effect-probe/{effect-probe.ts,probe-argv.ts}` (the only place building probe argv, platform code stays in the macOS adapter). Dependencies point inward; the tracker is pure over injected streams and a clock.

## 9. Security and safety

This is the defence against false completion, so it errs towards not finished: ambiguous screens and probe failures never produce `verified`. All screen text is untrusted: a README quoting `please run /login` cannot produce a contradiction (PROV006 position rules) and a fake "done" print cannot produce `verified` for effect expectations. Probe paths are validated lexically and in the Environment (symlink escape out of `/work` is refused); probes are read-only and never accept a command string from an Agent; probe specs come from the workflow definition or Chief, not from CLI output. Reports are declarations: `declaredByReport` is informational and never raises a verdict above what evidence supports for `effects`. Audit events carry ids and reasons only.

## 10. Errors and edge cases

- Report says done but the file is missing: `failed(no_effect)` with `declaredByReport: true` (the discrepancy is shown to Chief).
- Login expires after a correct report: verdict stays `verified` for the finished work; the next send is blocked by the guard.
- CLI prints the finished text and immediately a choice dialog: `contradicted('selection_prompt')`.
- Long-running tasks with no output for minutes: tracker stays `working` as long as the process is alive and the screen changes; stall detection (no change for `stallMs`, default 300 s) emits `provider.turn_stalled` (no automatic action).
- Symlink `/work/out -> /etc`: `path_exists out/x` is refused by the in-container realpath check.
- Probe on a Workspace in direct mode (no git): `git_*` probes return `unsupported` and the verdict falls back to `unverified` with a visible reason.

## 11. Acceptance criteria

- [ ] Prototype fixture: herdr `done` + login-expired screen -> `contradicted('needs_login')`; `done` + auto-mode dialog -> `contradicted('selection_prompt')`.
- [ ] Codex scenario `done_without_command` -> `failed(no_effect)` after the timeout, never `verified`.
- [ ] A `done` report with a missing expected file -> `failed(no_effect)` and `declaredByReport: true`.
- [ ] `expects.kind === 'effects'` with passing probes -> `verified`; with an exec error -> `unverified` turned into `failed(no_effect)`.
- [ ] Probe paths with `..`, absolute paths or symlink escape are refused with no exec of the target.
- [ ] README quoting `please run /login` in old scrollback does not contradict a finished turn.
- [ ] Verification sends nothing to the terminal (fake records zero sends).

## 12. Test plan

Table tests over (report x observations x screen x probes); fixtures from `tools/fake-cli/screens` and the prototype texts; fault tests for probe timeouts; symlink fixtures in an integration test with `FakeSandbox`. Commands: `pnpm vitest run packages/application/src/prov/verify packages/adapters/sandbox-macos/src/effect-probe`.

## 13. Parallelization notes

Only needs PROV006/PROV009 types; PROV010/PROV011/PROV030 consume `VerifyTurnOutcome`. The `effect-probe` folder lives in the sandbox adapter package but is owned by this task (no BOX task owns it). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: effect probes are requested by the caller (workflow node or Chief) through `expects`; the default for Agent nodes with an output schema is `json`, for open tasks `reply` (declared in WFRT019 requirements; additive `evidence` field on the request is proposed in `tasks/_proposals/OVE_PROV015-invoke-expects.md`).
- Open: Quality Gate evidence (tests, scans) is collected by WFRT/TEST, not by these probes.
