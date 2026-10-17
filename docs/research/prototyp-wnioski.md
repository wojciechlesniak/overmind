# Prototyp sprawdzający: herdr + CLI w izolacji — wnioski

**Data:** 2026-10-12 | **Status:** test automatyczny wykonany; test ręczny Właściciela do wykonania | **Kod prototypu:** `~/Projects/overmind-prototyp` (do usunięcia po teście)

Cel: sprawdzić, czy założenia ADR 0020 (izolacja w maszynie wirtualnej), 0022 (oficjalne CLI) i 0026 (herdr jako warstwa terminali) trzymają się w praktyce, zanim powstanie kod produkcyjny.

## 1. Środowisko testu

Lekka maszyna wirtualna z Linuksem (Ubuntu 22.04, arm64, 4 rdzenie, 3 GB RAM) działająca na MacBooku Właściciela. Jest w niej zamontowany wyłącznie katalog `~/Projects` i nic więcej z dysku Maca. To odpowiada modelowi z ADR 0020.

Wersje: herdr 0.9.3, Claude Code 2.1.296, Codex CLI 0.162.1. Mały adapter w Node (ok. 25 linii, bez zależności) rozmawiał z herdr przez jego gniazdo, tak jak robiłby to silnik Overmind.

## 2. Wyniki

| # | Test | Wynik |
| --- | --- | --- |
| 1 | herdr startuje w VM jako serwer w tle; gniazda API mają prawa 0600 | ✅ |
| 2 | Adapter Node steruje herdr przez API JSON (workspace, pane, agent, read) | ✅ działa od pierwszego podejścia, schemat API (128 metod) da się pobrać z `herdr api schema --json` |
| 3 | `agent.start` dla `claude` i `codex` | ✅ herdr uruchamia oba i rozpoznaje Codex jako agenta; ekran CLI czytelny przez `pane.read` |
| 4 | Stan agenta raportowany przez sam agent (symulacja Skilla „overmind”) | ✅ przejścia `idle → working → done` i `blocked` widoczne w adapterze w czasie rzeczywistym |
| 5 | Bramka „nie wysyłaj polecenia zablokowanemu agentowi” | ✅ zrobiona po stronie adaptera; polecenie odrzucone, gdy agent czeka na Zgodę |
| 6 | Izolacja poziom 1: VM względem Maca | ✅ z VM nie widać nic poza `~/Projects`; ścieżki Maca nie istnieją |
| 7 | Izolacja poziom 2: jeden Workspace względem pozostałych (bubblewrap w VM) | ✅ proces widzi tylko swój folder; zapis tam działa, sąsiednie projekty niewidoczne; sieć domyślnie odcięta |
| 8 | Restart serwera (łagodny) | ✅ Workspace, terminale i Agent wznowiony komendą wznowienia |
| 9 | Awaria (`kill -9`) i restart | ✅ to samo co wyżej |
| 10 | Logowanie subskrypcją w CLI wewnątrz VM | ⚠️ nie do sprawdzenia w tym środowisku (patrz 3.1). Codex pokazuje ekran logowania z opcją „Device Code”, która działa bez przeglądarki w VM |

## 3. Wnioski

### 3.1 Co potwierdzone

- **Architektura z ADR 0026 jest wykonalna i tania.** Overmind w TypeScripcie może sterować herdr przez gniazdo zwykłym JSON-em, bez żadnej biblioteki. Pierwsze działające wywołania powstały w kilka minut.
- **Dwupoziomowa izolacja działa:**
  - maszyna wirtualna oddziela Agentów od Maca,
  - bubblewrap wewnątrz VM oddziela Workspace'y od siebie.

  To daje to, czego wymaga ADR 0003: Agent w projekcie A nie widzi projektu B, nawet gdy oba katalogi są zamontowane w tej samej VM.
- **Wznawianie po restarcie i po awarii działa bez naszego kodu.** herdr zapisuje stan i sam wpisuje komendę wznowienia.
- **Raporty Agenta (wzorzec Skilla „overmind”, ADR 0027) są natychmiastowe i jednoznaczne.** To pewniejsze niż odczyt ekranu.

### 3.2 Co trzeba uwzględnić w projekcie (nowe ustalenia)

