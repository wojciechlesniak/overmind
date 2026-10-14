---
id: OVE_BOX015
title: Support CLI login in the Environment (port forward, callback exec) without touching tokens
area: BOX
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH012, OVE_BOX008, OVE_BOX010, OVE_ENGINE016, OVE_SEC009]
soft_depends_on: [OVE_SEC009, OVE_BOX020]
provides: ["lib:sandbox-login-support"]
needs: ["port:Sandbox", "lib:login-flow-checks", "lib:redaction", "port:Clock", "port:AuditSink"]
owns:
  - packages/adapters/sandbox-macos/src/login/**
reads: ["docs/security/login-flow.md", "docs/research/prototyp-wnioski.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 17"]
adr_refs: [20, 22]
---

# OVE_BOX015: Support CLI login in the Environment (port forward, callback exec) without touching tokens

## 1. Summary

Implement the sandbox side of CLI login: `Sandbox.forwardPort` (temporary, loopback-only, single-use, short TTL) so a browser redirect to `http://127.0.0.1:1455/auth/callback` reaches the Codex login server inside the Environment, and the guarded "callback exec" workaround that pipes the Owner-pasted redirect URL to `curl` inside the Environment. Codes and tokens never pass through Overmind logs or state.

## 2. Context

Prototype: Claude login works with a pasted code; Codex "Sign in with ChatGPT" fails because the callback port listens inside the container; device-code is off by default on accounts; the manual workaround (`container exec <id> curl "<callback url>"`) works when the URL comes from the same login attempt. ADR 0022 and `OVE_SEC009` (rules L1 to L12) fix what is allowed; SEC009 supplies pure helpers (`assertForwardAllowed`, `validateRedirectPaste`, `LoginSession`). This task implements what those helpers authorise. The login terminal is a dedicated herdr pane (PROV014); this task does not touch terminals.

## 3. Scope (in)

- `forwardPort` implementation for the callback port with safeguards and cleanup.
- `loginCallbackExec` helper (host to container, URL via stdin).
- Port-squatting detection, TTL timers, single-forward rule, crash cleanup.
- Audit events with no URLs.

## 4. Out of scope

- URL classification, session state machine and rule text: OVE_SEC009. Wizard UI: ONB. Reading login screens: OVE_PROV014. Opening the browser: DesktopShell.openExternal (ONB).

## 5. Detailed requirements

1. **forwardPort(id, { hostPort, containerPort, ttlMs }):** first calls `assertForwardAllowed(request, session)` from SEC009 (loopback bind, TTL <= 300000, port in the CLI table `claude: none (paste code)`, `codex: 1455`, single forward, correct Environment). Then, depending on the mechanism proven in OVE_BOX002: (a) a published TCP port bound to `127.0.0.1:<hostPort>` created by an in-process TCP listener on the host that relays each connection to the container via `container exec -i <id> socat - TCP:127.0.0.1:<containerPort>` (no container re-creation needed), or (b) a native publish option if available at runtime. Primary is (a): a host `net.Server` bound ONLY to `127.0.0.1`, accepting at most one connection at a time and at most 4 connections total, closing on TTL, on `closeForward`, on session end, or when the Environment stops.
2. **Port squatter detection:** before binding, probe `127.0.0.1:<hostPort>` (connect attempt) and `lsof`-free bind attempt; if in use, return `box.login_forward_denied` with reason `port_in_use` (never choose another port: the CLI's redirect URI is fixed; the wizard tells the Owner which app might be using it, without process names to avoid leaking the process list: just "another application").
3. **Single-use and teardown:** the forward ends as soon as one complete HTTP request/response exchange to the callback path is relayed, or at TTL, or when the CLI reports logged-in/failed (the PROV014 reader calls `closeForward`), or on Overmind quit. Crash recovery: forwards are in-process only (no persistent resources); on engine start the reaper (BOX016) kills stray relay `container exec` processes labelled `ovm-login-relay`.
4. **Request filtering on the relay:** only a request line `GET /auth/callback?...` (path from the CLI table) with total size under 4 KiB is forwarded; anything else is dropped with a `400`. The relay does not log the request, query or response; it counts bytes only. It adds no headers and strips cookies.
5. **loginCallbackExec(id, session, pastedUrl):** (a) `validateRedirectPaste(pastedUrl, session)` (L5 rules: scheme http, host `127.0.0.1`/`localhost`, port equals active login port, path `/auth/callback`, only `code` and `state` params with bounded lengths, within TTL, single use); (b) exec `curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' --config -` where the URL is supplied on stdin as a curl config line (`url = "..."`) so it never appears in host or container argv; (c) the result is only the HTTP status class (200/302 means attempted); the response body is discarded; (d) the validated URL object is zeroed (references dropped) and the session marked consumed.
6. **No sandbox network relaxation:** the login callback never needs egress; token exchange traffic of the CLI goes through the proxy to login hosts which are in the provider allowlist (SEC009 L10). The forward does not alter the egress policy.
7. **Logging/audit:** `sandbox.login_forward_opened` (cli, port, ttl), `sandbox.login_forward_closed` (reason: ttl, completed, cancelled, error), `sandbox.login_callback_exec` (outcome class). No URL, query, host-pasted text, state or code appears anywhere (logger redaction vectors from SEC003 cover `code=` and `state=` patterns as a second line).
8. **Concurrency:** one login session per installation at a time; a second request returns `box.login_forward_denied` (`busy`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

SEC009 helpers (`assertForwardAllowed`, `validateRedirectPaste`, `LoginSession`), `Sandbox.exec` (BOX010), `Clock`, redaction (ARCH004/SEC003), audit sink. Do not re-implement URL parsing here.

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/login/{forward-port.ts,relay.ts,callback-exec.ts,squatter-probe.ts,ports-table.ts}`; `ports-table.ts` is data shared by test and implementation with SEC009's `allowlist.ts` (import it, do not copy; if SEC009 does not export it, raise a proposal).

## 9. Security and safety

Threats: local port squatting to steal the OAuth code (the CLI's redirect is fixed; mitigated by pre-bind check and by `state`/PKCE which only the CLI holds), a malicious local process connecting to the relay while it is open (single connection, short TTL, request filter, loopback only), phishing URL pasted into the helper (validated, non-matching host/port/path rejected, no exec performed), code leakage through argv/logs (stdin config, redaction), forward left open (TTL and teardown on every path), another Workspace's Environment reached (forward targets exactly one Environment id from the session). Fail closed on any validation error: nothing is executed or opened.

## 10. Errors and edge cases

- Container stops during login: forward closed, session failed, audit event `error`.
- Owner pastes an old redirect: `validateRedirectPaste` rejects, no exec.
- Callback server inside the container is not yet listening: relay connect fails, the forward stays open until TTL; the wizard instructs to retry in the browser.
- Browser blocks `http://127.0.0.1` redirect: out of scope, wizard shows the manual workaround (third option).
- IPv6 `::1` browser resolution of `localhost`: the host listener also binds `::1` ONLY if `localhost` resolves to it; otherwise IPv4 only (documented test).
- `curl` missing in the image: smoke test in BOX005 guards; here returns `box.exec_denied`.

## 11. Acceptance criteria

- [ ] Forward binds only loopback, handles one request, and closes on completion and on TTL (fake clock).
- [ ] A second concurrent forward or a non-table port is rejected before any bind.
- [ ] Port-in-use yields `port_in_use` and no alternative port is tried.
- [ ] `loginCallbackExec` never places the URL in argv (fake runner assertion) and rejects wrong host, port, path, extra params, reuse, and expired sessions.
- [ ] Logs, events and audit entries contain no `code=`/`state=` material (fixtures scanned with `expectNoSecrets`).
- [ ] With `fake-codex --scenario login-redirect` inside a real Environment, the flow completes end to end (macOS integration).
- [ ] Relay drops non-callback requests with 400.

## 12. Test plan

Unit: ports table, squatter probe with real sockets, relay filter. Integration (macOS runner): `fake-codex login-redirect` scenario from TEST006 with a scripted "browser" client hitting the forward; negative scripted clients (second connection, wrong path). Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/login`.

## 13. Parallelization notes

Coordinate API shapes with SEC009 (merge those helpers first). ONB and PROV014 call this through the `Sandbox` port plus a small `LoginSupport` interface declared in this task's folder and re-exported by BOX022.

## 14. Open questions and assumptions

- ASSUMPTION: `socat` is present in the image (BOX005) and `container exec -i` streams bytes transparently for the relay.
- Open: whether to ship the manual-workaround helper in the MVP wizard (SEC009 open question); the capability exists here regardless.
