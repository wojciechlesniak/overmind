# Styl wizualny Overmind

Status: wybrany 2026-10-13 · źródło: projekt w Claude Design „Overmind — widoki aplikacji”.

Wybrano **Styl 1 — ciemny fiolet z neonem**. Pozostałe warianty (Styl 2–5, Precyzyjny instrument) zostają na canvasie w sekcji „Archiwum” jako odrzucone kierunki.

## Logo: Plaster

Wybrane 2026-10-13 spośród 10 propozycji i 6 wariantów drugiej rundy (plansze „Logo” na canvasie).

- **Znak:** cztery sześciokątne komórki plastra. Górna jest wypełniona i oznacza Chiefa, trzy pod nią to kontury i oznaczają Agentów. Rój z jednym umysłem nad zespołem.
- **Geometria** (viewBox 64×64, sześciokąty z wierzchołkiem u góry, promień 10):
  - komórka wypełniona: środek (32, 16.5);
  - komórki konturowe: środki (23.3, 31.5), (40.7, 31.5), (32, 46.5);
  - grubość konturu 3.2.
- **Kolor:** gradient po przekątnej `#FF8AD8` → `#9B7BFF`.
- **Ikona aplikacji:** znak na zaokrąglonym kwadracie z gradientem `#1E1330` → `#0A0710` i ramką `#5B3E8F`.
- **Gdzie:** lewy pasek (44 px), kreator, menu w pasku (28 px), bot w Telegramie (40 px), Dock i favicon.
- **Unikaj:** organicznego „mózgu-bloba”, bo kojarzy się z Overmindem ze StarCrafta.

## Paleta

| Rola | Kolor |
|---|---|
| Tło aplikacji | `#0A0710` |
| Rail, nagłówek, panele boczne | `#0D0915` / `#0C0814` |
| Karty | `#140F20` / `#160F24`, ramki `#241B36` / `#2A2040`, mocna ramka `#5B3E8F` |
| Tekst | `#EFE9F7`, drugorzędny `#A79BBF`, pomocniczy `#8C80A6` |
| Akcent główny (Chief, aktywny Run, pracuje) | neon magenta `#F25FC4` (jasny `#FFB3E6`) |
| Czeka na Zgodę / pętla powrotu | amber `#FFB547` (jasny `#FFCF85`) |
| Skończył / sukces | mint `#62E3B4` |
| Przyciski główne, zaznaczenie | violet `#9B7BFF` (jasny `#D6C9FF`) |
| Błąd / blokada | `#FF8FA3` |
| Zakładka PUBLICZNY | niebieski `#6FA8FF` |
| Zakładka PRYWATNY | violet `#9B7BFF` |
| Zakładka TOR | mint `#62E3B4` |

## Kafelek Węzła na canvasie

Wzorowany na zrzucie referencyjnym:
- ramka 2 px w kolorze typu i stos dwóch kart pod spodem;
- **zakładka typu** w lewym górnym rogu, wypełniona kolorem: PUBLICZNY, PRYWATNY, TOR · BUILD/QA/REVIEW, DYSKUSJA;
- **zakładka Skilli** w prawym górnym rogu („2 skille”) — to cel przeciągania. Podczas przeciągania ma przerywaną magentową ramkę i napis „upuść → 1 skill”;
- ikona w lewym górnym rogu, nazwa duża na środku, pod nią krótki stan w kolorze stanu;
- pigułka z awatarem Agenta i modelem nachodząca na dolną krawędź;
- porty (kółka) na lewej i prawej krawędzi;
- stan Runu jako poświata: magenta = pracuje, amber = czeka na Zgodę, violet = zaznaczony.

Grupy (pętla, Tory Tablicy) to zaokrąglona ramka z opisem w lewym górnym rogu, np. „Pętla jakości · Build → QA → Review · iteracja 2 z 5”.

## Typografia

- Nagłówki i UI: Bricolage Grotesque
- Etykiety techniczne, ścieżki, statusy, zakładki: JetBrains Mono

## Szkielet aplikacji

**Lewy pasek: logo i 7 ikon.**
- Na górze: Workspace'y (pulpit), Chief (czaty z Chiefem i Agentami oraz Dyskusje), Workflow (canvas oraz Runy i Activity), Tablica Zadań, Rejestr decyzji.
- Pod kreską: Agenci (Agenci i biblioteka Skilli).
- Na samym dole: Ustawienia (ten Workspace, Połączenia i modele, ustawienia aplikacji).

**Zakładki pod nagłówkiem** w ekranach z kilkoma częściami:
- Workflow: Canvas | Runy i Activity;
- Agenci: Agenci | Skille;
- Ustawienia: Ten Workspace | Połączenia i modele | Aplikacja.

**Gdzie trafiły pozostałe funkcje:**
- Zgody i Prośby o dostęp mają przycisk z licznikiem w górnym pasku („3 czekają”), bo to sprawy pilne.
- Dyskusje są na liście rozmów u Chiefa.
- Bezpośrednie czaty z Agentami też są na liście rozmów u Chiefa.

**Górny pasek:** przełącznik Workspace'u i ścieżka, limit subskrypcji „wg CLI”, „Agenci N z 3 naraz”, stan Telegrama, Zgody, Global Pause.

Ekrany mają stałą wysokość okna i przewijają się wewnątrz paneli.

## Widoki (Claude Design, Styl 1)

1. Kreator · 1. Dozwolony folder
2. Kreator · 2. CLI i izolacja
3. Pulpit — Workspace'y, podsumowanie Chiefa, powiadomienia, stan systemu
4. Chief i czaty
5. Bezpośredni czat z Agentem
6. Workflow (canvas) — kafelki jak wyżej, panel Skilli, paleta Węzłów, legenda zakładek, pas „Chief nadzoruje”, inspektor z Widocznością
7. Tablica Zadań
8. Dyskusja na żywo
9. Rejestr decyzji
10. Agenci — z Widocznością i Agentem dynamicznym (prywatnym) do akceptacji
11. Biblioteka Skilli — filtry „Publiczne / Prywatne”
12. Zgody i Prośby o dostęp
13. Activity i ślad Runu
14. Workspace — w tym lista elementów prywatnych
15. Połączenia i modele
16. Ustawienia
17. Menu w pasku (tray)
18. Telegram

## Zasady

- Liczby zawsze z jednostką słowną („3 decyzje”, „2 skille”), bez samych symboli.
- Kolor stanu ma też ikonę lub tekst — nie polegamy na samym kolorze.
- Limity subskrypcji zawsze z dopiskiem „wg CLI”.
- Widoczność zawsze słowem (PUBLICZNY / PRYWATNY), nigdy samym kolorem (ADR 0028).
- Lewy pasek ma tylko miejsca, do których wraca się codziennie. Podsekcje idą do zakładek, a sprawy pilne do górnego paska.
