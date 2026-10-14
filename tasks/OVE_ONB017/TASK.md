---
id: OVE_ONB017
title: "Implement the embedded login terminal: start, stream, input, link opening, success"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS026, OVE_DS052, OVE_ONB010, OVE_ONB014, OVE_ONB015, OVE_SHELL003]
soft_depends_on: []
provides: ["ui:LoginTerminalPanel", "lib:use-login-terminal"]
needs: ["api:onboarding.login.start", "api:onboarding.login.input", "api:onboarding.login.stream", "api:onboarding.login.cancel", "ui:TerminalPane", "lib:sanitizeTerminalText", "ui:TextField", "ui:Button", "lib:use-platform", "lib:external-url-classifier"]
owns: ["apps/desktop/src/features/onboarding/steps/connections/login/**"]
reads: []
design: design.png
design_source: "Kreator-Polaczenia#onb2/terminal-panel (crop 416,628,968,204); open-link button = onb2/open-link-button"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [4, 22]
---

# OVE_ONB017: Implement the embedded login terminal: start, stream, input, link opening, success

## 1. Summary

Implements the wizard's embedded CLI login: the 'Zaloguj' action on the Claude Code and Codex rows, the live terminal panel (`ui:TerminalPane` login mode) fed by the dedicated stream, the Owner's input path (type or paste directly into the CLI), the 'Otwórz link w przeglądarce' button using the classified URL, success detection and cancel, following SEC009.

## 2. Context

The mock's panel 'TERMINAL · CODEX CLI W KONTENERZE' shows the CLI's own login output with a link and the waiting caret. The login code is entered by the Owner into the terminal, never through Overmind logic (SEC009 L1): the UI forwards keystrokes and pasted text to the pane without reading, storing or logging them; the engine streams output without logging (ONB008/010). DS052's `TerminalPane` is a display component (role log, no input), so this task adds a small input row for typing and pasting, flagged as a DS gap.

## 3. Scope (in)

