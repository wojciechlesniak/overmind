---
id: OVE_ONB037
title: "Build step 3 extras static UI: documentation link section and Chief greeting preview"
area: ONB
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS009, OVE_DS013, OVE_DS015, OVE_DS017, OVE_DS031, OVE_DS032, OVE_DS040, OVE_DS046, OVE_DS051, OVE_ONB011, OVE_ONB031]
soft_depends_on: ["OVE_ONB019"]
provides: ["ui:DocumentationLinkSectionView", "ui:ChiefGreetingPreviewView"]
needs: ["ui:Card", "ui:Button", "ui:IconButton", "ui:InfoNote", "ui:Pill", "ui:Skeleton", "ui:EmptyState", "ui:MessageBubble", "ui:KeyValueList", "ui:Icon"]
owns: ["apps/desktop/src/features/onboarding/steps/workspace/extras/views/**", "apps/desktop/src/locales/en/onboarding-workspace-extras.json", "apps/desktop/src/locales/pl/onboarding-workspace-extras.json"]
reads: ["apps/desktop/src/features/onboarding/steps/workspace/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [16, 23]
---

# OVE_ONB037: Step 3 extras static UI

## 1. Summary

Props-driven presentational components for two optional blocks of wizard step 3: choosing Project Documentation and previewing the first Chief greeting. No data fetching; the wiring is ONB038. They sit beneath the name and isolation form of ONB019.

## 2. Context

There is NO mock for steps 3 and 4 (only `Kreator-Folder.png` and `Kreator-Polaczenia.png` exist). The visual of these components MUST follow steps 1-2: same `ui:WizardLayout` content column, `ui:Card` surfaces with the same padding and border tokens as the step 1 permission card, section headings in the small uppercase style of step 1's 'PRAWA' heading (check `COMPONENT-INVENTORY.md` for the exact heading variant), `ui:Pill` for kinds. A design review is needed once the Owner provides a mock (open question). Glossary: Dokumentacja projektu; the Chief greets in the Owner's language.

## 3. Scope (in)

- `DocumentationLinkSectionView` with states: loading, empty (no suggestions), suggestions list (radio-like selection), linked (shows the linked file with 'Zmień' and 'Usuń link'), error, and a 'Wybierz plik…' button.
- `ChiefGreetingPreviewView`: a `ui:MessageBubble` in the Chief variant with the greeting text and a caption.
- Stories with fixtures, i18n files.

## 4. Out of scope

- Data, mutations, native file dialog: ONB038. Backend: ONB033, ONB036.
- Adding a variant to ui-kit if missing (record it in section 14, do not create it here).

## 5. Detailed requirements

1. **Section copy (PL proposed; EN keys in file).** Heading 'DOKUMENTACJA PROJEKTU (OPCJONALNIE)' (`docs.heading`). Lead 'Chief planuje z Dokumentacji projektu. Wskaż plik z opisem projektu, a każde Zadanie będzie do niego odsyłać. Możesz to zrobić później.' (`docs.lead`). Button 'Wybierz plik…' (`docs.pick`). Empty: 'Nie znaleziono plików Markdown w tym folderze.' (`docs.empty`). Linked row actions 'Zmień' / 'Usuń link' (`docs.change`, `docs.unlink`). Truncated note 'Pokazuję tylko część plików.' (`docs.truncated`). Error 'Nie udało się wczytać plików.' + 'Spróbuj ponownie' (`docs.error`, `docs.retry`).
2. **Props.** `DocumentationLinkSectionView = { state: 'loading'|'empty'|'list'|'linked'|'error'; suggestions: { id; relativePath; title?; kind }[]; selectedId?: string; linked?: { relativePath; title? }; truncated?: boolean; busy?: boolean; errorKey?: string; onSelect(id); onPick(); onUnlink(); onRetry() }`. No async inside.
3. **List.** Max 12 rows; each row shows the title (or file name if none) and the relative path in mono; kind `ui:Pill` ('README', 'Specyfikacja', 'ADR', 'Dokument'); selection is a `role="radiogroup"` with arrow-key navigation; selecting calls `onSelect` (linking happens in ONB038, immediately, not on Next, so Next never has a hidden side effect). Long paths truncate in the middle with the full text in `title`.
4. **Plain text only.** Titles and paths are rendered as text nodes; never `dangerouslySetInnerHTML`; RTL and long unbroken strings do not break the layout (`overflow-wrap:anywhere`).
5. **Greeting preview.** Heading 'JAK POWITA CIĘ CHIEF' (`greeting.heading`), bubble with text from props, caption 'Chief napisze to na Pulpicie, gdy skończysz. Możesz to zmienić, zmieniając nazwę lub dokumentację.' (`greeting.caption`). Props `{ state: 'loading'|'ready'|'error'; text?: string }`. Not interactive; `aria-live="polite"` region so changes after rename are announced once, debounced by the wiring.
6. i18n catalogue in the two locale files for all keys above; EN default.
7. Standard UI rules (CONVENTIONS section 9 and DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring; `prefers-reduced-motion` respected; Storybook stories for each state; axe clean.

## 6. Design notes

No `design.png` exists; `design: none`. Compose only from existing components and the product tokens (`--om-*`), following the step 1 and step 2 mocks (Kreator-Folder.png: card, section heading, list of rows with pills; Kreator-Polaczenia.png: row anatomy of `CheckRow`). States not in any mock are derived from DS rules: skeleton rows for loading (`ui:Skeleton`), `ui:EmptyState` compact for empty, focus ring 2px, disabled at 50 percent opacity per DS. Record 'needs design review' in section 14.

## 7. Reuse

`ui:Card`, `ui:Button`, `ui:InfoNote`, `ui:Pill`, `ui:Skeleton`, `ui:EmptyState`, `ui:MessageBubble` (Chief variant), `ui:KeyValueList`, `ui:Icon`. Do not create a new list or radio primitive: if `ui:RadioRow`-like component is missing, use the DS selectable-row pattern used by `ui:FolderPicker` (DS074) rows and record the gap.

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/workspace/extras/views/{DocumentationLinkSectionView.tsx, ChiefGreetingPreviewView.tsx, *.stories.tsx, fixtures.ts}`; UI layer only, no gateway imports.

## 9. Security and safety

- All strings come from the engine and are rendered as text (no markup); paths are display-only relative paths, never canonical.
- No component can trigger a network call; props only.
- No secrets exist in these props.

## 10. Errors and edge cases

- 0, 1 and 12 suggestions; name with 200 characters; path with RTL and emoji; title missing; `busy` disables all actions; error state keeps the previous selection visible.
- Reduced motion: no skeleton shimmer.

## 11. Acceptance criteria

- [ ] Given each state then a story renders it and axe is clean.
- [ ] Given a list when arrow keys are pressed then selection moves and `onSelect` fires once per change.
- [ ] Given a title containing `<img onerror>` then it renders as text.
- [ ] Given a 200-character path then the row does not overflow its card.
- [ ] Given PL and EN then no hard-coded strings remain (key lint).

## 12. Test plan

Testing Library tests per state (`DocumentationLinkSectionView.test.tsx`), keyboard test, XSS-text test, story smoke and axe. Visual regression is NOT applicable (no mock); screenshots recorded for the design review. Command: `pnpm --filter @overmind/desktop test features/onboarding/steps/workspace/extras`.

## 13. Parallelization notes

Parallel with ONB033/ONB036 (contracts only) and ONB039. ONB038 depends on this. Hotspot: none; own namespace file.

## 14. Open questions and assumptions

- OPEN (design): no mock for step 3; a design review of both blocks is required. Default: follow step 1 anatomy as described.
- OPEN (ui-kit): a selectable-row radio group variant may be missing; reuse the FolderPicker row pattern and raise a DS proposal if needed.
- ASSUMPTION: PL copy is proposed and needs Owner confirmation.
