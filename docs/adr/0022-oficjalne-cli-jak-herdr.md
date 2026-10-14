# Subskrypcje przez oficjalne CLI uruchamiane w terminalu Overmind (jak w herdr)

Overmind nie oferuje logowania do Claude, ChatGPT ani innych usług i nie traktuje limitów subskrypcji jako swojej funkcji. Wykrywa zainstalowane oficjalne CLI (np. `claude`, `codex`) i uruchamia je w swoich terminalach, wewnątrz izolacji z ADR 0020. Właściciel loguje się w nich sam. Agenci tacy jak Developer czy Tester pracują w tych terminalach. Ten sam model stosuje herdr. Wybraliśmy go zamiast logowania w aplikacji, bo Anthropic nie pozwala zewnętrznym produktom oferować logowania do claude.ai ani limitów subskrypcji. Klucze API i Ollama pozostają alternatywą w tej samej aplikacji.

## Konsekwencje

- Terminale dla CLI zapewnia herdr (ADR 0026).
- Overmind nigdy nie widzi haseł ani tokenów subskrypcji. Zostają w oficjalnym CLI.
- Limity i czas resetu Overmind pokazuje tylko tak, jak raportuje je samo CLI, z oznaczeniem źródła.
- Limit subskrypcji jest wspólny dla wszystkich Agentów na danym CLI. Gdy się kończy, Chief przełącza Agentów na model zapasowy (drugie CLI albo Ollama) i wysyła powiadomienie. Gdy zapasowego modelu nie ma, następuje Eskalacja.
- Potwierdzone w prototypie: logowanie subskrypcją Claude (Max) i Codex (ChatGPT) działa wewnątrz kontenera, a CLI wykonują Zadania na subskrypcji.
- Logowanie z przekierowaniem na `localhost` nie przechodzi samo przez granicę kontenera. Kreator prowadzi Właściciela metodami bez przekierowania (wklejany kod w Claude, kod urządzenia w Codex, jeśli Właściciel go włączy na koncie) albo przekierowuje port logowania przez środowisko kontenerów, tylko na czas logowania. Kod logowania nie przechodzi przez proces Overmind i nie trafia do logów.
- Wygaśnięcie logowania (np. `401 OAuth token expired`) Overmind rozpoznaje jako osobny stan i prosi Właściciela o ponowne zalogowanie się w CLI.
- Agenci pracują w CLI w trybie automatycznym (w Claude Code to dziś tryb domyślny). Granicę wyznacza izolacja, a Zgody Overmind obejmują akcje z ADR 0021. Okno zgody, które CLI mimo to wyświetli, Overmind zamienia na Zgodę z podglądem zmiany.
- Automatyczne wysyłanie poleceń do CLI to obszar, w którym dostawcy mogą zmienić zasady. Ryzyko trzeba okresowo sprawdzać.
