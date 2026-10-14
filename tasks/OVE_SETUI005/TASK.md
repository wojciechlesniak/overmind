---
id: OVE_SETUI005
title: "Telegram connection hooks: status, connect, pairing code, unpair, rotate and remove"
area: SETUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUI001, OVE_SHELL004, OVE_TG005, OVE_TG012]
soft_depends_on: []
provides: ["lib:use-telegram"]
needs: ["api:telegram.status", "api:telegram.connect", "api:telegram.pairing-code", "api:telegram.unpair", "api:telegram.rotate-token", "lib:api-client-telegram", "event:telegram.channel.status.changed", "lib:error-messages"]
owns: ["apps/desktop/src/features/app-settings/api/telegram.ts", "apps/desktop/src/features/app-settings/api/useTelegramStatus.ts", "apps/desktop/src/features/app-settings/api/useTelegramActions.ts", "apps/desktop/src/features/app-settings/model/telegram-state.ts", "apps/desktop/src/features/app-settings/index.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11"]
adr_refs: [6]
---

# OVE_SETUI005: Telegram connection hooks: status, connect, pairing code, unpair, rotate and remove

## 1. Summary

Implements the single client-side Telegram integration used by both the Settings section and the Connections card: status polling/push, connect bot token, request a pairing code, unpair, rotate token and remove the bot, with a strict state model and no token retention.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. TG routes (desktop-only mutations): `GET /v1/telegram/status` -> `TelegramChannelStatus {state:'not_configured'|'unpaired'|'connecting'|'connected'|'degraded'|'disconnected'|'error'|'locked', botUsername?, pairedUsername?, since, detail?, lastOkAt?}` + `PairingState`; `POST /v1/telegram/connect {token}`; `POST /v1/telegram/pairing-code` -> `PairingCodeView {code, expiresAt, botUsername}` shown once; `DELETE /v1/telegram/pairing`; `POST /v1/telegram/token {token}`; `DELETE /v1/telegram/bot`. Event `telegram.channel.status.changed`.

## 3. Scope (in)

- `api/telegram.ts` (typed calls), `api/useTelegramStatus.ts`, `api/useTelegramActions.ts`, `model/telegram-state.ts` (pure: state -> `{labelKey, tone:'ok'|'warn'|'error'|'idle', primaryAction}`) , barrel export `index.ts` for cross-feature use (capability `lib:use-telegram`).

## 4. Out of scope

- Any UI (OVE_SETUI006, OVE_CONNUI005).

## 5. Detailed requirements

1. `useTelegramStatus()` -> `{status, state, tone, primaryAction, refetch}`; subscribes to `telegram.channel.status.changed`, falls back to polling every 15 s while the window is focused and the state is `connecting`.
2. `primaryAction` table (pure, in `telegram-state.ts`): `not_configured` -> `connect`; `unpaired` -> `pair`; `connecting` -> none; `connected` -> `unpair`; `degraded`/`disconnected` -> `retry` (refetch); `error` with `detail:'token_revoked'` -> `rotate`; `locked` -> `unlock` (explains Keychain locked); unknown state -> none (fail closed).
3. `useTelegramActions()` -> `connect(token)`, `requestPairingCode()`, `unpair()`, `rotateToken(token)`, `removeBot()`; each returns a discriminated result `{ok:true,...}|{ok:false,code}` and invalidates the status query. `connect/rotate` send the token once in the request body over the local transport; the hook NEVER stores the token (no state, no cache, no log, no localStorage); the caller passes it and it is dropped after the call.
4. `requestPairingCode()` returns `{code, expiresAt, botUsername}`; the hook keeps it only in a ref returned to the caller and clears it on expiry or when the dialog closes; query cache never contains it (`gcTime: 0`, `select` excludes it).
5. Token validation client-side (cheap, not authoritative): trimmed, pattern `^\d{6,12}:[A-Za-z0-9_-]{30,}$`; failing shows `telegram.token_invalid` without sending. The engine validates against the Bot API (TG006) and errors map to i18n keys: `tg.token_rejected`, `tg.token_revoked`, `tg.network`, `tg.keychain_locked`, `tg.rate_limited`, `tg.already_configured`.
6. Idempotency: connect/rotate use an Idempotency-Key (ULID) per user attempt; pairing-code requests are not idempotent (each makes a new code and invalidates the previous one: documented).
7. All mutation routes are desktop-only; on `403 perm.local_only` the hook returns `{ok:false, code:'local_only'}` (cannot happen from the UI, but asserted by tests).

## 6. Design notes

N/A, functionality only. Tone mapping to kit: ok -> green dot, warn -> amber, error -> red, idle -> neutral.

## 7. Reuse

- `@overmind/api-client` generated Telegram client (`lib:api-client-telegram`), `useQuery/useMutation` conventions of the app (ARCH010), `lib:error-messages`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components. Exported capability `lib:use-telegram` is consumed by OVE_CONNUI005 through the feature's public `index.ts` only.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific (critical): the bot token is a secret. It lives in the Owner's Keychain after connect (TG); the UI holds it only in the input element until submit, then clears the field and the request object. The token is never put into URLs, query keys, error messages, Sentry-like payloads, or test snapshots. Pairing code is shown once and is single-use with a TTL; it is not logged. Pairing/unpairing/rotating are not possible from Telegram or Agents (engine returns 403 for non-desktop transport).

## 10. Errors and edge cases

- Pasted token with newline/spaces: trimmed.
- Same token already used by another install (409 conflict): `tg.conflict` message.
- Status call fails: state 'unknown' -> actions disabled.
- Two windows: status events keep both in sync.
- Unpair while a Run waits for a Telegram Approval: engine cancels it; UI warns in OVE_SETUI006.

## 11. Acceptance criteria

- [ ] Given state `unpaired`, Then `primaryAction='pair'`.
- [ ] Given an unknown state string, Then no action is offered.
- [ ] Given connect(token), Then the token appears only in the request body; not in cache, logs or errors.
- [ ] Given a pairing code, Then it is cleared from memory on expiry.
- [ ] Given a push event, Then the status updates within one render without polling.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `telegram-state.test.ts` (full table), `useTelegramActions.test.tsx` (results per error code), `no-token-retention.test.ts` (snapshot of cache/logs contains no token), event refresh test. Commands: `pnpm --filter @overmind/desktop test features/app-settings/telegram-api, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/api/telegram.ts`, `apps/desktop/src/features/app-settings/api/useTelegramStatus.ts`, `apps/desktop/src/features/app-settings/api/useTelegramActions.ts`, `apps/desktop/src/features/app-settings/model/telegram-state.ts`, `apps/desktop/src/features/app-settings/index.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: `DELETE /v1/telegram/bot` and `POST /v1/telegram/token` need no Local Approval (TG says desktop-only); PERM031 registry has no Telegram operation. OPEN for the Owner: should removing/rotating the bot require Local Approval? Default: no.