1. **`agent.prompt` w herdr działa tylko dla agentów uruchomionych przez `agent.start` z jego listy (np. claude, codex).** Dla innych Overmind musi wysyłać tekst przez `pane.send_text`, a bramkę „nie pisz do zablokowanego” trzymać u siebie. Wniosek: bramka zawsze w adapterze Overmind, niezależnie od herdr.
2. **herdr ma piąty stan: `done`** (praca skończona, wynik jeszcze nieodebrany). Overmind traktuje go jako „gotowy na kolejne polecenie” i jako sygnał do odebrania wyniku Zadania. Do uzupełnienia w słowniku przy Stanie agenta.
3. **Komenda wznowienia musi być nazwą programu z `PATH`, nie ścieżką** (`./skrypt` jest odrzucane po cichu i cały raport przepada). Skill „overmind” musi o tym wiedzieć, a adapter powinien sprawdzać odpowiedź na każdy raport.
4. **Sieć jest osobną decyzją izolacji.** CLI potrzebuje połączenia z serwerami dostawcy (Anthropic, OpenAI). VM Overmind musi mieć listę dozwolonych hostów: dostawcy są dopuszczeni z góry, a każda inna domena wymaga Zgody (zgodnie z ADR 0021). bubblewrap domyślnie odcina sieć całkowicie, więc trzeba ją jawnie przepuszczać przez proxy z listą hostów.
5. **Logowanie w VM:** Codex oferuje logowanie kodem urządzenia, które działa bez przeglądarki w VM. Dla Claude Code w VM zakładamy logowanie przez link otwierany w przeglądarce na Macu, ale tego nie dało się tutaj potwierdzić (pkt 3.3), bo w VM Claude Code nie połączył się z serwerami Anthropic. To główny cel testu ręcznego.
6. **Identyfikacja Agenta:** Agent zgłaszający się sam nie ma nazwy w herdr. Overmind trzyma własne mapowanie Agent ↔ terminal i nie polega na nazwach herdr.
7. **Zasoby:** VM testowa miała 3 GB RAM. Przy limicie 3 równoległych Agentów (spec. rozdz. 9) trzeba zmierzyć zużycie pamięci przez CLI z prawdziwym modelem. To kolejny punkt testu ręcznego.

### 3.3 Czego nie dało się sprawdzić automatycznie

- **Prawdziwa praca CLI z subskrypcją.** Maszyna testowa ma własną listę dozwolonych domen, która blokuje serwery logowania Anthropic i OpenAI. To ograniczenie środowiska testowego, nie projektu.
- **Natywna izolacja na macOS.** Test działał w gotowej VM z Linuksem. Uruchomienie tego samego przez własną VM lub kontener Overmind na Macu trzeba potwierdzić ręcznie.

## 4. Test ręczny dla Właściciela (ok. 20 minut)

**A. herdr i CLI z Twoją subskrypcją (bez izolacji):**

1. `brew install herdr`, potem w terminalu `herdr`.
2. W jednym panelu uruchom `claude` (zalogowany), w drugim `codex`.
3. W innym oknie terminala: `herdr agent list`. Zapisz, czy oba są wykryte.
4. Daj Claude krótkie zadanie i w drugim oknie co kilka sekund wpisuj `herdr agent list`. Czy stan przechodzi `working → done/idle`? Czy gdy Claude pyta o zgodę na komendę, stan to `blocked`?
5. `herdr agent prompt <nazwa> "dopisz komentarz do README" --wait`. Działa?
6. Zamknij okno herdr (`ctrl+b q`), otwórz ponownie (`herdr`). Czy agenci nadal pracują?

**B. CLI w izolacji na Macu (najważniejsze)**, narzędzie `container` od Apple (wymaga Apple silicon i macOS 26):

1. `sw_vers -productVersion` musi pokazać 26.x. Pobierz podpisany instalator `.pkg` ze strony wydań github.com/apple/container, zainstaluj, potem `container system start` (na pytanie o instalację jądra odpowiedz tak).
2. Uruchom kontener z zamontowanym tylko folderem testowym, z limitem 2 CPU i 4 GB RAM:
   `container run -it --name ovm-test -c 2 -m 4G --volume ~/Projects/overmind-prototyp/ws-demo:/work docker.io/library/node:22 bash`
