# Izolacja na macOS: polecenia agentów w lekkiej maszynie wirtualnej lub kontenerze

Polecenia agentów, w tym narzędzia CLI, które same uruchamiają komendy, działają w lekkiej maszynie wirtualnej lub kontenerze na Macu. Montowane są do niej wyłącznie Dozwolone katalogi. Chrome i symulator obsługuje Overmind po stronie macOS, na polecenie Agenta i w granicach jego Efektywnych uprawnień. Odrzuciliśmy profile sandboxa macOS (oznaczone przez Apple jako przestarzałe) i osobnego użytkownika systemu, bo nie dają tak twardej granicy dla dowolnych poleceń shella.

## Konsekwencje

- Udzielona Zgoda na nowy katalog oznacza dołączenie go do maszyny wirtualnej. Nie wystarczy wpis w ustawieniach.
- Testy ucieczki z izolacji są częścią CI.

## Potwierdzenie w prototypie (12.10.2026, `docs/research/prototyp-wnioski.md`)

- Na macOS izolację zapewnia narzędzie `container` od Apple (wymaga macOS 26 i Apple silicon). Kontener z zamontowanym jednym folderem nie widzi nic więcej z Maca, a agent nie może z niego wyjść nawet na wyraźne polecenie. Dla starszych Maców potrzebna jest alternatywa za tym samym interfejsem izolacji (np. Lima) albo jawne wymagania systemowe Overmind.
- Dwa poziomy granic działają: kontener lub VM oddziela Agentów od Maca, a bubblewrap wewnątrz oddziela Workspace'y od siebie.
- Koszt: ok. 1,3 GiB RAM na aktywnego Agenta z CLI. Wybór między kontenerem na Agenta a kontenerem na Workspace z bubblewrap w środku zapada przy implementacji modułu izolacji.
- CLI zawsze startuje w folderze Workspace'u. Reszta systemu plików kontenera jest tylko do odczytu albo nietrwała, żeby praca Agenta nie trafiła poza zamontowany folder i nie przepadła.
- Dane logowania CLI leżą w osobnym, trwałym wolumenie na Agenta lub CLI, niewidocznym dla innych Workspace'ów.
- Sieć wychodzi przez proxy z listą hostów: serwery dostawców modeli są dopuszczone z góry, a każda inna domena wymaga Zgody (ADR 0021).
- Kreator instaluje środowisko kontenerów razem z jądrem; w prototypie jądro trzeba było doinstalować osobno.
