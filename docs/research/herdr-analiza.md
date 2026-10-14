# Analiza herdr jako inspiracji dla Overmind

**Data:** 2026-10-12 | **Źródło:** repozytorium https://github.com/herdrdev/herdr (stan z 12.10.2026, ostatnie 200 commitów), dokumentacja w `docs/`.

## 1. Czym jest herdr

herdr to „środowisko uruchomieniowe, w którym żyją agenci programistyczni”. Jest to jeden plik binarny w Ruście, który działa jednocześnie jako CLI, klient terminalowy (TUI) i serwer w tle. Uruchamia w swoich terminalach istniejące narzędzia (Claude Code, Codex, Cursor, opencode, Grok i ok. 20 innych), nie opakowując ich. Pokazuje stan każdego agenta (pracuje, zablokowany, bezczynny) i pozwala agentom sterować sobą nawzajem przez CLI i API.

**Skala i tempo** wskazują na duży sukces:
- 59 wydań od 0.1.0 (27.03.2026) do 0.9.3 (29.09.2026);
- numery PR-ów w okolicach 5000;
- formuła w głównym repozytorium Homebrew;
- wśród zatwierdzonych kontrybutorów m.in. DHH;
- dokumentacja w trzech językach.

Faktycznie projekt prowadzi właściciel z jednym głównym współpracownikiem, a większość kodu piszą ich własne agenty.

## 2. Jak jest zbudowany

### 2.1 Serwer w tle i cienkie klienty

- **Serwer działa niezależnie od klienta.** Uruchomienie `herdr` sprawdza, czy serwer działa. Jeśli nie, startuje go w tle (`setsid`), a sam staje się cienkim klientem. Zamknięcie klienta nie zatrzymuje pracy.
- **Trik specyficzny dla macOS:** serwer przenosi się do przestrzeni Mach bootstrap użytkownika, bo samo `setsid` nie odcina go od sesji graficznej. Dzięki temu procesy przeżywają wylogowanie.
- **Dwa gniazda Unix z prawami 0600** (dostęp tylko dla właściciela, bez tokenów):
  - publiczne API: JSON rozdzielany nowymi liniami, metody z kropkami (`workspace.create`, `agent.wait`), subskrypcja zdarzeń z buforem 512 zdarzeń;
  - prywatny, wersjonowany protokół binarny dla własnego klienta.
- **Schemat API generowany jest z typów w kodzie** (`herdr api schema --json`). Zmiany są tylko addytywne, a nowe pola zawsze opcjonalne.
- **Cała logika stanu żyje w jednej pętli** (bez blokad). Każdy terminal ma własny wątek-aktor.

### 2.2 Wykrywanie agentów i ich stanu

- **Który agent:** rozpoznawany po procesie na pierwszym planie terminala, a nie po ekranie. Uwzględnia opakowania (`node`, `bun`, `sh -c`). Opcjonalnie można go wskazać zmienną `HERDR_AGENT`, co przydaje się w maszynach wirtualnych i sandboxach.
- **Jaki stan:** wersjonowane manifesty TOML na każdego agenta z regułami (regex, fragment ekranu, tytuł OSC, pasek postępu OSC, priorytet).
  - „Blocked” jest celowo surowe: wymaga widocznego okna zatwierdzenia.
  - Gdy nic nie pasuje, stan to „idle”, więc system nigdy nie zmyśla blokady.
  - Histereza chroni przed miganiem stanu.
  - `herdr agent explain` pokazuje, która reguła i jaki dowód zadecydowały.
- **Aktualizacje manifestów** przychodzą zdalnie z herdr.dev, bo CLI agentów zmieniają wygląd szybciej niż wydania herdr. Lokalne nadpisania mają pierwszeństwo.
- **Hooki są minimalne i opcjonalne** (`herdr integration install claude`). Dla Claude zgłaszają tylko identyfikator sesji, dla Codexa także przejścia stanów. Instalacja jest jawna, odinstalowanie czyste, a każdy skrypt oznaczony „managed by herdr”.

### 2.3 Wysyłanie poleceń do agentów