3. W kontenerze: `npm i -g @anthropic-ai/claude-code @openai/codex`, potem `cd /work && ls && ls /Users`. Oczekiwane: widać `README.md`, a `/Users` nie istnieje.
4. `claude`: zaloguj się subskrypcją (link otwierasz w przeglądarce na Macu, kod wklejasz w terminal). Polecenia dla Claude:
   - „utwórz plik z-kontenera.md z jednym zdaniem”,
   - „pokaż, co jest w HOST_WORKSPACE_ROOT”.
5. W drugim terminalu na Macu, gdy Claude pracuje: `container stats --no-stream ovm-test`. Zapisz zużycie pamięci.
6. `codex`: wybierz „Sign in with Device Code” i sprawdź, czy logowanie przechodzi.
7. Na Macu: `ls ~/Projects/overmind-prototyp/ws-demo`. Plik `z-kontenera.md` powinien tam być.
8. Sprzątanie: `exit`, potem `container rm ovm-test`.

Zapisz:

- czy logowanie się udało (Claude, Codex),
- zużycie pamięci,
- czy agent zobaczył cokolwiek poza `/work`,
- ile trwało pierwsze uruchomienie kontenera.

Wyniki dopisz tutaj w sekcji 5. Na ich podstawie zaktualizujemy ADR 0020 i 0026, a potem usuwamy prototyp.

## 5. Wyniki testu ręcznego

**A (macOS, herdr + zalogowane CLI), 12.10.2026, częściowo:**

- ✅ herdr na macOS wykrywa oba CLI uruchomione ręcznie w panelach: `claude` (w1:p1) i `codex` (w1:p2), oba w stanie `idle`.
- ✅ Dla Claude herdr ma identyfikator sesji (`agent_session` ze źródła `herdr:claude`), więc integracja z hookiem działa i wznowienie po restarcie będzie możliwe.
- ⚠️ `agent prompt` nie zadziałał, bo agenci uruchomieni ręcznie nie mają w herdr nazwy (`agent_not_found`). Agenta trzeba nazwać (`herdr agent rename <pane> <nazwa>`) albo uruchamiać przez `herdr agent start`. Wniosek dla Overmind: zawsze uruchamiać CLI przez `agent.start` z nadaną nazwą, nigdy nie polegać na wykryciu ręcznie uruchomionego procesu.
- ✅ `herdr agent start cc --kind claude --pane w1:p1` uruchamia Claude z nazwą w wybranym folderze; herdr ma identyfikator sesji.
- ❌ **Fałszywe `done`.** `agent prompt cc "utwórz plik README.md…" --wait` zwrócił `done`, a plik nie powstał. Na ekranie Claude były: błąd `401 OAuth access token has expired, please run /login` oraz okno dialogowe „Set up auto mode for your environment?” z wyborem 1/2/3. herdr nie rozpoznał ani błędu logowania, ani okna wyboru jako `blocked` (jego reguła „blocked” obejmuje tylko okna zgody na akcję).
- ⚠️ Codex przeszedł w `done` bez żadnego polecenia.
- ✅ **Po ponownym zalogowaniu (`/login` wykonane przez Właściciela) pełny przebieg działa.** Polecenie wysłane przez `herdr agent prompt` trafiło do Claude, który w ok. 23 s (auto mode, Opus) przeczytał folder i utworzył `README.md`. Plik zweryfikowany bezpośrednio na dysku, poza herdr.
- ✅ **Zamknięcie i ponowne otwarcie okna herdr:** oba Agenty (`cc`, `cx`) przetrwały z tymi samymi nazwami, folderami i identyfikatorem sesji Claude. Potwierdza model „silnik w tle, okno tylko klientem” (ADR 0005).
- ✅ **`blocked` przy prawdziwym oknie zgody.** Z wyłączonym auto mode `agent prompt cc "dopisz drugie zdanie do README.md" --wait` zwrócił `blocked`, gdy Claude pytał „Do you want to make this edit to README.md?” (Yes / Yes for session / No). Na ekranie widać pełny diff zmiany, a tytuł terminala zawiera streszczenie Zadania („Dodaj drugie zdanie do README.md”).

**Wnioski z testu A (całość):**

