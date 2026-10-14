---
id: OVE_ARCH014
title: Define the ProcessRunner port for shell-free subprocess execution with limits
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH004]
soft_depends_on: [OVE_SEC004]
provides: ["port:ProcessRunner", "lib:process-runner"]
needs: []
owns: ["packages/application/src/ports/ProcessRunner.ts", "packages/adapters/system/src/process/**"]
reads: ["docs/research/prototyp-wnioski.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11"]
adr_refs: [20, 22, 26]
---

# OVE_ARCH014: Define the ProcessRunner port for shell-free subprocess execution with limits

## 1. Summary

One safe way to start host-side subprocesses (the `container` CLI, `launchctl`, `security`, `git`, the bundled herdr binary): argv arrays only, no shell, explicit environment, timeouts, output size caps, cancellation and redacted logging. Adapters get a `ProcessRunner` instead of calling `child_process` themselves.

## 2. Context

Several adapters (sandbox-macos, herdr, service-macos, git operations) must run host binaries. Free-form shell strings and inherited environments are the classic injection and secret-leak routes, and Agent-controlled text (branch names, file names, prompts) must never become part of a command line. Commands that run agents' code run INSIDE the sandbox via `Sandbox.exec`; `ProcessRunner` is for host tooling only.

## 3. Scope (in)

- Port `ProcessRunner` (`run`, `spawn`), value types, error codes.
- Node implementation using `spawn` with `shell: false`.
- Environment allowlist builder, output capture with caps, kill escalation.

## 4. Out of scope

- Running Agent commands (BOX/PROV). PTY handling (herdr owns terminals). Command-specific wrappers such as `ContainerCli` (BOX), `GitClient` (BOARD/ENGINE).

## 5. Detailed requirements

1. **Port:**
   ```ts
   interface ProcessRunner {
     run(spec: RunSpec): Promise<Result<RunResult>>;         // waits for exit
     spawn(spec: SpawnSpec): Result<ProcessHandle>;          // long-running, streaming
   }
   RunSpec = { command: string /* absolute path or bare name resolved from allowlisted dirs */; args: string[]; cwd?: string;
     env?: Record<string,string>; inheritEnv?: 'minimal' | 'none'; stdin?: string | Uint8Array;
     timeoutMs: number /* required, max 600000 */; maxOutputBytes?: number /* default 1 MiB per stream */;
     signal?: AbortSignal; logLabel: string /* constant, e.g. 'container.list' */; redactArgs?: number[] /* indexes of args to hide in logs */ }
   RunResult = { exitCode: number | null; signal: string | null; stdout: string; stderr: string; truncated: { stdout: boolean; stderr: boolean }; durationMs: number }
   ProcessHandle = { pid; onStdout(cb); onStderr(cb); onExit(cb); write(data); kill(signal?: 'SIGTERM'|'SIGKILL'); exited: Promise<ExitInfo> }
   ```
2. **No shell, ever:** the implementation uses `child_process.spawn(command, args, { shell: false })`. A `command` containing whitespace, `;`, `|`, `&`, `$`, backtick or newline is rejected (`platform.invalid_command`). Args are passed as-is; an arg beginning with `-` that came from untrusted input is the caller's responsibility, so `RunSpec` offers `untrustedArgs?: string[]` appended after a `--` separator when the target supports it.
3. **Executable resolution:** absolute paths, or bare names looked up only in an allowlisted directory list (`/usr/bin`, `/bin`, `/usr/sbin`, `/sbin`, `/usr/local/bin`, `/opt/homebrew/bin`, bundled resources dir given by config). The `PATH` of the engine is never used implicitly. Result of lookup is logged (`debug`).
4. **Environment:** default `inheritEnv: 'minimal'` copies only `PATH` (restricted), `HOME`, `LANG`, `TMPDIR`, `USER`. Everything else must be passed explicitly. Variables whose names match the redaction key rule or which carry `Secret` values are passed only via `env` with `Secret` unwrap at spawn time and are never logged. `inheritEnv: 'none'` for the strictest calls.
5. **Limits:** `timeoutMs` mandatory; on timeout send SIGTERM, after 2 s SIGKILL, return `platform.process_timeout` including partial output (redacted by callers). Output beyond `maxOutputBytes` is dropped, flagged in `truncated`, process continues until exit. Concurrent process count capped (default 8) with a queue; exceeding the queue length (100) fails fast `platform.process_queue_full`.
6. **Errors:** spawn ENOENT -> `platform.command_not_found`; EACCES -> `platform.command_not_permitted`; non-zero exit is NOT an error in `run` (returned in `RunResult`); callers decide. Abort via signal -> `internal.cancelled`.
7. **Logging:** at `debug` log `logLabel`, argv with `redactArgs` replaced, cwd (home-scrubbed), exit code, duration, stdout/stderr lengths. Never log stdout/stderr bodies above `debug`; at `debug` log the first 200 chars after redaction. Prompts and Agent text never appear in args (they travel through stdin or herdr API).
8. **cwd** must be absolute and (when the caller passes a `PathPolicy`) inside the data dir or an Allowed Directory; the runner itself does not authorise paths, it only checks `cwd` exists and is a directory.
9. Provide `FakeProcessRunner` requirements for TEST002: scripted responses keyed by `logLabel` or command+args matcher, recorded calls, assertion helpers; contract suite `ProcessRunner.contract.ts` runs real tiny commands (`/bin/echo`, `/usr/bin/false`, `sleep`) for the Node implementation.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Used by BOX (`container`), ENGINE (`launchctl` through ServiceManager adapter), PROV/herdr adapter (herdr binary start, `herdr api schema`), BOARD (git worktrees). `Logger` (ARCH004) for logging, `Clock` (ARCH007) for timeouts, `Secret` (ARCH012) for env values.

