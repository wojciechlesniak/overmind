---
id: OVE_ONB012
title: "Build wizard step 1 static UI: folder picker and permission checklist"
area: ONB
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS022, OVE_DS031, OVE_DS074, OVE_ONB011]
soft_depends_on: []
provides: ["ui:FolderStepView"]
needs: ["ui:FolderPicker", "ui:PermissionChecklist", "ui:Card", "ui:SectionLabel"]
owns: ["apps/desktop/src/features/onboarding/steps/folder/FolderStepView.tsx", "apps/desktop/src/features/onboarding/steps/folder/folder.fixtures.ts", "apps/desktop/src/features/onboarding/steps/folder/truncate-middle.ts", "apps/desktop/src/features/onboarding/steps/folder/index.ts", "apps/desktop/src/features/onboarding/steps/folder/FolderStepView.stories.tsx", "apps/desktop/src/locales/en/onboarding-folder.json", "apps/desktop/src/locales/pl/onboarding-folder.json"]
reads: []
design: design.png
design_source: "Kreator-Folder#onb1/folder-picker + onb1/permissions-panel (crop 416,210,968,340); design-footer.png = onb/footer-actions (crop 416,480,968,62)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [3, 21]
---

# OVE_ONB012: Build wizard step 1 static UI: folder picker and permission checklist

## 1. Summary

Implements the visual content of step 1 'Wskaż folder, w którym Agenci mogą pracować' from `ui:FolderPicker` and `ui:PermissionChecklist` with fixtures: the two-column layout (folder tree card and the magenta rights panel), all copy in Polish and English, and the visible states of the mock (parent expanded, selected child, unselected, rights read and write checked, execute unchecked).

## 2. Context

`Kreator-Folder.png`: title 'Wskaż folder, w którym Agenci mogą pracować', lead 'Agenci widzą tylko foldery z tej listy. Resztę Maca blokuje izolacja systemu, nie przełącznik w aplikacji. Bez folderu nie mają dostępu do niczego.', left card (491x250 at x=416,y=217) with parent row `~/Projects` and children `aplikacja-rezerwacji` (selected, violet tint, check), `fundacja-www`, `shared-ui`, then a dashed 'Wybierz w Finderze…' button; right card (459x250 at x=925) with heading 'PRAWA DLA ~/Projects/aplikacja-rezerwacji' and three rows Odczyt, Zapis, Wykonywanie with descriptions and the footnote 'Kolejne foldery dodasz później w ustawieniach Workspace'u albo po Prośbie Agenta.'. DS074 provides the components. This task places them and verifies the pixels; data wiring is ONB013.

## 3. Scope (in)

- `FolderStepView` (presentational) with props `{ nodes, selectedId, rights, onSelect, onToggleRight, onPickInFinder, loading, error, warning }`.
- Step definition `steps/folder/index.ts` with `titleKey` and `leadKey` (registry of ONB011) and a static `Component` that renders `FolderStepView` with fixtures until ONB013 wires it (the file split keeps both tasks independent: `FolderStep.tsx` is owned by ONB013).
- `locales/{en,pl}/onboarding-folder.json` with the step 1 copy catalogue (below).
- Stories: Mock, NoSelection, Loading, Error, WriteExecuteWarning.
- Fixtures `folder.fixtures.ts` matching the mock.

## 4. Out of scope

- Data and behaviour (ONB013).
- The footer buttons (host, ONB011).
- Validation messages from the engine (ONB013 supplies them as props).

## 5. Detailed requirements

