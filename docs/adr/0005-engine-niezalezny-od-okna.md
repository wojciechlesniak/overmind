# Engine działa niezależnie od okna aplikacji

Zamknięcie okna nie zatrzymuje Runów. UI i engine to osobne procesy połączone uwierzytelnionym lokalnym kanałem, a tray pokazuje status i pozwala wstrzymać lub wznowić pracę. Praca nie trwa po uśpieniu ani wyłączeniu komputera. Świadomie nie robimy wersji chmurowej: wszystko, łącznie z Chiefem na Telegramie, działa na komputerze Właściciela.

## Konsekwencje

- Stan Runów jest trwały (checkpointy), a po restarcie engine wznawia pracę.
- Akcje nieidempotentne (wysłanie wiadomości, commit, płatność) nigdy nie są ślepo powtarzane po awarii.
- Gdy komputer śpi lub jest wyłączony, Chief nie odpowiada na Telegramie.
