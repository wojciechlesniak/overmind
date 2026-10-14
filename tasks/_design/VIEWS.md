# Overmind - View Specification (VIEWS)

Source of truth: the 18 static HTML mocks in `source/*.dc.html` and their PNG renders in `views/*.png`. This file maps every mock to named screen regions so tasks can reference `view/region` slugs instead of pixel coordinates.

## How to read this document

- **Coordinates**: CSS pixels, origin top-left of the page. Viewport 1440x900 for desktop views, 380x560 for Tray, 390x844 for Telegram. **The PNG files are rendered at 2x: multiply every number by 2** to find the region in `views/<View>.png`.
- **Measured, not estimated**: every box comes from a Playwright (Chromium) script that loads the mock with `file://`, blocks `./support.js` and Google Fonts, and reads `getBoundingClientRect()`. Fonts (Bricolage Grotesque, JetBrains Mono) could not be fetched in the build sandbox, so a fallback font was used for measuring; text-driven widths can be off by a few px, heights and layout matched the PNGs. Boxes that depend on text width (pills, chips) are marked as approximate in the Notes only when they disagree with the PNG.
- **Slugs** are stable identifiers: `<view-prefix>/<region>`. Prefixes: `shell`, `onb`, `onb1`, `onb2`, `dash`, `chief`, `agentchat`, `canvas`, `board`, `disc`, `dec`, `agents`, `skills`, `appr`, `activity`, `ws`, `conn`, `appset`, `tray`, `tg`. Shared composites reuse the slug of the first view that defines them (for example `shell/top-bar`).
- **Canvas zoom**: the Workflow canvas world is 1120x760 rendered with CSS `zoom: 0.7`, so every canvas box is in **screen px** (world px x 0.7).
- **"Overflows viewport"**: the region extends below 900px (or 560/844); the mock shows it clipped, the implementation must scroll that container.
- **Copy**: UI strings are Polish exactly as in the mock (the code and docs of the project are English, ADR 0017; the product UI ships Polish first). Values that are mock data (names, numbers, timestamps) are copied as shown.
- **Domain rules visible in every view** (design-system rules, apply to states not drawn): visibility is always a word ("PUBLICZNY"/"PRYWATNY"), never colour alone (ADR 0028); state is always icon + text; numbers carry a word unit ("3 z 3 naraz", "18 min"); limits always say "wg CLI"; Telegram approves only per Run; Decisions are never deleted (ADR 0008).

### Default "states NOT shown" checklist (applies to every view)

Hover on every button, row, card, tab and rail item (use design-system hover rules: lift surface one step, border to `line-strong`); keyboard focus ring on every interactive element (2px violet ring, 2px offset); pressed state; disabled state for buttons and inputs; loading skeletons for lists and panels; error state for data that failed to load; empty state for every list. Each view below lists only the extra, view-specific gaps.

## Shared shell (14 views)

Fourteen views share the same shell: `AppRail` (72px) + `TopBar` + optional `SubTabs`. Everything except the Onboarding wizard, Tray and Telegram. The per-view tables below list only the rail item that is active and the tab bar, then the view-specific regions.

| Slug | x | y | w | h | Description |
|---|---|---|---|---|---|
| `shell/rail` | 0 | 0 | 72 | 900 | App rail (72px) |
| `shell/rail-logo` | 12.5 | 16 | 46 | 46 | Logo tile 44x44 (hex-cell mark) |
| `shell/rail-item-active` | 13.5 | 124 | 44 | 44 | Active rail item |
| `shell/rail-item-settings` | 13.5 | 840 | 44 | 44 | Settings rail item (bottom) |
| `shell/top-bar` | 72 | 0 | 1368 | 117 | Top bar (wraps to two rows when workspace switcher is present) |
| `shell/top-bar-workspace-switcher` | 92 | 13 | 201.8 | 40 | Workspace switcher button |
| `shell/top-bar-path` | 303.8 | 26 | 224 | 14 | Workspace path (mono) |
| `shell/top-bar-limit-meter` | 633.6 | 19 | 330.9 | 28 | Subscription limit meter "per CLI" |
| `shell/top-bar-agent-slots` | 974.5 | 19 | 152 | 28 | Agents N of 3 pill |
| `shell/top-bar-telegram-status` | 1136.5 | 19 | 164 | 28 | Telegram status pill |
| `shell/top-bar-approvals-button` | 1310.6 | 12 | 109.4 | 42 | Approvals counter button ("3 czekają") |
| `shell/top-bar-global-pause` | 92 | 64 | 136 | 40 | Global Pause button |

Shell variants measured:

- **Top bar 117px (12 views)**: with the workspace switcher + path, the bar wraps to two rows (Global Pause drops to a second row at x=92,y=64). This matches the PNGs but looks accidental; see COMPONENT-INVENTORY section E.
- **Top bar 67px (Pulpit, Ustawienia)**: no workspace switcher, one row. Positions: limit meter x=487.6, agent slots x=828.5, Telegram x=990.5, Approvals x=1164.6,y=12 (109.4x42), Global Pause x=1284,y=13 (136x40).
- **Tab bar** (`shell/tab-bar`, `nav[aria-label="Sekcje"]`, 1368x45 at x=72): y=117 in the 117px layout (Main, Agenci, Skille, Activity, Workspace, Polaczenia); y=67 in Ustawienia. Tab sets: Canvas / Runy i Activity (Main, Activity); Agenci / Skille (Agenci, Skille); Ten Workspace / Połączenia i modele / Aplikacja (Workspace, Polaczenia, Ustawienia).
- **Active rail item** y per view: Pulpit 74, Chief/Czat-Agent/Dyskusja 124, Main/Activity 174, Tablica 224, Decyzje 274, Agenci/Skille 343, Workspace/Polaczenia/Ustawienia 840 (Settings). Zgody has no active rail item (it is opened from the top-bar Approvals button).

**Shell copy** (identical in all rail views): rail labels (aria): "Główna nawigacja", "Workspace'y", "Chief, czaty i Dyskusje", "Workflow i Runy", "Tablica Zadań", "Rejestr decyzji", "Agenci i Skille", "Ustawienia"; top bar: "Aplikacja rezerwacji", "~/Projects/aplikacja-rezerwacji", "Claude Max 62% · reset 3 h · wg CLI", "Agenci 3 z 3 naraz", "Telegram połączony", "3 czekają" (aria "Zgody i Prośby: 3 czekają"), "Global Pause".

**Shell states shown**: rail item active vs inactive; Approvals button amber with count; Telegram dot mint; limit meter bar 62%. **Not shown**: rail item hover/focus and tooltip with its label, rail badge for waiting Approvals, workspace switcher open menu and multi-Workspace list, top bar when Global Pause is active (should show a paused state and a "Wznów" button), limit meter at >=90% (warning) and at 100%, Telegram disconnected, agent slots 0 z 3, Approvals count 0.


---

## 1. Onboarding 1 (Allowed folder)  (`Kreator-Folder`)

- **File**: `source/Kreator-Folder.dc.html`, render `views/Kreator-Folder.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: First step of the four-step first-run wizard. The Owner picks the folder Agents may work in and sets Read / Write / Execute rights for it.

**Owner-facing functions**

- Browse the folder tree and select an allowed folder (parent `~/Projects`, children with a selected one)
- Open the native Finder picker ("Wybierz w Finderze…")
- Toggle Read, Write and Execute rights for the selected folder (Execute off by default)
- Go Back / Next in the wizard

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `onb/sidebar` | 0 | 0 | 360 | 900 | Left wizard sidebar 360px (radial magenta glow bg) |  |
| `onb/brand` | 36 | 40 | 287 | 46 | Logo tile + "Overmind" wordmark |  |
| `onb/intro` | 36 | 122 | 287 | 66 | "PIERWSZE URUCHOMIENIE" label + intro text |  |
| `onb/stepper` | 36 | 224 | 287 | 169 | Wizard stepper (4 steps) |  |
| `onb/stepper-step-active` | 36 | 224 | 287 | 28 | Active step (magenta numbered dot) |  |
| `onb/stepper-step-optional` | 36 | 362 | 287 | 31 | Step 4 with "opcjonalnie" sub-label |  |
| `onb/sidebar-footnote` | 36 | 824 | 287 | 36 | Footnote |  |
| `onb/main` | 360 | 0 | 1080 | 900 | Main column |  |
| `onb/step-counter` | 416 | 48 | 968 | 14 | "Krok 1 z 4" mono counter |  |
| `onb/title` | 416 | 84 | 968 | 39.1 | Step title (34px/700) |  |
| `onb/lead` | 416 | 145.1 | 620 | 49.6 | Lead paragraph |  |
| `onb1/folder-picker` | 416 | 216.7 | 491 | 249.8 | Folder tree card |  |
| `onb1/folder-row-parent` | 431 | 231.7 | 461 | 36 | Parent folder row (~/Projects) |  |
| `onb1/folder-row-selected` | 431 | 271.7 | 461 | 36 | Selected folder row |  |
| `onb1/folder-row` | 431 | 311.7 | 461 | 36 | Unselected folder row |  |
| `onb1/pick-in-finder-button` | 431 | 399.7 | 461 | 44 | Dashed "choose in Finder" button |  |
| `onb1/permissions-panel` | 925 | 216.7 | 459 | 249.8 | Rights panel (magenta border) |  |
| `onb1/permission-read` | 944 | 262.7 | 421 | 34 | Checkbox row Read (checked) |  |
| `onb1/permission-write` | 944 | 312.7 | 421 | 34 | Checkbox row Write (checked) |  |
| `onb1/permission-execute` | 944 | 362.7 | 421 | 34 | Checkbox row Execute (unchecked) |  |
| `onb/footer-actions` | 416 | 488.5 | 968 | 46 | Back / Next row |  |
| `onb/back-button` | 1192.6 | 491.5 | 76.8 | 40 | Back (secondary 40px) |  |
| `onb/next-button` | 1279.4 | 488.5 | 104.6 | 46 | Next (magenta CTA 46px) |  |

**States visible in the mock**

- Step 1 active (magenta numbered dot), steps 2-4 inactive, step 4 labelled "opcjonalnie"
- Folder row states: parent (expanded), selected (violet tint + check), unselected
- Checkboxes: Read checked, Write checked, Execute unchecked

**States NOT shown (implementers design them from the design-system rules)**

- No folder selected yet (Next disabled; rights panel hidden or empty)
- Folder picker loading / permission denied by macOS / folder outside home
- Checkbox hover + focus; Finder button hover/focus
- Validation: folder already in list, folder is a system path, Write+Execute warning
- Back disabled on first step (the mock shows an enabled Back button; decide: hide on step 1)
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Overmind` · `PIERWSZE URUCHOMIENIE` · `Kilka kroków i Chief będzie gotowy do pracy. Wszystko zostaje na tym Macu.` · `1` · `Dozwolony folder` · `2` · `CLI i izolacja` · `3` · `Pierwszy Workspace` · `4` · `Telegram` · `opcjonalnie` · `Jedna instalacja to jeden Właściciel. Bez kont i bez serwera.` · `Krok 1 z 4` · `Wskaż folder, w którym Agenci mogą pracować` · `Agenci widzą tylko foldery z tej listy. Resztę Maca blokuje izolacja systemu, nie przełącznik w aplikacji. Bez folderu nie mają dostępu do niczego.` · `~/Projects` · `aplikacja-rezerwacji` · `fundacja-www` · `shared-ui` · `Wybierz w Finderze…` · `PRAWA DLA ~/Projects/aplikacja-rezerwacji` · `Odczyt` · `Agenci czytają pliki projektu.` · `Zapis` · `Zmiany w osobnych worktree, nigdy wprost na main.` · `Wykonywanie` · `Uruchamianie skryptów z tego folderu.` · `Kolejne foldery dodasz później w ustawieniach Workspace'u albo po Prośbie Agenta.` · `Wstecz` · `Dalej` · `@Kroki kreatora`

---

## 2. Onboarding 2 (CLI & isolation)  (`Kreator-Polaczenia`)

- **File**: `source/Kreator-Polaczenia.dc.html`, render `views/Kreator-Polaczenia.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900 (content 943px tall, overflows)
- **Purpose**: Second wizard step. Detects Apple container, runs the isolation test, detects herdr and the official CLIs, and lets the Owner log in to a CLI in an embedded terminal.

**Owner-facing functions**

- See a system-check list with a status per item (Apple container, isolation test, herdr, Claude Code, Codex CLI, Ollama)
- Open the login link from the CLI terminal in the browser ("Otwórz link w przeglądarce")
- Re-detect a skipped item ("Wykryj")
- Continue once at least one CLI is logged in; go Back

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `onb/sidebar` | 0 | 0 | 360 | 943.4 | Left wizard sidebar 360px (radial magenta glow bg) | overflows viewport (scroll content) |
| `onb/brand` | 36 | 40 | 287 | 46 | Logo tile + "Overmind" wordmark |  |
| `onb/intro` | 36 | 122 | 287 | 66 | "PIERWSZE URUCHOMIENIE" label + intro text |  |
| `onb/stepper` | 36 | 224 | 287 | 169 | Wizard stepper (4 steps) |  |
| `onb/stepper-step-active` | 36 | 270 | 287 | 28 | Active step (magenta numbered dot) |  |
| `onb/stepper-step-optional` | 36 | 362 | 287 | 31 | Step 4 with "opcjonalnie" sub-label |  |
| `onb/sidebar-footnote` | 36 | 867.4 | 287 | 36 | Footnote | overflows viewport (scroll content) |
| `onb/main` | 360 | 0 | 1080 | 943.4 | Main column | overflows viewport (scroll content) |
| `onb/step-counter` | 416 | 48 | 968 | 14 | "Krok 1 z 4" mono counter |  |
| `onb/title` | 416 | 84 | 968 | 39.1 | Step title (34px/700) |  |
| `onb/lead` | 416 | 145.1 | 640 | 49.6 | Lead paragraph |  |
| `onb1/folder-picker` | 417 | 217.7 | 966 | 65 | Folder tree card |  |
| `onb2/checklist` | 416 | 216.7 | 968 | 396 | System check list card |  |
| `onb2/check-row-ready` | 417 | 217.7 | 966 | 65 | Check row (done: mint check) |  |
| `onb2/check-row-waiting` | 417 | 477.7 | 966 | 65 | Check row (waiting: magenta ring) |  |
| `onb2/check-row-skipped` | 417 | 542.7 | 966 | 69 | Check row (skipped: grey ring + "Wykryj" button) |  |
| `onb2/terminal-panel` | 416 | 634.7 | 968 | 190.8 | Login terminal panel (magenta border) |  |
| `onb2/terminal-header` | 433 | 651.7 | 934 | 40 | Terminal label + open-link button |  |
| `onb2/terminal-output` | 433 | 701.7 | 934 | 106.8 | Terminal output (mono 12/1.6 on #06040A) |  |
| `onb2/open-link-button` | 1165.6 | 651.7 | 201.4 | 40 | Magenta 40px button |  |
| `onb2/footer-actions` | 416 | 847.4 | 968 | 48 | Hint + Back / Next row |  |
| `onb2/footer-hint` | 416 | 863.4 | 326.7 | 16 | Hint text |  |
| `onb/back-button` | 1185 | 847.4 | 84.4 | 48 | Back (link-button 46px) |  |
| `onb/next-button` | 1279.4 | 848.4 | 104.6 | 46 | Next (magenta CTA 46px) |  |

**States visible in the mock**

- Check row statuses: done (mint check, "gotowe"/"zaliczony"/"zalogowany"), waiting (magenta ring, "czeka na Ciebie"), skipped (grey ring, "pominięto" + "Wykryj")
- Embedded login terminal with output and blinking cursor
- Footer hint "Wystarczy jedno zalogowane CLI, żeby przejść dalej"

**States NOT shown (implementers design them from the design-system rules)**

- Detection in progress (spinner per row)
- Check failed (error `#FF8FA3` row with remedy + retry), isolation test failed (blocks Next)
- No CLI logged in: Next disabled
- Terminal idle / connection lost / login success transition
- Hover/focus for "Wykryj", "Otwórz link", Back, Next
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Overmind` · `PIERWSZE URUCHOMIENIE` · `Kilka kroków i Chief będzie gotowy do pracy. Wszystko zostaje na tym Macu.` · `Dozwolony folder` · `2` · `CLI i izolacja` · `3` · `Pierwszy Workspace` · `4` · `Telegram` · `opcjonalnie` · `Jedna instalacja to jeden Właściciel. Bez kont i bez serwera.` · `Krok 2 z 4` · `Podłącz CLI i sprawdź izolację` · `Agenci korzystają z Twoich subskrypcji przez oficjalne CLI. Logujesz się w samym CLI, Overmind nie widzi haseł ani tokenów.` · `Apple container` · `Izolacja Agentów w lekkich maszynach wirtualnych · macOS 26` · `gotowe` · `Test izolacji` · `Odczyt ~/.ssh z kontenera został zablokowany` · `zaliczony` · `herdr` · `Warstwa terminali dla CLI · wersja przypięta 0.9.2` · `Claude Code` · `claude 2.4.1 · zalogowany w CLI · Claude Max` · `zalogowany` · `Codex CLI` · `codex 0.61 · logowanie trwa w terminalu poniżej` · `czeka na Ciebie` · `Ollama` · `Opcjonalny model zapasowy, działa lokalnie` · `pominięto` · `Wykryj` · `TERMINAL · CODEX CLI W KONTENERZE` · `Otwórz link w przeglądarce` · `$ codex login` · `Otwórz w przeglądarce, aby zalogować się planem ChatGPT:` · `https://auth.openai.com/authorize?…` · `Czekam na zalogowanie… ▍` · `Wystarczy jedno zalogowane CLI, żeby przejść dalej.` · `Wstecz` · `Dalej` · `@Kroki kreatora`

