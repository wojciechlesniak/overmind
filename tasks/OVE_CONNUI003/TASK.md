---
id: OVE_CONNUI003
title: CLI cards for Claude Code and Codex CLI with all connection states
area: CONNUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CONNUI001, OVE_CONNUI002, OVE_CONNUI010, OVE_DS013, OVE_DS018, OVE_DS079]
soft_depends_on: []
provides: ["ui:CliCard"]
needs: ["ui:ConnectionCard", "ui:ConnectionGrid", "ui:StatusPill", "ui:Button"]
owns: ["apps/desktop/src/features/connections/components/slots/ClaudeCard.card.tsx", "apps/desktop/src/features/connections/components/slots/CodexCard.card.tsx", "apps/desktop/src/features/connections/components/CliCard.tsx", "apps/desktop/src/features/connections/model/cli-actions.ts"]
reads: []
design: design.png
design_source: "Polaczenia#connections/claude-card (crop 88,241,513,300 CSS px, tall render)"
spec_refs: ["SPECIFICATION 14"]
adr_refs: [22]
---

# OVE_CONNUI003: CLI cards for Claude Code and Codex CLI with all connection states

## 1. Summary

Implements the Claude Code and Codex CLI cards: header (icon, name, 'official CLI' + version, status), detail rows, and actions 'Open CLI terminal' and 'Sign out', with states signed in, needs login, not installed, limit reached, degraded and error.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. Card anatomy is `ui:ConnectionCard` (OVE_DS079): icon tile with `>_`, title 17/700, mono subtitle `oficjalne CLI · claude 2.4.1`, status pill 'zalogowany' (green dot), rows, action buttons 'Otworz terminal CLI' and 'Wyloguj'.

## 3. Scope (in)

- `components/slots/ClaudeCard.card.tsx` (order 10), `CodexCard.card.tsx` (order 20), shared `components/CliCard.tsx`, `model/cli-actions.ts` (state -> actions).

## 4. Out of scope

- Login terminal (OVE_CONNUI006), logout flow (OVE_CONNUI007), detail rows (OVE_CONNUI010).

## 5. Detailed requirements

1. `CliCard` renders `ui:ConnectionCard` with `ConnectionVm`; the body is `ui:CliDetailRows`; footer buttons from `actions`.
2. Action table (pure `cli-actions.ts`, OCP: table not switch): `ready` -> [`open_terminal`, `logout`]; `needs_login` -> [`login` primary 'Sign in', `test`]; `not_installed` -> [`detect`, `help` link text 'How to install' showing the official install command as copyable text, not a link]; `limit_reached` -> [`open_terminal`, `logout`] + warn banner with reset text; `degraded`/`error` -> [`test`, `open_terminal`]; `unknown` -> none (spinner).
3. `open_terminal` opens the login/CLI terminal dialog of OVE_CONNUI006 (it is also the way to sign in again); `logout` opens OVE_CONNUI007; `login` = same dialog in login mode. Buttons call handlers passed by those tasks through the registry `components/card-actions/*.handler.ts` (glob, `{actionId, run}`): until merged, handlers are no-ops disabled with reason 'Not available yet'.
4. Status pill from `statusTone`/`statusLabelKey`; the pill and the version subtitle never show tokens or account e-mail (Overmind does not know them).
5. `not_installed`: the card shows rows greyed and the hint 'Install the official CLI in the Overmind environment. Overmind does not install it for you.' (ADR 0022).
6. Busy: while detect/test runs, the status pill shows a spinner and buttons are disabled.
7. Telegram/herdr status are other tasks; this task renders only the two CLI providers (both through the same component: DRY).

## 6. Design notes

`design.png`: card r20, padding 24, 2 columns each 513px wide in the grid; buttons secondary size md; status pill top right; row separators 1px.

## 7. Reuse

- `ui:ConnectionCard`, `ui:ConnectionGrid`, `ui:StatusPill`, `ui:Button`, `ui:CliDetailRows` (OVE_CONNUI010), `lib:use-connections`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: there is no way in the UI to paste or enter a CLI password/token; sign in only happens in the CLI inside the container terminal (OVE_CONNUI006).

## 10. Errors and edge cases

- Two CLIs ready but one limit_reached: card-level banner only on that card.
- Version string empty: hide the version part.
- Status call stale: pill shows 'unknown' with a muted dot.

## 11. Acceptance criteria

- [ ] Given a signed-in Claude Code, Then the card matches `design.png`.
- [ ] Given `needs_login`, Then the primary action is 'Sign in'.
- [ ] Given `not_installed`, Then no login button is shown and the install hint is visible.
- [ ] Given an unknown status, Then no destructive action is offered.
- [ ] Given Codex, Then the same component renders with Codex data.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `cli-actions.test.ts` (table), `CliCard.test.tsx` per state, stories for 7 states, visual vs `design.png`. Commands: `pnpm --filter @overmind/desktop test features/connections/cli-card, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/slots/ClaudeCard.card.tsx`, `apps/desktop/src/features/connections/components/slots/CodexCard.card.tsx`, `apps/desktop/src/features/connections/components/CliCard.tsx`, `apps/desktop/src/features/connections/model/cli-actions.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Handlers are provided by other tasks through `components/card-actions/*.handler.ts`. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: Claude and Codex are the only CLI providers in MVP; a third CLI is a new slot file.