1. **Layout.** Two columns inside the content width 968: left 491, gap 34, right 459 (DS `contentMaxWidth` 968); both cards 250 px high at 1440x900; on narrower widths the columns stack at < 1100 content width (DS decides; this task uses a CSS grid with `grid-template-columns: minmax(0, 491fr) minmax(0, 459fr)`).
2. **Left card.** `ui:FolderPicker` with `nodes` (parent depth 0 expanded, children depth 1), `selectedId`, labels `tree` 'Foldery, w których Agenci mogą pracować' (EN 'Folders where Agents can work') and `pickInFinder` 'Wybierz w Finderze…'. Rows are mono 13; selected row has the violet tint and check; the picker is a radiogroup (DS).
3. **Right card.** `ui:PermissionChecklist` with `folderLabel`, `heading` 'PRAWA DLA {{path}}' (EN 'RIGHTS FOR {{path}}'; the path is middle-truncated by `truncateMiddle(path, 46)` helper in this task with the full value in `title`), items: `read` 'Odczyt' / 'Agenci czytają pliki projektu.'; `write` 'Zapis' / 'Zmiany w osobnych worktree, nigdy wprost na main.'; `execute` 'Wykonywanie' / 'Uruchamianie skryptów z tego folderu.'; `footnote` 'Kolejne foldery dodasz później w ustawieniach Workspace'u albo po Prośbie Agenta.'.
4. **Warning (state not in the mock).** When `write && execute`: the Execute row shows the amber line 'Zapis + wykonywanie pozwala Agentom uruchamiać zmieniony kod.' (DS074 req. 4).
5. **Empty selection (not in the mock).** No `selectedId`: the right card shows the heading 'PRAWA' with the muted hint 'Najpierw wybierz folder.' and all checkboxes disabled and unchecked (EN 'Choose a folder first.'); Next disabled by ONB013.
6. **Loading and error.** Loading uses the DS skeleton rows (3); error uses the DS inline error text with the Finder button still usable.
7. **Read row.** Rendered checked and `disabled` with the tooltip/description suffix 'Zawsze włączone' (EN 'Always on'): a folder without read access is meaningless (ONB001 rule). DESIGN GAP: the mock shows an ordinary enabled checkbox; the disabled look is the DS disabled token.
8. **Copy catalogue (`onboarding-folder.json`, EN | PL):** `title` Choose the folder where Agents can work | Wskaż folder, w którym Agenci mogą pracować; `lead` Agents see only folders from this list. The rest of your Mac is blocked by system isolation, not by a switch in the app. Without a folder they have access to nothing. | (mock text); `tree.label`, `pickInFinder`, `rights.heading`, `rights.read.label/description`, `rights.write.*`, `rights.execute.*`, `rights.alwaysOn`, `rights.footnote`, `rights.warning.writeExecute`, `rights.empty`, `error.list`, `error.retry`, `reject.system_path` 'To folder systemowy. Wybierz folder projektu.', `reject.outside_home` 'Folder musi leżeć w Twoim katalogu domowym.', `reject.sensitive` 'Ten folder zawiera klucze lub dane aplikacji. Nie może być dostępny dla Agentów.', `reject.symlink` 'To dowiązanie prowadzi poza katalog domowy.', `reject.already_added` 'Ten folder jest już dodany do Workspace'u.', `reject.not_a_directory`, `reject.unreadable` 'Brak dostępu do folderu. Sprawdź uprawnienia macOS.', `reject.expired`, `rootHint.empty` 'Nie znaleziono ~/Projects. Wybierz folder w Finderze.'; `next.disabledNoFolder` 'Wybierz folder, żeby przejść dalej.'.
9. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` crops the step 1 content region (folder card and rights card). Reproduce the dimensions: cards 250 px high, left 491 wide, right 459 wide, 34 px gap, selected row violet tint with check, magenta-bordered rights card, dashed Finder button. `design-footer.png` shows the footer row (Back is hidden on step 1 by decision). Not in the mock: loading, error, no selection, write+execute warning, reject reasons, focus/hover, Back hidden.

## 7. Reuse

- `ui:FolderPicker`, `ui:PermissionChecklist`, `ui:Card`, `ui:SectionLabel` (DS074/031); copy keys; `truncateMiddle` local helper (pure).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/folder/{FolderStepView.tsx,folder.fixtures.ts,truncate-middle.ts,index.ts}` and `apps/desktop/src/locales/{en,pl}/onboarding-folder.json`, stories `FolderStep.stories.tsx`. Presentational layer.

## 9. Security and safety

- Paths are rendered as text only; no link opening; the display path comes from the engine (never built in the UI).
- No data leaves the component; callbacks only.

## 10. Errors and edge cases

- Very long folder names: ellipsis with `title`.
- More than 50 children: engine caps at 50; the card scrolls internally (DS).
- Heading path longer than 46 characters: middle truncation.
- RTL or emoji names: rendered as text, layout unaffected.
- Narrow window: stacking per CSS grid.

## 11. Acceptance criteria

- [ ] Given the mock fixture then the view matches `design.png` within tolerance.
- [ ] Given no selection then the rights card shows the hint and disabled checkboxes.
- [ ] Given write and execute checked then the amber warning appears.
- [ ] Given keyboard use then arrows move in the radiogroup and Space selects; Tab reaches the rights checkboxes and the Finder button.
- [ ] Given PL and EN then all strings come from `onboarding-folder.json`.

## 12. Test plan

- Storybook stories with play tests; visual snapshots vs `design.png`; Vitest for `truncateMiddle`; axe.
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/folder`.

## 13. Parallelization notes

After ONB011 (registry) and DS074. Parallel with ONB014. ONB013 depends on the view and the copy catalogue.

## 14. Open questions and assumptions

- DESIGN GAP: Back hidden on step 1 (E24); read row disabled-checked; reject copy is proposed.
- OPEN: PL copy for reject reasons to be reviewed by the Owner.
