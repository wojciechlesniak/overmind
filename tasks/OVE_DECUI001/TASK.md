---
id: OVE_DECUI001
title: "Decision view-model mappers and the decisions i18n namespace"
area: DECUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_BOARDUI002, OVE_DEC001, OVE_DS040]
soft_depends_on: []
provides: ["lib:decision-view-models"]
needs: ["contract:DecisionView", "contract:DecisionSummary", "contract:Decision", "ui:UiDomainTypes", "ui:stateMaps", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/decisions/model/**", "apps/desktop/src/locales/en/decisions.json", "apps/desktop/src/locales/pl/decisions.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8, 14]
---

# OVE_DECUI001: Decision view-model mappers and the decisions i18n namespace

## 1. Summary

Pure mappers from the Decision contracts (`DecisionSummary`, `DecisionView`, `DecisionEvent`) to the ui-kit props (`DecisionRow`, `DecisionList`, `DecisionDetail`, `AlternativeCard`, `OutcomeCard`) and the shared EN/PL strings of the `decisions` namespace.

## 2. Context

The contracts (OVE_DEC001) use `DecisionStatus = proposed|accepted|rejected|superseded|needs_review`, `Outcome = unknown|positive|mixed|negative`, `confidenceLabel = low|medium|high`, refs `{id, seq, title, workspaceId, workspaceName|null}`, evidence refs of six kinds and an event history. The mock (Decyzje.dc.html) fixes the Polish words: `przyjęta`, `propozycja`, `do przeglądu`, `zastąpiona`, `odrzucona`; outcomes `pozytywny`, `mieszany`, `nieznany`, `negatywny`; section labels `PROBLEM`, `ALTERNATYWY`, `UZASADNIENIE`, `UCZESTNICY`, `SKILLE`, `PEWNOŚĆ`, `ZAŁOŻENIA`, `RYZYKA`, `WYNIK DECYZJI`. ADR 0008 is a hard rule for this whole view: the Decision Register is append-only. There is no delete, no edit-in-place and no `PUT`/`PATCH`/`DELETE` call anywhere in this feature; a correction is a NEW Decision that supersedes the old one.

## 3. Scope (in)

- `decisionSummaryToRow(summary, t)`, `decisionViewToDetail(view, t, handlers)`, `outcomeToCard(view, t, handlers)`, `evidenceToChips`, `confidenceText`, `decisionLabel(seq)` (`D-14`), `historyToTimeline`.
- Filter option builders from facets.
- The `decisions` namespace (EN source, PL from the mock): status and outcome words, section labels, filter labels, append-only subtitle, errors.

## 4. Out of scope

- Fetching (OVE_DECUI002/005), rendering and actions (later tasks).

## 5. Detailed requirements

1. `decisionLabel(seq) = 'D-' + seq`. Every id shown to the Owner uses this form; the internal `dec_...` id is used only in URLs.
2. Status mapping `Record<DecisionStatus, {tone, labelKey}>` using `decisionStatusTone` (OVE_DS040): `accepted` `przyjęta` mint, `proposed` `propozycja` lavender, `needs_review` `do przeglądu` amber, `superseded` `zastąpiona` neutral, `rejected` `odrzucona` error. Outcome mapping with `decisionOutcomeTone`: `wynik: pozytywny|mieszany|nieznany|negatywny` (the row prefix `wynik:` is part of the label key `decisions:outcome.rowLabel`).
3. Row meta line = `${workspaceName} · ${originLabel}` where `originLabel` comes from `originLabelKey` (`Chief`, `Dyskusja`, `Dyskusja · Właściciel`, `Właściciel`); a missing Workspace name (deleted or isolated and not visible) shows `—`.
4. Confidence: `confidenceLabel` low/medium/high -> PL `niska`/`średnia`/`wysoka` plus the numeric value with a decimal comma through `formatNumber` (`średnia · 0,7`).
5. Alternatives: `chosen` = `alt.key === view.selectedOption`; reason text = `summary`; arguments by participant are NOT shown in the card (post-MVP) but `arguments.length` may show as `n argumentów` in the card `title` attribute only if present (ASSUMPTION).
6. Participants -> avatars: `chief` uses hue `chief`, `agent` uses `hueForAgentId(id)`, `owner` initials `Ty`; names plain text.
7. Skills used -> `{ name, version }` rendered `TypeScript v4` (version always shown; missing version shows `?` with a title).
8. Outcome card: `proposal` from `outcomeProposal` (`Chief proponuje:` + outcome word + `· przegląd <reviewDate>`) when present, else a muted `Chief jeszcze nie zaproponował wyniku`; `evidenceText` = proposal rationale (plainText, <= 600 chars shown, full in title); `evidence` from `outcomeEvidence` mapped by kind: `artifact` -> openable chip (mint), `doc` -> doc chip, `task`/`run`/`decision`/`discussion` -> link chip with internal route, `url` -> inert text chip (the app NEVER fetches or opens agent-supplied URLs automatically; an Owner click opens through `SafeLink` http(s) only, with a confirm note `Otwiera zewnętrzną stronę`).
9. Verdict value: `view.outcome` if it is not `unknown`; if it is `unknown` the mapper returns `value: undefined` and helper `Brak werdyktu`, unless the history contains an `outcome_verdict` event (then `nieznany` is selected). ASSUMPTION: the history check is done by the detail hook; a later DEC additive field `verdictSetAt` simplifies it (reported).
10. `historyToTimeline(events)`: kinds `status_changed`, `superseded`, `evidence_added`, `outcome_proposed`, `outcome_verdict`, `review_date_set`, `review_due`, `note` with tones and short texts; actor label `Ty`/`Chief`/agent name; no payload text beyond enums and short strings (plainText).
11. Unknown enum values from a newer engine map to a neutral chip with the raw word; no mapper throws.
12. Namespace `decisions` keys (EN + PL complete): `nav.*`, `title`, `subtitle` (`Tylko dopisywanie. Zmiana to nowa Decyzja, która zastępuje starą.`), `status.*`, `outcome.*`, `section.*`, `filter.workspace|status|outcome` (`Wszystkie Workspace'y`, `Status: każdy`, `Wynik: każdy`), `confidence.*`, `errors.*` for DEC codes (`not_found`, `already_superseded`, `verdict_forbidden`, `invalid_transition`, `evidence_forbidden`, `version_conflict`, `rate_limited`).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

Types/maps of OVE_DS040, `plainText`, `isRelativeDocPath` (OVE_BOARDUI002), formatting helpers (OVE_ARCH011).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `model/{labels.ts,decision-row.ts,decision-detail.ts,outcome.ts,evidence.ts,history.ts,filters.ts,index.ts}`; locale files owned here.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Decision with zero participants (defensive): section hidden.
- Alternatives < 2 (`thin: true`): the detail shows a muted note `Cienka Decyzja: mało alternatyw` (key `decisions:detail.thin`).
- `reviewDate` in the past and status `needs_review`: label amber.
- Long title (160 chars): wraps in the row (2-line clamp in ui-kit).
- `workspaceName` null on a ref: link text `D-03 · ...` without Workspace parenthesis.

## 11. Acceptance criteria

- [ ] Given every status and outcome, Then tone and PL word match the table (exhaustive type-level test).
- [ ] Given the D-14 fixture, Then `decisionViewToDetail` yields the mock strings (`średnia · 0,7`, `wybrana` on date-fns).
- [ ] Given an evidence ref of kind `url`, Then the chip is inert unless opened via SafeLink after the confirm note.
- [ ] Given unknown enums, Then no throw.
- [ ] `pnpm i18n:check` passes.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): table tests `decision-row.test.ts`, `decision-detail.test.ts`, `outcome.test.ts`, `evidence.test.ts`, `history.test.ts`; fixtures typed against contracts. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. Locale files owned here only; later tasks use `decisions-<topic>.json`.

## 14. Open questions and assumptions

- GAP (reported to DEC): `DecisionView` cannot distinguish `no verdict yet` from `verdict unknown`; suggested additive field `verdictSetAt?: IsoDateTime`.
- ASSUMPTION: argument counts per alternative are not shown in MVP.
