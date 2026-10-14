# Model kontrybucji: otwarte zgłoszenia, PR po akceptacji zgłoszenia

Zgłoszenia i dyskusje są otwarte dla wszystkich. Pull request można otworzyć dopiero do zgłoszenia zaakceptowanego przez maintainera. Osoby z kilkoma dobrymi PR-ami trafiają na listę zaufanych kontrybutorów i mogą otwierać PR-y bez tego wymogu; automat w CI zamyka pozostałe. Wybraliśmy wariant pośredni między w pełni otwartym repozytorium a modelem zamkniętym jak w herdr, który przyjmuje PR-y tylko od zatwierdzonej listy. Projekt potrzebuje kontrybutorów, ale musi być chroniony przed zalewem PR-ów generowanych przez agentów.

## Konsekwencje

- Repozytorium zawiera `CONTRIBUTING.md`, szablony zgłoszeń, plik z listą zaufanych kontrybutorów i workflow bramkujący PR-y.
- Każdy PR przechodzi CI i automatyczną recenzję, a merge robi człowiek.
