---
id: OVE_PROV031
title: Implement the DiscussionTurnRunner adapter with tool-free text-only turns
area: PROV
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_DISC003, OVE_ENGINE016, OVE_PAUSE001, OVE_PROV010, OVE_PROV016, OVE_PROV017, OVE_PROV025, OVE_PROV034]
soft_depends_on: [OVE_PROV011, OVE_PROV017, OVE_PROV027]
provides: ["adapter:DiscussionTurnRunner"]
needs: ["port:DiscussionTurnRunner", "port:TextCompletion", "usecase:ResolveModelForAgent", "usecase:RecordModelUsage", "port:ChiefConfigReader", "port:PauseState", "port:Clock", "port:IdGenerator", "port:AuditSink", "lib:redaction"]
owns:
  - packages/application/src/prov/discussion-turn/**
  - tasks/_proposals/OVE_PROV031-scratch-environment.md
reads: ["tasks/OVE_DISC003/TASK.md", "packages/application/src/ports/DiscussionTurnRunner.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 9"]
adr_refs: [7, 15, 22]
---

# OVE_PROV031: Implement the DiscussionTurnRunner adapter with tool-free text-only turns

## 1. Summary

Discussions (Spec 6) need one text answer per participant per round, returned as raw text that the engine parses strictly. This adapter runs each turn as a tool-free `TextCompletion` on the participant Agent's model (or the Chief's model for moderator and ruling turns), under the Agent's own provider and the same isolation, without opening an interactive CLI session, without tools and without any permission grants.

## 2. Context

DISC003 defines the seam: `runTurn({ workspaceId, discussionId, participantId: 'chief'|AgentId, turnKind: 'moderator'|'participant'|'ruling', prompt: AssembledPrompt, outputSchemaId, timeoutMs, limits: { maxOutputChars, maxTokens? }, idempotencyKey })` returning `TurnResult { rawText, usage { inputTokens?, outputTokens?, costUnits?, modelRef }, finishedReason: 'stop'|'length'|'cancelled' }` and `cancel(idempotencyKey)`. The adapter "MUST run the Agent in isolation under the Agent's own Effective Permissions (a Discussion turn grants nothing) and, ASSUMPTION, without tools". The text completion port is PROV034; CLI providers implement it with one-shot print mode (PROV010/PROV011), Ollama over HTTP (PROV016). Discussion output is untrusted: the engine parses it with the strict `ProposalParser` (SEC004).

## 3. Scope (in)

- `DefaultDiscussionTurnRunner` implementing the DISC port.
- Model selection for participants and Chief, capability and Connection checks.
- Timeouts, cancellation, idempotency cache, usage recording.

## 4. Out of scope

- Discussion rounds, parsing, outcomes (DISC), prompt assembly (SEC004), the CLI one-shot implementation (PROV010/PROV011), interactive Agent sessions for Discussions (not used; Agents answer as models, not as tool-using workers).

## 5. Detailed requirements

1. **Model resolution:** for `AgentId` participants `ResolveModelForAgent({ agent: { id }, runId: undefined, mode: 'runtime', requires: [] })`; for `'chief'` the provider/model from `ChiefConfigReader.get()` validated the same way. Errors map to the DISC error vocabulary by returning the provider error (`provider.needs_login`, `provider.limit_reached`, ...); DISC maps them to `moderator_unavailable` or turn failure (DISC003 error table).
2. **Completion:** `TextCompletion.complete({ providerId, modelId, workspaceId, agentId, purpose: 'discussion_turn', prompt: prompt.text, timeoutMs, maxOutputChars: limits.maxOutputChars })`; `finishedReason` is `length` when `truncated` is true, else `stop`. The raw text is returned untrusted; nothing is parsed here.
3. **Tool-free guarantee:** only `TextCompletion` is used; if the chosen provider cannot guarantee tool-free operation (`provider.capability_missing`) the turn fails with that error rather than falling back to an interactive session. No Agent token is minted, no concurrency slot is taken (tool-free calls are bounded by the provider queue and the turn timeout), no Skill is installed, no herdr terminal is used.
4. **Environment for CLI providers:** CLI one-shot calls need an Environment; the adapter obtains it through `EnsureAgentEnvironment` (`purpose: 'text_only'`, PROV027) for the participant's Workspace. Known limitation: that Environment mounts the Workspace plan (BOX007 rejects empty plans), so the model could read files if tool disabling failed; the proposal `tasks/_proposals/OVE_PROV031-scratch-environment.md` asks BOX for a mount-less "scratch" Environment kind for text-only calls, and until then the CLI profile's `textOnly` launch is the control (PROV010/PROV011 verify with a negative test that file tools are unavailable).
5. **Cancel and timeout:** `cancel(idempotencyKey)` aborts the in-flight completion (`AbortSignal`); the turn returns `provider.cancelled`; timeout returns `provider.timeout`; no resend.
6. **Idempotency:** an in-memory LRU (200 entries, 10 min) maps `idempotencyKey` to the stored `TurnResult` or the in-flight promise; a repeat returns it without calling the model again (the engine's own persistence of outcomes is DISC's). After engine restart the cache is empty and DISC handles re-run per its rules (the key encodes attempt number, `dsc:<id>:r<n>:<participant>:<attempt>`).
7. **Usage:** `RecordModelUsage` with `source` of the provider (`per_cli`/`ollama_local`), `agentId`, no run id; `usage.modelRef` = `providerId:modelId`; token figures only if reported.
8. **Limits and sizes:** prompt <= 200 KiB, `maxOutputChars` honoured with hard truncation, `timeoutMs` 5 s..300 s; concurrency per provider capped by the provider (Ollama 2, CLI one-shot 3 per Connection: queue then `provider.busy`).
9. **Pause:** while paused, return `prov.paused` (Discussions pause with the Run).
10. **Audit:** `provider.discussion_turn { discussionId, participantId, providerId, outcome }`; no text.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`TextCompletion` (PROV034), CLI one-shot (PROV010/011), Ollama (PROV016), `ResolveModelForAgent` (PROV025), `EnsureAgentEnvironment` (PROV027), `RecordModelUsage` (PROV017), the DISC port types (DISC003), redactor.

## 8. Architecture and code placement

`packages/application/src/prov/discussion-turn/{default-discussion-turn-runner.ts,idempotency-cache.ts,model-for-participant.ts}`. Application layer over ports; implements the port owned by DISC003 (not edited). Registered in the provider module (PROV026).

## 9. Security and safety

Discussion content comes from repositories, documents and other Agents (untrusted). The adapter keeps the turn tool-free (no shell, no file edit, no network beyond the provider), grants nothing, mints no token, and returns raw text that the engine treats as data; it cannot trigger approvals or permissions. A prompt-injected participant can only influence its own text. Output is size-capped and redacted before logging; instruction text is not logged. No automatic retry after timeout. Fail closed when no tool-free path exists.

## 10. Errors and edge cases

- Participant's provider needs login or is limited: provider error returned; DISC and Chief decide (fallback model through PROV018 resolution applies on the next attempt).
- Text-only mode unavailable for the CLI: `provider.capability_missing`; configuration may point Discussion turns at Ollama through the Agent's fallback.
- Output longer than the cap: truncated with `finishedReason: 'length'`.
- Same key replayed while the first call is in flight: both callers await the same promise.
- Chief config missing: `provider.not_found`.
- Engine restart mid-turn: the turn fails as cancelled; DISC re-runs with the next attempt number.

## 11. Acceptance criteria

- [ ] With fakes, a participant turn returns `rawText`, usage and `finishedReason: 'stop'`; a long output yields `length`.
- [ ] A repeated call with the same key calls the model once; `cancel` aborts and returns `provider.cancelled`.
- [ ] A provider without tool-free support fails the turn and no interactive session, token or slot is created (spies).
- [ ] Chief turns use the Chief's configured provider/model.
- [ ] While paused the adapter returns `prov.paused`.
- [ ] Logs and audit contain no prompt or output text.
- [ ] Passes the DISC `DiscussionTurnRunner` consumer-contract cases (parity with `FakeDiscussionTurnRunner` vocabulary).

## 12. Test plan

Unit tests with `FakeTextCompletion`; idempotency cache tests with `FakeClock`; negative tests for capability-missing and pause; parity tests against the DISC fake. Commands: `pnpm vitest run packages/application/src/prov/discussion-turn`.

## 13. Parallelization notes

Small and independent after PROV010/PROV016; consumers (DISC engine) already depend on the port. The scratch-Environment proposal is a cross-area gap for BOX.

## 14. Open questions and assumptions

- ASSUMPTION: Discussion participants answer as text-only models; they do not use their CLI tools during a Discussion (Spec 6: participants use their Skills as guidance in the prompt, not tools).
- Gap: `port:ChiefConfigReader` is needed to read the Chief's provider/model; CHIEF001 defines `ChiefConfig` but no reader port name is known.
