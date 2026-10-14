---
id: OVE_APPRUI011
title: "Escalation report: loop-limit summary, resolution options and destructive confirm"
area: APPRUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI003, OVE_APPRUI005, OVE_APPRUI006, OVE_APPRUI012, OVE_BOARDUI001, OVE_CHIEF015, OVE_CHIEF019, OVE_DS025, OVE_DS026, OVE_DS036, OVE_DS058]
soft_depends_on: []
provides: ["lib:escalation-resolution"]
needs: ["ui:EscalationReport", "ui:RadioCardGroup", "ui:ConfirmDialog", "api:escalations.resolve", "lib:api-client-chief", "ui:Dialog", "ui:Textarea", "lib:use-gateway-mutation", "lib:approvals-route"]
owns: ["apps/desktop/src/features/approvals/regions/escalation.region.tsx", "apps/desktop/src/features/approvals/components/EscalationPane.tsx", "apps/desktop/src/features/approvals/state/use-resolve-escalation.ts", "apps/desktop/src/locales/en/approvals-escalation.json", "apps/desktop/src/locales/pl/approvals-escalation.json"]
reads: []
design: design.png
design_source: "Zgody#appr/list-item-escalation (the detail pane is not drawn in the mock, designed from OVE_DS058 `EscalationReport`) (crop 86,562,331,113 CSS px)"
spec_refs: ["SPECIFICATION 11"]
adr_refs: [15]
---

# OVE_APPRUI011: Escalation report: loop-limit summary, resolution options and destructive confirm

## 1. Summary

The pane for `ESKALACJA · LIMIT PĘTLI`: Chief's report (iterations used, last Quality Gate lines, failing criteria), the resolution options as radio cards and `Zastosuj`, with a confirmation for destructive choices.

## 2. Context

ADR 0015: Chief decides within Budget and Documentation, otherwise escalates. CHIEF015 stores options (`options_json`) and `ResolveEscalation(id, {optionKey, note?})`: Owner only; option keys come from the stored options, never from the body beyond selecting one; effects: `retry`, `skip`, `answer` (note stored as a Decision proposal), `raise_budget_for_run` (Run-only Owner-approved Budget override), `dismiss`. Telegram may only resolve non-permission options. The mock names the three choices `Zwiększ limit o 3 iteracje`, `Zmień podejście: Chief przygotuje nowy plan`, `Anuluj Run`.

## 3. Scope (in)

- `EscalationPane` mapping to `EscalationReport` (summary, key-value lines, options).
- `useResolveEscalation`.

## 4. Out of scope

- Escalation raising (CHIEF).

## 5. Detailed requirements

1. Report section: summary (plain text <=400, Overmind-templated), `KeyValueList` rows from engine facts (`Iteracje 5 z 5`, last Quality Gate result lines, failing criteria) and the subject links (`Run`, `Task`) as in-app route links.
2. Options come from the engine as `{ key, title, description, destructive?, scope? }` and render as `RadioCardGroup` cards; no option is preselected; `Zastosuj` (primary violet) enabled only after a choice.
3. Scope words: options that raise a Budget or limit show the word `tylko ten Run` taken from the option `scope` (the engine applies a Run-level override); an option that has a wider scope than the Run is never offered from the UI by this task (a widening of Workspace settings goes through the Local Approval flows, not through an Escalation).
4. Destructive option (`destructive: true`, e.g. cancel Run): after `Zastosuj` a `ConfirmDialog` states the consequence (`Run #14 zostanie anulowany. Pracy nie da się wznowić.`), Cancel is the initial focus.
5. Optional note (<=500, plain text) for `answer`-type options (the Owner's answer becomes a Decision proposal, never an automatic documentation edit: ADR 0016) with the sentence `Dokumentację zmieniasz Ty. Overmind jej nie edytuje.`
6. Submit `{ optionKey, note? }`; success -> state `decided` with the chosen title in the result line; `chief.owner_required` / `perm.local_only` -> stale session message; the option list is refetched when the Escalation was resolved elsewhere (`decided-elsewhere`).
7. Engine-side auto-resolution (`dismissed`, moot subject) shows `Rozwiązane automatycznie` with the reason.
8. All Escalation texts are plain text; no option text can add a button other than the listed options.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:EscalationReport` (OVE_DS058), `ui:RadioCardGroup`, `ui:ConfirmDialog`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/approvals/` (feature `approvals`, route `/approvals`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`), the only cross-feature use is the public export named in `needs` (`useLocalApproval` from `@features/local-approval`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/escalation.region.tsx`, `components/EscalationPane.tsx`, `state/use-resolve-escalation.ts`.

## 9. Security and safety

This view is the Owner's security gate (ADR 0003, ADR 0021). Rules enforced here and tested in OVE_APPRUI015: (1) an Approval decided here is bound to its `actionHash` and permits exactly ONE execution of exactly the displayed action (`scope: once`); the decision body has no scope field; (2) the UI never broadens an approval: a permanent effect (lifting an Approval requirement, a permanent directory grant, adding a host to the network allow-list) is a SEPARATE explicit action with its own confirmation and a Local Approval (`useLocalApproval`, bound to the exact arguments, single use, desktop only); no button combines `once` and `permanent`, and no default selects permanent; (3) Telegram can only approve for the current Run; this view therefore labels decisions that came from Telegram and never offers to upgrade them; (4) every text from an Agent (justification, commit subjects, message bodies, paths typed by the Agent) is untrusted and rendered only as plain text, labelled as the Agent's claim, never as HTML or a link made from it; (5) the displayed summary and preview are produced by the engine from structured data, so the UI shows `summary` and structured fields, not text that the Agent supplied; (6) fail closed: if the detail cannot be loaded or has expired, no decision control is rendered. The Escalation body carries only an option KEY chosen from the engine-provided list; the UI cannot invent an option. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Options list empty (engine bug): only `Zamknij` (dismiss) if provided, else an info that nothing can be resolved from here.
- Resolved while open: `decided-elsewhere`.
- Very long failing-criteria list: scroll within the report.

## 11. Acceptance criteria

- [ ] Given the fixture with three options, Then none is preselected and `Zastosuj` is disabled until a choice.
- [ ] Given the destructive option, Then a confirm dialog appears first with Cancel focused.
- [ ] Given a raise-limit option, Then the card says `tylko ten Run`.
- [ ] Given submit, Then the body is exactly `{optionKey}` (plus `note` when entered).
- [ ] Given an unknown option key in the body (tampered), Then the engine rejects and the UI shows the error without applying anything.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `EscalationPane.test.tsx` (selection, destructive confirm, note, errors). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test approvals`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_APPRUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_APPRUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- GAP (reported to CHIEF): the options contract (`key,title,description,destructive?,scope?`), the report facts (iteration counters, last Quality Gate lines) and the `cancel Run` effect are not in the CHIEF015 effect list (`retry|skip|answer|raise_budget_for_run|dismiss`); `Anuluj Run` and `Zmień podejście` need option kinds.
