---
id: OVE_CONNUI007
title: Sign out and remove a connection with Local Approval
area: CONNUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_CONNUI002, OVE_DS024, OVE_DS036, OVE_DS037, OVE_PROV021, OVE_WSPACE014]
soft_depends_on: ["OVE_CONNUI003"]
provides: []
needs: ["ui:ConfirmDialog", "ui:Checkbox", "ui:useToast", "lib:use-local-approval", "api:connections.remove", "api:agents.list"]
owns: ["apps/desktop/src/features/connections/components/logout/**", "apps/desktop/src/features/connections/components/card-actions/logout.handler.ts", "apps/desktop/src/features/connections/model/logout-impact.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [22, 3]
---

# OVE_CONNUI007: Sign out and remove a connection with Local Approval

## 1. Summary

Implements 'Wyloguj' (sign out of a CLI) and removal of a connection: a warning with the Agents affected and Local Approval before the engine signs out or removes the connection.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. PROV021: `DELETE /connections/{id}` is local-only, requires the Local Approval proof (PERM009), body `{alsoSignOut?: boolean}`. Sign-out removes the CLI's stored login from the environment volume. Impact: Agents bound to this connection fall back per the fallback order (OVE_CONNUI008).

## 3. Scope (in)

- `components/logout/LogoutDialog.tsx`, `components/card-actions/logout.handler.ts`, `model/logout-impact.ts`.

## 4. Out of scope

- Local Approval hook (OVE_WSPACE014).

## 5. Detailed requirements

1. Click 'Sign out' -> `ConfirmDialog` danger: 'Sign out of <CLI>? Agents that use it ({names}) will switch to the next option in the fallback order or wait for you. You will need to sign in again in the terminal.' Affected Agents from `api:agents.list` (names, max 5 + N). Checkbox 'Also sign out inside the CLI' default ON (`alsoSignOut`).
2. Confirm -> `useLocalApproval().run({operation:'connection.remove', args:{connectionId, alsoSignOut}, call:(proof,args)=> removeConnection(id,{...args, localProof: proof})})`; describer 'Sign out and remove <CLI>'. (ASSUMPTION: operation name `connection.remove`; PERM031 registry lacks it: gap.)
3. Success: toast 'Signed out'; connections list invalidated; the card shows needs_login/not signed in. Failure: error shown; nothing changes (fail closed).
4. Disabled with visible reason while an Agent invocation is running on this connection? No: engine handles; the dialog says running work may fail over.
5. Not available from Telegram or Chief.

## 6. Design notes

Derived from `ui:ConfirmDialog` danger variant; button style per mock ('Wyloguj' secondary).

## 7. Reuse

- `ui:ConfirmDialog`, `ui:Checkbox`, `useToast`, `lib:use-local-approval`, `lib:use-connections`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific (critical): removing a connection changes what Agents can use, so it is a Local Approval operation bound to `{connectionId, alsoSignOut}`; the proof travels in the body; no proof, no call. The dialog never shows account identifiers.

## 10. Errors and edge cases

- Approval expired: re-ask.
- Connection already removed: treat as success.
- Engine refuses: show code.

## 11. Acceptance criteria

- [ ] Given Sign out confirmed, Then a Local Approval is requested first and the DELETE carries `localProof`.
- [ ] Given Cancel, Then no request.
- [ ] Given affected Agents, Then they are listed.
- [ ] Given failure, Then the card state is unchanged.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `logout-impact.test.ts`, `LogoutDialog.test.tsx`, `logout.security.test.ts` (no call without proof). Commands: `pnpm --filter @overmind/desktop test features/connections/logout, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/logout/**`, `apps/desktop/src/features/connections/components/card-actions/logout.handler.ts`, `apps/desktop/src/features/connections/model/logout-impact.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: Local Approval operation `connection.remove` is not in the PERM031 registry; PROV021 contract does not declare `localProof`.
- OPEN: `alsoSignOut` default.
