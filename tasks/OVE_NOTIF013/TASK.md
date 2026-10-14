---
id: OVE_NOTIF013
title: "Write the notification strings in English and Polish"
area: NOTIF
kind: docs
size: S
priority: P1
mvp: true
status: todo
depends_on: ["OVE_NOTIF001", "OVE_ARCH015"]
soft_depends_on: []
provides: ["lib:notification-strings"]
needs: ["port:Translator", "lib:i18n-engine"]
owns: ["packages/application/locales/en/notifications.json", "packages/application/locales/pl/notifications.json", "packages/application/src/notification-strings/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12"]
adr_refs: [17]
---

# OVE_NOTIF013: Write the notification strings in English and Polish

## 1. Summary

All notification texts (center, macOS banner, Telegram) as i18n keys with English default and Polish translation, including Polish plural forms, plus a test that every kind and every rule key has both languages.

## 2. Context

Notifications are rendered by the engine (OVE_NOTIF004) with the Translator (ARCH015). Polish strings in the mocks are the source for the first translation: 'Zgoda: git push', 'Prośba o dostęp: ~/Projects/shared-ui', 'Chief zaczął Dyskusję o płatnościach', 'Czeka na Twój głos', 'Run #13 ukończony', 'Eskalacja: limit pętli'.

## 3. Scope (in)

- Key set per kind (`title`, `body`, `banner.title`, `banner.body`).
- EN and PL files, plural forms, parameters.
- Coverage test.

## 4. Out of scope

- Telegram message templates other than notification bodies: TG.

## 5. Detailed requirements

1. Keys: `notifications:<kind>.title`, `.body`, `.banner.title`, `.banner.body`, plus `notifications:folded` ('{{count}} new notifications' / '{{count}} nowych powiadomień' with Polish plural forms one/few/many/other).
2. PL titles: approval_requested 'Zgoda: {{action}}'; access_requested 'Prośba o dostęp: {{path}}'; discussion_started 'Chief zaczął Dyskusję o {{topic}}' (topic param is a capped label); run_completed 'Run #{{number}} ukończony'; run_failed 'Run #{{number}} zakończył się błędem'; escalation_raised 'Eskalacja: {{reason}}'; provider_fallback 'Limit modelu: przełączono na {{to}}'; channel_attention 'Telegram wymaga uwagi'; backup_failed 'Kopia zapasowa nie powiodła się'; system_attention 'Overmind wymaga uwagi'. EN equivalents written in natural English ('Approval: {{action}}', 'Access request: {{path}}', ...).
3. Bodies are short and contain only parameters from the whitelist; `reasonKey` params are rendered through the `errors:` namespace.
4. The pause boot notification reason key `pause.state_unreadable` ('Pause state could not be read; Overmind started paused' / 'Nie udało się odczytać stanu wstrzymania; Overmind wystartował jako wstrzymany') and `backup` reason keys listed by OVE_BACKUP001 are included.
5. A test enumerates `NOTIFICATION_KINDS` and fails when a key is missing in EN or PL; the i18n lint (`pnpm i18n:check`, ARCH015 extension) passes; golden tests render the five mock titles in PL.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Translator and i18n lint (ARCH011/015), catalogue (OVE_NOTIF001).

## 8. Architecture and code placement

JSON in `packages/application/locales/<lang>/notifications.json` registered as a bundle by `packages/application/src/notification-strings/bundle.ts` (ARCH015 mechanism).

## 9. Security and safety

- Templates contain no free-text interpolation of untrusted content beyond capped parameters; no URLs; no secrets.
- Texts never mention absolute paths.

## 10. Errors and edge cases

- Missing key: EN fallback and a CI failure by the coverage test.
- Plural of 'powiadomienie': 1 powiadomienie, 2-4 powiadomienia, 5+ powiadomień.

## 11. Acceptance criteria

- [ ] Every kind has all four keys in EN and PL.
- [ ] Golden PL titles equal the mock copy.
- [ ] Plural tests for the folded banner pass for 1, 2, 5, 22.
- [ ] `pnpm i18n:check` passes.

## 12. Test plan

Unit: `strings-coverage.test.ts`, `golden-pl.test.ts`, `plural.test.ts`. Command: `pnpm vitest run packages/application/src/notification-strings`.

## 13. Parallelization notes

Parallel with all; only JSON and the bundle file.

## 14. Open questions and assumptions

- Polish wording is a first translation for the Owner's review.
