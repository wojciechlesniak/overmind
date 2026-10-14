---
id: OVE_ONB021
title: "Implement wizard step 4, part 2: Telegram pairing code, status and expiry"
area: ONB
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS031, OVE_DS040, OVE_ONB020, OVE_SHELL003, OVE_SHELL006, OVE_TG003, OVE_TG012]
soft_depends_on: []
provides: ["ui:PairingPanel"]
needs: ["api:telegram.pairing-code", "api:telegram.status", "lib:api-client-telegram", "usecase:GetPairingState", "ui:Card", "ui:Button", "ui:InfoNote", "lib:use-platform", "lib:event-hub"]
owns: ["apps/desktop/src/features/onboarding/steps/telegram/pairing/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [6, 10]
---

# OVE_ONB021: Implement wizard step 4, part 2: Telegram pairing code, status and expiry

## 1. Summary

Implements the pairing half of the optional Telegram step (no mock): create a one-time code on the desktop, show it with clear instructions and a deep link, count down its expiry, follow the pairing status live, regenerate, and handle success, lockout and expiry.

## 2. Context

ADR 0006 and TG003: one bot, one Owner; pairing by a one-time code created on the desktop (never remote). The code is 10 characters shown as `XXXXX-XXXXX`, valid 10 minutes, single use; five wrong attempts lock pairing for 15 minutes; an existing pairing blocks creating a code until unpaired. The code is returned once by the engine (never by status). The UI shows it, the Owner sends it to the bot, and the engine confirms the pairing and publishes `telegram.channel.status.changed` / `telegram.pairing.changed`.

## 3. Scope (in)

- `PairingPanel` registered into the `pairing-slot` (ONB020) and `use-pairing.ts`.
- Actions: 'Utwórz kod' (calls `telegram.pairing-code`), 'Nowy kod', copy code, 'Otwórz Telegram' (deep link `https://t.me/<bot>?start=<code>` via `openExternal`).
- Live status from `telegram.status` and events; countdown to `expiresAt`.
- States: no code, code active, waiting for the message, paired (success), expired, locked out, already paired.
- `pair.*` copy lives in `onboarding-telegram.json` (authored by ONB020's catalogue; this task only uses the keys).

## 4. Out of scope

- Bot connection (ONB020).
- Unpairing and settings (SETUI/TG).
- Telegram-side message handling (TG area).

## 5. Detailed requirements

1. **Preconditions.** The panel renders only when `telegram.status` says a bot is connected and not yet paired; if already paired it shows the success state immediately.
2. **Create code.** 'Utwórz kod' -> `POST /v1/telegram/pairing-code` -> `PairingCodeView { code, expiresAt, deepLink? }` kept in memory only (never storage or logs); display as `XXXXX-XXXXX` in a large mono block (DS `KeyValue` or `ui:Card` with mono 24/700, letter-spacing) with a copy button ('Kopiuj kod', Owner action, `usePlatform().clipboard`), instructions 'Wyślij ten kod do swojego bota w Telegramie.' and a primary button 'Otwórz Telegram' that opens the deep link if the engine returned one (https, host `t.me`; allowlisted exactly in SHELL003 as a proposal) else the instruction text only. The panel also shows 'Kod jest ważny {{minutes}} min i działa tylko raz.' with a live countdown (`mm:ss`, not announced each second; announced at 1 minute and 0).
3. **Waiting.** After creation the status line says 'Czekam na wiadomość od Ciebie…' with a spinner; events `telegram.pairing.changed` or `telegram.channel.status.changed` end the wait; a fallback poll of `telegram.status` every 3 s while visible and the hub is disconnected.
4. **Success.** Paired: show 'Sparowano z Telegramem ({{displayName?}})' — only data the engine returns (display name or username, plain text); the code is dropped from memory; Next becomes the primary action 'Dalej'. A short reassurance 'Z Telegrama możesz zatwierdzać Zgody tylko na bieżący Run.' (`pair.scopeNote`).
5. **Expired.** At `expiresAt` the code block is replaced by 'Kod wygasł' and the button 'Utwórz nowy kod'; creating a new code replaces the old one server-side (TG003).
6. **Locked out.** Engine error `telegram.pairing_locked` (global lockout after 5 wrong attempts for 15 minutes): show 'Zbyt wiele błędnych prób. Spróbuj za {{minutes}} min.' with a countdown to `lockedUntil` (from status) and no create button until then. The wizard does not reveal who tried.
7. **Already paired.** `telegram.already_paired`: show the success state (do not offer to replace here; unpairing is in Settings).
8. **Security display rules.** The code is shown only on the desktop (never copied automatically, never sent through Overmind to other channels); it is visible while the panel is mounted and hidden when the window loses focus for more than 60 s? NO: the code stays visible (the Owner must switch to Telegram on the phone); it is cleared on unmount, on success, on expiry and on step change.
9. **Principal.** Creation requires the desktop principal (engine rule); the UI does nothing special.
10. **Accessibility.** The code block is a `<output>`/`role="status"` region with `aria-label` 'Kod parowania'; characters are separated for screen readers by a visually hidden spaced version; copy feedback announced; countdown has `role="timer"` with `aria-live="off"`.
11. **Telemetry/storage.** None.
12. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

No mock exists for this part (design: none). It is composed only from existing ui-kit components and the wizard layout (`ui:WizardLayout` content area, `ui:Card`, `ui:Button`, `ui:InfoNote`, `ui:Dialog`) with product tokens; no new visual styles. DESIGN GAP recorded in section 14.

## 7. Reuse

- `ui:Card`, `ui:Button`, `ui:InfoNote`, `usePlatform().clipboard` and `openExternal` (SHELL003), `api-client-telegram` (`pairingCode`, `status`, TG012), event hub (SHELL006), `useWizardStep` (ONB011).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/telegram/pairing/{PairingPanel.tsx,use-pairing.ts,format-code.ts,register.ts}`. UI layer; registers through `pairing-slot.ts` (ONB020).

## 9. Security and safety

- The one-time code is a secret for the pairing window: held in memory only, never stored, logged or sent anywhere; cleared on unmount/success/expiry.
- Local-only: the code can be created only by the desktop Owner session (TG003), and confirmed only from a private chat (TG003); the UI cannot weaken this.
- The deep link host is allowlisted (`t.me`), https only; nothing else is opened.
- Lockout is installation-wide: the UI shows it without detail about attempts.
- No information is revealed about other Telegram users.

## 10. Errors and edge cases

- Engine restart while the code is active: the code remains valid server-side; the UI cannot re-display it (never returned again): the panel offers 'Utwórz nowy kod'.
- Window closed and reopened: same as above.
- Clock skew: countdown uses `expiresAt - serverNow` computed from the response `generatedAt` if provided, else local clock.
- Telegram bot token rotated while waiting: the status event changes to `unpaired`; the panel resets.
- Copy blocked by the platform: select-all fallback.
- Multiple quick creations: each replaces the previous; the UI shows only the last.

## 11. Acceptance criteria

- [ ] Given a connected unpaired bot then 'Utwórz kod' shows a code `XXXXX-XXXXX`, the expiry countdown and the instructions.
- [ ] Given a pairing event then the success state shows and the code disappears from the DOM.
- [ ] Given 10 minutes passing then the expired state shows with a button to create a new code.
- [ ] Given `telegram.pairing_locked` then the lockout message with a countdown shows and no create button.
- [ ] Given unmount then the code is no longer in memory (test via component state inspection) and absent from storage and logs.

## 12. Test plan

- Vitest + Testing Library with fake client, fake timers and `FakeEventSource`: all states; sentinel-code test for logs/storage.
- Playwright with the fake Telegram API scenario `telegram-pairing` (TEST012).
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/telegram/pairing`.

## 13. Parallelization notes

After ONB020 and TG003/012. Parallel with ONB019/022.

## 14. Open questions and assumptions

- DESIGN GAP: no mock; layout derived.
- OPEN: `PairingCodeView.deepLink` is an assumption; if missing, only the instruction text is shown.
- OPEN (cross-area): SHELL003 `openExternal` allowlist must include the exact `https://t.me/` pattern (proposal).
