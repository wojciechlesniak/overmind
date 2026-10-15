# Backlog w GitHub Issues, publiczne repozytorium i chroniony master

Kod, dokumentacja i backlog Overmind żyją w jednym publicznym repozytorium `wojciechlesniak/overmind` na GitHubie, na licencji Apache-2.0, czyli tej samej co herdr (ADR 0013). Zadania z backlogu (927 opisów w `tasks/`) są śledzone jako GitHub Issues. Linear nie nadaje się do tego backlogu na darmowym planie.

## Decyzje

- **Repozytorium:** publiczne, domyślna gałąź `master` (jak w herdr), licencja Apache-2.0, bez CLA (ADR 0013, 0025).
- **Backlog:** każde zadanie to jedno issue, utworzone w kolejności budowy. Numer issue jest równy numerowi zadania: `#12` to `OVE-012`. Tytuł ma postać „OVE-012 · tytuł”. Dawny identyfikator (`OVE_SETUP008`) jest w pierwszej linii opisu, a pełna mapa w `tasks/ISSUE-MAP.md`.
- **Kolejność:** sortowanie topologiczne po zależnościach. Najpierw konfiguracja i fundament (SETUP, OSS, ARCH, SEC, TEST), potem design system, rdzeń backendu, funkcje produktu, a na końcu widoki desktopowe.
- **Priorytety:** etykiety `priority:urgent` (fundament i konfiguracja), `priority:high` (reszta MVP z P0), `priority:medium` (P1), `priority:low` (P2 i poza MVP).
- **Etykiety i milestone'y:** `area:*`, `kind:*`, `size:*`, `design:image` oraz pięć milestone'ów: 00 fundament, 01 design system, 02 rdzeń backendu, 03 funkcje produktu, 04 interfejs desktopowy.
- **Zależności:** w opisie każdego issue linia „Blocked by” z linkami (pełna lista) oraz natywne relacje „blocked by” GitHuba dla zależności bezpośrednich (po redukcji przechodniej).
- **Obrazy:** pliki `design*.png` leżą w `tasks/<ID>/` w repozytorium i są osadzone w opisach issues przez adresy `raw.githubusercontent.com`.
- **Ochrona `master`** (ruleset „Protect master”, bez listy bypass): blokada usuwania, blokada force-push, wymagana liniowa historia, zmiany tylko przez pull request (0 wymaganych akceptacji, bo projekt prowadzi jedna osoba), wymagane rozwiązanie komentarzy, dozwolone squash i rebase. Po dodaniu CI do reguły dochodzą wymagane statusy (zadanie OVE-006).

## Dlaczego nie Linear

Próbowaliśmy najpierw Linear. Darmowy plan ma limit issues w workspace (zatrzymał import po 264 zadaniach), a obrazów nie da się wgrać z tego środowiska, bo host przechowujący pliki jest zablokowany. GitHub Issues nie ma limitu liczby zadań na darmowym koncie, pokazuje obrazy z repozytorium i obsługuje relacje „blocked by”. Jest też tam, gdzie będzie kod i kontrybutorzy.

## Konsekwencje

- Źródłem prawdy o treści zadania jest plik `tasks/<ID>/TASK.md`. Issue jest jego kopią do śledzenia pracy; zmiany treści robi się w pliku, a potem w issue.
- GitHub limituje tworzenie treści (ok. 500 żądań na godzinę, limit wtórny), więc masowe operacje na issues trzeba rozkładać w czasie.
- API sesji agenta nie pozwala zapisywać reguł ochrony gałęzi ani tworzyć tablicy Projects. Te dwie rzeczy Właściciel ustawia ręcznie w ustawieniach repozytorium.
- 264 zadania z nieudanej próby w Linear (workspace Codelize, projekt Overmind) są nieużywane i można je usunąć.
