---
id: OVE_ONB014
title: "Build wizard step 2 static UI: system checklist, login terminal panel and footer hint"
area: ONB
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS022, OVE_DS052, OVE_DS074, OVE_ONB011]
soft_depends_on: []
provides: ["ui:ChecksStepView"]
needs: ["ui:CheckList", "ui:CheckRow", "ui:TerminalPane", "ui:Button", "ui:SectionLabel"]
owns: ["apps/desktop/src/features/onboarding/steps/connections/ChecksStepView.tsx", "apps/desktop/src/features/onboarding/steps/connections/checks.fixtures.ts", "apps/desktop/src/features/onboarding/steps/connections/index.ts", "apps/desktop/src/features/onboarding/steps/connections/ChecksStepView.stories.tsx", "apps/desktop/src/locales/en/onboarding-checks.json", "apps/desktop/src/locales/pl/onboarding-checks.json"]
reads: []
design: design.png
design_source: "Kreator-Polaczenia#onb2/checklist (crop 416,210,968,410); design-terminal.png = onb2/terminal-panel (crop 416,628,968,204); design-footer.png = onb2/footer-actions (crop 416,840,968,60)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [4, 20, 22]
---

# OVE_ONB014: Build wizard step 2 static UI: system checklist, login terminal panel and footer hint

## 1. Summary

Implements the visual content of step 2 'Podłącz CLI i sprawdź izolację' from `ui:CheckList`/`ui:CheckRow` and `ui:TerminalPane` (login mode) with fixtures: six check rows in all statuses of the mock plus running and failed, the magenta login terminal panel with 'Otwórz link w przeglądarce', and the footer hint. It also authors the complete step 2 copy catalogue used by ONB015..018.

## 2. Context

`Kreator-Polaczenia.png` (content 943 px tall, overflowing 900): title 'Podłącz CLI i sprawdź izolację', lead 'Agenci korzystają z Twoich subskrypcji przez oficjalne CLI. Logujesz się w samym CLI, Overmind nie widzi haseł ani tokenów.'; a check card (968x396 at y=217) with rows: Apple container (gotowe), Test izolacji (zaliczony), herdr, Claude Code (zalogowany), Codex CLI (czeka na Ciebie: magenta ring), Ollama (pominięto, 'Wykryj'); then the terminal panel (968x191 at y=635) with header 'TERMINAL · CODEX CLI W KONTENERZE', magenta button 'Otwórz link w przeglądarce', lines '$ codex login', 'Otwórz w przeglądarce, aby zalogować się planem ChatGPT:', 'https://auth.openai.com/authorize?…', 'Czekam na zalogowanie… ▍'; footer row with the hint 'Wystarczy jedno zalogowane CLI, żeby przejść dalej.' and Back/Next.

## 3. Scope (in)

- `ChecksStepView` presentational: `rows`, `terminal` (optional panel props), `hint`.
- Row mapping from `WizardCheck` (ONB001) to `CheckRowProps` lives in ONB015; this task provides fixtures and the view that accepts `CheckRowProps[]`.
- `locales/{en,pl}/onboarding-checks.json`: full catalogue for step 2 (below).
- Step definition `steps/connections/index.ts` with titles and a Component rendering fixtures until ONB015 wires it (the wired file `ConnectionsStep.tsx` is owned by ONB015).
- Stories for every row status and the terminal panel states of the DS (idle, waiting with caret).
- The page overflow rule: the main column scrolls (content 943 px), the footer sticks (DS073).

## 4. Out of scope

- Data wiring (ONB015), container setup flow (ONB016), live terminal (ONB017), gating (ONB018).
- Row business rules.

## 5. Detailed requirements

