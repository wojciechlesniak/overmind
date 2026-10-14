---
id: OVE_CONNUI002
title: "Connections data hooks: list, status, detect, test, polling and push refresh"
area: CONNUI
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CONNUI001, OVE_PROV002, OVE_PROV021]
soft_depends_on: []
provides: ["lib:use-connections", "lib:connection-vm"]
needs: ["api:connections.list", "api:connections.detect", "api:connections.test", "api:connections.status", "lib:api-client-connections", "contract:Connection", "contract:ModelUsage"]
owns: ["apps/desktop/src/features/connections/api/**", "apps/desktop/src/features/connections/model/connection-vm.ts", "apps/desktop/src/features/connections/model/__fixtures__/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14"]
adr_refs: [22, 7]
---

# OVE_CONNUI002: Connections data hooks: list, status, detect, test, polling and push refresh

## 1. Summary

Implements the data layer: `useConnections`, `useConnectionStatus(id)`, detect/test mutations with rate-limit handling, a pure mapper from `Connection` + status + usage to a card view-model, and refresh by push events and light polling.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`.

## 3. Scope (in)

- `api/connections.ts`, `api/useConnections.ts`, `api/useConnectionStatus.ts`, `api/useDetectConnections.ts`.
- `model/connection-vm.ts`: `ConnectionVm` + `mapConnection()`, status table.
- `model/__fixtures__/connections.fixtures.ts` (mock data: Claude 2.4.1 62% Max, Codex 0.61 38% Pro, Ollama localhost:11434 qwen3:32b/llama4:17b, Telegram).

## 4. Out of scope

- Rendering.

## 5. Detailed requirements

1. `useConnections()` -> `GET /v1/connections` -> `Connection[]` sorted by constants `claude, codex, ollama, telegram`; unknown types appended. Refetch on `connection.status.changed` push (if provided) and every 30 s while the window is focused (status can change when the Owner logs in inside the terminal).
2. `useConnectionStatus(id)` -> `GET /connections/{id}/status` (`usage`, `activeAgents`, `limit`, `queued`), 30 s polling when visible; stale data kept on error with `stale` flag.
3. `useDetectConnections()` -> `POST /connections/detect {providers?}`; client throttles to 1 per 5 s per Connection (server limit); `429` shows 'Try again in a few seconds'. `useTestConnection(id)` -> `POST /connections/{id}/test` -> `checks[]` (names + pass/fail + detail key).
4. `ConnectionVm = { id, type:'cli'|'ollama'|'telegram'|'api', providerId, title, subtitleKey, version?, status, statusTone:'ok'|'warn'|'error'|'idle', statusLabelKey, rows:{labelKey,value:string|{key,params},mono:boolean}[], usage?:{reportedText, percent?, resetText?, source:'cli'}, actions:ActionId[], disabledReasons:Record<ActionId,key> }`.
5. Status table (pure): `ready` -> tone ok 'signed in'(cli)/'running'(ollama)/'paired'(telegram); `needs_login` -> warn 'sign in needed' action `login`; `not_installed` -> idle 'not installed' action `detect`; `degraded` -> warn; `limit_reached` -> warn 'limit reached' with reset text; `error` -> error; `disabled` -> idle 'off'; `unknown` -> idle 'checking...'. Unknown values -> idle, never ok (fail closed).
6. Usage text: `reportedLimit` shown verbatim (text node), never re-computed; `percent` only when the CLI text contained one (PROV017 parser provides `percent?`), else no bar.
7. Errors map `error.code` -> i18n keys (`provider.not_found`, `provider.busy`, `box.isolation_unavailable`, `perm.local_only`, `provider.needs_login`).
8. Telegram connection VM is built from `useTelegramStatus` (OVE_SETUI005) in OVE_CONNUI005, not here.

## 6. Design notes

N/A (functionality). Values from `design.png` of the card tasks.

## 7. Reuse

- `@overmind/api-client` PROV connections client (`lib:api-client-connections`), `formatRelative`, query conventions.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`.

## 10. Errors and edge cases

- Connection missing from list after remove: cache invalidated.
- Status endpoint 404 for a Connection removed elsewhere: refetch the list.
- Detect running long (10 s): spinner with cancel-free semantics.
- Newer engine adds statuses: idle fallback.

## 11. Acceptance criteria

- [ ] Given the fixtures, Then `mapConnection` produces the four mock cards.
- [ ] Given an unknown status, Then tone is idle and no actions except detect.
- [ ] Given two detect clicks within 5 s, Then one request is sent.
- [ ] Given a push event, Then the list updates without waiting for polling.
- [ ] Given `reportedLimit` text with markup characters, Then it stays plain text.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `connection-vm.test.ts` (status table, usage), hook tests with fake timers and events, throttle test. Commands: `pnpm --filter @overmind/desktop test features/connections/data, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/api/**`, `apps/desktop/src/features/connections/model/connection-vm.ts`, `apps/desktop/src/features/connections/model/__fixtures__/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: `connection.status.changed` push event not named by PROV021 (assumed `provider.connection.changed`); polling is the fallback.
- ASSUMPTION: `percent?` comes from PROV017 parser.
