---
id: OVE_PROV014
title: Orchestrate the Owner's CLI login and handle expired logins without seeing tokens
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_BOX015, OVE_BOX019, OVE_ENGINE016, OVE_NOTIF004, OVE_PROV006, OVE_PROV009, OVE_PROV019, OVE_PROV020, OVE_PROV034, OVE_SEC009]
soft_depends_on: [OVE_PROV010, OVE_PROV011, OVE_PROV029]
provides: ["usecase:StartCliLogin", "usecase:CancelCliLogin", "usecase:GetCliLoginStatus", "lib:login-orchestrator", "event:provider.login_needed", "event:provider.login_restored"]
needs: ["lib:sandbox-login-support", "lib:login-flow-checks", "usecase:RequireIsolation", "port:ConnectionRepository", "contract:CliProfile", "usecase:CreateNotification", "usecase:ResolveNotificationsBySubject", "port:Sandbox", "port:AuditSink", "lib:redaction", "port:Clock", "port:EventBus", "lib:define-event", "contract:ProvConfig"]
owns:
  - packages/application/src/prov/login/**
  - packages/contracts/src/events/provider.login_needed.event.ts
  - packages/contracts/src/events/provider.login_restored.event.ts
  - packages/application/locales/*/provider-login.json
  - docs/providers/login-flows.md
reads: ["docs/research/prototyp-wnioski.md", "docs/adr/0022-oficjalne-cli-jak-herdr.md", "docs/security/login-flow.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 17"]
adr_refs: [20, 22, 26]
---

# OVE_PROV014: Orchestrate the Owner's CLI login and handle expired logins without seeing tokens

## 1. Summary

The Owner logs in to `claude` and `codex` himself and Overmind never sees a password or token. This task runs the login flow state machine (choose a method without redirect first, otherwise a temporary callback forward), tells the Owner what to do, verifies success without reading credentials, and handles the later case where a login expires: mark the Connection, notify the Owner once, hold the affected Agents and resume only when logged in again.

## 2. Context

ADR 0022 and prototype findings: browser login with a `localhost` redirect does not cross the container boundary (Codex `127.0.0.1:1455`); preferred methods are Claude's pasted code and Codex's device code (if the Owner enabled it); otherwise a temporary forward of the login port for the duration of login, or the proven manual workaround (`curl` of the redirect URL inside the container, same `state`/PKCE, short-lived, single-use). The code must not pass through Overmind's process or logs in the first two methods. BOX015 provides `forwardPort` and `loginCallbackExec`; SEC009 defines the login checks `assertForwardAllowed`, `validateRedirectPaste`. Expired login screens (`401 OAuth access token has expired`) are classified `needs_login` by PROV006 (never by herdr). Credentials live in the per-CLI volume (BOX009) that Overmind never reads.

## 3. Scope (in)

- `StartCliLogin`, `CancelCliLogin`, `GetCliLoginStatus` use cases and the login state machine.
- Method selection from the `CliProfile`, instructions as i18n keys with data, host-terminal command for the interactive part.
- Success detection by probe, not by reading files.
- Expired-login handler (a `BlockedStateHandler`): Connection status, deduplicated notification, held Agents, events `provider.login_needed` / `provider.login_restored`.

## 4. Out of scope

- Forward and callback mechanics (BOX015), login security checks (SEC009), wizard and Connections UI (ONB, CONNUI), the Connection repository (PROV020), classification (PROV006), ever reading or storing tokens.

## 5. Detailed requirements

