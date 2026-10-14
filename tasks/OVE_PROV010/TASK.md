---
id: OVE_PROV010
title: Implement the CLI ModelProvider base and the Claude Code profile and provider
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH012, OVE_PROV001, OVE_PROV009, OVE_PROV015, OVE_PROV020, OVE_PROV027, OVE_PROV029, OVE_PROV034, OVE_TEST006]
soft_depends_on: [OVE_PROV013, OVE_PROV014, OVE_PROV017, OVE_TEST006]
provides: ["adapter:CliModelProvider", "adapter:ClaudeProvider", "lib:claude-cli-profile"]
needs: ["port:ModelProvider", "port:AgentSessionGateway", "usecase:StartAgentSession", "contract:CliProfile", "usecase:VerifyTurnOutcome", "port:TextCompletion", "port:Sandbox", "lib:fake-cli-scenarios", "port:Clock", "port:Logger", "lib:redaction", "port:ConnectionRepository", "usecase:EnsureAgentEnvironment"]
owns:
  - packages/adapters/providers/package.json
  - packages/adapters/providers/tsconfig.json
  - packages/adapters/providers/src/cli/**
  - packages/adapters/providers/src/claude/**
  - docs/providers/claude-cli.md
reads: ["docs/research/prototyp-wnioski.md", "tools/fake-cli/", "packages/application/src/ports/ModelProvider.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15", "SPECIFICATION 17"]
adr_refs: [7, 22, 26, 27]
---

# OVE_PROV010: Implement the CLI ModelProvider base and the Claude Code profile and provider

## 1. Summary

Create the `providers` adapter package with the generic `CliModelProvider` (the `ModelProvider` implementation shared by all CLIs: `invoke`, `stream`, `cancel`, `health`, `usage`, `capabilities`) and the first concrete CLI: Claude Code. The provider sends the instruction to the Agent's live session through the gateway, follows its state and replies, and reports a result whose completion is verified, never taken from the `done` hint alone.

## 2. Context

Spec 9, ADR 0022: Claude Code runs as the official CLI in herdr inside the container; the Owner logs in himself; Overmind sees no tokens. Prototype: Claude Code 2.1.296 works inside the Apple container with a subscription login (paste-code login); auto mode is the default permission mode; `herdr agent prompt` returned a false `done` on an expired login and a choice dialog; with auto mode off a real permission dialog appeared with a diff. The `ModelProvider` port and capability model are PROV001; session start is PROV027, delivery PROV029/PROV008, completion checks PROV015, dialogs PROV013, login PROV014, usage PROV017.

## 3. Scope (in)

- `CliModelProvider` generic class configured by a `CliProfile` (PROV034).
- The Claude profile: launch spec, environment, resume form, interrupt key, login methods, probes, skills target, static capabilities and model list, `verifiedAgainst`.
- `TextCompletion` implementation for Claude using the profile's `textOnly` launch.
- Capture of real screen fixtures (redacted) for TEST006.
- Documentation `docs/providers/claude-cli.md`.

## 4. Out of scope

- Codex (PROV011), Ollama (PROV016), session start (PROV027), guard (PROV008), dialog answering (PROV013), login handling (PROV014), usage parsing (PROV017), fallback (PROV018), registry composition (PROV026).

## 5. Detailed requirements

1. **Capabilities (static):** `{ providerId: 'claude', kind: 'cli', streaming: true, tools: true, shell: true, fileEdit: true, structuredOutput: 'json', images: false, cancel: 'hard', resume: true, requiresSandbox: true, reportsLimits: true, models }`. `structuredOutput: 'json'` means the instruction asks for JSON and the provider extracts and validates it; `schema` is not claimed. Models: aliases from the profile table (ASSUMPTION: `opus`, `sonnet`, `haiku` with tiers strong/balanced/fast) refreshed by PROV022 detection from what the CLI reports.
2. **Profile (`claude/profile.ts`):** `binary: 'claude'`; `launch({ model, resume })` returns `argv: ['claude', '--model', <modelId>]` (and `['claude', '--resume', <sessionId>, '--model', <modelId>]` when resuming); `env`: `DISABLE_AUTOUPDATER=1`, telemetry and non-essential traffic disabled through the CLI's documented variables (exact names recorded from the spike, ASSUMPTION: `DISABLE_TELEMETRY=1`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, `DISABLE_ERROR_REPORTING=1`), `LANG=C.UTF-8`; no bypass flags (denied by PROV034). `interruptKey: 'esc'`; `configDir: '/creds/claude'`; `skills: { dir: '/creds/claude/skills' }`; `login: { methods: ['paste_code'], startArgv: ['claude'] }` (login happens in the CLI UI via `/login`, performed by the Owner); `probes: { version: ['claude','--version'], usage: { slash: '/usage' } }`; `textOnly`: one-shot print mode with tools disabled (ASSUMPTION: `claude -p --output-format text` plus the CLI's documented option that disables all tools; the exact flags are verified in the spike and recorded; if tools cannot be disabled the `textOnly` entry is omitted and `TextCompletion` returns `provider.capability_missing`).
3. **Spike step (part of this task, real evidence, SPEC 19.5):** run the pinned Claude Code version in an Environment, capture: version banner, the launch command lines that work, the exact environment variables that stop writes to `$HOME` (smoke test of BOX005), login-expired screen, choice-dialog screen, permission dialog with diff, rate-limit screen, and the print-mode behaviour with tools disabled; store redacted fixtures under `tools/fake-cli/screens/claude/` through the TEST006 conventions and write the findings into `docs/providers/claude-cli.md`. `verifiedAgainst` records version and date.
4. **invoke(req):** (a) `checkRequirements` (PROV001) then `model` must belong to this provider; (b) snapshot the session, start one through `StartAgentSession` when `hasSession` is false (the provider never builds an Environment itself); (c) `AgentSessionGateway.sendPrompt({ kind: 'task', text: req.instruction, idempotencyKey: 'inv:' + invocationId })`; (d) follow observations and replies until a terminal outcome per requirement 5; (e) return `InvokeResult { status, text, structured?, evidenceRefs, usageDelta, stateHint }`. A send that ends in `provider.delivery_unknown` is returned as that error, never retried (`idempotent: false` default, PROV001 req. 8).
5. **Outcome rules:** `completed` only when the completion tracker (PROV015) reports `finished` (a "done" report from the Skill or an idle observation after observed work) AND `VerifyTurnOutcome` found no contradiction (login error, choice dialog, rate limit, no effect for a task that expects one). `needs_login` -> `Err(provider.needs_login)` plus event; `rate_limited` -> `Err(provider.limit_reached)` plus the `limit_reached` event (PROV018 reacts); `waiting_approval` -> `approval_needed` event and the invocation stays pending (PROV013 creates the Approval); timeout (`req.timeoutMs`) -> `Err(provider.timeout)` with the session left as is and no resend; `stopped` -> `Err(provider.unavailable)`.
6. **stream(req):** same flow yielding `started`, `state` (from observations), `output` (reply chunks, redacted, at most 8 KiB each), `approval_needed`, `needs_login`, `limit_reached`, then `done` or `error` last (PROV001 req. 7). It never throws.
7. **cancel(handle):** `AgentSessionGateway.interrupt` when `working`; after a 3 s grace without an idle observation `AgentSessionGateway.stop` (hard cancel); returns `provider.cancelled` for the pending invocation; the Environment stays.
8. **health():** reads the Connection (PROV020 repo) and the last detection; maps to `{ status: 'ready'|'needs_login'|'unavailable'|'limit_reached', version, models, needsLogin }`; never starts a session just to check.
9. **usage(q):** delegates to `ProviderUsage` (PROV017) and labels the source `per_cli`.
10. **textOnly (TextCompletion):** `complete(req)` runs the profile's `textOnly` launch as a one-shot exec through `Sandbox.exec` in the Agent's Environment (prompt on stdin, `cwd /work`, timeout, `maxOutputBytes`), tools disabled, output size capped, result marked untrusted; refuses when the Connection needs login (`provider.needs_login`) and never opens an interactive session.
11. **Logging:** provider events log ids, durations, state classes; never instruction text, screens or replies.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ModelProvider`, capabilities, errors (PROV001), `AgentSessionGateway` (PROV009/PROV029), `StartAgentSession` (PROV027), `CliProfile` and validator (PROV034), `VerifyTurnOutcome` and completion tracker (PROV015), `fake-claude` (TEST006), redactor. Nothing herdr-specific may be imported here (the provider only sees the gateway).

## 8. Architecture and code placement

`packages/adapters/providers/src/cli/{cli-model-provider.ts,invocation.ts,event-mapper.ts,text-completion.ts}` (generic) and `src/claude/{profile.ts,capabilities.ts,index.ts}`. Adapter layer: depends on application ports and contracts only; the Codex provider (PROV011) imports `cli/` but not `claude/` (adapters-within-package separation by folder, no cross imports). SRP: invocation state machine, event mapping and text completion are separate files; profiles are data.

## 9. Security and safety

Instruction text is data assembled by the caller (SEC004) and treated as opaque; the provider adds nothing to it (no Owner Rules, no permissions). Launch arguments come only from the validated profile; the model id is a single argv element. Credentials stay in `/creds/claude` and are never read, logged or passed anywhere (ADR 0022); only exit and state information crosses. Replies and screens are untrusted and redacted. The provider cannot change permissions, working directory (`/work` fixed) or environment beyond the profile. A hostile repository that prints "login expired" or a fake dialog only produces conservative states, never actions. Fail closed when the Connection or isolation is missing. No automatic resend after timeout (Spec 9).

## 10. Errors and edge cases

- Login expires mid-run: observation `needs_login` becomes `provider.needs_login`; the node waits and the Owner is notified (PROV014); no resend after re-login unless the caller decides.
- Subscription limit reached: `provider.limit_reached` with `resetsAtText` copied verbatim and bounded (PROV017), fallback decided by PROV018.
- CLI choice dialog on first run ("Set up auto mode..."): state `selection_prompt` is treated as blocked; the provider reports `invalid_state` for the invocation and raises an Escalation request path via PROV013; never answered blindly.
- Instruction larger than 200 KiB: rejected by schema (PROV001).
- Two invocations for one Agent: serialised by the guard; the second gets `provider.busy`.
- Print mode with tools unavailable: `TextCompletion` unavailable, callers fall back to another provider (PROV031/032 config).

## 11. Acceptance criteria

- [ ] With `fake-claude` scenarios, `invoke` completes a simple task, returns `completed` only after verification, and `stream` event order is `started ... done`.
- [ ] Scenario `login_expired` with a herdr `done` hint yields `provider.needs_login`, never `completed`.
- [ ] Scenario `choice_dialog` yields a blocked outcome with no keystrokes sent.
- [ ] Scenario `rate_limit` yields `provider.limit_reached` and the event.
- [ ] Timeout yields `provider.timeout` with exactly one send attempt.
- [ ] `cancel` interrupts then stops after the grace period.
- [ ] Profile passes `validateLaunchSpec`; a test proves no bypass flag or secret env is present.
- [ ] Spike evidence document and redacted fixtures exist with CLI version and date.
- [ ] `ModelProvider.contract` suite passes (PROV024).

## 12. Test plan

Unit: invocation state machine, event mapper, profile launch table, text completion argv/stdin. Integration with `FakeHerdr` + `fake-claude` (TEST006/TEST009). Contract suite (PROV024). One opt-in real test tagged `real-cli` for the Owner's machine. Command: `pnpm vitest run packages/adapters/providers/src/cli packages/adapters/providers/src/claude`.

## 13. Parallelization notes

Creates the `providers` package; PROV011 and PROV016 add folders in the same package after this lands (package files owned here, one-time). Hotspot: `package.json` (PROV011/016 propose additions via `tasks/_proposals/`).

## 14. Open questions and assumptions

- ASSUMPTION: model aliases and variables above; the spike corrects them.
- ASSUMPTION: Claude Code's default auto mode is used; no `--permission-mode` flag is passed. Owner decision pending on whether to allow a stricter mode (more CLI dialogs, more Approvals).
- Open: whether print mode can disable all tools; otherwise Discussion and summaries use another provider or Ollama.
