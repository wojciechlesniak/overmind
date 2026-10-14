---
id: OVE_RUNUI010
title: "Aggregate usage for display: per CLI limits, per Agent time, grouping (pure)"
area: RUNUI
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS040, OVE_PROV001, OVE_PROV002, OVE_RUNUI001]
soft_depends_on: []
provides: ["lib:runs-usage-model"]
needs: ["contract:ModelUsage", "contract:ProviderCapabilities", "ui:UiDomainTypes"]
owns: ["apps/desktop/src/features/runs/usage/model/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI010: Aggregate usage for display: per CLI limits, per Agent time, grouping (pure)

## 1. Summary

Pure mapping from the usage summary response to `UsagePanelProps` and to the grouped breakdown table (Provider, model, Agent, Run, Workspace), always labelling limits with their source ('wg CLI') and handling unknown or stale values honestly.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. SPEC 9 and ADR 0022: limits and reset times are shown as the CLI reports them with the source labelled; Overmind never claims them as its own. Mock: 'Claude Max 62% · reset 3 h', 'ChatGPT Pro · Codex 38% · reset 5 dni', 'Ollama · lokalnie bez limitu'; per Agent 'Developer · Opus 5.5 9 min', 'QA · gpt-5.5 4 min', 'Security · Sonnet 5.5 1 min'; footnote 'Wartości raportuje samo CLI. Przy 90% Chief przełącza Agentów na model zapasowy.'

## 3. Scope (in)

- `toLimitRows(summary)`, `toAgentUsageRows(summary)`, `toBreakdown(summary, groupBy)`.
- Tone thresholds (violet < 70%, amber 70-89%, error >= 90% with word 'blisko limitu').
- Duration and token formatting; reset time formatting ('reset 3 h', 'reset 5 dni').

## 4. Out of scope

- Rendering (`OVE_RUNUI011`).

## 5. Detailed requirements

1. Limit row: `provider` + `plan` ('Claude Max'), `percent` (0..100 or null), `resetLabel` from `resetAt` relative ('za 3 h', 'za 5 dni', '12.10 14:00' beyond 7 days), `stale` when `reportedAt` older than 15 min; text `62% · reset za 3 h · wg CLI` (the 'wg CLI' suffix is always present for CLI sources; for Ollama 'lokalnie · bez limitu').
2. `percent: null` -> 'brak danych wg CLI' (never 0%).
3. Tone: `<70` default, `70..89` warning, `>=90` error + word 'blisko limitu'; threshold constants shared with the top bar `LimitMeter` through `ui:stateMaps` (no duplicate magic numbers).
4. Per-Agent rows: `{name · model, minutes}`; minutes = sum of `running` time (not waiting) of the selected Run; sorted by minutes desc; ties by name; max 8 then '+N' summary line; the bar width = minutes / max.
5. Breakdown: group rows by key with columns: tokens in/out (if reported), time, share; unit words ('3 tys. tokenów'); `source` column ('wg CLI', 'Ollama', 'API'); Workspace grouping lists only Workspaces the Owner has; isolated Workspaces appear as normal rows (the Owner sees their own usage).
6. Cost: shown only when the provider reported money (`costUsd` present); never estimated; header note 'Koszt tylko, gdy raportuje go dostawca'.
7. Empty: no connections -> `limits: []` and the panel shows the 'Brak podłączonych CLI' line.
8. All numbers formatted with `Intl.NumberFormat(locale)` through an injected formatter (pure function takes `fmt`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Tone thresholds from `ui:stateMaps` (DS040) / `LimitMeter` (DS042).

## 8. Architecture and code placement

Pure TS `@RU/usage/model/`.

## 9. Security and safety

Display only. The model never extrapolates or invents limit data; unknown stays unknown (honesty rule, ADR 0022).

## 10. Errors and edge cases

- percent > 100 (CLI quirk): clamped to 100 with the raw value in title.
- Reset in the past: 'reset: odświeżanie…'.
- Agent with 0 minutes: hidden.
- Model name missing: 'model nieznany'.

## 11. Acceptance criteria

- [ ] Mock summary maps to the exact mock rows and footnote.
- [ ] Null percent never renders as 0%.
- [ ] Thresholds 69/70/89/90 map to the right tones.
- [ ] Breakdown sums equal the response totals (property test).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`to-limit-rows.test.ts`, `to-agent-rows.test.ts`, `breakdown.test.ts`. `pnpm --filter desktop vitest run src/features/runs/usage/model`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: usage summary rows carry `source` and `reportedAt` (PROV017 `ModelUsage` contract extended additively).
