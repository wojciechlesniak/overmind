---
id: OVE_SETUI013
title: App settings end-to-end, accessibility, visual and security tests
area: SETUI
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUI002, OVE_SETUI003, OVE_SETUI004, OVE_SETUI006, OVE_SETUI007, OVE_SETUI008, OVE_SETUI009, OVE_SETUI010, OVE_SETUI011, OVE_SETUI012, OVE_TEST004, OVE_WSPACE016]
soft_depends_on: []
provides: []
needs: ["lib:ui-test-harness", "lib:ui-security-tests"]
owns: ["apps/desktop/tests/app-settings/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 14"]
adr_refs: [3]
---

# OVE_SETUI013: App settings end-to-end, accessibility, visual and security tests

## 1. Summary

End-to-end, accessibility, visual and abuse-case tests of the whole Settings feature.

## 2. Context

App settings (`Ustawienia`, VIEWS section 12) is a two-column page: left column 'Ogolne' (language, launch at login, work after closing the window) and 'Powiadomienia' (five delivery selects + Telegram switch); right column 'Kopia zapasowa', 'Bezpieczenstwo i logi', the Global Pause panel and a mono version footer. Spec sections 11, 12, 14; ADR 0006 (Telegram second channel, approvals from Telegram only for the current Run), 0003, 0017 (EN project language; UI EN default, PL translation). The page composes `ui:SettingsPage`, `ui:SettingsSection`, `ui:SettingRow` (OVE_DS078/DS080); this feature maps `api:config.*`, `api:notifications.preferences`, `api:backup.*`, `api:telegram.*` and `api:system.*` onto them. Strings: i18n namespace `app-settings` (`locales/<lang>/app-settings.json`); Polish copy in the mock is the first translation, quoted below as 'mock copy'. Proves OVE_SETUI001..012 together.

## 3. Scope (in)

- `apps/desktop/tests/app-settings/*`, mock gateway scenarios.

## 4. Out of scope

- Unit tests.

## 5. Detailed requirements

1. Visual comparison of each section with its `design.png`.
2. Security matrix: backup folder change, export, restore need Local Approval with the right operation and args, carry `localProof` and are refused by the mock engine without it; Telegram transport receives 403 for all of them; no body has `principal`/`channel`/`local`.
3. Secrets: no bot token, pairing code or proof id in storage, console, DOM after flows.
4. Language switch EN/PL live; `en-XA` pseudo-locale without truncation.
5. Accessibility: axe on all states, keyboard run, dialog focus trap.
6. Config races: double toggles, conflicts.

## 6. Design notes

Test code only.

## 7. Reuse

- OVE_TEST004/005/010, Local Approval mock (OVE_WSPACE016).

## 8. Architecture and code placement

Tests under `apps/desktop/tests/app-settings/` only.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Fixtures are synthetic.

## 10. Errors and edge cases

- Fake timers for countdowns.

## 11. Acceptance criteria

- [ ] Security matrix passes; visuals within tolerance; axe zero violations; PL/pseudo-locale pass.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: as listed. Commands: `pnpm --filter @overmind/desktop test:e2e -g app-settings`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/tests/app-settings/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: tolerance of TEST005.
