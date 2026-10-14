---
id: OVE_ONB020
title: "Implement wizard step 4, part 1: optional Telegram bot token connection and skip"
area: ONB
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DS013, OVE_DS026, OVE_DS040, OVE_ONB011, OVE_TG012]
soft_depends_on: []
provides: ["ui:TelegramStep", "lib:onboarding-telegram-slot"]
needs: ["api:telegram.connect", "api:telegram.status", "lib:api-client-telegram", "ui:TextField", "ui:InfoNote", "ui:Button", "lib:use-wizard-step", "lib:use-gateway-mutation"]
owns: ["apps/desktop/src/features/onboarding/steps/telegram/index.ts", "apps/desktop/src/features/onboarding/steps/telegram/TelegramStep.tsx", "apps/desktop/src/features/onboarding/steps/telegram/TokenForm.tsx", "apps/desktop/src/features/onboarding/steps/telegram/use-telegram-step.ts", "apps/desktop/src/features/onboarding/steps/telegram/pairing-slot.ts", "apps/desktop/src/locales/en/onboarding-telegram.json", "apps/desktop/src/locales/pl/onboarding-telegram.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [6, 10]
---

# OVE_ONB020: Implement wizard step 4, part 1: optional Telegram bot token connection and skip

## 1. Summary

Implements the first half of the optional Telegram step (no mock): explanation, a masked field for the BotFather token, validation and storage through the engine, display of the connected bot's username, the 'Pomiń na razie' choice and the step's footer rules. Pairing is ONB021.

## 2. Context

Telegram is the second channel to the same Chief (ADR 0006, MVP: chats, status and Approvals for a Run). One bot, one Owner, paired by a one-time code created on the desktop. The bot token is a secret: the engine validates it with Telegram, stores it in the Keychain (TG012) and never returns it. The wizard marks the step 'opcjonalnie' in the sidebar; the Owner may skip. Telegram messages are not end-to-end encrypted, so the step must say that no secrets travel through the bot.

## 3. Scope (in)

- Step definition `steps/telegram/index.ts` and `TelegramStep.tsx` (hosts parts 1 and 2: this task renders the token part and the container; ONB021 renders the pairing part through a slot).
- Token form: masked field, 'Połącz bota', inline validation (format hint, engine errors).
- Calls `telegram.connect({ token })` (TG012) and reads `telegram.status`.
- Skip action 'Pomiń na razie' and its progress/footer behaviour (records `telegram: 'skipped'` via the engine; see requirement 7).
- `locales/{en,pl}/onboarding-telegram.json` (shared with ONB021 by catalogue: this task authors all keys).
- Stories and tests.

## 4. Out of scope

- Pairing code flow (ONB021).
- Settings screens for rotating or removing the bot (SETUI/TG area).
- Creating the bot (the Owner does that in Telegram with BotFather; text instructions only).

## 5. Detailed requirements

1. **Copy (PL proposed; EN equivalents).** Title 'Połącz Telegrama (opcjonalnie)'. Lead 'Z Telegrama możesz pytać Chiefa o postęp, pisać do Agentów i zatwierdzać Zgody na bieżący Run. Stałych uprawnień przez Telegram nadać się nie da.' Steps list: '1. Otwórz w Telegramie rozmowę z @BotFather i utwórz bota (/newbot).' '2. Skopiuj token, który dostaniesz, i wklej go poniżej.' Field label 'Token bota', helper 'Token trafia do Klucza macOS (Keychain). Overmind nigdy go nie pokazuje.' Warning (info tone): 'Rozmowy z botem nie są szyfrowane end-to-end. Nie wysyłaj tam haseł ani kluczy.' Buttons 'Połącz bota' and 'Pomiń na razie'.
2. **Token field.** `type="password"`-style masking with a 'Pokaż' toggle that reveals for 10 seconds at most (Owner action), `autoComplete="off"`, `spellCheck=false`, `data-sensitive`; uncontrolled input read on submit; trimmed; client-side format hint only (`^\d{5,}:[A-Za-z0-9_-]{30,}$` - a hint, not a gate: wrong format shows a gentle 'To nie wygląda jak token BotFathera.' but the engine decides).
3. **Connect.** 'Połącz bota' calls `telegram.connect({ token })` with an idempotency key; the body is redacted in logs; on success the field is cleared and unmounted, the UI shows the bot username from the response (`@moj_bot`, plain text) and the status via `telegram.status`; errors: `telegram.token_invalid` -> 'Telegram odrzucił ten token.'; network -> retry text; `telegram.rate_limited` -> wait text. The token never appears in React state beyond the submit handler, in storage, logs or error messages.
4. **State machine of the step.** `not_configured` (form) -> `bot_connected` (shows username and the pairing part from ONB021) -> `paired` (done) ; `skipped` is a terminal choice recorded in the engine. If the engine already has a bot configured (resume or re-entry) the form is skipped and `bot_connected`/`paired` state shows.
5. **Next/skip rules.** Footer 'Dalej' label changes by state: form with nothing entered: Next is disabled with hint 'Wklej token albo pomiń ten krok.'; 'Pomiń na razie' is a secondary button in the content (not the footer Back); after a bot is connected but not paired, Next is enabled with the hint 'Możesz sparować Telegrama później w Ustawieniach.' (the bot stays configured, pairing pending); after pairing, Next -> completion (ONB022). Back returns to step 3.
6. **Skip.** 'Pomiń na razie' calls the completion request with `telegram: 'skipped'` through ONB022's flow (no separate route): it registers the decision when completing (ONB007 body field). Until ONB022 runs, skipping only advances the UI (nothing is persisted).
7. **Principal.** All calls come from the desktop session; Telegram principals cannot connect bots.
8. **Privacy statement.** Always visible near the field (info `ui:InfoNote`): the e2e encryption warning above.
9. **No webhook, no public URL.** Text must not suggest exposing the machine (long polling only, SPEC 5).
10. **Accessibility.** Instructions are an ordered list; the reveal toggle is a button with `aria-pressed`; errors are announced (`role="alert"`).
11. **i18n catalogue** covers both parts: `title`, `lead`, `instructions.1/2`, `token.label/helper/show/hide/formatHint`, `connect`, `skip`, `connected` 'Połączono z @{{bot}}', `errors.token_invalid/rate_limited/network`, `warning.e2e`, `hint.pasteOrSkip`, `hint.pairLater`, and the pairing keys for ONB021 (`pair.title`, `pair.instruction`, `pair.code.label`, `pair.expires`, `pair.regenerate`, `pair.copy`, `pair.waiting`, `pair.success`, `pair.locked`, `pair.expired`, `pair.openTelegram`).
12. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

No mock exists for this part (design: none). It is composed only from existing ui-kit components and the wizard layout (`ui:WizardLayout` content area, `ui:Card`, `ui:Button`, `ui:InfoNote`, `ui:Dialog`) with product tokens; no new visual styles. DESIGN GAP recorded in section 14.

## 7. Reuse

- `ui:TextField` (password variant), `ui:InfoNote`, `ui:Button`, `useGatewayMutation`, `api-client-telegram` (TG012: `connect`, `status`), `useWizardStep` (ONB011).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/telegram/{index.ts,TelegramStep.tsx,TokenForm.tsx,use-telegram-step.ts,pairing-slot.ts}` and `apps/desktop/src/locales/{en,pl}/onboarding-telegram.json`. UI layer. `pairing-slot.ts` lets ONB021 register its component without editing this task's files.

## 9. Security and safety

- Bot token handling: masked, uncontrolled, never stored client-side, never logged, cleared after submit; transmitted once over the owner bridge; the engine stores it in the Keychain (TG012) and returns only the bot username.
- Telegram principal or agent cannot connect bots (engine rule).
- Users are warned about the lack of E2E encryption; no secrets via Telegram (ADR 0006).
- The reveal toggle is time-limited.

## 10. Errors and edge cases

- Token for a bot already configured: engine replaces or refuses per TG012 (rotate rules); the UI shows the engine's message.
- Telegram unreachable (offline): retry text; the Owner can skip.
- Paste with surrounding whitespace or newline: trimmed.
- User closes the app after connecting but before pairing: resume shows `bot_connected` with the pairing part.
- Rate limit from Telegram: waiting text with retry after.
- Clipboard managers keep the token: out of scope; noted in security notes.

## 11. Acceptance criteria

- [ ] Given a valid token then `telegram.connect` is called once, the bot username appears and the field disappears.
- [ ] Given an invalid token then the Telegram rejection text appears and nothing is stored.
- [ ] Given 'Pomiń na razie' then the step advances to completion with telegram skipped.
- [ ] Given the step re-entered with a configured bot then the form is not shown.
- [ ] Given a sentinel token then it is absent from logs, DOM after submit and storage.

## 12. Test plan

- Vitest + Testing Library with fake client: flows and the sentinel test; Storybook stories; axe.
- Playwright with the fake Telegram API (TEST012) scenario `telegram-connect`.
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/telegram`.

## 13. Parallelization notes

After ONB011 and TG012. Parallel with ONB019. ONB021 plugs in through the slot.

## 14. Open questions and assumptions

- DESIGN GAP: no mock; copy and layout derived.
- OPEN: whether the 'Pokaż' reveal is wanted at all (shoulder surfing); default keep with 10 s limit.
- OPEN: the TG area may already own onboarding-like Telegram setup UI in Settings (SETUI); this step should reuse its components if they exist (consolidate in review).
