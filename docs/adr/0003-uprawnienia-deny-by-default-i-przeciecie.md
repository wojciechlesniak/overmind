# Uprawnienia: domyślnie brak dostępu, Efektywne uprawnienia jako przecięcie

Jedynym źródłem uprawnień jest Właściciel: to on wskazuje Dozwolone katalogi (odczyt, zapis, opcjonalnie wykonanie), Chrome, symulatory, sieć, Git i MCP. Wszystko inne jest zabronione. Efektywne uprawnienia Agenta w Runie to część wspólna polityk Właściciela, Workspace'u, Agenta, Workflow i Narzędzia, nigdy ich suma. Dzięki temu delegowanie zadania (Chief → Team Lead → Agent, Węzeł nadpisujący model) może prawa tylko zawężać.

## Konsekwencje

- Pusta lista Dozwolonych katalogów oznacza brak dostępu. Przy pierwszym uruchomieniu kreator prosi Właściciela o wskazanie folderu.
- Ani Chief, ani żaden Agent nie może sam rozszerzyć uprawnień, także przez delegowanie zadania. Może jedynie złożyć Prośbę o dostęp.
- Zgoda na Prośbę o dostęp udzielona przy komputerze może dodać katalog na stałe do Workspace'u. Zgoda z Telegrama obowiązuje tylko w bieżącym Runie (zob. ADR 0006).
- Próby naruszeń są logowane. Ścieżki są kanonizowane, a symlinki i mounty sprawdzane.
- Przypisanie Skilla nie daje dostępu do żadnego Narzędzia.
