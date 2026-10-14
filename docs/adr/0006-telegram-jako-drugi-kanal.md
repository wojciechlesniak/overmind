# Telegram to drugi Kanał do tego samego Chiefa, z mniejszymi prawami

Telegram nie jest osobnym botem. Prowadzi do tego samego Chiefa, z tą samą pamięcią, zadaniami i statusem Runów co desktop. Z Telegrama można wydawać polecenia, pytać o postęp, dostawać powiadomienia i udzielać Zgód na dozwolone działania. Nie można przez niego rozszerzać uprawnień na stałe. Prośbę o dostęp można zatwierdzić z Telegrama, ale tylko na bieżący Run; stałe dodanie katalogu wymaga Zgody lokalnej. Wybraliśmy ten kompromis, żeby Agent nie stał godzinami, gdy Właściciela nie ma przy komputerze, a przejęty telefon nie dawał trwałego dostępu. Konto łączy się z instalacją przez Parowanie jednorazowym kodem z desktopu.

## Konsekwencje

- Rozmowy z botem Telegrama nie są szyfrowane end-to-end, więc żadne sekrety tamtędy nie przechodzą.
- Przez Telegram można rozmawiać także z poszczególnymi Agentami, przez wzmiankę `@agent` w tym samym bocie (ADR 0023).
- Desktop i Telegram muszą zawsze pokazywać ten sam stan, czyli jedno źródło prawdy w engine.
