---
id: OVE_CONNUI008
title: "Fallback order panel: reorder what happens when a limit ends"
area: CONNUI
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_CONNUI001, OVE_DS044, OVE_DS080, OVE_ENGINE024, OVE_SETUI001]
soft_depends_on: []
provides: []
needs: ["ui:FallbackOrder", "ui:SidePanel", "lib:use-app-config", "api:config.get", "api:config.update"]
owns: ["apps/desktop/src/features/connections/components/slots/FallbackOrder.panel.tsx", "apps/desktop/src/features/connections/api/useFallbackOrder.ts", "apps/desktop/src/features/connections/model/fallback-order.ts"]
reads: []
design: design.png
design_source: "Polaczenia#connections/fallback-order (crop 1130,180,300,270 CSS px, tall render)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [7, 22]
---

# OVE_CONNUI008: Fallback order panel: reorder what happens when a limit ends

## 1. Summary

Implements 'Gdy konczy sie limit': an ordered, draggable list of fallback steps with the 90% threshold text, persisted in the app config.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. Mock list: 1 'Model przypisany Agentowi', 2 'Drugie CLI (Claude <-> Codex)', 3 'Ollama · qwen3:32b', 4 'Eskalacja do Ciebie'; text 'Przy 90% limitu Chief przelacza Agentow w tej kolejnosci i wysyla powiadomienie.' Config: `providers.fallbackOrder` (ENGINE024); `ProvConfig.fallbackChain` in PROV is a second place (conflict).

## 3. Scope (in)

- `components/slots/FallbackOrder.panel.tsx` (order 10), `api/useFallbackOrder.ts`, `model/fallback-order.ts`.

## 4. Out of scope

- Executing the fallback (PROV/CHIEF).

## 5. Detailed requirements

1. Items from config `providers.fallbackOrder: FallbackStep[]` with `FallbackStep = 'assigned'|'other_cli'|'ollama'|'escalate'`; labels via i18n; the 'Ollama' step shows the configured model (`qwen3:32b`) from the Ollama connection VM.
2. Rules (pure `fallback-order.ts`): 'assigned' is always first and 'escalate' is always last (both rendered with a lock icon, not draggable); 'other_cli' and 'ollama' can be swapped; a step is disabled/greyed when unavailable (Ollama not running) with reason text, but stays in order.
3. Drag handle (6-dot) uses `ui:SortableList`/`FallbackOrder` (OVE_DS080) with keyboard reordering (Space to lift, arrows, Space to drop; `aria-live` announcements). Persist with `config.update({providers:{fallbackOrder}})`; revert on error.
4. Text 'At 90% of a limit Chief switches Agents in this order and notifies you.' with the 90% threshold read from config (`providers.limitSwitchThreshold`, default 90, display only).
5. Escalation step explained in a tooltip: 'Agents wait and you get a notification'.

## 6. Design notes

`design.png`: 4 rows r12 with border, handle + number + label 15/600; heading 20/700; description 15 muted.

## 7. Reuse

- `ui:FallbackOrder` (OVE_DS080), `ui:SidePanel`, `lib:use-app-config` (OVE_SETUI001 capability `lib:use-app-config`).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: the order only decides model fallback between connections the Owner already added; it cannot enable a provider that is signed out or add a new account.

## 10. Errors and edge cases

- Concurrent change in another window: refetch, keep local drag until drop.
- Config conflict: revert + message.
- Unknown step value: shown as raw text, locked.

## 11. Acceptance criteria

- [ ] Given the default config, Then the panel matches `design.png`.
- [ ] Given dragging 'Ollama' above 'Other CLI', Then config is updated with the new order.
- [ ] Given 'assigned' first, Then it cannot be moved.
- [ ] Given keyboard only, Then reordering works.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `fallback-order.test.ts`, component tests (keyboard, revert), visual. Commands: `pnpm --filter @overmind/desktop test features/connections/fallback, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/slots/FallbackOrder.panel.tsx`, `apps/desktop/src/features/connections/api/useFallbackOrder.ts`, `apps/desktop/src/features/connections/model/fallback-order.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- CONFLICT: `providers.fallbackOrder` (AppConfig) vs `ProvConfig.fallbackChain` (PROV); one must be chosen.
- GAP: no dedicated fallback API; config key used.
- ASSUMPTION: first and last steps are fixed (the mock does not say).
