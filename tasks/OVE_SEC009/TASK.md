---
id: OVE_SEC009
title: Specify the CLI login flow security rules and port-forward safeguards
area: SEC
kind: security
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_SEC001, OVE_SEC003]
soft_depends_on: [OVE_TEST006]
provides: ["doc:login-flow-security", "lib:login-flow-checks"]
needs: ["port:Sandbox"]
owns: ["docs/security/login-flow.md", "packages/application/src/security/login-flow/**"]
reads: ["docs/research/prototyp-wnioski.md", "docs/security/requirements.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 17"]
adr_refs: [20, 22]
---

# OVE_SEC009: Specify the CLI login flow security rules and port-forward safeguards

## 1. Summary

Overmind never sees CLI subscription credentials (ADR 0022), yet the Owner must log in to `claude` and `codex` inside the isolated environment, where redirect-based logins (Codex `http://127.0.0.1:1455/auth/callback`) do not cross the container boundary. This task specifies the rules for the login guidance, the temporary port forward and the handling of login URLs/codes, and provides the small checked helpers the wizard and Provider code must use.

## 2. Context

Prototype findings (`docs/research/prototyp-wnioski.md` B): Claude login works with a pasted code; Codex "Sign in with ChatGPT" redirects the Mac browser to `localhost:1455`, which listens inside the container; the device-code option may be disabled on the account; a manual workaround (`container exec ... curl "<redirect url>"`) works if the URL comes from the same login attempt (state/PKCE). ADR 0022: the code must not pass through Overmind processes or logs; the wizard offers (1) methods without redirect, (2) a temporary port forward through the container environment only during login, (3) the documented manual workaround. Credentials live in a separate persistent per-CLI volume.

## 3. Scope (in)

- `docs/security/login-flow.md`: rules L1-L12.
- Helper library `packages/application/src/security/login-flow/`: `classifyLoginUrl()`, `LoginSession` state machine (pure), `assertForwardAllowed()`, redaction hooks for login output, TTL and single-use enforcement.
- Test cases for the helpers and a checklist for the ONB/PROV/BOX implementers.

## 4. Out of scope

- The wizard UI (ONB), embedded terminal and CLI detection (PROV/ONB), the actual port-forward implementation (BOX adapter via `Sandbox.forwardPort`), herdr integration.

## 5. Detailed requirements

1. **Rules (MUST):**
   - L1 Overmind never reads, stores, forwards or logs a login code, OAuth `code`, `state`, access/refresh token or device code. The Owner pastes codes directly into the CLI terminal (embedded terminal I/O is a pass-through to the pty; terminal content is not logged or parsed except for URL extraction under L3).
   - L2 Login output from the CLI terminal is excluded from logging, event payloads, chat history and Telegram; adapters read login screens only through the `LoginScreenReader` which returns derived facts (`state: 'awaiting_browser'|'awaiting_code'|'logged_in'|'failed'`, `loginUrl?`) not raw text.
   - L3 Login URLs: extracted by the reader; classified by `classifyLoginUrl(url)`: allowed only if scheme `https` and host in a per-CLI allowlist (`claude`: `claude.ai`, `console.anthropic.com`, `platform.claude.com`; `codex`: `auth.openai.com`, `chatgpt.com`) — list kept in a data file with comment, updatable only by code change; any other URL is shown as text with a warning and is NOT opened with one click. URLs with embedded credentials (`user:pass@`) or `javascript:`/`file:`/custom schemes are rejected. The URL is opened in the Owner's default browser via `openExternal` after Owner click (never automatically).
   - L4 Redirect-based logins: a temporary forward is created only after the Owner chooses it, by `Sandbox.forwardPort({ hostPort, containerPort, ttlMs })` limited to: the CLI's documented callback port (Codex 1455) on host loopback `127.0.0.1` only (never `0.0.0.0`), TTL max 5 minutes, single environment (the one the login terminal runs in), single forward at a time, closed immediately when the CLI reports logged-in/failed or the Owner cancels, and on Overmind quit/crash cleanup at next start. If the host port is already in use (port squatter), the wizard aborts and tells the Owner (do not pick a random alternative port because the CLI's redirect URI is fixed).
   - L5 Manual workaround helper: when offered, Overmind does not copy the redirect URL itself; it instructs the Owner to run the documented command in the embedded terminal or provides a button that pipes the Owner-pasted URL directly to the container exec stdin without logging it; the URL is validated: scheme `http`, host `127.0.0.1` or `localhost`, port equal to the active login's callback port, path `/auth/callback`, only `code` and `state` parameters of bounded length; and it is accepted only within the TTL of the same login attempt (one-time).
   - L6 Credential storage: CLI credentials live in the per-CLI persistent credential volume mounted into that CLI's environment only (BOX); never mounted into other Workspaces' environments, never copied to the host data directory, never included in backups or exports; removing a connection deletes the volume after Owner confirmation.
   - L7 Expiry handling: `401`/"please run /login" detection yields state `login_required` (PROV); the Owner is notified; the Agent's task is not retried until login succeeds; no automatic re-login attempts; messages sent to Telegram say "Login needed in <CLI> on your Mac" without URLs or codes.
   - L8 Terminal I/O hygiene: the login terminal is a dedicated herdr pane not shared with Agent work; Agents cannot read it; when the login completes the pane closes. The embedded terminal in the UI has no copy-to-chat or send-to-Chief features.
   - L9 No automation of login: Overmind does not type codes, click buttons in CLIs or use stored credentials to log in (ToS spirit, ADR 0022).
   - L10 Network: login hosts are in the sandbox provider allowlist (ADR 0020 proxy); no other egress opens for login.
   - L11 Telemetry/logging: only high-level events (`login.started`, `login.completed`, `login.failed` with CLI id and reason class) are recorded, without URLs.
   - L12 Device-code flow: if used, the displayed code is shown only in the embedded terminal, never copied by Overmind.