## 8. Architecture and code placement

Port `packages/application/src/ports/ProcessRunner.ts`; adapter `packages/adapters/system/src/process/{node-process-runner.ts,env.ts,resolve-command.ts,limiter.ts}`. Only this adapter imports `node:child_process` (boundary lint: `child_process` allowed only in `adapters/system/src/process/**`, plus the `tools/` dir; proposal to ARCH002 owners). Other adapters depend on the port.

## 9. Security and safety

Prevents command injection (no shell, validated command), environment leakage (minimal env), resource exhaustion (timeouts, caps, concurrency limit) and secret exposure in logs (argv redaction). Prompt-injected strings must never reach `command`; `command` values come from constants or trusted config (documented, with a unit test that rejects whitespace/metacharacters). Processes are started with the engine's privileges, so callers must keep the command set minimal; a fixed allowlist can be tightened via config (`platform.allowedCommands` ASSUMPTION). Fail closed: resolution failure means no execution.

## 10. Errors and edge cases

- Child ignores SIGTERM: SIGKILL after grace.
- Zombie processes on engine crash: handles registered for cleanup on normal shutdown; orphan detection by pid file is out of scope.
- Output with invalid UTF-8: decoded with replacement chars; raw bytes available via `spawn`.
- Very chatty process: backpressure; stdout buffered up to cap only.
- Cancellation after exit: no-op.
- Timer drift: monotonic clock used for timeouts.

## 11. Acceptance criteria

- [ ] `command` with spaces/metacharacters is rejected without spawning.
- [ ] Timeout kills the child (SIGTERM then SIGKILL) and returns partial output flagged.
- [ ] Output cap sets `truncated` and does not grow memory beyond cap.
- [ ] Default environment contains only the minimal allowlist; a secret in the parent env is not visible to the child (test spawns `/usr/bin/env`).
- [ ] Concurrency limit queues and then rejects at queue-full.
- [ ] `redactArgs` hides arguments in debug logs.
- [ ] Contract suite passes for the Node implementation and the fake.

## 12. Test plan

- Integration with real harmless binaries under a temp dir (`node-process-runner.int.test.ts`); fake clock not applicable for real timeouts, use 50 ms timeouts.
- Unit: `resolve-command.test.ts`, `env.test.ts`, `limiter.test.ts`.
- Security test: argument containing `; rm -rf /` passed as a single arg is delivered literally (echo test).
- Commands: `pnpm vitest run packages/adapters/system/src/process`.

## 13. Parallelization notes

Independent of most ARCH tasks except logging. Adapter authors (BOX, PROV, ENGINE) can code against the port and `FakeProcessRunner` immediately.

## 14. Open questions and assumptions

- ASSUMPTION: execution of the bundled herdr binary uses an absolute path inside the app bundle (SETUP015) verified by checksum before first run (SEC006).
- ASSUMPTION: PTY use is out of scope (herdr provides terminals).
