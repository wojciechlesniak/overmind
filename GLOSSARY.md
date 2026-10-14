# Overmind

Otwartoźródłowa aplikacja desktopowa, w której właściciel rozmawia z jednym nadrzędnym agentem, a ten prowadzi zespoły agentów AI według programowalnych workflow, w granicach uprawnień nadanych przez właściciela.

## Ludzie i agenci

**Właściciel**:
Jedyna osoba korzystająca z danej instalacji Overmind na swoim komputerze; jedyne źródło uprawnień i ostatecznych zgód.
_Unikaj_: admin, operator, user (jako rola)

**Chief**:
Nadrzędny agent i koordynator pracy; planuje, deleguje, nadzoruje i raportuje Właścicielowi.
_Unikaj_: orchestrator, master agent, główny bot

**Agent**:
Skonfigurowany specjalista AI z rolą, modelem, Skillami, Narzędziami i Profilem uprawnień.
_Unikaj_: bot, worker, asystent

**Agent stały**:
Agent zapisany do wielokrotnego użytku w wielu Runach.
_Unikaj_: agent globalny, agent predefiniowany

**Agent dynamiczny**:
Agent utworzony przez Chiefa na potrzeby konkretnego zadania; po akceptacji Właściciela może stać się Agentem stałym wraz ze swoją pamięcią.
_Unikaj_: agent tymczasowy, agent ad hoc

**Zespół**:
Nazwana grupa Agentów współpracujących według wspólnej polityki komunikacji.
_Unikaj_: grupa, squad, team (w tekście polskim)

**Team Lead**:
Agent kierujący Zespołem w imieniu Chiefa.
_Unikaj_: lider, kierownik

## Praca

**Workspace**:
Jednostka pracy Właściciela z własnymi Dozwolonymi katalogami, pamięcią i Polityką uprawnień.
_Unikaj_: projekt, folder, przestrzeń

**Dokumentacja projektu**:
Ustalony z Właścicielem opis tego, co ma powstać; jedyne źródło zakresu, z którego muszą wynikać wszystkie Zadania.
_Unikaj_: cel projektu, brief, wymagania

**Reguła Właściciela**:
Zasada ustalona przez Właściciela, obowiązująca Chiefa i wszystkich Agentów, której nic nie może osłabić (np. „każde Zadanie kończy się testem penetracyjnym”).
_Unikaj_: preferencja, ustawienie, polityka

**Workspace izolowany**:
Workspace, którego Decyzje i wiedza nie są widoczne w żadnym innym Workspace.
_Unikaj_: projekt prywatny, projekt poufny

**Workflow**:
Wykonywalny program złożony z Węzłów i połączeń, opisujący jak Agenci realizują zadanie.
_Unikaj_: pipeline, diagram, proces, flow

**Wersja workflow**:
Niezmienna, opublikowana postać Workflow; każda edycja tworzy nową Wersję.
_Unikaj_: rewizja, snapshot

**Run**:
Jedno wykonanie konkretnej Wersji workflow, od startu do zakończenia.
_Unikaj_: uruchomienie, job, task, egzekucja

**Węzeł**:
Pojedynczy blok Workflow o określonym typie i kontrakcie wejścia/wyjścia.
_Unikaj_: blok, krok, node (w tekście polskim)

**Subworkflow**:
Wersja workflow wywoływana z innego Workflow jak funkcja, z parametrami i kontraktem.
_Unikaj_: podproces, makro

**Dyskusja**:
Moderowana rozmowa kilku Agentów (także Chiefa) z agendą i limitem rund, w której uczestnicy stosują swoje Skille; kończy się wymaganym wynikiem, zwykle Zadaniami.
_Unikaj_: spotkanie, meeting, narada

**Zadanie**:
Precyzyjnie opisana jednostka pracy, powstała z Dyskusji lub od Chiefa, przydzielana Agentowi do wykonania.
_Unikaj_: ticket, issue, task (w tekście polskim)

**Tablica Zadań**:
Wewnętrzna tablica Workspace'u, na której Zadania przechodzą przez kolejne Tory aż do zakończenia.
_Unikaj_: board, kanban, backlog

**Tor**:
Etap na Tablicy Zadań obsługiwany przez określonego Agenta lub Zespół (np. Build, QA, Review).
_Unikaj_: lane, kolumna, swimlane

**Review**:
Ocena Artefaktu przez Agenta według jawnych kryteriów.
_Unikaj_: recenzja, sprawdzenie, audyt

**Quality Gate**:
Jawny warunek oparty na dowodach (testy, skany, Review), od którego zależy, czy praca idzie dalej, czy wraca do poprawek.
_Unikaj_: bramka, checkpoint jakości

**Eskalacja**:
Przekazanie sprawy Chiefowi lub Właścicielowi, gdy Run nie może sam osiągnąć celu w ustalonych limitach.
_Unikaj_: alert, błąd krytyczny

