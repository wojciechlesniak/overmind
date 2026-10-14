---
id: OVE_RUNUI007
title: "Map Activity entries to table rows: who, what, result, filters, redaction (pure)"
area: RUNUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS040, OVE_PERM019, OVE_RUNUI001, OVE_WFRT057]
soft_depends_on: []
provides: ["lib:runs-events-model"]
needs: ["contract:ActivityEntry", "contract:AuditEvent", "ui:UiDomainTypes"]
owns: ["apps/desktop/src/features/runs/events/model/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15", "SPECIFICATION 11"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI007: Map Activity entries to table rows: who, what, result, filters, redaction (pure)

## 1. Summary

Pure mapping from the unified `ActivityEntry` records to rows of the Activity table (CZAS, KTO, CO, WYNIK) with the exact copy patterns of the mock, result categories for `ResultCell`, and the filter state model (Run, Agent, only errors and blocks, kinds).

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Mock rows: '14:21:07 QA terminal: npx playwright test cart/ — działa', '14:20:12 Security sieć: registry.npmjs.org — czeka na Zgodę', '14:19:40 QA wiadomość do Chiefa: pominięto testy wydajności — dostarczono', '14:18:55 Developer odczyt ~/.ssh/config — zablokowane · izolacja', '14:12:03 ... git commit w worktree dev/cart-discounts — ok', '14:13:30 Quality Gate testsPassed = 96% · wymagane 100% — nie spełnia → Developer'. Entries come from audit events (permission decisions, approvals, isolation blocks), Run events (gate evaluations, node results), Tool calls and Agent messages. The server returns them already redacted and in a presentation-neutral shape `ActivityEntry { id, at, actor: {kind:'agent'|'chief'|'owner'|'system'|'gate', id?, name}, kind, summaryKey, params, result: 'ok'|'delivered'|'blocked'|'waiting'|'failed'|'gate_failed', resultDetailKey?, runId?, nodeKey?, redacted: boolean }`.

## 3. Scope (in)

- `toActivityRow(entry, i18n)`.
- Result mapping to DS069 `ResultCell`.
- Filter model `ActivityFilters` and URL (de)serialisation.
- Row grouping by time (optional day separators for multi-day feeds).

## 4. Out of scope

- Rendering (`OVE_RUNUI008`).
- Live merging (`OVE_RUNUI009`).

## 5. Detailed requirements

1. Columns: `time` (HH:MM:SS local, `title` full ISO), `who` (actor name; Gate -> 'Quality Gate'; system -> 'Overmind'; Owner -> 'Ty'), `what` (text from `summaryKey` + params, e.g. `terminal: {command}`, `sieć: {host}`, `odczyt {path}`, `wiadomość do Chiefa: {text}`, `git commit w worktree {branch}`, `{evidence} = {value} · wymagane {required}`), `result` (category + label).
2. Result labels (PL): ok 'ok', delivered 'dostarczono', blocked 'zablokowane · <reason word>' (reason word from `resultDetailKey`: 'izolacja', 'polityka', 'brak Zgody'), waiting 'czeka na Zgodę' (or 'czeka na <kind>'), failed 'błąd', gate_failed 'nie spełnia → <target label>' when `params.returnTo` exists.
3. Redaction display: values the engine replaced appear as `[ukryto]` (token supplied by the engine, wrapped by the UI in a `mark` style 'ukryte'); the UI never tries to unmask; `redacted:true` adds a small lock glyph with the title 'Wartość ukryta zgodnie z polityką redakcji'.
4. Paths are shown as given (already canonical and relative to the Workspace where possible); long values are not truncated in the model (UI ellipsizes).
5. `ActivityFilters = { runId?: RunId|'all', agentId?: AgentId|'all', onlyIssues: boolean, kinds: Kind[], nodeExecutionKey? }`; defaults: current Run, all Agents, `onlyIssues:false`; serialised to `?run=&agent=&issues=1&kind=tool,net`; invalid values dropped.
6. `onlyIssues` is a server filter (`blocked|failed|gate_failed|waiting`); the model exposes the list for tests and the chip text 'tylko błędy i blokady'.
7. Counts for the filter chips (`blocked: 3`) are optional server aggregates; absent -> hidden.
8. Unknown `kind` or result: neutral result category with the raw word; never throws.
9. Escape: all text is plain; HTML-like text stays literal.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `ResultCell` result enum from DS069.

## 8. Architecture and code placement

Pure TS `@RU/events/model/` (`to-row.ts`, `filters.ts`, `result-map.ts`).

## 9. Security and safety

Defence in depth: even though the engine redacts, the mapping never renders any field named like a secret (`token`, `secret`, `password`, `authorization`) from `params` (allow-list of param names per `summaryKey`); unknown params are dropped.

## 10. Errors and edge cases

- Entry without `runId` (system event): shown only in the 'wszystkie Runy' scope.
- Same timestamp: stable order by id.
- Entry with an unknown summaryKey: row shows the key's last segment and the kind (support-friendly).

## 11. Acceptance criteria

- [ ] Each mock row maps to its exact copy (table test).
- [ ] Params not on the allow-list are never present in the row output.
- [ ] Filters round-trip through the URL; invalid params are ignored.
- [ ] Blocked entries map to 'zablokowane · izolacja' when the reason is isolation.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`to-row.test.ts`, `filters.test.ts`, allow-list test (hostile `params`). `pnpm --filter desktop vitest run src/features/runs/events/model`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `ActivityEntry` shape as described is produced by the unified feed route (flagged unowned capability).
