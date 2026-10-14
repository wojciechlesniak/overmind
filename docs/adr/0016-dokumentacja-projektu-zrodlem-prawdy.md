# Dokumentacja projektu i Reguły Właściciela są źródłem prawdy

Właściciel ustala z Chiefem projekt (rozmową, przekazaną dokumentacją albo własnym planem) oraz Reguły Właściciela, np. „wszystko ma być przetestowane” albo „test penetracyjny po każdym Zadaniu”. Od tego momentu Chief działa samodzielnie: prowadzi Dyskusje z Agentami, dzieli projekt na Zadania i je rozdziela. Właściciel niczego nie dotyka, dopóki Chief go nie zawoła. Każde Zadanie musi wynikać z Dokumentacji projektu. Agenci nie dodają zakresu od siebie, nawet gdy w Dyskusji uznają to za dobry pomysł.

Chief jest głównym decydującym w codziennej pracy, ale głównodowodzącym pozostaje Właściciel.

## Konsekwencje

- Kolejność pierwszeństwa: Reguły Właściciela, potem Dokumentacja projektu, potem Decyzje Chiefa, a na końcu Pamięć agenta. Nic, co Agent zapamiętał, nie może osłabić Reguły Właściciela.
- Zadanie bez powiązania z Dokumentacją projektu jest odrzucane albo wymaga Eskalacji.
- Dokumentacja projektu to pliki Markdown w folderze projektu (Dozwolonym katalogu), wersjonowane w Gicie, wspólne dla Chiefa i Agentów (jak pliki współdzielone przez boty w Grok Bot). Zadanie wskazuje miejsce w Dokumentacji, z którego wynika.
- Luki w Dokumentacji: brak odpowiedzi na pytanie „jak” (np. wybór biblioteki) Chief rozstrzyga sam i zapisuje jako Decyzję. Brak odpowiedzi na pytanie „co” (np. czy ma być logowanie przez Google) zawsze idzie do Właściciela.
- Zmienić Reguły Właściciela i Dokumentację projektu może tylko Właściciel. Chief może jedynie zaproponować zmianę.
