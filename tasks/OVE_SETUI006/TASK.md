---
id: OVE_SETUI006
title: "Telegram section: connect bot, pairing code dialog, unpair and remove"
area: SETUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS018, OVE_DS026, OVE_DS036, OVE_DS040, OVE_DS078, OVE_SETUI001, OVE_SETUI005]
soft_depends_on: []
provides: ["ui:TelegramManageDialogs"]
needs: ["ui:SettingsSection", "ui:SettingRow", "ui:StatusPill", "ui:Dialog", "ui:ConfirmDialog", "ui:TextField", "ui:InfoNote", "ui:Button", "lib:use-telegram"]
owns: ["apps/desktop/src/features/app-settings/components/sections/Telegram.section.tsx", "apps/desktop/src/features/app-settings/components/telegram/**"]
reads: []
design: design.png
design_source: "Polaczenia#connections/telegram-card (crop 591,531,513,267 CSS px, tall render): visual reference only"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12"]
adr_refs: [6, 3]
---

# OVE_SETUI006: Telegram section: connect bot, pairing code dialog, unpair and remove

## 1. Summary

Implements the Telegram card in Settings: connection state, connect-bot dialog (token field), pairing dialog with one-time code and countdown, unpair and remove-bot confirmations, rotate token, and the explanation of what Telegram can and cannot do.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. The mock draws Telegram only as a card on the Connections page (`Polaczenia`, design crop attached: 'Telegram' title, status pill 'polaczony', '@overmind_bot', 'sparowany z @wojtek' style details and a Rozlacz button). The Settings page has a Telegram switch in the notifications card (OVE_SETUI003) but no Telegram section: this section is DERIVED from the Connections card so that pairing/unpair flows have one home in Settings, while OVE_CONNUI005 shows the compact card and deep-links here for management. Hooks: OVE_SETUI005. ADR 0006: Telegram is a second channel for status and Approvals during the current Run; it never widens permissions (spec criterion 10).

## 3. Scope (in)

- `components/sections/Telegram.section.tsx` (id `telegram`, left, order 30).
- `components/telegram/TelegramStatusRow.tsx`, `ConnectBotDialog.tsx`, `PairingDialog.tsx`, `UnpairDialog.tsx`, `RemoveBotDialog.tsx`, `TelegramCapabilityNote.tsx`.
- i18n keys `telegram.*`.

## 4. Out of scope

- Hooks (OVE_SETUI005); the Connections card (OVE_CONNUI005); the notification switch (OVE_SETUI003).

## 5. Detailed requirements

1. Status row: `ui:StatusPill` (tone from `telegram-state.ts`) + text per state: 'Not set up', 'Bot connected, not paired', 'Connecting...', 'Connected', 'Reconnecting', 'Offline', 'Token revoked', 'Keychain locked'; bot and paired user names as mono text (`@name`, untrusted: text node, max 64 chars, ellipsis). `since`/`lastOkAt` as relative time.
2. Primary action button from `primaryAction`: `Connect bot`, `Pair`, `Unpair`, `Retry`, `Replace token`, `Unlock Keychain`(help only). Secondary menu: 'Replace token', 'Remove bot' (when configured).
3. ConnectBotDialog (3 short steps in one dialog): (1) instructions 'Open @BotFather in Telegram, send /newbot, copy the token.' with copyable text `/newbot`; (2) `ui:TextField` type=password 'Bot token' with paste support, autocomplete off, show/hide eye, client validation of OVE_SETUI005; (3) result. Submit calls `connect(token)`; the field is cleared on success, error or close.
4. PairingDialog: button 'Get pairing code' -> shows the code in large mono (e.g. `K7P-29X`), a 5-minute countdown from `expiresAt`, instructions 'Send this code to @bot in Telegram, from the account that should control Overmind.', a copy button, and live status; when status turns `connected` with a `pairedUsername` the dialog shows success 'Paired with @name' and closes after 1.5 s. Expired code -> 'Code expired' + 'New code'. Code only in memory; closing the dialog discards it.
5. UnpairDialog (`ui:ConfirmDialog`): 'Unpair @name? Telegram stops receiving status and can no longer answer Approvals. A pending Approval waiting on Telegram is cancelled.' Confirm calls `unpair()`.
6. RemoveBotDialog: 'Remove bot? The token is deleted from the Keychain and Telegram is disconnected.' with typed word 'remove' not required (reversible by reconnecting) but destructive styling.
7. Capability note (`ui:InfoNote`): 'Telegram can show status, answer Approvals for the current Run and pause work. It cannot grant folders, lift consent rules, change isolation, delete Workspaces or change settings: those need Overmind on this Mac.' (spec criterion 10; keeps expectations clear).
8. Locked Keychain: state `locked` shows 'Keychain is locked. Unlock your Mac keychain and retry.' and the action Retry.
9. Everything is disabled with a visible reason 'Telegram is managed on this Mac only' if the transport reports not-local (should never occur in the desktop app).

