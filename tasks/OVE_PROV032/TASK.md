---
id: OVE_PROV032
title: Implement the tool-free SummariserModel adapter for Agent Memory
area: PROV
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ENGINE016, OVE_MEM003, OVE_PAUSE001, OVE_PROV010, OVE_PROV016, OVE_PROV017, OVE_PROV019, OVE_PROV025, OVE_PROV027, OVE_PROV034]
soft_depends_on: [OVE_PROV011, OVE_PROV017, OVE_PROV019]
provides: ["adapter:SummariserModel"]
needs: ["port:SummariserModel", "port:TextCompletion", "port:ProviderHealthReader", "usecase:RecordModelUsage", "usecase:EnsureAgentEnvironment", "contract:ProvConfig", "port:Clock", "port:AuditSink", "lib:redaction", "port:PauseState"]
owns:
  - packages/application/src/prov/summariser/**
reads: ["tasks/OVE_MEM003/TASK.md", "packages/application/src/ports/SummariserModel.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 10"]
adr_refs: [7, 14, 22]
---

# OVE_PROV032: Implement the tool-free SummariserModel adapter for Agent Memory

## 1. Summary

Agent Memory stores summaries of finished Tasks and compacts them over time (ADR 0014). The summariser is the most exposed component because it reads untrusted text (repository content, CLI output, other Agents). This adapter implements the MEM `SummariserModel` port on a model that cannot use tools, files or the network beyond its own provider call, with a deterministic model choice that prefers the local Ollama and never burns an Agent session.

## 2. Context

MEM003: `summarise(req: { prompt: AssembledPrompt, outputSchemaId: 'task_summary' | 'compaction', timeoutMs, limits: { maxOutputChars } }): Promise<Result<{ rawText, usage, modelRef }>>`; "the adapter MUST run tool-free with no file or network access and no permissions beyond the model call". The engine parses the raw text with a strict parser and checks the write guard (MEM007). `TextCompletion` (PROV034) is implemented by Ollama (host, loopback) and by CLI one-shot text-only mode (inside an Environment, provider hosts only). Summaries run in the background after Task completion and during compaction jobs, so they must be cheap and must not consume Agent slots or subscription limits unnecessarily.

## 3. Scope (in)

- `DefaultSummariserModel` implementing the MEM port.
- Deterministic model selection chain from `ProvConfig` and `ProviderHealthReader`.
- Limits, timeout, concurrency, usage recording, audit.

## 4. Out of scope

- What is summarised and written to memory (MEM), prompt assembly (SEC004), parsing and write guards (MEM), the completion implementations (PROV010/011/016).

## 5. Detailed requirements

1. **Model choice (`ProvConfig.summariserChain`, default `['ollama', 'fast_cli']`; ASSUMPTION):** (1) `ollama`: first available model of the Ollama Connection when healthy (`ProviderHealthReader.ready`), preferring a model named in config `summariserModelId` if present; (2) `fast_cli`: for each ready CLI Connection (not limited), the model with tier `fast` from its capabilities; (3) none ready: `Err(provider.unavailable)`; MEM keeps the item pending and retries later (it must not fail the Task). The chosen `modelRef` is returned in the result. An Owner-configured explicit `summariserProviderId/modelId` overrides the chain.
2. **Tool-free guarantee:** only `TextCompletion.complete({ purpose: 'summary'|'compaction' })` is used. A provider that cannot guarantee tool-free operation is skipped in the chain (never used interactively). No Agent session, no token, no Skill, no slot.
3. **Environment for CLI path:** needs an Environment: `EnsureAgentEnvironment({ purpose: 'text_only', workspaceId })` requires the Workspace; the request carries it as `AssembledPrompt.provenance`/`scope` metadata (ASSUMPTION: `req.prompt` exposes `workspaceId` through its manifest; if absent the CLI branch is skipped and only Ollama is used). Same scratch-Environment limitation and proposal as PROV031.
4. **Limits:** `timeoutMs` 5 s..300 s (default from MEM), `maxOutputChars` enforced by truncation (raw text beyond the limit is cut and the result flagged `truncated` in the audit, MEM's parser will reject incomplete JSON); prompt <= 200 KiB.
5. **Concurrency:** at most 2 summaries in parallel installation-wide (config `summariserMaxParallel`), queue 50, then `provider.busy` (MEM retries); summaries have the lowest priority and are paused while the limiter has queued Agent work for the same Connection (soft rule: yield to Agents).
6. **Usage:** `RecordModelUsage` with `purpose: 'summary'`, no run id, source per provider; tokens only if reported.
7. **Pause:** returns `prov.paused` during Global Pause (background work stops with Pause).
8. **Result sanity:** the adapter returns raw text exactly as produced (after redaction of secrets per SEC003 and stripping NUL); it does not fix JSON and does not interpret the content. MEM validates.
9. **Audit:** `provider.summary_generated { providerId, modelId, outcome, chars }`; no prompt or output text.
10. **No fallback to interactive:** if both chain entries fail, the error is returned; MEM decides about retry.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`TextCompletion` (PROV034), Ollama provider (PROV016), CLI text-only (PROV010/011), `ProviderHealthReader` (PROV025), `EnsureAgentEnvironment` (PROV027), `RecordModelUsage` (PROV017), `ProvConfig` (PROV019).

## 8. Architecture and code placement

`packages/application/src/prov/summariser/{default-summariser-model.ts,model-chain.ts,limits.ts}`. Application layer over ports; implements the port owned by MEM003 (not edited). Registered in PROV026.

## 9. Security and safety

The summariser reads the most untrusted text in the system. Controls: tool-free calls only; Ollama path never touches the Environment or network beyond loopback; CLI path runs one-shot with tools disabled inside the Environment and egress limited to provider hosts; no permission grants, no tokens, no session; output treated as data (cannot change memory without MEM's guard); redaction before logging; size caps; no automatic retry loops; Pause respected. A prompt-injected document can at worst produce a bad summary, which MEM's parser and write guard are designed to reject.

## 10. Errors and edge cases

- Ollama stops mid-summary: `provider.unavailable`, chain tries `fast_cli` for the next call, MEM retries.
- Both providers limited or not logged in: `provider.unavailable`; the Task is not failed.
- Output not JSON or too long: returned as is (truncated); MEM rejects and retries or records a failed summary.
- Hostile summary text with control characters: NUL stripped, redacted; others pass to MEM's sanitiser.
- Config sets a model that is not offered: `provider.not_found`, chain continues only when no explicit override is set.
- Many Tasks finish at once: bounded queue; overflow returns `provider.busy`.

## 11. Acceptance criteria

- [ ] With Ollama ready the summary uses Ollama and creates no Environment, token or session (spies).
- [ ] With Ollama down and a CLI ready, a fast-tier model is used through text-only mode; with none ready the error is `provider.unavailable`.
- [ ] A provider without tool-free support is skipped and never used interactively.
- [ ] Output beyond `maxOutputChars` is truncated; concurrency cap and queue limits hold under load.
- [ ] During Global Pause the adapter returns `prov.paused`.
- [ ] Logs and audit contain no prompt/output text; secrets in output are redacted.
- [ ] Passes the MEM `SummariserModel` consumer-contract cases (parity with `FakeSummariserModel`).

## 12. Test plan

Unit tests for chain selection with fake health reader and `FakeTextCompletion`; limit and concurrency tests with `FakeClock`; negative tests (hostile output, pause); parity tests against the MEM fake. Commands: `pnpm vitest run packages/application/src/prov/summariser`.

## 13. Parallelization notes

Small, independent after PROV016/PROV034. MEM consumers already depend on the port. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: preferring Ollama for summaries keeps subscription limits free for Agents; the Owner can override in settings (config keys `summariserChain`, `summariserModelId`, `summariserMaxParallel` are added to `ProvConfig` through PROV019's owner).
- Gap: MEM003's request has no explicit `workspaceId`; the CLI branch needs it (additive field proposed to MEM).