- Okno zgody CLI da się zamienić na Zgodę w Overmind: stan `blocked` przychodzi wiarygodnie, a diff do pokazania Właścicielowi można odczytać z ekranu (`pane.read`). Odpowiedź Właściciela Overmind wpisuje w CLI (1/2/3).
- Tytuł terminala to darmowe źródło krótkiego opisu, co Agent właśnie robi. Przyda się w podglądzie Tablicy i w Telegramie.

**Wnioski z testu A:**

1. **Stan z herdr to wskazówka, nie dowód.** Overmind przesuwa Zadanie dalej dopiero po sprawdzeniu rzeczywistego efektu (plik, wynik testu, commit) albo raportu Skilla „overmind”, a nie samego `done`. To potwierdza zasadę Quality Gate opartego na dowodach.
2. **Overmind musi rozpoznawać więcej stanów niż herdr**, przede wszystkim:
   - „wymaga zalogowania” (wygasła sesja subskrypcji): powiadomienie Właściciela, żeby sam wykonał `/login` (ADR 0022);
   - „okno wyboru w CLI” (onboarding, nowe funkcje, ankiety): traktowane jak `blocked`, nigdy nie zamykane przez Agenta na ślepo.

   herdr pozwala na własne reguły wykrywania (lokalne pliki manifestów w `~/.config/herdr/agent-detection/`). Overmind może dostarczać własne reguły jako uzupełnienie.
3. **Tryb uprawnień CLI to decyzja projektowa.** Claude Code działał w „auto mode”, czyli bez pytania o zgodę na akcje. Trzeba ustalić, czy Agenci w Overmind pracują w CLI w trybie auto (bezpieczeństwo zapewnia izolacja z ADR 0020, a Zgody obsługuje Overmind), czy z pytaniami CLI zamienianymi na Zgody w Overmind.

**B (izolacja na macOS, narzędzie `container` 1.5.0 od Apple), 12.10.2026:**

- ℹ️ Instalacja: podpisany `.pkg` z wydań GitHub; przy pierwszym uruchomieniu trzeba było osobno zainstalować jądro (`container system kernel set --recommended`). Kreator Overmind musi to robić sam albo prowadzić Właściciela krok po kroku.
- ✅ Kontener (`node:22`, 2 CPU, limit 4 GB) z zamontowanym wyłącznie `ws-demo` jako `/work`: widać tylko pliki tego folderu, `/Users` z Maca nie istnieje.
- ✅ **Logowanie subskrypcją Claude działa wewnątrz kontenera** (Claude Code 2.1.296, „Claude Max”).
- ✅ Claude w kontenerze utworzył `/work/z-kontenera.md`; plik zweryfikowany na dysku Maca w `~/Projects/overmind-prototyp/ws-demo`.
- ✅ **Próba wyjścia poza folder:** poproszony o pokazanie `HOST_WORKSPACE_ROOT` Claude sam sprawdził system plików i odpowiedział, że ta ścieżka nie istnieje, a z hosta zamontowany jest tylko `/work`. Granica wynika z systemu, nie z dobrej woli agenta.
- 📊 **Zasoby:** 1,29 GiB RAM z 4 GiB i 1,6% CPU przy jednym aktywnym Claude (w tym Node i świeżo zainstalowane CLI), 11 procesów.
- ℹ️ Claude Code ogłasza, że **auto mode jest teraz jego domyślnym trybem uprawnień**. Sam ocenia ryzyko akcji i blokuje groźne, więc pytań o zgodę z CLI będzie coraz mniej.
- ❌ **Codex, opcja „Sign in with ChatGPT” (przez przeglądarkę) nie działa z kontenera.** Po zalogowaniu przeglądarka na Macu przekierowuje na `http://127.0.0.1:1455/auth/callback…`, ale ten port nasłuchuje wewnątrz kontenera, nie na Macu, więc logowanie się nie kończy (`ERR_CONNECTION_REFUSED`).
- ⚠️ Codex, opcja „Sign in with Device Code”: domyślnie wyłączona na koncie ChatGPT. CLI prosi o włączenie logowania kodem urządzenia w ustawieniach bezpieczeństwa ChatGPT i ponowne `codex login --device-auth`.
- ✅ **Obejście bez zmiany ustawień konta działa.** Serwer logowania Codexa nasłuchuje w kontenerze na `localhost:1455`. Adres przekierowania z przeglądarki Maca, przekazany do kontenera komendą `container exec ovm-test curl "<adres>"`, kończy logowanie (odpowiedź `302` na `/success`, plan subskrypcji rozpoznany). Warunek: adres musi pochodzić z tego samego uruchomienia `codex login` (zabezpieczenie `state`/PKCE), a kod jest jednorazowy i krótko ważny.
- ✅ **Logowanie Codexa przetrwało zatrzymanie i ponowne uruchomienie kontenera** (`container start` + `exec`). Ginie dopiero przy usunięciu kontenera.
- ✅ Codex (v0.162.1) na subskrypcji wykonał Zadanie w ok. 10 s.
- ⚠️ **Plik powstał w złym miejscu.** Codex został uruchomiony w katalogu `/` kontenera zamiast w `/work`, więc `z-codexa.md` trafił do systemu plików kontenera, nie do zamontowanego folderu. Na dysku Maca go nie ma i zniknie razem z kontenerem. Izolacja zadziałała (Agent nie wyszedł poza kontener), ale praca została utracona.

