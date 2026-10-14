# Widoczność: publiczny albo prywatny

Agent stały, Skill i Workflow mają Widoczność. **Publiczny** jest dostępny we wszystkich Workspace'ach. **Prywatny** istnieje tylko w Workspace, w którym powstał: nie widać go gdzie indziej, a Chief nie proponuje go w innych Workspace'ach. Na kafelku Węzła Widoczność pokazuje zakładka w lewym górnym rogu (PUBLICZNY / PRYWATNY), a Węzeł przypięty do Toru Tablicy ma zakładkę TOR.

Pomysł pochodzi z zakładek PUBLIC i LANE na referencyjnym canvasie. Bez tego rozróżnienia każdy Agent i Skill trafiałby do wspólnej biblioteki. To zaśmieca ją elementami z jednego projektu i utrudnia trzymanie rzeczy specyficznych dla klienta tylko u niego.

## Zasady

- Domyślnie: Agent stały i Skill utworzone przez Właściciela są publiczne. Agent dynamiczny, Skill zaproponowany przez Chiefa i nowy Workflow są prywatne.
- Widoczność zmienia tylko Właściciel. Chief może zaproponować upublicznienie, np. Skilla, który sprawdził się w kilku Runach.
- W Workspace izolowanym wszystko jest prywatne i nie da się tego zmienić. Publiczne elementy z innych Workspace'ów można w nim używać.
- Przypisanie Skilla przeciągnięciem na kafelek działa wszędzie tam, gdzie widać oba elementy. Prywatny Skill na publicznym Agencie działa więc tylko w swoim Workspace.
- Widoczność nie zmienia granic pamięci. Pamięć agenta publicznego nadal jest osobna dla każdego Workspace'u (ADR 0014) i nie zmienia uprawnień (ADR 0003).
- Upublicznienie lub uprywatnienie tworzy nową wersję konfiguracji. Działające Runy korzystają z wersji przypiętej (ADR 0002).

## Konsekwencje

- Encje Agent, Skill i Workflow dostają pole `visibility` (`public` | `private`) oraz `ownerWorkspaceId` dla prywatnych.
- Biblioteka Skilli i lista Agentów filtrują po Widoczności, a canvas pokazuje ją na każdym kafelku.
- Uprywatnienie elementu używanego w innym Workspace jest blokowane, dopóki go stamtąd nie usuniesz.