1. **Rows (title / description / status word), exactly as the mock:** `apple_container` 'Apple container' / 'Izolacja Agentów w lekkich maszynach wirtualnych · macOS 26' / 'gotowe'; `isolation_test` 'Test izolacji' / 'Odczyt ~/.ssh z kontenera został zablokowany' / 'zaliczony'; `herdr` 'herdr' / 'Warstwa terminali dla CLI · wersja przypięta 0.9.2' / 'gotowe'; `claude` 'Claude Code' / 'claude 2.4.1 · zalogowany w CLI · Claude Max' / 'zalogowany'; `codex` 'Codex CLI' / 'codex 0.61 · logowanie trwa w terminalu poniżej' / 'czeka na Ciebie'; `ollama` 'Ollama' / 'Opcjonalny model zapasowy, działa lokalnie' / 'pominięto' with action 'Wykryj'. Description lines can carry dynamic version text; the status words come from keys by `statusKey`.
2. **Statuses.** `ready` (mint check), `waiting` (magenta ring with pulse), `skipped` (grey ring + 'Wykryj'), `running` (spinner; status 'sprawdzam…' / 'trwa'), `failed` (error ring; remedy `detail`; action 'Spróbuj ponownie'), plus `pending` rendered as `skipped` look with status 'oczekuje' and no action until prerequisites finish. Status words never rely on colour alone (DS).
3. **Row actions (props only here):** claude/codex rows with status `pending` or `failed(login)` show 'Zaloguj' (secondary sm) wired in ONB017; `skipped`/failed Ollama shows 'Wykryj'; failed checks show 'Spróbuj ponownie'.
4. **Terminal panel.** `ui:TerminalPane mode='login'` with `title` 'TERMINAL · CODEX CLI W KONTENERZE' (EN 'TERMINAL · CODEX CLI IN CONTAINER'; the CLI name is a parameter: `terminal.title` 'TERMINAL · {{cli}} W KONTENERZE'), `loginUrl`, `onOpenLink`, labels `{ region: 'Terminal logowania', openLink: 'Otwórz link w przeglądarce', copy: 'Kopiuj', copied: 'Skopiowano' }`, `caret` true while waiting. The input row below the pane (ONB017) is not part of this task.
5. **Hint.** Footer hint 'Wystarczy jedno zalogowane CLI, żeby przejść dalej.' (EN 'One logged-in CLI is enough to continue.'); registered via `setHint` by ONB018; the view only renders what it receives.
6. **Overflow.** At 1440x900 the content is 943 px: the main column scrolls internally and the footer remains visible (sticky, DS073); stories include a 900 px viewport case.
7. **Copy catalogue (`onboarding-checks.json`, EN | PL) must include:** `title` Connect CLIs and check isolation | Podłącz CLI i sprawdź izolację; `lead`; `rows.<id>.title/description` with parameters `{{version}}`, `{{plan}}`; `status.ready` ready | gotowe; `status.passed` passed | zaliczony; `status.logged_in` logged in | zalogowany; `status.waiting_for_owner` waiting for you | czeka na Ciebie; `status.skipped` skipped | pominięto; `status.running` checking | sprawdzam; `status.pending` waiting | oczekuje; `status.failed` failed | błąd; `action.detect` Detect | Wykryj; `action.retry` Try again | Spróbuj ponownie; `action.login` Log in | Zaloguj; `terminal.title`, `terminal.region`, `terminal.openLink`, `terminal.copy`, `terminal.copied`, `terminal.input.label` 'Wpisz lub wklej tutaj' , `terminal.input.send` 'Wyślij', `terminal.cancel` 'Anuluj logowanie', `terminal.preparing` 'Przygotowuję środowisko…', `terminal.lost` 'Połączenie z terminalem utracone', `terminal.urlRejected` 'Ten link nie jest na liście zaufanych adresów logowania. Nie otwieram go.', `hint.default`, `hint.noCli`, `hint.isolationFailed`, `remedy.*` for each failure reason (container_missing, kernel_missing, system_not_running, version_unsupported, image_not_ready, offline, isolation_probe_failed, herdr_missing, cli_not_installed, timeout, unknown) with PL and EN texts, `progress.image` 'Przygotowuję obraz Agentów… {{percent}}%'.
8. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` crops the check list card (968x396); `design-terminal.png` crops the login terminal panel; `design-footer.png` the hint and buttons row. Reproduce row heights (65 px, 69 with the action), the magenta left rule on the waiting row, the magenta-bordered terminal card, mono 12/1.6 lines on #06040A, caret. Not in the mock: running spinner, failed row with remedy, pending, terminal idle/lost/success, hover/focus.

## 7. Reuse

- `ui:CheckList`, `ui:CheckRow`, `ui:StepRing`, `ui:TerminalPane`, `ui:Button`, `ui:SectionLabel` (DS074/052).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/connections/{ChecksStepView.tsx,checks.fixtures.ts,index.ts,ChecksStepView.stories.tsx}` and `apps/desktop/src/locales/{en,pl}/onboarding-checks.json`. Presentational layer.

## 9. Security and safety

- Terminal lines and version texts are rendered as text through the DS sanitiser; no HTML, no link auto-opening inside the pane.
- The open-link button is enabled only when the DS receives an https URL (classified by the engine).

## 10. Errors and edge cases

- Row description very long: DS 2-line clamp.
- All six rows failed: the card remains within bounds with remedies; page scrolls.
- Terminal with 500+ lines: DS ring buffer.
- Long Polish words in the status column: the DS keeps `white-space: nowrap` for the status word and shrinks the description.

## 11. Acceptance criteria

- [ ] Given the mock fixture then the view matches the three crops within tolerance.
- [ ] Given each status then the row look follows DS074 and exposes the status word.
- [ ] Given the terminal fixture then the caret blinks (static under reduced motion) and the open-link button is enabled with the URL.
- [ ] Given PL and EN then all strings come from `onboarding-checks.json`.

## 12. Test plan

- Storybook stories per status with play tests; visual snapshots; axe.
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/connections`.

## 13. Parallelization notes

After ONB011 and DS074/052. Parallel with ONB012. ONB015..018 consume the view and the copy catalogue.

## 14. Open questions and assumptions

- DESIGN GAP: failed/running/pending rows, input row under the terminal, terminal lost and success states are derived.
- OPEN: PL remedy texts to be reviewed.