- `herdr agent prompt <agent> "tekst" --wait`: tekst trafia do terminala jako bracketed paste, a Enter jest wysyłany osobno po 300 ms.
- Gdy agent jest zablokowany, polecenie jest **odrzucane**, a nie wpisywane w okno zgody.
- `--wait` musi zobaczyć start pracy w ciągu 5 s, inaczej zwraca „stalled”. Dokumentacja ostrzega, żeby po timeoucie nie wysyłać polecenia ponownie na ślepo.

### 2.4 Logowanie i subskrypcje

herdr **nie dotyka żadnych danych logowania**. Kluczy API ani tokenów nie czyta i nie modyfikuje; każde CLI loguje się samo. To potwierdza model przyjęty w ADR 0022.

### 2.5 Trwałość i wznawianie

- **Stan zapisywany do `session.json`:** układ, katalogi, identyfikatory sesji agentów. Zapis jest odroczony o 5 s, atomowy (plik tymczasowy, `fsync`, podmiana) i wersjonowany.
- **Kopie zapasowe:** uszkodzony plik jest kopiowany bajt w bajt, a do tego trzymanych jest 48 migawek, nie częściej niż co 15 min.
- **Po restarcie** procesy nie wracają, ale herdr wpisuje w terminal komendę wznowienia agenta (`claude --resume <id>`, `codex resume <id>`).

### 2.6 Worktree, zdalne maszyny, wtyczki

- **Worktree:** każdy agent dostaje osobny `git worktree` jako osobny workspace. herdr nigdy nie kasuje gałęzi, a brudny checkout wymaga `--force`.
- **Zdalne maszyny:** każda maszyna ma własny serwer herdr, a klient łączy się przez SSH.
- **Wtyczki:** katalog z manifestem TOML, komendy uruchamiane bez powłoki, a całe CLI służy za API wtyczek. **Wtyczki nie mają sandboxa** i działają z prawami użytkownika. Marketplace to niezweryfikowany indeks repozytoriów z GitHuba.

### 2.7 Testy

- Testy jednostkowe leżą obok kodu.
- Testy serwera headless działają w procesie.
- Testy integracyjne uruchamiają prawdziwy plik binarny w izolowanym katalogu.
- Kontrakty API są zamrożone w plikach-wzorcach.
- Benchmarki skalowania sprawdzają działanie przy 1 i 15 panelach.

## 3. Jak prowadzony jest projekt

- **`AGENTS.md`** (z `CLAUDE.md` jako symlinkiem) to szczegółowe reguły dla agentów piszących kod:
  - granice architektury i kod systemowy tylko w `src/platform/<os>`;
  - zakaz `unwrap()` i reguły testów;
  - osobne ścieżki pracy dla maintainerów i dla zewnętrznych kontrybutorów.
- **Model kontrybucji jest zamknięty.** PR-y mogą otwierać tylko maintainerzy i ok. 75 zatwierdzonych osób. Workflow `pr-gate.yml` automatycznie zamyka pozostałe. Podany powód to fala PR-ów generowanych przez agentów. Zgłoszenia służą tylko do odtwarzalnych błędów, a pomysły idą do Discussions. Zgłoszenia triażuje agent maintainera.
- **Recenzje:** każdy PR przechodzi CI i dwa boty AI (CodeRabbit, Greptile). Merge robi wyłącznie człowiek.
- **Commity:** konwencja „conventional commits” małymi literami, bez emoji i bez linii współautorstwa AI.
- **Wydania:**
  - kanał preview (tag z datą) i kanał stabilny, który promuje sprawdzony preview, bez nowego kodu;
  - wydania są niezmienne, a tagi zakłada tylko administrator;
  - 5 plików binarnych na Linux, macOS i Windows.
- **Dystrybucja:** `install.sh`, Homebrew, mise, Nix, instalator dla Windows.
- **Dokumentacja:**
  - wersjonowana strona Astro Starlight: `docs/next` (robocza), `docs/preview`, `docs/versions/<wersja>`;
  - tłumaczenia ja i zh-cn, sprawdzane skryptem zgodności nagłówków;
  - skrypt w CI pilnuje, by dokumentacja konfiguracji zgadzała się z kodem.
