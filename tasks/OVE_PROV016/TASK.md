---
id: OVE_PROV016
title: Implement the Ollama provider (local fallback model with loopback-only access)
area: PROV
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_PROV001, OVE_PROV002, OVE_PROV020, OVE_PROV034]
soft_depends_on: [OVE_PROV017, OVE_PROV010]
provides: ["adapter:OllamaProvider", "lib:fake-ollama-server"]
needs: ["port:ModelProvider", "port:TextCompletion", "port:ConnectionRepository", "port:Clock", "port:Logger", "lib:redaction", "contract:Connection"]
owns:
  - packages/adapters/providers/src/ollama/**
  - docs/providers/ollama.md
reads: ["docs/SPECIFICATION.md", "packages/adapters/providers/src/cli/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15", "SPECIFICATION 16"]
adr_refs: [7, 22]
---

# OVE_PROV016: Implement the Ollama provider (local fallback model with loopback-only access)

## 1. Summary

Ollama is the fallback model when a CLI subscription runs out (Spec 9, acceptance criterion 12). It is a plain HTTP model on the Owner's machine: no tools, no shell, no file edits. This task implements `ModelProvider` and `TextCompletion` for it with strict loopback access, streaming, cancellation, health, model listing and local usage, plus a fake Ollama server for tests.

## 2. Context

Unlike the CLI providers, Ollama needs no Environment and no herdr: the engine process calls it directly at `http://127.0.0.1:11434` (default). That makes it the only provider reachable from the host side, so SSRF-style risks apply: the endpoint is stored in the `Connection` (PROV002 invariant: host must be `127.0.0.1`, `localhost` or `::1`). It cannot satisfy `shell`/`fileEdit` requirements, so nodes that need them escalate instead of running on Ollama (PROV001 assumption, PROV018). Usage is local and labelled `ollama_local` (ModelUsage source).

## 3. Scope (in)

- `OllamaProvider` (capabilities, invoke, stream, cancel, health, usage) and the `TextCompletion` implementation.
- Loopback-only HTTP transport with limits.
- Model list refresh, readiness check, token counts from responses.
- `FakeOllamaServer` (local HTTP server for tests, scripted failures).

## 4. Out of scope

- Installing Ollama or pulling models (the Owner does that; Overmind never calls `/api/pull`), fallback decisions (PROV018), usage storage (PROV017), Connection persistence (PROV020), tools or agents on Ollama (not planned).

## 5. Detailed requirements

1. **Capabilities:** `{ providerId: 'ollama', kind: 'local', streaming: true, tools: false, shell: false, fileEdit: false, structuredOutput: 'schema', images: false, cancel: 'hard', resume: false, models, contextTokens?: per model, requiresSandbox: false, reportsLimits: false }`. (`schema`: Ollama accepts a JSON Schema in `format`; ASSUMPTION verified against the installed version, otherwise `json`.)
2. **Transport:** Node built-in `fetch`/`http` only, no new dependency. Every request goes to `connection.endpoint` after re-validating that the host is loopback (`127.0.0.1`, `::1`, `localhost` resolved to loopback only: the transport resolves `localhost` itself and rejects non-loopback addresses); `redirect: 'error'`; no proxy environment variables honoured; request timeout from `req.timeoutMs` (max 600000), idle stream timeout 60 s, response size cap 2 MiB for non-stream and 1 MiB retained for streams; no cookies, no auth headers (Ollama is unauthenticated locally).
3. **invoke:** `POST /api/chat` with `stream: false`, `messages: [{ role: 'user', content: instruction }]` (instruction is the already assembled prompt; no system prompt is added here), `options` limited to a safe allow-list (`temperature`, `num_ctx`, `num_predict`) from the request/config, `format` set to the JSON Schema when `outputSchema` is present. Result: `text`, `structured` (parsed when a schema or json is requested; invalid JSON gives `provider.output_invalid`), `usageDelta` from `prompt_eval_count`/`eval_count` (source `ollama_local`), `evidenceRefs: []`, `stateHint` idle.
4. **stream:** same with `stream: true`, NDJSON parsed line by line (line cap 64 KiB), events `started`, `output` (chunks <= 8 KiB, redacted), `done`/`error` last; abort via `AbortSignal` closes the HTTP connection (hard cancel) and yields `provider.cancelled`.
5. **cancel(handle):** aborts the in-flight request by invocation id.
6. **health:** `GET /api/version` (reachable, version) and `GET /api/tags` (models); maps connection refused to `{ status: 'unavailable', detail: 'not_running' }`; empty model list to `unavailable` with `no_models`; returns the model list for Connection detection (PROV022).
7. **Requirements:** `checkRequirements` is called first; requests requiring `shell`, `fileEdit`, `tools` return `provider.capability_missing` without any HTTP call (these escalate upstream).
8. **Model selection:** the requested model must exist in the last model list (refreshed at most every 30 s); unknown model gives `provider.not_found` (never auto-pulled).
9. **TextCompletion.complete:** `/api/generate` or `/api/chat` non-streaming with `maxOutputChars` enforced by `num_predict` estimate and hard truncation (`truncated: true`); returns untrusted text.
10. **Concurrency:** at most 2 simultaneous requests per Connection (config), queue 10, then `provider.busy` (local GPU/RAM protection).
11. **Logging:** log endpoint host class, model id, durations, token counts; never prompts or outputs.
12. **FakeOllamaServer:** `lib:fake-ollama-server` starts a loopback server on an ephemeral port with scripts: `tags`, `chat ok`, `chat stream`, `slow`, `malformed_json`, `huge_response`, `redirect_to_other_host`, `drop_connection`, `no_models`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ModelProvider`, capability helper and errors (PROV001), `Connection` and `ModelUsage` contracts (PROV002), `TextCompletion` port (PROV034), redactor, `Clock`. The NDJSON line reader is a small local helper (no library).

## 8. Architecture and code placement

`packages/adapters/providers/src/ollama/{ollama-provider.ts,ollama-transport.ts,ndjson.ts,health.ts,text-completion.ts,fake/fake-ollama-server.ts}`. Adapter layer; depends on ports and contracts only; no import of the CLI folders (own folder, shares only the `providers` package files created by PROV010). Registered in PROV026.

## 9. Security and safety

The model has no tools, so the main risks are the endpoint and the output. Endpoint: loopback only, validated at save (PROV002) and again at every request (defence in depth against a tampered Connection row), redirects refused, `localhost` resolved by the transport and rejected if it does not map to loopback (DNS tricks), no proxy use, no credentials sent. Output is untrusted text: size-capped, redacted, never executed, never treated as a tool call. Instruction text is not logged. Unavailable Ollama fails closed (`provider.unavailable`), the system never silently reroutes tool-needing work to Ollama. Overmind never pulls models (no network download triggered by Agent text).

## 10. Errors and edge cases

- Ollama not running: `provider.unavailable` with `not_running`; Connection status `error` after 3 consecutive failures.
- Model unloaded or slow first token (model load takes tens of seconds): timeouts respect `timeoutMs`; a first-byte grace of 120 s for streams.
- Output exceeds cap: truncated with flag; invalid JSON for schema requests: `provider.output_invalid`.
- Endpoint changed by the Owner to `http://192.168.1.5:11434`: rejected at save; at runtime also rejected.
- Port reused by another local service returning HTML: parse failure -> `provider.output_invalid` / health `unavailable`.
- Two Agents hit the limit simultaneously: queue then `provider.busy`.

## 11. Acceptance criteria

- [ ] Against `FakeOllamaServer`: invoke, stream (ordered events), cancel (connection closed), health, model list and usage tokens work.
- [ ] Requests requiring `shell` or `fileEdit` return `provider.capability_missing` with zero HTTP calls.
- [ ] A redirect response, a non-loopback endpoint and a `localhost` that resolves to a public address are all refused.
- [ ] Unknown model is `provider.not_found` and no `/api/pull` request is ever made (spy).
- [ ] Oversized and malformed responses do not crash and are bounded.
- [ ] `ModelProvider.contract` suite and `TextCompletion` tests pass.
- [ ] Logs contain no prompt or output text.

## 12. Test plan

Unit tests for NDJSON parsing and transport guards; integration with the fake server; contract suite (PROV024); fuzz test for malformed NDJSON lines. Command: `pnpm vitest run packages/adapters/providers/src/ollama`.

## 13. Parallelization notes

Independent of CLI work after PROV010 creates the package files (or after a one-time stub); own folder. PROV018 and PROV031/032 use it through ports.

## 14. Open questions and assumptions

- ASSUMPTION: default endpoint `http://127.0.0.1:11434`; Owner may change within loopback.
- ASSUMPTION: Ollama is installed and run by the Owner (no bundling, no auto-start).
- Open: whether to expose GPU/RAM guidance in CONNUI; out of scope here.
