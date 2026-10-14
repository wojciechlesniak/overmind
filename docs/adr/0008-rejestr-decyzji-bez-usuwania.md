# Rejestr decyzji: tylko dopisywanie, wyszukiwanie zamiast trenowania

Pamięć organizacyjna to przeszukiwalny Rejestr decyzji: problem, alternatywy, uzasadnienie, uczestnicy, dowody, a później Wynik decyzji. Nie jest to trenowanie ani dostrajanie modeli. Decyzji się nie usuwa ani nie nadpisuje. Nowa Decyzja zastępuje starą (`supersedes`), więc historia zostaje.

## Konsekwencje

- Chief przy odwoływaniu się do dawnych Decyzji pokazuje źródła i niepewność. Nie ocenia Decyzji bez dowodów.
- Chief automatycznie przeszukuje Decyzje ze wszystkich Workspace'ów, z wyjątkiem Workspace'ów izolowanych (np. projekt klienta pod NDA), których Decyzje nie wychodzą na zewnątrz.
- Chief na bieżąco zbiera dowody i proponuje Wynik decyzji. Werdykt wydaje Właściciel i może go później zmienić, a historia zmian zostaje.
- Każde użycie Skilla w Dyskusji lub Runie zapisuje, którego Skilla i której wersji użył Agent. Bez tego złej Decyzji nie da się później powiązać z instrukcją, z której wynikła.
- Wyjątek od zasady „tylko dopisywanie”: Właściciel może usunąć cały Workspace razem z jego Decyzjami, Tablicą Zadań i Pamięcią agentów z tego Workspace'u. Wymaga to Zgody lokalnej z ostrzeżeniem. Zasada chroni historię przed Agentami i przypadkowymi zmianami, a nie przed Właścicielem.
- Overmind codziennie robi kopię bazy do folderu wskazanego przez Właściciela i pozwala na ręczny eksport.