---

## 3. Workspaces dashboard  (`Pulpit`)

- **File**: `source/Pulpit.dc.html`, render `views/Pulpit.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: Home screen listing every Workspace with its Chief summary, task counts and agent activity, plus the Notification center and a system status list.

**Owner-facing functions**

- Create a new Workspace ("Nowy Workspace")
- Open the Chief chat from the Chief summary strip ("Otwórz czat")
- Open any Workspace card (name, path, summary, counts by lane, agent avatars, Run, Approvals waiting)
- Read Notifications (Approval, Access Request, Discussion started, Run completed, Escalation) and open them
- See system status: engine, isolation, herdr, backup, Telegram

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 74 | 44 | 44 | Active rail item |  |
| `dash/main` | 72 | 67 | 1048 | 833 | Main column |  |
| `dash/page-header` | 100 | 93 | 992 | 57 | Date + page title + New Workspace |  |
| `dash/date` | 100 | 93 | 200.6 | 14 | Mono date line |  |
| `dash/title` | 100 | 111 | 200.6 | 39 | Page title (32px/700) |  |
| `dash/new-workspace-button` | 927.9 | 110 | 164.1 | 40 | Violet primary 40px |  |
| `dash/chief-summary` | 100 | 170 | 992 | 94 | Chief summary banner (magenta gradient) |  |
| `dash/chief-summary-avatar` | 119 | 195 | 44 | 44 | Chief avatar 44px |  |
| `dash/workspace-grid` | 100 | 284 | 992 | 511.2 | Workspace card grid (auto-fill minmax(380px,1fr)) |  |
| `dash/workspace-card-active` | 100 | 284 | 489 | 250.6 | WorkspaceCard: running, magenta border+glow |  |
| `dash/workspace-card-running` | 603 | 284 | 489 | 250.6 | WorkspaceCard: running, no pending approvals |  |
| `dash/workspace-card-paused` | 100 | 548.6 | 489 | 246.6 | WorkspaceCard: paused by Owner |  |
| `dash/workspace-card-isolated` | 603 | 548.6 | 489 | 246.6 | WorkspaceCard: isolated (lock pill) |  |
| `dash/workspace-progress-bar` | 119 | 420.6 | 451 | 8 | Segmented progress bar 8px (todo/doing/review/done) |  |
| `dash/workspace-card-agent-stack` | 119 | 461.6 | 451 | 26 | Agent avatar stack + pending Approvals (NOTE: avatars collapse in mock, see section E) |  |
| `dash/notifications` | 1120 | 67 | 320 | 833 | Notifications + system sidebar (320px) |  |
| `dash/notifications-list` | 1141 | 122 | 279 | 317 | Notification list (5 items) |  |
| `dash/notification-item-approval` | 1141 | 122 | 279 | 54 | NotificationItem: Approval (amber shield) |  |
| `dash/notification-item-access` | 1141 | 176 | 279 | 70 | NotificationItem: Access Request (magenta folder-plus) |  |
| `dash/notification-item-discussion` | 1141 | 246 | 279 | 70 | NotificationItem: Discussion (lavender chat) |  |
| `dash/notification-item-run` | 1141 | 316 | 279 | 54 | NotificationItem: Run finished (mint check) |  |
| `dash/notification-item-escalation` | 1141 | 370 | 279 | 69 | NotificationItem: Escalation (red pulse) |  |
| `dash/system-heading` | 1141 | 461 | 279 | 19 | "System" heading |  |
| `dash/system-status-list` | 1141 | 494 | 279 | 150 | SystemStatusList (5 rows) |  |

**States visible in the mock**

- Workspace card states: working (magenta Run line, "3 Zgody czekają" amber), done-ish ("Run #13 · board"), paused by the Owner ("wstrzymany przez Ciebie", nobody working), isolated ("izolowany" badge, NDA, "bez aktywnego Runu")
- Notification kinds with coloured icon tile, age ("3 min", "wczoraj")
- System status rows with mint dot

**States NOT shown (implementers design them from the design-system rules)**

- No Workspaces yet (first-run empty state with CTA "Nowy Workspace")
- Loading skeleton for cards and notifications
- Empty notification center
- System status degraded / engine stopped (amber/error dot)
- Card hover, focus, Global Pause active (all cards paused banner)
- Unread vs read notification styling
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`wtorek, 13 października` · `Workspace'y` · `Nowy Workspace` · `C` · `CHIEF · PODSUMOWANIE` · `Dwa Workspace'y pracują, jeden jest wstrzymany. Potrzebuję Cię w 3 sprawach w „Aplikacji rezerwacji”, reszta idzie sama.` · `Otwórz czat` · `QA ma 2 niepowodzenia w kodzie rabatowym, Security czeka na Zgodę.` · `4 do zrobienia · 5 w toku · 1 review · 7 gotowe z 17` · `3 Zgody czekają` · `Run #14 · pętla jakości 2 z 5` · `Strona fundacji` · `~/Projects/fundacja-www` · `Gotowe 7 z 9 Zadań, dziś bez blokad.` · `0 do zrobienia · 1 w toku · 1 review · 7 gotowe z 9` · `Rs` · `Run #13 · board` · `Research rynku` · `~/Documents/research-hotele` · `Raport konkurencji w połowie. Czeka, aż wznowisz.` · `3 do zrobienia · 0 w toku · 0 review · 2 gotowe z 5` · `nikt nie pracuje` · `wstrzymany przez Ciebie` · `Projekt klienta (NDA)` · `izolowany` · `~/Clients/acme` · `Nic nie wychodzi poza ten Workspace, Chief nie przeszukuje jego Decyzji.` · `2 do zrobienia · 0 w toku · 0 review · 4 gotowe z 6` · `bez aktywnego Runu` · `Powiadomienia` · `Zgoda: git push` · `Developer · Aplikacja rezerwacji` · `3 min` · `Prośba o dostęp: ~/Projects/shared-ui` · `Designer · Aplikacja rezerwacji` · `12 min` · `Chief zaczął Dyskusję o płatnościach` · `Czeka na Twój głos` · `20 min` · `Run #13 ukończony` · `Strona fundacji · 4 nowe Zadania` · `1 h` · `Eskalacja: limit pętli` · `Strona fundacji · wczoraj rozstrzygnięta` · `wczoraj` · `System` · `Silnik w tle` · `działa · 2 dni` · `Izolacja (container)` · `3 kontenery` · `herdr` · `v0.9.2 · przypięta` · `Kopia zapasowa` · `dziś 03:00` · `Telegram` · `połączony` · `@Powiadomienia`

---

## 4. Chief & conversations  (`Chief`)

- **File**: `source/Chief.dc.html`, render `views/Chief.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: Single conversation surface with Chief, the Owner's only interlocutor. Left: conversation list (Chief, Agents, live Discussions). Centre: thread with inline Approval card. Right: live panel with who is working and the board summary.

**Owner-facing functions**

- Chat with Chief (desktop and Telegram messages interleaved, source labelled)
- Switch to a direct chat with any Agent or Discussion from the list; create a new Agent ("Nowy Agent")
- Decide an inline Approval ("Zezwól na ten Run", "Zezwól na stałe", "Odmów")
- Use quick actions: "Pokaż Tablicę", "Zacznij Dyskusję", "Podsumuj dzień"
- See who is working now and slots used (3 z 3), a live terminal excerpt, board counts and latest Decisions

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 124 | 44 | 44 | Active rail item |  |
| `chief/conversation-list` | 72 | 117 | 270 | 783 | Conversation list (270px) |  |
| `chief/chief-row` | 84 | 133 | 245 | 77 | Chief row (selected: magenta gradient + glow) |  |
| `chief/agents-section-label` | 92 | 228 | 229 | 17 | "AGENCI W TYM WORKSPACE" label |  |
| `chief/agent-row-working` | 84 | 253 | 245 | 54 | ConversationRow QA (working, magenta dot) |  |
| `chief/agent-row-waiting-unread` | 84 | 311 | 245 | 54 | ConversationRow Security (waiting for Approval, amber dot, unread badge 1) |  |
| `chief/agent-row-done` | 84 | 369 | 245 | 54 | ConversationRow Developer (done, mint dot) |  |
| `chief/agent-row-idle` | 84 | 427 | 245 | 54 | ConversationRow Product Owner (idle, no dot) |  |
| `chief/agent-row-last` | 84 | 543 | 245 | 54 | ConversationRow Senior Reviewer |  |
| `chief/discussions-section-label` | 92 | 615 | 229 | 17 | "DYSKUSJE NA ŻYWO" label |  |
| `chief/live-discussion-card` | 84 | 640 | 245 | 56 | Live Discussion row (dashed violet border) |  |
| `chief/new-agent-button` | 84 | 840 | 245 | 44 | "Nowy Agent" dashed button |  |
| `chief/conversation` | 342 | 117 | 798 | 783 | Conversation column |  |
| `chief/conversation-header` | 342 | 117 | 798 | 65 | Chief header (avatar, model line, channel pill) |  |
| `chief/channel-pill` | 964 | 135 | 152 | 28 | "desktop + Telegram" pill |  |
| `chief/message-thread` | 351 | 182 | 780 | 600.3 | Message thread (max-width 780) |  |
| `chief/msg-timestamp` | 704.6 | 204 | 72.9 | 13 | Day/time separator |  |
| `chief/msg-owner` | 971.9 | 233 | 135.1 | 62.8 | MessageBubble owner (via Telegram) + meta |  |
| `chief/msg-chief-text` | 375 | 311.8 | 732 | 22.5 | MessageBubble chief (plain text, no bubble) |  |
| `chief/msg-chief-workspace-summary` | 375 | 350.3 | 732 | 141.6 | Per-Workspace one-sentence summary table |  |
| `chief/msg-system-agent-report` | 375 | 507.8 | 732 | 59.7 | System/agent->Chief note row |  |
| `chief/approval-card` | 375 | 583.5 | 732 | 176.8 | ApprovalCard inline (amber 1.5px border, glow) |  |
| `chief/approval-actions` | 394 | 697.3 | 694 | 44 | Approval action row (3 buttons 44px) |  |
| `chief/composer-area` | 351 | 782.3 | 780 | 146 | Quick actions + composer | overflows viewport (scroll content) |
| `chief/quick-actions` | 375 | 794.3 | 732 | 34 | Quick action chips (pill buttons 34px) |  |
| `chief/composer` | 375 | 836.3 | 732 | 72 | Composer (22px radius) | overflows viewport (scroll content) |
| `chief/send-button` | 1052 | 853.3 | 44 | 44 | Send button 44px magenta gradient + glow |  |
| `chief/working-now-panel` | 1140 | 117 | 300 | 783 | Right "Teraz pracuje" panel (300px) |  |
| `chief/working-now-header` | 1161 | 137 | 259 | 19 | Header + "3 z 3 slotów" |  |
| `chief/working-now-card-active` | 1161 | 172 | 259 | 157 | Active agent card with mini terminal |  |
| `chief/working-now-row-waiting` | 1161 | 345 | 259 | 48 | Agent row waiting for Approval (amber) |  |
| `chief/working-now-row-other` | 1161 | 409 | 259 | 48 | Agent row in other Workspace |  |
| `chief/board-tiles` | 1161 | 514 | 259 | 63 | StatTile row: Build/QA/Review/Done |  |
| `chief/recent-decisions-heading` | 1161 | 599 | 259 | 19 | Heading |  |
| `chief/recent-decision-card` | 1161 | 634 | 259 | 59 | Decision link card |  |

**States visible in the mock**

- Conversation row states: selected (Chief), Agent states (working, waiting for Approval with count badge, done, idle, waiting for Quality Gate), live Discussion
- Message bubbles: Owner (violet), Chief (surface, magenta label), agent relay ("QA → Chief:"), day separator, source tag ("z Telegrama")
- Approval card with expiry ("wygasa za 25 min"), command block, three actions
- Right panel: working Agent card, mini test list (pass/fail/progress), lane counts, Decision list

**States NOT shown (implementers design them from the design-system rules)**

- Empty conversation (new installation), loading history, Chief typing / streaming
- Failed send, offline engine
- Approval expired / already decided on Telegram
- Composer disabled while Global Pause is active
- Hover/focus for list rows and quick actions; long-message and attachment bubbles
- Agent chat list scrolling with many Agents
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`C` · `Chief` · `Security czeka na Twoją Zgodę` · `AGENCI W TYM WORKSPACE` · `pracuje · testy e2e koszyka` · `Security` · `czeka na Zgodę` · `1` · `Developer` · `skończył · 4 pliki` · `PO` · `Product Owner` · `bezczynny` · `Ds` · `Designer` · `SR` · `Senior Reviewer` · `czeka na Quality Gate` · `DYSKUSJE NA ŻYWO` · `Płatności: Stripe czy P24?` · `runda 2 z 4 · 3 uczestników` · `Nowy Agent` · `Claude Code · Opus 5.5 · widzi 3 Workspace'y` · `desktop + Telegram` · `dziś, 14:02` · `Jak idą prace?` · `z Telegrama · 14:02` · `Po jednym zdaniu na Workspace:` · `Pętla jakości, iteracja 2 z 5. QA ma 2 niepowodzenia w kodzie rabatowym, Security czeka na Twoją Zgodę.` · `Strona fundacji` · `Gotowe 7 z 9 Zadań, dziś bez blokad.` · `Research rynku` · `Wstrzymany przez Ciebie od wczoraj.` · `QA → Chief:` · `Właściciel kazał pominąć testy wydajności. Zaktualizowałem plan i przeniosłem Zadanie „Testy obciążeniowe” do Odłożonych.` · `ZGODA · SECURITY · RUN #14` · `wygasa za 25 min` · `Wejście na nową domenę: registry.npmjs.org` · `Security chce pobrać bazę podatności dla` · `npm audit` · `. Bez tego audyt zależności nie ruszy.` · `Zezwól na ten Run` · `Zezwól na stałe` · `Odmów` · `Pokaż Tablicę` · `Zacznij Dyskusję` · `Podsumuj dzień` · `Wiadomość do Chiefa` · `Teraz pracuje` · `3 z 3 slotów` · `QA · testy e2e koszyka` · `✓ koszyk › dodaje produkt` · `✓ koszyk › zmienia ilość` · `✗ koszyk › kod rabatowy` · `… 38 z 52` · `Rs` · `Researcher` · `Tablica` · `2` · `Build` · `3` · `Review` · `7` · `Gotowe` · `Ostatnie Decyzje` · `Biblioteka dat: date-fns` · `Chief · luka „jak” · 11:40` · `Zakres MVP: bez płatności ratalnych` · `Dyskusja · 3 uczestników · wczoraj` · `@Rozmowy` · `ph:Napisz do Chiefa… albo @qa` · `@Wyślij` · `@Teraz pracuje`

