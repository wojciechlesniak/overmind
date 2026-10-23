---
id: OVE_ARCH004
title: Implement structured logging with secret redaction and correlation ids
area: ARCH
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH005, OVE_ARCH056]
soft_depends_on: []
provides: ["port:Logger", "lib:redaction", "lib:log-context", "lib:logging-adapter", "lib:redactor"]
needs: []
owns: ["packages/application/src/ports/Logger.ts", "packages/application/src/logging/**", "packages/adapters/logging/**", "docs/architecture/logging.md"]
reads: ["docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 15"]
adr_refs: [3, 4, 22]
---

# OVE_ARCH004: Implement structured logging with secret redaction and correlation ids

## 1. Summary

Define the `Logger` port, a pino-based implementation with rotation, a redaction pipeline that scrubs secrets, tokens, Keychain references and home paths from every log line, and async-context correlation ids (workspaceId, runId, agentId, taskId). Logs are diagnostics only: security and business audit events are NOT logs and go to the event store.

## 2. Context

Spec 11/15: secrets never appear in prompts or logs; logs are redacted. ADR 0022: Overmind must never see CLI login credentials, so even accidental capture of CLI output must be scrubbed. The engine writes logs under the data directory (`OVE_ARCH005`). The UI process logs through a small `LogSink` to the engine via the gateway or to a file in the same directory.

## 3. Scope (in)

- Port `Logger` (+ `LogFields`, `LogContext`) in `packages/application/src/ports/Logger.ts`.
- `redact(value)` pure functions (key-based and pattern-based) in `packages/application/src/logging/redaction/`.
- `withLogContext(ctx, fn)` and `getLogContext()` using `AsyncLocalStorage` abstracted behind a port-free helper in the adapter, plus explicit `logger.child()` for code that cannot use ALS.
- Adapter `packages/adapters/logging/`: pino JSON logger, redaction hook, size-based rotation, destinations, `createLogger(config)`.
- `NullLogger` and `MemoryLogger` (the latter in `packages/testing`, see TEST002, interface defined here).
- Documentation `docs/architecture/logging.md`.

## 4. Out of scope

- Audit events (append-only, in the event store): PERM (`AuditEvent`) and DATA event log. This task only documents the rule.
- Activity view data (it reads run events, not logs): RUNUI/DATA.
- Redaction corpus and policy text: `OVE_SEC003` (this task implements patterns; SEC003 owns the corpus and may extend patterns through a PR to the pattern table file).
- Log viewer UI, export of diagnostics: later.

## 5. Detailed requirements

1. **Port.**
   ```ts
   export type LogLevel = 'trace'|'debug'|'info'|'warn'|'error'|'fatal';
   export interface LogContext { workspaceId?: string; runId?: string; agentId?: string; taskId?: string;
     nodeExecutionId?: string; requestId?: string; channel?: 'desktop'|'telegram'|'agent'|'system'; component?: string }
   export interface Logger {
     log(level: LogLevel, msg: string, fields?: LogFields): void;
     trace/debug/info/warn/error/fatal(msg: string, fields?: LogFields): void;
     child(bindings: Partial<LogContext> & { component?: string }): Logger;
     isLevelEnabled(level: LogLevel): boolean;
   }
   export type LogFields = Record<string, unknown> & { err?: unknown };   // err: AppError | Error | unknown
   export const LoggerToken = token<Logger>('port:Logger');
   ```
   `msg` is a constant, human-readable template with no interpolated variable data (data goes to `fields`) so logs can be grepped and redacted reliably. Lint rule suggestion: no template literals with `${}` in `msg` (proposal to ARCH002 owners).
