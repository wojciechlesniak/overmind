---
id: OVE_CONNUI005
title: "Telegram card on Connections: status, bot, paired account, new pairing code and disconnect"
area: CONNUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_CONNUI001, OVE_DS013, OVE_DS018, OVE_DS079, OVE_SETUI005, OVE_SETUI006]
soft_depends_on: []
provides: []
needs: ["ui:ConnectionCard", "ui:StatusPill", "ui:Button", "lib:use-telegram", "ui:TelegramManageDialogs"]
owns: ["apps/desktop/src/features/connections/components/slots/TelegramCard.card.tsx", "apps/desktop/src/features/connections/model/telegram-card-vm.ts"]
reads: []
design: design.png
design_source: "Polaczenia#connections/telegram-card (crop 591,531,513,267 CSS px, tall render)"
spec_refs: ["SPECIFICATION 11"]
adr_refs: [6]
---

# OVE_CONNUI005: Telegram card on Connections: status, bot, paired account, new pairing code and disconnect

## 1. Summary

Implements the compact Telegram card using the Telegram hooks and dialogs of Settings: status, bot name, paired account, what Telegram may do, and the actions 'New pairing code' and 'Disconnect'.

## 2. Context

Connections and models (`Polaczenia`, VIEWS section 13; tab 'Polaczenia i modele' of the Workspace settings tab bar next to 'Ten Workspace' and 'Aplikacja') shows how Overmind reaches models: official CLIs (Claude Code, Codex CLI) that the Owner logs into inside an Overmind terminal ('Overmind nie widzi hasel ani tokenow'), Ollama as local fallback, Telegram as second channel and a disabled 'Klucze API' card ('po MVP'). Right column: 'Gdy konczy sie limit' (fallback order), 'Rownoleglosc' (concurrency stepper) and an amber compliance note. Spec 11, 14; ADR 0022 (official CLIs only, like herdr), 0007 (model per Agent and node), 0006, 0020. Prototype facts (docs/research/prototyp-wnioski.md): CLI logins live in a separate persistent volume inside the container; Overmind never reads credentials. Data: `api:connections.*` (PROV021): `Connection` statuses `unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`; `GET /connections/{id}/status` -> `{connection, usage?:ModelUsage, activeAgents, limit, queued}`. Limits are shown exactly as the CLI reports them with their source ('wg CLI'). Copy: Polish mock copy is the first translation; i18n namespace `connections`. Mock: 'Telegram' (paper-plane tile), subtitle `drugi Kanal · long polling`, pill 'sparowany', rows 'Bot' `@overmind_wojtek_bot`, 'Twoje konto' `@wojtek · inni sa ignorowani`, 'Uprawnienia' `czaty, status, Zgody na Run`, buttons 'Nowy kod parowania' and 'Rozlacz' (danger outline). ADR 0006. All logic lives in OVE_SETUI005/006; this card only presents and triggers.

## 3. Scope (in)

- `components/slots/TelegramCard.card.tsx` (order 40), `model/telegram-card-vm.ts`.

## 4. Out of scope

- Connect/pair/unpair dialogs (OVE_SETUI006) and hooks (OVE_SETUI005): consumed, not reimplemented.

## 5. Detailed requirements

1. VM from `useTelegramStatus()` (`lib:use-telegram`): state -> pill (reuse tone mapping of `telegram-state.ts`), rows: Bot `@botUsername`, 'Your account' `@pairedUsername · others are ignored`, 'Permissions' fixed text 'chats, status, Approvals for the current Run'.
2. Actions: `not_configured` -> 'Set up' (opens Settings Telegram section via route builder `settings/telegram` and the connect dialog); `unpaired` -> 'Pair'; `connected` -> 'New pairing code' + 'Disconnect' (danger outline); degraded states -> 'Retry'. Dialogs are `ui:TelegramManageDialogs` from OVE_SETUI006, opened in place.
3. Telegram has no usage/limits: no limit row.
4. Names are untrusted text; ellipsis at 64 chars.
5. Text under rows: 'Telegram cannot grant folders or change settings.' (link 'More in Settings' to the Telegram section).

## 6. Design notes

`design.png`: same chrome as other cards; 'Rozlacz' uses danger outline style (pink-red border).

## 7. Reuse

- `ui:ConnectionCard`, `ui:StatusPill`, `ui:Button`, `lib:use-telegram`, `ui:TelegramManageDialogs`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/connections/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that change who can use Overmind's models or sign an account out (logout/remove a connection) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: pairing/unpairing are desktop-only; this card exists only in the desktop UI. No token appears here (bot name only).

## 10. Errors and edge cases

- Not paired and no bot: card shows 'Not set up' with one action.
- Status unknown: no actions.

## 11. Acceptance criteria

- [ ] Given a paired Telegram, Then the card matches `design.png`.
- [ ] Given Disconnect, Then the unpair dialog of SETUI006 opens (no direct request).
- [ ] Given `not_configured`, Then only 'Set up' is offered.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `telegram-card-vm.test.ts`, card tests per state, visual. Commands: `pnpm --filter @overmind/desktop test features/connections/telegram, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/connections/components/slots/TelegramCard.card.tsx`, `apps/desktop/src/features/connections/model/telegram-card-vm.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram management dialogs live in app-settings and are consumed through its public index (cross-feature capability).