**Artefakt**:
Wynik pracy Agenta (plik, raport, dane) z zapisanym pochodzeniem.
_Unikaj_: output, produkt, rezultat

**Wiadomość agenta**:
Komunikat przesłany bezpośrednio między Agentami w ramach Runu.
_Unikaj_: event, notyfikacja

**Stan agenta**:
To, co Agent robi w danej chwili: pracuje, czeka na Zgodę, wymaga ponownego zalogowania, bezczynny albo skończył z nieodebranym wynikiem; zawsze oparte na widocznym dowodzie i nigdy nie jest dowodem wykonania Zadania.
_Unikaj_: status bota, aktywność

**Budżet**:
Limit kosztu, czasu lub iteracji przypisany do Runu, Agenta albo Workspace'u.
_Unikaj_: quota, limit zasobów

## Zdolności i modele

**Skill**:
Wersjonowana procedura lub instrukcja, którą Agent stosuje; sama nie daje dostępu do niczego.
_Unikaj_: plugin, umiejętność, prompt

**Narzędzie**:
Wykonywalna zdolność działania na świecie (pliki, przeglądarka, terminal, Git, symulator).
_Unikaj_: tool (w tekście polskim), integracja

**Dostawca modelu**:
Źródło modeli AI dostępne przez API, CLI albo lokalnie (Ollama).
_Unikaj_: provider (w tekście polskim), backend AI

**Model Router**:
Reguła wybierająca model według skonfigurowanej polityki (koszt, typ zadania, dostępność, wymagane funkcje).
_Unikaj_: wybór najlepszego modelu

## Uprawnienia

**Dozwolony katalog**:
Katalog, któremu Właściciel jawnie nadał prawo odczytu, zapisu lub wykonania.
_Unikaj_: whitelista, folder roboczy

**Polityka uprawnień**:
Zbiór reguł określających, do jakich katalogów, Narzędzi i aplikacji wolno sięgać.
_Unikaj_: permissions, ACL

**Profil uprawnień**:
Nazwana, wielokrotnego użytku Polityka uprawnień (np. Development, Read Only).
_Unikaj_: rola, preset

**Efektywne uprawnienia**:
Część wspólna wszystkich Polityk obowiązujących dany Agent w danym Runie; nigdy suma.
_Unikaj_: uprawnienia agenta

**Zgoda**:
Jednorazowa decyzja Właściciela pozwalająca na konkretną akcję wskazaną przez Chiefa lub Agenta.
_Unikaj_: approval (w tekście polskim), akceptacja, potwierdzenie

**Prośba o dostęp**:
Zapytanie Chiefa lub Agenta do Właściciela o udostępnienie katalogu spoza Dozwolonych katalogów; samo w sobie niczego nie przyznaje.
_Unikaj_: eskalacja uprawnień, żądanie dostępu

**Zgoda lokalna**:
Zgoda udzielona wyłącznie na komputerze z Overmind, nigdy zdalnie.
_Unikaj_: zgoda desktopowa

## Kanały

**Kanał**:
Droga rozmowy Właściciela z Chiefem i Agentami: desktop albo Telegram.
_Unikaj_: interfejs, klient

**Parowanie**:
Powiązanie konta Telegram z instalacją Overmind jednorazowym kodem z desktopu.
_Unikaj_: logowanie, rejestracja

**Global Pause**:
Natychmiastowe wstrzymanie wszystkich Runów przez Właściciela.
_Unikaj_: stop, kill switch

## Pamięć

**Decyzja**:
Zapisany wybór z problemem, alternatywami, uzasadnieniem, uczestnikami i dowodami.
_Unikaj_: ustalenie, notatka

**Rejestr decyzji**:
Trwały, przeszukiwalny zbiór Decyzji, z którego nic nie jest usuwane, a jedynie zastępowane.
_Unikaj_: baza wiedzy, log decyzji

**Wynik decyzji**:
Późniejsza ocena skutków Decyzji (nieznany, pozytywny, mieszany, negatywny) poparta dowodami; proponuje ją Chief, rozstrzyga Właściciel.
_Unikaj_: ocena trafności, feedback

**Pamięć agenta**:
Trwała, własna pamięć Agenta stałego: rola, ustawienia i streszczenia wcześniejszych Zadań, których Agent się trzyma.
_Unikaj_: kontekst agenta, historia agenta

**Pamięć wspólna**:
Tablica Zadań i Rejestr decyzji, dostępne dla Chiefa i Agentów w granicach Zakresu pamięci.
_Unikaj_: baza wiedzy, knowledge base

**Zakres pamięci**:
Granica widoczności wiedzy: rozmowa, Agent, Zespół, Workspace albo całość instalacji.
_Unikaj_: scope (w tekście polskim), kontekst
