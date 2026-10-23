---
id: OVE_ARCH005
title: Define configuration and the data-directory layout with permissions
area: ARCH
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH056, OVE_ARCH013]
soft_depends_on: []
provides: ["lib:data-dir", "lib:config", "contract:AppConfig", "port:ConfigStore", "lib:data-directory-layout"]
needs: ["port:AtomicFileWriter"]
owns: ["packages/contracts/src/config/**", "packages/application/src/config/**", "packages/application/src/ports/ConfigStore.ts", "packages/adapters/system/src/data-dir/**", "packages/adapters/system/src/config/**", "docs/architecture/data-directory.md"]
reads: ["docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 12", "SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [5, 8, 10, 18]
---

# OVE_ARCH005: Define configuration and the data-directory layout with permissions

## 1. Summary

Fix where Overmind keeps its files (`~/Library/Application Support/Overmind`), with which permissions, and how the versioned configuration file is validated, migrated and written atomically. One resolver gives every package the same paths; nothing hard-codes a path.

## 2. Context

One installation, one Owner, everything local (ADR 0010). The engine, the Rust shell, herdr runtime and logs need predictable locations. macOS limits Unix socket paths to 104 bytes, which `~/Library/Application Support/Overmind/run/...` can exceed for long user names, so a fallback is needed. Secrets are never in the config (Keychain only, SR-06). Backups go to a folder the Owner chooses (spec 10); only a pointer is stored here.

## 3. Scope (in)

- `DataDirLayout` (pure paths) and `resolveDataDir(env, platformInfo)`.
- `DataDirInitializer` creating the tree with permissions and verifying existing permissions.
- `AppConfig` zod schema (v1), defaults, `ConfigStore` port, file-based implementation with atomic writes, migrations, corrupt-file handling.
- Socket path resolver with the 104-byte fallback.
- Documentation `docs/architecture/data-directory.md`.

## 4. Out of scope

- SQLite schema and migrations: DATA. Backup job and format: BACKUP. Settings UI: SETUI.
- Atomic write primitive: `OVE_ARCH013` (consumed through `port:AtomicFileWriter`).
- Keychain access: `OVE_ARCH012`.

## 5. Detailed requirements

1. **Root:** `~/Library/Application Support/Overmind/` (`dataDir`). Override only via env `OVERMIND_DATA_DIR` (used by dev scripts `OVE_SETUP012` and tests); the override MUST be absolute, MUST NOT be inside another user's home or `/tmp` world-writable roots without a 0700 owner-only check, and MUST be reported in the init result so the engine can log it at startup (redacted).
2. **Layout** (permissions: directories 0700, files 0600, enforced and verified):
   ```
   Overmind/                       0700
     config/
       config.json                 0600  versioned AppConfig (no secrets)
       config.json.bak             0600  last good copy
     db/
       overmind.sqlite (+ -wal, -shm)  0600   (owned by DATA)
       snapshots/                  0700  rolling DB snapshots (herdr pattern; owned by BACKUP)
     run/                          0700
       engine.pid                  0600
       engine.lock                 0600  advisory lock, single engine per user
       gateway.sock                0600  Unix socket (see requirement 6)
       gateway.sock.path           0600  pointer when the socket lives elsewhere
       session-token               0600  gateway session token, rotated at every engine start
       herdr/                      0700  herdr runtime dir (sockets 0600 created by herdr; session.json)
     logs/                         0700  engine.log, desktop.log (+ rotations)
     backups/
       backup-target.json          0600  pointer: { folderBookmark|path, lastSuccessAt }
     artifacts/                    0700  content-addressed blobs (owned by DATA)
     cache/                        0700  disposable
     tmp/                          0700  cleared at engine start
   ```
   Containers' volumes are managed by the container runtime and referenced by name in the DB, not stored here.
3. `DataDirLayout` exposes typed accessors (`layout.configFile`, `layout.dbFile`, `layout.logsDir`, `layout.socketPreferred`, ...). No other module concatenates paths with the data directory. A test greps the repo for the literal `Application Support` outside this module and fails.
4. **Initialisation (`DataDirInitializer.ensure()`)**: create missing directories with mode 0700 using `mkdir` then `chmod` (umask-independent); for existing entries check owner uid equals current uid and mode is not group/world accessible; on violation, try to fix once (`chmod`) and report it in the returned `warnings[]` (this task has no Logger dependency; the engine entry logs them); if it cannot be fixed (different owner, symlink, wrong type), fail with `config.data_dir_insecure` and refuse to start (fail closed). Symlinks as the data dir root or as any of its direct children are rejected (`config.data_dir_symlink`). `tmp/` is emptied at start.
5. **Socket path.** Preferred `<dataDir>/run/gateway.sock`. If its UTF-8 byte length is >= 100, use `<os.tmpdir()>/ovm-<uid>/g.sock` (dir 0700, created and verified like above) and write the absolute path to `run/gateway.sock.path`. Clients (api-client, Rust shell) resolve through the same function/algorithm: read `.path` pointer if present, else preferred path. Document the algorithm in Rust-portable terms for `OVE_SETUP010`.
6. **AppConfig v1** (zod, `.strict()`, all fields have defaults):
   ```ts
   AppConfig = { schemaVersion: 1,
     locale: 'en' | 'pl',                      // default 'en'; first run may set from system locale
     engine: { maxParallelAgents: int 1..10 (default 3, spec 9), shutdownGraceSeconds: int 5..300 (default 30) },
     logging: { level: LogLevel (default 'info'), diagnosticMode: boolean (default false), diagnosticModeUntil?: ISO },
     gateway: { socketPathOverride?: string },   // dev/test only; rejected in release builds
     backup: { enabled: boolean (default true), time: 'HH:MM' (default '03:00'), retentionDays: int (default 14) },
     notifications: { sound: boolean (default true) },
     providers: { fallbackOrder: string[] },     // ids only
     telemetry: { enabled: false }               // literal false; ADR 0010: no telemetry without explicit consent
   }
   ```
   No secrets, tokens, API keys, chat ids or file contents in config: the schema has no such fields and a test enumerates all keys against a deny-regex. Telegram pairing data lives in the DB (TG area), bot token in Keychain.
7. **Versioning and migration:** `schemaVersion` integer. `migrateConfig(raw): Result<AppConfig>` applies ordered migration functions `v1->v2...` one file each in `packages/application/src/config/migrations/NN-<name>.ts`. A config with a higher `schemaVersion` than supported: refuse to overwrite, run in read-only config mode with defaults and show `config.newer_version` (never downgrade silently).
8. **ConfigStore port:** `load(): Promise<Result<AppConfig>>`, `update(patch: DeepPartial<AppConfig>): Promise<Result<AppConfig>>` (validated, atomic write via `AtomicFileWriter`, keeps `.bak`), `onChange(handler): Unsubscribe`. Unknown keys in the file are preserved on update under `_unknown` is NOT done (strict schema): unknown keys cause a validation warning, are dropped, and the original is kept as `config.json.bak` before the first rewrite.
9. **Corrupt file:** invalid JSON or schema failure: move to `config.json.corrupt-<timestamp>` (0600), load `.bak` if valid, else defaults; return `recovered: { reason, quarantinedPath }` in the load result so the caller logs a `warn` and emits the startup notice event `config.recovered` so the UI can tell the Owner. Never loop-crash.
10. **Environment variables** accepted (documented table): `OVERMIND_DATA_DIR`, `OVERMIND_LOG_LEVEL` (dev), `OVERMIND_DEV`, `OVERMIND_FAULTS` (non-release only, see TEST011). All others ignored. Env is read in exactly one place (`adapters/system/src/env.ts`), not in application code.
11. **Permissions on update:** every file the engine writes under `dataDir` is created with mode 0600 (explicit `mode` argument, not umask). `artifacts/` and `db/` ownership belongs to DATA/BACKUP but they MUST use `layout` and the initialiser.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AtomicFileWriter` (ARCH013), `Result`/`AppError` (ARCH003), `Clock` (ARCH007) for corrupt-file timestamps. This task deliberately does NOT depend on `Logger` (ARCH004 depends on this task for `logsDir`); all functions return `warnings[]`/events for the caller to log. The Rust shell and Playwright harness reuse the documented socket algorithm.

## 8. Architecture and code placement

- Contracts: `packages/contracts/src/config/app-config.ts`, `config/defaults.ts`.
- Application: `packages/application/src/config/{migrate-config.ts,migrations/*,config-service.ts}`, port `ports/ConfigStore.ts`, port `ports/DataDir.ts` (layout + initialiser interface; pure `DataDirLayout` is in application because it is just path arithmetic with an injected `home` string).
- Adapter: `packages/adapters/system/src/data-dir/{initializer.ts,socket-path.ts}`, `config/file-config-store.ts`, `env.ts` (the only reader of `process.env`).
- Dependency direction: adapter -> application ports -> contracts. Pure path arithmetic has no I/O (testable on Linux).

## 9. Security and safety

Data directory is the crown jewel (DB, logs, session token). Owner-only permissions, symlink rejection, verification at every start (fail closed) and no group/world access. The session token file is 0600 and never logged (ARCH004 pattern). No secrets in config; backups pointer stores a path/bookmark, not credentials. `OVERMIND_DATA_DIR` override cannot point into world-writable locations. Unknown config keys never executed or interpolated. A downgrade protection prevents an older app version from corrupting newer data.

## 10. Errors and edge cases

- Home directory unresolvable: `config.home_unresolved`, stop.
- Data dir on a network or case-sensitive volume: allowed; case-insensitive comparisons are not used for the layout.
- Concurrent engine start: `run/engine.lock` advisory lock; second instance exits with `config.already_running` (message tells the Owner the engine is already running).
- Stale pid/lock/socket after crash: verify pid is dead (`kill(pid,0)`) before removing; never remove a live socket.
- Disk full during config write: atomic writer leaves the old file; return `data.disk_full`.
- Clock skew affecting `retentionDays`: not handled here.
- Config edited by hand to `maxParallelAgents: 0`: validation error, keep previous value, log.

## 11. Acceptance criteria

- [ ] `ensure()` creates the full tree with 0700 dirs and 0600 files regardless of umask (tested with umask 000 and 077).
- [ ] An existing directory with mode 0755 is repaired to 0700 with an entry in `warnings`; a directory owned by another uid, or a symlink root, aborts start with the stated codes.
- [ ] Socket path above 100 bytes falls back to the tmp location and writes the pointer file; short paths do not.
- [ ] `AppConfig` defaults parse from `{}`; unknown keys are reported; no key matches the secret deny-regex.
- [ ] A v1 config migrates through a fake v2 migration in tests; a future version is read-only and not overwritten.
- [ ] A corrupt config is quarantined and `.bak` or defaults are used, with a `config.recovered` event.
- [ ] Only `adapters/system/src/env.ts` reads `process.env` (lint).
- [ ] The repo contains no other literal path to the data directory (grep test).

## 12. Test plan

- Unit: `data-dir-layout.test.ts` (pure), `socket-path.test.ts` (byte length with multi-byte names), `migrate-config.test.ts`, `app-config.test.ts` (defaults, deny-regex).
- Integration (temp dir, real fs): `initializer.int.test.ts` (modes, umask, symlink, wrong owner via mocked `stat` only where unavoidable), `file-config-store.int.test.ts` (atomicity with injected failure of the writer, corrupt recovery).
- Contract: `ConfigStore.contract.ts` (TEST003) against in-memory and file store.
- Commands: `pnpm vitest run packages/adapters/system packages/application/src/config`.

## 13. Parallelization notes

Layout and config schema can merge first; `ARCH004` needs `logsDir`, `SETUP012` needs `OVERMIND_DATA_DIR`. Other areas add config fields by adding a section in `packages/contracts/src/config/sections/<area>.config.ts` that the generator composes into `AppConfig` (additive-only); they never edit `app-config.ts`. (Mechanism: ARCH009 barrel generator; until then this task provides `defineConfigSection`.)

## 14. Open questions and assumptions

- ASSUMPTION: `backup-target.json` stores a plain path first; macOS security-scoped bookmarks are only needed if the app is sandboxed (it is not, Tauri without App Sandbox, to be confirmed by SETUP014).
- ASSUMPTION: socket fallback directory `/var/folders/.../T/ovm-<uid>` (per-user tmpdir) is acceptable; dir mode 0700 and uid check apply.
- Open: whether config changes require engine restart; default hot-reload for `logging.level` and `notifications.sound`, restart for the rest.
