# Jedna instalacja, jeden Właściciel, wszystko lokalnie

Overmind jest open source. Każdy instaluje własną kopię na swoim komputerze i jest w niej jedynym Właścicielem: sam konfiguruje Agentów, Dostawców modeli i swojego bota Telegrama. Nie ma kont, ról, współdzielenia instalacji ani serwera centralnego. Nikt inny, łącznie z autorami projektu, nie ma dostępu do cudzej instalacji. Odrzuciliśmy wariant wieloużytkownikowy, bo wymagałby logowania, ról i rozdzielenia pamięci między ludźmi, czyli osobnego produktu.

## Konsekwencje

- Instalacja działa tylko wtedy, gdy komputer Właściciela jest włączony (zob. ADR 0005).
- Parowanie Telegrama wiąże bota z jednym Właścicielem. Wiadomości od kogokolwiek innego są ignorowane.
- Projekt nie zbiera danych użytkowników. Telemetria, jeśli kiedyś powstanie, wymaga jawnej zgody.