Textarea value: `…`

---

## 5. Direct agent chat  (`Czat-Agent`)

- **File**: `source/Czat-Agent.dc.html`, render `views/Czat-Agent.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: Direct conversation with a single Agent (QA). Owner commands are binding for the chat, but Owner Rules still win. Right panel shows a read-only terminal and herdr state.

**Owner-facing functions**

- Send instructions to the Agent
- Open the Agent profile ("Profil Agenta")
- Change or keep an Owner Rule when the Agent refuses ("Zmień Regułę", "Zostaw jak jest")
- Pause or stop the Agent ("Wstrzymaj Agenta", "Przerwij")
- Watch the Agent terminal (read-only preview) and the Task / worktree / isolation state

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 124 | 44 | 44 | Active rail item |  |
| `agentchat/conversation-list` | 72 | 117 | 270 | 783 | Conversation list (same component as Chief view) |  |
| `agentchat/chief-row` | 84 | 133 | 245 | 77 | Chief row (NOT selected: plain surface, #2A2040 border) |  |
| `agentchat/agent-row-selected` | 84 | 253 | 245 | 54 | Selected ConversationRow (bg #1A1422, border #2A2040) |  |
| `agentchat/chat` | 342 | 117 | 758 | 783 | Chat column (758px) |  |
| `agentchat/chat-header` | 342 | 117 | 758 | 65 | Agent header: avatar, role line, state pill, profile link |  |
| `agentchat/agent-state-pill` | 644.5 | 135 | 84.6 | 28 | Agent State pill ("pracuje") |  |
| `agentchat/profile-link` | 996.6 | 141 | 79.4 | 16 | Link to Agents profile |  |
| `agentchat/thread` | 342 | 182 | 758 | 614 | Message thread |  |
| `agentchat/binding-notice` | 366 | 204 | 710 | 38 | Info notice: Owner commands are binding (lock icon) |  |
| `agentchat/msg-owner` | 783.3 | 258 | 292.7 | 62.8 | MessageBubble owner |  |
| `agentchat/msg-agent-with-action-chip` | 366 | 336.8 | 624.8 | 91 | MessageBubble agent + mint plan-update chip |  |
| `agentchat/plan-update-chip` | 404 | 389.8 | 586.8 | 38 | Success result chip ("Chief zaktualizował plan") with link |  |
| `agentchat/msg-agent-with-rule-card` | 366 | 522.5 | 624.8 | 176.3 | MessageBubble agent refusal + OwnerRuleCard |  |
| `agentchat/owner-rule-card` | 404 | 575.5 | 586.8 | 123.3 | Owner Rule card (red tint) with 2 actions |  |
| `agentchat/msg-agent-with-skill-used` | 366 | 714.8 | 624.8 | 51.5 | MessageBubble agent + "used Skill" chip |  |
| `agentchat/skill-used-chip` | 404 | 745.3 | 223.3 | 21 | Skill used chip (mono 11, violet tint) |  |
| `agentchat/composer` | 342 | 796 | 758 | 104 | Composer area (no quick actions here) |  |
| `agentchat/send-button` | 1021 | 825 | 44 | 44 | Send button 44px, agent-colour gradient, NO glow |  |
| `agentchat/terminal-panel` | 1100 | 117 | 340 | 783 | Agent terminal sidebar (340px) |  |
| `agentchat/terminal-header` | 1121 | 137 | 299 | 28 | Title + read-only pill |  |
| `agentchat/terminal-output` | 1121 | 179 | 299 | 266 | TerminalPane (min-height 240) |  |
| `agentchat/agent-facts-grid` | 1121 | 459 | 299 | 120 | 2x2 KeyValue tiles (herdr state, Task, worktree, isolation) |  |
| `agentchat/terminal-footnote` | 1121 | 593 | 299 | 52.2 | Hint: terminal state is a hint, not evidence |  |
| `agentchat/agent-controls` | 1121 | 659.2 | 299 | 166.8 | Pause Agent (secondary) + Interrupt (danger) |  |

**States visible in the mock**

- Agent header with state pill ("pracuje")
- Binding-commands notice
- Result chip from Chief ("Chief zaktualizował plan" with link to Tablica)
- Owner Rule refusal card (red tint, rule id R2) with two actions
- Skill-use chip ("użyto Skilla: e2e-playwright v2")
- Terminal pane with pass/fail lines and progress; "STAN wg herdr" key-value list

**States NOT shown (implementers design them from the design-system rules)**

- Agent idle / waiting for Approval / stopped states of the header pill
- Streaming reply, send failure, empty chat
- Terminal unavailable / agent not running
- Confirmation dialog for "Przerwij" (destructive)
- Disabled composer under Global Pause
- Hover/focus on actions and terminal toolbar
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`C` · `Chief` · `Security czeka na Twoją Zgodę` · `AGENCI W TYM WORKSPACE` · `pracuje · testy e2e koszyka` · `Security` · `czeka na Zgodę` · `1` · `Developer` · `skończył · 4 pliki` · `PO` · `Product Owner` · `bezczynny` · `Ds` · `Designer` · `SR` · `Senior Reviewer` · `czeka na Quality Gate` · `DYSKUSJE NA ŻYWO` · `Płatności: Stripe czy P24?` · `runda 2 z 4 · 3 uczestników` · `Nowy Agent` · `Agent stały · Codex CLI · gpt-5.5` · `pracuje` · `Profil Agenta` · `Twoje polecenia w tym czacie są wiążące. QA od razu przekazuje je Chiefowi.` · `Pomiń testy wydajności w tej iteracji.` · `14:18` · `Zrobione. Testy wydajności nie wejdą do iteracji 2. Poinformowałem Chiefa, a on przeniósł Zadanie na Tablicy.` · `Chief zaktualizował plan · „Testy obciążeniowe” → Odłożone` · `Tablica` · `To wyłącz też test penetracyjny, szkoda czasu.` · `14:21` · `Nie mogę tego zrobić. Twoja Reguła wymaga testu penetracyjnego po każdym Zadaniu, a Reguł nie da się obejść poleceniem w czacie.` · `REGUŁA WŁAŚCICIELA · R2` · `„Wszystko ma być przetestowane, test penetracyjny po każdym Zadaniu.”` · `Zmień Regułę` · `Zostaw jak jest` · `Wracam do testów e2e koszyka. Mam 38 z 52, dwa padają na kodzie rabatowym.` · `użyto Skilla: e2e-playwright v2` · `Wiadomość do QA` · `Terminal Agenta` · `tylko podgląd` · `$ npx playwright test cart/` · `Running 52 tests using 2 workers` · `✓ cart › adds product (1.2s)` · `✓ cart › changes quantity (0.9s)` · `✓ cart › removes product (0.8s)` · `✗ cart › applies discount code` · `expected 90.00, received 100.00` · `✓ cart › persists after reload` · `✗ cart › rejects expired code` · `… 38/52` · `STAN wg herdr` · `ZADANIE` · `T-31 · koszyk` · `WORKTREE` · `qa/cart-e2e` · `IZOLACJA` · `kontener · OK` · `Stan z terminala to wskazówka. Zadanie idzie dalej dopiero po raporcie Skilla „overmind” i sprawdzeniu efektu.` · `Wstrzymaj Agenta` · `Przerwij` · `@Rozmowy` · `ph:Napisz do QA…` · `@Wyślij` · `@Terminal Agenta`

Textarea value: `…`

---

## 6. Workflow canvas  (`Main`)

- **File**: `source/Main.dc.html`, render `views/Main.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: Visual editor and live monitor of a Workflow (executable program). Left: installed Skills and Node palette. Centre: canvas with Nodes, loop frame, edges, controls. Right: Agent Inspector for the selected Node.

**Owner-facing functions**

