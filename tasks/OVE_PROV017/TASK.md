---
id: OVE_PROV017
title: Record usage and limits exactly as the CLI reports them (source "per CLI")
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_DATA001, OVE_DATA003, OVE_DATA007, OVE_ENGINE029, OVE_PROV001, OVE_PROV002, OVE_PROV006, OVE_PROV019, OVE_PROV020, OVE_PROV034]
soft_depends_on: [OVE_PROV010, OVE_PROV011, OVE_PROV029]
provides: ["port:ProviderUsage", "port:ModelUsageRepository", "usecase:RecordModelUsage", "usecase:GetUsageSnapshot", "lib:usage-parser", "adapter:SqliteModelUsageRepository", "table:model_usage"]
needs: ["contract:ModelUsage", "port:SqliteDatabase", "lib:repository-base", "lib:migration-runner", "port:Clock", "port:IdGenerator", "port:EventBus", "lib:redaction", "port:JobScheduler", "port:ConnectionRepository", "contract:ProvConfig"]
owns:
  - packages/application/src/prov/usage/**
  - packages/application/src/ports/ProviderUsage.ts
  - packages/application/src/ports/ModelUsageRepository.ts
  - packages/domain/src/prov/usage/**
  - packages/adapters/sqlite/src/prov/model-usage/**
  - packages/adapters/sqlite/migrations/V202610150110__OVE_PROV017__model_usage.sql
reads: ["docs/research/prototyp-wnioski.md", "tools/fake-cli/screens/", "packages/contracts/src/model-usage/"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 14", "SPECIFICATION 15", "SPECIFICATION 17"]
adr_refs: [7, 22]
---

# OVE_PROV017: Record usage and limits exactly as the CLI reports them (source "per CLI")

## 1. Summary

Overmind shows limits and reset times only the way the official CLI reports them, labelled with the source "per CLI" (ADR 0022, Spec 9), and shows per-Provider, model, Agent, Run and Workspace consumption (Spec 15). This task parses the CLI's own usage and limit text into the `ModelUsage` contract, stores it, and serves snapshots, without ever presenting numbers as Overmind's own.

## 2. Context

Anthropic does not allow third-party products to present subscription limits as their own feature, so Overmind passes the CLI's statement through verbatim (bounded and sanitised) and adds only a parse result where it is sure. The CLIs report usage in their UI (Claude `/usage`, Codex status) and print limit-reached screens (`usage limit`, `Resets in/at ...`). The `ModelUsage` shape (`reportedLimit.text` verbatim, `kind`, `resetsAt?`, `resetsInText?`, `parse: exact|best_effort|none`, `source: per_cli|ollama_local|estimate`) is defined by PROV002. Limit exhaustion events and fallback are PROV018.

## 3. Scope (in)

- Pure parsers per CLI (`UsageParser`) from screen text to `ReportedLimit` and optional token figures.
- `RecordModelUsage` (from invocation results and from probes) and `GetUsageSnapshot` use cases.
- `ProviderUsage` port, `ModelUsageRepository` port and SQLite adapter with migration.
- The usage probe scheduler (periodic, low frequency, idle-only).
- Retention and aggregation queries.

## 4. Out of scope

- Fallback switching and the `limit_reached` event (PROV018), the `api:connections.status` route (PROV021), UI (CONNUI), cost estimates or prices (not planned), Ollama token counts (PROV016 supplies `usageDelta`, stored here).

## 5. Detailed requirements

1. **Parser:** `parseUsageText(cli, text, now): ParsedUsage` pure functions in `packages/domain/src/prov/usage/parsers/{claude.ts,codex.ts}`; input is at most 8 KiB of redacted, ANSI-stripped text. Output `{ reportedLimit?: { text, kind, resetsAt?, resetsInText?, parse }, tokens?: {...} }`. `text` is the verbatim relevant lines (max 500 chars, control and bidi characters removed). `parse: 'exact'` only when a reset instant is unambiguous (absolute time with timezone or "in 2h 30m" relative to `now`); `best_effort` when a clock time without a date or timezone is read using the machine timezone; `none` otherwise. `kind` is `session`, `weekly`, `daily` or `unknown` from keywords. Never invent numbers: percentages or counts appear only if the CLI printed them, and only in `text`.
2. **Sources of text:** (a) the `rate_limited` observation excerpt (PROV006) when a limit is hit; (b) the usage probe: per profile `probes.usage` is either an argv run through `Sandbox.exec` (stdout parsed, stdout never logged) or a slash command typed into an idle session through the delivery guard (kind `followup`, only when the session is `idle` with no invocation, at most once per `usageProbeIntervalMs` default 15 min, never while paused, and its screen read through the gateway snapshot); (c) `usageDelta` from provider results.
3. **Record:** `RecordModelUsage.execute(draft)` assigns id (`mu_`), stamps `source`, runs the redactor, enforces text length, writes `model_usage`. CLI-derived rows use `source: 'per_cli'`; Ollama `ollama_local`; `estimate` exists in the contract but this task never writes it.
4. **Snapshot:** `GetUsageSnapshot({ connectionId })` returns the latest row per `(connectionId, kind)` plus `capturedAt` and `stale: true` when older than 30 min (UI shows the age). It also returns `activeLimit` if a limit is currently in effect (`resetsAt` in the future or no reset known and the last observation was `rate_limited`).
5. **Aggregation queries:** `sumByProvider/model/agent/run/workspace(range)` for token figures only (counts as reported; rows without tokens are skipped, not estimated).
6. **Schema (migration `V202610150110__OVE_PROV017__model_usage.sql`):** `model_usage(id PK, connection_id, provider_id, model_id, run_id NULL, agent_id NULL, node_execution_id NULL, tokens_in INT NULL, tokens_out INT NULL, tokens_total INT NULL, limit_text TEXT NULL, limit_kind TEXT NULL, limit_resets_at TEXT NULL, limit_resets_in_text TEXT NULL, limit_parse TEXT NULL, source TEXT NOT NULL, recorded_at TEXT NOT NULL)`; indexes on `(connection_id, recorded_at)`, `(run_id)`, `(agent_id, recorded_at)`. Retention 90 days by a daily job (`JobScheduler`), limit rows kept at most 1000 per Connection.
7. **Port `ProviderUsage`:** `usage(q: { connectionId?, providerId?, runId?, agentId?, workspaceId?, from?, to? }): Promise<Result<UsageSnapshot>>` implemented here; `ModelProvider.usage` delegates to it (PROV001 req. 8).
8. **Labelling:** snapshots carry `source` and an i18n key `usage.source.per_cli` ("per CLI"); the model never calls it "your remaining quota"; no derived percentage is computed.
9. **Events:** `provider.usage_recorded` (non-persisted, ids only) for live UI refresh; limit events are PROV018's.
10. **Redaction and safety of text:** verbatim text passes the redactor, strips ANSI, `‮` and other bidi, collapses whitespace, caps length; it is displayed as plain text (UI must escape), never as Markdown or HTML.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ModelUsage` and `Connection` contracts (PROV002), `TerminalObservation` excerpt (PROV006), `repository-base`, migration runner, `JobScheduler`, `Sandbox.exec` (BOX010), delivery guard via the gateway (PROV008/PROV029), redactor.

## 8. Architecture and code placement

Domain parsers in `packages/domain/src/prov/usage/`; use cases in `packages/application/src/prov/usage/{record.ts,snapshot.ts,probe-scheduler.ts,retention.ts}`; ports in `packages/application/src/ports/`; SQLite repo in `packages/adapters/sqlite/src/prov/model-usage/`. One migration. SRP: parsing is pure; probing and persistence are separate.

## 9. Security and safety

CLI text is untrusted: a hostile repository could make the CLI print a fake "usage limit" line; the worst outcome is a false limit state, so the limit signal also requires the PROV006 position rules and the status is informational until PROV018 acts (switching models is a visible, reversible Run-level override with a notification). Text is sanitised and bounded. The slash-command probe goes only through the guard and only when idle, so it cannot interrupt work or type into dialogs. No credentials are read: the probes run CLI commands whose output is only parsed for usage text; stdout is never logged. Rows contain no prompts.

## 10. Errors and edge cases

- CLI changes wording: parser returns `parse: 'none'` with the verbatim lines; the UI shows the text as is (safe fallback).
- Ambiguous reset text ("Resets at 5pm"): `best_effort` with machine timezone, flagged in the row.
- Clock skew or DST: relative parses use the injected `Clock`; absolute times keep their stated timezone if present.
- Very old snapshot: `stale: true`.
- Probe fails (CLI not logged in): no row written, Connection status handled by PROV014/PROV022.
- Limit text containing control characters or ANSI: stripped at write time (schema max length enforced).

## 11. Acceptance criteria

- [ ] Parser fixtures (real captured texts from the CLI spikes) give expected `kind`, `resetsAt` or `resetsInText`, and `parse` values; an unknown text gives `parse: 'none'` with verbatim lines.
- [ ] No parser output contains a number that is not in the input (property test).
- [ ] `RecordModelUsage` stores `source: 'per_cli'` for CLI rows and never `estimate`.
- [ ] Snapshot marks rows older than 30 min `stale`.
- [ ] The slash-command probe is sent only when idle, not while paused, at most once per interval, and only through the guard (fake gateway asserts).
- [ ] ANSI and bidi characters in limit text are stripped; text > 500 chars is cut.
- [ ] Migration idempotent; retention job deletes rows older than 90 days.

## 12. Test plan

Table-driven parser tests with captured fixtures; repository tests on the SQLite harness; probe scheduler tests with `FakeClock`; property tests for sanitiser and "no invented numbers". Commands: `pnpm vitest run packages/domain/src/prov/usage packages/application/src/prov/usage packages/adapters/sqlite/src/prov/model-usage`.

## 13. Parallelization notes

Parsers can start from the prototype texts before the real captures arrive (PROV010/011 spikes add fixtures). Migration name unique. PROV018 consumes parsed limits; PROV021 consumes snapshots.

## 14. Open questions and assumptions

- ASSUMPTION: Claude's `/usage` and Codex's status output are the sources of limit text; if a CLI offers no usage output, only limit-hit screens are captured.
- Open: legal wording for the label ("per CLI" vs "reported by Claude Code"); keep the i18n key stable and let UI copy change.