2. **Output format.** One JSON object per line: `{ "time": ISO-8601 UTC, "level": "info", "msg": "...", "component": "...", "workspaceId"?, "runId"?, "agentId"?, "taskId"?, "requestId"?, "err"?: { "code", "message", "stack"? }, ...fields }`. Time comes from the `Clock` port (ARCH007) so tests are deterministic. Stack traces only at level >= `debug` or for `fatal`.
3. **Correlation ids.** The gateway wraps each request in `withLogContext({ requestId, channel })`; the workflow runtime wraps node execution in `withLogContext({ workspaceId, runId, agentId?, taskId?, nodeExecutionId })`; adapters add `component`. Context propagates through async calls via `AsyncLocalStorage`. IDs are the ULIDs from ARCH007. A log call inside no context carries `component` only. `child()` bindings override ALS values.
4. **Redaction pipeline** applied to the complete log record before serialisation, to `msg`, all `fields`, nested objects (depth limit 6, array limit 50, string cap 8 KiB with `...[truncated N]`), `err.message`, `err.stack` and the `cause` chain (depth 3):
   - **Key rule:** any property whose lowercased name matches `/(token|secret|password|passwd|passphrase|api[-_]?key|authorization|cookie|set-cookie|private[-_]?key|credential|session|bearer)/` has its value replaced with `"[REDACTED]"` regardless of content. Exceptions list is empty by default (an allowlist requires a security review).
   - **Pattern rule** on string values (table in `redaction/patterns.ts`, each with id, regex, replacement, test vectors):
     | id | pattern (illustrative) | replacement |
     |---|---|---|
     | `anthropic-key` | `sk-ant-[A-Za-z0-9_-]{20,}` | `[REDACTED:anthropic-key]` |
     | `openai-key` | `sk-(proj-)?[A-Za-z0-9_-]{20,}` | `[REDACTED:openai-key]` |
     | `telegram-bot-token` | `\b\d{8,10}:[A-Za-z0-9_-]{35}\b` | `[REDACTED:telegram-bot-token]` |
     | `telegram-api-url` | `api\.telegram\.org/bot[^/\s]+` | `api.telegram.org/bot[REDACTED]` |
     | `github-token` | `\bgh[pousr]_[A-Za-z0-9]{36,}\b`, `github_pat_[A-Za-z0-9_]{50,}` | `[REDACTED:github-token]` |
     | `aws-key` | `\b(AKIA|ASIA)[0-9A-Z]{16}\b` | `[REDACTED:aws-key]` |
     | `jwt` | `\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b` | `[REDACTED:jwt]` |
     | `bearer` | `(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{16,}` | `Bearer [REDACTED]` |
     | `overmind-session-token` | `\bovm_(st|at)_[A-Za-z0-9_-]{20,}\b` (gateway session and agent tokens) | `[REDACTED:overmind-token]` |
     | `pem` | `-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----` | `[REDACTED:private-key]` |
     | `url-credentials` | `([a-z][a-z0-9+.-]*://)[^/\s:@]+:[^/\s@]+@` | `$1[REDACTED]@` |
     | `keychain-ref` | `keychain:[A-Za-z0-9._/-]+` | `keychain:[REF]` |
     | `oauth-code` | `[?&](code|access_token|refresh_token|id_token)=[^&\s]+` | `$1=[REDACTED]` (covers CLI login redirect URLs, ADR 0022) |
     | `home-path` | `/Users/[^/\s"']+` and the literal current home directory | `~` |
   - **Keychain refs:** the secret reference format (`keychain:<service>/<account>`) is replaced by `keychain:[REF]` so the identity of stored items is not disclosed in shared logs. Secret *values* never reach the logger by construction (see requirement 9).
   - Redaction is idempotent, total (never throws; on internal failure the whole field becomes `"[REDACTION_FAILED]"`), and runs in under 50 microseconds for a typical 1 KiB record (benchmark test, soft limit).
   - Binary/`Buffer`/`Uint8Array` values are logged as `"[binary N bytes]"`.
