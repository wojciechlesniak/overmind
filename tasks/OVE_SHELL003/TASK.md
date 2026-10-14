---
id: OVE_SHELL003
title: "Implement the desktop platform layer: PlatformProvider with Tauri, web and mock"
area: SHELL
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_SETUP009, OVE_SETUP010]
soft_depends_on: []
provides: ["lib:platform-provider", "lib:use-platform", "lib:external-url-classifier", "lib:desktop-save-file", "lib:file-save-dialog"]
needs: ["lib:desktop-platform", "lib:tauri-capabilities", "lib:tauri-shell"]
owns: ["apps/desktop/src/shared/platform/tauri/desktop-shell.ts", "apps/desktop/src/shared/platform/tauri/file-dialog.ts", "apps/desktop/src/shared/platform/tauri/clipboard.ts", "apps/desktop/src/shared/platform/tauri/index.ts", "apps/desktop/src/shared/platform/web/index.ts", "apps/desktop/src/shared/platform/web/desktop-shell.ts", "apps/desktop/src/shared/platform/web/file-dialog.ts", "apps/desktop/src/shared/platform/web/clipboard.ts", "apps/desktop/src/shared/platform/mock/index.ts", "apps/desktop/src/shared/platform/mock/desktop-shell.ts", "apps/desktop/src/shared/platform/mock/file-dialog.ts", "apps/desktop/src/shared/platform/mock/clipboard.ts", "apps/desktop/src/shared/platform/mock/recorder.ts", "apps/desktop/src/shared/platform/PlatformProvider.tsx", "apps/desktop/src/shared/platform/usePlatform.ts", "tasks/_proposals/OVE_SHELL003-open-external.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13", "SPECIFICATION 11"]
adr_refs: [3, 9, 18, 22]
---

# OVE_SHELL003: Implement the desktop platform layer: PlatformProvider with Tauri, web and mock

## 1. Summary

Implements the browser-safe desktop platform interfaces defined by OVE_ARCH012 (`DesktopShell`, `FileDialog`, `Clipboard`, `Tray`) for three runtimes (Tauri, plain web for `pnpm dev`, mock for Playwright) and the `PlatformProvider` / `usePlatform()` that selects one. It is the only place in the desktop app that may import `@tauri-apps/*`.

## 2. Context

ARCH012 requirement 6 defines the interfaces and says implementations live in `platform/tauri/*`, `platform/web/*`, `platform/mock/*`. SETUP010 provides the Rust commands: `gateway_request`, `gateway_subscribe`, `pick_directory` (native folder dialog, returns a path string, no access decision), and the events `engine:status`. The webview has NO other native power (capability file `main` is deny-by-default), so everything else here is either pure JS or needs a proposal for Rust. Paths returned by `pickDirectory` are UNTRUSTED text: the engine canonicalises and validates (SEC002). The tray interface is implemented in OVE_TRAY007; here only the Tauri adapter plumbing and a stub are provided.

## 3. Scope (in)

- `apps/desktop/src/shared/platform/` implementations: `tauri/desktop-shell.ts`, `tauri/file-dialog.ts`, `tauri/clipboard.ts`, `tauri/index.ts`; `web/*` (browser fallbacks); `mock/*` (in-memory with recorded calls for TEST004).
- `PlatformProvider.tsx`, `usePlatform.ts`, runtime detection (`window.__TAURI_INTERNALS__` presence or `?platform=mock|web` in dev only).
- Typed wrappers for the three Tauri commands and the `engine:status` event, exposed through `DesktopShell` (no raw `invoke` strings outside `tauri/`).
- Proposal files for Rust additions (`open_external`, `show_window`, `quit`) if SETUP010 does not already cover them.

## 4. Out of scope

- Gateway transport (OVE_SHELL004 builds the client with `createTauriBridgeTransport` from ENGINE022).
- Tray implementation (OVE_TRAY007).
- Native notifications (OVE_SHELL023).

## 5. Detailed requirements

