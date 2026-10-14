---
id: OVE_ARCH015
title: Provide the engine-side Translator for Telegram and notification strings
area: ARCH
kind: infra
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_ARCH006]
soft_depends_on: [OVE_ARCH003]
provides: ["port:Translator", "lib:i18n-engine"]
needs: []
owns: ["packages/application/src/ports/Translator.ts", "packages/adapters/i18n/**"]
reads: ["apps/desktop/src/locales/en/errors.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12"]
adr_refs: [6, 17]
---

# OVE_ARCH015: Provide the engine-side Translator for Telegram and notification strings

## 1. Summary

The engine produces text itself for Telegram messages, macOS notifications and a few system messages. This task adds a `Translator` port with an i18next-core based adapter that reads per-package `locales/<lang>/<ns>.json` files in the same format, plural rules and lint as the UI (ARCH011), so Polish and English stay consistent across channels.

## 2. Context

Telegram (ADR 0006) and notifications are rendered by the engine, not the UI. Errors are localised from `MessageRef` (ARCH003): the UI renders them in the browser, but Telegram needs server-side rendering. The Owner's locale comes from `AppConfig.locale`. Messages sent over Telegram are not end-to-end encrypted, so templates must never include secrets or absolute paths.

## 3. Scope (in)

- Port `Translator`, value types, token.
- `I18nextTranslator` adapter loading JSON namespaces from package folders registered by modules.
- Engine namespaces seed: `errors` (shared with UI keys via copy at build? see requirement 4), `notifications`, `telegram`.
- Integration with `tools/i18n` lint (extend checks to `packages/*/locales`).

## 4. Out of scope

- Telegram message formatting/Markdown escaping: TG area. Notification content decisions: NOTIF. Actual strings: owning areas.

## 5. Detailed requirements

1. **Port:**
   ```ts
   interface Translator {
     t(ref: MessageRef, opts?: { locale?: LocaleCode }): string;     // sync after init; fallback chain locale -> en
     withLocale(locale: LocaleCode): Translator;
     locale(): LocaleCode;
     has(key: string): boolean;
   }
   export const TranslatorToken = token<Translator>('port:Translator');
   ```
   `MessageRef` from `packages/contracts/src/i18n` (ARCH011).
2. **Files:** `packages/<pkg>/locales/<lang>/<namespace>.json` (e.g. `packages/adapters/telegram/locales/pl/telegram.json`, `packages/application/locales/en/notifications.json`). The adapter is constructed with a list of `{ lang, ns, resources }` loaded at composition time (resources are statically imported JSON in each package's `locales.ts`, so no filesystem scanning at runtime and it works in the standalone executable). Registration through a module file per package (`<area>.module.ts` provides a `TranslationBundle` token; the i18n module aggregates all bundles: bundles are plural by `multi-provider` token `TranslationBundlesToken` which the composition supports as an explicit "collect" token type, provided by `multiToken` of ARCH006).
3. **Same format as UI:** i18next JSON v4 plural suffixes, `{{named}}` params, key naming rules of ARCH011. The UI `errors` namespace is the source of truth for error messages; to avoid duplicate maintenance, a build step `tools/i18n/sync-errors.ts` generates `packages/application/locales/<lang>/errors.json` from `apps/desktop/src/locales/<lang>/errors.json` (git-ignored, generated). One definition, two consumers (DRY).
4. **Rendering of errors for Telegram:** `renderError(error: AppError, channel='telegram')` helper uses `resolveUserMessage` (ARCH003) then `Translator.t`; unknown key -> `errors:generic.try_again_on_desktop`.
5. Telegram-specific rules enforced by a helper `assertTelegramSafe(text)`: no absolute paths (`/Users/`, `~/` followed by path longer than 3 segments), no token patterns (ARCH004 redactor), max length 3500 chars (Telegram limit 4096 minus margin); violations are replaced and logged, never sent.
6. Locale resolution: Owner locale from config; Telegram messages use the Owner's locale (single Owner, ADR 0010), not the Telegram client language.
7. Missing key: returns the EN string; if EN missing too returns `[key]` and logs `warn` once per key (lint should prevent this in CI).
8. Lint extension: `pnpm i18n:check` (ARCH011) is extended by this task to scan `packages/**/locales` and `t(` usages on `Translator` (`translator.t({ key: ... })`), with the same rules (PL completeness, plural forms).
9. Performance: translations are in memory; `t` under 20 microseconds.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

ARCH011 conventions, lint and `MessageRef`; ARCH003 `resolveUserMessage`; ARCH004 redaction patterns for `assertTelegramSafe`; ARCH006 module wiring.

## 8. Architecture and code placement

Port `packages/application/src/ports/Translator.ts`; adapter `packages/adapters/i18n/src/{i18next-translator.ts,bundles.ts,telegram-safe.ts}`; JSON resources in the package that owns the strings. i18next is a dependency of `adapters/i18n` only (justification shared with ARCH011).

## 9. Security and safety

Outbound text to Telegram and notifications is an exfiltration channel: params are whitelisted primitives, `assertTelegramSafe` is the last gate, secrets can never be interpolated because `Secret` objects stringify to `[SECRET]`. Agent-provided text (task titles, messages) used as params is length-capped and control characters stripped; it is quoted as data and never interpreted as template (no nested interpolation). Telegram never receives content from Owner-only classes marked `telegramSafe: false`.

## 10. Errors and edge cases

- Locale not loaded: fallback to EN.
- Param missing: i18next leaves `{{x}}`; the adapter replaces with empty string and logs once (in tests it throws to catch bugs).
- Plural count not a number: treated as `other`.
- Very long param: truncated to 500 chars with `…`.
- Concurrent locale change: translator instances are immutable (`withLocale`).

## 11. Acceptance criteria

- [ ] `t` renders EN and PL strings with correct Polish plurals for the same count table as ARCH011.
- [ ] Error messages are rendered from the shared `errors` namespace without a second copy checked into git.
- [ ] `assertTelegramSafe` blocks absolute home paths and token-like strings and truncates at 3500 chars.
- [ ] Missing key falls back to EN and logs once.
- [ ] i18n lint covers engine locale folders.
- [ ] Contract/unit tests run on Linux without filesystem scanning.

## 12. Test plan

- Unit: `i18next-translator.test.ts`, `telegram-safe.test.ts` (corpus from SEC003 when available), `bundles.test.ts`.
- Lint test: fixture package with missing PL key.
- Commands: `pnpm vitest run packages/adapters/i18n`, `pnpm i18n:check`.

## 13. Parallelization notes

Starts after ARCH011 conventions merge. TG and NOTIF authors can use the port with a `FakeTranslator` (TEST002 provides an identity translator returning `[key|params]`).

## 14. Open questions and assumptions

- ASSUMPTION: the standalone engine executable bundles JSON resources via static imports.
- ASSUMPTION: `multiToken` (collect token) from ARCH006 is used for translation bundles; if it is dropped, a single `i18n.module.ts` imports bundles from known packages.
