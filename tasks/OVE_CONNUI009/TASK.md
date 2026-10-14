---
id: OVE_CONNUI009
title: "Concurrency stepper: how many Agents work at once"
area: CONNUI
kind: ui
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_CONNUI001, OVE_DS040, OVE_DS080, OVE_ENGINE024, OVE_SETUI001]
soft_depends_on: []
provides: []
needs: ["ui:NumberStepper", "ui:InfoNote", "lib:use-app-config", "api:config.update"]
owns: ["apps/desktop/src/features/connections/components/slots/Concurrency.panel.tsx", "apps/desktop/src/features/connections/model/concurrency.ts"]
reads: []
design: design.png
design_source: "Polaczenia#connections/concurrency (crop 1130,455,300,165 CSS px, tall render)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [20]
---

# OVE_CONNUI009: Concurrency stepper: how many Agents work at once

## 1. Summary

Implements the 'Rownoleglosc' panel: a stepper for the maximum number of Agents working at once (1..10, default 3) with the RAM note, persisted in the app config.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. Mock: 'Agenci naraz' [-] 3 [+], note 'Na cala instalacje. Kazdy aktywny Agent to osobny kontener, okolo 1,3 GiB RAM.' Config `engine.maxParallelAgents` (ENGINE024 range 1..10; PROV019 says 1..16: conflict; spec says default 3). Applied by the engine live (`config.changed`).

## 3. Scope (in)

- `components/slots/Concurrency.panel.tsx` (order 20), `model/concurrency.ts`.

## 4. Out of scope

- Scheduling (ENGINE).

## 5. Detailed requirements

1. `ui:NumberStepper` min 1, max 10 (from the config schema; do not hardcode: read `maxParallelAgentsRange` if exposed, else 1..10), step 1, value from `useAppConfig`; each click debounced 400 ms then `config.update({engine:{maxParallelAgents}})`.
2. Note text: 'For the whole installation. Each active Agent is a separate container, about 1.3 GiB of RAM.' (RAM figure from i18n; computed hint 'About {n} GiB at {value} Agents' under the note).
3. Warning when value * 1.3 GiB exceeds 75% of physical RAM from `system.health` resources (if reported): amber 'This may exhaust memory'. No hard block.
4. Lowering the value does not stop running Agents (engine drains); note 'Running Agents finish first.' appears when lowering below the current active count.
5. Keyboard: +/- buttons and arrow keys; `aria-valuenow`.

## 6. Design notes

`design.png`: card r16 with label left, stepper right (36px square buttons, value 22/700); caption 14 muted.

## 7. Reuse

- `ui:NumberStepper` (OVE_DS080), `ui:InfoNote`, `lib:use-app-config`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`.

## 10. Errors and edge cases

- Config conflict: revert.
- Range change by the engine: respect returned limits.
- Rapid clicks: one request after the debounce.

## 11. Acceptance criteria

- [ ] Given value 3, Then the panel matches `design.png`.
- [ ] Given + clicked at 10, Then it is disabled.
- [ ] Given 5 clicks quickly, Then one PATCH with the final value.
- [ ] Given a failing save, Then the previous value is restored.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `concurrency.test.ts`, component test with fake timers, visual. Commands: `pnpm --filter @overmind/desktop test features/connections/concurrency, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/slots/Concurrency.panel.tsx`, `apps/desktop/src/features/connections/model/concurrency.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- CONFLICT: max 10 (ENGINE024) vs 16 (PROV019).
- ASSUMPTION: concurrency lives only here, not in Settings.
