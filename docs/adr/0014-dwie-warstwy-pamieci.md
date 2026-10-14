# Dwie warstwy pamięci: Pamięć agenta i Pamięć wspólna

Wzorem Grok Bot każdy Agent stały ma własną trwałą Pamięć agenta: rolę, ustawienia i streszczenia wcześniejszych Zadań, których się trzyma między Runami. Obok niej działa Pamięć wspólna, czyli Tablica Zadań i Rejestr decyzji. Odrzuciliśmy wariant, w którym pamięcią jest wyłącznie Tablica i Rejestr: Agenci zaczynaliby wtedy każde Zadanie od zera i nie budowaliby specjalizacji.

## Konsekwencje

- Agenci widzą tylko Workspace, w którym aktualnie pracują. Do innych Workspace'ów i ich Decyzji sięga wyłącznie Chief, z wyjątkiem Workspace'ów izolowanych.
- Właściciel może przeglądać Pamięć agenta każdego Agenta, ale jej nie edytuje. Zachowanie Agentów koryguje się Regułami Właściciela.
- Pamięć agenta nigdy nie ma pierwszeństwa przed Regułami Właściciela ani Dokumentacją projektu (ADR 0016).
- Agent dynamiczny zapisany jako Agent stały zachowuje pamięć z zadania, dla którego powstał.
- Pamięć agenta jest lokalna, w instalacji Właściciela, nigdy u Dostawcy modelu. Do modelu trafia tylko to, co potrzebne w danym Zadaniu.
