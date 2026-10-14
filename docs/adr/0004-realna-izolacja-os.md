# Ograniczenia dostępu egzekwuje system operacyjny, nie interfejs

Ustawienie w UI nie izoluje niczego: Agent z nieograniczonym shellem lub sterowaniem desktopem może wyjść poza Dozwolone katalogi. Dlatego każde Narzędzie z efektami ubocznymi działa w realnej izolacji systemowej (sandbox, kontener, ograniczony użytkownik lub proces), osobno zaprojektowanej i przetestowanej na każdym systemie. Gdy izolacji nie da się zapewnić, akcja jest blokowana albo wymaga świadomie włączonego trybu podwyższonego ryzyka.

## Konsekwencje

- Testy ucieczki z sandboxa są częścią kryteriów odbioru, nie dodatkiem.
- Treść stron, repozytoriów i dokumentów to dane, nie polecenia (ochrona przed prompt injection).
- Sekrety leżą w systemowym magazynie kluczy, nigdy w promptach ani logach.
- Konkretny mechanizm na każdy system i zakres automatyzacji GUI pozostają otwarte.
