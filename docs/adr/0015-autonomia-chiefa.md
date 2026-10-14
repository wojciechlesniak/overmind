# Chief rozstrzyga sam w granicach Budżetu i Dokumentacji projektu

Gdy Dyskusja kończy się bez porozumienia albo trzeba wybrać między wariantami, Chief rozstrzyga sam, o ile decyzja mieści się w Budżecie, zgadza się z Dokumentacją projektu i nie narusza Reguł Właściciela (ADR 0016). W przeciwnym razie następuje Eskalacja do Właściciela. Każde takie rozstrzygnięcie trafia do Rejestru decyzji z argumentami wszystkich stron. Wybraliśmy autonomię zamiast pytania Właściciela o wszystko, bo inaczej praca w tle (ADR 0005) stawałaby przy każdym sporze Agentów.

## Konsekwencje

- Dyskusja wpisana w Workflow jako Węzeł rusza bez pytania.
- Gdy Chief sam uzna w trakcie pracy, że coś wymaga przedyskutowania, wstrzymuje dany Run (albo jego gałąź), wysyła Właścicielowi powiadomienie i czeka na jego decyzję. Pozostałe Runy i Workspace'y pracują dalej.
- Właściciel może podglądać Dyskusję na żywo i pisać w niej bezpośrednio. Jego głos rozstrzyga (ADR 0023).
