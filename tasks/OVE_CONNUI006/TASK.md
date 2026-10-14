---
id: OVE_CONNUI006
title: "Login terminal dialog: instructions, host command, status polling and cancel"
area: CONNUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CONNUI001, OVE_CONNUI002, OVE_DS013, OVE_DS032, OVE_DS036, OVE_DS040, OVE_DS052, OVE_PROV021, OVE_SHELL011]
soft_depends_on: []
provides: ["ui:CliLoginDialog"]
needs: ["ui:Dialog", "ui:TerminalPane", "ui:Button", "ui:Skeleton", "ui:InfoNote", "lib:current-workspace", "api:connections.login.start", "api:connections.login.status", "api:connections.login.cancel"]
owns: ["apps/desktop/src/features/connections/components/login/**", "apps/desktop/src/features/connections/api/useCliLogin.ts", "apps/desktop/src/features/connections/model/login-state.ts", "apps/desktop/src/features/connections/components/card-actions/login.handler.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14"]
adr_refs: [22, 26, 20]
---

# OVE_CONNUI006: Login terminal dialog: instructions, host command, status polling and cancel

## 1. Summary

Implements 'Open CLI terminal' / 'Sign in': a dialog that starts a CLI login session through the engine, shows the instruction and the copyable host command, polls the login state and ends when the CLI reports signed in, expired or cancelled; Overmind never touches credentials.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. PROV021: `POST /connections/{id}/login {workspaceId, method?}` (local, Idempotency-Key) -> `{loginId, method:'paste_code'|'device_code'|'browser_callback', instructionKey, instructionParams, hostCommand?:{display}, forward?:{hostPort}, expiresAt}`; `GET /connections/{id}/login/{loginId}` -> `{state:'pending'|'waiting_user'|'succeeded'|'failed'|'expired'|'cancelled'}` (poll <= 1/s); `POST .../cancel`. The terminal pane component `ui:TerminalPane` (OVE_DS052) has a 'login' mode. The login happens inside the Overmind container (CLI logins persist in a separate volume, prototype facts). The paste-callback step is NOT a gateway route (gap).

## 3. Scope (in)

- `components/login/LoginDialog.tsx`, `LoginInstructions.tsx`, `HostCommandBox.tsx`, `api/useCliLogin.ts`, `model/login-state.ts`, `components/card-actions/login.handler.ts` (registers `open_terminal` and `login`).

## 4. Out of scope

- Logout (OVE_CONNUI007).

## 5. Detailed requirements

1. Dialog opens with title 'Sign in to <provider>'. Step 1: `startCliLogin(id, {workspaceId: currentWorkspace})` with a fresh Idempotency-Key; shows skeleton until the response.
2. Instruction text from `instructionKey/params` (i18n, keys per method e.g. `login.paste_code`: 'Run the command below in a terminal. Sign in in the browser, then paste the code in the CLI.'). `hostCommand.display` in `HostCommandBox` (mono, copy button, never auto-run; the dialog does not execute anything on the host).
3. Embedded `ui:TerminalPane` in login mode attaches to the CLI session through the terminal bridge if the engine provides a terminal stream (herdr/ADR 0026); otherwise only instructions + command are shown (graceful degradation). The terminal is the only place the Owner types secrets; the UI never reads its content.
4. Polling `useCliLogin(loginId)` every 1 s while the dialog is open: states drive UI: `waiting_user` shows 'Waiting for you to finish in the CLI...' with elapsed time; `succeeded` -> success tick, close after 1.2 s, invalidate connections; `failed` -> error with key and 'Try again'; `expired` -> 'Code expired' + 'Try again'; `cancelled`.
5. Cancel button (and Esc) calls `cancel` then closes; closing the dialog by any means cancels an unfinished login (explicit text).
6. Countdown to `expiresAt` visible. Single active login per Connection: a second open resumes the existing session if `409 provider.busy` returns its `loginId`.
7. Method fallback: if `browser_callback` is returned, the instruction explains the forwarded port (`forward.hostPort`) as display only text; the UI never opens URLs from the engine.

## 6. Design notes

Derived from `ui:Dialog` + `ui:TerminalPane` (DS052) and `ui:Stepper`. Visual reference: card buttons in `design.png` of OVE_CONNUI003. No mock of the dialog.

## 7. Reuse

- `ui:Dialog`, `ui:TerminalPane` (OVE_DS052), `ui:Button`, `ui:Skeleton`, `ui:InfoNote`, `lib:current-workspace`, `lib:use-connections`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific (critical): Overmind must never see, store or log credentials (ADR 0022): the dialog renders no input for passwords/tokens; the terminal pane is a pass-through whose content the app does not read, store or screenshot-log; the host command comes from the engine and contains no secrets; text from the engine is plain text; no `window.open` of engine-provided URLs; `hostCommand` is copyable but never auto-copied. Login start is local-only (`local: true` derived by the gateway); not available from Telegram.

## 10. Errors and edge cases

- Container not running: `box.isolation_unavailable` -> 'The isolated environment is not ready' + link to the environment card.
- Poll fails repeatedly: 'Lost contact with the engine', login stays pending server-side until expiry.
- User closes the app during login: engine session expires by TTL.
- Login `succeeded` but test fails: status shows needs_login again with 'Check again'.
- Two windows: both see the same state.

## 11. Acceptance criteria

- [ ] Given Sign in, Then one login request with Idempotency-Key is sent and the instruction and host command show.
- [ ] Given `succeeded`, Then the dialog closes and the card becomes signed in.
- [ ] Given expiry, Then 'Code expired' and retry.
- [ ] Given Cancel/Esc/close, Then a cancel request is sent.
- [ ] Given the DOM, Then no password/token input exists and the terminal content is never read by app code (lint rule test).

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `login-state.test.ts`, `useCliLogin.test.tsx` (polling, states), `LoginDialog.test.tsx`, `login.security.test.ts` (no inputs, no window.open), Playwright login flow on the mock gateway. Commands: `pnpm --filter @overmind/desktop test features/connections/login, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/login/**`, `apps/desktop/src/features/connections/api/useCliLogin.ts`, `apps/desktop/src/features/connections/model/login-state.ts`, `apps/desktop/src/features/connections/components/card-actions/login.handler.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: terminal stream for the login mode (TerminalPane needs an engine/herdr stream route; none named); instructions-only fallback is implemented.
- GAP: paste-callback route is not defined (PROV021 section 5.2).