1. `DesktopShell` (browser-safe interface of ARCH012): `openExternal(url): Promise<Result<void>>`, `showWindow()`, `quit()`, `ensureEngine(): Promise<Result<{ state: EngineState }>>` (re-runs the shell's ensure-running; needs the Rust command `ensure_engine` proposed in the SETUP010 proposal file of this task; used by OVE_SHELL020), `getEngineEndpoint()`, `onEngineStatus(handler): Unsubscribe`. Tauri implementation: `onEngineStatus` listens to the event `engine:status` with payload `{ state: 'running'|'starting'|'unavailable'|'incompatible', detail?: string }` and validates it with zod (unknown shapes are dropped). `getEngineEndpoint` returns an opaque `{ kind: 'bridge' }` (the webview never learns a socket path or token).
2. `openExternal(url)`: allowed only for `https:` URLs whose host is in a code-level allowlist `EXTERNAL_HOST_ALLOWLIST` (login hosts from SEC009 L3: `claude.ai`, `console.anthropic.com`, `platform.claude.com`, `auth.openai.com`, `chatgpt.com`, plus the project documentation host once it exists); anything else returns `platform.external_url_blocked` without calling Rust. The classification helper is exported for ONB017 (`classifyExternalUrl`). If SETUP010 has no `open_external` command, this task writes `tasks/_proposals/OVE_SHELL003-open-external.md` describing the command (`open_external(url: String)`, https only, host allowlist duplicated in Rust, single capability permission `allow-open-external`) and the Tauri adapter returns `platform.unsupported` until the command exists (fail closed).
3. `FileDialog.pickDirectory({ title })`: calls the Rust command `pick_directory(title)`; maps `null` to `Ok(null)` (Owner cancelled), a string to `Ok(path)`; the string is trimmed and length-limited to 4096 before returning; NO existence check, no `~` expansion, no normalisation (the engine does it). `pickFile` and `saveFile` return `platform.unsupported` in the Tauri adapter until a task needs them (ONB and WSPACE only need directories).
4. `Clipboard.writeText(text)`: uses `navigator.clipboard.writeText` (user gesture required), `readText` is NOT implemented in the Tauri adapter (returns `platform.unsupported`): reading the clipboard silently is a data exfiltration path. Text longer than 100 KB is refused.
5. `PlatformProvider` selects: Tauri when running inside the shell; otherwise `web`; `mock` only when `import.meta.env.MODE === 'test'` or the URL has `?platform=mock` AND `import.meta.env.DEV` is true. Production bundles tree-shake the mock (the dist guard of SETUP009 must not find the word `mock/` modules; a bundle test checks it).
6. All methods return `Promise<Result<T, AppError>>` and never throw for expected failures; Tauri `invoke` rejections are mapped to `platform.*` codes (`platform.command_failed` with a generic message, never the raw Rust error text).
7. The mock implementation records calls (`calls[]`) and lets tests script answers (`pickDirectory` returns a queue of paths, `openExternal` records URLs); it exposes `window.__overmindMockPlatform` ONLY in mock mode for Playwright.
8. `usePlatform()` throws a developer error when used outside the provider; `PlatformProvider` takes an optional `platform` prop for Storybook and unit tests.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Interfaces `DesktopShell`, `FileDialog`, `Clipboard`, `Tray` and `Result`/`AppError` from OVE_ARCH012 / ARCH003.
- `Transport` creation is OVE_SHELL004; do not duplicate the bridge here.
- Capability names `lib:tauri-capabilities` (SETUP010), `lib:desktop-platform` (ARCH012).

## 8. Architecture and code placement

UI infrastructure under `apps/desktop/src/shared/platform/{tauri,web,mock}/**` and `PlatformProvider.tsx`/`usePlatform.ts` next to ARCH012's interface files (ARCH012 owns only `shared/platform/*.ts` interface files; this task owns subfolders and the two provider files). Dependency direction: features import `usePlatform` and interfaces; only `tauri/` imports `@tauri-apps/api` (the lint rule `no-restricted-imports` from ARCH002 enforces it; add the rule via proposal if missing).

## 9. Security and safety

- The webview is untrusted-ish (XSS, dependency compromise): the platform layer exposes the minimum: external URL opening is allowlisted https only; no file reading, no clipboard reading, no shell.
- Returned folder paths are treated as untrusted strings everywhere; the layer never builds file URLs from them.
- Rust errors are never shown raw (they might contain paths or headers).
- No token, socket path or secret ever crosses this layer (`getEngineEndpoint` is opaque).
- Mock mode is unreachable in production builds (bundle test).

## 10. Errors and edge cases

- Running in a plain browser (`pnpm dev` without Tauri): `web` adapter; `pickDirectory` returns `platform.unsupported` with a hint key so ONB can show a dev-only text field (ONB013).
- `pick_directory` throws (dialog plugin error): `Err(platform.command_failed)`.
- `engine:status` payload with unknown `state`: ignored and logged once at debug level.
- `openExternal('http://claude.ai')`: blocked (not https).
- Clipboard permission denied: `Err(platform.clipboard_denied)`.

## 11. Acceptance criteria

- [ ] Given the Tauri runtime then `usePlatform().fileDialog.pickDirectory` calls the command `pick_directory` with the title and returns the string; on cancel returns `Ok(null)`.
- [ ] Given `https://evil.example` then `openExternal` returns `platform.external_url_blocked` and no command is invoked.
- [ ] Given a production build then no module from `platform/mock` is in `dist` (test).
- [ ] Importing `@tauri-apps/api` outside `platform/tauri` fails lint.
- [ ] All three adapters satisfy the same contract suite.

## 12. Test plan

- Contract suite `platform.contract.ts` run against `tauri` (with `@tauri-apps/api/mocks` `mockIPC`), `web` and `mock`.
- Unit tests for `classifyExternalUrl` (table incl. userinfo, punycode, trailing dots, uppercase host).
- Bundle test using the SETUP009 `check-dist.mjs` pattern. Commands: `pnpm --filter @overmind/desktop test platform`.

## 13. Parallelization notes

Parallel with SHELL004..SHELL010. Hotspot: none (own folders). TRAY007 adds `tauri/tray.ts` in the same folder through an explicit hand-off: TRAY007 owns that single file, listed in its `owns`; this task leaves the file out.

## 14. Open questions and assumptions

- ASSUMPTION: `open_external`, `show_window`, `quit` Rust commands are not yet in SETUP010; proposals are filed and the adapter fails closed until merged.
- OPEN: whether `openExternal` should open links through the macOS `open` command from the engine instead (keeps Rust smaller); default Rust command.
