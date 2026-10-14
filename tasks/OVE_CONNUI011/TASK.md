---
id: OVE_CONNUI011
title: "Environment status card: herdr and the isolated container"
area: CONNUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_CONNUI001, OVE_DS013, OVE_DS018, OVE_DS051, OVE_DS079, OVE_ENGINE006]
soft_depends_on: []
provides: []
needs: ["ui:ConnectionCard", "ui:KeyValueList", "ui:StatusPill", "ui:Button", "api:system.health"]
owns: ["apps/desktop/src/features/connections/components/slots/EnvironmentCard.card.tsx", "apps/desktop/src/features/connections/model/environment-vm.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14"]
adr_refs: [26, 20]
---

# OVE_CONNUI011: Environment status card: herdr and the isolated container

## 1. Summary

Adds a derived card showing the state of herdr (terminal layer) and the isolated container environment (ready, containers running, image), with remedies and the last isolation test link.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. Not drawn in the mock (VIEWS lists it as a needed region: herdr and container status). `api:system.health` checks `sandbox` (detail `{ready, containers}`) and `herdr` (assumed ids, registered by BOX/PROV). ADR 0026 herdr, ADR 0020 macOS isolation via VM/containers.

## 3. Scope (in)

- `components/slots/EnvironmentCard.card.tsx` (order 50), `model/environment-vm.ts`.

## 4. Out of scope

- Starting/stopping containers, the escape test itself.

## 5. Detailed requirements

1. Rows: 'Isolation' (ready / not ready / starting), 'Containers' (`n running`), 'herdr' (version, ok/missing), 'Image' (name:tag display), 'Escape test' (passed/failed/never, link to Settings security row).
2. Status pill: ok when all ok; warn if starting; error when not ready (Agents cannot run: text 'Agents cannot work until the environment is ready').
3. Actions: 'Check again' (`GET system/health` refetch), 'Open diagnostics' (Settings diagnostics section). No start/stop controls (engine manages).
4. Data from `useSystemHealth` (query `api:system.health`, 15 s polling when visible); missing check ids render 'unknown' (idle), never ok.

## 6. Design notes

Derived from `ui:ConnectionCard` (no icon text 'ENV'); same row styling.

## 7. Reuse

- `ui:ConnectionCard`, `ui:KeyValueList`, `ui:StatusPill`, `ui:Button`, `api:system.health`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`.

## 10. Errors and edge cases

- Health endpoint fails: all rows unknown.
- Container count > limit: shown as is.

## 11. Acceptance criteria

- [ ] Given not ready, Then the pill is red with the consequence text.
- [ ] Given missing herdr check, Then 'unknown' and not ok.
- [ ] Given all ok, Then the pill is green.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `environment-vm.test.ts`, card states. Commands: `pnpm --filter @overmind/desktop test features/connections/environment, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/slots/EnvironmentCard.card.tsx`, `apps/desktop/src/features/connections/model/environment-vm.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: health check ids `sandbox` and `herdr` must be registered by BOX/PROV; isolation escape-test status API missing.
- DESIGN GAP: not in mock.