1. **State machine:** `LoginSession { id, connectionId, providerId, method: 'paste_code'|'device_code'|'browser_callback', state: 'idle'|'preparing'|'awaiting_owner'|'verifying'|'logged_in'|'failed'|'cancelled'|'expired', startedAt, expiresAt (5 min TTL, config) }`. One login at a time per installation (BOX015 busy rule); a second `StartCliLogin` returns `box.login_forward_denied(busy)` mapped to `provider.busy`.
2. **Start:** `RequireIsolation.execute({ purpose: 'login' })` (allowed while paused, BOX019); the Environment is the one for the Workspace chosen by the caller (`workspaceId`), created through the normal path (credential volume of the CLI mounted, BOX009); no Agent session is started and `/work` content is not touched by the login. Result: `{ loginId, method, instructionKey, hostCommand?: { argv: string[] }, expiresAt, forward?: { hostPort } }`.
3. **Method choice (first applicable, per profile `login.methods` order):** (1) `paste_code` (Claude): the Owner runs the CLI login in a terminal attached to the Environment (hostCommand `container exec -it <envName> claude` shown with a copy button, or opened in Terminal by the desktop shell; the container name comes from BOX008 via a sanitized helper; no token in argv). The pasted code goes into that terminal by the Owner, never through Overmind. (2) `device_code` (Codex, only when the account has it enabled, learned from the previous failure or an Owner toggle in the wizard): same terminal approach with `codex login --device-auth`. (3) `browser_callback`: open the forward `forwardPort(envId, { hostPort: 1455, containerPort: 1455, ttlMs <= 300000 })` before the Owner starts the sign-in in the terminal; if the browser still cannot reach it the wizard offers `loginCallbackExec(pastedUrl)` which BOX015 validates (SEC009) and passes via stdin to curl in the container; PROV014 never logs, stores or inspects the URL (it passes the string through in memory only and drops the reference).
4. **Instructions:** the use case returns only i18n keys and structured parameters (`login.claude.paste_code.step1`..., host command, whether a forward is open); no CLI output text is shown to the Owner.
5. **Success detection (`verifying`):** every 3 s up to the TTL, run the profile's `loginStatus` probe through `Sandbox.exec` with stdout discarded and only the exit code used; if the profile has no probe, start a temporary one-shot `version`-style check plus, as fallback, observe the login terminal screen for the absence of the login screen using PROV006 (`needs_login` clears). Never `cat`, list or read anything in `/creds`. Success sets Connection status `ready` (PROV020), closes the forward (BOX015 `closeForward`), emits `provider.login_restored` and audit `provider.login_completed`.
6. **Failure and cancel:** TTL, Owner cancel, error: close the forward, state `expired|cancelled|failed`, audit; the Connection keeps `needs_login`. Cancellation is idempotent.
7. **Expired login at runtime (`NeedsLoginHandler`, registered to the gateway hook):** on observation `needs_login` (or `provider.needs_login` from a provider): (a) set Connection `needs_login` once (PROV020), (b) publish `provider.login_needed { connectionId, providerId }`, (c) create ONE notification per Connection (dedupe key `provider.login_needed:<connectionId>`, urgency high, sound per NOTIF rules; i18n key `notif.login_needed`), (d) mark every Agent session on that Connection as blocked (the guard already refuses sends), (e) Runs wait; no automatic resend. When `provider.login_restored` arrives the notification is resolved (`ResolveNotificationsBySubject`) and `provider.session_changed` lets AGENT/CHAT retry queued messages by their own policy.
8. **Selection of Connection for Agents:** an Agent whose Connection needs login does not fall back silently to another provider because of login; fallback applies only to limits (PROV018) unless the Owner configures `fallbackOnLoginExpired` (ASSUMPTION default false) because switching providers changes cost and data exposure.
9. **Logging and audit:** events `provider.login_started { method }`, `provider.login_completed`, `provider.login_failed { reason }`; no URL, query, code, state, device code or host command with arguments beyond the program name ever appears in logs, events, audit or notifications (redaction vectors for `code=`/`state=` are a second line, SEC003).
10. **Gateway API:** this task defines the use cases only; the routes are CONNUI/PROV021 (`api:connections.*` has no login route yet: listed as a gap).

## 6. Design notes

N/A, functionality only. Wizard copy belongs to ONB/CONNUI; this task supplies i18n keys under `provider.login.*` (EN + PL files `packages/application/locales/<lang>/provider-login.json`).

## 7. Reuse

