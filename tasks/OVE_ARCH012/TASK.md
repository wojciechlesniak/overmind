---
id: OVE_ARCH012
title: Define the platform abstraction interfaces for Keychain, Sandbox, Tray and friends
area: ARCH
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH006, OVE_SEC002]
soft_depends_on: [OVE_ARCH014]
provides: ["port:Keychain", "port:Sandbox", "port:ServiceManager", "port:Notifier", "lib:desktop-platform", "contract:SecretRef", "lib:secret"]
needs: ["lib:path-guard"]
owns: ["packages/application/src/ports/Keychain.ts", "packages/application/src/ports/Sandbox.ts", "packages/application/src/ports/ServiceManager.ts", "packages/application/src/ports/Notifier.ts", "packages/application/src/platform/**", "apps/desktop/src/shared/platform/*.ts", "docs/architecture/platform-abstraction.md"]
reads: ["docs/architecture/ARCHITECTURE.md", "docs/research/prototyp-wnioski.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [4, 5, 9, 20, 22]
---

# OVE_ARCH012: Define the platform abstraction interfaces for Keychain, Sandbox, Tray and friends

## 1. Summary

Define, as ports with exact method lists and error semantics, every capability that depends on the operating system: Keychain, Sandbox (isolation runtime), ServiceManager (background engine as a user service), Notifier, and on the desktop side Tray, FileDialog and Clipboard. macOS implementations live only in `adapters/*-macos` and `src-tauri` (ADR 0009); everything else is testable on Linux through fakes.

## 2. Context

ADR 0009: system-dependent code (sandbox, keychain, tray, background service) sits behind interfaces so later Windows/Linux ports do not rebuild the core. Isolation is real OS-level (ADR 0004/0020): Apple `container` on macOS 26 with Apple silicon, Lima as a possible fallback; prototype facts (docs/research/prototyp-wnioski.md): CLI must start in `/work`, root filesystem read-only or ephemeral, CLI login credentials in a separate persistent volume, network egress only through a host-allowlist proxy, login needs a temporary port redirect. Engine-side ports vs UI-side interfaces: tray, file dialog and clipboard are implemented by the Tauri shell, so their TypeScript interfaces live in `apps/desktop`.

## 3. Scope (in)

- Engine ports: `Keychain`, `Sandbox`, `ServiceManager`, `Notifier` (interface, token, value types, error codes, contract-test requirements).
- `Secret` wrapper type and `SecretRef`.
- Desktop-side interfaces: `Tray`, `FileDialog`, `Clipboard`, `DesktopShell` (window/app lifecycle), with a Tauri implementation seam and a web/mock implementation.
- Error codes for platform failures (registered via ARCH003 format).
- Documentation `docs/architecture/platform-abstraction.md`: capability matrix per OS (macOS now, future columns marked).

## 4. Out of scope

- Implementations: Keychain macOS (SEC/Keychain adapter task owner = `adapters/keychain-macos`), Sandbox (BOX), notifications (NOTIF), service manager launchd (ENGINE), Tray UI (TRAY), Tauri bridging (SETUP010).
- Fakes: `OVE_TEST002`; contract suites: `OVE_TEST003`.

## 5. Detailed requirements

1. **Common rules:** every method returns `Promise<Result<T, AppError>>`; no method throws for expected failures; operations are cancellable via optional `{ signal?: AbortSignal }`; no method accepts or returns raw secrets except `Secret`; every port exposes `capabilities()` (sync, pure) so callers degrade or fail closed. Errors are registered in `packages/contracts/src/errors/platform.errors.ts` with codes listed below.
2. **Keychain** (`port:Keychain`):
   ```ts
   interface Keychain {
     store(ref: SecretRef, value: Secret, opts?: { overwrite?: boolean }): Promise<Result<void>>;
     read(ref: SecretRef): Promise<Result<Secret>>;        // platform.secret_not_found when missing
     exists(ref: SecretRef): Promise<Result<boolean>>;
     remove(ref: SecretRef): Promise<Result<void>>;        // idempotent
     list(prefix: string): Promise<Result<SecretRef[]>>;   // refs only, never values
   }
   ```
   `SecretRef` = string `keychain:<service>/<account>`, service `app.overmind.<purpose>` (purposes: `telegram-bot-token`, `provider-api-key`, `gateway-agent-signing-key`), validated by zod. `Secret` class: holds the value in a closure; `toString()`/`toJSON()`/`inspect` return `[SECRET]`; `reveal(): string` is the only accessor and every call site is greppable; `Secret.fromString()`; zeroization best effort (`dispose()`). Items are stored with access restricted to the Overmind app/engine binary (macOS Keychain ACL); user authentication prompts are not triggered silently: `read` returns `platform.keychain_locked` or `platform.keychain_access_denied` and the caller fails closed. Codes: `platform.secret_not_found`, `platform.keychain_locked`, `platform.keychain_access_denied`, `platform.keychain_unavailable`.
3. **Sandbox** (`port:Sandbox`), the isolation runtime that BOX implements with Apple `container`; it models environments, not Docker specifics:
   ```ts
   interface Sandbox {
     capabilities(): SandboxCapabilities;        // { kind:'apple-container'|'lima'|'none', perAgentEnv, workspaceNetworkPolicy, minOs, ... }
     health(): Promise<Result<SandboxHealth>>;    // installed, version, kernel present, running, osSupported, issues[]
     ensureReady(opts?): Promise<Result<void>>;   // install kernel / start system service; never installs without Owner approval (caller passes approvalToken)
     createEnvironment(spec: EnvironmentSpec): Promise<Result<EnvironmentId>>;
     startEnvironment(id): Promise<Result<void>>;
     stopEnvironment(id, opts?: { graceMs }): Promise<Result<void>>;
     destroyEnvironment(id, opts?: { keepVolumes?: boolean }): Promise<Result<void>>;
     exec(id, cmd: ExecSpec): Promise<Result<ExecHandle>>;      // no shell string: argv array, cwd must be /work
     listEnvironments(): Promise<Result<EnvironmentInfo[]>>;
     stats(id): Promise<Result<EnvironmentStats>>;               // memory, cpu, pids
     updateMounts(id, mounts: Mount[]): Promise<Result<void>>;   // adding an Allowed Directory attaches it (ADR 0020)
     setEgressPolicy(id, policy: EgressPolicy): Promise<Result<void>>;
     forwardPort(id, spec: { hostPort, containerPort, ttlMs }): Promise<Result<PortForward>>;  // temporary, for CLI login only
   }
   EnvironmentSpec = { image: string(pinned by digest); workdir: '/work'; mounts: Mount[]; credentialVolumes: VolumeRef[]; cpu: number; memoryMiB: number; pidsLimit: number; env: Record<string,string> (no secrets); rootFs: 'readonly'|'ephemeral'; user: 'non-root'; egress: EgressPolicy; labels: Record<string,string> }
   Mount = { hostPathCanonical: CanonicalPath; containerPath: string; mode: 'ro'|'rw' }
   EgressPolicy = { mode: 'deny-all'|'allowlist'; hosts: string[] /* provider hosts pre-allowed */ ; onNewHost: 'block'|'ask' }
   ```
   Rules: host paths in `Mount` are canonical (SEC002) and must be Allowed Directories only; `workdir` is always `/work` (prototype finding); no privileged mode, no host network, no Docker-socket-like mounts, no mounting of `~`, `/`, `/Users`, volumes shared between Workspaces except the CLI credential volume of that CLI. `ensureReady` returns `box.runtime_missing` / `box.os_unsupported` / `box.kernel_missing` (error codes owned by BOX; this task registers `platform.sandbox_unavailable` as generic). If `capabilities().kind === 'none'` every `exec` fails with `platform.sandbox_unavailable` (fail closed; no unsandboxed fallback).
4. **ServiceManager** (`port:ServiceManager`, macOS: launchd user agent):
   `install(spec: { label, programPath, args, runAtLoad, keepAlive, logPath }): Result<void>`, `uninstall()`, `status(): Result<'not_installed'|'stopped'|'running'|'unknown'>`, `start()`, `stop()`, `isAutoStartEnabled()`, `setAutoStart(enabled)`. Idempotent; operates only on the per-user domain (`gui/<uid>`), never requires root; errors `platform.service_install_failed`, `platform.service_not_permitted`.
5. **Notifier** (`port:Notifier`): `notify(n: { id, title, body, urgency: 'normal'|'high', sound?: 'default'|'none', actionRef?: { kind: 'open', route: string } }): Promise<Result<void>>`, `requestPermission(): Promise<Result<'granted'|'denied'|'unknown'>>`, `capabilities(): { sound, actions }`. Body content is already localised and redacted by the caller; the notifier does not format. No interactive approval actions inside macOS notifications (approvals only in app/Telegram per ADR 0006/SEC). Errors `platform.notification_denied`, `platform.notification_failed`; failure to notify never blocks the underlying flow (caller logs).
6. **Desktop-side interfaces** in `apps/desktop/src/shared/platform/` (browser-safe TypeScript, no Tauri import in interface files):
   - `Tray`: `setStatus(status: TrayStatus)`, `setMenu(model: TrayMenuModel)`, `onAction(handler)`, `show()/hide()`; `TrayMenuModel` is data (items with ids, labels already translated), actions come back as `{ id }`; there is no business logic.
   - `FileDialog`: `pickDirectory(opts): Promise<Result<string | null>>`, `pickFile(opts)`, `saveFile(opts)`; returns paths that are then sent to the engine, which canonicalises and validates them (never trust UI-supplied paths, SEC002).
   - `Clipboard`: `writeText(text)`, `readText()` (read only on explicit user gesture), result-typed.
   - `DesktopShell`: `openExternal(url)` (https only, allowlist, SEC), `showWindow()`, `quit()`, `getEngineEndpoint()`, `onEngineStatus(handler)`.
   - Implementations: `platform/tauri/*` (the only place that may import `@tauri-apps/*`), `platform/web/*` (dev/browser fallbacks), `platform/mock/*` (Playwright, TEST004). A single `PlatformProvider` selects the implementation.
7. **Capability matrix document:** table of each capability with macOS implementation, fallback, and future Windows/Linux notes; "unsupported" always means fail closed for security-relevant capabilities (Sandbox, Keychain) and "degrade" for convenience ones (Notifier, Tray, Clipboard).
8. **Contract suites required** (listed so TEST003 builds them): `Keychain.contract` (store/read/overwrite/remove idempotency, list returns refs only, secrets never in error messages), `Sandbox.contract` (lifecycle, exec argv only, mounts canonical, none-kind fails closed), `ServiceManager.contract`, `Notifier.contract`.
9. Sandbox inputs are validated with zod in the port module (`EnvironmentSpecSchema`) so adapters receive already-validated, canonical specs.

## 6. Design notes

N/A, functionality only (Tray menu layout lives in TRAY tasks).

## 7. Reuse

`Result`/`AppError`/`defineErrors` (ARCH003), `Logger` (ARCH004), path types from SEC002 (`CanonicalPath`), `ProcessRunner` (ARCH014) used by adapters for CLI calls (`container`, `launchctl`, `security`). Fakes: TEST002. Everything platform-specific MUST be accessed through these ports; direct use of `security`, `launchctl`, `osascript` or `container` outside the macOS adapters is a defect.

## 8. Architecture and code placement

- Ports: `packages/application/src/ports/{Keychain,Sandbox,ServiceManager,Notifier}.ts` (+ `application/src/platform/` for shared value types and zod schemas).
- Adapters (others' tasks): `adapters/keychain-macos`, `adapters/sandbox-macos`, `adapters/service-macos`, `adapters/notifications-macos`.
- UI side: `apps/desktop/src/shared/platform/{Tray,FileDialog,Clipboard,DesktopShell}.ts` + `PlatformProvider.tsx`.
- ISP: four small engine ports instead of one `Platform` god-interface; DIP: use cases depend on ports only.

## 9. Security and safety

Highest-impact abstractions: Sandbox decides what the Agent can touch (SR-05, SR-33, SR-20), Keychain holds all secrets (SR-06). Rules encoded in types: argv arrays (no shell injection), canonical mounts only, `/work` workdir, no secrets in `env` (a zod refinement rejects keys matching the redaction key rule and values matching token patterns), egress deny-by-default, port forwards expire. `Secret` cannot be logged or serialised accidentally. Fail closed on `kind: 'none'`, missing runtime, unsupported OS. Notifier body must not contain secrets or absolute paths (caller responsibility, tested by contract). `openExternal` allows `https:` only and only for URLs created by the app (login links) or confirmed by the Owner.

## 10. Errors and edge cases

- Keychain locked (user logged out/screen locked): `platform.keychain_locked`, retryable; callers pause the dependent operation (e.g. Telegram polling) rather than falling back to a file.
- Duplicate `store` without `overwrite`: `platform.secret_exists`.
- Sandbox runtime upgrade mid-run: `health()` reports `issues`; environments continue, new ones blocked until healthy.
- Memory pressure: `createEnvironment` may return `platform.sandbox_resource_limit`; the scheduler (engine) queues work (3 parallel Agents limit).
- Notification permission denied: stored in state, UI shows a hint; flows continue.
- Tray unavailable (menu bar hidden): `Tray` calls are no-ops with `capabilities().visible=false`.

## 11. Acceptance criteria

- [ ] All four engine ports and four desktop interfaces exist with tokens and zod schemas, compile with no platform imports.
- [ ] `Secret` never reveals its value via `String()`, `JSON.stringify`, `util.inspect`, template literals or logging (unit tests).
- [ ] `EnvironmentSpecSchema` rejects: non-`/work` workdir, non-canonical or relative host paths, mount of `/`, `/Users`, home dir, secrets in env, unpinned image tags, `rootFs` other than readonly/ephemeral, privileged flags.
- [ ] Error codes registered with `telegramSafe` flags; hostile-error test from ARCH003 passes for them.
- [ ] Capability matrix doc lists macOS implementation and future columns.
- [ ] Contract suite requirements listed in the doc and reflected as TODOs owned by TEST003.
- [ ] Lint: no `@tauri-apps/*` import outside `platform/tauri`.

## 12. Test plan

- Unit: `secret.test.ts`, `secret-ref.test.ts`, `environment-spec.schema.test.ts` (table of valid/invalid specs), `egress-policy.test.ts`.
- Type tests for port method signatures.
- Fake-based smoke: compose a toy use case with fake Keychain and fake Sandbox (TEST002) on Linux.
- Commands: `pnpm vitest run packages/application/src/platform apps/desktop/src/shared/platform`.

## 13. Parallelization notes

Merge the port files early: BOX, NOTIF, ENGINE, TRAY, ONB and TG authors depend on them. The adapters are separate tasks in their areas. This task owns the interface files; additive method additions by others go through a proposal (they change a contract).

## 14. Open questions and assumptions

- ASSUMPTION: `Sandbox` is environment-oriented (per Agent or per Workspace, BOX decides); the spec supports both.
- ASSUMPTION: Lima-based fallback for macOS < 26 returns the same interface; if not implemented the app reports `box.os_unsupported` at onboarding.
- Open: whether `Clipboard` is needed in MVP (design has copy buttons for pairing codes); keep the interface, implement with `navigator.clipboard` first.
- Open: peer to the gateway: `GatewayEndpoint` discovery for the UI is part of `DesktopShell.getEngineEndpoint()`; ENGINE may refine.