5. **Destinations and rotation.** Engine: `<dataDir>/logs/engine.log` (JSON lines), rotation at 10 MiB, keep 5 files (`engine.log.1`...), total cap 60 MiB, files 0600, directory 0700 (ARCH005). Also stderr in dev mode (pretty printer allowed only when `OVERMIND_DEV=1`). UI/Rust shell: `<dataDir>/logs/desktop.log`, same rules. Level default `info`, configurable in config (`logging.level`) and by env `OVERMIND_LOG_LEVEL` in dev. `trace`/`debug` never written to disk in release builds unless the Owner enables "diagnostic mode" (ASSUMPTION; 24 h auto-off).
6. **Log vs audit.** Document and test: security decisions (allow, deny, approval, access request, policy change, pause) are written as audit events via the event store by their use cases. Code MUST NOT use the logger as the audit trail, and log lines MUST NOT be parsed by product features. The logger may additionally log a one-line `info` mirror of an audit event without payload.
7. **Errors in logs:** `logger.error('x failed', { err })` serialises `AppError` as `{ code, message, retryable, correlationId }` plus `cause` message (redacted) and stack when allowed. `err.details` are included after redaction.
8. **Backpressure:** logging is non-blocking; if the sink is slow, drop `trace`/`debug` first, then `info`, never `error`/`fatal`; count drops and emit a single `warn` with `droppedCount` every 10 s. A failing log sink must never crash the engine (swallow, count, try stderr once).
9. **Secrets by construction.** The `Keychain` port (ARCH012) returns `Secret` objects whose `toJSON()` and `toString()` return `[SECRET]` and which expose the value only via `reveal()`. The logger treats any `Secret` instance as `[SECRET]`. Types of fields in `LogFields` discourage raw prompts: prompt text and CLI screen content MUST NOT be logged at `info` or above (only length and hash); `debug` may log them only after redaction and only in diagnostic mode.
10. **Child-process output** captured from CLIs or herdr is untrusted and potentially secret-bearing: adapters log only lengths, exit codes and redacted first 200 chars at `debug`.
11. Provide `createTestLogger()` contract: `MemoryLogger { records: LogRecord[] }` in `packages/testing` (TEST002 implements; interface and assertion helper `expectNoSecrets(records)` specified here).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Clock` and `IdGenerator` (ARCH007); `AppError` (ARCH003); data directory paths (ARCH005); `AtomicFileWriter` is not used (append-only logs). All other tasks inject `Logger` and never use `console.*` (forbidden global, ARCH002).

## 8. Architecture and code placement

- Port: `packages/application/src/ports/Logger.ts`.
- Pure logic: `packages/application/src/logging/` (`redact.ts`, `redaction/patterns.ts`, `log-context.ts` interface). ALS-based context holder: `packages/adapters/logging/src/als-context.ts` (uses `node:async_hooks`, adapter-only). Application code obtains context only through `logger.child` or the gateway/runtime wrappers (the `withLogContext` function is exported from the adapter and injected into the gateway and runtime as a `ContextRunner` port-like function type defined in `Logger.ts`).
- Implementation: `packages/adapters/logging/src/{pino-logger.ts,rotating-stream.ts,create-logger.ts}`.
- Dependencies: `pino` (justification: fast, JSON, maintained, MIT). Rotation: small in-house stream (about 80 lines) or `pino-roll` if the license and maintenance check passes; record the decision in `docs/dependencies.md` (SETUP008).

## 9. Security and safety

This task is a primary secret-leak control (SR-06, SR-07 in SEC001). Fail closed: if redaction throws, the field is dropped, not logged raw. Home paths are scrubbed so shared logs do not disclose the macOS user name. Log files are 0600 in a 0700 directory. Never log: prompts, CLI screens, Telegram message bodies, file contents, Skill instructions, environment variables (log names only). Treat `fields` from agents as untrusted: log injection (newlines, ANSI escapes) is neutralised because output is JSON-encoded and control characters are escaped; `‮` bidi overrides are replaced with `�` in `msg` and string fields.

## 10. Errors and edge cases

- Circular object graphs: replaced with `"[Circular]"`.
- Getter that throws, `toJSON` that throws: field becomes `"[Unserialisable]"`.
- Extremely long single token (1 MiB string): truncated before regex to avoid ReDoS; every regex is linear-time (reviewed; a ReDoS test with 100 KB pathological inputs must finish under 50 ms).
- Disk full or log dir missing: engine continues, logs to stderr once, retries creating the dir every 30 s.
- Clock jumps: timestamps come from `Clock.now()`; ordering is not guaranteed across rotation.
- Concurrent writers (engine and desktop) write different files.
- Config reload changes level at runtime without restart.

## 11. Acceptance criteria

- [ ] Every pattern in the table has at least 3 positive and 3 negative test vectors and is redacted at every nesting level of a log record.
- [ ] Key-based redaction replaces values of `token`, `apiKey`, `Authorization`, `cookie`, `password` fields without looking at content.
- [ ] A log record containing `/Users/alice/Projects/x` is written as `~/Projects/x`.
- [ ] A `Secret` instance logged anywhere appears as `[SECRET]`.
- [ ] Correlation ids from `withLogContext` appear on all log lines produced inside the callback, including after `await` and in `Promise.all` branches, and do not leak to concurrent contexts.
- [ ] Rotation: after 10 MiB the file rolls, at most 5 backups exist, permissions remain 0600/0700.
- [ ] Redaction failure never throws and never emits the raw value.
- [ ] No `console.*` remains in packages other than the logging adapter and tools (lint passes).
- [ ] `docs/architecture/logging.md` states "audit events are not logs" and shows the table of patterns.

## 12. Test plan

- Unit: `redact.test.ts` (patterns table-driven from test vectors, key rule, nesting, truncation, idempotence, ReDoS guard); `log-context.test.ts` (ALS isolation across concurrent `Promise.all`); `pino-logger.test.ts` (JSON shape with fake clock); `rotating-stream.test.ts` (temp dir, 0600 mode asserted with `fs.statSync`).
- Contract: `Logger.contract.ts` (TEST003) run against `PinoLogger`, `MemoryLogger`, `NullLogger`.
- Property test (fast-check): `redact(redact(x)) == redact(x)` and redacted output never matches any pattern.
- Integration with SEC003 corpus when available (soft dependency).
- Commands: `pnpm vitest run packages/application packages/adapters/logging`.

## 13. Parallelization notes

Interface and `NullLogger` can be merged first so other tasks can inject `Logger` immediately (soft dependency pattern). Patterns table file `redaction/patterns.ts` is a hotspot shared with SEC003: SEC003 edits only the test vectors file `redaction/vectors.ts` and proposes new patterns through PR review of this file's owner. Config keys come from ARCH005.

## 14. Open questions and assumptions

- ASSUMPTION: `pino` is acceptable; alternative is a zero-dependency in-house JSON logger (about 150 lines). Choose in the first PR with a dependency justification.
- ASSUMPTION: diagnostic mode (debug logs on disk) is an Owner toggle with 24 h auto-off; UI for it is out of scope.
- Open: sending logs to the UI Activity view is explicitly NOT done (Activity reads run events).
