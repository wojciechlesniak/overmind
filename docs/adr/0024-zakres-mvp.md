# Zakres pierwszego wydania (MVP)

MVP obejmuje:

- Chiefa i Agentów z osobnymi czatami,
- canvas z Węzłami Agent, Parallel, Join, IF, Loop, Dyskusja i Review oraz Skillami przeciąganymi na kafelki,
- Tablicę Zadań, Rejestr decyzji i Pamięć agenta,
- izolację folderów i pracę w tle,
- Dostawców przez oficjalne CLI (`claude`, `codex`) z Ollamą jako modelem zapasowym,
- Telegram z czatami, statusem i Zgodami na Run.

Świadomie odkładamy: klucze API, Chrome i symulatory, głos i pliki w Telegramie, Model Router, synchronizację Tablicy z narzędziami zewnętrznymi oraz Windows i Linux. Kryterium wyboru: MVP ma być narzędziem, którego Właściciel używa na co dzień do prowadzenia projektów przez Agentów w swoich subskrypcjach.

## Konsekwencje

- Chrome i symulatory, choć są w nadrzędnych wymaganiach, nie wchodzą do MVP. Uprawnienia i izolacja muszą jednak od początku przewidywać Narzędzia po stronie macOS (ADR 0020).
