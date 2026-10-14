# Workflow jest wykonywalnym programem, a nie diagramem

Workflow to program złożony z Węzłów (IF/ELSE, pętle, równoległe gałęzie, Dyskusje, Review, Quality Gate), który Właściciel układa sam, zamiast jednego sztywnego pipeline'u. Wykonuje go osobny runtime. Edytor wizualny tylko tworzy i pokazuje graf, nigdy go nie uruchamia. Każdy Run przypina niezmienną Wersję workflow, więc edycja w trakcie Runu tworzy nową Wersję i nie zmienia działającego Runu.

## Konsekwencje

- Cykle są dozwolone tylko jako jawny Węzeł Loop (albo kontrolowana deklaracja cyklu) z limitem iteracji, czasu i kosztu oraz wyjściem `onExhausted`. Surowa krawędź wstecz to błąd walidacji.
- Warunki rozgałęzień operują na danych strukturalnych, a nie na swobodnym tekście modelu.
- Zmiana planu w trakcie Runu (np. polecenie z Telegrama) nie modyfikuje Runu w locie. Wymaga nowej Wersji i nowego Runu albo kontynuacji od checkpointu.
