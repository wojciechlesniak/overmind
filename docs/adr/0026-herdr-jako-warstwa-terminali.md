# herdr jako warstwa terminali dla Agentów pracujących w CLI

Overmind nie buduje własnej obsługi terminali. Oficjalne CLI Agentów (`claude`, `codex`) działają w herdr (Apache-2.0), uruchomionym wewnątrz izolacji z ADR 0020. Overmind steruje herdr przez jego lokalne API: zakłada terminale, uruchamia Agentów, wysyła polecenia, odczytuje Stan agenta i wznawia sesje po restarcie. Od siebie dodaje Chiefa, canvas, Tablicę Zadań, pamięć, uprawnienia i Telegram. Odrzuciliśmy własną warstwę terminali, bo wykrywanie stanu ok. 24 CLI i nadążanie za ich zmianami to praca, którą herdr już wykonuje i utrzymuje.

## Konsekwencje

- Overmind komunikuje się z herdr wyłącznie przez własny interfejs adaptera, żeby herdr dało się później wymienić na własną implementację.
- Overmind dołącza plik binarny herdr w przypiętej wersji, z informacją o licencji Apache-2.0 i autorstwie. Aktualizacja wersji herdr jest świadomą zmianą z testami.
- Polecenie nie jest wysyłane, gdy Agent czeka na zgodę w CLI, i nie jest ponawiane na ślepo po timeoucie. Taka sytuacja to Zgoda albo Eskalacja w Overmind.
- Potwierdzone w prototypie: herdr na macOS uruchamia `claude` i `codex` przez `agent.start`, wiarygodnie zgłasza `blocked` przy oknie zgody CLI, utrzymuje Agentów po zamknięciu okna i wznawia sesje po restarcie i po awarii.
- Stan z herdr to wskazówka, nie dowód. W prototypie herdr zgłosił `done`, choć Zadanie nie zostało wykonane (wygasłe logowanie i okno wyboru w CLI). Overmind przesuwa Zadanie dopiero po sprawdzeniu efektu albo raportu Skilla „overmind” (ADR 0027) i dokłada własne reguły wykrywania dla „wymaga logowania” i „okno wyboru w CLI” (herdr pozwala na lokalne reguły).
- Overmind zawsze uruchamia CLI przez `agent.start` z nadaną nazwą i trzyma własne mapowanie Agent ↔ terminal. `agent.prompt` herdr działa tylko dla nazwanych agentów obsługiwanych przez herdr, więc bramka „nie pisz do zablokowanego” jest zawsze w adapterze Overmind.
- Komenda wznowienia zgłaszana do herdr musi być nazwą programu z `PATH`, nie ścieżką. Adapter sprawdza odpowiedź na każdy raport.
- Zależność od cudzego projektu: śledzimy jego API (zmiany wyłącznie addytywne) i wydania.
