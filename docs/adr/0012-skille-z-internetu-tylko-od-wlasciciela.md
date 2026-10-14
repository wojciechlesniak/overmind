# Skille: Chief może je pisać, ale z internetu dostarcza je tylko Właściciel

Chief może sam tworzyć nowe Skille, np. szczegółową procedurę dla Zadania. Nie może natomiast sam pobierać Skilli z internetu: zewnętrzne Skille (np. społecznościowe, takie jak grill-me) dodaje wyłącznie Właściciel. Skill to instrukcja sterująca zachowaniem Agentów, więc obcy Skill jest głównym wektorem prompt injection. O tym, co obcego wchodzi do instalacji, decyduje człowiek.

## Konsekwencje

- Skille przypisuje się Agentom przeciąganiem na kafelek na canvasie. Przypisanie jest stałe: Agent ma Skill we wszystkich Workflow i Workspace'ach. Agent sam decyduje, kiedy użyć przypisanego Skilla.
- Chief może zaproponować nowy Skill na podstawie udanego, powtarzalnego procesu (jak w Grok Bot). Do biblioteki trafia on dopiero po akceptacji Właściciela. Skill nadal nie daje dostępu do żadnego Narzędzia (ADR 0003).
- Każdy Skill ma wersję i źródło (Właściciel, Chief, import), żeby było wiadomo, skąd wzięła się instrukcja użyta w Runie.