## 6. Design notes

`design.png` is the Telegram card of the Connections mock (visual reference for tone and bot/user text); the dialogs and the Settings placement are derived from `ui:Dialog`, `ui:ConfirmDialog` and the section style of the Settings mock. Not in the mock: all dialogs.

## 7. Reuse

- `ui:SettingsSection`, `ui:SettingRow`, `ui:StatusPill`, `ui:Dialog`, `ui:ConfirmDialog`, `ui:TextField`, `ui:InfoNote`, `ui:Button`, `useTelegramStatus`, `useTelegramActions` (OVE_SETUI005).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific (critical): the token field is `type=password`, `autocomplete=off`, `spellcheck=false`, not persisted, and is cleared in all exits; screenshots/visual tests use fake tokens. The pairing code is displayed only to the Owner on this desktop and never copied to the clipboard automatically; copy is an explicit button. Pairing proves possession of the code, then the engine binds the Telegram numeric user id (TG); the UI displays only the username. Bot and user names come from Telegram: treat as untrusted text (no links, no mentions rendered as links). No Telegram-originated action can reach these dialogs (they are not reachable by any route Telegram can call).

## 10. Errors and edge cases

- Wrong token: `tg.token_rejected` inline; dialog stays open, field cleared.
- Network down during connect: retry button, token must be re-entered (not retained).
- Pairing from a second account: engine refuses (`tg.already_paired`): shown.
- Code guessed by someone else: engine rate-limits and blocks (TG); UI shows 'Too many attempts, new code needed'.
- Window closed during pairing: code discarded; next open requests a new one.
- Bot username with unusual unicode: ellipsised, bidi isolated.

## 11. Acceptance criteria

- [ ] Given `not_configured`, Then 'Connect bot' opens the dialog and a valid token leads to `unpaired` state.
- [ ] Given the pairing dialog, Then the code is shown with a countdown and is not in the DOM after close.
- [ ] Given pairing completes, Then the dialog shows the paired user and the status becomes connected.
- [ ] Given Unpair confirmed, Then `DELETE /v1/telegram/pairing` is sent once.
- [ ] Given any state, Then no token or code appears in logs, storage or snapshots.
- [ ] Given the capability note, Then it lists what Telegram cannot do.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `Telegram.section.test.tsx` (every state), `ConnectBotDialog.test.tsx` (clear-on-exit), `PairingDialog.test.tsx` (countdown with fake timers, expiry, success), `UnpairDialog.test.tsx`, `telegram.security.test.ts` (no secrets retained), Playwright `telegram-pairing.e2e.ts` on the mock gateway. Commands: `pnpm --filter @overmind/desktop test features/app-settings/telegram, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/sections/Telegram.section.tsx`, `apps/desktop/src/features/app-settings/components/telegram/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Own key prefix `telegram.*`. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: the Telegram section is derived (not in the Settings mock); the Owner may prefer to keep it only in Connections: then this task is reduced to dialogs reused by OVE_CONNUI005.
- DESIGN GAP: no mock of the pairing dialog.
