---
id: OVE_CONNUI001
title: Connections route, feature manifest, page header and card grid layout
area: CONNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DS044, OVE_DS045, OVE_DS079]
soft_depends_on: []
provides: ["ui:ConnectionsRoute", "lib:connections-slot-registry"]
needs: ["ui:PageLayout", "ui:PageHeader", "ui:ConnectionGrid", "ui:SidePanel", "lib:define-feature"]
owns: ["apps/desktop/src/features/connections/feature.manifest.ts", "apps/desktop/src/features/connections/routes/**", "apps/desktop/src/features/connections/components/slot-registry.ts", "apps/desktop/src/locales/en/connections.json", "apps/desktop/src/locales/pl/connections.json"]
reads: []
design: design.png
design_source: "Polaczenia#connections/header (crop 88,172,1016,72 CSS px, tall render)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 14"]
adr_refs: [22]
---

# OVE_CONNUI001: Connections route, feature manifest, page header and card grid layout

## 1. Summary

Creates the `connections` feature skeleton: lazy route `/connections`, i18n namespace, the page header ('Polaczenia i modele' + subtitle), a two-column layout (card grid left, side panels right) and glob-collected slots for the cards and side panels.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`.

## 3. Scope (in)

- `feature.manifest.ts` (route `/connections`, nav sub-tab of Workspace settings via the shell slot `settings-tabs` with label 'Connections and models', order 20, no own sidebar icon).
- `routes/ConnectionsRoute.tsx`: `ui:PageHeader` title + subtitle, `ui:ConnectionGrid` (OVE_DS079) with slot-collected cards, right column `ui:SidePanel` with slot-collected panels.
- `components/slots/*.card.tsx` (`{id, order, Component}` for cards) and `components/slots/*.panel.tsx` (right panels) collected by `import.meta.glob`; `components/slot-registry.ts`.
- Locale files `locales/en|pl/connections.json` with `page.*` keys.

## 4. Out of scope

- Card contents (OVE_CONNUI003..005, 011, 012), side panels (008, 009), data hooks (002).

## 5. Detailed requirements

1. Header copy: title 'Connections and models'; subtitle 'Sign in inside the CLI, in the Overmind terminal. Overmind never sees passwords or tokens.' (mock: 'Polaczenia i modele' / 'Logujesz sie w samym CLI, w terminalu Overmind. Overmind nie widzi hasel ani tokenow.').
2. Card order (constants of owning tasks): Claude 10, Codex 20, Ollama 30, Telegram 40, Environment 50, API keys 90; two-column grid, cards equal width, wrap to 1 column below 900px; right column 300px, sticky at top.
3. Panel order: Fallback 10, Concurrency 20, compliance note 90 (bottom-aligned as in the mock: margin-top auto).
4. Registry sorts by order and rejects duplicate ids (dev error).
5. The route renders inside the Workspace settings tab layout from OVE_WSPACE017/SHELL: it only registers the tab through the slot; it does not render the tab bar.
6. Page-level 'Detect again' icon button (header actions) calls `detect` from OVE_CONNUI002 and shows 'Checking...' state.

## 6. Design notes

`design.png`: header region: title 32px/700, subtitle 14px muted, 16px gap before the grid; grid gap 20px.

## 7. Reuse

- `ui:PageLayout`, `ui:PageHeader`, `ui:ConnectionGrid`, `ui:SidePanel`, `defineFeature`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown.

## 10. Errors and edge cases

- Duplicate slot id: first wins + dev error.
- A card throws: boundary from OVE_CONNUI013 isolates it (bare until merged).
- No connections yet: grid shows the skeleton/empty state of OVE_CONNUI002.

## 11. Acceptance criteria

- [ ] Given the route, Then header and grid match `design.png`.
- [ ] Given a new `*.card.tsx`, Then it appears without editing shared files.
- [ ] Given width 800px, Then one column and no horizontal scroll.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `slot-registry.test.ts`, route test, visual of header and layout. Commands: `pnpm --filter @overmind/desktop test features/connections/layout, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/feature.manifest.ts`, `apps/desktop/src/features/connections/routes/**`, `apps/desktop/src/features/connections/components/slot-registry.ts`, `apps/desktop/src/locales/en/connections.json`, `apps/desktop/src/locales/pl/connections.json` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the shell exposes the slot `settings-tabs` (SHELL); if not, the tab is registered as a normal nav-less route.
- OPEN: page title 32px (mock) vs 26px (E7).