- **Własny Skill dla agentów** (`skills/herdr/SKILL.md`) uczy dowolnego agenta sterować herdr. Instaluje się go jedną komendą.
- **Finansowanie:** sponsorzy (program obecnie zamknięty) i kontakt dla firm. Płatnej wersji brak.

## 4. Co przenieść do Overmind

| Wzorzec z herdr | Co znaczy dla Overmind | Powiązanie |
|---|---|---|
| Serwer w tle + cienkie klienty przez gniazdo 0600 | Silnik Overmind jako osobny proces. Okno Tauri, Telegram i CLI to tylko klienci. Na macOS trik z bootstrap namespace | ADR 0005 |
| Publiczne API JSON generowane z typów, zmiany tylko addytywne | Jedno API silnika dla UI, Telegrama, CLI i Agentów; schemat z typów TypeScript (Zod) | rozdz. 13 spec. |
| Wykrywanie stanu CLI po ekranie i OSC, manifesty z regułami | Adaptery `claude`/`codex` rozpoznają: pracuje, czeka na zgodę, skończył. Bez tego Chief nie wie, kiedy Agent skończył Zadanie | ADR 0022 |
| „Blocked” tylko przy widocznym dowodzie, `explain` | Każdy stan Agenta z dowodem, który widać w Activity | rozdz. 15 |
| Odrzucanie poleceń, gdy agent czeka na zgodę | Chief nigdy nie wpisuje tekstu w okno zgody CLI. Taka sytuacja to Zgoda albo Eskalacja | ADR 0021 |
| Brak ponawiania po timeoucie | Wysłanie polecenia do CLI to akcja nieidempotentna | rozdz. 12 |
| Wznawianie przez `--resume <id>` | Po restarcie silnik wznawia sesje CLI Agentów | rozdz. 12 |
| Atomowe zapisy + migawki + kopie uszkodzonych plików | Uzupełnienie codziennej kopii bazy | ADR 0008 |
| Worktree na agenta, nigdy nie kasować gałęzi | Rozwiązanie ryzyka konfliktów w jednym repozytorium | rozdz. 17 |
| Kod systemowy tylko w `platform/<os>` | Już przyjęte, z herdr jako konkretnym wzorcem | ADR 0009 |
| Własny Skill dla agentów | Skill „overmind”, który CLI Agentów dostaje automatycznie: jak raportować postęp, prosić o dostęp, pisać do innych Agentów, zapisywać Decyzje | nowe |
| Hooki opcjonalne, jawne, odwracalne | Overmind może dodać hook do Claude Code i Codexa (np. identyfikator sesji), ale tylko po Zgodzie i z czystym odinstalowaniem | ADR 0021 |
| `AGENTS.md`, conventional commits, `just`, preview → stable, wersjonowana dokumentacja z kontrolą zgodności | Gotowy wzorzec procesu dla repozytorium Overmind | ADR 0013, 0017 |
| Jeden instalator + Homebrew | `.dmg` + Homebrew cask | — |

## 5. Czego nie kopiować

- **Wtyczek bez sandboxa i niezweryfikowanego marketplace.** Kłóci się z ADR 0003, 0004 i 0012.
- **Wyłącznie screen-scrapingu tam, gdzie da się lepiej.** Overmind może łączyć obraz ekranu z ustrukturyzowanym wyjściem (np. tryb JSON w CLI), gdy jest dostępne.
- **Zdalnej aktualizacji reguł bez kontroli Właściciela.** Jeśli Overmind pobiera aktualizacje manifestów, robi to jawnie, z wersją i możliwością wyłączenia.
- **Całkowicie zamkniętego modelu kontrybucji bez decyzji.** Zależy Ci na kontrybutorach, a herdr świadomie ich ogranicza. To wymaga Twojej decyzji (Q53).

## 6. Pytania do decyzji

- **Q53 Model kontrybucji:** otwarty, zamknięty jak w herdr czy pośredni?
- **Q54 herdr jako warstwa terminali:** czy Overmind ma używać herdr (Apache-2.0) do terminali i wykrywania stanu, czy budować własną warstwę?
- **Q55 Skill „overmind” dla Agentów:** czy przyjmujemy go jako sposób komunikacji CLI z silnikiem?
