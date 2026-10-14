# Własny silnik Workflow zamiast gotowego frameworka

Workflow wykonuje własny, mały silnik w TypeScripcie, a nie gotowy framework, taki jak LangGraph. Nasze reguły są specyficzne: Loop z limitami iteracji, czasu i kosztu, Join z quorum, wstrzymanie pojedynczego Runu lub gałęzi, Zgody, przypięte Wersje workflow i niepowtarzanie akcji nieidempotentnych. Framework wymagałby obchodzenia go, a LangGraph wprowadziłby do projektu Pythona.

## Konsekwencje

- Stan Runu jest zapisywany jako ciąg zdarzeń w SQLite. Z niego odtwarza się checkpointy, wznowienie po restarcie i podgląd przebiegu.
