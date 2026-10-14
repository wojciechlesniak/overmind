---
id: OVE_DECUI007
title: "Outcome card and the Owner verdict: record, change, history"
area: DECUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DEC011, OVE_DECUI006, OVE_DS025, OVE_DS028, OVE_DS037, OVE_DS040, OVE_DS065]
soft_depends_on: []
provides: ["lib:decision-verdict"]
needs: ["ui:OutcomeCard", "ui:VerdictSelect", "ui:EvidenceList", "api:decision.verdict", "lib:api-client-decision", "lib:use-gateway-mutation", "ui:Popover", "ui:Toast"]
owns: ["apps/desktop/src/features/decisions/regions/outcome.region.tsx", "apps/desktop/src/features/decisions/state/use-verdict.ts", "apps/desktop/src/locales/en/decisions-outcome.json", "apps/desktop/src/locales/pl/decisions-outcome.json"]
reads: []
design: design.png
design_source: "Decyzje#decis/outcome-card + decis/verdict-buttons (crop 492,597,928,190 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI007: Outcome card and the Owner verdict: record, change, history

## 1. Summary

Makes the `WYNIK DECYZJI` card live: shows Chief's proposed outcome with evidence and lets the Owner record the verdict (`pozytywny`, `mieszany`, `nieznany`, `negatywny`), changing it later while the history stays.

## 2. Context

Chief collects evidence and proposes an outcome (DEC006); only the Owner issues the verdict and may change it, the history of changes remains (ADR 0008). `POST /decisions/:id/verdict { outcome, note?, evidenceRefs? }` is owner and desktop only (`dec.verdict_forbidden` otherwise), idempotency key supported. The card shows `Chief proponuje: pozytywny · przegląd 2026-11-10`, the evidence sentence and chips and the segmented verdict `Twój werdykt:`. An outcome other than `unknown` requires evidence on Chief's side; the Owner's verdict does not (it is the final word).

## 3. Scope (in)

- `outcome.region.tsx` registering the card into the detail slot `outcomeSlot`.
- `useVerdict(decisionId)` mutation hook.
- Optional note field (<= 500 chars) shown after selecting a verdict that differs from Chief's proposal.
- Verdict history line under the card.

## 4. Out of scope

- Review date (OVE_DECUI012), proposing outcomes (Chief), evidence upload (post-MVP).

## 5. Detailed requirements

1. Props via `outcomeToCard`; `verdict.options` = the four outcomes with PL labels; `value` per OVE_DECUI001 rules; `saving` while the mutation runs; `onChange(outcome)` -> `run({ outcome, note? })`.
2. No optimistic selection: the segmented control shows the engine value; during `saving` the ui-kit disables it with a spinner. On success refetch detail + history and toast `Zapisano werdykt: <word>`; the live region announces the change.
3. When the chosen outcome differs from Chief's proposal, a `ui:Popover` anchored to the control offers an optional note (`Dlaczego inaczej? (opcjonalnie)`, plain text, max 500) with `Zapisz` and `Pomiń`; both send the verdict (the note is optional). When it equals the proposal the verdict is sent immediately.
4. Idempotency key per user intent (ULID) so a double click cannot write two history entries.
5. Verdict history: below the card a compact list of the latest 3 verdict events (`Ty: mieszany · 2026-10-02`, `Chief zaproponował: pozytywny`), from history; `Pokaż całą historię` expands the OVE_DECUI011 timeline section.
6. `dec.verdict_forbidden` (non-owner/remote): toast with `decisions:errors.verdict_forbidden`; the control reverts. `dec.version_conflict` -> refetch + toast. `dec.invalid_transition` for superseded Decisions: controls are already disabled by `readOnlyReason` (`Zastąpiona: werdykt zmienia nowa Decyzja`).
7. Superseded Decisions: `readOnlyReason` set; no mutation possible from the UI.
8. Verdicts do not widen permissions, so no Local Approval is used here (stated to avoid accidental over-engineering).
9. Evidence chips: `artifact` opens the Artifact preview route; others per OVE_DECUI001.

## 6. Design notes

`design.png` shows the outcome card: label `WYNIK DECYZJI`, `Chief proponuje: pozytywny · przegląd 2026-11-10`, evidence sentence `Dowody: bundle 41 KB zamiast 271 KB, 0 błędów stref w 112 testach jednostkowych.`, mint chips `bundle-report.json` and `unit-report.xml`, and `Twój werdykt:` with four buttons (`pozytywny` selected mint). Built by OVE_DS065. Not in the mock: saving state, error, note popover, read-only superseded state, `Brak werdyktu`.

## 7. Reuse

`ui:OutcomeCard`/`VerdictSelect` (OVE_DS065/DS025), `ui:Popover`, `ui:Toast`, `useGatewayMutation`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/outcome.region.tsx` (slot `main`, order 30, registers into the detail slot store), `state/use-verdict.ts`.

## 9. Security and safety

Verdicts are Owner-only decisions that shape Chief's future recommendations; the UI never sends actor/channel, relies on the gateway for `owner desktop` enforcement and shows `verdict_forbidden` if refused. Evidence refs sent back are only ones the Owner explicitly attached (none in MVP), never agent-supplied URLs auto-attached. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Verdict set twice quickly with different values: single-flight, last confirmed engine value shown.
- Network error: control reverts, toast with retry.
- Chief proposes a new outcome while the Owner is choosing: refetch updates the proposal line only.
- Outcome `unknown` chosen explicitly: becomes a verdict event (history shows it).

## 11. Acceptance criteria

- [ ] Given a click on `mieszany`, Then `POST /decisions/:id/verdict` is sent once with an idempotency key, the control shows saving, then the new value after refetch.
- [ ] Given `verdict_forbidden`, Then the value reverts and a toast explains.
- [ ] Given a superseded Decision, Then the controls are disabled with the reason visible.
- [ ] Given a verdict differing from Chief's proposal, Then the optional note popover appears and either button sends the verdict.
- [ ] Visual match with `design.png`.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-verdict.test.tsx` (single-flight, errors), `outcome.region.test.tsx`, story `Decisions/OutcomeCard` states, visual test against `design.png`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: verdicts need no Local Approval (they do not widen permissions).
- ASSUMPTION: note popover is optional UX; if not wanted, remove the popover and send immediately.