- `LoginTerminalPanel` component and `useLoginTerminal(providerId)` hook.
- Row action 'Zaloguj' for claude/codex rows (via ONB015's `onLogin` context), only one terminal at a time.
- Byte stream handling: `openLoginStream` (ONB010) -> UTF-8 decoder -> `sanitizeTerminalText` (DS052) -> line buffer (max 500 lines) -> `TerminalPane` lines.
- Input row `LoginInputRow`: masked single-line field plus 'Wyślij', buttons 'Enter', 'Ctrl+C' and 'Anuluj logowanie'.
- Link button: `onOpenLink(url)` -> `desktopShell.openExternal(url)` (classifier in SHELL003).
- States: preparing, awaiting_browser, awaiting_code, verifying, logged_in, failed, expired, lost.
- Success handling: row flips to ready by the checks events; the panel shows 'Zalogowano' for 2 s and collapses.

## 4. Out of scope

- The backend session (ONB008/010).
- Callback port-forward choice for Codex (an explicit Owner option, proposed as an advanced link 'Logowanie przez przekierowanie' shown only when the profile declares it; behaviour in ONB008; UI minimal: a checkbox before start).
- Row/status mapping (ONB015).

## 5. Detailed requirements

1. **Start.** 'Zaloguj' on a CLI row calls `onboarding.login.start({ providerId, callbackForward })`; while preparing the pane shows the muted line 'Przygotowuję środowisko…' with caret. Errors: `onboarding.login_busy` ('Logowanie już trwa.'), `provider.not_installed`, isolation unavailable -> messages from `onboarding-checks.json`/`onboarding-setup.json`.
2. **Panel header.** `terminal.title` 'TERMINAL · {{cli}} W KONTENERZE' with the CLI display name ('CODEX CLI', 'CLAUDE CODE'); the magenta button 'Otwórz link w przeglądarce' is disabled until the session reports a classified `loginUrl`. If the engine reports `urlRejected`, show `terminal.urlRejected` text under the header and keep the button disabled (SEC009 L3).
3. **Stream.** `useLoginTerminal` subscribes to the dedicated stream through the api-client; bytes are decoded with a streaming `TextDecoder`, sanitised by the DS pure function (ANSI/OSC removal, CR handling, bidi marks), split into lines, capped to 500 lines. The stream payload is never copied into React Query cache, never stored in `localStorage`, never sent to logging (a lint rule `no-terminal-logging` forbids passing these values to `console.*`/logger in this folder).
4. **TUI limitation.** The pane renders line-oriented output; full-screen TUI redraws are not supported. The CLI profiles must therefore launch a line-oriented login command (PROV010/011 `login` launch spec, e.g. `claude auth login`, `codex login`); the UI shows whatever lines arrive. ASSUMPTION recorded.
5. **Input.** The input row field has `type="password"`-style masking (`autoComplete="off"`, `spellCheck=false`, `autoCapitalize="off"`, `data-sensitive`), is uncontrolled (ref), and is cleared immediately after sending. Pasting is allowed. 'Wyślij' (or Enter) sends the text plus `\n` through `onboarding.login.input({ data })`; 'Enter' button sends `\n` alone; 'Ctrl+C' sends `\u0003`. The UI never displays or stores what was sent. Keyboard focus inside the pane region (role log, scrollable) does not capture keystrokes; typing happens only in the input row.
6. **Open link.** Click -> `desktopShell.openExternal(loginUrl)`; the platform classifier re-checks https + allowlisted host (SHELL003 `external-url-classifier`); a rejection shows a toast 'Nie można otworzyć tego linku.'. The link is never opened automatically.
7. **Facts and state.** `facts` events update the state: `awaiting_browser` (muted hint 'Otwórz link i zaloguj się w przeglądarce'), `awaiting_code` (hint 'Wklej kod z przeglądarki do pola poniżej'), `verifying` (hint 'Sprawdzam logowanie…'), `logged_in`, `failed`, `expired` (TTL 10 min: 'Logowanie wygasło. Spróbuj ponownie.'). The footer hint of the step stays the default.
8. **Success.** On `logged_in` the pane shows a final line from the CLI plus the UI line 'Zalogowano' (`terminal.success`), disables the input, and after 2 s collapses; the checks hook refetches (events `provider.login_restored`, `connection.status_changed`) and the row becomes 'zalogowany'.
9. **Cancel.** 'Anuluj logowanie' calls `onboarding.login.cancel`; leaving the step (Back/Next/route change/unmount) also cancels an active login (cleanup effect) so no forward or Environment is left open.
10. **Connection lost.** If the stream drops, show `terminal.lost` with 'Połącz ponownie' (reattach if the session still exists; no replay) or 'Anuluj'.
11. **Accessibility.** The pane keeps `role="log"` `aria-live="off"`; a separate visually-hidden polite status region announces state changes only (never terminal content). Input row has a visible label 'Wpisz lub wklej tutaj' and describes 'Kod logowania trafia bezpośrednio do CLI. Overmind go nie widzi.' (`terminal.input.hint`, also a reassurance line matching the lead text).
12. **Only one session.** If a login is open for Codex and the Owner clicks 'Zaloguj' on Claude, a confirm 'Zakończyć trwające logowanie?' cancels the first (inline confirm in the row).
13. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` crops the terminal panel of the mock: magenta-bordered card (radius 20, 1px magenta a50, fill #120A18), header label + magenta 'Otwórz link w przeglądarce' button (h40), body mono 12/1.6 on #06040A with the four lines and the caret. The input row under the pane, the hints, success/failure/lost states and the Back-to-row collapse are NOT in the mock (DESIGN GAP, derived from DS tokens).

## 7. Reuse

- `ui:TerminalPane` login mode, `sanitizeTerminalText`, `extractLoginUrl` (not used: the engine classifies), `ui:Button`, `ui:TextField`; `openLoginStream` (ONB010), `useWizardChecks` (ONB015), `desktopShell.openExternal` (SHELL003).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/connections/login/{LoginTerminalPanel.tsx,LoginInputRow.tsx,use-login-terminal.ts,terminal-buffer.ts,map-login-state.ts}`. UI layer; folder-level ESLint rule file `login/.eslintrc-no-terminal-logging.cjs` (owned here).

## 9. Security and safety

- SEC009 L1/L2: terminal I/O is pass-through; input values are never stored or logged; output is not logged, cached or sent anywhere; the lint rule and a spy test enforce it.
- SEC009 L3: only engine-classified https URLs open, on an Owner click, in the default browser.
- SEC009 L8: no copy-to-chat or send-to-Chief; the DS pane's copy button copies the visible sanitised text to the clipboard only (Owner action) - the 'Kopiuj' control is hidden in this panel (`labels.copy` omitted) to avoid pasting codes elsewhere; DESIGN decision recorded.
- The input row is masked and cleared; React state never holds the sent text.
- Cleanup on unmount cancels the session and closes any forward.

## 10. Errors and edge cases

- Paste of a very long string: the UI splits into chunks of 4 KiB sequentially; over 16 KiB total is refused ('Za dużo tekstu').
- The CLI prints an URL with credentials: engine rejects (no button).
- Terminal bytes with invalid UTF-8: replacement chars; no crash.
- Rapid Back/Next: the cleanup cancels; no orphan session (engine TTL as backup).
- Two windows: not applicable.
- Login success while the Owner is typing: input disabled, row flips.

## 11. Acceptance criteria

- [ ] Given 'Zaloguj' on Codex then a session starts, lines stream into the pane and the button enables when the URL arrives.
- [ ] Given the URL is rejected then the warning shows and the button stays disabled.
- [ ] Given the Owner pastes a code and presses Enter then the engine receives it once, the field clears, and no log call contains it.
- [ ] Given success then the row becomes 'zalogowany' and the panel collapses after 2 s.
- [ ] Given the Owner presses Back then the login session is cancelled.
- [ ] Given stream loss then the lost state with reconnect appears.

## 12. Test plan

- Vitest + Testing Library with a fake stream and fake client; spy on `console` and the logger to prove no terminal or input content is logged; the lint rule is tested with fixtures.
- Storybook stories for each state; axe; visual vs `design.png`.
- Playwright with the mock gateway scenario `login-codex`.
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/connections/login`.

## 13. Parallelization notes

After ONB010/015 and ONB014. Parallel with ONB016/018. Backend ONB008/010 must be merged for real e2e; the fake stream covers dev.

## 14. Open questions and assumptions

- OPEN (DS gap): `TerminalPane` login mode lacks an input affordance and a `copy` opt-out; this task composes a local input row and omits the copy label.
- ASSUMPTION: login commands are line-oriented (see TUI limitation); PROV profile owners confirm.
- OPEN: the Codex callback forward is optional and default off; the Owner explanation text is proposed: 'Logowanie przez przekierowanie otwiera na chwilę port 1455 tylko dla tego logowania.'
