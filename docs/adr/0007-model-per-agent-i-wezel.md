# Model wybierany per Agent i per Węzeł, z mieszaniem Dostawców

Każdy Agent i każdy Węzeł może mieć własny model od innego Dostawcy modelu (API, CLI albo lokalnie przez Ollama), także w obrębie jednego Workflow. Przykład: Senior Reviewer na mocniejszym modelu, a Developer na tańszym. Wybraliśmy to zamiast jednego modelu dla całej aplikacji, bo różne role mają różny stosunek jakości do kosztu.

## Konsekwencje

- Każdy Dostawca deklaruje, co potrafi (streaming, Narzędzia, JSON, obrazy, anulowanie). Brak funkcji daje czytelny błąd albo skonfigurowany fallback.
- Węzeł może nadpisać model, prompt i Skille, ale nie uprawnienia (zob. ADR 0003).
- Dostawcy przez CLI sami wykonują akcje na komputerze, więc muszą działać w izolacji z ADR 0004.
- Subskrypcja u Dostawcy nie gwarantuje prawa do automatyzacji. Zasady Dostawców trzeba respektować.