**Wnioski z testu B:**

1. **Założenia ADR 0020 i 0022 potwierdzone na prawdziwym Macu:** izolacja przez kontener Apple działa, a subskrypcja działa w środku.
2. **Koszt pamięci ok. 1,3 GiB na Agenta w osobnym kontenerze.** Przy limicie 3 Agentów to ok. 4 GiB. Do decyzji przy implementacji: jeden kontener na Agenta (najsilniejsza izolacja, większy koszt) czy jeden kontener na Workspace z bubblewrap dla każdego Agenta w środku (taniej, sprawdzone w teście w VM).
3. **Wymóg macOS 26 + Apple silicon** dotyczy narzędzia Apple. Dla starszych Maców trzeba przewidzieć alternatywę (np. Lima) za tym samym interfejsem izolacji albo jawnie ograniczyć wymagania systemowe Overmind.
4. **Logowanie z przekierowaniem na `localhost` nie przechodzi samo przez granicę kontenera.** Kreator Overmind ma trzy opcje, w kolejności preferencji:
   - metody bez przekierowania (wklejany kod w Claude, kod urządzenia w Codex, jeśli Właściciel go włączy);
   - tymczasowe przekierowanie portu logowania z Maca do kontenera przez samo środowisko kontenerów, tylko na czas logowania;
   - ręczne obejście sprawdzone w teście.

   Kod logowania nie może przechodzić przez proces Overmind ani trafiać do logów, bo ADR 0022 zakłada, że Overmind nie widzi danych logowania.
5. **Katalog roboczy i trwałość danych logowania:**
   - Overmind zawsze uruchamia CLI w katalogu Workspace'u (`/work`), nigdy w domyślnym katalogu kontenera.
   - Najlepiej, żeby poza zamontowanymi folderami system plików kontenera był tylko do odczytu albo nietrwały. Wtedy Agent nie zrobi pracy, która zniknie.
   - Dane logowania CLI (`~/.claude`, `~/.codex`) trzeba trzymać w osobnym, trwałym wolumenie, inaczej każde odtworzenie kontenera wymaga ponownego logowania.
6. **Tryb uprawnień CLI:** skoro auto mode staje się domyślny, sensowny wariant to Agent w auto mode wewnątrz kontenera. Granicę wyznacza izolacja, a Zgody Overmind dotyczą tylko akcji z listy ADR 0021 (usuwanie, publikacja, płatności, nowe domeny). Okna zgody CLI, jeśli się pojawią, Overmind zamienia na Zgody (test A).

## 6. Proponowane zmiany w dokumentacji (po teście ręcznym)

- ADR 0026: bramka poleceń zawsze w adapterze Overmind; stan `done`; własne mapowanie Agent ↔ terminal; komenda wznowienia jako nazwa programu.
- ADR 0020: dwa poziomy izolacji (VM + bubblewrap na Workspace); sieć przez proxy z listą hostów, z dostawcami dopuszczonymi z góry.
- GLOSSARY: Stan agenta uzupełniony o „skończył, wynik nieodebrany” (`done`).