BOX015 `forwardPort`/`closeForward`/`loginCallbackExec`, SEC009 checks, BOX019 `RequireIsolation('login')`, `ConnectionRepository` (PROV020), `CliProfile` (PROV034), classifier (PROV006), notification use cases (NOTIF004).

## 8. Architecture and code placement

`packages/application/src/prov/login/{login-orchestrator.ts,login-session.ts,method-selection.ts,verify-login.ts,needs-login-handler.ts}` plus the two event files under `packages/contracts/src/events/`. Application layer over ports; the host terminal command is data for the UI (no process is opened here; the desktop shell does that, ARCH012).

## 9. Security and safety

Overmind never sees credentials: the code and tokens stay in the terminal and the CLI's volume; the verification probe discards stdout; nothing reads `/creds`. The callback URL is the only secret-like string that may pass through Overmind (method 3 workaround), handled by BOX015 under SEC009 (loopback only, port equals the active login port, TTL, single use, passed by stdin, zeroed, never logged). Forwards bind to `127.0.0.1` only, one at a time, closed on success, TTL, cancel and quit. Login is allowed during Global Pause but still requires isolation. Notification deduplication prevents notification floods by repeated blocked sends. A prompt-injected CLI screen claiming "please login" only changes the Connection status and notifies the Owner; it cannot cause any action (and never a credential request by Overmind).

## 10. Errors and edge cases

- Port 1455 busy on the Mac: `box.login_forward_denied(port_in_use)`; the wizard suggests device code or closing the other app (generic text).
- Login succeeded in the terminal but the probe is unreliable: fallback to screen observation; if both inconclusive after TTL the session ends `expired` and the Owner can retry (Connection test in CONNUI also re-probes).
- Engine restarts during login: forwards are in-process only and vanish; the session is lost; the Owner restarts login (documented).
- Two Connections need login at once: one login session at a time; the second waits for the first.
- Login expires while the Agent works: the observation raises the handler; the in-flight invocation ends via PROV015 `contradicted('needs_login')`.
- Owner logged in on another machine/container: no effect here; the probe decides.

## 11. Acceptance criteria

- [ ] With `FakeSandbox` and `fake-codex` (`login_required`), `StartCliLogin` opens a forward bound to 127.0.0.1:1455 with TTL <= 300 s, returns instructions as keys, and a successful probe sets the Connection `ready` and closes the forward.
- [ ] A second concurrent login returns `provider.busy`; cancel closes the forward and is idempotent.
- [ ] No log, event, audit entry or notification contains a URL, `code=`, `state=`, a device code or CLI output (`expectNoSecrets` plus negative fixtures).
- [ ] The probe execs never read paths under `/creds` (argv assertion) and discard stdout.
- [ ] `needs_login` observations produce exactly one notification per Connection until restored, then the notification is resolved.
- [ ] Login works while Global Pause is on and fails without isolation.
- [ ] Paste of a callback URL with a wrong port or host is rejected by SEC009 checks (test through BOX015 fake).

## 12. Test plan

State machine table tests with `FakeClock`; fake sandbox and login support; handler tests with observation scripts; secret-scan tests; integration with `fake-claude`/`fake-codex` scenarios. Commands: `pnpm vitest run packages/application/src/prov/login`.

## 13. Parallelization notes

Needs PROV020 (Connection repository) and BOX015 interfaces; can start against fakes. ONB and CONNUI depend on this task's use cases; routes are added by PROV021/CONNUI. Hotspot: i18n namespace files (own).

## 14. Open questions and assumptions

- ASSUMPTION: the Owner runs the interactive part in a Terminal window attached to the Environment (copyable command); a built-in terminal view is not part of the MVP design views.
- ASSUMPTION: login Environment uses the chosen Workspace's plan; a mount-less login Environment would be safer (BOX007 rejects empty plans): proposal to BOX recorded in `docs/providers/login-flows.md`.
- Open: whether Claude's login status probe exists in the pinned version (spike in PROV010); fallback is the screen-based check.
