---
id: OVE_CONNUI010
title: "CLI detail rows: plan, limit as reported by the CLI, models and who uses them"
area: CONNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_CONNUI002, OVE_DS051, OVE_DS077]
soft_depends_on: []
provides: ["ui:CliDetailRows"]
needs: ["ui:KeyValueList", "ui:UsageBarRow", "api:agents.list"]
owns: ["apps/desktop/src/features/connections/components/CliDetailRows.tsx", "apps/desktop/src/features/connections/model/cli-rows.ts"]
reads: []
design: design.png
design_source: "Polaczenia#connections/cli-rows (crop 88,320,513,150 CSS px, tall render)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [22]
---

# OVE_CONNUI010: CLI detail rows: plan, limit as reported by the CLI, models and who uses them

## 1. Summary

Implements the key/value rows inside a CLI card ('Plan', 'Limit wg CLI', 'Modele', 'Uzywa') and the per-CLI usage presentation: limit text exactly as the CLI reports it, optional meter, models list and the Agents using this connection.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. Mock rows: Claude: Plan 'Claude Max', 'Limit wg CLI' `62% · reset za 3 h`, Modele `Opus 5.5, Sonnet 5.5, Haiku 5.5`, Uzywa `Chief, Developer, Security, PO, Senior Rev.`; Codex: 'ChatGPT Pro', `38% · reset za 5 dni`, `gpt-5.5, gpt-5.5-mini`, `QA, Designer`. Top bar (SHELL) also shows 'Claude Max 62% · reset 3 h · wg CLI'. Overmind never computes quotas: ADR 0022, spec 14.

## 3. Scope (in)

- `components/CliDetailRows.tsx` (uses `ui:KeyValueList`/`ui:UsageBarRow`), `model/cli-rows.ts` (pure).

## 4. Out of scope

- Card shell and buttons (OVE_CONNUI003).

## 5. Detailed requirements

1. Rows from `ConnectionVm.rows`; label column muted 13px, value mono right aligned; separators 1px; the 'Limit wg CLI' label includes the source suffix 'per CLI'.
2. Limit row: shows `usage.reportedText` verbatim. If `percent` exists render `ui:UsageBarRow` (thin meter, amber from 75%, red at 90% = the fallback threshold named in the right panel) next to the text. No percent -> text only. No usage data -> 'not reported by the CLI' (never 0%).
3. Models row: names as reported by the CLI/probe (`models[]`), comma separated in mono, truncated after 3 with '+N' and a tooltip; Ollama lists pulled models.
4. 'Uses' row: agents using this connection from `api:agents.list` grouped by `modelBinding.connectionId` (names only; max 5 then '+N'); empty -> 'nobody yet'. This is read-only information; changing an Agent's model is done in the Agent profile (AGUI).
5. Plan row: from `connection.plan` text if the probe reported it; else hidden (not guessed).
6. All values are untrusted text (CLI output sanitised by PROV017 but still rendered as text).

## 6. Design notes

`design.png`: 4 rows each ~46px, label 14 muted, value 14 mono right; separators `rgba(255,255,255,.06)`.

## 7. Reuse

- `ui:KeyValueList`, `ui:UsageBarRow` (OVE_DS077), `lib:use-connections`, `api:agents.list`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`.

## 10. Errors and edge cases

- Limit text very long: wraps, ellipsis after 2 lines with tooltip.
- Usage stale (older than 10 min): muted with 'as of <time>'.
- `limit_reached` status: row turns warn with the reset text.

## 11. Acceptance criteria

- [ ] Given the Claude fixture, Then rows match `design.png`.
- [ ] Given no usage, Then 'not reported by the CLI' appears, not 0%.
- [ ] Given percent 91, Then the meter is red.
- [ ] Given 8 Agents, Then 5 names and '+3'.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `cli-rows.test.ts`, component tests, visual. Commands: `pnpm --filter @overmind/desktop test features/connections/rows, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/CliDetailRows.tsx`, `apps/desktop/src/features/connections/model/cli-rows.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- OPEN: whether the percent meter should be shown at all (the mock shows text only); default: meter only when percent known.
- GAP: Agent->connection binding read model; assumed from `api:agents.list` rows.
