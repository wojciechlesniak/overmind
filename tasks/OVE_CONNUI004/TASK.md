---
id: OVE_CONNUI004
title: "Ollama card: address, models, check and pull model, unreachable state"
area: CONNUI
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_CONNUI001, OVE_CONNUI002, OVE_CONNUI010, OVE_DS021, OVE_DS026, OVE_DS036, OVE_DS079, OVE_PROV002]
soft_depends_on: []
provides: []
needs: ["ui:ConnectionCard", "ui:Dialog", "ui:TextField", "ui:ProgressBar", "api:connections.test"]
owns: ["apps/desktop/src/features/connections/components/slots/OllamaCard.card.tsx", "apps/desktop/src/features/connections/components/ollama/**", "apps/desktop/src/features/connections/model/ollama-actions.ts"]
reads: []
design: design.png
design_source: "Polaczenia#connections/ollama-card (crop 88,531,513,267 CSS px, tall render)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [22, 7]
---

# OVE_CONNUI004: Ollama card: address, models, check and pull model, unreachable state

## 1. Summary

Implements the Ollama card (local fallback model): address and pulled models, 'Check' (test) and 'Pull model' actions, and states running, unreachable and no models.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. Mock: 'Ollama' (OL tile), subtitle `lokalnie · model zapasowy`, pill 'dziala', rows 'Adres' `localhost:11434`, 'Modele' `qwen3:32b, llama4:17b`, 'Uzywa' `Researcher`, buttons 'Pobierz model' and 'Sprawdz'. Ollama runs on the host (or in the environment) and is reached through the PROV adapter; it is the third step of the fallback order.

## 3. Scope (in)

- `components/slots/OllamaCard.card.tsx` (order 30), `components/ollama/PullModelDialog.tsx`, `model/ollama-actions.ts`.

## 4. Out of scope

- Fallback order (OVE_CONNUI008).

## 5. Detailed requirements

1. Card uses `ui:ConnectionCard` + `ui:CliDetailRows`; 'Address' row shows the configured host:port (display only; changing it is not in the MVP UI).
2. 'Check' calls `useTestConnection(id)` and shows result checks in a small popover list (reachable, version, models listed).
3. 'Pull model' opens `PullModelDialog`: text field for a model name (validated `^[a-z0-9][a-z0-9._:/-]{0,80}$`) with suggestions of the models named in the fallback panel; submit calls `POST /connections/{id}/models/pull {model}` (ASSUMPTION route, gap) and shows progress (bytes/percent from polling `GET .../models/pull/{jobId}`); cancel allowed.
4. Unreachable: status `error` with detail `unreachable`: pill red 'not running', hint 'Start Ollama on this Mac (ollama serve)' as copyable text, action 'Check'.
5. No models: row shows 'no models pulled' and the primary action becomes 'Pull model'.
6. Pulling a model downloads GBs: dialog states 'Downloads several GB from ollama.com to this Mac.' before starting.

## 6. Design notes

`design.png`: same card chrome as OVE_CONNUI003, 3 rows, buttons 'Pobierz model' / 'Sprawdz'.

## 7. Reuse

- `ui:ConnectionCard`, `ui:CliDetailRows`, `ui:Dialog`, `ui:TextField`, `ui:ProgressBar`, `lib:use-connections`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: the model name is validated client-side AND by the engine (no shell metacharacters); the pull is an engine-side download from the official registry, not an arbitrary URL; model names from the engine are untrusted text.

## 10. Errors and edge cases

- Disk full: engine error shown.
- Pull of an existing model: engine returns done immediately.
- Ollama stops mid-pull: failed state with Retry.

## 11. Acceptance criteria

- [ ] Given Ollama running, Then the card matches `design.png`.
- [ ] Given unreachable, Then the hint and Check are shown.
- [ ] Given an invalid model name, Then no request is sent.
- [ ] Given a pull in progress, Then progress is visible and cancellable.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `ollama-actions.test.ts`, `PullModelDialog.test.tsx` (validation, progress, cancel), card states, visual. Commands: `pnpm --filter @overmind/desktop test features/connections/ollama, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/slots/OllamaCard.card.tsx`, `apps/desktop/src/features/connections/components/ollama/**`, `apps/desktop/src/features/connections/model/ollama-actions.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- GAP: no model-pull API in PROV021 (assumed `POST /connections/{id}/models/pull` + job status); needs an owner in PROV.
