# Skill „overmind” instalowany każdemu Agentowi w CLI

Każde CLI uruchomione przez Overmind automatycznie dostaje Skill „overmind”. Uczy on Agenta, jak przez lokalne API Overmind:

- raportować postęp i zakończenie Zadania,
- składać Prośbę o dostęp,
- pisać do innych Agentów,
- zapisywać Decyzje w Rejestrze.

Wybraliśmy ustrukturyzowane raporty od Agentów zamiast samego odczytu ekranu, bo są pewniejsze. Odczyt ekranu przez herdr zostaje jako zabezpieczenie. Wzorzec pochodzi z herdr, który w ten sam sposób uczy agentów sterować sobą.

## Konsekwencje

- Skill działa tylko wewnątrz Overmind (zmienna środowiskowa ustawiana przez Overmind). Poza Overmind nic nie robi.
- Raport Agenta to deklaracja, nie dowód. Quality Gate nadal opiera się na rzeczywistych wynikach testów i skanów.
- API dostępne dla Skilla nie pozwala rozszerzać uprawnień (ADR 0003).
