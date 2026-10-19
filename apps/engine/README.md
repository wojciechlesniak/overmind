# Engine command scaffold

This is the Node-only command front for the future ENGINE composition root.
It currently starts no gateway, database or LaunchAgent. The compose and service
foundation modules export only `UNIMPLEMENTED = true`; this marker reports no
working engine or service feature. Exact markers and absent hooks fail closed
with exit20 and `engine bootstrap not implemented` on stderr.

```sh
pnpm --filter @overmind/engine start version --json
pnpm --filter @overmind/engine build
node apps/engine/dist/engine.cjs version --json
pnpm --filter @overmind/engine test
pnpm exec vitest run --config vitest.int.config.ts tools/build/engine/process.int.test.ts
```

Commands:

- `run [--data-dir <path>] [--foreground]`: pass the supplied path as data to
  ENGINE, which owns canonicalization and access decisions. The scaffold does
  not read it. SIGTERM/SIGINT call `shutdown()` and exit0 after completion or a
  five-second deadline; a second signal exits130 immediately.
  Start failures before shutdown remove signal handlers. Once shutdown starts,
  its deadline and second-signal handling remain active until exit.
- `ensure-running [--json]`: ask the future service hook to start or find the
  engine, without creating a child daemon here.
- `version [--json]`: always available, independently of ENGINE hooks.
- `--help` / `-h`: usage; with `--json`, help goes to stderr.

Unknown commands, options, extra positionals, options belonging to another
command and more than4096 argv characters including separators exit64. Never
pass secrets as command-line arguments. Diagnostics never echo argv or dump
environment variables. Error text and ordinary service-result details use the
same home redaction, control-character removal and512-character limit before
they reach either JSON or stderr.
Closed output pipes exit0 for `version`,70 for other commands, without EPIPE output.

| Exit | Meaning                                      |
| ---- | -------------------------------------------- |
| 0    | Running / successful command                 |
| 10   | Already running                              |
| 20   | Cannot start, including missing ENGINE hooks |
| 30   | Incompatible protocol                        |
| 64   | Invalid command or arguments                 |
| 70   | Internal/import/hook error                   |
| 130  | Second shutdown signal                       |

`ensure-running --json` writes exactly one newline-terminated object, even for
an internal hook failure. Diagnostics use stderr. Its shape is:

```json
{
  "status": "failed",
  "pid": null,
  "socket": null,
  "version": "0.0.0",
  "protocol": 1,
  "detail": "engine bootstrap not implemented"
}
```

Status is `running`, `already_running`, `failed` or `incompatible`; successful
statuses have a positive safe-integer PID and non-empty socket, failures have
null PID/socket. Detail is a string or null. The CLI adds its own version and
protocol and maps each status to its fixed exit code. It rejects malformed hook
results instead of announcing success.

The Tauri shell accepts these named fields and the legacy SETUP010 three-field
receipt. It preserves rejection of unknown fields, verifies a positive PID and
the exact expected socket, then requires a real ping. A supplied protocol other
than1 produces the incompatible state. A legacy receipt without protocol is
accepted for compatibility and does not prove protocol agreement. The shell
ignores untrusted `detail` and never sends it to the webview.

`version --json` returns `{version,protocol,buildSha,node,platform,arch}`.
The bundle stamps root `package.json` version, Git short SHA (or `dev` for a
source archive) and the exported contracts `PROTOCOL_VERSION` once available,
otherwise1. There is no build timestamp. Running source directly falls back
to `0.0.0-dev`, protocol1 and SHA `dev`.

## ENGINE integration points

Future ENGINE/ARCH006 work replaces the marker in `src/compose/index.ts` with
`startEngine(options: {dataDir?: string; foreground: boolean}): Promise<never>`
and `shutdown(): Promise<void>`. Future service lifecycle work replaces the marker
in `src/service/index.ts` with `ensureRunning({json: boolean}): Promise<EnsureResult>`;
the result type is exported by `src/commands/ensure-running.ts`.

The guarded literal dynamic imports load these modules lazily. Only a nonnull
module object whose sole own enumerable export is `UNIMPLEMENTED` with value
`true` is a foundation marker. False, malformed or extra exports follow normal
hook validation; real hooks still execute. The missing-module URL must exactly
match the expected hook, including its directory; an identically named nested
dependency is an internal error. Exceptions inside a present hook also remain
internal errors. Esbuild includes the foundation or real modules when present.
Hook code must keep stdout reserved for the CLI receipt.

The engine runtime graph contains adapters, application, contracts, domain,
gateway and workflow-runtime. UI-kit and API-client are desktop dependencies and
are absent from the engine manifest and TypeScript project references.

## Bundle contract

`../../tools/build/engine/bundle.mjs` produces `dist/engine.cjs`, `engine.cjs.map` and
`engine.meta.json`, using exact esbuild0.28.2, CJS, Node22, external source maps,
linked legal comments and no minification. CJS module URLs are computed from the
runtime `__filename`, preserving optional-import identity without host build paths.
`bundleEngine({root?,outfile?})` is
the packaging entry; the CLI accepts `--out-dir <path>`. Maps use stable
virtual file URLs under the `overmind/source/` namespace and contain no host build paths. The
metafile is checked before files are written: desktop code, React, Tauri,
undeclared npm packages, escaping source paths and unexpected external imports
are rejected. Only Node builtins and exact absent optional-hook paths in source fixtures may
remain external; present foundation modules are bundled. Installation scripts
stay disabled.

SETUP017 owns SEA injection, external-map deployment/symbolication and two-build
executable reproducibility. SETUP014 owns Developer ID signing and notarization;
this source bundle test is not evidence of a distributable signed application.
