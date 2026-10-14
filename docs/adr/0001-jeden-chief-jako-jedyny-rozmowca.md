---
status: superseded by ADR-0023
---

# Jeden Chief jako jedyny rozmówca Właściciela

Właściciel rozmawia wyłącznie z Chiefem, zarówno na desktopie, jak i na Telegramie. Nie rozmawia bezpośrednio z poszczególnymi Agentami. Chief sam odpowiada na proste pytania, a Zespół uruchamia tylko wtedy, gdy zadanie tego wymaga. Komunikacja między Agentami nie wymaga udziału Właściciela. Wybraliśmy jeden punkt kontaktu zamiast wielu rozmów równolegle, bo wtedy cały plan, status i odpowiedzialność są w jednym miejscu.

## Konsekwencje

- Chief jest wąskim gardłem kontekstu: musi umieć streszczać stan Runów i Zespołów, a nie przekazywać surowe logi.
- Podgląd rozmów między Agentami (Activity) służy do obserwacji, nie jest kanałem wydawania poleceń.