2. **Helper API** (pure, unit-testable):
   ```ts
   classifyLoginUrl(cli: 'claude'|'codex', url: string): { ok: true; url: URL } | { ok: false; reason: 'scheme'|'host'|'credentials'|'malformed'|'too_long' }
   class LoginSession { state; start(cli, now); onScreenFacts(facts); cancel(); isExpired(now); // TTL 10 min overall }
   validateRedirectPaste(input: string, session): Result<ValidatedRedirect>     // L5 rules; returned object holds the URL only in memory, `toJSON()` => '[LOGIN_URL]'
   assertForwardAllowed(req: ForwardRequest, session): Result<void>            // L4 rules
   ```
   Errors registered as `security.login_*` codes (telegramSafe true, generic messages).
3. **Screen-reader contract** documented for PROV (`LoginScreenFacts` shape) including a rule to run the windowed redactor (SEC003) before any derived text is stored.
4. **Checklist for implementers** appended to the doc: wizard states, what to log, what never to log, test steps using the fake CLI (TEST006 provides `fake-claude --scenario login-required` and `fake-codex --scenario login-redirect`).

## 6. Design notes

N/A, functionality only (wizard visuals belong to ONB).

## 7. Reuse

`Sandbox.forwardPort` and `openExternal` (ARCH012), redaction (ARCH004/SEC003), `Result`/errors (ARCH003), fake CLIs (TEST006). ONB, PROV and BOX tasks must use these helpers; custom URL handling is a defect.

## 8. Architecture and code placement

Pure helpers in `packages/application/src/security/login-flow/{classify-login-url.ts,login-session.ts,validate-redirect-paste.ts,assert-forward-allowed.ts,allowlist.ts}`; doc under `docs/security/`. No I/O.

## 9. Security and safety

Threats: capture of OAuth codes by local port squatting, phishing URL displayed by a malicious CLI output (the screen text is untrusted), accidental logging of codes, credential volume reuse across Workspaces, forward left open. Controls: URL allowlist and explicit click, loopback-only forward with TTL and single use, state/PKCE reliance on same attempt, volume isolation, no logging of login screens, no automation. Fail closed: any validation failure aborts the login helper and informs the Owner.

## 10. Errors and edge cases

- CLI prints a login URL on multiple wrapped lines: reader reassembles it before classification.
- URL host differs by subdomain (`auth0.openai.com`): rejected until the allowlist is updated by a code change.
- Owner pastes a redirect from a previous attempt: rejected (`state` unknown/expired), no exec performed.
- Two logins at once: second blocked until the first finishes.
- Container stops during login: session fails, forward closed.
- Browser on the Mac cannot open `localhost:1455` because another app uses it: abort with explanation.

## 11. Acceptance criteria

- [ ] `login-flow.md` states L1-L12 and links SR-21.
- [ ] `classifyLoginUrl` table tests: allowed hosts pass; look-alike hosts (`claude.ai.evil.com`, `evilclaude.ai`), userinfo tricks, `http`, `javascript:`, IDN homographs, overlong URLs fail.
- [ ] `validateRedirectPaste` accepts only the exact callback shape within TTL once; rejects other ports, paths, extra params, second use.
- [ ] `assertForwardAllowed` rejects non-loopback bind, TTL > 5 min, second concurrent forward, wrong environment.
- [ ] `LoginSession` and result objects serialise without URL/code (`JSON.stringify` test, `expectNoSecrets`).
- [ ] Implementer checklist present and references fake CLI scenarios.

## 12. Test plan

Unit tests for each helper (table-driven), property test for URL parsing robustness, `expectNoSecrets` on serialised sessions. Later integration with TEST006 fake CLIs belongs to ONB/PROV tasks. Commands: `pnpm vitest run packages/application/src/security/login-flow`.

## 13. Parallelization notes

Independent small task; ONB, PROV and BOX authors read the doc first. The helper API should merge early so they can import it.

## 14. Open questions and assumptions

- ASSUMPTION: callback port for Codex is 1455 as in the prototype; if the CLI changes it, the allowlist/port table in `allowlist.ts` is updated (data change, with a test).
- Open: whether to support the manual curl workaround at all in MVP (UX burden vs account settings change); default: implement as the third option.
