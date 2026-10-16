---
id: OVE_SETUP010
title: apps/desktop/src-tauri minimal shell (capabilities, CSP, sidecar declaration)
area: SETUP
kind: security
size: M
priority: P0
mvp: true
status: in_review
depends_on: [OVE_SETUP001, OVE_SETUP009]
soft_depends_on: [OVE_SETUP011, OVE_SETUP008]
provides: ["lib:tauri-shell", "lib:tauri-capabilities", "lib:csp", "lib:engine-ensure-running-contract", "lib:desktop-gateway-bridge"]
needs: []
owns:
  - apps/desktop/src-tauri/Cargo.toml
  - apps/desktop/src-tauri/Cargo.lock
  - apps/desktop/src-tauri/build.rs
  - apps/desktop/src-tauri/tauri.conf.json
  - apps/desktop/src-tauri/capabilities/**
  - apps/desktop/src-tauri/permissions/**
  - apps/desktop/src-tauri/src/main.rs
  - apps/desktop/src-tauri/src/lib.rs
  - apps/desktop/src-tauri/src/engine.rs
  - apps/desktop/src-tauri/src/gateway_bridge.rs
  - apps/desktop/src-tauri/src/pick_directory.rs
  - apps/desktop/src-tauri/src/transport.rs
  - apps/desktop/src-tauri/src/native_io.rs
  - apps/desktop/src-tauri/src/sidecar.rs
  - apps/desktop/src-tauri/icons/**
  - rust-toolchain.toml
  - apps/desktop/scripts/check-tauri-config.mjs
reads: ["apps/desktop/package.json", "apps/desktop/dist"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [3, 5, 9, 18, 20]
---

# OVE_SETUP010: apps/desktop/src-tauri minimal shell (capabilities, CSP, sidecar declaration)

## 1. Summary

Create the Rust/Tauri 2 shell as thin as possible: one window, a deny-by-default capability set, a strict CSP, a declared sidecar for the engine, a byte-level bridge from the webview to the engine's owner-only Unix socket, and a native folder picker command. The shell contains no business logic and starts the engine only through a documented `ensure-running` contract so the engine keeps running after the window closes.

## 2. Context

ADR 0005: the engine is a separate process that outlives the window; ADR 0018: Tauri 2 + React; ADR 0003: deny by default; CONVENTIONS section 6: the Rust shell only handles window, tray and starting the engine. The tray menu is the TRAY area, notifications are `adapters/notifications-macos`, Keychain access is `adapters/keychain-macos`; none of them live in Rust here. The gateway is "authenticated, owner-only Unix socket" (PLAN section 1). A WebKit webview cannot open Unix sockets, so the shell provides a dumb bridge command. Pinned versions (verified 2026-10-13, OVE_SETUP008): `@tauri-apps/cli 2.12.2`, `@tauri-apps/api 2.12.3`, crates `tauri 2.12.3` (MSRV 1.90), `tauri-build 2.7.2`, `tauri-plugin-shell 2.5.0`, `tauri-plugin-single-instance 2.5.3`, `tauri-plugin-dialog 2.8.2`, Rust 1.90.0.

## 3. Scope (in)

- Cargo project, `build.rs` with an app permission manifest, `tauri.conf.json`, `capabilities/main.json`, `permissions/*.toml`, `rust-toolchain.toml`.
- Rust modules: `lib.rs` (builder), `engine.rs` (ensure running), `gateway_bridge.rs` (byte bridge), `pick_directory.rs`.
- `apps/desktop/scripts/check-tauri-config.mjs` (static policy checks on the config and capability files).
- `tauri` script in `apps/desktop/package.json` and dev dependencies `@tauri-apps/cli`, `@tauri-apps/api` (catalog).
- Placeholder icons (generated from a single 1024 px source later by DS/branding).

## 4. Out of scope

- Tray menu items and Global Pause entry: TRAY area. Window chrome, drag regions: SHELL.
- The engine itself, its LaunchAgent plist and the `ensure-running` implementation: ENGINE area (service lifecycle) and OVE_SETUP016/017 (packaging).
- Gateway protocol and authentication details: ENGINE/SEC (OVE_SEC005). The shell only forwards bytes.
- Code signing and notarization, entitlements file: OVE_SETUP014.
- Bundling herdr resources: OVE_SETUP015 (adds a `resources` entry).
- Auto-updater: explicitly not included (decision in requirement 11).

## 5. Detailed requirements

1. **Cargo.toml.** `name = "overmind-desktop"`, `edition = "2024"`, `rust-version = "1.90"`, `license = "Apache-2.0"`, `publish = false`. Dependencies pinned with `=`: `tauri = { version = "=2.12.3", default-features = false, features = ["tray-icon", "wry", "compression"] }` (the implementer verifies the feature names against the pinned crate and records any change), `tauri-plugin-shell = "=2.5.0"`, `tauri-plugin-single-instance = "=2.5.3"`, `tauri-plugin-dialog = "=2.8.2"`, `serde`, `serde_json`, `tokio` (features `net`, `io-util` only) with exact versions from the matrix. `[build-dependencies] tauri-build = "=2.7.2"`. `[profile.release]`: `lto = true`, `codegen-units = 1`, `panic = "abort"`, `strip = true`. `#![forbid(unsafe_code)]` in `lib.rs` and `main.rs`. `Cargo.lock` committed. `rust-toolchain.toml`: `channel = "1.90.0"`, components `rustfmt`, `clippy`, target `aarch64-apple-darwin`.
2. **Window.** One window, label `main`, title "Overmind", 1440x900 default (the design viewport), minimum 1024x680, `resizable`, `visible: true`, no remote URL, no devtools in release (`devtools` feature off; dev builds only via `tauri dev`). `app.security.freezePrototype = true`. `app.macOSPrivateApi = false`. `capabilities: ["main"]` listed explicitly in `app.security` so no other capability file is auto-enabled.
3. **CSP** (`app.security.csp`, exact string): `default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src ipc: http://ipc.localhost; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; frame-src 'none'; worker-src 'self'`. `style-src-attr 'unsafe-inline'` exists only because React Flow and the DS set element `style` attributes; `style-src` without it forbids `<style>` injection. `devCsp` = same plus `connect-src ... ws://127.0.0.1:5173 http://127.0.0.1:5173` and `script-src 'self' 'unsafe-inline'` only if the Vite preamble needs it (record the finding). Tauri's automatic nonce/hash injection stays enabled (`dangerousDisableAssetCspModification` is `false`). No `unsafe-eval` anywhere. `asset` protocol disabled.
4. **Capability file `capabilities/main.json`:** `identifier: "main"`, `windows: ["main"]`, no `remote` block (remote origins can never call IPC), `permissions`: only `core:event:allow-listen`, `core:event:allow-unlisten` (for bridge channel events), `allow-gateway-request`, `allow-gateway-subscribe`, `allow-pick-directory` (custom app permissions). NO `shell:*`, `fs:*`, `http:*`, `opener:*`, `process:*`, `global-shortcut:*`, `clipboard-manager:*`, `os:*`, `path:*`, `window:allow-*` unless the SHELL area proposes one with a reason (open question 14.3). `permissions/*.toml` define the three custom permissions via `tauri_build::AppManifest::commands`.
5. **Policy check script** `apps/desktop/scripts/check-tauri-config.mjs` (run by the `lint` of this package and by CI via `check:tauri`): fails if the capability permissions are not a subset of the allow-list in `scripts/tauri-permission-allowlist.json`, if the CSP differs from the pinned string (diff printed) or contains `unsafe-eval`, `*`, `http:`/`https:` sources other than `http://ipc.localhost`, if `dangerousRemoteDomainIpcAccess` or `remote` appears, if `app.security.assetProtocol.enable` is true, if `externalBin` has anything but `binaries/overmind-engine`, or if more than one capability file exists.
6. **Shell plugin used from Rust only.** `tauri-plugin-shell` is registered so Rust can call `app.shell().sidecar("overmind-engine")`, but because no capability grants `shell:*`, the webview cannot spawn anything. `bundle.externalBin = ["binaries/overmind-engine"]`; the binary file name carries the target triple (`overmind-engine-aarch64-apple-darwin`); produced by OVE_SETUP017 into `src-tauri/binaries/` (gitignored). For dev builds without the binary, the shell logs a clear error and shows the window anyway (the UI then shows the engine-unavailable state).
7. **Engine start contract (`engine.rs`).** On `setup`, and on every window `focus`-after-hidden event, call `ensure_engine_running()`: (a) check the engine control socket path `~/Library/Application Support/Overmind/run/engine.sock` (path constants come from the data-directory layout of OVE_ARCH005) by connecting and sending the contract line `{"method":"ping"}` with a 500 ms timeout; if it answers, done; (b) otherwise run the sidecar once as `overmind-engine ensure-running --json` and wait for exit (timeout 15 s). The engine itself installs/starts its per-user LaunchAgent (label `dev.overmind.engine`, `KeepAlive` on crash, `RunAtLoad`) and daemonizes, then the command exits with status 0 and prints `{"status":"running","pid":N,"socket":"..."}`. The shell never keeps the engine as its child: quitting the app MUST NOT stop the engine (ADR 0005). Exit codes: 0 running, 10 already running, 20 cannot start (message), 30 incompatible version (engine newer/older than the app protocol; the UI shows the version mismatch state). The shell reports the result to the webview through the event `engine:status` with payload `{state: "running"|"starting"|"unavailable"|"incompatible", detail?: string}`; it contains no retry policy beyond one retry per focus event, rate limited to once per 10 s.
8. **Gateway bridge (`gateway_bridge.rs`).** Two commands: `gateway_request(method: String, path: String, headers: Vec<(String,String)>, body: Option<Vec<u8>>) -> {status, headers, body}` and `gateway_subscribe(path: String, on_event: Channel)` for streaming (server-sent events or newline-delimited JSON). It connects to the gateway socket `.../run/gateway.sock` (owner-only, mode 0600; the shell verifies the socket file is owned by the current user and not world/group accessible before connecting, else it refuses), writes an HTTP/1.1 request, and returns the bytes. It validates only shape: `path` must start with `/v1/`, contain no `..`, no `\r` or `\n`, length <= 2048; `method` one of GET, POST, PUT, PATCH, DELETE; header names/values without CR/LF; body <= 8 MiB; per-request timeout 30 s (streams are unbounded but cancel on window close). It adds NO authentication logic itself: the bearer token required by the gateway (OVE_SEC005) is attached by the webview's `api-client` from the value returned by the engine at handshake. ASSUMPTION marked in 14.1.
9. **Folder picker (`pick_directory.rs`).** Command `pick_directory(title: String) -> Option<String>` opens the native macOS folder dialog via `tauri-plugin-dialog` (Rust API), returns the canonical absolute path string or `None` on cancel. It performs no access decision and no reading; the engine canonicalises and validates the path (OVE_SEC002) before use. This is the implementation of the "File dialog" platform port (OVE_ARCH012).
10. **Single instance.** `tauri-plugin-single-instance`: a second launch focuses the existing window.
11. **No updater in MVP.** `tauri-plugin-updater` is not a dependency; updates are by downloading a new notarized `.dmg` (or a Homebrew cask later). Reasons: an updater needs a persistent signing key and an update endpoint (more attack surface), and the engine, herdr bundle and container image must be updated consistently, which needs its own design. Revisit post-MVP via ADR.
12. **No business logic.** Rust modules above are the complete list; each file < 200 lines; no database, no filesystem reads except the socket path checks, no JSON processing beyond forwarding. A test counts `src/*.rs` files and fails if a new one appears without updating the allow-list in the config check script.
13. **Dev flow.** `beforeDevCommand: "pnpm --filter @overmind/desktop dev"`, `devUrl: "http://127.0.0.1:5173"`, `beforeBuildCommand: "pnpm --filter @overmind/desktop build"`, `frontendDist: "../dist"`. `bundle.targets: ["app", "dmg"]`, `bundle.macOS.minimumSystemVersion: "26.0"`, `bundle.macOS.hardenedRuntime: true`, `identifier: "dev.overmind.app"` (ASSUMPTION), `version` read from `../package.json`.
14. **Logging.** Rust uses `eprintln!`-free structured lines to the shell log file under `~/Library/Logs/Overmind/desktop.log` created with mode 0600; the log never contains request bodies or headers (they may carry the token).

## 6. Design notes

N/A, functionality only. (Window title bar style and traffic-light placement are SHELL decisions; this task keeps the default decorated window.)

## 7. Reuse

Reuses `frontendDist` from OVE_SETUP009 and the dist guard; the socket paths come from OVE_ARCH005 (`lib:data-directory-layout`) instead of re-declaring them (until it lands, the shell uses constants in one `paths` section in `engine.rs` marked `ASSUMPTION`). The folder-picker command is the single implementation of the file-dialog port.

## 8. Architecture and code placement

Layer: platform adapter (the only Rust in the product, ADR 0009). Files under `apps/desktop/src-tauri/`. The webview side calls the three commands only through typed wrappers in `@overmind/api-client` (ENGINE area), never `invoke` strings scattered in features. The bridge is a transport; all semantic checks happen in the engine gateway.

## 9. Security and safety

- **Capabilities deny by default:** the webview has no filesystem, shell, HTTP, clipboard or opener access. Anything the UI needs from the OS goes through a named custom command with typed input.
- **CSP strict:** blocks inline/remote scripts, remote images/fonts, framing and form posts; `check-tauri-config.mjs` pins the exact policy.
- **Remote content:** the app loads only its bundled assets; `remote` capability blocks are forbidden; navigation to external URLs is blocked: register `on_navigation` returning false for anything but `tauri://localhost` / `http://tauri.localhost` (and `127.0.0.1:5173` in dev); `window.open` is blocked. Links to docs open through an explicit future command, not by the webview.
- **Bridge hardening:** path/method/header validation prevents request smuggling (CR/LF), SSRF (only the local socket is reachable), path traversal, and oversized bodies. Socket ownership/mode check prevents connecting to a socket planted by another user. Bridge errors never include request content.
- **Engine independence:** the engine is never a child of the shell, so a crash or quit of the UI cannot kill running work, and the UI cannot gain engine privileges (the sidecar runs with the same user rights, no elevation).
- **Sidecar integrity:** the declared `externalBin` is signed with the app (OVE_SETUP014); the shell does not execute arbitrary paths: only the sidecar name `overmind-engine` with the single fixed argument set `ensure-running --json`.
- **No updater, no network:** the shell makes no outbound connections.
- **Audit:** the shell does not decide anything security-relevant, so it writes no audit events; engine events record handshake and version mismatch.

## 10. Errors and edge cases

- Engine socket missing and sidecar missing: state `unavailable`, window still opens.
- `ensure-running` hangs: killed after 15 s, state `unavailable` with detail "timeout".
- Socket exists but belongs to another user or is group-writable: refuse, state `unavailable` with detail "insecure socket".
- Stale socket file (engine crashed): ping fails, `ensure-running` replaces it (engine's job).
- Version mismatch: exit code 30, state `incompatible`; the UI offers to quit or reopen after update.
- Webview sends an oversized body or invalid path: command returns a typed error `{code: "bridge.invalid_request"}`.
- Second app launch while the first is hung: single-instance plugin hands over; if the first window is unresponsive, the user quits via the tray/Activity Monitor (documented).
- Dev mode without Vite: window shows Tauri's load error; documented in `pnpm dev:tauri` help.

## 11. Acceptance criteria

- [x] `pnpm tauri build --debug` (or `cargo check`) succeeds with Rust 1.90.0 on macOS arm64 and `cargo clippy -- -D warnings`, `cargo fmt --check` pass.
- [x] `check-tauri-config.mjs` passes and fails on fixtures: extra permission `shell:allow-execute`, CSP with `unsafe-eval`, `remote` block, second capability file, extra `externalBin`.
- [x] Given a running fake engine socket answering ping, then `ensure_engine_running` does not start the sidecar (unit/integration test with a fake socket).
- [x] Given no engine, then the sidecar is invoked exactly once with `ensure-running --json`, and quitting the app leaves the (fake) engine process alive.
- [x] Given a `path` of `/v1/../etc` or containing `\r\n`, then `gateway_request` returns `bridge.invalid_request` without connecting.
- [x] Given a socket with mode 0666, then the bridge refuses to connect.
- [x] From the webview, `invoke("plugin:shell|execute")` fails with a permission error (Playwright/tauri-driver test or Rust unit test of capability resolution).
- [x] Navigation to `https://example.com` from the webview is blocked.
- [x] No `updater` crate or config key exists.
- [x] Rust source is `#![forbid(unsafe_code)]` and the file allow-list test passes.

## 12. Test plan

Rust unit tests (`cargo test`): request validation table tests, socket ownership check against temp files, engine contract state machine with a fake socket server (tokio). Node test for `check-tauri-config.mjs` with fixture configs. Smoke test in CI `rust` job (OVE_SETUP006) on macOS. A manual checklist in the PR: run the app, verify devtools are absent in release, verify `lsof` shows no listening TCP port from the shell. E2E that exercises the bridge belongs to OVE_TEST004 (mock gateway socket). Commands: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`, `node apps/desktop/scripts/check-tauri-config.mjs`.

## 13. Parallelization notes

Parallel with OVE_SETUP011, 012, 015 and, after OVE_SETUP009, with the SHELL and TRAY area tasks. Hotspots: `tauri.conf.json` and `capabilities/main.json` are owned here; TRAY, SHELL and OVE_SETUP015 request additions through `tasks/_proposals/` (each addition needs a security review because it widens the webview's powers). `Cargo.toml` edits by OVE_SETUP015 (resources) and TRAY (menu features) go through proposals too.

## 14. Open questions and assumptions

1. ASSUMPTION: the webview reaches the gateway through the bridge commands because WebKit cannot connect to Unix sockets. Alternative the ENGINE area may choose: loopback TCP with a per-launch token. If so, `connect-src` adds `http://127.0.0.1:<port>` and the bridge commands are removed; this is an Owner/ENGINE decision (flag for the linker).
2. ASSUMPTION: bundle identifier `dev.overmind.app` (requires a domain the Owner controls; may change before the first signed release because it affects macOS permission prompts and the keychain access group).
3. Open question for SHELL: a custom title bar needs `core:window:allow-start-dragging`; decide when the shell is designed.
4. ASSUMPTION: no auto-updater in the MVP (see requirement 11); Owner may reverse.
5. ASSUMPTION: Tauri feature names are as listed; if they differ in 2.12.3, use the documented equivalents and keep the surface minimal.

## 15. Implementation evidence and merge gate (2026-10-16)

Code review baseline: `71113cf6c2224f93dc47bd08d8ac8cf3eafd02a6` (latest DEVELOP).
Reviewed implementation: `0f681316a38145aa0aeb682465a92dd898a68073`.
Independent Standards/security and Spec reviews both PASS with zero remaining code
findings. Review corrections cover extended macOS ACLs, packaged-debug navigation,
case-insensitive platform configuration overrides and canonical SBOM PURL encoding.

- Local Rust 1.90.0, macOS 26.5.1 arm64: cargo check, embedded-frontend debug build,
  rustfmt check and Clippy all-targets with denied warnings pass.
- 26 Rust tests pass in both development and custom-protocol builds. Real Unix
  HTTP, credentials forwarding, 8 MiB limits, 30 s deadlines, pending stream cleanup,
  actual Tauri ACL resolution, helper arguments/15 s kill and service independence
  are exercised. Real chmod +a regressions preserve 0600/0700 while proving denial.
- Full sequential foundation verification: 189 unit tests (47 files), 20 distinct
  integration tests (8 files), lint, typecheck, frontend build, workflow/architecture
  checks, npm licenses and both npm audits pass. The architecture job repeats its
  four actual dependency-policy CLI cases. Whole `pnpm check` fails at cargo-deny.
- Native smoke with a separate temporary HOME: application survives missing engine,
  structured log is 0600, and lsof reports zero shell TCP listeners. No devtools
  feature is enabled. No physical escape test was run on the daily-use Mac.
- All 466 registry crates meet the 72-hour age floor and Rust <=1.90. Compatible
  fresh transitive releases were replaced by mature versions without a waiver.
- Full-history/tree secret scans report zero secrets. The real Syft SBOM includes
  841 components; local Cargo identity uses the verified source commit, while every
  component still requires PURL/version/license evidence. NOASSERTION is no approval.
- RustSec reports no blocking vulnerability and two visible Linux-only warnings;
  their exact IDs and target scope are in the license-block report. No ignore added.

- [ ] **Final merge gate:** the Owner approved only the 27 identified Rust package
  versions on 2026-10-16. Exact version/license/checksum enforcement, native Cargo
  exceptions, notices, complete MPL source archives and bundle resources are now
  implemented. Final full checks, independent reviews and hosted CI must pass
  before merge and before starting SETUP011. See
  [approval and enforcement](../_proposals/OVE_SETUP010-license-approval.md).

Dev entry point: `pnpm dev:tauri` starts loopback Vite and the Tauri shell;
`pnpm dev:tauri --help` displays CLI options. Without the future SETUP017 binary,
the window remains available and emits engine-unavailable status. Running cargo
directly in development requires Vite at 127.0.0.1:5173; otherwise Tauri displays
its load error. Signing, notarization and real release-isolation evidence remain
owned by their existing future tasks.
