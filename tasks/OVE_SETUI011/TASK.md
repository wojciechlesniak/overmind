---
id: OVE_SETUI011
title: Diagnostics and support bundle with review before saving
area: SETUI
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS018, OVE_DS024, OVE_DS036, OVE_DS051, OVE_DS074, OVE_DS078, OVE_ENGINE006, OVE_ENGINE025, OVE_SETUI001]
soft_depends_on: []
provides: []
needs: ["ui:SettingRow", "ui:Dialog", "ui:Checkbox", "ui:KeyValueList", "ui:StatusPill", "ui:FolderPicker", "ui:Button", "api:system.diagnostics", "api:system.support_bundle", "api:system.health"]
owns: ["apps/desktop/src/features/app-settings/components/sections/Diagnostics.section.tsx", "apps/desktop/src/features/app-settings/components/diagnostics/**", "apps/desktop/src/features/app-settings/api/useDiagnostics.ts", "apps/desktop/src/features/app-settings/model/diagnostics-view.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14"]
adr_refs: [13]
---

# OVE_SETUI011: Diagnostics and support bundle with review before saving

## 1. Summary

Adds a Diagnostics block: engine health summary and a 'Create support bundle' flow that writes a redacted zip to a folder chosen by the Owner, after showing what it contains.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. ENGINE025: `GET /v1/system/diagnostics` (redacted snapshot: versions, health checks, config without secrets, last errors) and `POST /v1/system/support-bundle {destination, includeLogs}` (owner, local-only) writing `overmind-support-<date>.zip` with `manifest.json` (file list + sha256 + redaction rules version), `diagnostics.json` and optionally the last 5 MiB of engine logs, all redacted. The mock has no diagnostics UI (derived).

## 3. Scope (in)

- `components/sections/Diagnostics.section.tsx` (id `diagnostics`, right, order 25).
- `components/diagnostics/SupportBundleDialog.tsx`, `DiagnosticsSummary.tsx`.
- `api/useDiagnostics.ts`; `model/diagnostics-view.ts`.

## 4. Out of scope

- Uploading bundles anywhere (never automatic), crash reporting.

## 5. Detailed requirements

1. Row 'Diagnostics' with value 'All checks passed' or '<n> problems' from `system.health.checks` (ok/warn/error counts) and a button 'Details' opening a dialog listing checks (name, status, short detail text) from `GET /system/diagnostics`.
2. Button 'Create support bundle...' opens `SupportBundleDialog`: lists what is included ('Versions and system info', 'Health checks', 'Settings without secrets', optional 'Last 5 MB of logs') with a checkbox for logs (default off), the statement 'Secrets, tokens, file contents and Decisions are never included. Paths and names are redacted.' and 'Choose location...' (native save dialog via `ui:FolderPicker`).
3. On confirm call `POST /system/support-bundle` with destination handle and `includeLogs`; progress state; success shows the file name and a 'Show in Finder' button (bridge `revealInFinder(handle)`), failure shows `error.code` text.
4. After success the dialog shows the manifest's file list (name and size) returned by the engine so the Owner can review before sending it anywhere; text 'Review the file before sharing it.'.
5. The dialog never auto-opens mail or uploads.

## 6. Design notes

Derived from `ui:Dialog`, `ui:KeyValueList`, `ui:StatusPill`; no mock.

## 7. Reuse

- `ui:SettingRow`, `ui:Dialog`, `ui:Checkbox`, `ui:KeyValueList`, `ui:StatusPill`, `ui:FolderPicker`, `ui:Button`.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/app-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule: a setting is shown as changed only after the engine confirms it (optimistic UI is allowed only for pure display preferences and must roll back on error). Actions that widen access, move data out of the app or replace data (backup folder change, export, restore, Telegram pairing) are desktop-only and go through Local Approval where the engine requires it (PERM009); the UI never offers them to Telegram and never sends `channel`/`local`. Specific: the bundle is the one place diagnostics leave the app, so the Owner must see what it contains and choose the destination (native handle, local-only route, ENGINE025). Redaction happens in the engine; the UI additionally displays all engine text as plain text. No logs are included by default. No automatic upload.

## 10. Errors and edge cases

- Destination not writable: `folder_not_writable`.
- Large logs: progress up to 30 s then timeout message.
- Diagnostics call fails: row shows '-' and retry; bundle button stays available (engine may still produce a partial bundle: shown as warning).

## 11. Acceptance criteria

- [ ] Given the dialog, Then logs are unchecked by default and the exclusions text is visible.
- [ ] Given confirm, Then the request has the destination handle and `includeLogs`.
- [ ] Given success, Then the manifest file list is displayed.
- [ ] Given failure, Then the error is shown and no file claim is made.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `diagnostics-view.test.ts`, `SupportBundleDialog.test.tsx`, Playwright bundle flow on the mock gateway. Commands: `pnpm --filter @overmind/desktop test features/app-settings/diagnostics, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/app-settings/components/sections/Diagnostics.section.tsx`, `apps/desktop/src/features/app-settings/components/diagnostics/**`, `apps/desktop/src/features/app-settings/api/useDiagnostics.ts`, `apps/desktop/src/features/app-settings/model/diagnostics-view.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Own key prefix `diagnostics.*`. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- OPEN: should creating a bundle with logs need Local Approval? Default: no (redacted, Owner chooses destination, local-only route).
- GAP: manifest file list in the response is assumed.
