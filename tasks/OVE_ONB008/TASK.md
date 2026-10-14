---
id: OVE_ONB008
title: "Implement the login terminal backend: pass-through PTY session and login screen facts"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOX008, OVE_BOX015, OVE_ONB001, OVE_PROV005, OVE_PROV014, OVE_PROV034, OVE_SEC009]
soft_depends_on: []
provides: ["port:LoginTerminalGateway", "usecase:OpenLoginTerminal", "usecase:WriteLoginTerminal", "usecase:CloseLoginTerminal", "lib:login-screen-reader", "adapter:HerdrLoginTerminal"]
needs: ["usecase:StartCliLogin", "usecase:GetCliLoginStatus", "usecase:CancelCliLogin", "port:TerminalLayer", "lib:sandbox-login-support", "lib:login-flow-checks", "lib:environment-lifecycle", "lib:cli-profile-registry"]
owns: ["packages/application/src/onboarding/login/**", "packages/application/src/ports/LoginTerminalGateway.ts", "packages/adapters/herdr/src/onboarding/**", "packages/testing/src/fakes/FakeLoginTerminal.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [4, 20, 22]
---

# OVE_ONB008: Implement the login terminal backend: pass-through PTY session and login screen facts

## 1. Summary

Implements `OpenLoginTerminal`, `WriteLoginTerminal`, `CloseLoginTerminal` and the `LoginTerminalGateway` port: a dedicated terminal session inside the Environment in which the Owner types the CLI login (`claude`, `codex login`), streamed to the wizard's embedded terminal as a pass-through that is never logged or parsed except to extract a validated login URL and derived login state.

## 2. Context

The mock shows 'TERMINAL · CODEX CLI W KONTENERZE' with `$ codex login`, the text 'Otwórz w przeglądarce, aby zalogować się planem ChatGPT:', a URL 'https://auth.openai.com/authorize?…', 'Czekam na zalogowanie… ▍' and a button 'Otwórz link w przeglądarce'. SEC009 sets the rules: L1 Overmind never reads or stores codes or tokens; L2 terminal output is excluded from logs, events, chat and Telegram, adapters get only derived facts; L3 login URLs are classified (https + host allowlist) and opened only on the Owner's click; L4 callback forwards (Codex 1455) only with explicit consent and limited; L8 the login terminal is a dedicated pane not shared with Agent work, with no copy-to-chat. PROV014 orchestrates the login session and success detection; this task provides the terminal transport the wizard needs (PROV014 describes `hostCommand` for an external terminal; the wizard embeds it).

## 3. Scope (in)

- Port `LoginTerminalGateway` (open, write, resize, close, `onOutput` raw bytes channel, `onFacts` derived facts).
- Use cases `OpenLoginTerminal({ providerId, workspaceId })`, `WriteLoginTerminal({ id, data })`, `ResizeLoginTerminal`, `CloseLoginTerminal`.
- Adapter `HerdrLoginTerminal` creating a dedicated herdr pane (PROV005 `TerminalLayer`) in the login Environment (BOX015) and running the CLI profile's login command (PROV010/011: `claude` first-run login, `codex login`).
- `LoginScreenReader` producing `LoginScreenFacts` `{ state: 'awaiting_browser'|'awaiting_code'|'logged_in'|'failed'; loginUrl? }` using `classifyLoginUrl` (SEC009).
- Success detection delegated to PROV014 `GetCliLoginStatus` (exit-code probe), not by parsing output.
- Session registry (one login at a time per installation), TTL 10 minutes.

## 4. Out of scope

- Gateway routes and stream transport (ONB010).
- The UI terminal (ONB017).
- Callback port forward UX for Codex (offered as an optional action after the Owner clicks; mechanics BOX015); here only the guard rails and the hook point.

## 5. Detailed requirements

1. **Open.** `OpenLoginTerminal` calls `StartCliLogin` (PROV014, method terminal) which runs `RequireIsolation(purpose 'login')`, prepares the Environment of the given Workspace with the CLI's credential volume (BOX009/015), then creates the dedicated pane and starts the profile's login command through `TerminalLayer`. Returns `LoginTerminalSession` (ONB001). A second open while one exists returns `onboarding.login_busy`.
2. **Pass-through.** Output bytes flow from the pane to the stream subscriber without passing through the logger, the event bus, the audit log, the chat store or any persistence. The only reader besides the stream is `LoginScreenReader`, which keeps an in-memory sliding window (last 8 KiB) solely to derive facts and discards it on close. Input bytes flow from `WriteLoginTerminal` to the pane unchanged except for size/rate limits; they are never logged or retained.
3. **Input limits.** Max 4096 bytes per write, max 64 KiB per minute per session, UTF-8 only; control sequences from the UI are allowed only from a closed set (printable text, Enter, Backspace, Ctrl-C, arrow keys, paste) because a terminal emulator in the UI will translate keystrokes; raw escape injection from other sources is blocked by the closed set mapping in the route layer.
4. **Facts.** `LoginScreenReader.extract(window)` detects the login URL (first `https://` token, up to 2048 chars, no whitespace or credentials), classifies it with `classifyLoginUrl(providerId, url)`; if rejected the fact `loginUrl` is absent and `state` carries `awaiting_browser` with `urlRejected: true` (UI shows a warning that the link is not on the allowlist and does not offer the button). State heuristics: `awaiting_code` when the window contains a code prompt marker from the profile's `loginScreenMarkers` list (data, not code); `logged_in` is only set from PROV014's probe, never from output text.
5. **Opening links.** The engine never opens a browser. The UI opens the classified URL on the Owner's click through `openExternal` (allowlisted hosts in SHELL003, same list as SEC009 L3).
6. **Forward guard rails.** When the profile declares `login.callbackPort` (Codex 1455) and the Owner chooses the browser-callback method, the use case calls `Sandbox.forwardPort` per SEC009 L4 (127.0.0.1 only, TTL 5 min, one at a time, closed on login end or cancel); the choice is an Owner action (a flag in `OpenLoginTerminal`), default off.
7. **Close and cleanup.** `CloseLoginTerminal` (Owner cancel, TTL, success, app quit) closes the pane, closes any forward, destroys the transient Environment if it was created for the login, clears the in-memory window and emits `provider.login_*` through PROV014. Crash recovery: the BOX016 reaper removes orphans at next start.
8. **No Agent access.** The pane is never registered in the Agent-to-terminal map; Agents cannot read or write it; Chief and Telegram cannot see it (L8).
9. **Telemetry.** Only `login.started`, `login.completed`, `login.failed` with provider id and reason class (SEC009 L11).

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- `StartCliLogin/GetCliLoginStatus/CancelCliLogin` (PROV014), `TerminalLayer` (PROV005), `Sandbox.forwardPort` and login support (BOX015), `classifyLoginUrl` and `LoginSession` helpers (SEC009), Environment lifecycle (BOX008), CLI profiles (PROV034/010/011).

## 8. Architecture and code placement

`packages/application/src/onboarding/login/{open-login-terminal.ts,write-login-terminal.ts,close-login-terminal.ts,login-screen-reader.ts,login-session-registry.ts}`, port `packages/application/src/ports/LoginTerminalGateway.ts`, adapter `packages/adapters/herdr/src/onboarding/herdr-login-terminal.ts`, fake `packages/testing/src/fakes/FakeLoginTerminal.ts`.

## 9. Security and safety

- SEC009 L1/L2/L8 implemented literally: pass-through, no logging, no events, no persistence, dedicated pane, no Agent or Chief access.
- The in-memory window is wiped on close and never serialised (a unit test serialises the registry and asserts it contains no output).
- URL classification before exposure; credentials in URL, wrong scheme or host are rejected.
- One session at a time, TTL, size and rate limits stop abuse of the endpoint.
- The write path accepts only keystroke-like data, not arbitrary pane commands (herdr API methods beyond send-text are not reachable).
- Forward only on explicit Owner choice and only to loopback.

## 10. Errors and edge cases

- herdr pane creation fails: `onboarding.login_failed(herdr)` with the check row `herdr` failing.
- CLI not installed in the image: open fails with `provider.not_installed` mapped for the UI.
- Output flood: backpressure drops oldest bytes per subscriber (ring 256 KiB); counters only.
- Login completes in the CLI: PROV014 probe flips `logged_in`, the session closes itself after 5 s so the Owner sees the success output.
- Engine restart: session lost; UI reopens; the Environment is reaped.
- Two UI windows try to attach: the second gets `login_busy`.

## 11. Acceptance criteria

- [ ] Given a fake terminal then output bytes reach the stream subscriber and never reach the logger or event bus (spy assertions).
- [ ] Given a CLI output with a non-allowlisted URL then the fact has no `loginUrl` and `urlRejected`.
- [ ] Given a write of 5000 bytes then it is refused.
- [ ] Given close then the pane, forward and Environment cleanup are called once.
- [ ] Given a login success probe then the state `logged_in` is published through PROV014 and the session closes.
- [ ] Given a serialised registry snapshot then it contains no terminal output.

## 12. Test plan

- Use-case tests with the fake terminal and fake PROV014; spy-based no-log assertions (reuses `no-secrets-assert` from SEC003); limits tests.
- Security cases appended to the PROV abuse suite names (login output exfiltration).
- Commands: `pnpm vitest run packages/application/src/onboarding/login packages/adapters/herdr/src/onboarding`.

## 13. Parallelization notes

After ONB001 and PROV005/014, BOX015, SEC009. Parallel with ONB006/007. ONB010 needs it.

## 14. Open questions and assumptions

- OPEN: PROV014 describes the login as an external terminal with `hostCommand`; the wizard mock shows an embedded terminal. This task implements the embedded path; PROV014 owner to confirm the `StartCliLogin` option `terminal: 'embedded'` and the `LoginScreenReader` ownership (SEC009 L2 names it as an adapter facility).
- ASSUMPTION: herdr panes can be created in the login Environment and stream output (PROV004/005); otherwise `Sandbox.exec` with a PTY (BOX010) is the alternative.
- OPEN: `loginScreenMarkers` data lives in the CLI profile (PROV034) and needs an additive field.
