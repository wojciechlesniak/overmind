---
id: OVE_BOX010
title: Implement Sandbox.exec with fixed /work cwd, streaming, cancel, timeouts and output caps
area: BOX
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_ARCH014, OVE_BOX003, OVE_BOX008]
soft_depends_on: [OVE_ARCH014]
provides: ["lib:sandbox-exec"]
needs: ["port:Sandbox", "port:ProcessRunner", "port:Clock", "lib:redaction", "port:EventBus"]
owns:
  - packages/adapters/sandbox-macos/src/exec/**
reads: ["packages/application/src/ports/ProcessRunner.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [4, 20, 22]
---

# OVE_BOX010: Implement Sandbox.exec with fixed /work cwd, streaming, cancel, timeouts and output caps

## 1. Summary

Run a command inside an Environment through `container exec` with an argv array, the working directory forced to `/work`, a filtered environment, streamed output, hard timeouts, size caps and clean cancellation. This is the only way any code of an Agent or any CLI process starts inside the isolation.

## 2. Context

Prototype: Codex was started in `/` and wrote its file into the container root; Overmind must start CLIs only in `/work`. `OVE_ARCH012` defines `exec(id, cmd: ExecSpec): Promise<Result<ExecHandle>>` as "no shell string: argv array, cwd must be `/work`". `ProcessRunner` (OVE_ARCH014) handles host processes; `container exec` is a host process whose stdin/stdout map to the container process. herdr runs CLIs in its own pty inside the Environment (PROV), so `exec` is used for helper commands (probe, git, login callback, relay start, health) and for starting the herdr server, not for interactive agent work.

## 3. Scope (in)

- `ExecSpec`/`ExecHandle` implementation: stdin, stdout, stderr streams, exit info, kill.
- Hard rule enforcement: cwd, user, env filtering, argv validation.
- Timeouts, output caps, cancellation with process-tree cleanup inside the container.
- Per-Environment concurrency limit for execs.

## 4. Out of scope

- Terminals/pty for agent CLIs: PROV (herdr). Network policy: BOX011-BOX013. Login callback helper: BOX015.

## 5. Detailed requirements

1. **ExecSpec:** `{ argv: string[] /* argv[0] absolute path or a name resolved by the container's own PATH */; cwd?: '/work' | '/work/<relative>' ; env?: Record<string,string>; stdin?: 'none'|'pipe'; timeoutMs: number; maxOutputBytes?: number; tty?: false; label: string; secretEnv?: Record<string, Secret> }`. The adapter forces `--workdir /work` (or a subdirectory of `/work` after lexical validation: no `..`, no symlink resolution on the host; the in-container path is checked with `realpath` inside the Environment only for subdirectories and must still start with `/work/`). `cwd` outside `/work` => `box.exec_denied` (never silently rewritten).
2. **No shell string:** argv is an array of strings, each at most 32 KiB, total at most 128 KiB, no NUL. Callers that need a shell pass `['/bin/sh','-c', script]` explicitly and take responsibility; the port documents that Agent text MUST NOT be interpolated into such a script (SEC004 rule). The adapter logs only `label` and `argv[0]`, never the full argv unless `debug` and after redaction.
3. **User and privileges:** exec always runs as `agent` (uid 1000) with no extra capabilities; the adapter never passes `--user root` or `--privileged`. A request specifying a user is rejected.
4. **Environment:** the exec env is the Environment's spec env plus `spec.env` additions that pass the BOX007 allowlist, plus `secretEnv` entries (for example `OVERMIND_API_TOKEN` for the Skill, minted by PROV per start). Secret values are passed via an inherited file descriptor or `--env-file` with mode 0600 deleted right after spawn (never as `--env KEY=VALUE` in argv), and are never logged.
5. **Streaming:** `ExecHandle { onStdout, onStderr, write, closeStdin, kill(signal?), exited: Promise<ExecExit> }` with backpressure. `ExecExit { exitCode|null, signal|null, timedOut, cancelled, truncated, durationMs, oomKilled? }`.
6. **Timeouts and cancel:** `timeoutMs` mandatory (max 3600000 for long-running helpers; 600000 default for commands). On timeout/cancel: signal SIGTERM to the exec'd process group (using `container exec <id> kill -TERM -- -<pgid>` through a tiny supervisor `ovm-supervisor` in the image that records pgid; ASSUMPTION), grace 3 s, then SIGKILL; verify no process of that exec remains (poll `ps` in the container for the label) and return `box.exec_timeout` or `internal.cancelled`. A process that ignores signals is killed by destroying the Environment as last resort (caller decides; exec reports `leaked: true`).
7. **Output caps:** default 1 MiB per stream retained in memory for `run`-style helpers; streaming consumers get chunks without retention. Beyond cap: dropped, flagged `truncated`, process continues unless `killOnTruncate` is set. Binary-safe handling (Uint8Array chunks, UTF-8 decoding with replacement in the string helpers).
8. **Concurrency:** at most 8 simultaneous execs per Environment (config `sandbox.maxExecPerEnv`), excess queued with a 30 s queue timeout then `box.resource_limit`.
9. **Pre-conditions:** the Environment is `running` and its last verification (BOX008) succeeded within the current start; the global isolation gate (BOX019) is consulted by callers, but this adapter also fails closed with `platform.sandbox_unavailable` when `capabilities().kind` is `none` or the health cache is `blocked`.
10. **Activity tracking:** updates `lastActivityAt` in the registry for idle-stop decisions (debounced, 5 s).
11. **Audit/telemetry:** `sandbox.exec_started`/`exec_finished` with label, duration, exit class (no argv, no output) written as events for Activity; high-volume labels (herdr polling) are aggregated.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ProcessRunner.spawn` for the host `container exec` process (BOX003 `ContainerCli.exec`), `Secret` (ARCH012), redaction (ARCH004), `Clock`. Do not spawn `container` directly anywhere else.

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/exec/{exec-service.ts,exec-spec.schema.ts,secret-env-file.ts,supervisor.ts,output-caps.ts,cancel.ts}` plus a tiny `ovm-supervisor.sh` added to the image by OVE_BOX005 (proposal if missing). Pure validation in `exec-spec.schema.ts`.

## 9. Security and safety

Abuse cases: (1) prompt-injected text becomes an argument beginning with `--` or containing `;`: argv is delivered literally, no shell; (2) command asks for `cwd: '/'` or `/work/../..`: rejected; (3) a command forks and daemonises to survive cancel: the supervisor kills the process group and the leak check reports it; destroying the Environment is the guaranteed cleanup; (4) a huge output flood exhausts engine memory: caps and backpressure; (5) secrets in env visible in `ps` output on the host: avoided via env-file/fd, and `container exec` argv contains no values; (6) exec on a stopped or drifted Environment: refused. Fail closed everywhere.

## 10. Errors and edge cases

- Container dies during exec: `exited` resolves with `signal: null, exitCode: null` and `box.oom_killed` if inspect shows OOM, else `box.cli_failed`.
- Engine restarts mid-exec: the host `container exec` process dies; the in-container process is killed by the supervisor on stdin EOF; the reaper checks leftovers.
- Command not found in the container: exit 127 returned as exit code, not an adapter error.
- Argument larger than limits: `box.exec_denied` with reason `argv_too_large`.
- Zero-length output: fine.
- Unicode and invalid UTF-8: bytes preserved on the stream API.

## 11. Acceptance criteria

- [ ] `cwd` other than `/work` or `/work/...` is rejected; default is `/work`; a test with a fake runner asserts `--workdir /work` is always present.
- [ ] A shell metacharacter string as a single argv element is delivered unchanged (integration test with `printf %s`).
- [ ] Timeout and cancel kill the process tree and report flags; a leaked-process scenario is detected.
- [ ] Output beyond the cap sets `truncated` and does not grow memory.
- [ ] Secret env values never appear in host argv or logs (`expectNoSecrets`, `ps` snapshot test).
- [ ] Execs on a non-running or unverified Environment fail closed.
- [ ] `Sandbox.contract` exec section passes.

## 12. Test plan

Unit: spec schema table, cap logic, env-file lifecycle. Fake-runner tests for argv shape. Integration (macOS runner): echo, exit codes, timeout, cancel, fork bomb containment (pids limit), stdin streaming. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/exec`.

## 13. Parallelization notes

Parallel with BOX011 and BOX015 after BOX008 merges. PROV004/PROV009 use `exec` only through the `Sandbox` port. Hotspot: `supervisor.ts` and the image helper (coordinate with BOX005 owner by proposal).

## 14. Open questions and assumptions

- ASSUMPTION: `container exec` forwards signals poorly, hence the in-container supervisor; if 1.5.x forwards SIGTERM to the exec'd process, the supervisor is simplified to a process-group wrapper.
- Open: whether to expose a pty exec for debugging; MVP has none (herdr owns terminals).
