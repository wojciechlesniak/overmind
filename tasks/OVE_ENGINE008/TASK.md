---
id: OVE_ENGINE008
title: launchd ServiceManager adapter (user LaunchAgent plist, install, start, stop, status)
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH005, OVE_ARCH012, OVE_ARCH013, OVE_ARCH014]
soft_depends_on: [OVE_SETUP011]
provides: ["lib:service-manager-launchd", "port:ServiceManager.impl"]
needs: ["port:ServiceManager", "port:ProcessRunner", "port:AtomicFileWriter", "lib:data-dir", "port:Logger"]
owns: ["packages/adapters/service-macos/**", "apps/engine/src/composition/modules/platform.macos.service.module.ts"]
reads: ["packages/application/src/ports/ServiceManager.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5, 9]
---

# OVE_ENGINE008: launchd ServiceManager adapter

## 1. Summary

Implement the `ServiceManager` port for macOS: install the engine as a per-user LaunchAgent (label `dev.overmind.engine`), start/stop it with `launchctl`, report status, and manage the auto-start flag. No root, no daemon in `/Library`.

## 2. Context

ADR 0005: the engine runs as a user service independent of the window. SETUP010 expects the engine to install and start its own LaunchAgent on `ensure-running`. The port (ARCH012) is: `install(spec)`, `uninstall()`, `status()`, `start()`, `stop()`, `isAutoStartEnabled()`, `setAutoStart(enabled)`. This adapter lives in `adapters/service-macos` (platform code only there, ADR 0009).

## 3. Scope (in)

- Plist generation, `launchctl` command construction (domain `gui/<uid>`), status parsing, error mapping, contract runner (`@macos @real`).

## 4. Out of scope

- The decision when to install (ENGINE009). Code signing / login-item approval UX (SETUP014 documents that macOS may show "Background items added" notification).

## 5. Detailed requirements

1. Plist path `~/Library/LaunchAgents/dev.overmind.engine.plist` (mode 0644 as launchd requires; directory is the user's). Content generated from the spec: `Label`, `ProgramArguments: [<abs path to the engine executable inside the app bundle>, "run", "--foreground"]`, `RunAtLoad: true`, `KeepAlive: { SuccessfulExit: false, Crashed: true }` (restart after crash, not after a clean exit), `ProcessType: Background`, `ThrottleInterval: 10`, `StandardOutPath`/`StandardErrorPath` = `<dataDir>/logs/launchd.log`, `EnvironmentVariables` limited to `OVERMIND_DATA_DIR` when non-default (never secrets), `WorkingDirectory` = data dir, `AbandonProcessGroup: true` (so sandbox helpers survive an engine restart), `LimitLoadToSessionType: Aqua`.
2. XML is produced by a small serializer with escaping (no template string with user data); values validated: executable path must be absolute, exist, be inside an `.app` bundle `Contents/MacOS` or the dev override, owned by the current user or root, not group/world writable.
3. Commands (via `ProcessRunner`, argv only): `launchctl bootstrap gui/<uid> <plist>`, `launchctl bootout gui/<uid>/dev.overmind.engine`, `launchctl kickstart -k gui/<uid>/dev.overmind.engine` (start/restart), `launchctl print gui/<uid>/dev.overmind.engine` (status parsing: `state = running|waiting|exited`, `pid`), `launchctl enable|disable gui/<uid>/dev.overmind.engine` (auto-start flag). Never uses deprecated `load/unload`, never `sudo`.
4. `install` is idempotent: if the plist content is identical and the job is bootstrapped, no-op; if the content differs (app moved/updated) rewrite atomically (AtomicFileWriter, mode 0644 override) and `bootout` + `bootstrap`. Binary path changes after an app update are therefore healed at the next `ensure-running`.
5. `status()` maps to `not_installed | stopped | running | unknown`; parse failures -> `unknown` with a warning (launchctl output format is not an API; parser tolerant, covered by fixtures from macOS 26).
6. Errors: `platform.service_install_failed`, `platform.service_not_permitted` (e.g. login item blocked by the user in System Settings -> detail key tells the Owner where to enable), mapping from launchctl exit codes (5 I/O error, 113 not found, 125 domain does not support).
7. `uninstall` removes the job and the plist and, by Owner request only, nothing else (data stays).
8. Dev mode: label gets suffix from `OVERMIND_ENV=dev` (`dev.overmind.engine.dev.<hash>`) and the installer refuses to run against the real label when `OVERMIND_DATA_DIR` is a dev dir (SETUP012 guard) so dev work never touches the Owner's real service.
9. The fake `FakeServiceManager` (TEST002) is the Linux implementation; the contract suite `ServiceManager.contract` runs against both; `@real` run uses a throwaway label `dev.overmind.test.<random>` and cleans up.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ProcessRunner` (shell-free), `AtomicFileWriter`, `DataDirLayout`, fakes and contract (TEST002/003).

## 8. Architecture and code placement

`packages/adapters/service-macos/src/{launchd-service-manager.ts,plist.ts,launchctl.ts,parse-print.ts}`; module providing `ServiceManagerToken` for darwin only. Adapters do not import each other.

## 9. Security and safety

The plist decides what runs at login: the program path is validated and the file is written atomically, so another process cannot swap it half-way; the engine path must live in the signed app bundle (the Gatekeeper/notarization chain). Environment variables are whitelisted. No privileged operations. Uninstall leaves no autorun behind. Hardened: refuses a plist directory that is a symlink.

## 10. Errors and edge cases

- App moved to Trash: next start from another location rewrites the plist; the old path job fails to spawn and `launchd` throttles; `install` handles via bootout.
- User disabled the login item: `service_not_permitted`, engine can still run when started by the app (non-service mode, flagged).
- `launchctl` missing (not macOS): module not loaded.
- Plist present but job not loaded: `install` bootstraps.
- Concurrent installs from two app instances: serialised by the engine lock (ENGINE003) / single-instance Tauri plugin.

## 11. Acceptance criteria

- [ ] Generated plist matches a golden fixture and is valid per `plutil -lint` (macOS CI).
- [ ] Second `install` with identical spec performs no `launchctl` mutation.
- [ ] Path validation rejects relative, world-writable and symlink targets.
- [ ] `status` parses fixtures for running, waiting, not found.
- [ ] Contract suite passes for the fake and (macOS, opt-in) the real adapter.
- [ ] Dev label never equals the production label.

## 12. Test plan

Unit: plist serializer, parser fixtures, command builders with `FakeProcessRunner`. Real macOS tests tagged `@macos @real`. Commands: `pnpm vitest run packages/adapters/service-macos`.

## 13. Parallelization notes

Independent of the gateway; parallel with ENGINE010+.

## 14. Open questions and assumptions

- ASSUMPTION: `KeepAlive` crash-only so a clean quit stays quit.
- Open: whether to use `SMAppService` (needs Rust/Swift helper) instead of a plist; default plist (no native code).
