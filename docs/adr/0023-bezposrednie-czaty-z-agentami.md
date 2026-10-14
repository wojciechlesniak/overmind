# Właściciel może rozmawiać z każdym Agentem, a Chief pozostaje koordynatorem

Zastępuje ADR 0001. Wzorem Grok Bot Właściciel ma osobny czat z każdym Agentem, a nie tylko z Chiefem. Może też pisać bezpośrednio w trwającej Dyskusji, gdzie jego głos rozstrzyga. Polecenie wydane Agentowi bezpośrednio jest wiążące, bo Właściciel jest głównodowodzącym. Agent od razu informuje o nim Chiefa, a Chief aktualizuje plan i Tablicę Zadań. Chief nadal planuje, deleguje i raportuje, a Właściciel może prowadzić całą pracę wyłącznie przez niego, jeśli chce.

## Konsekwencje

- Polecenie sprzeczne z Regułami Właściciela albo zmieniające zakres wymaga zmiany Reguł lub Dokumentacji projektu (ADR 0016). Agent nie wykonuje go po cichu.
- Na Telegramie działa jeden bot. Do Agenta zwraca się przez wzmiankę, np. `@tester jak idą testy?`. Bez wzmianki odpowiada Chief.
- Każda rozmowa z Agentem trafia do historii, żeby Chief i Rejestr decyzji widziały, skąd wzięła się zmiana.
