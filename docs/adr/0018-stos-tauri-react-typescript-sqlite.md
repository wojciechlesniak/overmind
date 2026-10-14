# Stos: Tauri, React, TypeScript i SQLite

Okno aplikacji powstaje w Tauri, interfejs w React + TypeScript (canvas na React Flow), a silnik jako osobny proces w TypeScripcie z bazą SQLite na dysku Właściciela. Wybraliśmy jeden język dla całego projektu, żeby obniżyć próg wejścia dla kontrybutorów. Tauri jest lżejsze od Electrona. Odrzuciliśmy Rust w silniku (jak w herdr), bo dzieliłby projekt na dwa języki.

## Konsekwencje

- Silnik musi być spakowany jako samodzielny plik wykonywalny, uruchamiany niezależnie od okna (ADR 0005).