- Search Skills; drag a Skill onto a Node's Skills tab
- Drag Nodes from the palette (Agent, Parallel, Join, IF, Loop, Discussion, Review) onto the canvas
- Select a Node to inspect Agent state, visibility, model, Skills and permissions in this Node
- Dry-run, Pause Run, Edit as a new version ("Edytuj jako v8")
- Zoom, fit/view, undo/redo, search Node, minimap
- Open a chat with the Agent from the Inspector

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 174 | 44 | 44 | Active rail item |  |
| `shell/tab-bar` | 72 | 117 | 1368 | 45 | Section tab bar |  |
| `canvas/side-panel` | 72 | 162 | 240 | 738 | Left panel 240px: installed Skills + Node palette |  |
| `canvas/skills-panel-header` | 86 | 180 | 211 | 19 | "Zainstalowane Skille" + count |  |
| `canvas/skills-search` | 86 | 211 | 211 | 42 | Search input |  |
| `canvas/skills-hint` | 86 | 265 | 211 | 33.6 | Drag hint text |  |
| `canvas/skills-list` | 86 | 310.6 | 211 | 419 | Draggable Skill list |  |
| `canvas/skill-item-public` | 86 | 310.6 | 211 | 53 | Skill item (PUBLICZNY outlined label, grip handle) |  |
| `canvas/skill-item-private` | 86 | 487.6 | 211 | 53 | Skill item (PRYWATNY outlined label) |  |
| `canvas/skill-item-dragging` | 86 | 664.6 | 211 | 65 | Skill item mid-drag (dashed magenta) |  |
| `canvas/nodes-heading` | 86 | 761.6 | 211 | 19 | "Węzły" heading |  |
| `canvas/node-palette` | 86 | 792.6 | 211 | 178 | Node palette (wrapping chips; clipped by viewport, scrolls) | overflows viewport (scroll content) |
| `canvas/palette-item-agent` | 86 | 792.6 | 83.6 | 40 | Palette item "Agent" |  |
| `canvas/workflow-header` | 330 | 178 | 802 | 90 | Workflow title row |  |
| `canvas/workflow-title` | 330 | 182.5 | 249.8 | 31 | Workflow name (26px/700) |  |
| `canvas/workflow-visibility-tab` | 589.8 | 189.5 | 72.2 | 17 | Filled PRYWATNY type tab (3px 8px, r7, 10px mono) |  |
| `canvas/workflow-version-badge` | 672 | 187.5 | 128.6 | 21 | "v7 · opublikowana" badge |  |
| `canvas/run-pill` | 810.6 | 185 | 218.6 | 26 | Run state pill (magenta) |  |
| `canvas/dry-run-button` | 1053 | 178 | 79 | 40 | Secondary 40px |  |
| `canvas/pause-run-button` | 330 | 228 | 100.8 | 40 | Secondary 40px |  |
| `canvas/edit-as-new-version-button` | 440.8 | 228 | 117.4 | 40 | Violet primary 40px |  |
| `canvas/chief-supervision-strip` | 330 | 280 | 802 | 94 | "Chief nadzoruje" strip: per-Agent state chips |  |
| `canvas/chief-supervision-chief` | 341 | 291.5 | 201 | 29 | Chief block (avatar, "6 agentów · 3 z 3 slotów") |  |
| `canvas/agent-state-chip-done` | 550 | 289 | 196.1 | 34 | AgentStateChip: done (mint text) |  |
| `canvas/agent-state-chip-working` | 341 | 331 | 119.9 | 34 | AgentStateChip: working (magenta text) |  |
| `canvas/agent-state-chip-waiting` | 468.9 | 331 | 197.5 | 34 | AgentStateChip: waiting for Approval (amber text) |  |
| `canvas/agent-state-chip-idle` | 674.4 | 331 | 183 | 34 | AgentStateChip: waiting/idle (grey text) |  |
| `canvas/stage` | 330 | 386 | 802 | 498 | Canvas viewport (dot grid 22px, radius 24) |  |
| `canvas/stage-world` | 336.6 | 395.4 | 784 | 532 | World layer 1120x760 rendered with CSS zoom 0.7 | overflows viewport (scroll content) |
| `canvas/legend-card` | 889.6 | 423.4 | 217 | 123.5 | Legend card "tab on tile" (floating, 310px world width) |  |
| `canvas/node-start` | 343.6 | 508.8 | 44.8 | 21 | Start pill (64x30 world px) |  |
| `canvas/node-product-owner` | 413.6 | 444.4 | 156.8 | 78.4 | Node tile: PUBLICZNY Agent (blue) |  |
| `canvas/node-designer` | 413.6 | 556.4 | 156.8 | 78.4 | Node tile: PUBLICZNY Agent (blue) |  |
| `canvas/node-discussion` | 644.6 | 500.4 | 168 | 78.4 | Node tile: DYSKUSJA (lavender #C9B8FF) |  |
| `canvas/node-developer-selected` | 371.6 | 759.4 | 156.8 | 78.4 | Node tile: TOR BUILD, selected (violet 4px ring) |  |
| `canvas/node-qa-working` | 567.6 | 710.4 | 156.8 | 78.4 | Node tile: TOR QA, working (magenta glow) |  |
| `canvas/node-security-waiting` | 567.6 | 808.4 | 156.8 | 78.4 | Node tile: PRYWATNY, waiting for Approval (amber glow) |  |
| `canvas/node-senior-reviewer-drop-target` | 835 | 759.4 | 156.8 | 78.4 | Node tile: TOR REVIEW, dashed magenta border + Skills tab "upuść → 1 skill" |  |
| `canvas/node-type-tab` | 426.2 | 435.3 | 64 | 14.6 | Anatomy: type tab (top-left, -13px) |  |
| `canvas/node-skills-tab` | 497.1 | 435.3 | 63.5 | 15.2 | Anatomy: Skills tab / drop target (top-right) |  |
| `canvas/node-port-left` | 408.7 | 478.7 | 9.8 | 9.8 | Anatomy: input port 14px |  |
| `canvas/node-port-right` | 565.5 | 478.7 | 9.8 | 9.8 | Anatomy: output port 14px |  |
| `canvas/node-model-pill` | 429 | 510.9 | 80.8 | 26.4 | Anatomy: Agent avatar + model pill (overlaps bottom edge) |  |
| `canvas/node-join` | 598.4 | 530.5 | 18.2 | 18.2 | Join node (26px ring) |  |
| `canvas/edge-label-join` | 588.6 | 553.6 | 64.8 | 9 | Edge/node caption |  |
| `canvas/edge-label-decisions` | 685.6 | 541.3 | 86 | 10 | Labelled edge caption |  |
| `canvas/quality-gate` | 762.8 | 776.8 | 43.6 | 43.6 | Quality Gate diamond (amber, 44px rotated) |  |
| `canvas/quality-gate-label` | 749.6 | 821 | 70 | 10 | Gate label |  |
| `canvas/group-frame-loop` | 345 | 676.8 | 767.2 | 243.6 | Group frame: quality loop (mint tint) | overflows viewport (scroll content) |
| `canvas/group-frame-label` | 361.8 | 685.2 | 328.7 | 12 | Group frame label (top-left) |  |
| `canvas/group-frame-limit` | 973.5 | 686.6 | 126.1 | 10 | Group frame limit label (top-right) |  |
| `canvas/edge-back-label` | 798.6 | 891 | 216.8 | 10 | Dashed amber return edge label | overflows viewport (scroll content) |
| `canvas/edge-active-glow` | 533.3 | 798.6 | 16.8 | 1.4 | Active edge segment (magenta glow) |  |
| `canvas/drag-chip-skill` | 120.5 | 674.6 | 165.5 | 14 | Skill chip being dragged (magenta pill, rotated -4deg) |  |
| `canvas/node-save-decisions` | 1017 | 786 | 82.6 | 25.2 | End-ish pill "zapisz Decyzje" |  |
| `canvas/validation-badge` | 949.7 | 397 | 171.3 | 28 | Validation status pill (mint) |  |
| `canvas/zoom-toolbar` | 341 | 823 | 301.7 | 50 | Zoom/undo/redo/search toolbar |  |
| `canvas/minimap` | 979 | 779 | 142 | 94 | Minimap 140x92 |  |
| `canvas/inspector` | 1150 | 162 | 290 | 738 | Right inspector 290px |  |
| `canvas/inspector-header` | 1169 | 180 | 253 | 54 | Avatar 48 + name + subtitle |  |
| `canvas/inspector-agent-state` | 1169 | 248 | 253 | 99.6 | Agent State card + evidence |  |
| `canvas/inspector-visibility` | 1169 | 361.6 | 253 | 119.4 | Visibility segmented (PUBLICZNY/PRYWATNY) + helper |  |
| `canvas/inspector-visibility-selector` | 1169 | 380.6 | 253 | 61.6 | Visibility radio-cards |  |
| `canvas/inspector-model` | 1169 | 495 | 253 | 84 | Model picker + fallback |  |
| `canvas/inspector-skills` | 1169 | 593 | 253 | 77 | Assigned Skills chips |  |
| `canvas/inspector-permissions` | 1169 | 684 | 253 | 53 | Permissions in this node |  |
| `canvas/inspector-open-chat` | 1169 | 836 | 253 | 46 | "Otwórz czat z Developerem" button |  |

**States visible in the mock**

- Workflow header: private visibility word, version badge ("v7 · opublikowana"), Run pill ("Run #14 · działa · 18 min")
- Chief supervision strip with Agent state chips (done, working, waiting for Approval, idle)
- Node states: normal, selected (violet 4px ring), working (magenta glow), waiting for Approval (amber glow), done (check), drop target (dashed magenta + "upuść → 1 skill")
- Node kinds: start, Agent (public/private), Join, Discussion (lavender), Loop frame "Pętla jakości", Quality Gate, Review, save Decisions
- Edges: normal, active glow, labelled dashed return edge (amber)
- Validation footer "Walidacja: 0 błędów"
- Inspector with visibility selector ("tylko tutaj" selected), permission tags

**States NOT shown (implementers design them from the design-system rules)**

- Empty canvas (new Workflow), no Node selected (Inspector empty state)
- Validation errors and warnings on Nodes and in the footer
- Edit mode (v8 draft) vs read-only published mode; unsaved changes
- Run finished / failed / cancelled on the canvas
- Node hover, edge hover, port hover while connecting, multi-select, context menu
- Palette item drag ghost; skill drop rejected
- Minimap viewport drag; zoom limits
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Canvas` · `Runy i Activity` · `Zainstalowane Skille` · `7` · `Szukaj Skilla` · `Upuść na zakładkę ze Skillami w prawym górnym rogu kafelka.` · `grill-me` · `v3` · `PUBLICZNY` · `3 agentów` · `TypeScript` · `v4` · `2 agentów` · `tdd` · `v2` · `security-audit` · `v1` · `PRYWATNY` · `1 agent` · `user-stories` · `ui-review` · `review-rubric v1` · `przeciągasz na Senior Reviewera` · `Węzły` · `Agent` · `Parallel` · `Join` · `IF` · `Loop` · `Dyskusja` · `Review` · `Dostarczanie funkcji` · `v7 · opublikowana` · `Run #14 · działa · 18 min` · `Dry-run` · `Pauza runu` · `Edytuj jako v8` · `C` · `Chief nadzoruje` · `6 agentów · 3 z 3 slotów` · `PO` · `Product Owner` · `skończył` · `Ds` · `Designer` · `Developer` · `pracuje` · `Security` · `czeka na Zgodę` · `SR` · `Senior Reviewer` · `czeka` · `ZAKŁADKA NA KAFELKU` · `we wszystkich Workspace'ach` · `tylko w tym Workspace` · `TOR` · `prowadzi Zadania po Tablicy` · `2 skille` · `tu upuszczasz Skille` · `start` · `✓ historie użytkownika` · `Sonnet 5.5` · `✓ makiety gotowe` · `1 skill` · `gpt-5.5` · `join · wszyscy` · `Zakres MVP` · `✓ 4 rundy · 3 decyzje` · `DYSKUSJA · GRILL-ME` · `3 decyzje → 5 Zadań na Tablicy` · `Pętla jakości · Build → QA → Review · iteracja 2 z 5` · `limit 90 min · 5 iteracji` · `✓ 4 pliki · testy 112 z 112` · `TOR · BUILD` · `Opus 5.5` · `● testy e2e 38 z 52` · `TOR · QA` · `◆ czeka na Zgodę · npmjs.org` · `Quality Gate` · `testy 100% · 0 krytycznych` · `○ czeka na Quality Gate` · `TOR · REVIEW` · `upuść → 1 skill` · `review-rubric` · `zapisz Decyzje` · `nie spełnia → wróć do Developera z raportem` · `Walidacja: 0 błędów` · `−` · `70%` · `+` · `Cofnij` · `Ponów` · `Agent stały · konfiguracja v3` · `STAN AGENTA` · `Skończył · iteracja 2 z 5` · `Dowód: 4 pliki w worktree, testy 112 z 112` · `WIDOCZNOŚĆ AGENTA` · `tylko tutaj` · `W tym Workflow działa jako` · `TOR · Build` · `: każde Zadanie przechodzi przez niego na Tablicy.` · `MODEL` · `Claude Code · Opus 5.5` · `Zapasowy: Codex CLI · gpt-5.5` · `SKILLE · 2` · `TypeScript v4` · `tdd v2` · `UPRAWNIENIA W TYM WĘŹLE` · `Zapis:` · `src/` · `,` · `tests/` · `· Terminal: tak` · `Sieć: nie · git push: wymaga Zgody` · `Otwórz czat z Developerem` · `@Sekcje` · `@Skille i Węzły` · `ph:Szukaj Skilla` · `@PUBLICZNY: Product Owner` · `@PUBLICZNY: Designer` · `@Join: wszyscy` · `@DYSKUSJA · GRILL-ME: Zakres MVP` · `@TOR · BUILD: Developer` · `@TOR · QA: QA` · `@PRYWATNY: Security` · `@TOR · REVIEW: Senior Reviewer` · `@Widok` · `@Pomniejsz` · `@Powiększ` · `@Szukaj Węzła` · `@Minimapa` · `@Inspektor Agenta` · `@Widoczność Agenta`

---

## 7. Task Board  (`Tablica`)

- **File**: `source/Tablica.dc.html`, render `views/Tablica.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: Task Board with five Lanes from the "board" Workflow plus a detail panel for the selected Task, showing provenance in the project Documentation and evidence.

**Owner-facing functions**

- Filter tasks: all, Owner's Approvals, blocked, parked
- Read the Lanes (Do zrobienia, Build, QA, Review, Gotowe) and open a Task
- See per-Task state: working, queued, waiting for Approval, reviewing, done; assignee Agent
- View Task details: Documentation fragment, origin Decision, history, evidence artifacts
- Open a chat with the assigned Agent ("Czat z QA"); park a Task ("Odłóż")
- Expand older done Tasks ("Pokaż 5 starszych")

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 224 | 44 | 44 | Active rail item |  |
| `board/main` | 72 | 117 | 1048 | 783 | Board main |  |
| `board/header` | 92 | 135 | 1008 | 96 | Title row with filters (wraps: New Task button drops to row 2) |  |
| `board/title` | 92 | 142.5 | 171.1 | 31 | Title 26/700 |  |
| `board/lanes-source-badge` | 273.1 | 147.5 | 188.2 | 21 | Badge "Tory z Workflow „board” v3" |  |
| `board/filter-segmented` | 690.5 | 135 | 293.5 | 46 | Segmented filter |  |
| `board/deferred-button` | 993.9 | 138 | 106.1 | 40 | Secondary w/ count |  |
| `board/new-task-button` | 92 | 191 | 204.7 | 40 | Violet primary |  |
| `board/lanes` | 92 | 247 | 1008 | 505.3 | Lane row (horizontal scroll, 5 Lanes) |  |
| `board/lane-todo` | 92 | 247 | 192 | 499.3 | Lane column: To do (with hint) |  |
| `board/lane-build` | 296 | 247 | 192 | 344.6 | Lane column: Build |  |
| `board/lane-qa-active` | 500 | 247 | 192 | 450.6 | Lane column: QA (magenta tint = active Lane) |  |
| `board/lane-review` | 704 | 247 | 192 | 188.8 | Lane column: Review |  |
| `board/lane-done` | 908 | 247 | 192 | 382.6 | Lane column: Done (with "show older" button) |  |
| `board/lane-header-qa` | 513 | 260 | 166 | 19 | Lane header: title + count pill |  |
| `board/lane-hint` | 105 | 289 | 166 | 28 | Lane hint text |  |
| `board/task-card-unassigned` | 105 | 327 | 166 | 147.7 | TaskCard: unassigned (T-35) |  |
| `board/task-card-working-progress` | 309 | 289 | 166 | 145.8 | TaskCard: working, progress bar, assignee |  |
| `board/task-card-queued` | 309 | 444.8 | 166 | 133.8 | TaskCard: queued |  |
| `board/task-card-selected` | 513 | 289 | 166 | 145.8 | TaskCard: selected (violet 1.5px + 4px ring), progress 73% |  |
| `board/task-card-waiting-approval` | 513 | 444.8 | 166 | 114.9 | TaskCard: waiting for Approval (amber label) |  |
| `board/task-card-reviewing` | 717 | 289 | 166 | 133.8 | TaskCard: in review |  |
| `board/task-card-done-gate` | 921 | 289 | 166 | 133.8 | TaskCard: done (mint "Quality Gate") |  |
| `board/task-card-done-accepted` | 921 | 432.8 | 166 | 133.8 | TaskCard: done (mint "zaakceptowane") |  |
| `board/show-older-button` | 921 | 576.6 | 166 | 40 | Dashed text button |  |
| `board/task-inspector` | 1120 | 117 | 320 | 783 | Task inspector 320px |  |
| `board/task-inspector-title` | 1141 | 166 | 279 | 50 | Task title 20/700 lh 1.25 |  |
| `board/task-inspector-doc-ref` | 1141 | 232 | 279 | 115.2 | Documentation reference card (quote) |  |
| `board/task-inspector-origin` | 1141 | 363.2 | 279 | 33 | Origin (link to Discussion/Decision) |  |
| `board/task-inspector-timeline` | 1141 | 412.2 | 279 | 118 | Timeline ("PRZEBIEG"): coloured dots + text |  |
| `board/task-inspector-evidence` | 1141 | 546.2 | 279 | 47 | Evidence/Artifacts chips |  |
| `board/task-inspector-actions` | 1141 | 834 | 279 | 46 | Open chat (outlined violet) + Defer (secondary) |  |

**States visible in the mock**

- Filter chips with counts ("Odłożone · 1"); active filter "Wszystkie"
- Task card states: unassigned, working (magenta), queued, waiting for Approval (amber), reviewing, done with Quality Gate tick; selected card T-31
- Lane header with count and hint line

**States NOT shown (implementers design them from the design-system rules)**

- Empty Lane, empty board
- Drag-and-drop of cards between Lanes (Chief assigns; define whether the Owner may drag)
- Loading, error
- Selected Task none: detail panel empty state
- Card hover/focus, long titles wrapping
- Parked Tasks view
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Tablica Zadań` · `Tory z Workflow „board” v3` · `Wszystkie` · `Moje Zgody` · `Zablokowane` · `Odłożone · 1` · `Zadanie z Dokumentacji` · `Do zrobienia` · `4` · `Chief rozdziela, gdy zwolni się slot` · `T-35` · `Powiadomienia mailowe o rezerwacji` · `spec.md#powiadomienia` · `nieprzypisane` · `T-36` · `Eksport kalendarza do .ics` · `spec.md#kalendarz` · `T-37` · `Strona regulaminu` · `docs/prawne.md#regulamin` · `Build` · `2` · `T-33` · `pracuje` · `Formularz danych gościa` · `spec.md#rezerwacja` · `Developer` · `T-34` · `w kolejce` · `Walidacja dat przyjazdu` · `3` · `T-31` · `testy 38 z 52` · `Koszyk z kodami rabatowymi` · `spec.md#koszyk` · `T-30` · `czeka na Zgodę` · `Audyt zależności` · `reguly.md#R2` · `Security` · `T-29` · `Widok listy pokoi` · `spec.md#pokoje` · `Review` · `1` · `T-28` · `ocenia` · `Logowanie przez e-mail` · `spec.md#konto` · `SR` · `Senior Reviewer` · `Gotowe` · `7` · `T-27` · `✓ Quality Gate` · `Model danych rezerwacji` · `spec.md#model` · `T-26` · `✓ zaakceptowane` · `Makiety ekranu płatności` · `spec.md#platnosci` · `Ds` · `Designer` · `Pokaż 5 starszych` · `T-31 · tor QA` · `WYNIKA Z DOKUMENTACJI` · `docs/spec.md#koszyk` · `„Kod rabatowy obniża cenę przed podatkiem i nie łączy się z innymi promocjami.”` · `POCHODZENIE` · `Dyskusja „Zakres MVP” · Decyzja D-12` · `PRZEBIEG` · `Build · Developer · 4 pliki · 12:10` · `Quality Gate nie przeszedł · wróciło do Build · 12:52` · `Build · iteracja 2 · 13:40` · `QA · testy e2e 38 z 52 · teraz` · `DOWODY · ARTEFAKTY` · `unit-report.xml` · `e2e-trace.zip` · `Czat z QA` · `Odłóż` · `@Filtr` · `@Tor Do zrobienia` · `@Tor Build` · `@Tor QA` · `@Tor Review` · `@Tor Gotowe` · `@Szczegóły Zadania`

---

## 8. Live Discussion  (`Dyskusja`)

- **File**: `source/Dyskusja.dc.html`, render `views/Dyskusja.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: A multi-Agent Discussion moderated by Chief with rounds. The Owner can speak in it. The result is a proposed Decision and the Tasks that follow after approval.

**Owner-facing functions**

- Switch between running and finished Discussions
- Pause the Discussion ("Wstrzymaj")
- Add the Owner's voice ("Twój głos w Dyskusji")
- Read positions per Agent (preference chip and Skill used) and the draft result
- Approve the result ("Zatwierdź wynik") or end now ("Zakończ teraz")

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 124 | 44 | 44 | Active rail item |  |
| `disc/list` | 72 | 117 | 260 | 783 | Discussions list (260px) |  |
| `disc/list-heading` | 92 | 133 | 219 | 19 | Heading |  |
| `disc/list-section-label-live` | 92 | 168 | 219 | 17 | "TRWAJĄ" label |  |
| `disc/list-item-live-selected` | 84 | 193 | 235 | 55 | Discussion row: live, selected |  |
| `disc/list-section-label-done` | 92 | 266 | 219 | 17 | "ZAKOŃCZONE" label |  |
| `disc/list-item-finished` | 84 | 291 | 235 | 55 | Discussion row: finished (grey dot) |  |
| `disc/main` | 332 | 117 | 798 | 783 | Main column |  |
| `disc/header` | 332 | 117 | 798 | 129 | Title + live pill + Pause; agenda/round meta |  |
| `disc/title` | 356 | 140 | 365.2 | 26 | Title 22/700 |  |
| `disc/live-pill` | 731.2 | 139 | 84.6 | 28 | Live pill (magenta) |  |
| `disc/pause-button` | 1008.7 | 133 | 97.3 | 40 | Secondary 40px |  |
| `disc/meta-row` | 356 | 183 | 750 | 46 | Agenda · round progress · Run state |  |
| `disc/round-progress` | 722.2 | 188 | 120 | 6 | Segmented round progress (4 x 6px) |  |
| `disc/thread` | 332 | 246 | 798 | 550 | Message thread (max-width 820) |  |
| `disc/notice-chief-initiated` | 356 | 268 | 750 | 63.7 | Notice: Chief started this Discussion (bell icon) |  |
| `disc/msg-moderator` | 356 | 351.7 | 750 | 66.4 | DiscussionMessage: Chief moderator |  |
| `disc/msg-participant-stance` | 356 | 438.1 | 750 | 70.4 | DiscussionMessage: participant + stance pill (mint) + Skill chip |  |
| `disc/msg-participant-no-pref` | 356 | 528.4 | 750 | 70.4 | DiscussionMessage: stance pill grey |  |
| `disc/msg-participant-conditional` | 356 | 618.8 | 750 | 70.4 | DiscussionMessage: stance pill amber |  |
| `disc/composer` | 332 | 796 | 798 | 104 | Owner-voice composer |  |
| `disc/positions-panel` | 1130 | 117 | 310 | 783 | Right panel 310px |  |
| `disc/positions-list` | 1151 | 170 | 269 | 48 | Stance row 1 (PO, mint) |  |
| `disc/outcome-draft` | 1151 | 397 | 269 | 245.1 | Outcome draft card (dashed violet): Decision + Tasks after approval |  |
| `disc/tiebreak-note` | 1151 | 773.8 | 269 | 52.2 | No-agreement rule note |  |
| `disc/outcome-actions` | 1151 | 840 | 269 | 40 | Approve outcome (violet) + End now (secondary) |  |

**States visible in the mock**

- Live badge ("na żywo"), round counter, agenda, link to paused Run branch
- Message cards: Chief (moderator), Agents with position chip (Przelewy24, bez preferencji, oba OK z warunkiem)
- Right panel: positions summary, draft Decision (proposal), Tasks after approval, fallback rule note

**States NOT shown (implementers design them from the design-system rules)**

- Agent currently typing / turn pending
- Finished Discussion read-only view
- Discussion with no consensus after the last round (the note exists but the state is not designed)
- Empty list of Discussions, loading
- Disabled "Zatwierdź wynik" until the final round
- Hover/focus; composer error
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Dyskusje` · `TRWAJĄ` · `Płatności: Stripe czy P24?` · `runda 2 z 4 · rozpoczął Chief` · `ZAKOŃCZONE` · `Zakres MVP` · `4 rundy · 3 Decyzje · 5 Zadań` · `Model danych rezerwacji` · `2 rundy · 1 Decyzja · 2 Zadania` · `Styl makiet` · `rozstrzygnął Chief · 1 Decyzja` · `Płatności: Stripe czy Przelewy24?` · `na żywo` · `Wstrzymaj` · `Agenda: wybór bramki płatności dla MVP` · `·` · `Runda 2 z 4` · `Run #14 wstrzymany w gałęzi „Płatności”, reszta pracuje` · `Chief rozpoczął tę Dyskusję sam, bo Dokumentacja nie mówi,` · `czym` · `płacą goście. To pytanie „co”, więc wynik zatwierdzasz Ty.` · `C` · `Chief` · `moderator · runda 2` · `Podsumowanie rundy 1: PO chce BLIK-a i szybkich przelewów, Security zwraca uwagę na zakres PCI. Proszę o stanowiska z kosztem wdrożenia.` · `PO` · `Product Owner` · `runda 2` · `Przelewy24` · `skill: user-stories v2` · `Nasi goście są głównie z Polski. Przelewy24 daje BLIK i szybkie przelewy w jednej integracji. Bez BLIK-a stracimy część rezerwacji z telefonu.` · `Developer` · `bez preferencji` · `skill: TypeScript v4` · `Stripe ma lepsze SDK i webhooki, wdrożenie około 2 dni. Przelewy24 to około 4 dni, ale też obsługuje BLIK. Oba są do zrobienia w MVP.` · `Security` · `oba OK z warunkiem` · `skill: security-audit v1` · `Oba rozwiązania trzymają dane kart poza naszym serwerem, zakres PCI to SAQ A. Warunek: tylko przekierowanie lub hostowany formularz, bez własnych pól na kartę.` · `Twój głos w Dyskusji` · `Stanowiska` · `oba, z warunkiem` · `Szkic wyniku` · `DECYZJA (PROPOZYCJA)` · `Przelewy24 z formularzem hostowanym` · `ZADANIA PO ZATWIERDZENIU` · `Integracja Przelewy24 · spec.md#platnosci` · `Webhook statusu płatności · spec.md#platnosci` · `Test penetracyjny formularza · reguly.md#R2` · `Brak porozumienia po 4 rundach: Chief rozstrzyga w granicach Budżetu i Dokumentacji albo przekazuje Tobie.` · `Zatwierdź wynik` · `Zakończ teraz` · `@Dyskusje` · `ph:Twój głos w Dyskusji rozstrzyga…` · `@Wyślij` · `@Stanowiska i wynik`

Textarea value: `…`

---

## 9. Decision Register  (`Decyzje`)

- **File**: `source/Decyzje.dc.html`, render `views/Decyzje.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: Append-only register of Decisions with search and filters, plus a detail panel with problem, alternatives, rationale, risks, outcome and the Owner's verdict.

**Owner-facing functions**

- Search and filter (Workspace, status, outcome)
- Open a Decision and read alternatives, rationale, participants, Skills, confidence, assumptions, risks, evidence
- Record the Owner's verdict on the outcome (pozytywny / mieszany / nieznany / negatywny)
- Supersede a Decision with a new one ("Zastąp nową Decyzją")
- Follow links to superseded / superseding Decisions

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 274 | 44 | 44 | Active rail item |  |
| `decis/list` | 72 | 117 | 400 | 783 | Decision list column (400px) |  |
| `decis/list-title` | 88 | 135 | 367 | 29 | Title 24/700 |  |
| `decis/list-subtitle` | 88 | 174 | 367 | 30 | Append-only explanation |  |
| `decis/search` | 88 | 214 | 367 | 44 | Search input 42px |  |
| `decis/filter-chips` | 88 | 268 | 367 | 62 | Filter chips (Workspace / Status / Outcome) |  |
| `decis/filter-chip-active` | 88 | 268 | 173.7 | 28 | Chip: active filter (violet surface) |  |
| `decis/list-items` | 88 | 340 | 367 | 525 | DecisionRow list |  |
| `decis/list-item-selected` | 88 | 340 | 367 | 83 | DecisionRow: selected, accepted, outcome positive |  |
| `decis/list-item-proposal` | 88 | 425 | 367 | 100 | DecisionRow: proposed, outcome unknown |  |
| `decis/list-item-mixed` | 88 | 527 | 367 | 83 | DecisionRow: outcome mixed (amber) |  |
| `decis/list-item-needs-review` | 88 | 697 | 367 | 83 | DecisionRow: needs review (amber status) |  |
| `decis/list-item-superseded` | 88 | 782 | 367 | 83 | DecisionRow: superseded, outcome negative (red) |  |
| `decis/detail` | 472 | 117 | 968 | 783 | Decision detail (scrolls) |  |
| `decis/detail-meta-row` | 500 | 139 | 912 | 40 | ID · Workspace · Run + status pill + Replace button |  |
| `decis/status-pill` | 777.3 | 145 | 79.8 | 28 | Status pill (mint tint) |  |
| `decis/replace-button` | 1247.8 | 139 | 164.2 | 40 | Secondary 40px |  |
| `decis/detail-title` | 500 | 197 | 912 | 31 | Decision title 26/700 |  |
| `decis/problem` | 500 | 246 | 912 | 40.7 | Section label PROBLEM + text |  |
| `decis/alternatives` | 500 | 304.7 | 912 | 102.8 | Alternatives row (3 cards) |  |
| `decis/alternative-selected` | 500 | 323.7 | 298.7 | 83.8 | AlternativeCard selected (mint border + tint + "wybrana") |  |
| `decis/alternative` | 806.7 | 323.7 | 298.7 | 83.8 | AlternativeCard default |  |
| `decis/rationale` | 500 | 425.5 | 912 | 40.7 | Rationale |  |
| `decis/meta-row-participants` | 500 | 484.2 | 912 | 47 | Participants / Skills / Confidence |  |
| `decis/meta-row-assumptions` | 500 | 549.2 | 912 | 38.5 | Assumptions / Risks |  |
| `decis/outcome-card` | 500 | 605.7 | 912 | 172.5 | OutcomeCard: proposal, evidence chips, Owner verdict |  |
| `decis/verdict-buttons` | 517 | 721.2 | 878 | 40 | Owner verdict segmented (positive/mixed/unknown/negative) |  |
| `decis/supersedes-link` | 500 | 796.2 | 912 | 16 | "Zastępuje:" link row |  |

**States visible in the mock**

- Row states: accepted, proposed, for review, superseded, selected row (D-14)
- Outcome words (pozytywny, mieszany, nieznany, negatywny) with colour
- Alternatives list with chosen one marked
- Verdict segmented control with one selected
- Append-only notice

**States NOT shown (implementers design them from the design-system rules)**

- Empty register, no search results, loading
- Deleting is intentionally absent (ADR 0008): do not design it
- Proposed Decision awaiting Owner (accept / reject buttons)
- Superseded Decision detail (read-only banner)
- Hover/focus on rows, filter selects open state
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Rejestr decyzji` · `Tylko dopisywanie. Zmiana to nowa Decyzja, która zastępuje starą.` · `Szukaj w Decyzjach` · `Wszystkie Workspace'y` · `Status: każdy` · `Wynik: każdy` · `D-14` · `przyjęta` · `wynik: pozytywny` · `Biblioteka dat: date-fns zamiast moment` · `Aplikacja rezerwacji · Chief` · `D-13` · `propozycja` · `wynik: nieznany` · `Płatności: Przelewy24 z formularzem hostowanym` · `Aplikacja rezerwacji · Dyskusja` · `D-12` · `wynik: mieszany` · `Zakres MVP bez płatności ratalnych` · `Aplikacja rezerwacji · Dyskusja · Właściciel` · `D-09` · `Testy e2e w Playwright` · `Strona fundacji · Chief` · `D-07` · `do przeglądu` · `Sesje w ciasteczkach zamiast JWT` · `D-03` · `zastąpiona` · `wynik: negatywny` · `Biblioteka dat: moment` · `D-14 · Aplikacja rezerwacji · Run #11` · `Zastąp nową Decyzją` · `PROBLEM` · `Dokumentacja wymaga dat w strefie hotelu, ale nie wskazuje biblioteki. To luka „jak”, więc Chief rozstrzygnął sam.` · `ALTERNATYWY` · `date-fns` · `wybrana` · `Modułowa, mały bundle, dobre typy TypeScript.` · `moment` · `Znana zespołowi, ale w trybie utrzymania i ciężka.` · `Temporal API` · `Przyszły standard, w Safari wciąż za flagą.` · `UZASADNIENIE` · `Podobna Decyzja D-03 w „Stronie fundacji” wybrała moment i dostała wynik negatywny: bundle +230 KB i błędy stref czasowych.` · `UCZESTNICY` · `C` · `SKILLE` · `TypeScript v4` · `PEWNOŚĆ` · `średnia · 0,7` · `ZAŁOŻENIA` · `Hotele działają w jednej strefie czasowej.` · `RYZYKA` · `Przy hotelach w wielu strefach trzeba będzie dodać date-fns-tz.` · `WYNIK DECYZJI` · `Chief proponuje:` · `pozytywny` · `· przegląd 2026-11-10` · `Dowody: bundle 41 KB zamiast 271 KB, 0 błędów stref w 112 testach jednostkowych.` · `bundle-report.json` · `unit-report.xml` · `Twój werdykt:` · `mieszany` · `nieznany` · `negatywny` · `Zastępuje:` · `D-03 · Biblioteka dat: moment` · `(Strona fundacji)` · `@Lista Decyzji` · `ph:Szukaj: biblioteka dat, płatności…`

---

## 10. Agents (profile & memory)  (`Agenci`)

- **File**: `source/Agenci.dc.html`, render `views/Agenci.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900 (content taller than viewport)
- **Purpose**: Agent management: list of permanent and dynamic Agents on the left, selected Agent's configuration on the right (visibility, instructions, model, budget, Skills, tools, memory).

**Owner-facing functions**

- Browse permanent and dynamic Agents; create a new one ("Nowy")
- Accept a dynamic Agent as permanent ("Zachowaj jako stałego") or delete it ("Usuń")
- Edit instructions, models (primary + fallback), budget per Task, Skills; save as a new configuration version ("Zapisz jako v4")
- Choose Agent visibility (public / private)
- Switch profile tabs: Konfiguracja, Pamięć agenta, Historia Runów, Wersje
- Open a chat with the Agent

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 343 | 44 | 44 | Active rail item |  |
| `shell/tab-bar` | 72 | 117 | 1368 | 45 | Section tab bar |  |
| `agents/list` | 72 | 162 | 290 | 738 | Agents list (290px) |  |
| `agents/list-header` | 92 | 178 | 249 | 40 | Title + "Nowy" violet button |  |
| `agents/list-label-permanent` | 92 | 234 | 249 | 17 | "STALI · 7" label |  |
| `agents/list-row-selected` | 84 | 259 | 265 | 63 | AgentRow selected (#1A1422, violet border), PUBLICZNY outlined label |  |
| `agents/list-row-private` | 84 | 393 | 265 | 63 | AgentRow with PRYWATNY label + amber state |  |
| `agents/list-label-dynamic` | 92 | 742 | 249 | 17 | "DYNAMICZNI · CZEKAJĄ NA AKCEPTACJĘ" label |  |
| `agents/dynamic-agent-card` | 84 | 767 | 265 | 166.2 | Dynamic Agent proposal card (dashed magenta) + Keep/Delete | overflows viewport (scroll content) |
| `agents/profile` | 362 | 162 | 768 | 738 | Agent profile (scrolls) |  |
| `agents/profile-header` | 390 | 184 | 712 | 56 | Avatar 56, name, meta, Chat link, Save as v4 |  |
| `agents/profile-tabs` | 390 | 258 | 712 | 41 | Sub-tabs (violet underline) |  |
| `agents/visibility-selector` | 390 | 317 | 712 | 98 | Visibility radio-cards + helper |  |
| `agents/instructions` | 390 | 433 | 712 | 127 | Role and instructions textarea |  |
| `agents/model-row` | 390 | 578 | 712 | 61 | Model / Fallback model / Budget |  |
| `agents/skills-dropzone` | 390 | 657 | 712 | 71 | Skills assigned (dashed drop zone) |  |
| `agents/tools-table` | 390 | 746 | 712 | 205 | Tools KeyValue list (scrolls below fold) | overflows viewport (scroll content) |
| `agents/memory-panel` | 1130 | 162 | 310 | 738 | Agent Memory read-only panel (310px) |  |
| `agents/memory-item` | 1151 | 268.8 | 269 | 100.2 | MemoryEntry card (title + Workspace tag + text) |  |
| `agents/memory-isolation-note` | 1151 | 570.5 | 269 | 74.2 | Isolated-Workspace note (lock) |  |

**States visible in the mock**

- List row: avatar, name, model, visibility word, state word (skończył, pracuje, wolny, czeka)
- Selected row (Developer), dynamic Agent card awaiting acceptance
- Profile header with version line, visibility selector, textarea, model rows, Skill drop zone, tools table (intersection with the Workspace policy)
- Memory preview (read-only, "Pamięci nie edytujesz")

**States NOT shown (implementers design them from the design-system rules)**

- Empty list, loading, error
- Unsaved changes state on the "Zapisz jako v4" button (dirty / saving / saved)
- Memory tab and the other tabs' content (Historia Runów, Wersje) are not drawn
- Delete confirmation for dynamic Agent
- Textarea focus + validation; Skill dropzone hover/accept/reject
- Hover/focus on rows
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Agenci` · `Skille` · `Nowy` · `STALI · 7` · `Developer` · `PUBLICZNY` · `Claude · Opus 5.5` · `skończył` · `Codex · gpt-5.5` · `pracuje` · `Security` · `PRYWATNY` · `Claude · Sonnet 5.5` · `Zgoda` · `PO` · `Product Owner` · `wolny` · `Ds` · `Designer` · `SR` · `Senior Reviewer` · `czeka` · `Rs` · `Researcher` · `Ollama · qwen3` · `DYNAMICZNI · CZEKAJĄ NA AKCEPTACJĘ` · `Analityk cen hoteli` · `Chief stworzył go do Zadania T-22, prywatnie w tym Workspace. Po akceptacji wybierzesz, czy ma być publiczny.` · `Zachowaj jako stałego` · `Usuń` · `Agent stały · konfiguracja v3 · utworzył Właściciel` · `Czat` · `Zapisz jako v4` · `Konfiguracja` · `Pamięć agenta` · `Historia Runów` · `Wersje` · `WIDOCZNOŚĆ` · `dostępny we wszystkich Workspace'ach` · `tylko w Workspace „Aplikacja rezerwacji”` · `Pamięć agenta i tak zostaje osobno w każdym Workspace. Publiczny znaczy tylko, że możesz go użyć gdzie indziej.` · `ROLA I INSTRUKCJE` · `Instrukcje Agenta` · `Implementujesz Zadania z Tablicy w osobnym worktree. Każda zmiana ma testy. Niczego nie dodajesz poza tym, co wynika z Dokumentacji projektu.` · `MODEL` · `Claude Code · Opus 5.5` · `MODEL ZAPASOWY` · `Codex CLI · gpt-5.5` · `BUDŻET NA ZADANIE` · `45 min · 2 ponowienia` · `SKILLE · 2 · PRZYPISANE NA STAŁE` · `TypeScript v4` · `tdd v2` · `upuść tu Skill z biblioteki` · `NARZĘDZIA AGENTA · PRZECINANE Z POLITYKĄ WORKSPACE'U` · `Terminal w kontenerze` · `tak` · `Zapis plików` · `src/, tests/` · `Sieć` · `brak · Prośba o dostęp` · `git commit` · `tak, we własnym worktree` · `git push` · `wymaga Zgody` · `tylko podgląd` · `Pamięci nie edytujesz. Zachowanie Agenta korygujesz Regułami Właściciela.` · `Koszyk z rabatami` · `rezerwacje` · `Rabat liczony przed VAT. Testy na granicach kwot wyłapały 2 błędy zaokrągleń.` · `Model danych rezerwacji` · `Daty w strefie hotelu, date-fns (D-14). Migracje zawsze z rollbackiem.` · `Formularz kontaktowy` · `fundacja` · `Walidacja po stronie serwera, honeypot zamiast captchy.` · `Workspace „Projekt klienta (NDA)” jest izolowany, więc jego pamięci tu nie widać.` · `@Sekcje` · `@Agenci` · `@Sekcje Agenta` · `@Widoczność: Agent` · `@Pamięć agenta`

Textarea value: `Implementujesz Zadania z Tablicy w osobnym worktree. Każda zmiana ma testy. Niczego nie dodajesz poza tym, co wynika z Dokumentacji projektu.…`

---

## 11. Skill library  (`Skille`)

- **File**: `source/Skille.dc.html`, render `views/Skille.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: Library of installed Skills with filters by visibility and origin, a Chief proposal to accept, and a detail panel with content, versions and recent uses.

**Owner-facing functions**

- Import a Skill from a file or URL; create a new Skill
- Accept or reject a Skill proposed by Chief; view its content
- Filter by visibility (public / private) and origin (Owner, Chief, import)
- Open a Skill and read content, versions, recent uses
- Edit as a new version ("Edytuj jako v5"); detach from Agents

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 343 | 44 | 44 | Active rail item |  |
| `shell/tab-bar` | 72 | 117 | 1368 | 45 | Section tab bar |  |
| `skills/main` | 72 | 162 | 1028 | 738 | Library main |  |
| `skills/header` | 96 | 184 | 980 | 40 | Title, count, Import, New Skill |  |
| `skills/chief-proposal` | 96 | 240 | 980 | 86.4 | ProposalBanner: Chief proposes a new Skill (dashed magenta) |  |
| `skills/filter-chips` | 96 | 342.4 | 980 | 28 | Filter chips with counts (visibility + source) |  |
| `skills/filter-chip-public` | 189 | 342.4 | 115.9 | 28 | Chip: Public (blue text) |  |
| `skills/filter-chip-private` | 311 | 342.4 | 108.7 | 28 | Chip: Private (violet text) |  |
| `skills/grid` | 96 | 386.4 | 980 | 421.1 | Skill card grid (auto-fill minmax(250px,1fr)) |  |
| `skills/card` | 96 | 386.4 | 318.7 | 127.7 | SkillCard (source tag "import" amber tint) |  |
| `skills/card-selected` | 426.7 | 386.4 | 318.7 | 127.7 | SkillCard selected (violet 1.5px + ring), tag "Właściciel" |  |
| `skills/card-private-chief` | 96 | 526.1 | 318.7 | 141.7 | SkillCard PRYWATNY, source "Chief" (magenta tint) |  |
| `skills/card-source-tag` | 347.5 | 401.9 | 52.1 | 17 | Source tag |  |
| `skills/card-agent-stack` | 111 | 477.1 | 288.7 | 22 | Agent avatar stack + usage count (NOTE: collapses in mock) |  |
| `skills/inspector` | 1100 | 162 | 340 | 738 | Skill inspector 340px |  |
| `skills/inspector-header` | 1121 | 182 | 299 | 22 | Icon + mono name 18/600 |  |
| `skills/inspector-tags` | 1121 | 218 | 299 | 62 | Filled PUBLICZNY tab + version + source pills |  |
| `skills/inspector-content-preview` | 1121 | 294 | 299 | 137.9 | Markdown preview (mono 12/1.6 on #06040A) |  |
| `skills/inspector-versions` | 1121 | 470.9 | 299 | 57 | Version list |  |
| `skills/inspector-recent-uses` | 1121 | 566.9 | 299 | 147 | Recent uses (avatar rows) |  |
| `skills/inspector-actions` | 1121 | 840 | 299 | 40 | Edit as v5 (violet, grow) + Detach (secondary) |  |

**States visible in the mock**

- Chief proposal banner ("release-checklist")
- Filter chips with counts; active "Wszystkie"
- Skill cards: visibility word, origin chip, agents using, use count, assigned Agent avatars; system Skill "overmind"
- Detail panel with markdown preview, version history and usage

**States NOT shown (implementers design them from the design-system rules)**

- Empty library, loading, import error (invalid file / untrusted URL, ADR 0012)
- Import dialog / URL input (not drawn)
- Unsaved edit, new-version flow
- Detach confirmation
- Selected card state vs hover
- System Skill read-only state
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Agenci` · `Skille` · `8 zainstalowanych · publiczne działają w każdym Workspace, prywatne tylko w swoim` · `Importuj z pliku lub URL` · `Nowy Skill` · `C` · `Chief proponuje nowy Skill:` · `release-checklist` · `Ten sam proces wydania powtórzył się w 4 udanych Runach w 2 Workspace'ach. Trafi do biblioteki jako prywatny, dopiero po Twojej akceptacji.` · `Zobacz treść` · `Akceptuj` · `Odrzuć` · `Wszystkie` · `Publiczne · 6` · `Prywatne · 2` · `Właściciel · 4` · `Chief · 2` · `import · 2` · `grill-me` · `v3` · `PUBLICZNY` · `import` · `Przesłuchanie planu pytanie po pytaniu, aż znikną niejasności.` · `PO` · `Ds` · `3 agentów · 41 użyć` · `TypeScript` · `v4` · `Właściciel` · `Konwencje kodu, strict mode, bez any, testy obok plików.` · `SR` · `2 agentów · 128 użyć` · `tdd` · `v2` · `Najpierw test, potem kod. Każdy błąd dostaje test regresji.` · `2 agentów · 96 użyć` · `security-audit` · `v1` · `PRYWATNY` · `Chief` · `npm audit, sekrety w repo, nagłówki, OWASP Top 10.` · `1 agent · 18 użyć` · `user-stories` · `Historie użytkownika z kryteriami akceptacji i odnośnikiem do Dokumentacji.` · `1 agent · 22 użyć` · `e2e-playwright` · `Scenariusze e2e, trace przy błędzie, raport jako Artefakt.` · `1 agent · 57 użyć` · `ui-review` · `Przegląd makiet: kontrast, stany, dostępność.` · `1 agent · 9 użyć` · `overmind` · `Systemowy: raport postępu, Prośba o dostęp, wiadomości, Decyzje.` · `4 agentów · 412 użyć` · `v4 · aktualna` · `źródło: Właściciel` · `# TypeScript` · `- strict: true, bez any` · `- typy z kontraktów API` · `- test obok pliku: *.test.ts` · `- importy względne max 2 poziomy` · `WERSJE` · `v4 · 2026-10-02 · dodane kontrakty API` · `v3 · 2026-09-20` · `v2 · 2026-09-11` · `OSTATNIE UŻYCIA` · `Run #14 · Dostarczanie funkcji` · `Developer · v4` · `13:40` · `Senior Reviewer · v4` · `12:58` · `Run #9 · Strona fundacji` · `Developer · v3` · `wczoraj` · `Edytuj jako v5` · `Odłącz od agentów` · `@Sekcje` · `@Szczegóły Skilla`

---

## 12. Approvals & Access Requests  (`Zgody`)

- **File**: `source/Zgody.dc.html`, render `views/Zgody.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: Inbox of everything waiting for the Owner: Approvals, Access Requests and escalations, with a detailed review pane (command, changes, evidence, preview of the change).

**Owner-facing functions**

- Review waiting items grouped as Waiting, Escalations, Resolved today
- Approve once ("Zezwól tym razem"), approve permanently in this Workspace ("Zezwalaj na git push w tym Workspace"), or deny with a comment ("Odmów z komentarzem")
- Inspect the command, changed files (+14/−3), evidence (tests) and a diff preview
- See origin: Run, Workflow version, Node, Agent

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `appr/list` | 72 | 117 | 360 | 783 | Pending list (360px) |  |
| `appr/list-title` | 90 | 135 | 323 | 29 | Title 24/700 |  |
| `appr/list-label-pending` | 86 | 201 | 331 | 11 | "OCZEKUJĄ · 3" |  |
| `appr/list-item-approval-selected` | 86 | 220 | 331 | 93.9 | RequestRow: Approval, selected (amber square marker) |  |
| `appr/list-item-approval` | 86 | 321.9 | 331 | 93.9 | RequestRow: Approval |  |
| `appr/list-item-access-request` | 86 | 423.8 | 331 | 93.9 | RequestRow: Access Request (magenta marker) |  |
| `appr/list-item-escalation` | 86 | 562.7 | 331 | 112.8 | RequestRow: Escalation (red marker) |  |
| `appr/list-resolved` | 86 | 720.5 | 331 | 72 | Resolved today list (check/cross lines) |  |
| `appr/detail` | 432 | 117 | 1008 | 783 | Detail |  |
| `appr/detail-meta` | 460 | 139 | 952 | 14 | Kind label (amber) + run context |  |
| `appr/detail-heading` | 460 | 171 | 952 | 50 | Avatar 48 + title + description |  |
| `appr/detail-facts` | 460 | 239 | 952 | 60 | 3 KeyValue tiles: Command / Changes / Evidence |  |
| `appr/diff-preview` | 460 | 336 | 952 | 178.7 | DiffView (mono 12/1.7, add/del/context lines) |  |
| `appr/decision-panel` | 460 | 532.7 | 952 | 115.4 | ApprovalDecisionPanel: 3 actions + policy note (amber) |  |
| `appr/decision-action-primary` | 479 | 551.7 | 165.2 | 46 | Amber filled 46px |  |

**States visible in the mock**

- List item kinds: ZGODA · GIT PUSH, ZGODA · NOWA DOMENA, PROŚBA O DOSTĘP, ESKALACJA · LIMIT PĘTLI with age
- Selected item (git push), resolved items with tick/cross and reason
- Detail pane with key-value list, diff preview, three actions, footnote about permanent removal of the requirement

**States NOT shown (implementers design them from the design-system rules)**

- Empty inbox ("Agent czeka, reszta pracuje dalej" subtitle exists, empty state does not)
- Escalation detail (no pane drawn), Access Request detail (folder rights choice for read/write/execute)
- Item expired / decided elsewhere (Telegram) conflict
- Deny-with-comment dialog; confirmation of permanent approval
- Loading, error, hover/focus on list items and actions
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Zgody i Prośby` · `Agent czeka, reszta pracuje dalej.` · `OCZEKUJĄ · 3` · `ZGODA · GIT PUSH` · `Run #14 · 3 min` · `Wypchnięcie gałęzi dev/cart-discounts` · `Developer` · `ZGODA · NOWA DOMENA` · `Run #14 · 9 min` · `Dostęp do registry.npmjs.org` · `Security` · `PROŚBA O DOSTĘP` · `Run #14 · 12 min` · `Odczyt ~/Projects/shared-ui` · `Ds` · `Designer` · `ESKALACJE` · `ESKALACJA · LIMIT PĘTLI` · `wczoraj` · `Strona fundacji: Quality Gate nie przeszedł 5 razy` · `C` · `Chief` · `ROZSTRZYGNIĘTE DZIŚ` · `✓ git push dev/login · Developer · z desktopu` · `✓ Prośba: ~/Downloads/brief.pdf · tylko Run #13 · z Telegrama` · `✗ usunięcie tests/legacy/ · QA` · `ZGODA · GIT PUSH · DOMYŚLNA LISTA ZGÓD` · `Run #14 · Dostarczanie funkcji v7 · węzeł Developer` · `Developer chce wysłać 2 commity na` · `origin` · `, żeby Senior Reviewer mógł otworzyć PR.` · `POLECENIE` · `git push origin dev/cart-discounts` · `ZMIANY` · `2 pliki ·` · `+14` · `−3` · `DOWODY` · `testy 112 z 112` · `PODGLĄD ZMIANY` · `@@ src/cart/discount.ts` · `- return price - code.amount` · `+ const net = price / (1 + vat)` · `+ return round2((net - code.amount) * (1 + vat))` · `@@ tests/cart/discount.test.ts` · `+ it("applies code before VAT", () => {` · `+ expect(applyCode(123, code10)).toBe(110.70)` · `Zezwól tym razem` · `Zezwalaj na git push w tym Workspace` · `Odmów z komentarzem` · `Stałe zdjęcie wymogu Zgody zmienia Reguły Właściciela i jest możliwe tylko tutaj, przy komputerze. Z Telegrama zatwierdzasz wyłącznie ten Run.` · `@Oczekujące`

---

## 13. Activity & Run trace  (`Activity`)

- **File**: `source/Activity.dc.html`, render `views/Activity.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900 (content taller than viewport)
- **Purpose**: Run history and observability: Run list, a timeline trace of Nodes, an event log, subscription usage per CLI and reproducibility pinning.

**Owner-facing functions**

- Pick a Run from the list (running, finished, cancelled, escalated)
- Replay events, export a report, cancel a Run
- Read the Gantt-like trace per Node and iteration
- Filter events by Agent and "tylko błędy i blokady"
- Read CLI limit usage and per-Agent time; see pinned versions for reproducibility

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 174 | 44 | 44 | Active rail item |  |
| `shell/tab-bar` | 72 | 117 | 1368 | 45 | Section tab bar |  |
| `activity/runs-list` | 72 | 162 | 250 | 738 | Runs list (250px) |  |
| `activity/run-row-selected` | 84 | 216 | 225 | 73 | RunRow selected (running) |  |
| `activity/run-row-done` | 84 | 293 | 225 | 73 | RunRow: finished (mint) |  |
| `activity/run-row-cancelled` | 84 | 370 | 225 | 73 | RunRow: cancelled (grey) |  |
| `activity/run-row-escalated` | 84 | 447 | 225 | 73 | RunRow: escalated (red) |  |
| `activity/main` | 322 | 162 | 818 | 738 | Run detail + Activity |  |
| `activity/run-header` | 346 | 184 | 770 | 90 | Run title, state pill, Replay / Export / Cancel |  |
| `activity/run-state-pill` | 709.1 | 190 | 142.4 | 28 | Pill "działa · 18 min" |  |
| `activity/trace` | 346 | 292 | 770 | 397 | Run trace (Gantt) card |  |
| `activity/trace-axis` | 363 | 309 | 736 | 17 | Time axis 0..20 min |  |
| `activity/trace-row-done` | 363 | 336 | 736 | 30 | TraceRow: done (mint bar + check) |  |
| `activity/trace-row-failed` | 363 | 540 | 736 | 30 | TraceRow: failed (red bar + "✗ 2 testy") |  |
| `activity/trace-row-running` | 363 | 608 | 736 | 30 | TraceRow: running (magenta bar + glow) |  |
| `activity/trace-row-waiting` | 363 | 642 | 736 | 30 | TraceRow: waiting for Approval (amber hatched bar) |  |
| `activity/events` | 346 | 707 | 770 | 272 | Activity events section | overflows viewport (scroll content) |
| `activity/events-header` | 346 | 707 | 770 | 28 | Heading + filter chips |  |
| `activity/events-table` | 347 | 746 | 768 | 232 | Activity table (TIME / WHO / WHAT / RESULT) | overflows viewport (scroll content) |
| `activity/events-table-head` | 347 | 746 | 768 | 33.5 | Table head (#140F20) |  |
| `activity/usage-panel` | 1140 | 162 | 300 | 738 | Usage sidebar 300px |  |
| `activity/usage-limits` | 1161 | 217 | 259 | 28 | LimitMeter: Claude Max |  |
| `activity/usage-limits-all` | 1161 | 182 | 259 | 19 | "Limity wg CLI" heading |  |
| `activity/usage-per-agent-heading` | 1161 | 405.8 | 259 | 19 | Per-Agent usage heading |  |
| `activity/usage-per-agent-row` | 1161 | 484.8 | 259 | 28 | UsageBar row (magenta bar) |  |
| `activity/reproducibility` | 1161 | 613.8 | 259 | 74 | Reproducibility KeyValue (mono) |  |

**States visible in the mock**

- Run list item states: running, finished, cancelled, escalation; selected #14
- Trace bars: done, failed (✗), waiting for Approval, current
- Event rows with result: ok, delivered, blocked by isolation, waiting for Approval, Quality Gate failed
- Usage meters per CLI; "bez limitu" for Ollama

**States NOT shown (implementers design them from the design-system rules)**

- No Runs yet, loading, error loading events
- Cancel Run confirmation
- Replay mode (playhead, speed)
- Filter select open state; empty filter result
- Finished Run: header state variants
- Hover on trace bars (tooltip with times) and rows
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Canvas` · `Runy i Activity` · `Runy` · `#14` · `działa` · `Dostarczanie funkcji v7` · `18 min · iteracja 2` · `#13` · `ukończony` · `collect · zgłoszenia` · `6 min · 4 Zadania` · `#12` · `anulowany` · `Dostarczanie funkcji v6` · `Ty · zmiana zakresu` · `#9` · `Eskalacja` · `Strona fundacji · board` · `limit 5 iteracji` · `Run #14 · Dostarczanie funkcji` · `działa · 18 min` · `Replay zdarzeń` · `Eksportuj raport` · `Anuluj Run` · `WĘZEŁ` · `0 min` · `5 min` · `10 min` · `15 min` · `20 min` · `Product Owner` · `✓` · `Designer` · `Dyskusja · Zakres MVP` · `3 decyzje` · `Developer · it. 1` · `QA · it. 1` · `Security · it. 1` · `Quality Gate · it. 1` · `✗ 2 testy` · `Developer · it. 2` · `QA · it. 2` · `Security · it. 2` · `Zgoda` · `Activity` · `Agent: wszyscy` · `tylko błędy i blokady` · `CZAS` · `KTO` · `CO` · `WYNIK` · `14:21:07` · `terminal: npx playwright test cart/` · `14:20:12` · `Security` · `sieć: registry.npmjs.org` · `czeka na Zgodę` · `14:19:40` · `wiadomość do Chiefa: pominięto testy wydajności` · `dostarczono` · `14:18:55` · `Developer` · `odczyt ~/.ssh/config` · `zablokowane · izolacja` · `14:12:03` · `git commit w worktree dev/cart-discounts` · `ok` · `14:13:30` · `Quality Gate` · `testsPassed = 96% · wymagane 100%` · `nie spełnia → Developer` · `Limity wg CLI` · `Claude Max` · `62% · reset 3 h` · `ChatGPT Pro · Codex` · `38% · reset 5 dni` · `Ollama · lokalnie` · `bez limitu` · `Wartości raportuje samo CLI. Przy 90% Chief przełącza Agentów na model zapasowy.` · `Run #14 według Agentów` · `Developer · Opus 5.5` · `9 min` · `QA · gpt-5.5` · `4 min` · `Security · Sonnet 5.5` · `1 min` · `Odtwarzalność` · `workflow v7 · przypięta` · `Developer konfig. v3` · `TypeScript v4 · tdd v2` · `claude 2.4.1 · codex 0.61` · `@Sekcje` · `@Runy` · `@Ślad Runu` · `@Zdarzenia` · `@Zużycie`

---

## 14. Workspace settings  (`Workspace`)

- **File**: `source/Workspace.dc.html`, render `views/Workspace.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900 (very tall, scrolls ~1830px)
- **Purpose**: Per-Workspace settings: allowed folders and rights, effective permissions, Owner Rules, project Documentation, isolation and budget, destructive actions.

**Owner-facing functions**

- Edit allowed folders with Read / Write / Execute rights; add a folder
- See effective permissions (intersection of Owner, Workspace, Agent) and network allow-list
- Maintain Owner Rules (edit; accept or reject Chief's proposal as R4)
- Remove consent-list exceptions (local only)
- Set Workspace isolation, private items notice, Run budget
- Delete the Workspace

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 840 | 44 | 44 | Active rail item |  |
| `shell/tab-bar` | 72 | 117 | 1368 | 45 | Section tab bar |  |
| `ws/section-nav` | 72 | 162 | 240 | 738 | Left in-page nav (240px) |  |
| `ws/section-nav-header` | 98 | 206 | 187 | 21 | Workspace name 18/700 |  |
| `ws/section-nav-item-active` | 86 | 245 | 211 | 40 | Nav item active (#1A1422) |  |
| `ws/main` | 312 | 162 | 1036 | 738 | Settings scroll column (max 980; scrolls) |  |
| `ws/dirs-section` | 340 | 184 | 980 | 317.8 | Section card: Allowed folders |  |
| `ws/dirs-table` | 362 | 261.8 | 936 | 166 | Allowed folders table with checkbox matrix |  |
| `ws/dirs-row-expired` | 362 | 383.3 | 936 | 44 | Row with expired Telegram grant (amber note) |  |
| `ws/dirs-add-button` | 361 | 440.8 | 140 | 40 | Secondary w/ plus icon |  |
| `ws/perms-section` | 340 | 517.8 | 980 | 303.8 | Section card: Permissions |  |
| `ws/perms-row-on` | 362 | 595.7 | 936 | 51 | ToggleRow ON (label + mono value + switch) |  |
| `ws/perms-row-off` | 362 | 748.7 | 936 | 51 | ToggleRow OFF |  |
| `ws/rules-section` | 340 | 837.7 | 980 | 470.1 | Section card: Owner Rules | overflows viewport (scroll content) |
| `ws/rule-row` | 361 | 914.5 | 938 | 66 | OwnerRuleRow (R1, text, Edit) | overflows viewport (scroll content) |
| `ws/rule-row-invoked` | 361 | 992.5 | 938 | 71.3 | OwnerRuleRow with "last invoked" note | overflows viewport (scroll content) |
| `ws/rule-proposal` | 361 | 1153.8 | 938 | 70 | ProposalBanner: Chief proposes rule R4 | overflows viewport (scroll content) |
| `ws/consent-exceptions` | 361 | 1239.8 | 938 | 47 | Default-consent exceptions chips + "+ remove requirement" | overflows viewport (scroll content) |
| `ws/docs-section` | 340 | 1323.8 | 980 | 151.8 | Section card: Project documentation (file chips) | overflows viewport (scroll content) |
| `ws/isolation-section` | 340 | 1491.7 | 980 | 340.8 | Section card: Isolation and budget | overflows viewport (scroll content) |
| `ws/isolation-private-items-row` | 362 | 1628.5 | 936 | 59 | Private-items summary ("1 Agent · 2 Skille · 3 Workflow") | overflows viewport (scroll content) |
| `ws/delete-workspace-row` | 361 | 1741.5 | 938 | 70 | DangerZone row: delete Workspace | overflows viewport (scroll content) |

**States visible in the mock**

- Side section list: Workspace, Dozwolone katalogi, Uprawnienia, Reguły Właściciela, Dokumentacja projektu, Izolacja i budżet
- Folder table with checkbox cells, expired grant ("wygasło"), origin text
- Rule rows (R1-R3) with invoked-recently line; Chief proposal card; consent exceptions as removable chips
- Docs file list; isolation toggle; destructive row with outline-danger button

**States NOT shown (implementers design them from the design-system rules)**

- Add-folder flow, remove-folder confirmation
- Rule edit mode, rule conflict with Documentation
- Delete Workspace confirmation dialog (typed name)
- Save / dirty state for the page (no explicit save button drawn)
- Empty rule list / empty consent exceptions
- Section nav active-on-scroll state
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Ten Workspace` · `Połączenia i modele` · `Aplikacja` · `Workspace` · `Dozwolone katalogi` · `Uprawnienia` · `Reguły Właściciela` · `Dokumentacja projektu` · `Izolacja i budżet` · `Tylko te katalogi są zamontowane w kontenerze Agentów. Pusta lista to brak dostępu.` · `KATALOG` · `ODCZYT` · `ZAPIS` · `WYKONYWANIE` · `DODANY` · `kreator · przy komputerze` · `~/Projects/shared-ui` · `Prośba Designera · przy komputerze` · `~/Downloads/brief.pdf` · `z Telegrama · tylko Run #13 · wygasło` · `Dodaj katalog` · `Efektywne uprawnienia to przecięcie Twoich, Workspace'u, Agenta, Workflow i Narzędzia.` · `Terminal w kontenerze` · `dozwolony` · `Sieć` · `tylko: github.com, npmjs.org` · `Git` · `commit tak · push za Zgodą` · `Serwery MCP` · `brak` · `Obowiązują wszystkich i niczym ich nie osłabisz. Zmienia je tylko Właściciel.` · `R1` · `Wszystko wynika z Dokumentacji projektu. Agenci niczego nie dorzucają od siebie.` · `Edytuj` · `R2` · `Wszystko ma być przetestowane, test penetracyjny po każdym Zadaniu.` · `Ostatnio powołany: QA odmówił wyłączenia testu · 14:21` · `R3` · `Bez płatnych usług zewnętrznych bez mojej Zgody.` · `C` · `Chief proponuje:` · `„Testy wydajności tylko przed wydaniem”` · `, bo pominąłeś je 2 razy.` · `Dodaj jako R4` · `Odrzuć` · `WYJĄTKI OD DOMYŚLNEJ LISTY ZGÓD · TYLKO LOKALNIE` · `git push: wymaga Zgody` · `usuwanie plików: wymaga Zgody` · `nowa domena: wymaga Zgody` · `+ zdejmij wymóg` · `Pliki Markdown w repozytorium. Każde Zadanie musi wskazywać miejsce, z którego wynika.` · `docs/spec.md` · `docs/prawne.md` · `docs/reguly.md` · `docs/adr/` · `Git · main @ 4f2c9a1 · 14 Zadań wskazuje te pliki` · `Ustawienia, które dotyczą całego Workspace'u.` · `Workspace izolowany` · `Decyzje i Pamięć nie wychodzą poza ten Workspace, a wszystko, co tu powstanie, jest prywatne.` · `Prywatne w tym Workspace` · `Niewidoczne w innych Workspace'ach. Zmienisz to na kafelku albo w profilu.` · `1 Agent · 2 Skille · 3 Workflow` · `Budżet Runu` · `90 min · 5 iteracji pętli` · `Usuń Workspace` · `Kasuje jego Decyzje, Tablicę i Pamięć agentów z tego Workspace'u. Pliki projektu zostają na dysku.` · `Usuń Workspace…` · `@Sekcje` · `@Sekcje Workspace'u` · `@Dozwolone katalogi` · `@odczyt ~/Projects/aplikacja-rezerwacji` · `@zapis ~/Projects/aplikacja-rezerwacji` · `@wykonywanie ~/Projects/aplikacja-rezerwacji` · `@odczyt ~/Projects/shared-ui` · `@zapis ~/Projects/shared-ui` · `@wykonywanie ~/Projects/shared-ui` · `@odczyt ~/Downloads/brief.pdf` · `@zapis ~/Downloads/brief.pdf` · `@wykonywanie ~/Downloads/brief.pdf` · `@Uprawnienia` · `@Terminal w kontenerze` · `@Sieć` · `@Git` · `@Serwery MCP` · `@Reguły Właściciela` · `@Dokumentacja projektu` · `@Izolacja i budżet` · `@Workspace izolowany`

---

## 15. Connections & models  (`Polaczenia`)

- **File**: `source/Polaczenia.dc.html`, render `views/Polaczenia.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900 (content taller than viewport)
- **Purpose**: Installation-wide connections: official CLIs (Claude Code, Codex), Ollama, Telegram, API keys (post-MVP), model fallback order and parallelism.

**Owner-facing functions**

- See the login state, plan, limit, models and which Agents use each CLI
- Open the CLI terminal, log out ("Wyloguj")
- Pull an Ollama model, check the connection
- Re-pair or disconnect Telegram ("Nowy kod parowania", "Rozłącz")
- Read the fallback order at 90% of limit; set the number of parallel Agents (stepper − / +)

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 840 | 44 | 44 | Active rail item |  |
| `shell/tab-bar` | 72 | 117 | 1368 | 45 | Section tab bar |  |
| `conn/main` | 72 | 162 | 1048 | 738 | Main |  |
| `conn/page-header` | 100 | 184 | 992 | 51 | Title + subtitle |  |
| `conn/card-grid` | 100 | 253 | 992 | 684 | ConnectionCard grid (auto-fill minmax(330px,1fr)) | overflows viewport (scroll content) |
| `conn/card-claude` | 100 | 253 | 489 | 276 | ConnectionCard: Claude Code (logged in) |  |
| `conn/card-header` | 119 | 272 | 451 | 42 | Card header: icon tile + name + status |  |
| `conn/card-status` | 483.8 | 286 | 86.3 | 14 | Status (dot + word) |  |
| `conn/card-kv` | 119 | 326 | 451 | 132 | KeyValueList (label left, mono value right) |  |
| `conn/card-actions` | 119 | 470 | 451 | 40 | Card actions (secondary buttons) |  |
| `conn/card-codex` | 603 | 253 | 489 | 276 | ConnectionCard: Codex CLI |  |
| `conn/card-ollama` | 100 | 543 | 489 | 243 | ConnectionCard: Ollama |  |
| `conn/card-telegram` | 603 | 543 | 489 | 243 | ConnectionCard: Telegram (paired; danger action "Rozłącz") |  |
| `conn/card-api-disabled` | 100 | 800 | 489 | 137 | ConnectionCard: disabled (opacity .55, "po MVP") | overflows viewport (scroll content) |
| `conn/fallback-panel` | 1120 | 162 | 320 | 738 | Right panel 320px |  |
| `conn/fallback-order` | 1141 | 268.7 | 279 | 170 | Reorderable fallback list (grip + index) |  |
| `conn/concurrency` | 1141 | 495.7 | 279 | 62 | NumberStepper "Agenci naraz" |  |
| `conn/compliance-note` | 1141 | 799.8 | 279 | 78.2 | Amber notice (CLI automation vs provider terms) |  |

**States visible in the mock**

- Connection card states: logged in (mint), running locally, paired, disabled ("po MVP", "niedostępne w tej wersji")
- Fallback order numbered list 1-4
- Stepper for concurrency

**States NOT shown (implementers design them from the design-system rules)**

- CLI not installed / not logged in / expired login / limit reached
- Checking connection (spinner), Ollama unreachable
- Pairing code display (the dialog with code)
- Logout confirmation
- Min/max reached disabled stepper
- Hover/focus
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Ten Workspace` · `Połączenia i modele` · `Aplikacja` · `Logujesz się w samym CLI, w terminalu Overmind. Overmind nie widzi haseł ani tokenów.` · `>_` · `Claude Code` · `oficjalne CLI · claude 2.4.1` · `zalogowany` · `Plan` · `Claude Max` · `Limit wg CLI` · `62% · reset za 3 h` · `Modele` · `Opus 5.5, Sonnet 5.5, Haiku 5.5` · `Używa` · `Chief, Developer, Security, PO, Senior Rev.` · `Otwórz terminal CLI` · `Wyloguj` · `Codex CLI` · `oficjalne CLI · codex 0.61` · `ChatGPT Pro` · `38% · reset za 5 dni` · `gpt-5.5, gpt-5.5-mini` · `QA, Designer` · `OL` · `Ollama` · `lokalnie · model zapasowy` · `działa` · `Adres` · `localhost:11434` · `qwen3:32b, llama4:17b` · `Researcher` · `Pobierz model` · `Sprawdź` · `Telegram` · `drugi Kanał · long polling` · `sparowany` · `Bot` · `@overmind_wojtek_bot` · `Twoje konto` · `@wojtek · inni są ignorowani` · `Uprawnienia` · `czaty, status, Zgody na Run` · `Nowy kod parowania` · `Rozłącz` · `API` · `Klucze API` · `Anthropic, OpenAI i inni` · `po MVP` · `Status` · `niedostępne w tej wersji` · `Gdy kończy się limit` · `Przy 90% limitu Chief przełącza Agentów w tej kolejności i wysyła powiadomienie.` · `1` · `Model przypisany Agentowi` · `2` · `Drugie CLI (Claude ↔ Codex)` · `3` · `Ollama · qwen3:32b` · `4` · `Eskalacja do Ciebie` · `Równoległość` · `Agenci naraz` · `−` · `+` · `Na całą instalację. Każdy aktywny Agent to osobny kontener, około 1,3 GiB RAM.` · `Automatyczne sterowanie CLI zależy od zasad dostawców. Overmind pokazuje limity tak, jak raportuje je CLI.` · `@Sekcje` · `@Claude Code` · `@Codex CLI` · `@Ollama` · `@Telegram` · `@Klucze API` · `@Przełączanie modeli` · `@Mniej` · `@Więcej`

---

## 16. App settings  (`Ustawienia`)

- **File**: `source/Ustawienia.dc.html`, render `views/Ustawienia.png` (2x of 1440x900 CSS px)
- **Viewport**: 1440x900
- **Purpose**: Installation-wide application settings: language, autostart, notifications, backups, security and logs, and the Global Pause panel.

**Owner-facing functions**

- Choose interface language (Polish)
- Toggle launch at login and work after closing the window
- Choose notification delivery per event type; send to Telegram
- Configure and run backups, export or restore the database
- Toggle secret/PII redaction in logs; view secrets storage; see last isolation test
- Trigger Global Pause ("Wstrzymaj wszystko")

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `shell/rail-item-active` | 13.5 | 840 | 44 | 44 | Active rail item |  |
| `shell/tab-bar` | 72 | 67 | 1368 | 45 | Section tab bar |  |
| `appset/main` | 72 | 112 | 1368 | 788 | Main |  |
| `appset/title` | 100 | 134 | 1312 | 31 | Title 26/700 |  |
| `appset/section-general` | 100 | 183 | 646 | 227.6 | Section: General |  |
| `appset/setting-row-select` | 101 | 214 | 644 | 67 | SettingRow with select button (38px) |  |
| `appset/setting-row-switch` | 101 | 281 | 644 | 64.8 | SettingRow with Switch |  |
| `appset/section-notifications` | 100 | 430.6 | 646 | 430.8 | Section: Notifications (6 rows: 5 selects + 1 switch) |  |
| `appset/section-backup` | 766 | 183 | 646 | 259 | Section: Backup |  |
| `appset/backup-actions` | 767 | 373 | 644 | 68 | Backup action buttons row |  |
| `appset/section-security` | 766 | 462 | 646 | 196.8 | Section: Security & logs |  |
| `appset/global-pause-section` | 766 | 678.8 | 646 | 90.8 | GlobalPausePanel (magenta-tinted, magenta CTA 44px) |  |
| `appset/version-footer` | 766 | 789.6 | 646 | 14 | Version/build mono line |  |

**States visible in the mock**

- Setting rows with select button (value + chevron) and switch rows
- Notifications section: five selects + one switch
- Backup rows with time select and three buttons
- Global Pause panel (magenta tint) with magenta CTA
- Version footer

**States NOT shown (implementers design them from the design-system rules)**

- Select open state (options menu)
- Global Pause active state (button becomes "Wznów wszystko"?) and its confirmation
- Backup running / failed / restore confirmation
- Time picker for the backup time
- Switch focus/hover/disabled
- Language not available state
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Ten Workspace` · `Połączenia i modele` · `Aplikacja` · `Ustawienia` · `Ogólne` · `Język interfejsu` · `Kod i dokumentacja projektu są po angielsku.` · `Polski` · `Uruchamiaj przy logowaniu` · `Silnik startuje jako usługa użytkownika.` · `Pracuj po zamknięciu okna` · `Praca staje dopiero przy uśpieniu lub wyłączeniu Maca.` · `Powiadomienia` · `Prośba o dostęp` · `Agent czeka, dopóki nie odpowiesz.` · `Dźwięk + baner` · `Zgoda` · `Eskalacja i błąd Runu` · `Baner` · `Zakończenie Runu` · `Tylko Centrum` · `Dyskusja zaczęta przez Chiefa` · `Wysyłaj też na Telegram` · `Zgody z Telegrama działają tylko w bieżącym Runie.` · `Kopia zapasowa` · `Folder kopii` · `~/Backups/overmind` · `Codziennie o` · `03:00` · `Ostatnia kopia` · `dziś 03:00 · 48 MB · OK` · `Zrób kopię teraz` · `Eksportuj bazę…` · `Przywróć z kopii…` · `Bezpieczeństwo i logi` · `Redakcja sekretów i danych osobowych w logach` · `Sekrety` · `Tylko w pęku kluczy macOS (Keychain).` · `3 wpisy` · `Test ucieczki z izolacji` · `zaliczony · wczoraj` · `Zatrzymuje wszystkich Agentów we wszystkich Workspace'ach po bieżącym kroku. Nic nie jest ponawiane na ślepo.` · `Wstrzymaj wszystko` · `Overmind 0.1.0` · `Apache-2.0` · `herdr 0.9.2` · `macOS 26.1 · Apple silicon` · `@Sekcje` · `@Ogólne` · `@Uruchamiaj przy logowaniu` · `@Pracuj po zamknięciu okna` · `@Powiadomienia` · `@Wysyłaj też na Telegram` · `@Kopia zapasowa` · `@Bezpieczeństwo i logi` · `@Redakcja sekretów` · `@Global Pause`

---

## 17. Menu-bar menu  (`Tray`)

- **File**: `source/Tray.dc.html`, render `views/Tray.png` (2x of 380x560 CSS px)
- **Viewport**: 380x560 (content 613px, overflows)
- **Purpose**: macOS menu-bar popover that lets the Owner see activity at a glance, open pending Approvals, message Chief, pause or resume a Workspace, trigger Global Pause and quit.

**Owner-facing functions**

- See overall status ("pracuje · 3 z 3 Agentów") and working Agents per Workspace
- Open Approvals (3 waiting), write to Chief, open Overmind (⌘O)
- Pause or resume an individual Workspace
- Global Pause
- Close window but keep working; quit Overmind ("Zakończ Overmind…")

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `tray/popup` | 16 | 16 | 348 | 597 | Menu popup card (radius 16, large shadow) | overflows viewport (scroll content) |
| `tray/header` | 25 | 25 | 330 | 46 | Logo 28 + "Overmind" + status line |  |
| `tray/agent-row-working` | 25 | 84 | 330 | 42 | TrayAgentRow: working |  |
| `tray/agent-row-waiting` | 25 | 128 | 330 | 42 | TrayAgentRow: waiting for Approval (amber word) |  |
| `tray/agent-row-other-workspace` | 25 | 172 | 330 | 42 | TrayAgentRow: other Workspace |  |
| `tray/divider` | 31 | 77 | 318 | 1 | Divider (1px #241B36, 6px side margin) |  |
| `tray/item-pending` | 25 | 227 | 330 | 40 | MenuItem: pending count (amber square marker + "Zgody" hint) |  |
| `tray/item-chat` | 25 | 269 | 330 | 40 | MenuItem with icon |  |
| `tray/item-pause-workspace` | 25 | 322 | 330 | 40 | MenuItem: Pause Workspace |  |
| `tray/item-resume-workspace` | 25 | 364 | 330 | 40 | MenuItem: Resume Workspace |  |
| `tray/global-pause` | 27 | 421 | 326 | 42 | Global Pause button (42px, tinted magenta) |  |
| `tray/item-open-app` | 25 | 480 | 330 | 40 | MenuItem with kbd hint (⌘O) |  |
| `tray/item-close-window` | 25 | 522 | 330 | 40 | MenuItem | overflows viewport (scroll content) |
| `tray/item-quit` | 25 | 564 | 330 | 40 | MenuItem muted (CLIPPED at 560px in the mock) | overflows viewport (scroll content) |

**States visible in the mock**

- Header with logo and status line
- Agent rows with state (pracuje, Zgoda, Researcher without state)
- Waiting-items row with amber count
- Action list with shortcut hint; destructive-ish last row

**States NOT shown (implementers design them from the design-system rules)**

- Nothing running (idle) and Global Pause active variants of the header
- Engine stopped / error
- Hover/focus highlight for menu items (macOS native-like)
- Menu overflow (content is 53px taller than the 560 popover)
- Quit confirmation (running Runs)
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Overmind` · `pracuje · 3 z 3 Agentów` · `pracuje` · `Security` · `Zgoda` · `Rs` · `Researcher` · `Strona fundacji` · `3 sprawy czekają na Ciebie` · `Zgody` · `Napisz do Chiefa…` · `Wstrzymaj „Aplikacja rezerwacji”` · `Wznów „Research rynku”` · `Otwórz Overmind` · `⌘O` · `Zamknij okno, pracuj dalej` · `Zakończ Overmind…`

---

## 18. Telegram bot chat  (`Telegram`)

- **File**: `source/Telegram.dc.html`, render `views/Telegram.png` (2x of 390x844 CSS px)
- **Viewport**: 390x844
- **Purpose**: Mobile Telegram chat with the Overmind bot (one Owner only). Shows Chief replies, an @agent mention routed to QA, and a per-Run Approval with inline buttons.

**Owner-facing functions**

- Ask Chief about progress; address an Agent with @qa
- Approve an Approval for this Run only ("Zezwól na ten Run") or deny ("Odmów")
- Permanent approvals are not offered on Telegram ("Na stałe zatwierdzisz tylko przy komputerze")

**Regions** (CSS px; PNG = x2)

| Slug | x | y | w | h | Description | Notes |
|---|---|---|---|---|---|---|
| `tg/header` | 0 | 0 | 390 | 71 | Chat header: logo 42 + name + "bot · tylko Ty" |  |
| `tg/thread` | 0 | 71 | 390 | 688 | Thread (dot-grid background 18px) |  |
| `tg/day-separator` | 181.8 | 85 | 26.5 | 13 | Day label |  |
| `tg/bubble-owner` | 262.9 | 108 | 115.1 | 50.6 | TelegramBubble: owner (violet #3A2A5C, radius 16/16/4/16) |  |
| `tg/bubble-chief` | 12 | 168.6 | 340.8 | 135.2 | TelegramBubble: Chief (surface, radius 16/16/16/4, sender label magenta-light) |  |
| `tg/bubble-agent` | 12 | 374.4 | 340.8 | 114.9 | TelegramBubble: Agent (sender label lavender) |  |
| `tg/bubble-approval` | 12 | 499.3 | 340.8 | 182.3 | TelegramBubble: Approval with inline action buttons |  |
| `tg/approval-actions` | 25 | 597.2 | 314.8 | 40 | Approve this Run (amber, 40px) + Deny (outlined) |  |
| `tg/composer` | 0 | 759 | 390 | 85 | Input row (bottom padding 28 = home-indicator safe area) |  |
| `tg/input` | 12 | 770 | 314 | 46 | Text input pill 44px r22 |  |
| `tg/send-button` | 334 | 771 | 44 | 44 | Send button 44px circle, flat magenta |  |

**States visible in the mock**

- Owner bubble (violet), Chief bubble, Agent bubble with sender label, Approval bubble with amber primary and outline secondary, day separator, input row

**States NOT shown (implementers design them from the design-system rules)**

- Decided Approval (buttons replaced by result line), expired Approval
- Bot offline / not paired / other user ignored
- Typing indicator, long messages, lists
- Pressed state of inline buttons
- Plus the default checklist above (hover, focus, pressed, disabled, loading, error, empty).

**UI copy (Polish, as in the mock; shell strings omitted)**

`Overmind` · `bot · tylko Ty` · `dziś` · `Jak idą testy?` · `14:02` · `Chief` · `Aplikacja rezerwacji: iteracja 2 z 5, 2 testy padają na kodzie rabatowym.` · `Strona fundacji: 7 z 9 Zadań gotowe.` · `Research rynku: wstrzymany.` · `@qa co padło w ostatnim przebiegu?` · `14:05` · `Dwa testy koszyka: rabat liczony po VAT zamiast przed. Developer już poprawił, odpalam ponownie.` · `Zgoda · Security` · `Wejście na nową domenę` · `registry.npmjs.org` · `w Run #14.` · `Zezwól na ten Run` · `Odmów` · `Na stałe zatwierdzisz tylko przy komputerze.` · `14:20` · `Wiadomość` · `ph:Wiadomość albo @agent` · `@Wyślij`
